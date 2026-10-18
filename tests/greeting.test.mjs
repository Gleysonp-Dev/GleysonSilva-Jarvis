import test from 'node:test';
import assert from 'node:assert/strict';
import { StartupGreetingService, StartupGreetingError, buildGreeting, GREETING_QUESTION, GREETING_VOICE_SETTINGS } from '../packages/greeting/index.mjs';

const DATE = '2026-10-18';
const NOW = new Date(`${DATE}T14:00:00Z`);
const KEY = 'mock-eleven-greeting-key-not-real';
const place = { name: 'Cidade de teste', latitude: 10, longitude: 20 };
const voiceId = 'mock_greeting_voice';
const audio = Buffer.from([73, 68, 51, 1, 2, 3]);
function forecast() {
  return { current_units: { temperature_2m: '°C', weather_code: 'wmo code', time: 'unixtime' },
    daily_units: { time: 'unixtime', temperature_2m_min: '°C', temperature_2m_max: '°C', precipitation_probability_max: '%' },
    current: { time: NOW.getTime() / 1000, temperature_2m: 25.5, weather_code: 2 },
    daily: { time: [Date.parse(`${DATE}T00:00:00Z`) / 1000], temperature_2m_min: [20], temperature_2m_max: [28], precipitation_probability_max: [65] } };
}
function setup({ settings, key = '', fetchImpl, json = forecast(), now = () => new Date(NOW), speechImpl, weatherTimeoutMs, speechTimeoutMs, actualAdapter = false } = {}) {
  let currentSettings = { startupGreeting: true, weatherLocation: { ...place }, elevenVoiceId: voiceId, ...settings };
  const requests = [], speechCalls = [];
  const service = new StartupGreetingService({ getSettings: () => currentSettings, getKey: () => key, now,
    fetch: fetchImpl ?? (async (url, init) => { requests.push({ url, init }); return Response.json(json); }),
    ...(actualAdapter ? {} : { elevenlabs: { synthesizeSpeech: async (...args) => { speechCalls.push(args); return speechImpl ? speechImpl(...args) : { audio, contentType: 'audio/mpeg' }; } } }),
    ...(weatherTimeoutMs ? { weatherTimeoutMs } : {}), ...(speechTimeoutMs ? { speechTimeoutMs } : {}),
  });
  return { service, requests, speechCalls, settings: next => { currentSettings = { ...currentSettings, ...next }; } };
}

test('pure greeting honors PC-hour boundaries and ends with the exact requested question', () => {
  for (const [hour, prefix] of [[0, 'Boa noite'], [5, 'Boa noite'], [6, 'Bom dia'], [11, 'Bom dia'], [12, 'Boa tarde'], [17, 'Boa tarde'], [18, 'Boa noite'], [23, 'Boa noite']]) {
    const text = buildGreeting({ hour });
    assert.ok(text.startsWith(`${prefix}, senhor.`)); assert.ok(text.endsWith(GREETING_QUESTION));
    assert.equal(text.includes('Não consegui consultar o tempo agora.'), true);
  }
  for (const hour of [-1, 24, 1.5, '12', undefined]) assert.throws(() => buildGreeting({ hour }), { code: 'invalid_input' });
});

test('WMO conditions, present temperature and daily min/max/precipitation use deterministic Portuguese', () => {
  const text = buildGreeting({ hour: 8, locationLabel: place.name, weather: { currentTemperature: 25.5, weatherCode: 2, minimum: 20, maximum: 28, precipitationProbability: 65 } });
  assert.ok(text.includes('25,5 graus Celsius, com céu parcialmente nublado'));
  assert.ok(text.includes('mínima de 20 e máxima de 28 graus'));
  assert.ok(text.includes('65%')); assert.ok(text.endsWith('Em que posso ajudá-lo agora, senhor?'));
  assert.ok(text.length <= 600);
});

test('startup disabled makes no network or synthesis call, even with a key and voice', async () => {
  const context = setup({ settings: { startupGreeting: false }, key: KEY });
  const result = await context.service.prepare({ hour: 8, timezone: 'UTC' });
  assert.equal(result.skipped, true); assert.equal(result.reason, 'disabled'); assert.equal(result.audioBase64, null);
  assert.equal(context.requests.length, 0); assert.equal(context.speechCalls.length, 0);
});

test('valid weather uses fixed HTTPS endpoint, unix timestamps and attribution; missing key shows text only', async () => {
  const context = setup();
  const result = await context.service.prepare({ hour: 14, timezone: 'UTC' });
  assert.equal(result.weatherStatus, 'ok'); assert.equal(result.locationLabel, place.name); assert.equal(result.audioBase64, null); assert.equal(result.reason, 'requires_key');
  assert.equal(result.attribution.name, 'Open-Meteo'); assert.equal(result.attribution.license, 'CC BY 4.0');
  const url = new URL(context.requests[0].url);
  assert.equal(url.origin, 'https://api.open-meteo.com'); assert.equal(url.pathname, '/v1/forecast');
  assert.equal(url.searchParams.get('timeformat'), 'unixtime'); assert.equal(url.searchParams.get('forecast_days'), '1');
  assert.equal(url.searchParams.get('latitude'), '10'); assert.equal(url.searchParams.get('longitude'), '20');
  assert.equal(url.searchParams.get('temperature_unit'), 'celsius'); assert.equal(url.searchParams.has('apikey'), false);
  assert.equal(context.speechCalls.length, 0); assert.equal(JSON.stringify(result).includes(KEY), false);
});

