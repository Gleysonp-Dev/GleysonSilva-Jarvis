/** A reception captures one small image, then releases the camera before any upload. */
export async function captureOutfitImage({ signal, timeoutMs = 12000 }: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const cancelled = () => new DOMException('Captura interrompida.', 'AbortError');
  if (signal?.aborted) throw cancelled();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  let stream: MediaStream | undefined;
  let video: HTMLVideoElement | undefined;
  const wait = <T,>(promise: Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const stop = () => reject(cancelled());
    if (controller.signal.aborted) { void Promise.resolve(promise).catch(() => {}); reject(cancelled()); return; }
    controller.signal.addEventListener('abort', stop, { once: true });
    promise.then(value => { controller.signal.removeEventListener('abort', stop); if (controller.signal.aborted) reject(cancelled()); else resolve(value); }, error => { controller.signal.removeEventListener('abort', stop); reject(error); });
  });
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Câmera indisponível neste dispositivo.');
    const permission = navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 } } });
    // Permission prompts cannot be cancelled by browsers. A late stream is still released.
    void permission.then(value => { if (controller.signal.aborted) value.getTracks().forEach(track => track.stop()); }, () => {});
    stream = await wait(permission);
    video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream;
    await wait(video.play());
    if (video.readyState < 2) {
      await wait(new Promise<void>((resolve, reject) => {
        const clear = () => { video?.removeEventListener('loadeddata', loaded); video?.removeEventListener('error', failed); controller.signal.removeEventListener('abort', clear); };
        const loaded = () => { clear(); resolve(); };
        const failed = () => { clear(); reject(new Error('Não foi possível obter a imagem da câmera.')); };
        video!.addEventListener('loadeddata', loaded, { once: true }); video!.addEventListener('error', failed, { once: true }); controller.signal.addEventListener('abort', clear, { once: true });
      }));
    }
    if (controller.signal.aborted) throw cancelled();
    if (!video.videoWidth || !video.videoHeight) throw new Error('A câmera não forneceu uma imagem válida.');
    const canvas = document.createElement('canvas');
    const ratio = Math.min(640 / video.videoWidth, 480 / video.videoHeight, 1);
    canvas.width = Math.max(1, Math.floor(video.videoWidth * ratio)); canvas.height = Math.max(1, Math.floor(video.videoHeight * ratio));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar a captura da câmera.');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL('image/jpeg', 0.78);
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image) || Math.ceil((image.length - 23) * 3 / 4) > 512 * 1024) throw new Error('A captura excedeu o tamanho permitido.');
    return image;
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort);
    stream?.getTracks().forEach(track => track.stop());
    if (video) { video.pause(); video.srcObject = null; video.removeAttribute('src'); video.load(); }
  }
}
