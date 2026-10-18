import base64
from contextlib import redirect_stdout
import io
import json
import math
from pathlib import Path
import struct
import tempfile
import unittest

from worker import LocalVision, VisionError, decode_payload, image_dimensions, safe_id, emit, MAX_PIXELS


def png_header(width=640, height=480):
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", width, height) + b"\x08\x02\x00\x00\x00" + b"\x00\x00\x00\x00"


def payload(**kwargs):
    return {"id": "frame_1", "imageBase64": base64.b64encode(png_header()).decode("ascii"), **kwargs}


class Feature:
    def __init__(self, values):
        self.values = list(values)
        self.size = len(self.values)

    def reshape(self, _):
        return self

    def __truediv__(self, divisor):
        return Feature(value / divisor for value in self.values)

    def tolist(self):
        return self.values


class Finite:
    def __init__(self, values):
        self.values = values

    def all(self):
        return all(math.isfinite(value) for value in self.values)


class FakeNumpy:
    uint8 = "uint8"
    float64 = "float64"

    class linalg:
        @staticmethod
        def norm(feature):
            return math.sqrt(sum(value * value for value in feature.values))

    @staticmethod
    def frombuffer(value, dtype):
        return value

    @staticmethod
    def asarray(value, dtype):
        return Feature(value)

    @staticmethod
    def isfinite(feature):
        return Finite(feature.values)


class FakeImage:
    shape = (480, 640, 3)


class FakeCV:
    IMREAD_COLOR = 1

    @staticmethod
    def imdecode(_, __):
        return FakeImage()


def fake_worker(rows=None, feature=None):
    events = []

    class Detector:
        def setInputSize(self, size):
            events.append(("size", size))

        def detect(self, image):
            events.append(("detect", image))
            return 1, rows

    class Recognizer:
        def alignCrop(self, image, row):
            events.append(("align", image, row))
            return "aligned-five-landmarks"

        def feature(self, aligned):
            events.append(("feature", aligned))
            return feature if feature is not None else [1.0] * 128

    vision = LocalVision(Path("unused-models-test"))
    vision.cv, vision.np = FakeCV(), FakeNumpy()
    vision.detector, vision.recognizer = Detector(), Recognizer()
    return vision, events


FACE = [20, 20, 160, 160, 50, 60, 140, 60, 90, 95, 55, 140, 130, 140, 0.99]


