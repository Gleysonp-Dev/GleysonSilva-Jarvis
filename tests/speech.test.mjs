import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpeechService, SPEECH_LIMITS } from '../packages/speech/index.mjs';
import { GREETING_VOICE_MODEL, GREETING_VOICE_SETTINGS } from '../packages/greeting/index.mjs';

const KEY = 'mock-private-speech-key';
const input = { text: 'A organização foi concluída e verificada.', profileId: 'principal', runId: 'voice-run-1', utteranceId: 'utterance-1' };
const audio = Buffer.from('mock-mp3');
function setup({ key = KEY, settings = {}, implementation, timeoutMs } = {}) {
  let current = { profileId: 'principal', elevenVoiceId: 'approvedJarvisVoice', ...settings };
  const calls = [];
  const service = new SpeechService({ getKey: () => key, getSettings: () => current, ...(timeoutMs ? { timeoutMs } : {}),
    elevenlabs: { synthesizeSpeech: async (...args) => { calls.push(args); return implementation ? implementation(...args) : { audio, contentType: 'audio/mpeg' }; } } });
  return { service, calls, changeProfile: profileId => { current = { ...current, profileId }; } };
}

test('speech uses the exact approved voice/model/settings and returns only bounded audio plus correlation IDs', async () => {
  const { service, calls } = setup(); const result = await service.prepare(input);
  assert.deepEqual(result, { audioBase64: audio.toString('base64'), mime: 'audio/mpeg', runId: input.runId, utteranceId: input.utteranceId });
  assert.equal(calls[0][0].voiceId, 'approvedJarvisVoice'); assert.equal(calls[0][0].text, input.text);
  assert.equal(calls[0][0].modelId, GREETING_VOICE_MODEL); assert.deepEqual(calls[0][0].voiceSettings, GREETING_VOICE_SETTINGS);
  assert.equal(calls[0][0].outputFormat, 'mp3_44100_128');
  assert.equal(JSON.stringify(result).includes(KEY), false); assert.equal(JSON.stringify(result).includes('approvedJarvisVoice'), false);
});

test('native HTTP adapter sends text and secret only to fixed ElevenLabs endpoint; never requests OpenAI audio', async () => {
  const calls = [];
  const service = new SpeechService({ getKey: () => KEY, getSettings: () => ({ profileId: 'principal', elevenVoiceId: 'approvedVoice' }), fetch: async (url, init) => {
    calls.push({ url, init }); return new Response(audio, { headers: { 'content-type': 'audio/mpeg' } });
  } });
  const result = await service.prepare(input);
  assert.equal(result.mime, 'audio/mpeg'); assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.elevenlabs.io/v1/text-to-speech/approvedVoice/stream?output_format=mp3_44100_128');
  assert.equal(calls[0].init.headers['xi-api-key'], KEY);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.text, input.text); assert.equal(body.model_id, 'eleven_multilingual_v2'); assert.deepEqual(body.voice_settings, GREETING_VOICE_SETTINGS);
  assert.equal(body.language_code, undefined);
});

test('invalid and oversized segments, IDs and unknown fields are refused before synthesis', async () => {
  for (const change of [{ text: '' }, { text: 'x'.repeat(601) }, { text: 'hello\0world' }, { profileId: '../other' }, { runId: '' }, { utteranceId: 'id/unsafe' }, { secret: KEY }]) {
    const { service, calls } = setup(); await assert.rejects(service.prepare({ ...input, ...change }), { code: 'invalid_input' }); assert.equal(calls.length, 0);
  }
  const { service } = setup(); await assert.rejects(service.prepare(null), { code: 'invalid_input' });
});

test('missing key or approved voice never falls back to another provider', async () => {
  for (const [options, code] of [[{ key: '' }, 'requires_key'], [{ settings: { elevenVoiceId: '' } }, 'requires_voice']]) {
    const { service, calls } = setup(options); await assert.rejects(service.prepare(input), { code }); assert.equal(calls.length, 0);
  }
});

test('cross-profile synthesis is refused before and after asynchronous provider work', async () => {
  const first = setup({ settings: { profileId: 'other' } });
  await assert.rejects(first.service.prepare(input), { code: 'profile_changed' }); assert.equal(first.calls.length, 0);
  let resolve;
  const second = setup({ implementation: () => new Promise(done => { resolve = done; }) });
  const result = second.service.prepare(input); await new Promise(done => setImmediate(done)); second.changeProfile('other'); resolve({ audio, contentType: 'audio/mpeg' });
  await assert.rejects(result, { code: 'profile_changed' });
});

test('cancellation aborts an in-flight synthesis and discards its late audio', async () => {
  const controller = new AbortController(); let providerSignal, resolve;
  const { service } = setup({ implementation: (options, { signal }) => { providerSignal = signal; return new Promise(done => { resolve = done; }); } });
  const promise = service.prepare(input, { signal: controller.signal }); await new Promise(done => setImmediate(done)); controller.abort();
  await assert.rejects(promise, { code: 'cancelled' }); assert.equal(providerSignal.aborted, true); resolve({ audio, contentType: 'audio/mpeg' });
  await assert.rejects(service.prepare(input, { signal: controller.signal }), { code: 'cancelled' });
});

test('deadline also bounds a provider promise that ignores its cancellation signal', async () => {
  let providerSignal;
  const { service } = setup({ timeoutMs: 15, implementation: (options, { signal }) => { providerSignal = signal; return new Promise(() => {}); } });
  await assert.rejects(service.prepare(input), { code: 'timeout' }); assert.equal(providerSignal.aborted, true);
});

test('invalid, empty, wrong-mime or oversized provider audio is refused, and provider errors are redacted', async () => {
  for (const result of [{ audio: new Uint8Array(), contentType: 'audio/mpeg' }, { audio: new Uint8Array(SPEECH_LIMITS.audioBytes + 1), contentType: 'audio/mpeg' }, { audio, contentType: 'audio/wav' }, { audio: 'data', contentType: 'audio/mpeg' }]) {
    const { service } = setup({ implementation: async () => result }); await assert.rejects(service.prepare(input), { code: 'unavailable' });
  }
  const { service } = setup({ implementation: async () => { throw new Error(`Provider internal ${KEY}`); } });
  await assert.rejects(service.prepare(input), error => error.code === 'unavailable' && !error.message.includes(KEY));
});
