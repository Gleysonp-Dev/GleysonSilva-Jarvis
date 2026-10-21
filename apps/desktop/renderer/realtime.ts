import { createSpeechEffects, type SpeechEffectsController } from './speech-effects';

export type VoiceState = 'idle' | 'connecting' | 'listen' | 'think' | 'speak' | 'execute';
export type AudioLevels = { mic: number; speaker: number; wave: number[] };
type Callbacks = {
  state(state: VoiceState): void;
  connection(connected: boolean): void;
  transcript(role: 'user' | 'assistant', text: string, id: string, done: boolean): void;
  levels(levels: AudioLevels): void;
  error(message: string): void;
  ended(reason?: 'stopped' | 'expired' | 'error'): void;
};
type SpeechAudio = { audioBase64: string; mime: string; runId: string; utteranceId: string };
type SpeechJob = { text: string; runId: string; responseId: string; utteranceId: string; generation: number; controller: AbortController; preparation?: Promise<SpeechAudio | null> };
type ResponseState = { id: string; runId: string; pending: string; textLength: number; segments: number; completed: boolean; disabled: boolean; continued: boolean; tools: Map<string, any> };
type Playback = { audio: HTMLAudioElement; source: MediaElementAudioSourceNode; effects?: SpeechEffectsController; url: string; job: SpeechJob; finish(error?: boolean): void };

