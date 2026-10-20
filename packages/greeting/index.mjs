import { ElevenLabsService, validateVoiceId } from '../elevenlabs/index.mjs';

const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const MAX_CURRENT_AGE = 3 * 60 * 60_000;
const FUTURE_TOLERANCE = 15 * 60_000;
const CACHE_TTL = 10 * 60_000;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const GREETING_QUESTION = 'Em que posso ajudá-lo agora, senhor?';
export const GREETING_VOICE_MODEL = 'eleven_multilingual_v2';
export const GREETING_VOICE_SETTINGS = Object.freeze({ stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true, speed: 1 });
export const WEATHER_ATTRIBUTION = Object.freeze({ name: 'Open-Meteo', url: 'https://open-meteo.com/', license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', text: 'Dados Open-Meteo (CC BY 4.0), resumidos em português.' });

const CONDITIONS = new Map([
  [0, 'céu limpo'], [1, 'céu quase limpo'], [2, 'céu parcialmente nublado'], [3, 'céu encoberto'],
  [45, 'nevoeiro'], [48, 'nevoeiro com geada'], [51, 'garoa fraca'], [53, 'garoa moderada'], [55, 'garoa forte'],
  [56, 'garoa congelante fraca'], [57, 'garoa congelante forte'], [61, 'chuva fraca'], [63, 'chuva moderada'], [65, 'chuva forte'],
  [66, 'chuva congelante fraca'], [67, 'chuva congelante forte'], [71, 'neve fraca'], [73, 'neve moderada'], [75, 'neve forte'],
  [77, 'grãos de neve'], [80, 'pancadas de chuva fracas'], [81, 'pancadas de chuva moderadas'], [82, 'pancadas de chuva fortes'],
  [85, 'pancadas de neve fracas'], [86, 'pancadas de neve fortes'], [95, 'trovoadas'], [96, 'trovoadas com granizo'], [99, 'trovoadas fortes com granizo'],
]);
const finite = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
const temperature = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
const locationName = value => typeof value === 'string' && value.trim() && value.trim().length <= 80 && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : '';

export class StartupGreetingError extends Error {
  constructor(code) {
    super(code === 'cancelled' ? 'Saudação de abertura interrompida.' : 'Horário ou fuso da saudação inválido.');
    this.name = 'StartupGreetingError'; this.code = code === 'cancelled' ? code : 'invalid_input';
  }
}
const active = signal => { if (signal?.aborted) throw new StartupGreetingError('cancelled'); };
function validHour(hour) { if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new StartupGreetingError('invalid_input'); return hour; }
function timezoneName(value) {
  const candidate = value ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (typeof candidate !== 'string' || candidate.length > 80) throw new StartupGreetingError('invalid_input');
  try { return new Intl.DateTimeFormat('en-US', { timeZone: candidate }).resolvedOptions().timeZone; }
  catch { throw new StartupGreetingError('invalid_input'); }
}
export function validateWeatherRequest(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'timezone')) throw new StartupGreetingError('invalid_input');
  return { timezone: timezoneName(input.timezone) };
}
function dateInZone(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function deadline(signal, timeoutMs) {
  const controller = new AbortController();
  const relay = () => controller.abort();
  if (signal?.aborted) relay(); else signal?.addEventListener('abort', relay, { once: true });
  const timer = setTimeout(relay, timeoutMs);
  return { signal: controller.signal, dispose: () => { clearTimeout(timer); signal?.removeEventListener('abort', relay); } };
}
async function abortable(promise, signal) {
  active(signal);
  let relay;
  try { return await Promise.race([promise, new Promise((_, reject) => { relay = () => reject(new StartupGreetingError('cancelled')); signal?.addEventListener('abort', relay, { once: true }); if (signal?.aborted) relay(); })]); }
  finally { signal?.removeEventListener('abort', relay); }
}

/** Deterministic phrasing: no LLM, remote text or commands are interpreted. */
export function buildGreeting({ hour, locationLabel = '', weather = null } = {}) {
  validHour(hour);
  const greeting = hour >= 6 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
  const label = locationName(locationLabel);
  const valid = weather && finite(weather.currentTemperature, -100, 70) && CONDITIONS.has(weather.weatherCode)
    && finite(weather.minimum, -100, 70) && finite(weather.maximum, -100, 70) && weather.minimum <= weather.maximum;
  let report = 'Não consegui consultar o tempo agora.';
  if (valid) {
    report = `Agora${label ? `, em ${label},` : ''} faz ${temperature(weather.currentTemperature)} graus Celsius, com ${CONDITIONS.get(weather.weatherCode)}. `
      + `Hoje, a previsão é de mínima de ${temperature(weather.minimum)} e máxima de ${temperature(weather.maximum)} graus.`;
    if (finite(weather.precipitationProbability, 0, 100)) report += ` A chance de precipitação hoje é de ${Math.round(weather.precipitationProbability)}%.`;
  }
  return `${greeting}, senhor. ${report} ${GREETING_QUESTION}`;
}

function validLocation(value) {
  if (!value || !locationName(value.name) || !finite(value.latitude, -90, 90) || !finite(value.longitude, -180, 180)) return null;
  return { name: locationName(value.name), latitude: value.latitude, longitude: value.longitude };
}
function fresh(timestamp, now) { return Number.isFinite(timestamp) && timestamp <= now + FUTURE_TOLERANCE && now - timestamp <= MAX_CURRENT_AGE; }
function weatherData(json, { now, timezone, date }) {
  const current = json?.current, daily = json?.daily;
  if (!current || !daily || !finite(current.time, 0, 9_999_999_999) || !fresh(current.time * 1000, now.getTime())
    || !finite(current.temperature_2m, -100, 70) || !Number.isInteger(current.weather_code) || !CONDITIONS.has(current.weather_code)
    || json.current_units?.temperature_2m !== '°C' || json.daily_units?.temperature_2m_min !== '°C' || json.daily_units?.temperature_2m_max !== '°C'
    || !Array.isArray(daily.time) || daily.time.length > 2) return null;
  const index = daily.time.findIndex(time => finite(time, 0, 9_999_999_999) && dateInZone(new Date(time * 1000), timezone) === date);
  if (index < 0) return null;
  const minimum = daily.temperature_2m_min?.[index], maximum = daily.temperature_2m_max?.[index];
  if (!finite(minimum, -100, 70) || !finite(maximum, -100, 70) || minimum > maximum) return null;
  const probability = daily.precipitation_probability_max?.[index];
  return { date, observedAt: current.time * 1000, currentTemperature: current.temperature_2m, weatherCode: current.weather_code, minimum, maximum,
    ...(finite(probability, 0, 100) && json.daily_units?.precipitation_probability_max === '%' ? { precipitationProbability: probability } : {}) };
}

/** Trusted-process service: startup policy, run-once and replay limits remain in the main controller. */
export class StartupGreetingService {
  #getSettings; #getKey; #fetch; #elevenlabs; #now; #weatherTimeoutMs; #speechTimeoutMs; #cache;
  constructor({ getSettings = () => ({}), getKey = () => '', fetch: fetchImpl = globalThis.fetch, elevenlabs,
    now = () => new Date(), weatherTimeoutMs = 8000, speechTimeoutMs = 20_000 } = {}) {
    if (typeof getSettings !== 'function' || typeof getKey !== 'function' || typeof fetchImpl !== 'function' || typeof now !== 'function') throw new TypeError('StartupGreetingService requires settings, key, fetch and clock functions.');
    this.#getSettings = getSettings; this.#getKey = getKey; this.#fetch = fetchImpl; this.#elevenlabs = elevenlabs; this.#now = now;
    this.#weatherTimeoutMs = weatherTimeoutMs; this.#speechTimeoutMs = speechTimeoutMs;
  }

  async #weather(location, timezone, now, signal) {
    const date = dateInZone(now, timezone);
    const key = JSON.stringify([location.latitude, location.longitude, timezone, date]);
    if (this.#cache?.key === key && now.getTime() >= this.#cache.fetchedAt && now.getTime() - this.#cache.fetchedAt < CACHE_TTL
      && fresh(this.#cache.weather.observedAt, now.getTime())) return { weather: { ...this.#cache.weather }, fetchedAt: this.#cache.fetchedAt, cache: { hit: true, expiresAt: this.#cache.fetchedAt + CACHE_TTL } };
    const scope = deadline(signal, this.#weatherTimeoutMs);
    try {
      const url = new URL(WEATHER_ENDPOINT);
      url.search = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude),
        current: 'temperature_2m,weather_code', daily: 'temperature_2m_min,temperature_2m_max,precipitation_probability_max',
        forecast_days: '1', timezone, temperature_unit: 'celsius', timeformat: 'unixtime' }).toString();
      const response = await abortable(this.#fetch(url.href, { headers: { Accept: 'application/json' }, signal: scope.signal, redirect: 'error' }), scope.signal);
      if (!response?.ok) { try { await response?.body?.cancel(); } catch {} return null; }
      const body = await abortable(response.text(), scope.signal);
      if (body.length > 65_536) return null;
      let json;
      try { json = JSON.parse(body); } catch { return null; }
      const receivedAt = this.#now();
      if (!(receivedAt instanceof Date) || !Number.isFinite(receivedAt.getTime()) || dateInZone(receivedAt, timezone) !== date) return null;
      const weather = weatherData(json, { now: receivedAt, timezone, date });
      active(signal);
      if (weather) this.#cache = { key, fetchedAt: receivedAt.getTime(), weather };
      return weather ? { weather: { ...weather }, fetchedAt: receivedAt.getTime(), cache: { hit: false, expiresAt: receivedAt.getTime() + CACHE_TTL } } : null;
    } catch { active(signal); return null; }
    finally { scope.dispose(); }
  }

  async #readWeather(settings, timezone, now, signal) {
    const location = validLocation(settings.weatherLocation);
    const result = location ? await this.#weather(location, timezone, now, signal) : null;
    active(signal);
    return { status: result ? 'ok' : location ? 'unavailable' : 'not_configured', timezone, locationLabel: location?.name ?? '',
      weather: result ? { ...result.weather, condition: CONDITIONS.get(result.weather.weatherCode) } : null,
      attribution: result ? { ...WEATHER_ATTRIBUTION } : null, fetchedAt: result?.fetchedAt ?? null,
      cache: result?.cache ?? { hit: false, expiresAt: null } };
  }

  /** Explicit read only: independent of startup policy and never loads credentials or synthesizes audio. */
  async readWeather(input = {}, { signal } = {}) {
    active(signal);
    const { timezone } = validateWeatherRequest(input);
    const now = this.#now();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new StartupGreetingError('invalid_input');
    return this.#readWeather(this.#getSettings() ?? {}, timezone, now, signal);
  }

  async prepare({ hour, timezone } = {}, { signal } = {}) {
    active(signal);
    const settings = this.#getSettings() ?? {};
    if (settings.startupGreeting !== true) return { text: '', weatherStatus: 'skipped', locationLabel: '', audioBase64: null, mime: 'audio/mpeg', reason: 'disabled', skipped: true };
    validHour(hour);
    const zone = timezoneName(timezone);
    const now = this.#now();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new StartupGreetingError('invalid_input');
    const weatherResult = await this.#readWeather(settings, zone, now, signal);
    const weather = weatherResult.weather;
    active(signal);
    const text = buildGreeting({ hour, locationLabel: weatherResult.locationLabel, weather });
    const result = { text, weatherStatus: weatherResult.status, locationLabel: weatherResult.locationLabel,
      audioBase64: null, mime: 'audio/mpeg', ...(weather ? { attribution: { ...WEATHER_ATTRIBUTION } } : {}) };
    let key;
    try { key = await abortable(Promise.resolve(this.#getKey()), signal); } catch { active(signal); return { ...result, reason: 'requires_key' }; }
    active(signal);
    if (typeof key !== 'string' || !key.trim() || key.length > 512 || /[\r\n\0]/.test(key)) return { ...result, reason: 'requires_key' };
    let voiceId;
    try { voiceId = validateVoiceId(settings.elevenVoiceId); } catch { return { ...result, reason: 'requires_voice' }; }
    if (text.length > 600) return { ...result, reason: 'speech_unavailable' };
    const scope = deadline(signal, this.#speechTimeoutMs);
    try {
      const client = this.#elevenlabs ?? new ElevenLabsService({ getKey: () => key, fetch: this.#fetch, timeoutMs: this.#speechTimeoutMs, maxAudioBytes: MAX_AUDIO_BYTES });
      const speech = await abortable(client.synthesizeSpeech({ voiceId, text, modelId: GREETING_VOICE_MODEL, voiceSettings: { ...GREETING_VOICE_SETTINGS }, outputFormat: 'mp3_44100_128', languageCode: 'pt' }, { signal: scope.signal }), scope.signal);
      active(signal);
      if (!(speech?.audio instanceof Uint8Array) || !speech.audio.byteLength || speech.audio.byteLength > MAX_AUDIO_BYTES || speech.contentType !== 'audio/mpeg') return { ...result, reason: 'speech_unavailable' };
      return { ...result, audioBase64: Buffer.from(speech.audio).toString('base64') };
    } catch { active(signal); return { ...result, reason: 'speech_unavailable' }; }
    finally { scope.dispose(); }
  }
}
