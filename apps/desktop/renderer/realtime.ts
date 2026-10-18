export type VoiceState = 'idle' | 'connecting' | 'listen' | 'think' | 'speak' | 'execute';
export type AudioLevels = { mic: number; speaker: number; wave: number[] };
type Callbacks = {
  state(state: VoiceState): void;
  connection(connected: boolean): void;
  transcript(role: 'user' | 'assistant', text: string, id: string, done: boolean): void;
  levels(levels: AudioLevels): void;
  error(message: string): void;
  ended(): void;
};

/** Keys and tool authority stay in the desktop process. The renderer sends only SDP. */
export class RealtimeVoice {
  private pc?: RTCPeerConnection;
  private dc?: RTCDataChannel;
  private stream?: MediaStream;
  private audio?: HTMLAudioElement;
  private context?: AudioContext;
  private inputAnalyser?: AnalyserNode;
  private outputAnalyser?: AnalyserNode;
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
  constructor(private bridge: JarvisBridge, private cb: Callbacks) {}

  async start(profileId: string, maxSessionMinutes: number) {
    this.profileId = profileId;
    this.cb.state('connecting');
    this.connectTimer = setTimeout(() => this.fail('A conexão de voz demorou demais. Verifique a rede e inicie novamente.'), 30000);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (this.stopped) { this.stream.getTracks().forEach(t => t.stop()); return; }
      this.context = new AudioContext();
      await this.context.resume();
      if (this.stopped) { await this.context.close(); return; }
      this.inputAnalyser = this.context.createAnalyser();
      this.inputAnalyser.fftSize = 256;
      this.context.createMediaStreamSource(this.stream).connect(this.inputAnalyser);
      this.audio = new Audio();
      this.audio.autoplay = true;
      this.pc = new RTCPeerConnection();
      this.stream.getTracks().forEach(t => this.pc!.addTrack(t, this.stream!));
      this.pc.ontrack = event => {
        if (this.stopped || !this.context || !this.audio) return;
        const stream = event.streams[0] || new MediaStream([event.track]);
        this.audio.srcObject = stream;
        this.audio.play().catch(() => this.cb.error('O áudio foi bloqueado. Encerre e inicie a voz novamente.'));
        this.outputAnalyser = this.context.createAnalyser();
        this.outputAnalyser.fftSize = 256;
        this.context.createMediaStreamSource(stream).connect(this.outputAnalyser);
      };
      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === 'connected') { if (this.reconnectTimer) clearTimeout(this.reconnectTimer); this.cb.connection(true); }
        if (state === 'failed') this.fail('A conexão de voz caiu. Você pode iniciar outra sessão.');
        if (state === 'disconnected') this.reconnectTimer = setTimeout(() => { if (this.pc?.connectionState === 'disconnected') this.fail('A sessão perdeu a conexão. Inicie a voz novamente.'); }, 10000);
      };
      this.dc = this.pc.createDataChannel('oai-events');
      this.dc.onopen = () => { clearTimeout(this.connectTimer); if (!this.stopped) { this.cb.connection(true); this.cb.state('listen'); } };
      this.dc.onmessage = event => {
        try { this.handle(JSON.parse(event.data)); } catch { this.cb.error('Recebemos um evento de voz inválido.'); }
      };
      this.dc.onerror = () => this.fail('Falha no canal de voz. Inicie a sessão novamente.');
      this.dc.onclose = () => { if (!this.stopped) this.fail('A sessão de voz foi encerrada.'); };
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      if (this.stopped) return;
      const answer = await this.bridge.realtimeSession({ sdp: offer.sdp!, profileId });
      if (this.stopped) return;
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
      this.timer = setTimeout(() => { this.cb.error('A sessão atingiu o limite de tempo configurado. Inicie outra quando quiser.'); this.stop(); }, Math.min(30, Math.max(1, maxSessionMinutes || 10)) * 60000);
      this.measure();
    } catch (error) {
      if (!this.stopped) this.fail(error instanceof Error ? error.message : 'Não foi possível iniciar o microfone.');
    }
  }

  private send(event: Record<string, unknown>) {
    if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(event));
  }

  private handle(event: any) {
    if (this.stopped) return;
    if (event.event_id) {
      if (this.seen.has(event.event_id)) return;
      if (this.seen.size > 3000) this.seen.clear();
      this.seen.add(event.event_id);
    }
    const type = event.type;
    const eventResponseId = event.response_id || event.response?.id;
    if (eventResponseId && this.interrupted.has(eventResponseId)) return;
    if (type === 'input_audio_buffer.speech_started') {
      if (this.responseActive || this.outputActive || this.pendingTools.size) this.interrupt();
      this.outputActive = false;
      if (this.audio) this.audio.muted = true;
      this.cb.state('listen');
    }
    if (type === 'input_audio_buffer.speech_stopped') this.cb.state('think');
    if (type === 'conversation.item.input_audio_transcription.completed' && event.transcript) this.cb.transcript('user', event.transcript, `voice-user-${event.item_id}`, true);
    if (type === 'response.created') { this.runId = `voice-${crypto.randomUUID()}`; this.responseId = event.response?.id || ''; this.responseActive = true; this.cb.state('think'); }
    if (type === 'output_audio_buffer.started') {
      this.outputActive = true;
      if (this.audio) { this.audio.muted = false; this.audio.play().catch(() => {}); }
      this.cb.state('speak');
    }
    if (type === 'output_audio_buffer.stopped' || type === 'output_audio_buffer.cleared') { this.outputActive = false; this.cb.state('listen'); }
    if (type === 'response.done') { this.responseActive = false; if (!this.outputActive) this.cb.state('listen'); }
    if (type === 'response.output_audio_transcript.delta' || type === 'response.output_text.delta') {
      const id = `voice-assistant-${event.item_id || event.response_id}`;
      const text = (this.transcripts.get(id) || '') + (event.delta || '');
      this.transcripts.set(id, text);
      this.cb.transcript('assistant', text, id, false);
    }
    if (type === 'response.output_audio_transcript.done' || type === 'response.output_text.done') {
      const id = `voice-assistant-${event.item_id || event.response_id}`;
      const text = event.transcript || event.text || this.transcripts.get(id) || '';
      if (text) this.cb.transcript('assistant', text, id, true);
      this.transcripts.delete(id);
    }
    if (type === 'response.function_call_arguments.done') void this.tool(event);
    if (type === 'response.output_item.done' && event.item?.type === 'function_call') void this.tool({ ...event.item, response_id: event.response_id });
    if (type === 'error' && !['response_cancel_not_active', 'output_audio_buffer_empty'].includes(event.error?.code)) this.cb.error(event.error?.message || 'Erro na sessão de voz.');
  }

  private async tool(item: any) {
    const id = item.call_id;
    const responseId = item.response_id || this.responseId;
    const runId = this.runId;
    if (!id || this.calls.has(id) || this.stopped || this.interrupted.has(responseId)) return;
    this.calls.add(id);
    this.pendingTools.set(id, { runId, responseId });
    this.cb.state('execute');
    let result: unknown;
    try {
      const args = typeof item.arguments === 'string' ? JSON.parse(item.arguments || '{}') : item.arguments || {};
      result = await this.bridge.callTool({ id, name: item.name, args, profileId: this.profileId, runId });
    } catch (error) { result = { error: error instanceof Error ? error.message : 'Não foi possível executar a ação.' }; }
    this.pendingTools.delete(id);
    if (this.stopped) return;
    this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: id, output: JSON.stringify(result ?? null) } });
    if (this.interrupted.has(responseId)) return;
    this.send({ type: 'response.create' });
    this.cb.state('think');
  }

  interrupt() {
    if (this.responseId) this.interrupted.add(this.responseId);
    for (const tool of this.pendingTools.values()) this.interrupted.add(tool.responseId);
    if (this.audio) { this.audio.muted = true; this.audio.pause(); }
    if (this.responseActive || this.outputActive) this.send({ type: 'response.cancel' });
    if (this.outputActive) this.send({ type: 'output_audio_buffer.clear' });
    this.outputActive = false;
    this.responseActive = false;
    this.cb.levels({ mic: 0, speaker: 0, wave: [] });
    this.cb.state('listen');
    const runs = new Set([this.runId, ...Array.from(this.pendingTools.values(), tool => tool.runId)]);
    this.runId = `voice-${crypto.randomUUID()}`;
    for (const runId of runs) void this.bridge.cancel(runId).catch(error => this.cb.error(String(error)));
  }

  private measure = () => {
    if (this.stopped) return;
    const envelope = (node?: AnalyserNode) => {
      if (!node) return { rms: 0, wave: [] as number[] };
      const samples = new Uint8Array(node.fftSize);
      node.getByteTimeDomainData(samples);
      let sum = 0;
      for (const n of samples) sum += ((n - 128) / 128) ** 2;
      return { rms: Math.min(1, Math.sqrt(sum / samples.length) * 5), wave: Array.from(samples).filter((_, i) => i % 6 === 0).slice(0, 41).map(n => Math.abs((n - 128) / 128)) };
    };
    const mic = envelope(this.inputAnalyser), output = envelope(this.outputAnalyser);
    this.cb.levels({ mic: output.rms > .02 ? 0 : mic.rms, speaker: this.outputActive && !this.audio?.muted ? output.rms : 0, wave: this.outputActive ? output.wave : mic.wave });
    this.raf = requestAnimationFrame(this.measure);
  };

  private fail(message: string) { this.cb.error(message); this.stop(); }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    clearTimeout(this.reconnectTimer);
    clearTimeout(this.connectTimer);
    cancelAnimationFrame(this.raf);
    this.dc?.close();
    this.pc?.close();
    this.stream?.getTracks().forEach(track => track.stop());
    if (this.audio) { this.audio.pause(); if (this.audio.srcObject instanceof MediaStream) this.audio.srcObject.getTracks().forEach(track => track.stop()); this.audio.srcObject = null; }
    void this.context?.close().catch(() => {});
    for (const runId of new Set([this.runId, ...Array.from(this.pendingTools.values(), tool => tool.runId)])) void this.bridge.cancel(runId).catch(() => {});
    this.cb.levels({ mic: 0, speaker: 0, wave: [] });
    this.cb.connection(false);
    this.cb.state('idle');
    this.cb.ended();
  }
}
