import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, writeFile, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { ElevenLabsService, ElevenLabsError, ELEVENLABS_DEFAULT_MODEL, inspectWav, ELEVENLABS_LIMITS } from '../packages/elevenlabs/index.mjs';
import { runVoiceCLI } from '../scripts/voice.mjs';

const KEY = 'mock-elevenlabs-key-not-real';
const VOICE = 'voice_mock_123';
function wav(seconds = 2, sampleRate = 16000) {
  const size = Math.round(seconds * sampleRate) * 2;
  const bytes = Buffer.alloc(44 + size);
  bytes.write('RIFF', 0); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8);
  bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24); bytes.writeUInt32LE(sampleRate * 2, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(size, 40);
  return bytes;
}
async function temp(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'jarvis-elevenlabs-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
async function sampleFile(t) { const root = await temp(t); const samplePath = path.join(root, 'private-selected-reference.wav'); await writeFile(samplePath, wav()); return samplePath; }
const audioResponse = (chunks = [Uint8Array.of(73, 68, 51, 1, 2)]) => new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } }), { headers: { 'content-type': 'audio/mpeg' } });
function setup({ responses = [], getKey = () => KEY, fetchImpl, ...options } = {}) {
  const requests = [];
  const service = new ElevenLabsService({ getKey, fetch: fetchImpl ?? (async (url, init) => { requests.push({ url, init }); assert.ok(responses.length, 'unexpected network request'); return responses.shift(); }), ...options });
  return { service, requests };
}

test('cloning requires explicit consent before reading files or consulting key', async () => {
  let keyReads = 0;
  const context = setup({ getKey: () => { keyReads++; return KEY; } });
  await assert.rejects(context.service.cloneVoice({ samplePath: 'not-an-absolute-file.wav', name: 'Jarvis' }), { code: 'consent_required' });
  assert.equal(context.requests.length, 0); assert.equal(keyReads, 0);
});

test('WAV validation rejects malformed, oversized, short-duration and unsupported encodings', () => {
  const metadata = inspectWav(wav(20.2));
  assert.equal(metadata.durationSeconds, 20.2); assert.equal(metadata.channels, 1); assert.equal(metadata.encoding, 'pcm');
  assert.equal(metadata.sha256.length, 64);
  const malformed = wav(); malformed.writeUInt32LE(999999, 40);
  const encoded = wav(); encoded.writeUInt16LE(65534, 20);
  for (const bytes of [Buffer.from('bad'), wav(0.2), wav(181), malformed, encoded, Buffer.alloc(ELEVENLABS_LIMITS.sampleBytes + 1)]) {
    assert.throws(() => inspectWav(bytes), { code: 'invalid_sample' });
  }
});

test('clone sends only the explicitly selected WAV in multipart files with server-held key', async t => {
  const samplePath = await sampleFile(t);
  const context = setup({ responses: [Response.json({ voice_id: VOICE, requires_verification: false, internal: KEY })] });
  const result = await context.service.cloneVoice({ samplePath, name: 'Jarvis autorizado', consent: true });
  assert.equal(result.voiceId, VOICE); assert.equal(result.requiresVerification, false); assert.equal(result.sample.durationSeconds, 2);
  assert.equal(JSON.stringify(result).includes(KEY), false); assert.equal(JSON.stringify(result).includes(samplePath), false);
  const { url, init } = context.requests[0];
  assert.equal(url, 'https://api.elevenlabs.io/v1/voices/add');
  assert.equal(init.headers['xi-api-key'], KEY); assert.equal(init.headers['Content-Type'], undefined);
  assert.ok(init.body instanceof FormData); assert.equal(init.body.get('name'), 'Jarvis autorizado');
  assert.equal(init.body.get('remove_background_noise'), 'false');
  assert.equal(init.body.getAll('files').length, 1); assert.equal(init.body.get('files').name, 'reference.wav');
  assert.equal(init.body.get('files').type, 'audio/wav');
  assert.deepEqual(Buffer.from(await init.body.get('files').arrayBuffer()), wav());
});

test('relative sample, missing sample and invalid name cannot start clone requests', async t => {
  const samplePath = await sampleFile(t);
  const context = setup();
  await assert.rejects(context.service.cloneVoice({ samplePath: 'reference.wav', name: 'Jarvis', consent: true }), { code: 'invalid_sample' });
  await assert.rejects(context.service.cloneVoice({ samplePath: path.join(os.tmpdir(), 'jarvis-not-present-file.wav'), name: 'Jarvis', consent: true }), { code: 'sample_unavailable' });
  await assert.rejects(context.service.cloneVoice({ samplePath, name: 'Jarvis\nunsafe', consent: true }), { code: 'invalid_input' });
  assert.equal(context.requests.length, 0);
});

test('clone preserves verification requirement and rejects an unexpected response', async t => {
  const samplePath = await sampleFile(t);
  const context = setup({ responses: [Response.json({ voice_id: VOICE, requires_verification: true }), Response.json({ voice_id: `${KEY} secret`, requires_verification: false })] });
  assert.equal((await context.service.cloneVoice({ samplePath, name: 'Jarvis', consent: true })).requiresVerification, true);
  await assert.rejects(context.service.cloneVoice({ samplePath, name: 'Jarvis', consent: true }), { code: 'invalid_response' });
});

