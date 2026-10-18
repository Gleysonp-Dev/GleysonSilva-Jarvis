import { DoubleClapDetector } from './wake-detector';

export type StandbyState = 'stopped' | 'starting' | 'listening' | 'suspended';
export type StandbyCallbacks = { onWake(source: 'clap'): void; onLevels?(levels: { rms: number; level: number }): void; onError?(message: string): void };
type CaptureFlight = { generation: number; stream?: MediaStream; context?: AudioContext };

/**
 * Local clap standby. No WebSpeech, recording, WebRTC or cloud audio transport.
 * A 20 ms timer processes live microphone frames even without animation frames.
 * Browsers may throttle background timers; reliable minimized operation requires
 * the desktop host's background policy. Permissions always remain user controlled.
 * suspend() releases capture before narration; resume() reacquires only when armed.
 */
export class LocalClapStandby {
  private state: StandbyState = 'stopped';
  private desired: StandbyState = 'stopped';
  private armed = false;
  private generation = 0;
  private pending?: Promise<void>;
  private flight?: CaptureFlight;
  private stream?: MediaStream;
  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private analyser?: AnalyserNode;
  private timer?: ReturnType<typeof setInterval>;
  private wakeNotBefore = 0;
  private readonly detector = new DoubleClapDetector();
  constructor(private readonly callbacks: StandbyCallbacks) {}

  getState(): StandbyState { return this.state; }
  start(): Promise<void> { this.armed = true; this.desired = 'listening'; return this.acquire(); }
  resume(): Promise<void> { if (!this.armed) return Promise.resolve(); this.desired = 'listening'; return this.acquire(); }
  suspend(): void { if (!this.armed) return; this.desired = 'suspended'; this.generation++; this.release(); this.state = 'suspended'; }
  stop(): void { this.armed = false; this.desired = 'stopped'; this.wakeNotBefore = 0; this.generation++; this.release(); this.state = 'stopped'; }

  private acquire(): Promise<void> {
    if (!this.armed || this.desired !== 'listening' || this.stream) return Promise.resolve();
    // A cancelled browser permission request cannot itself be aborted. Keep one
    // flight until it settles, close its late stream, then consider reacquiring.
    if (this.pending) return this.pending.then(() => this.acquire());
    const generation = ++this.generation;
    this.state = 'starting';
    const flight: CaptureFlight = { generation }; this.flight = flight;
    const operation = this.open(flight);
    const pending = operation.finally(() => { if (this.pending === pending) this.pending = undefined; if (this.flight === flight) this.flight = undefined; });
    this.pending = pending;
    return pending;
  }

  private async open(flight: CaptureFlight) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: false }, video: false });
      flight.stream = stream;
      if (!this.current(flight)) { stream.getTracks().forEach(track => track.stop()); return; }
      const context = new AudioContext(); flight.context = context;
      await context.resume();
      if (!this.current(flight)) { stream.getTracks().forEach(track => track.stop()); void context.close().catch(() => {}); return; }
      const analyser = context.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0;
      const source = context.createMediaStreamSource(stream); source.connect(analyser);
      this.stream = stream; this.context = context; this.source = source; this.analyser = analyser;
      this.detector.reset(); this.state = 'listening';
      const wave = new Float32Array(analyser.fftSize), spectrum = new Float32Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!this.current(flight) || this.analyser !== analyser) return;
        analyser.getFloatTimeDomainData(wave); analyser.getFloatFrequencyData(spectrum);
        let square = 0, peak = 0, high = 0, total = 0;
        for (const value of wave) { square += value * value; peak = Math.max(peak, Math.abs(value)); }
        for (let bin = 0; bin < spectrum.length; bin++) {
          const hz = bin * context.sampleRate / analyser.fftSize;
          if (hz < 120 || hz > 12000 || !Number.isFinite(spectrum[bin])) continue;
          const power = 10 ** (spectrum[bin] / 10); total += power; if (hz >= 2000) high += power;
        }
        const rms = Math.min(1, Math.sqrt(square / wave.length));
        this.callbacks.onLevels?.({ rms, level: Math.min(1, rms * 8) });
        if (!this.current(flight)) return;
        const atMs = performance.now();
        if (atMs >= this.wakeNotBefore && this.detector.push({ atMs, rms, peak: Math.min(1, peak), highFrequencyRatio: total > 0 ? high / total : 0 })) {
          this.wakeNotBefore = atMs + 8000;
          this.suspend(); this.callbacks.onWake('clap');
        }
      };
      this.timer = setInterval(tick, 20);
    } catch (error) {
      flight.stream?.getTracks().forEach(track => track.stop()); void flight.context?.close().catch(() => {});
      if (!this.current(flight)) return;
      this.desired = 'suspended'; this.state = 'suspended'; this.release();
      const name = error instanceof DOMException ? error.name : '';
      this.callbacks.onError?.(name === 'NotAllowedError' ? 'O microfone não foi autorizado para a espera local.' : name === 'NotFoundError' ? 'Nenhum microfone disponível para a espera local.' : 'Não foi possível iniciar a espera local pelo microfone.');
    }
  }
  private current(flight: CaptureFlight) { return this.armed && this.desired === 'listening' && flight.generation === this.generation; }
  private release() {
    clearInterval(this.timer); this.timer = undefined;
    this.source?.disconnect(); this.source = undefined; this.analyser?.disconnect(); this.analyser = undefined;
    this.stream?.getTracks().forEach(track => track.stop()); this.stream = undefined;
    this.flight?.stream?.getTracks().forEach(track => track.stop());
    void this.context?.close().catch(() => {}); this.context = undefined;
    void this.flight?.context?.close().catch(() => {});
    this.detector.reset(); this.callbacks.onLevels?.({ rms: 0, level: 0 });
  }
}
