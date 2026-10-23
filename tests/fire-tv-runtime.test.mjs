import assert from 'node:assert/strict';
import test from 'node:test';
import os from 'node:os';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { createRuntime, toolDefinitions } from '../packages/runtime/index.mjs';
import { OpenAIService } from '../packages/openai/index.mjs';

const SECRET = 'mock-private-key-not-a-real-credential';
const HOST = '10.0.0.25';
const call = (name, args, extras = {}) => ({ id: crypto.randomUUID(), name, args, profileId: 'principal', runId: crypto.randomUUID(), ...extras });
const sent = (field, value, extras = {}) => ({ ok: true, status: 'unverified', [field]: value, ...extras });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function fixture(t, platformAdapters = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-fire-tv-runtime-'));
  const workspaceRoot = path.join(directory, 'workspace'), dataDir = path.join(directory, 'private'), events = [];
  await fs.mkdir(workspaceRoot);
  const options = { dataDir, workspaceRoot, platformAdapters, onEvent: event => events.push(event) };
  let runtime = createRuntime(options);
  t.after(async () => {
    await runtime.close();
    const target = path.resolve(directory), prefix = path.resolve(os.tmpdir()) + path.sep + 'jarvis-fire-tv-runtime-';
    assert(target.startsWith(prefix));
    await fs.rm(target, { recursive: true, force: true });
  });
  return { get runtime() { return runtime; }, events, async restart() { await runtime.close(); runtime = createRuntime(options); } };
}

test('Fire TV schemas accept only fixed actions and apps; malformed or extra arguments never reach an adapter', async t => {
  const effects = [];
  const f = await fixture(t, { controlFireTv: async value => { effects.push(value); return sent('action', value); }, openFireTvApp: async value => { effects.push(value); return sent('app', value); } });
  for (const [name, property, values] of [
    ['tv_control', 'action', ['home', 'back', 'up', 'down', 'left', 'right', 'ok', 'volume_up', 'volume_down', 'mute', 'play', 'pause']],
    ['tv_open_app', 'app', ['netflix', 'prime_video', 'youtube', 'disney_plus', 'max', 'spotify']],
  ]) {
    const schema = toolDefinitions.find(tool => tool.name === name);
    assert(schema); assert.equal(schema.strict, true); assert.equal(schema.parameters.additionalProperties, false);
    assert.deepEqual(schema.parameters.required, [property]); assert.deepEqual(schema.parameters.properties[property].enum, values);
  }
  for (const [name, args] of [
    ['tv_control', {}], ['tv_control', { action: 'reboot' }], ['tv_control', { action: 'home; whoami' }],
    ['tv_control', { action: 'HOME' }], ['tv_control', { action: 'home', host: HOST }], ['tv_control', { action: ['home'] }],
    ['tv_open_app', {}], ['tv_open_app', { app: 'Netflix' }], ['tv_open_app', { app: 'com.netflix.ninja' }],
    ['tv_open_app', { app: 'netflix', package: 'untrusted.package' }], ['tv_open_app', { app: 'netflix', key: SECRET }],
  ]) assert.equal((await f.runtime.call(call(name, args))).status, 'failed');
  assert.deepEqual(effects, []); assert.equal(f.events.length, 0);
});

test('requested Fire TV actions need no second approval and return only bounded dispatch evidence, never adapter secrets', async t => {
  const effects = [];
  const adapter = key => async (value, options) => {
    effects.push({ key, value, options });
    return sent(key, value, { verified: true, host: HOST, privateKey: SECRET, raw: { connection: HOST, credential: SECRET } });
  };
  const f = await fixture(t, { controlFireTv: adapter('action'), openFireTvApp: adapter('app') });
  for (const [name, key, value] of [['tv_control', 'action', 'home'], ['tv_open_app', 'app', 'netflix']]) {
    const result = await f.runtime.call(call(name, { [key]: value }));
    assert.equal(result.ok, true); assert.equal(result.status, 'unverified');
    assert.deepEqual(result.data, { [key]: value }); assert.equal(Object.hasOwn(result, 'verified'), false);
    assert.match(result.summary, /tela e a reprodução não foram verificadas/);
    const snapshot = f.runtime.getSnapshot('principal');
    assert(snapshot.tasks.every(task => task.status === 'unverified'));
    const visible = JSON.stringify({ result, events: f.events, snapshot });
    assert.equal(visible.includes(SECRET), false); assert.equal(visible.includes(HOST), false);
  }
  assert.equal(effects.length, 2);
  assert(effects.every(effect => effect.options.profileId === 'principal' && effect.options.signal instanceof AbortSignal));
  assert.equal(f.events.some(event => event.type === 'approval'), false);
  assert(f.events.filter(event => event.type === 'action').every(event => event.status === 'unverified'));
});

