import path from 'node:path';
import { lstat, open } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const API = 'https://api.elevenlabs.io/v1';
export const ELEVENLABS_DEFAULT_MODEL = 'eleven_flash_v2_5';
export const ELEVENLABS_LIMITS = Object.freeze({ sampleBytes: 10 * 1024 * 1024, sampleSeconds: 180, textCharacters: 4000, audioBytes: 16 * 1024 * 1024 });
export const AUDIO_FORMATS = Object.freeze({
  mp3_44100_128: Object.freeze({ contentType: 'audio/mpeg', extension: '.mp3' }),
  mp3_44100_64: Object.freeze({ contentType: 'audio/mpeg', extension: '.mp3' }),
  pcm_24000: Object.freeze({ contentType: 'audio/pcm', extension: '.pcm', sampleRate: 24000, channels: 1, bitsPerSample: 16 }),
});
const MESSAGES = Object.freeze({
  consent_required: 'A clonagem exige confirmação explícita dos direitos e do consentimento: use --consent.',
  invalid_input: 'Confira nome, texto, identificador de voz e formato de áudio.',
  invalid_sample: 'Selecione o caminho absoluto exato de um WAV PCM ou float válido de 1 a 180 segundos e até 10 MiB.',
  sample_unavailable: 'Não foi possível ler a amostra escolhida. Confira o arquivo WAV e suas permissões.',
  missing_key: 'Configure ELEVENLABS_API_KEY no ambiente do processo. A chave nunca é recebida por argumento de linha de comando.',
  authentication: 'A ElevenLabs recusou a credencial. Confira a chave da conta.',
  permission: 'O recurso exige acesso ou verificação na conta ElevenLabs. Confira seu plano e a voz.',
  not_found: 'A voz solicitada não está disponível nessa conta ElevenLabs.',
  rate_limit: 'A conta ElevenLabs atingiu um limite. Confira os créditos e limites antes de tentar novamente.',
  request_rejected: 'A ElevenLabs recusou os parâmetros. Confira o modelo, a voz e o formato da amostra.',
  unavailable: 'A ElevenLabs está indisponível no momento. Não repetimos automaticamente a solicitação.',
  connection: 'Não foi possível concluir a conexão com a ElevenLabs. Confira o estado da voz na conta antes de repetir uma clonagem.',
  timeout: 'A solicitação ElevenLabs excedeu o prazo e foi interrompida. Confira o resultado na conta antes de repetir.',
  cancelled: 'Solicitação ElevenLabs interrompida. Um processamento já aceito pelo provedor pode continuar na conta.',
  invalid_response: 'A ElevenLabs retornou um resultado inesperado. Não salve nem publique esse resultado.',
  audio_limit: 'O áudio gerado excedeu o limite local permitido. A transmissão foi interrompida.',
});

export class ElevenLabsError extends Error {
  constructor(code) {
    super(MESSAGES[code] ?? MESSAGES.connection);
    this.name = 'ElevenLabsError';
    this.code = Object.hasOwn(MESSAGES, code) ? code : 'connection';
  }
  toJSON() { return { code: this.code, message: this.message }; }
}
const fail = code => new ElevenLabsError(code);
const active = signal => { if (signal?.aborted) throw fail('cancelled'); };
function scopeFor(signal, timeoutMs) {
  const controller = new AbortController();
  let timeout = false;
  const relay = () => controller.abort();
  if (signal?.aborted) relay(); else signal?.addEventListener('abort', relay, { once: true });
  const timer = setTimeout(() => { timeout = true; controller.abort(); }, timeoutMs);
  return { signal: controller.signal, timedOut: () => timeout, dispose: () => { clearTimeout(timer); signal?.removeEventListener('abort', relay); } };
}
async function withAbort(promise, signal) {
  active(signal);
  let onAbort;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      onAbort = () => reject(fail('cancelled'));
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) onAbort();
    })]);
  } finally { signal?.removeEventListener('abort', onAbort); }
}
function safeError(error, scope) {
  if (scope.signal.aborted) return fail(scope.timedOut() ? 'timeout' : 'cancelled');
  return error instanceof ElevenLabsError ? error : fail('connection');
}
function checkedString(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw fail('invalid_input');
  return value.trim();
}
export function validateVoiceId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw fail('invalid_input');
  return value;
}