test('clone cancellation aborts an in-flight upload without repeating the creation request', async t => {
  const samplePath = await sampleFile(t);
  const controller = new AbortController();
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  let calls = 0;
  const context = setup({ fetchImpl: async (_, init) => { calls++; entered(init.signal); return new Promise(() => {}); } });
  const operation = context.service.cloneVoice({ samplePath, name: 'Jarvis', consent: true }, { signal: controller.signal });
  const requestSignal = await started;
  controller.abort();
  await assert.rejects(operation, { code: 'cancelled' });
  assert.equal(requestSignal.aborted, true);
  assert.equal(calls, 1);
});

test('streaming TTS yields the first audio chunk before the response is complete', async () => {
  let control;
  const response = new Response(new ReadableStream({ start(controller) { control = controller; controller.enqueue(Uint8Array.of(73, 68, 51)); } }), { headers: { 'content-type': 'audio/mpeg' } });
  const context = setup({ responses: [response] });
  const iterator = context.service.streamSpeech({ voiceId: VOICE, text: 'Olá, estou ouvindo.' });
  assert.deepEqual((await iterator.next()).value, Uint8Array.of(73, 68, 51));
  control.enqueue(Uint8Array.of(4, 5)); control.close();
  assert.deepEqual((await iterator.next()).value, Uint8Array.of(4, 5)); assert.equal((await iterator.next()).done, true);
  const { url, init } = context.requests[0];
  assert.equal(url, `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/stream?output_format=mp3_44100_128`);
  assert.deepEqual(JSON.parse(init.body), { text: 'Olá, estou ouvindo.', model_id: ELEVENLABS_DEFAULT_MODEL, language_code: 'pt' });
  assert.equal(init.headers['xi-api-key'], KEY); assert.equal(init.body.includes(KEY), false);
});

test('multilingual v2 omits unsupported language parameter and aggregates audio', async () => {
  const context = setup({ responses: [audioResponse([Uint8Array.of(1, 2), Uint8Array.of(3, 4)])] });
  const result = await context.service.synthesizeSpeech({ voiceId: VOICE, text: 'Olá.', modelId: 'eleven_multilingual_v2' });
  assert.deepEqual(result.audio, Buffer.from([1, 2, 3, 4])); assert.equal(result.contentType, 'audio/mpeg');
  assert.equal(JSON.parse(context.requests[0].init.body).language_code, undefined);
});

test('text limits, voice path injection, formats and JSON pretending to be audio are rejected', async () => {
  const context = setup({ responses: [Response.json({ detail: `internal ${KEY}` })] });
  for (const options of [{ voiceId: '../voice', text: 'Olá' }, { voiceId: VOICE, text: 'x'.repeat(4001) }, { voiceId: VOICE, text: 'Olá', outputFormat: 'unbounded-format' }]) {
    await assert.rejects(context.service.synthesizeSpeech(options), { code: 'invalid_input' });
  }
  assert.equal(context.requests.length, 0);
  await assert.rejects(context.service.synthesizeSpeech({ voiceId: VOICE, text: 'Olá' }), error => error.code === 'invalid_response' && !error.message.includes(KEY));
});

test('audio size cap stops reading and does not return an incomplete aggregate', async () => {
  const context = setup({ maxAudioBytes: 3, responses: [audioResponse([Uint8Array.of(1, 2), Uint8Array.of(3, 4)])] });
  await assert.rejects(context.service.synthesizeSpeech({ voiceId: VOICE, text: 'Olá' }), { code: 'audio_limit' });
});

test('consumer break cancels upstream audio reader', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(Uint8Array.of(1, 2)); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'audio/mpeg' } });
  const context = setup({ responses: [response] });
  for await (const _ of context.service.streamSpeech({ voiceId: VOICE, text: 'Olá' })) break;
  assert.equal(cancelled, true);
});

test('abort reaches fetch and a pending audio reader; timeout is distinct', async () => {
  const controller = new AbortController();
  const response = new Response(new ReadableStream({ start(control) { control.enqueue(Uint8Array.of(1)); } }), { headers: { 'content-type': 'audio/mpeg' } });
  const context = setup({ responses: [response] });
  const iterator = context.service.streamSpeech({ voiceId: VOICE, text: 'Olá' }, { signal: controller.signal });
  await iterator.next(); const next = iterator.next(); controller.abort();
  await assert.rejects(next, { code: 'cancelled' }); assert.equal(context.requests[0].init.signal.aborted, true);
  const timeout = setup({ timeoutMs: 15, fetchImpl: async () => new Promise(() => {}) });
  await assert.rejects(timeout.service.synthesizeSpeech({ voiceId: VOICE, text: 'Olá' }), { code: 'timeout' });
});