/** Only complete delta-derived sentences are streamed; .done events never supply speech. */
export function takeSpeechSegments(value: string, flush = false): { segments: string[]; rest: string } {
  const segments: string[] = [];
  let rest = value;
  while (rest.trim()) {
    let cut = 0;
    const boundary = /[.!?…](?:["'’”\])]+)?\s+/g;
    const match = boundary.exec(rest);
    if (match && match.index + match[0].length <= 600) cut = match.index + match[0].length;
    else if (rest.length > 600) {
      cut = rest.lastIndexOf(' ', 600);
      if (cut < 300) cut = 600;
      if (/[\uD800-\uDBFF]/.test(rest[cut - 1])) cut--;
    } else if (flush) cut = rest.length;
    else break;
    const segment = rest.slice(0, cut).trim(); rest = rest.slice(cut);
    // Structured tool output/code remains visible in text but is never read as speech.
    if (segment && !/^(?:```|\{|\[)/.test(segment)) segments.push(segment);
  }
  return { segments, rest };
}

/** OpenAI receives the microphone and emits text/tools. All audible replies use Jarvis TTS. */
export class RealtimeVoice {
  private pc?: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private stream?: MediaStream;
  private context?: AudioContext;
  private inputAnalyser?: AnalyserNode;
  private outputAnalyser?: AnalyserNode;
  private playback?: Playback;
  private raf = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private connectTimer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private outputActive = false;
  private responseActive = false;
  private profileId = '';
  private runId = `voice-${crypto.randomUUID()}`;
  private responseId = '';
  private interrupted = new Set<string>();
  private seen = new Set<string>();
  private calls = new Set<string>();
  private pendingTools = new Map<string, { runId: string; responseId: string }>();
  private transcripts = new Map<string, string>();
  private responses = new Map<string, ResponseState>();
  private speechQueue: SpeechJob[] = [];
  private speechJobs = new Set<SpeechJob>();
  private pendingSpeech?: SpeechJob;
  private speechGeneration = 0;
  private draining = false;
  constructor(private bridge: JarvisBridge, private cb: Callbacks) {}

  async start(profileId: string, maxSessionMinutes: number) {
    this.profileId = profileId;
    this.cb.state('connecting');
    this.connectTimer = setTimeout(() => this.fail('A conexão de voz demorou demais. Verifique a rede e inicie novamente.'), 30000);
    try {
      if (typeof this.bridge.speak !== 'function' || typeof this.bridge.cancelSpeech !== 'function') throw new Error('A voz Jarvis exige uma versão atualizada do aplicativo e a configuração ElevenLabs.');
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (this.stopped) { this.stream.getTracks().forEach(t => t.stop()); return; }
      this.context = new AudioContext(); await this.context.resume();
      if (this.stopped) { await this.context.close(); return; }
      this.inputAnalyser = this.context.createAnalyser(); this.inputAnalyser.fftSize = 256;
      this.context.createMediaStreamSource(this.stream).connect(this.inputAnalyser);
      this.outputAnalyser = this.context.createAnalyser(); this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.connect(this.context.destination);
      this.pc = new RTCPeerConnection();
      this.stream.getTracks().forEach(t => this.pc!.addTrack(t, this.stream!));
      // Defence in depth: never attach an unexpected OpenAI track to a playback device.
      this.pc.ontrack = event => { event.track.enabled = false; event.track.stop(); };
      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'connected') { clearTimeout(this.reconnectTimer); this.cb.connection(true); }
        if (state === 'failed') this.fail('A conexão de voz caiu. Você pode iniciar outra sessão.');
        if (state === 'disconnected') this.reconnectTimer = setTimeout(() => { if (this.pc?.connectionState === 'disconnected') this.fail('A sessão perdeu a conexão. Inicie a voz novamente.'); }, 10000);
      };
      this.dc = this.pc.createDataChannel('oai-events');
      this.dc.onopen = () => { clearTimeout(this.connectTimer); if (!this.stopped) { this.cb.connection(true); this.cb.state('listen'); } };
      this.dc.onmessage = event => {
        try {
          if (typeof event.data !== 'string' || event.data.length > 131_072) throw new Error('event_limit');
          this.handle(JSON.parse(event.data));
        } catch { this.cb.error('Recebemos um evento de voz inválido.'); }
      };
      this.dc.onerror = () => this.fail('Falha no canal de voz. Inicie a sessão novamente.');
      this.dc.onclose = () => { if (!this.stopped) this.fail('A sessão de voz foi encerrada.'); };
      const offer = await this.pc.createOffer(); await this.pc.setLocalDescription(offer);
      if (this.stopped) return;
      const answer = await this.bridge.realtimeSession({ sdp: offer.sdp!, profileId });
      if (this.stopped) return;
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      this.timer = setTimeout(() => this.stop('expired'), Math.min(30, Math.max(1, maxSessionMinutes || 10)) * 60000);
      this.measure();
    } catch (error) { if (!this.stopped) this.fail(error instanceof Error ? error.message : 'Não foi possível iniciar o microfone.'); }
  }

  private send(event: Record<string, unknown>) { if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(event)); }
  private idleState() {
    if (this.stopped) return;
    this.cb.state(this.outputActive ? 'speak' : this.pendingTools.size ? 'execute' : this.responseActive || this.speechJobs.size ? 'think' : 'listen');
  }

  private handle(event: any) {
    if (this.stopped || !event || typeof event !== 'object') return;
    if (event.event_id) {
      if (this.seen.has(event.event_id)) return;
      if (this.seen.size > 3000) this.seen.clear(); this.seen.add(event.event_id);
    }
    const type = event.type, eventResponseId = event.response_id || event.response?.id;
    if (eventResponseId && this.interrupted.has(eventResponseId)) return;
    if (type === 'input_audio_buffer.speech_started') {
      if (this.responseActive || this.speechJobs.size || this.pendingTools.size) this.interrupt();
      this.cb.state('listen');
    }
    if (type === 'input_audio_buffer.speech_stopped') this.cb.state('think');
    if (type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') this.cb.transcript('user', event.transcript.slice(0, 12000), `voice-user-${event.item_id}`, true);
    if (type === 'response.created') {
      const id = event.response?.id;
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return;
      if (this.responses.has(id)) return;
      if (this.responses.size >= 256) { this.fail('A sessão atingiu seu limite de respostas. Inicie outra conversa.'); return; }
      this.runId = `voice-${crypto.randomUUID()}`; this.responseId = id; this.responseActive = true;
      this.responses.set(id, { id, runId: this.runId, pending: '', textLength: 0, segments: 0, completed: false, disabled: false, continued: false, tools: new Map() });
      this.idleState();
    }
    const response = this.responses.get(eventResponseId);
    if (type === 'response.output_text.delta' && response && !response.completed && typeof event.delta === 'string' && event.delta.length > 0) {
      const id = `voice-assistant-${event.item_id || eventResponseId}`;
      const text = (this.transcripts.get(id) || '') + event.delta;
      if (text.length > 12000 || response.textLength + event.delta.length > 6000) { this.disableSpeech(response, 'A resposta atingiu o limite de narração. Faça uma pergunta mais curta.'); return; }
      this.transcripts.set(id, text); this.cb.transcript('assistant', text, id, false);
      response.textLength += event.delta.length;
      if (response.textLength === text.length && /^(?:```|\{|\[)/.test(text.trimStart())) response.disabled = true;
      if (!response.disabled) { response.pending += event.delta; this.flushSpeech(response, false); }
    }
    // The API also emits output_text.done for cancelled/incomplete responses. Never enqueue it.
    if (type === 'response.output_text.done' && response) {
      const id = `voice-assistant-${event.item_id || eventResponseId}`;
      const text = typeof event.text === 'string' ? event.text.slice(0, 12000) : this.transcripts.get(id) || '';
      if (text) this.cb.transcript('assistant', text, id, true); this.transcripts.delete(id);
    }
    if ((type === 'response.function_call_arguments.done' || (type === 'response.output_item.done' && event.item?.type === 'function_call')) && response && !response.completed) {
      const item = type === 'response.output_item.done' ? event.item : event;
      if (typeof item.call_id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(item.call_id) || typeof item.name !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.name) || typeof item.arguments !== 'string' || item.arguments.length > 32768) return;
      if (!response.tools.has(item.call_id) && response.tools.size >= 12) { this.fail('A resposta atingiu o limite de ações. Consulte o histórico antes de continuar.'); return; }
      response.tools.set(item.call_id, { call_id: item.call_id, name: item.name, arguments: item.arguments, response_id: response.id });
    }
    if (type === 'response.done' && response && !response.completed) {
      response.completed = true;
      if (this.responseId === response.id) this.responseActive = false;
      if (event.response?.status === 'completed') {
        if (!response.disabled) this.flushSpeech(response, true);
        for (const item of response.tools.values()) void this.tool(item, response);
      } else {
        this.interrupted.add(response.id); response.pending = '';
        this.discardSpeech(new Set([response.runId]));
      }
      this.idleState();
    }
    // All output_audio* events and remote transcripts are deliberately ignored.
    if (type === 'error' && !['response_cancel_not_active', 'output_audio_buffer_empty'].includes(event.error?.code)) this.fail('A sessão de voz encontrou um erro. Consulte as configurações ou inicie outra sessão.');
  }

  private flushSpeech(response: ResponseState, flush: boolean) {
    const result = takeSpeechSegments(response.pending, flush); response.pending = result.rest;
    for (const text of result.segments) {
      if (response.segments >= 24 || this.speechQueue.length >= 24) { this.disableSpeech(response, 'O limite de narração foi atingido. Faça uma pergunta mais curta.'); return; }
      const job: SpeechJob = { text, runId: response.runId, responseId: response.id, utteranceId: `utterance-${crypto.randomUUID()}`, generation: this.speechGeneration, controller: new AbortController() };
      response.segments++; this.speechJobs.add(job); this.speechQueue.push(job);
    }
    this.prefetch(); void this.pumpSpeech();
  }
  private prepareSpeech(job: SpeechJob): Promise<SpeechAudio | null> {
    if (job.preparation) return job.preparation;
    this.pendingSpeech = job;
    job.preparation = (async () => {
      let cancel: (() => void) | undefined;
      try {
        const cancelled = new Promise<null>(resolve => { cancel = () => resolve(null); job.controller.signal.addEventListener('abort', cancel, { once: true }); if (job.controller.signal.aborted) cancel(); });
        if (job.controller.signal.aborted) return null;
        const result = await Promise.race([this.bridge.speak({ text: job.text, profileId: this.profileId, runId: job.runId, utteranceId: job.utteranceId }), cancelled]);
        return this.stopped || job.controller.signal.aborted || job.generation !== this.speechGeneration ? null : result;
      } catch {
        if (!this.stopped && !job.controller.signal.aborted) {
          const response = this.responses.get(job.responseId);
          if (response) this.disableSpeech(response, 'Não foi possível preparar a voz Jarvis. Confira a conexão e a configuração ElevenLabs.');
        }
        return null;
      } finally {
        if (cancel) job.controller.signal.removeEventListener('abort', cancel);
        if (this.pendingSpeech === job) this.pendingSpeech = undefined;
      }
    })();
    return job.preparation;
  }
  private prefetch() {
    // At most one synthesis request, alongside at most one local audio playback.
    if (this.playback && !this.pendingSpeech && this.speechQueue[0] && !this.speechQueue[0].preparation) void this.prepareSpeech(this.speechQueue[0]);
  }
  private async pumpSpeech() {
    if (this.draining || this.stopped) return;
    this.draining = true;
    try {
      while (!this.stopped && this.speechQueue.length) {
        const job = this.speechQueue.shift()!;
        if (job.controller.signal.aborted || job.generation !== this.speechGeneration) { this.speechJobs.delete(job); continue; }
        const audio = await this.prepareSpeech(job);
        if (audio && !this.stopped && !job.controller.signal.aborted && job.generation === this.speechGeneration) {
          try { const playing = this.playSpeech(audio, job); this.prefetch(); await playing; }
          catch { const response = this.responses.get(job.responseId); if (response) this.disableSpeech(response, 'Não foi possível reproduzir a voz Jarvis. Confira a saída de áudio ou inicie outra sessão.'); }
        }
        this.speechJobs.delete(job); this.idleState();
      }
    } finally { this.draining = false; this.idleState(); }
  }
  private async playSpeech(result: SpeechAudio, job: SpeechJob): Promise<void> {
    if (!this.context || !this.outputAnalyser || result.mime !== 'audio/mpeg' || result.runId !== job.runId || result.utteranceId !== job.utteranceId || typeof result.audioBase64 !== 'string' || result.audioBase64.length > 2_796_204 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(result.audioBase64)) throw new Error('invalid_speech');
    const raw = atob(result.audioBase64);
    if (!raw.length || raw.length > 2 * 1024 * 1024) throw new Error('audio_limit');
    const bytes = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
    let audio: HTMLAudioElement;
    try { audio = new Audio(url); audio.preload = 'auto'; audio.defaultPlaybackRate = 0.95; audio.playbackRate = 0.95; audio.preservesPitch = true; }
    catch (error) { URL.revokeObjectURL(url); throw error; }
    let source: MediaElementAudioSourceNode | undefined, effects: SpeechEffectsController | undefined;
    try {
      source = this.context.createMediaElementSource(audio);
      // No synthesized substitute or clean-voice fallback: this is the approved local preset.
      effects = createSpeechEffects({ context: this.context, input: source, output: this.outputAnalyser });
      await new Promise<void>((resolve, reject) => {
        let finished = false;
        const session: Playback = { audio, source: source!, effects, url, job, finish: (error = false) => {
          if (finished) return; finished = true;
          audio.onended = null; audio.onerror = null; audio.pause(); audio.removeAttribute('src'); audio.load();
          try { effects?.dispose(); source?.disconnect(); } catch { /* The context may already be closed. */ }
          URL.revokeObjectURL(url);
          if (this.playback === session) { this.playback = undefined; this.outputActive = false; }
          if (error) reject(new Error('audio_playback_failed')); else resolve();
        } };
        this.playback = session;
        audio.onended = () => session.finish(); audio.onerror = () => session.finish(true);
        void this.context!.resume().then(() => {
          if (this.stopped || job.controller.signal.aborted || this.playback !== session) { session.finish(); return; }
          return audio.play().then(() => { if (this.playback === session) { this.outputActive = true; this.cb.state('speak'); } });
        }).catch(() => session.finish(true));
      });
    } catch (error) { effects?.dispose(); source?.disconnect(); URL.revokeObjectURL(url); throw error; }
  }
  private disableSpeech(response: ResponseState, message: string) {
    if (response.disabled) return;
    response.disabled = true; response.pending = ''; this.discardSpeech(new Set([response.runId])); this.cb.error(message);
  }
  private discardSpeech(runs: Set<string>) {
    for (const job of this.speechJobs) if (runs.has(job.runId)) { job.controller.abort(); this.speechJobs.delete(job); }
    this.speechQueue = this.speechQueue.filter(job => !runs.has(job.runId));
    if (this.playback && runs.has(this.playback.job.runId)) this.playback.finish();
    if (typeof this.bridge.cancelSpeech === 'function') for (const runId of runs) void this.bridge.cancelSpeech({ runId }).catch(() => {});
  }

  private async tool(item: any, response: ResponseState) {
    const id = item.call_id, responseId = response.id, runId = response.runId;
    if (this.calls.has(id) || this.stopped || this.interrupted.has(responseId)) return;
    if (this.calls.size >= 256) { this.fail('A sessão atingiu o limite de ações. Inicie outra conversa.'); return; }
    this.calls.add(id); this.pendingTools.set(id, { runId, responseId }); this.idleState();
    let result: unknown;
    try {
      const args = JSON.parse(item.arguments || '{}');
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('invalid_tool_arguments');
      result = await this.bridge.callTool({ id, name: item.name, args, profileId: this.profileId, runId });
    } catch { result = { ok: false, status: 'failed', summary: 'Não foi possível executar a ação.' }; }
    this.pendingTools.delete(id);
    if (this.stopped) return;
    let output;
    try { output = JSON.stringify(result ?? null); if (output.length > 65536) throw new Error('tool_output_limit'); }
    catch { output = JSON.stringify({ ok: false, status: 'failed', summary: 'O resultado excedeu o limite de leitura.' }); }
    this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: id, output } });
    if (this.interrupted.has(responseId)) return;
    const pending = [...this.pendingTools.values()].some(tool => tool.responseId === responseId);
    const allStarted = [...response.tools.keys()].every(callId => this.calls.has(callId));
    if (!pending && allStarted && !response.continued) { response.continued = true; this.send({ type: 'response.create', response: { output_modalities: ['text'] } }); this.cb.state('think'); }
  }

  interrupt() {
    if (this.stopped) return;
    if (this.responseId) this.interrupted.add(this.responseId);
    for (const tool of this.pendingTools.values()) this.interrupted.add(tool.responseId);
    for (const job of this.speechJobs) this.interrupted.add(job.responseId);
    const runs = new Set([this.runId, ...[...this.pendingTools.values()].map(tool => tool.runId), ...[...this.speechJobs].map(job => job.runId)]);
    for (const id of this.interrupted) { const response = this.responses.get(id); if (response) response.pending = ''; }
    this.speechGeneration++; this.discardSpeech(runs);
    if (this.responseActive) this.send({ type: 'response.cancel', ...(this.responseId ? { response_id: this.responseId } : {}) });
    this.outputActive = false; this.responseActive = false;
    this.cb.levels({ mic: 0, speaker: 0, wave: [] }); this.cb.state('listen');
    this.runId = `voice-${crypto.randomUUID()}`;
    for (const runId of runs) void this.bridge.cancel(runId).catch(() => {});
  }

  private measure = () => {
    if (this.stopped) return;
    const envelope = (node?: AnalyserNode) => {
      if (!node) return { rms: 0, wave: [] as number[] };
      const samples = new Uint8Array(node.fftSize); node.getByteTimeDomainData(samples); let sum = 0;
      for (const n of samples) sum += ((n - 128) / 128) ** 2;
      return { rms: Math.min(1, Math.sqrt(sum / samples.length) * 5), wave: Array.from(samples).filter((_, i) => i % 6 === 0).slice(0, 41).map(n => Math.abs((n - 128) / 128)) };
    };
    const mic = envelope(this.inputAnalyser), output = envelope(this.outputAnalyser);
    this.cb.levels({ mic: output.rms > .02 && this.outputActive ? 0 : mic.rms, speaker: this.outputActive ? output.rms : 0, wave: this.outputActive ? output.wave : mic.wave });
    this.raf = requestAnimationFrame(this.measure);
  };
  private fail(message: string) { this.cb.error(message); this.stop('error'); }
  stop(reason: 'stopped' | 'expired' | 'error' = 'stopped') {
    if (this.stopped) return;
    this.interrupt(); this.stopped = true;
    clearTimeout(this.timer); clearTimeout(this.reconnectTimer); clearTimeout(this.connectTimer); cancelAnimationFrame(this.raf);
    this.dc?.close(); this.pc?.close(); this.stream?.getTracks().forEach(track => track.stop());
    this.inputAnalyser?.disconnect(); this.outputAnalyser?.disconnect(); void this.context?.close().catch(() => {});
    this.speechQueue = []; this.responses.clear(); this.transcripts.clear(); this.pendingTools.clear();
    this.cb.levels({ mic: 0, speaker: 0, wave: [] }); this.cb.connection(false); this.cb.state('idle'); this.cb.ended(reason);
  }
}
