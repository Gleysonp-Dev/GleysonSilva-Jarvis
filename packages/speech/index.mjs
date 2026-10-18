import { ElevenLabsService, validateVoiceId } from '../elevenlabs/index.mjs';
import { GREETING_VOICE_MODEL, GREETING_VOICE_SETTINGS } from '../greeting/index.mjs';

export const SPEECH_LIMITS = Object.freeze({ textCharacters: 600, audioBytes: 2 * 1024 * 1024, timeoutMs: 20_000 });
const MESSAGES = Object.freeze({
  invalid_input: 'O trecho de fala é inválido ou excede 600 caracteres.',
  profile_changed: 'O perfil mudou. Inicie outra conversa.',
  requires_key: 'Configure a chave ElevenLabs nas configurações para ouvir a voz Jarvis.',
  requires_voice: 'Configure a voz Jarvis aprovada nas configurações.',
  cancelled: 'Fala interrompida.',
  timeout: 'A preparação da voz demorou demais e foi interrompida.',
  unavailable: 'Não foi possível preparar a voz Jarvis. A resposta continua disponível em texto.',
});
export class SpeechServiceError extends Error {
  constructor(code) { super(MESSAGES[code] ?? MESSAGES.unavailable); this.name = 'SpeechServiceError'; this.code = Object.hasOwn(MESSAGES, code) ? code : 'unavailable'; }
  toJSON() { return { code: this.code, message: this.message }; }
}
const fail = code => new SpeechServiceError(code);
const active = signal => { if (signal?.aborted) throw fail('cancelled'); };
function identifier(value, limit) { if (typeof value !== 'string' || !new RegExp(`^[a-zA-Z0-9_-]{1,${limit}}$`).test(value)) throw fail('invalid_input'); return value; }
function scopeFor(signal, timeoutMs) {
  const controller = new AbortController(); let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  return { signal: controller.signal, timedOut: () => timedOut, dispose() { clearTimeout(timer); signal?.removeEventListener('abort', abort); } };
}
async function abortable(promise, signal) {
  active(signal); let abort;
  try { return await Promise.race([promise, new Promise((_, reject) => { abort = () => reject(fail('cancelled')); signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort(); })]); }
  finally { signal.removeEventListener('abort', abort); }
}

/** Trusted-process TTS for one bounded sentence. Run quotas/cancellation registries live in main. */
export class SpeechService {
  #getKey; #getSettings; #fetch; #elevenlabs; #timeoutMs;
  constructor({ getKey = () => '', getSettings = () => ({}), fetch: fetchImpl = globalThis.fetch, elevenlabs, timeoutMs = SPEECH_LIMITS.timeoutMs } = {}) {
    if (typeof getKey !== 'function' || typeof getSettings !== 'function' || typeof fetchImpl !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000) throw new TypeError('SpeechService requires valid key, settings, fetch and timeout options.');
    this.#getKey = getKey; this.#getSettings = getSettings; this.#fetch = fetchImpl; this.#elevenlabs = elevenlabs; this.#timeoutMs = timeoutMs;
  }
  async prepare(input, { signal } = {}) {
    const scope = scopeFor(signal, this.#timeoutMs);
    try {
      active(scope.signal);
      if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['text', 'profileId', 'runId', 'utteranceId'].includes(key))) throw fail('invalid_input');
      const { text } = input;
      const profileId = identifier(input.profileId, 80), runId = identifier(input.runId, 120), utteranceId = identifier(input.utteranceId, 120);
      if (typeof text !== 'string' || !text.trim() || text.length > SPEECH_LIMITS.textCharacters || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw fail('invalid_input');
      const settings = this.#getSettings() ?? {};
      if (settings.profileId !== undefined && settings.profileId !== profileId) throw fail('profile_changed');
      let voiceId;
      try { voiceId = validateVoiceId(settings.elevenVoiceId); } catch { throw fail('requires_voice'); }
      let key;
      try { key = await abortable(Promise.resolve(this.#getKey()), scope.signal); }
      catch { active(scope.signal); throw fail('requires_key'); }
      if (typeof key !== 'string' || !key.trim() || key.length > 512 || /[\r\n\0]/.test(key)) throw fail('requires_key');
      const client = this.#elevenlabs ?? new ElevenLabsService({ getKey: () => key, fetch: this.#fetch, timeoutMs: this.#timeoutMs, maxAudioBytes: SPEECH_LIMITS.audioBytes });
      const speech = await abortable(client.synthesizeSpeech({ voiceId, text: text.trim(), modelId: GREETING_VOICE_MODEL,
        voiceSettings: { ...GREETING_VOICE_SETTINGS }, outputFormat: 'mp3_44100_128', languageCode: 'pt' }, { signal: scope.signal }), scope.signal);
      active(scope.signal);
      const latestSettings = this.#getSettings() ?? {};
      if (latestSettings.profileId !== undefined && latestSettings.profileId !== profileId) throw fail('profile_changed');
      if (!(speech?.audio instanceof Uint8Array) || !speech.audio.byteLength || speech.audio.byteLength > SPEECH_LIMITS.audioBytes || speech.contentType !== 'audio/mpeg') throw fail('unavailable');
      return { audioBase64: Buffer.from(speech.audio).toString('base64'), mime: 'audio/mpeg', runId, utteranceId };
    } catch (error) {
      if (scope.signal.aborted) throw fail(scope.timedOut() ? 'timeout' : 'cancelled');
      throw error instanceof SpeechServiceError ? error : fail('unavailable');
    } finally { scope.dispose(); }
  }
}