test('freshness, current-data ranges, daily date and units reject stale or misleading weather', async t => {
  const cases = {
    stale: json => { json.current.time -= 3 * 3600 + 1; },
    future: json => { json.current.time += 16 * 60; },
    yesterday: json => { json.daily.time[0] -= 86400; },
    tomorrow: json => { json.daily.time[0] += 86400; },
    missing: json => { json.current.temperature_2m = null; },
    unknownWMO: json => { json.current.weather_code = 999; },
    reversed: json => { json.daily.temperature_2m_min[0] = 40; },
    fahrenheit: json => { json.current_units.temperature_2m = '°F'; },
  };
  for (const [name, mutate] of Object.entries(cases)) await t.test(name, async () => {
    const json = forecast(); mutate(json);
    const context = setup({ json });
    const result = await context.service.prepare({ hour: 14, timezone: 'UTC' });
    assert.equal(result.weatherStatus, 'unavailable'); assert.ok(result.text.includes('Não consegui consultar o tempo agora.'));
    assert.equal(result.attribution, undefined); assert.ok(result.text.endsWith(GREETING_QUESTION));
  });
});

test('rain probability is optional and never fabricated when absent or invalid', async () => {
  const json = forecast(); json.daily.precipitation_probability_max[0] = null;
  const result = await setup({ json }).service.prepare({ hour: 14, timezone: 'UTC' });
  assert.equal(result.weatherStatus, 'ok'); assert.equal(result.text.includes('chance'), false);
});

test('today is validated in the requested PC timezone rather than the execution host date', async () => {
  const now = new Date('2026-10-19T02:00:00Z');
  const json = forecast(); json.current.time = now.getTime() / 1000; json.daily.time[0] = Date.parse('2026-10-18T10:00:00Z') / 1000;
  const result = await setup({ json, now: () => now }).service.prepare({ hour: 16, timezone: 'Pacific/Honolulu' });
  assert.equal(result.weatherStatus, 'ok'); assert.ok(result.text.startsWith('Boa tarde'));
});

test('network, invalid JSON and weather deadline preserve an honest text fallback', async t => {
  for (const [name, fetchImpl, weatherTimeoutMs] of [
    ['network', async () => { throw new Error(`private internals ${KEY}`); }],
    ['HTTP', async () => new Response(`private ${KEY}`, { status: 503 })],
    ['JSON', async () => new Response(`broken ${KEY}`)],
    ['timeout', async () => new Promise(() => {}), 10],
  ]) await t.test(name, async () => {
    const result = await setup({ fetchImpl, weatherTimeoutMs }).service.prepare({ hour: 20, timezone: 'UTC' });
    assert.equal(result.weatherStatus, 'unavailable'); assert.ok(result.text.includes('Não consegui consultar o tempo agora.'));
    assert.equal(JSON.stringify(result).includes(KEY), false);
  });
});

test('cache lives only ten minutes for the same exact coordinates, timezone and local date', async () => {
  let now = new Date(NOW);
  const context = setup({ now: () => new Date(now), fetchImpl: async (url, init) => {
    context.requests.push({ url, init });
    const json = forecast(); json.current.time = now.getTime() / 1000;
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    json.daily.time[0] = Date.parse(`${localDate}T00:00:00Z`) / 1000;
    return Response.json(json);
  } });
  await context.service.prepare({ hour: 14, timezone: 'UTC' });
  now = new Date(now.getTime() + 9 * 60000); await context.service.prepare({ hour: 14, timezone: 'UTC' });
  assert.equal(context.requests.length, 1);
  now = new Date(now.getTime() + 60000); await context.service.prepare({ hour: 14, timezone: 'UTC' });
  assert.equal(context.requests.length, 2);
  context.settings({ weatherLocation: { ...place, longitude: 21 } }); await context.service.prepare({ hour: 14, timezone: 'UTC' });
  assert.equal(context.requests.length, 3);
  now = new Date('2026-10-19T00:01:00Z'); await context.service.prepare({ hour: 0, timezone: 'UTC' });
  assert.equal(context.requests.length, 4);
});

test('city label and endpoint fields cannot replace the fixed weather URL; coordinates must be numeric', async () => {
  const context = setup({ settings: { weatherLocation: { ...place, url: 'http://127.0.0.1/private' } } });
  await context.service.prepare({ hour: 9, timezone: 'UTC' });
  assert.equal(new URL(context.requests[0].url).origin, 'https://api.open-meteo.com');
  context.settings({ weatherLocation: { name: 'Cidade', latitude: 'http://localhost/', longitude: 20 } });
  const result = await context.service.prepare({ hour: 9, timezone: 'UTC' });
  assert.equal(result.weatherStatus, 'not_configured'); assert.equal(context.requests.length, 1);
});