test('missing, mismatched or incorrectly verified Fire TV adapters fail without replay or leaked response fields', async t => {
  const missing = await fixture(t);
  assert.equal((await missing.runtime.call(call('tv_open_app', { app: 'netflix' }))).status, 'failed');
  let response = sent('app', 'youtube', { host: HOST, privateKey: SECRET });
  const f = await fixture(t, { openFireTvApp: async () => response });
  for (const candidate of [response, { ok: true, status: 'verified', app: 'netflix', host: HOST, privateKey: SECRET }, { ok: false, status: 'unverified', app: 'netflix', host: HOST }]) {
    response = candidate;
    const result = await f.runtime.call(call('tv_open_app', { app: 'netflix' }));
    assert.equal(result.ok, false); assert.equal(result.status, 'failed');
    assert.equal(JSON.stringify(result).includes(HOST), false); assert.equal(JSON.stringify(result).includes(SECRET), false);
  }
  assert.equal(f.events.some(event => event.type === 'approval' || event.type === 'action'), false);
});

test('Fire TV call IDs execute at most once, survive restart, and remain scoped to the caller profile', async t => {
  const effects = [], entered = deferred(), release = deferred();
  const f = await fixture(t, { openFireTvApp: async (app, options) => { effects.push({ app, profileId: options.profileId }); entered.resolve(); if (effects.length === 1) await release.promise; return sent('app', app); } });
  const request = call('tv_open_app', { app: 'netflix' }, { id: 'same-call', runId: 'same-run' });
  const first = f.runtime.call(request), duplicate = f.runtime.call(request);
  assert.equal(first, duplicate); await entered.promise;
  request.args.app = 'youtube'; release.resolve();
  assert.equal((await first).data.app, 'netflix');
  const original = { ...request, args: { app: 'netflix' } };
  assert.equal((await f.runtime.call(original)).status, 'unverified');
  assert.equal((await f.runtime.call(request)).status, 'failed');
  await f.restart();
  assert.equal((await f.runtime.call(original)).status, 'unverified'); assert.equal(effects.length, 1);
  assert.equal((await f.runtime.call({ ...original, profileId: 'second-profile', runId: 'second-run' })).status, 'unverified');
  assert.deepEqual(effects.map(effect => effect.profileId), ['principal', 'second-profile']);
  assert.deepEqual(f.runtime.getSnapshot('principal').tasks.map(task => task.runId), ['same-run']);
  assert.deepEqual(f.runtime.getSnapshot('second-profile').tasks.map(task => task.runId), ['second-run']);
});

test('aborted and cancelled Fire TV calls cannot send effects; pending cancellation reaches the adapter and suppresses late success', async t => {
  const effects = [], entered = deferred(), release = deferred();
  const f = await fixture(t, { controlFireTv: async (action, options) => { effects.push({ action, signal: options.signal }); entered.resolve(); await release.promise; return sent('action', action); } });
  const preaborted = new AbortController(); preaborted.abort();
  assert.equal((await f.runtime.call(call('tv_control', { action: 'home' }), { signal: preaborted.signal })).status, 'cancelled');
  f.runtime.cancel('already-cancelled');
  assert.equal((await f.runtime.call(call('tv_control', { action: 'home' }, { runId: 'already-cancelled' }))).status, 'cancelled');
  assert.equal(effects.length, 0);
  const active = call('tv_control', { action: 'home' }, { runId: 'active-run' });
  const pending = f.runtime.call(active); await entered.promise;
  const queued = f.runtime.call(call('tv_control', { action: 'pause' }, { runId: 'queued-run' }));
  f.runtime.cancel('queued-run'); f.runtime.cancel('active-run');
  assert.equal(effects[0].signal.aborted, true); release.resolve();
  assert.equal((await pending).status, 'cancelled'); assert.equal((await queued).status, 'cancelled');
  assert.deepEqual(effects.map(effect => effect.action), ['home']);
  assert.equal((await f.runtime.call(active)).status, 'cancelled'); assert.equal(effects.length, 1);
  assert.equal(f.events.some(event => event.type === 'action'), false);
});

