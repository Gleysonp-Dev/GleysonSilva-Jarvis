export type GreetingMusicOptions = { src: string; volume?: number };
type MusicSession = { audio: HTMLAudioElement; context: AudioContext; source: MediaElementAudioSourceNode; gain: GainNode };

/** Caller supplies the user's local file/blob URL. No default music or downloads. */
export class GreetingMusic {
  private generation = 0;
  private session?: MusicSession;
  constructor(private readonly callbacks: { onError?(message: string): void } = {}) {}

  async start({ src, volume = 0.2 }: GreetingMusicOptions): Promise<void> {
    this.stop();
    const generation = ++this.generation;
    const target = this.volume(volume);
    if (typeof src !== 'string' || !src.trim()) throw new Error('Escolha um arquivo de música para a recepção.');
    const base = new URL(window.location.href), url = new URL(src, base);
    if (url.protocol !== 'blob:' && (url.protocol !== base.protocol || url.host !== base.host)) throw new Error('A música da recepção deve usar um arquivo local selecionado.');
    let audio: HTMLAudioElement | undefined, context: AudioContext | undefined;
    try {
      audio = new Audio(url.href); audio.preload = 'auto'; audio.loop = true;
      context = new AudioContext();
      const source = context.createMediaElementSource(audio), gain = context.createGain();
      gain.gain.setValueAtTime(target, context.currentTime); source.connect(gain); gain.connect(context.destination);
      const session = { audio, context, source, gain }; this.session = session;
      audio.onerror = () => { if (this.session === session) { this.stop(); this.callbacks.onError?.('Não foi possível reproduzir o arquivo de música selecionado.'); } };
      let resumeTimer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([context.resume(), new Promise((_, reject) => { resumeTimer = setTimeout(() => reject(new Error('audio_gesture_required')), 3000); })]); }
      finally { clearTimeout(resumeTimer); }
      if (generation !== this.generation) return;
      await audio.play();
      if (generation !== this.generation) audio.pause();
    } catch {
      if (generation !== this.generation) return;
      this.stop(); if (audio) { audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load(); } void context?.close().catch(() => {});
      const message = 'A música não iniciou. Confira o arquivo e a permissão de reprodução de áudio.';
      this.callbacks.onError?.(message); throw new Error(message);
    }
  }

  /** Absolute 0..1 output level, ramped over 150 ms beneath speech. */
  duck(volume = 0.06): void {
    const target = this.volume(volume), session = this.session;
    if (!session || session.context.state === 'closed') return;
    const at = session.context.currentTime, parameter = session.gain.gain;
    if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(at);
    else { const value = parameter.value; parameter.cancelScheduledValues(at); parameter.setValueAtTime(value, at); }
    parameter.linearRampToValueAtTime(target, at + 0.15);
  }
  stop(): void {
    this.generation++; const session = this.session; this.session = undefined;
    if (!session) return;
    session.audio.onerror = null; session.audio.pause(); session.audio.removeAttribute('src'); session.audio.load();
    session.source.disconnect(); session.gain.disconnect(); void session.context.close().catch(() => {});
  }
  private volume(value: number) { if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError('Volume da música inválido.'); return value; }
}