/** Validate a selected WAV in memory. No transcoding or sample copying occurs. */
export function inspectWav(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 44 || bytes.byteLength > ELEVENLABS_LIMITS.sampleBytes) throw fail('invalid_sample');
  const data = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw fail('invalid_sample');
  const declaredEnd = data.readUInt32LE(4) + 8;
  if (declaredEnd !== data.length) throw fail('invalid_sample');
  let format, sampleBytes = 0;
  for (let cursor = 12; cursor + 8 <= declaredEnd;) {
    const name = data.toString('ascii', cursor, cursor + 4);
    const size = data.readUInt32LE(cursor + 4);
    const offset = cursor + 8;
    if (offset + size > declaredEnd) throw fail('invalid_sample');
    if (name === 'fmt ') {
      if (size < 16 || format) throw fail('invalid_sample');
      format = { encoding: data.readUInt16LE(offset), channels: data.readUInt16LE(offset + 2), sampleRate: data.readUInt32LE(offset + 4),
        byteRate: data.readUInt32LE(offset + 8), blockAlign: data.readUInt16LE(offset + 12), bitsPerSample: data.readUInt16LE(offset + 14) };
    }
    if (name === 'data') sampleBytes += size;
    cursor = offset + size + (size % 2);
  }
  if (!format || ![1, 3].includes(format.encoding) || ![1, 2].includes(format.channels)
    || format.sampleRate < 8000 || format.sampleRate > 192000 || ![8, 16, 24, 32].includes(format.bitsPerSample)
    || (format.encoding === 3 && format.bitsPerSample !== 32)
    || format.blockAlign !== format.channels * format.bitsPerSample / 8
    || format.byteRate !== format.sampleRate * format.blockAlign || !sampleBytes || sampleBytes % format.blockAlign !== 0) throw fail('invalid_sample');
  const durationSeconds = sampleBytes / format.byteRate;
  if (durationSeconds < 1 || durationSeconds > ELEVENLABS_LIMITS.sampleSeconds) throw fail('invalid_sample');
  return { durationSeconds, sampleRate: format.sampleRate, channels: format.channels, bitsPerSample: format.bitsPerSample,
    encoding: format.encoding === 1 ? 'pcm' : 'float', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
}

async function selectedSample(samplePath, signal) {
  if (typeof samplePath !== 'string' || !path.isAbsolute(samplePath) || path.extname(samplePath).toLowerCase() !== '.wav' || samplePath.includes('\0')) throw fail('invalid_sample');
  active(signal);
  let handle;
  try {
    const entry = await withAbort(lstat(samplePath), signal);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.size > ELEVENLABS_LIMITS.sampleBytes || entry.size < 44) throw fail('invalid_sample');
    handle = await withAbort(open(samplePath, 'r'), signal);
    const stat = await withAbort(handle.stat(), signal);
    if (stat.size !== entry.size || stat.ino !== entry.ino || stat.dev !== entry.dev) throw fail('invalid_sample');
    const bytes = await withAbort(handle.readFile(), signal);
    const metadata = inspectWav(bytes);
    active(signal);
    return { bytes, metadata };
  } catch (error) {
    active(signal);
    throw error instanceof ElevenLabsError ? error : fail('sample_unavailable');
  } finally { await handle?.close().catch(() => {}); }
}

function statusError(status) {
  if (status === 401) return fail('authentication');
  if (status === 402 || status === 403) return fail('permission');
  if (status === 404) return fail('not_found');
  if (status === 429) return fail('rate_limit');
  if (status >= 500) return fail('unavailable');
  return fail('request_rejected');
}