function sse(output) {
  const event = { type: 'response.completed', response: { id: 'resp_mock', status: 'completed', output } };
  return new Response(`event: response.completed\ndata: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } });
}
const message = text => ({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] });
function assertTvPrompt(instructions) {
  assert.match(instructions, /tv_open_app com app=netflix diretamente/);
  assert.match(instructions, /não procure no Windows nem abra um site/);
  assert.match(instructions, /YouTube sem mencionar TV continua usando as ferramentas youtube_/);
  assert.match(instructions, /Não envie outro comando de controle sem novo pedido/);
  assert.match(instructions, /unverified significa comando enviado/);
}

test('mocked Responses exposes both Fire TV tools and preserves unverified Netflix dispatch through the text continuation', async t => {
  const effects = [], requests = [], providerEvents = [];
  const f = await fixture(t, { openFireTvApp: async (app, options) => { effects.push({ app, profileId: options.profileId }); return sent('app', app, { host: HOST, privateKey: SECRET }); } });
  const responses = [sse([{ type: 'function_call', call_id: 'netflix-call', name: 'tv_open_app', arguments: '{"app":"netflix"}', status: 'completed' }]), sse([message('Enviei o comando para abrir a Netflix na TV.')])];
  const service = new OpenAIService({ getKey: () => SECRET, getSettings: () => ({ fireTvHost: HOST }), runtime: f.runtime, onEvent: event => providerEvents.push(event), fetch: async (url, init) => {
    requests.push({ url, body: JSON.parse(init.body) }); const response = responses.shift(); assert(response, 'unexpected provider retry'); return response;
  } });
  const result = await service.respond({ text: 'Jarvis, abra a Netflix', profileId: 'principal', runId: 'netflix-text' });
  assert.deepEqual(effects, [{ app: 'netflix', profileId: 'principal' }]); assert.equal(requests.length, 2);
  for (const request of requests) {
    assertTvPrompt(request.body.instructions);
    for (const name of ['tv_control', 'tv_open_app']) {
      const tool = request.body.tools.find(tool => tool.name === name); assert(tool); assert.equal(tool.strict, true); assert.equal(tool.parameters.additionalProperties, false);
    }
  }
  const output = JSON.parse(requests[1].body.input.find(item => item.type === 'function_call_output').output);
  assert.equal(output.status, 'unverified'); assert.deepEqual(output.data, { app: 'netflix' });
  assert.equal(result.text, 'Enviei o comando para abrir a Netflix na TV.');
  const visible = JSON.stringify({ requests, result, providerEvents }); assert.equal(visible.includes(SECRET), false); assert.equal(visible.includes(HOST), false);
  assert.equal(f.events.some(event => event.type === 'approval'), false);
});

test('mocked Realtime advertises the same closed Fire TV tools and executes them through the validated runtime', async t => {
  const effects = [], sessions = [];
  const f = await fixture(t, { openFireTvApp: async (app, options) => { effects.push({ app, signal: options.signal, profileId: options.profileId }); return sent('app', app); } });
  const service = new OpenAIService({ getKey: () => SECRET, getSettings: () => ({ fireTvHost: HOST }), runtime: f.runtime, fetch: async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/realtime/calls'); sessions.push(JSON.parse(init.body.get('session'))); return new Response('v=0\r\ns=mock-answer\r\n', { status: 201, headers: { 'content-type': 'application/sdp' } });
  } });
  const session = await service.createRealtimeSession({ sdp: 'v=0\r\ns=mock-offer\r\n', profileId: 'principal' });
  assertTvPrompt(sessions[0].instructions);
  for (const name of ['tv_control', 'tv_open_app']) {
    const tool = session.tools.find(tool => tool.name === name); assert(tool); assert.equal(tool.strict, undefined); assert.equal(tool.parameters.additionalProperties, false);
  }
  const invalid = await service.executeRealtimeTool({ id: 'bad-tv-call', name: 'tv_open_app', args: '{"app":"netflix","host":"10.0.0.25"}', profileId: 'principal', runId: 'bad-voice' });
  assert.equal(invalid.status, 'failed'); assert.equal(effects.length, 0);
  const result = await service.executeRealtimeTool({ id: 'voice-tv-call', name: 'tv_open_app', args: '{"app":"netflix"}', profileId: 'principal', runId: 'voice-tv' });
  assert.equal(result.status, 'unverified'); assert.deepEqual(result.data, { app: 'netflix' }); assert.equal(effects.length, 1);
  assert.equal(effects[0].profileId, 'principal'); assert(effects[0].signal instanceof AbortSignal);
  assert.equal(JSON.stringify({ sessions, session, result }).includes(SECRET), false); assert.equal(JSON.stringify({ sessions, session, result }).includes(HOST), false);
  assert.equal(f.events.some(event => event.type === 'approval'), false);
});
