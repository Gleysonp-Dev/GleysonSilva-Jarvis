#!/usr/bin/env python3
"""Optional, local YuNet + SFace worker. JSON lines in/out; no camera, network or storage."""

from __future__ import annotations

import argparse
import base64
import binascii
import json
import math
import os
from pathlib import Path
import struct
import sys
from typing import Any

os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")
os.environ.setdefault("OPENCV_IO_MAX_IMAGE_PIXELS", "4194304")

MAX_LINE_BYTES = 2_800_000
MAX_IMAGE_BYTES = 2_000_000
MAX_PIXELS = 4_194_304
MAX_SIDE = 2560
MAX_FACES = 6
DETECTION_MODEL = "face_detection_yunet_2023mar.onnx"
RECOGNITION_MODEL = "face_recognition_sface_2021dec.onnx"

MESSAGES = {
    "invalid_request": "Envie uma solicitação JSON com imagem JPEG ou PNG em base64.",
    "invalid_image": "O quadro está inválido ou excede os limites de tamanho.",
    "dependencies_unavailable": "Visão local opcional indisponível. Configure Python, OpenCV e NumPy.",
    "models_unavailable": "Os modelos locais YuNet e SFace ainda não foram configurados.",
    "model_load_failed": "Não foi possível carregar os modelos locais. Confira arquivos e versões.",
    "processing_failed": "Não foi possível analisar este quadro localmente.",
}


class VisionError(Exception):
    def __init__(self, code: str):
        super().__init__(MESSAGES.get(code, MESSAGES["processing_failed"]))
        self.code = code


def safe_id(request: Any) -> dict[str, Any]:
    if not isinstance(request, dict):
        return {}
    value = request.get("id")
    if isinstance(value, str) and 0 < len(value) <= 100 and all(c.isalnum() or c in "_.:-" for c in value):
        return {"id": value}
    return {}


def image_dimensions(data: bytes) -> tuple[int, int]:
    """Inspect dimensions before native decode to reject unusually large compressed images."""
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 33 and data[12:16] == b"IHDR":
        width, height = struct.unpack(">II", data[16:24])
    elif data.startswith(b"\xff\xd8"):
        index = 2
        width = height = 0
        # SOF markers with a sample precision byte followed by dimensions.
        sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
        while index < len(data):
            if data[index] != 0xFF:
                raise VisionError("invalid_image")
            while index < len(data) and data[index] == 0xFF:
                index += 1
            if index >= len(data):
                break
            marker = data[index]
            index += 1
            if marker in {0xD8, 0x01} or 0xD0 <= marker <= 0xD7:
                continue
            if marker in {0xD9, 0xDA} or index + 2 > len(data):
                break
            length = struct.unpack(">H", data[index:index + 2])[0]
            if length < 2 or index + length > len(data):
                raise VisionError("invalid_image")
            if marker in sof and length >= 8:
                height, width = struct.unpack(">HH", data[index + 3:index + 7])
                break
            index += length
    else:
        raise VisionError("invalid_image")
    if not (1 <= width <= MAX_SIDE and 1 <= height <= MAX_SIDE and width * height <= MAX_PIXELS):
        raise VisionError("invalid_image")
    return width, height


def decode_payload(request: Any) -> tuple[bytes, tuple[int, int]]:
    if not isinstance(request, dict) or set(request) - {"id", "imageBase64", "type"}:
        raise VisionError("invalid_request")
    if request.get("type", "analyze") != "analyze":
        raise VisionError("invalid_request")
    value = request.get("imageBase64")
    if not isinstance(value, str) or not value or len(value) > ((MAX_IMAGE_BYTES + 2) // 3) * 4:
        raise VisionError("invalid_request")
    # The main process strips the data URL; paths, URLs and file names are never accepted.
    try:
        data = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error):
        raise VisionError("invalid_image") from None
    if not data or len(data) > MAX_IMAGE_BYTES:
        raise VisionError("invalid_image")
    return data, image_dimensions(data)


