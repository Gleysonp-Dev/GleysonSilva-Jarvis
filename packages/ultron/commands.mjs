import { randomUUID } from 'node:crypto';
import { BridgeError, validateBridgeCall } from '../../plugins/jarvis-ultron/bridge.mjs';

const reasons = new Set(['busy', 'cancelled', 'speech_unavailable', 'playback_failed']);
export class UltronCommandError extends BridgeError { constructor(message, code = 'UNAVAILABLE') { super(code); this.message = message; } }
const fail = (message, code) => { throw new UltronCommandError(message, code); };
const active = signal => { if (signal?.aborted) fail('A solicitação do Ultron foi interrompida.', 'CANCELLED'); };

/** Authority shared by the opt-in local bridge and the trusted renderer receipt. */
export class UltronCommands {
  #options; #pending = new Map(); #active = new Set(); #version = 0;
  constructor(options) { this.#options = options; }
  run(method, args, { signal, id } = {}) {
    const controller = new AbortController(); this.#active.add(controller);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true }); if (signal?.aborted) abort();
    return this.#run(method, args, { signal: controller.signal, id }).finally(() => { signal?.removeEventListener('abort', abort); this.#active.delete(controller); });
  }
  async #run(method, args, { signal, id } = {}) {
    active(signal);
    const settings = this.#options.getSettings(), version = this.#version, profileId = settings.profileId;
    if (settings.ultronEnabled !== true) fail('Ative a conexão privada com Ultron em Ajustes.');
    try { args = validateBridgeCall(method, args); } catch { fail('Função do Ultron inválida.', 'INVALID'); }
    const assertCurrent = () => {
      active(signal);
      const current = this.#options.getSettings();
      if (version !== this.#version || current.profileId !== profileId || !current.ultronEnabled) fail('A conexão privada mudou. Solicite novamente.', 'CANCELLED');
    };
    if (method === 'status') return { connected: true, appVersion: this.#options.getVersion(), weatherConfigured: Boolean(settings.weatherLocation), voiceConfigured: Boolean(settings.hasElevenKey && settings.elevenVoiceId), tools: ['status', 'weather', 'open_browser', 'open_url', 'speak'] };
    if (method === 'weather') {
      const result = await this.#options.readWeather({ signal, refresh: true }); assertCurrent();
      return { status: result.status, location: result.locationLabel, timezone: result.timezone, weather: result.weather, fetchedAt: result.fetchedAt, attribution: result.attribution };
    }
    if (method === 'open_browser') {
      const result = await this.#options.openBrowser({ signal }); assertCurrent();
      return { ok: result.ok === true, status: result.status, summary: result.summary };
    }
    if (method === 'open_url') {
      const result = await this.#options.openWebsite(args.url, { signal }); assertCurrent();
      return { ok: result.ok === true, status: result.status, summary: result.summary };
    }
    if (typeof args.text !== 'string' || !args.text.trim() || args.text.length > 600 || /\0/.test(args.text)) fail('A fala deve conter de 1 a 600 caracteres.');
    if (!settings.hasElevenKey || !settings.elevenVoiceId) fail('Configure a voz e a chave ElevenLabs no Jarvis.');
    if (!this.#options.isWindowAvailable()) fail('Abra a janela do Jarvis para reproduzir a voz.');
    if (this.#pending.size) fail('O Jarvis já está preparando uma fala do Ultron. Aguarde.', 'BUSY');
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (result, error) => {
        if (!this.#pending.delete(requestId)) return;
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
        if (error) { try { this.#options.emit({ type: 'ultron.cancel', requestId, profileId }); } catch {} reject(error); }
        else { try { assertCurrent(); resolve(result); } catch (failure) { reject(failure); } }
      };
      const abort = () => finish(null, new UltronCommandError('A fala do Ultron foi interrompida.', 'CANCELLED'));
      this.#pending.set(requestId, { profileId, finish, abort });
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => finish(null, new UltronCommandError('O Jarvis não confirmou a reprodução no prazo.', 'TIMEOUT')), 115000);
      if (signal?.aborted) { abort(); return; }
      try { this.#options.emit({ type: 'ultron.speak', requestId, profileId, text: args.text }); }
      catch { finish(null, new UltronCommandError('A janela do Jarvis não recebeu a solicitação de fala.')); }
    });
  }
  finish(input) {
    if (!input || Object.getPrototypeOf(input) !== Object.prototype || Object.keys(input).some(key => !['requestId', 'played', 'reason'].includes(key)) || typeof input.requestId !== 'string' || typeof input.played !== 'boolean' || (input.reason !== undefined && !reasons.has(input.reason))) fail('Confirmação de reprodução inválida.');
    const entry = this.#pending.get(input.requestId);
    if (!entry || entry.profileId !== this.#options.getSettings().profileId) return false;
    if (input.played) entry.finish({ ok: true, played: true, evidence: 'renderer_audio_ended' });
    else entry.finish(null, new UltronCommandError(input.reason === 'busy' ? 'O Jarvis está em outra conversa ou recepção. Encerre-a antes de usar a voz do Ultron.' : 'A fala não foi reproduzida até o fim.', input.reason === 'busy' ? 'BUSY' : input.reason === 'cancelled' ? 'CANCELLED' : 'FAILED'));
    return true;
  }
  reset() { this.#version++; for (const controller of this.#active) controller.abort(); for (const entry of [...this.#pending.values()]) entry.abort(); }
}