test('provider and transport errors never include raw keys, payloads or response internals', async t => {
  for (const [status, code] of [[401, 'authentication'], [402, 'permission'], [403, 'permission'], [404, 'not_found'], [422, 'request_rejected'], [429, 'rate_limit'], [503, 'unavailable']]) {
    await t.test(String(status), async () => {
      const context = setup({ responses: [new Response(JSON.stringify({ detail: `${KEY}: confidential` }), { status })] });
      await assert.rejects(context.service.synthesizeSpeech({ voiceId: VOICE, text: 'Olá.' }), error => error instanceof ElevenLabsError && error.code === code && !JSON.stringify(error).includes(KEY));
    });
  }
  const context = setup({ fetchImpl: async () => { throw new Error(`${KEY}: confidential`); } });
  await assert.rejects(context.service.synthesizeSpeech({ voiceId: VOICE, text: 'Olá.' }), error => error.code === 'connection' && !error.message.includes(KEY));
});

test('missing key makes no request', async () => {
  const context = setup({ getKey: () => '' });
  await assert.rejects(context.service.synthesizeSpeech({ voiceId: VOICE, text: 'Olá.' }), { code: 'missing_key' });
  assert.equal(context.requests.length, 0);
});

test('CLI clone saves private metadata without sample path, sample audio, or key in stdout', async t => {
  const root = await temp(t); const samplePath = await sampleFile(t);
  const context = setup({ responses: [Response.json({ voice_id: VOICE, requires_verification: false })] });
  let stdout = '';
  await runVoiceCLI(['clone', '--sample', samplePath, '--name', 'Jarvis', '--consent'], { rootDir: root, service: context.service, stdout: { write: text => { stdout += text; } } });
  const saved = JSON.parse(await readFile(path.join(root, 'local-data/voice.json'), 'utf8'));
  assert.equal(saved.voiceId, VOICE); assert.equal(saved.provider, 'elevenlabs'); assert.equal(saved.sample.durationSeconds, 2);
  assert.equal(JSON.stringify(saved).includes(KEY), false); assert.equal(JSON.stringify(saved).includes(samplePath), false);
  assert.equal(stdout.includes(KEY), false); assert.equal(stdout.includes(VOICE), false); assert.equal(stdout.includes(samplePath), false);
  assert.deepEqual(await readdir(path.join(root, 'local-data')), ['voice.json']);
  await assert.rejects(runVoiceCLI(['clone', '--sample', samplePath, '--name', 'Jarvis', '--consent'], { rootDir: root, service: context.service }), { code: 'exists' });
  assert.equal(context.requests.length, 1);
});

test('CLI help is offline; consent and key arguments fail without creating output directories', async t => {
  const root = await temp(t); let output = '';
  await runVoiceCLI(['--help'], { rootDir: root, stdout: { write: text => { output += text; } } });
  assert.ok(output.includes('ELEVENLABS_API_KEY')); assert.deepEqual(await readdir(root), []);
  await assert.rejects(runVoiceCLI(['clone', '--sample', 'anything.wav', '--name', 'Jarvis'], { rootDir: root }), { code: 'consent_required' });
  await assert.rejects(runVoiceCLI(['speak', '--text', 'Olá', '--api-key', KEY], { rootDir: root }), { code: 'usage' });
  assert.deepEqual(await readdir(root), []);
});

test('CLI speak uses saved voice but leaves only complete private audio', async t => {
  const root = await temp(t);
  await mkdir(path.join(root, 'local-data')); await writeFile(path.join(root, 'local-data/voice.json'), JSON.stringify({ voiceId: VOICE, requiresVerification: false }));
  const context = setup({ responses: [audioResponse([Uint8Array.of(73, 68, 51), Uint8Array.of(4, 5)])] });
  let output = '';
  const result = await runVoiceCLI(['speak', '--text', 'Olá. Estou pronto.'], { rootDir: root, service: context.service, stdout: { write: text => { output += text; } } });
  assert.deepEqual(await readFile(result.destination), Buffer.from([73, 68, 51, 4, 5]));
  assert.equal(result.destination.startsWith(path.join(root, 'local-data/audio')), true);
  assert.equal((await readdir(path.join(root, 'local-data/audio'))).some(file => file.endsWith('.partial')), false);
  assert.equal(output.includes(KEY), false); assert.equal(output.includes(VOICE), false);
});

test('CLI does not generate a saved voice awaiting verification, nor retain partial audio on abort', async t => {
  const root = await temp(t);
  await mkdir(path.join(root, 'local-data')); await writeFile(path.join(root, 'local-data/voice.json'), JSON.stringify({ voiceId: VOICE, requiresVerification: true }));
  const context = setup();
  await assert.rejects(runVoiceCLI(['speak', '--text', 'Olá.'], { rootDir: root, service: context.service }), { code: 'verification' });
  assert.equal(context.requests.length, 0);
  const mockService = { async *streamSpeech() { yield Uint8Array.of(1, 2, 3); throw new ElevenLabsError('cancelled'); } };
  await assert.rejects(runVoiceCLI(['speak', '--text', 'Olá.', '--voice-id', VOICE], { rootDir: root, service: mockService }), { code: 'cancelled' });
  assert.deepEqual(await readdir(path.join(root, 'local-data/audio')), []);
});