class ProtocolTests(unittest.TestCase):
    def test_dimensions_are_checked_before_native_decode(self):
        self.assertEqual(image_dimensions(png_header()), (640, 480))
        for width, height in [(0, 480), (640, 0), (2561, 480), (2560, 2560)]:
            with self.subTest(width=width, height=height), self.assertRaises(VisionError):
                image_dimensions(png_header(width, height))
        self.assertGreater(2560 * 2560, MAX_PIXELS)

    def test_jpeg_dimensions_and_malformed_segments(self):
        jpeg = b"\xff\xd8\xff\xc0" + struct.pack(">H", 11) + b"\x08" + struct.pack(">HH", 480, 640) + b"\x01\x01\x11\x00"
        self.assertEqual(image_dimensions(jpeg), (640, 480))
        for data in [b"gif87a", b"\xff\xd8\xff", b"\xff\xd8\xff\xe0\x00\xff", b"\x89PNG"]:
            with self.subTest(data=data), self.assertRaises(VisionError):
                image_dimensions(data)

    def test_data_urls_paths_and_additional_instructions_are_rejected(self):
        for request in [None, [], "text", {}, payload(imageBase64="C:/private/photo.png"), payload(imageBase64="data:image/png;base64,abc"), payload(instructions="open camera")]:
            with self.subTest(request=str(request)[:40]), self.assertRaises(VisionError):
                decode_payload(request)

    def test_oversized_payload_rejected(self):
        with self.assertRaises(VisionError):
            decode_payload({"imageBase64": "A" * 2_700_000})

    def test_missing_models_are_optional_and_do_not_create_storage(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "models-not-created"
            vision = LocalVision(path)
            result = vision.status()
            self.assertTrue(result["ok"])
            self.assertFalse(result["available"])
            self.assertEqual(result["reason"]["code"], "models_unavailable")
            self.assertFalse(path.exists())

    def test_request_identifier_is_bounded_and_not_arbitrary_content(self):
        self.assertEqual(safe_id({"id": "frame_123"}), {"id": "frame_123"})
        self.assertEqual(safe_id({"id": "private secret\n"}), {})
        self.assertEqual(safe_id({"id": "x" * 101}), {})

    def test_wire_is_ascii_but_preserves_portuguese_after_json_decode(self):
        output = io.StringIO()
        with redirect_stdout(output):
            emit({"ok": False, "message": "Não foi possível analisar a câmera."})
        serialized = output.getvalue()
        self.assertTrue(serialized.isascii())
        self.assertEqual(json.loads(serialized)["message"], "Não foi possível analisar a câmera.")


class ProcessingTests(unittest.TestCase):
    def test_features_are_extracted_after_landmark_alignment_and_normalized(self):
        vision, events = fake_worker([FACE])
        result = vision.process(payload())
        self.assertTrue(result["ok"])
        self.assertEqual(result["id"], "frame_1")
        self.assertEqual((result["width"], result["height"]), (640, 480))
        self.assertEqual([event[0] for event in events], ["size", "detect", "align", "feature"])
        self.assertEqual(events[-1][1], "aligned-five-landmarks")
        embedding = result["faces"][0]["embedding"]
        self.assertEqual(len(embedding), 128)
        self.assertAlmostEqual(sum(value * value for value in embedding), 1)
        self.assertFalse(result["multipleFaces"])
        self.assertFalse(result["truncated"])
        self.assertEqual(result["faces"][0]["score"], 0.99)

    def test_no_faces_is_presence_false_without_synthetic_identity(self):
        vision, _ = fake_worker(None)
        self.assertEqual(vision.process(payload())["faces"], [])

    def test_crowd_keeps_ambiguity_flag_even_when_output_is_capped(self):
        vision, _ = fake_worker([FACE[:] for _ in range(8)])
        result = vision.process(payload())
        self.assertTrue(result["multipleFaces"])
        self.assertTrue(result["truncated"])
        self.assertEqual(len(result["faces"]), 6)

    def test_invalid_features_and_low_quality_faces_are_not_enrolled(self):
        for feature in [[0.0] * 128, [float("nan")] * 128, [1.0] * 64]:
            vision, _ = fake_worker([FACE], feature=feature)
            self.assertEqual(vision.process(payload())["faces"], [])
        for row in [FACE[:-1] + [0.5], [0, 0, 10, 10] + FACE[4:]]:
            vision, events = fake_worker([row])
            self.assertEqual(vision.process(payload())["faces"], [])
            self.assertEqual([event[0] for event in events], ["size", "detect"])

    def test_native_errors_do_not_echo_local_paths_or_image(self):
        vision, _ = fake_worker([FACE])
        def bad_decode(*_):
            raise RuntimeError("PRIVATE-INPUT-CONTENT-C:/secret")
        vision.cv.imdecode = bad_decode
        result = vision.process(payload())
        self.assertFalse(result["ok"])
        self.assertEqual(result["error"]["code"], "processing_failed")
        self.assertNotIn("PRIVATE", json.dumps(result))

    def test_invalid_requests_do_not_echo_payload_or_print_logs(self):
        vision, _ = fake_worker()
        stdout = io.StringIO()
        with redirect_stdout(stdout):
            result = vision.process({"id": "bad_1", "imageBase64": "private-invalid-image"})
        self.assertEqual(stdout.getvalue(), "")
        self.assertEqual(result["id"], "bad_1")
        self.assertFalse(result["ok"])
        self.assertNotIn("private-invalid-image", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