/** Standalone trusted-process adapter; no renderer integration or credential persistence. */
export class ElevenLabsService {
  #getKey; #fetch; #timeoutMs; #maxAudioBytes;
  constructor({ getKey = () => process.env.ELEVENLABS_API_KEY ?? '', fetch: fetchImpl = globalThis.fetch, timeoutMs = 120_000,
    maxAudioBytes = ELEVENLABS_LIMITS.audioBytes } = {}) {
    if (typeof getKey !== 'function' || typeof fetchImpl !== 'function') throw new TypeError('ElevenLabsService requires getKey and fetch functions.');
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maxAudioBytes) || maxAudioBytes <= 0 || maxAudioBytes > ELEVENLABS_LIMITS.audioBytes) throw fail('invalid_input');
    this.#getKey = getKey; this.#fetch = fetchImpl; this.#timeoutMs = timeoutMs; this.#maxAudioBytes = maxAudioBytes;
  }
  async #request(endpoint, init, signal) {
    active(signal);
    let key;
    try { key = await withAbort(Promise.resolve(this.#getKey()), signal); } catch { active(signal); throw fail('missing_key'); }
    if (typeof key !== 'string' || !key.trim() || key.length > 512 || /[\r\n\0]/.test(key)) throw fail('missing_key');
    const response = await withAbort(this.#fetch(`${API}${endpoint}`, {
      ...init, headers: { ...init.headers, 'xi-api-key': key.trim() }, redirect: 'error', signal,
    }), signal);
    if (!response?.ok) {
      try { await response?.body?.cancel(); } catch { /* Never read or forward raw provider error bodies. */ }
      throw statusError(response?.status ?? 0);
    }
    return response;
  }

  async cloneVoice({ samplePath, name, consent = false, removeBackgroundNoise = false } = {}, { signal } = {}) {
    const scope = scopeFor(signal, this.#timeoutMs);
    try {
      if (consent !== true) throw fail('consent_required');
      const label = checkedString(name, 100);
      if (/[\r\n\t]/.test(label) || typeof removeBackgroundNoise !== 'boolean') throw fail('invalid_input');
      const sample = await selectedSample(samplePath, scope.signal);
      const body = new FormData();
      body.set('name', label);
      // Official SDK repeats multipart field "files". Let fetch provide its boundary.
      body.append('files', new Blob([sample.bytes], { type: 'audio/wav' }), 'reference.wav');
      body.set('remove_background_noise', String(removeBackgroundNoise));
      const response = await this.#request('/voices/add', { method: 'POST', headers: { Accept: 'application/json' }, body }, scope.signal);
      let result;
      try { result = await withAbort(response.json(), scope.signal); } catch { active(scope.signal); throw fail('invalid_response'); }
      if (!result || typeof result.requires_verification !== 'boolean') throw fail('invalid_response');
      let voiceId;
      try { voiceId = validateVoiceId(result.voice_id); } catch { throw fail('invalid_response'); }
      return { voiceId, requiresVerification: result.requires_verification, name: label, sample: sample.metadata };
    } catch (error) { throw safeError(error, scope); }
    finally { scope.dispose(); }
  }

  /** Yield binary audio immediately; break/abort cancels the reader and provider request. */
  async *streamSpeech({ voiceId, text, modelId = ELEVENLABS_DEFAULT_MODEL, outputFormat = 'mp3_44100_128', languageCode = 'pt' } = {}, { signal } = {}) {
    const scope = scopeFor(signal, this.#timeoutMs);
    let reader, finished = false;
    try {
      const voice = validateVoiceId(voiceId);
      const input = checkedString(text, ELEVENLABS_LIMITS.textCharacters);
      if (typeof modelId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(modelId) || !Object.hasOwn(AUDIO_FORMATS, outputFormat)
        || (languageCode !== undefined && !/^[a-z]{2}$/.test(languageCode))) throw fail('invalid_input');
      const body = { text: input, model_id: modelId };
      if (languageCode && modelId !== 'eleven_multilingual_v2') body.language_code = languageCode;
      const response = await this.#request(`/text-to-speech/${voice}/stream?output_format=${outputFormat}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: AUDIO_FORMATS[outputFormat].contentType }, body: JSON.stringify(body),
      }, scope.signal);
      const type = response.headers?.get('content-type')?.split(';')[0].toLowerCase() ?? '';
      if (!['audio/mpeg', 'audio/mp3', 'audio/pcm', 'audio/x-pcm', 'application/octet-stream'].includes(type) || !response.body?.getReader) throw fail('invalid_response');
      reader = response.body.getReader();
      let total = 0;
      while (true) {
        const { value, done } = await withAbort(reader.read(), scope.signal);
        active(scope.signal);
        if (done) { finished = true; break; }
        if (!(value instanceof Uint8Array)) throw fail('invalid_response');
        total += value.byteLength;
        if (total > this.#maxAudioBytes) throw fail('audio_limit');
        if (value.byteLength) yield value;
      }
      if (!total) throw fail('invalid_response');
    } catch (error) { throw safeError(error, scope); }
    finally {
      if (reader && !finished) { try { await reader.cancel(); } catch { /* Local cancellation is best effort. */ } }
      reader?.releaseLock();
      scope.dispose();
    }
  }

  async synthesizeSpeech(options, { signal } = {}) {
    const chunks = [];
    let total = 0;
    for await (const chunk of this.streamSpeech(options, { signal })) { chunks.push(chunk); total += chunk.byteLength; }
    return { audio: Buffer.concat(chunks, total), contentType: AUDIO_FORMATS[options.outputFormat ?? 'mp3_44100_128'].contentType,
      outputFormat: options.outputFormat ?? 'mp3_44100_128', modelId: options.modelId ?? ELEVENLABS_DEFAULT_MODEL };
  }
}