test('configured ElevenLabs voice synthesizes the complete greeting in memory with no key or ID returned', async () => {
  const context = setup({ key: KEY });
  const result = await context.service.prepare({ hour: 8, timezone: 'UTC' });
  assert.equal(result.audioBase64, audio.toString('base64')); assert.equal(result.mime, 'audio/mpeg');
  assert.equal(context.speechCalls[0][0].voiceId, voiceId); assert.equal(context.speechCalls[0][0].text, result.text);
  assert.equal(context.speechCalls[0][0].modelId, 'eleven_multilingual_v2'); assert.deepEqual(context.speechCalls[0][0].voiceSettings, GREETING_VOICE_SETTINGS); assert.ok(context.speechCalls[0][0].text.length <= 600);
  assert.equal(JSON.stringify(result).includes(KEY), false); assert.equal(JSON.stringify(result).includes(voiceId), false);
});

test('actual native-fetch adapter remains wired correctly but is exercised only with fake HTTP audio', async () => {
  const requests = [];
  const context = setup({ key: KEY, actualAdapter: true, fetchImpl: async (url, init) => {
    requests.push({ url, init });
    return url.startsWith('https://api.open-meteo.com/') ? Response.json(forecast()) : new Response(audio, { headers: { 'content-type': 'audio/mpeg' } });
  } });
  const result = await context.service.prepare({ hour: 8, timezone: 'UTC' });
  assert.equal(result.audioBase64, audio.toString('base64')); assert.equal(requests.length, 2);
  assert.equal(new URL(requests[1].url).origin, 'https://api.elevenlabs.io'); assert.equal(requests[1].init.headers['xi-api-key'], KEY);
  const body = JSON.parse(requests[1].init.body);
  assert.equal(body.model_id, 'eleven_multilingual_v2'); assert.deepEqual(body.voice_settings, GREETING_VOICE_SETTINGS);
  assert.equal(body.language_code, undefined, 'multilingual v2 omits unsupported language enforcement');
});

test('missing voice, TTS errors, audio cap and TTS deadline return text without fake speech', async t => {
  await t.test('voice', async () => { const result = await setup({ key: KEY, settings: { elevenVoiceId: '' } }).service.prepare({ hour: 8, timezone: 'UTC' }); assert.equal(result.reason, 'requires_voice'); assert.equal(result.audioBase64, null); });
  for (const [name, speechImpl, speechTimeoutMs] of [
    ['error', async () => { throw new Error(`provider ${KEY}`); }],
    ['limit', async () => ({ audio: Buffer.alloc(2 * 1024 * 1024 + 1), contentType: 'audio/mpeg' })],
    ['timeout', async () => new Promise(() => {}), 10],
  ]) await t.test(name, async () => {
    const result = await setup({ key: KEY, speechImpl, speechTimeoutMs }).service.prepare({ hour: 8, timezone: 'UTC' });
    assert.equal(result.reason, 'speech_unavailable'); assert.equal(result.audioBase64, null); assert.equal(result.weatherStatus, 'ok');
    assert.equal(JSON.stringify(result).includes(KEY), false);
  });
});

test('cancel during weather or TTS throws a safe cancellation and prevents delayed replay', async t => {
  await t.test('weather', async () => {
    const controller = new AbortController(); let entered; const started = new Promise(resolve => { entered = resolve; }); let requestSignal;
    const context = setup({ key: KEY, fetchImpl: async (_, init) => { requestSignal = init.signal; entered(); return new Promise(() => {}); } });
    const pending = context.service.prepare({ hour: 8, timezone: 'UTC' }, { signal: controller.signal }); await started; controller.abort();
    await assert.rejects(pending, error => error instanceof StartupGreetingError && error.code === 'cancelled');
    assert.equal(requestSignal.aborted, true); assert.equal(context.speechCalls.length, 0);
  });
  await t.test('speech', async () => {
    const controller = new AbortController(); let entered; const started = new Promise(resolve => { entered = resolve; }); let speechSignal;
    const context = setup({ key: KEY, speechImpl: async (_, { signal }) => { speechSignal = signal; entered(); return new Promise(() => {}); } });
    const pending = context.service.prepare({ hour: 8, timezone: 'UTC' }, { signal: controller.signal }); await started; controller.abort();
    await assert.rejects(pending, { code: 'cancelled' }); assert.equal(speechSignal.aborted, true);
  });
});

test('invalid PC hour or timezone stops before weather network', async () => {
  const context = setup();
  await assert.rejects(context.service.prepare({ hour: 24, timezone: 'UTC' }), { code: 'invalid_input' });
  await assert.rejects(context.service.prepare({ hour: 8, timezone: 'http://localhost/secret' }), { code: 'invalid_input' });
  assert.equal(context.requests.length, 0);
});