class LocalVision:
    def __init__(self, models_dir: Path):
        self.models_dir = models_dir.expanduser().resolve()
        self.cv = None
        self.np = None
        self.detector = None
        self.recognizer = None

    def _model_paths(self) -> tuple[Path, Path]:
        result = []
        for name in (DETECTION_MODEL, RECOGNITION_MODEL):
            candidate = self.models_dir / name
            try:
                if candidate.is_symlink() or not candidate.is_file() or candidate.resolve().parent != self.models_dir or candidate.stat().st_size < 1024:
                    raise VisionError("models_unavailable")
            except OSError:
                raise VisionError("models_unavailable") from None
            result.append(candidate)
        return result[0], result[1]

    def _load(self) -> None:
        if self.detector is not None:
            return
        detection, recognition = self._model_paths()
        try:
            import cv2 as cv
            import numpy as np
        except (ImportError, OSError):
            raise VisionError("dependencies_unavailable") from None
        if not all(hasattr(cv, attr) for attr in ("FaceDetectorYN", "FaceRecognizerSF")):
            raise VisionError("dependencies_unavailable")
        try:
            cv.setNumThreads(1)
            self.detector = cv.FaceDetectorYN.create(str(detection), "", (640, 480), 0.85, 0.3, 5000)
            self.recognizer = cv.FaceRecognizerSF.create(str(recognition), "")
            self.cv, self.np = cv, np
        except Exception:
            self.detector = self.recognizer = None
            raise VisionError("model_load_failed") from None

    def status(self) -> dict[str, Any]:
        try:
            self._load()
            return {"ok": True, "available": True, "backend": "opencv-yunet-sface-cpu", "embeddingDimensions": 128}
        except VisionError as error:
            return {"ok": True, "available": False, "reason": {"code": error.code, "message": str(error)}}

    def analyze(self, request: Any) -> dict[str, Any]:
        data, (expected_width, expected_height) = decode_payload(request)
        self._load()
        cv, np = self.cv, self.np
        try:
            image = cv.imdecode(np.frombuffer(data, dtype=np.uint8), cv.IMREAD_COLOR)
            if image is None or len(image.shape) != 3 or image.shape[2] != 3:
                raise VisionError("invalid_image")
            height, width = image.shape[:2]
            if (width, height) != (expected_width, expected_height):
                raise VisionError("invalid_image")
            self.detector.setInputSize((width, height))
            _, detected = self.detector.detect(image)
            faces = []
            rows = [] if detected is None else detected
            # Return all detected faces up to the cap so the caller can avoid identifying a crowd as one user.
            for row in rows[:MAX_FACES]:
                if len(row) < 15 or not all(math.isfinite(float(value)) for value in row):
                    continue
                x, y, face_width, face_height = [float(value) for value in row[:4]]
                score = float(row[-1])
                if face_width < 20 or face_height < 20 or score < 0.85:
                    continue
                # YuNet's five landmarks are required: do not extract features from an unaligned crop.
                aligned = self.recognizer.alignCrop(image, row)
                feature = np.asarray(self.recognizer.feature(aligned), dtype=np.float64).reshape(-1)
                norm = float(np.linalg.norm(feature))
                if feature.size != 128 or not np.isfinite(feature).all() or not math.isfinite(norm) or norm <= 0:
                    continue
                embedding = (feature / norm).tolist()
                faces.append({"bbox": [round(x, 3), round(y, 3), round(face_width, 3), round(face_height, 3)],
                              "score": round(score, 6), "embedding": embedding})
            return {"ok": True, "faces": faces, "width": width, "height": height,
                    "multipleFaces": len(rows) > 1, "truncated": len(rows) > MAX_FACES}
        except VisionError:
            raise
        except Exception:
            raise VisionError("processing_failed") from None

    def process(self, request: Any) -> dict[str, Any]:
        if isinstance(request, dict) and request.get("type") == "status" and not (set(request) - {"type", "id"}):
            return {**self.status(), **safe_id(request)}
        try:
            return {**self.analyze(request), **safe_id(request)}
        except VisionError as error:
            return {"ok": False, "error": {"code": error.code, "message": str(error)}, **safe_id(request)}


def emit(result: dict[str, Any]) -> None:
    # Stdout is a private process pipe. Never copy embeddings or images to logs or renderer IPC.
    # ASCII on the pipe avoids locale dependencies and partial UTF-8 decoding in host process chunks.
    print(json.dumps(result, ensure_ascii=True, allow_nan=False, separators=(",", ":")), flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Optional local face-feature worker; does not open a camera.")
    parser.add_argument("--models-dir", type=Path, required=True)
    parser.add_argument("--status", action="store_true", help="Report optional availability and exit.")
    args = parser.parse_args()
    vision = LocalVision(args.models_dir)
    if args.status:
        emit(vision.status())
        return 0
    while True:
        line = sys.stdin.buffer.readline(MAX_LINE_BYTES + 1)
        if not line:
            break
        if len(line) > MAX_LINE_BYTES:
            emit({"ok": False, "error": {"code": "invalid_request", "message": MESSAGES["invalid_request"]}})
            # Close the pipe rather than treating the remainder of an oversized line as a new request.
            return 2
        try:
            request = json.loads(line)
        except (ValueError, UnicodeDecodeError, RecursionError):
            emit({"ok": False, "error": {"code": "invalid_request", "message": MESSAGES["invalid_request"]}})
            continue
        emit(vision.process(request))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
