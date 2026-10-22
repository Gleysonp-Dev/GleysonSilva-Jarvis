import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { createUltronBridge, bridgeCall, BridgeError, normalizeWebsiteUrl } from '../packages/ultron/index.mjs';
import { bridgeTimeout, readBridgeMetadata, validBridgePipe, MAX_BRIDGE_BYTES } from '../plugins/jarvis-ultron/bridge.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) { const deadline = Date.now() + 2000; while (Date.now() < deadline) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); } assert.fail('The local request did not reach its expected state.'); }
async function fixture(t, handle = async (method, args) => ({ method, args })) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-ultron-'));
  const brokers = [];
  t.after(async () => {
    await Promise.all(brokers.map(broker => broker.close()));
    const resolved = path.resolve(directory); assert.ok(resolved.startsWith(path.join(path.resolve(os.tmpdir()), 'jarvis-ultron-')));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  const start = async handler => { const broker = await createUltronBridge({ dataDir: directory, handle: handler ?? handle }); brokers.push(broker); return broker; };
  const broker = await start();
  return { directory, broker, start, call: options => bridgeCall({ dataDir: directory, ...options }), metadata: () => readBridgeMetadata(directory) };
}
async function raw(metadata, value, { split = false } = {}) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0); const socket = net.createConnection({ path: metadata.pipe });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('Test socket timed out.')); }, 2000);
    const cleanup = () => { clearTimeout(timer); socket.destroy(); };
    socket.on('error', error => { cleanup(); reject(error); });
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]); const newline = buffer.indexOf(10);
      if (newline >= 0) { cleanup(); try { resolve(JSON.parse(buffer.subarray(0, newline).toString('utf8'))); } catch (error) { reject(error); } }
    });
    socket.on('connect', () => { if (!split) socket.write(value); else { socket.write(value.subarray(0, 17)); setImmediate(() => socket.write(value.subarray(17))); } });
  });
}
const request = (metadata, overrides = {}) => ({ version: 1, id: crypto.randomUUID(), token: metadata.token, method: 'status', args: {}, ...overrides });

test('local bridge handles only the five bounded methods through a private randomized pipe', async t => {
  const seen = [], f = await fixture(t, async (method, args, context) => { seen.push({ method, args, context }); return { ok: true, method }; });
  const metadata = await f.metadata();
  assert.equal(metadata.version, 1); assert.match(metadata.token, /^[a-f0-9]{64}$/); assert.equal(validBridgePipe(metadata.pipe, f.directory), true);
  if (process.platform !== 'win32') assert.equal((await fs.stat(path.join(f.directory, 'ultron-bridge.json'))).mode & 0o077, 0);
  for (const method of ['status', 'weather', 'open_browser', 'open_url', 'speak']) assert.deepEqual(await f.call({ method, args: method === 'speak' ? { text: 'Olá, senhor.' } : method === 'open_url' ? { url: 'para-meditacao-app.com' } : {} }), { ok: true, method });
  assert.equal(seen.length, 5); assert.equal(seen.every(item => !item.context.signal.aborted && typeof item.context.id === 'string'), true);
  assert.deepEqual(seen[3].args, { url: 'https://para-meditacao-app.com/' });
  assert.deepEqual(seen.at(-1).args, { text: 'Olá, senhor.' });
  assert.equal(bridgeTimeout('speak'), 110_000); assert.equal(bridgeTimeout('status'), 30_000); assert.ok(bridgeTimeout('speak') < 120_000);
});

test('the standalone client discovers the real native AppData folder name without configuration', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-ultron-appdata-'));
  const previous = process.env.APPDATA; let broker;
  try {
    process.env.APPDATA = directory;
    broker = await createUltronBridge({ dataDir: path.join(directory, 'Projeto GleysonSilva-Jarvis'), handle: async () => ({ connected: true }) });
    assert.deepEqual(await bridgeCall({ method: 'status' }), { connected: true });
  } finally {
    if (previous === undefined) delete process.env.APPDATA; else process.env.APPDATA = previous;
    await broker?.close(); assert.ok(path.resolve(directory).startsWith(path.join(path.resolve(os.tmpdir()), 'jarvis-ultron-appdata-')));
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('fragmented newline framing authenticates once and returns exactly one response', async t => {
  let called = 0; const f = await fixture(t, async () => ({ count: ++called })), metadata = await f.metadata();
  const input = request(metadata); const response = await raw(metadata, Buffer.from(JSON.stringify(input) + '\n'), { split: true });
  assert.deepEqual(response, { id: input.id, result: { count: 1 } }); assert.equal(called, 1);
});

test('bad authentication, malformed bytes and unsupported methods never reach a handler or echo secrets', async t => {
  let called = 0; const f = await fixture(t, async () => { called++; return {}; }), metadata = await f.metadata();
  const samples = [
    '{bad json}\n',
    JSON.stringify(request(metadata, { token: 'a'.repeat(64) === metadata.token ? 'b'.repeat(64) : 'a'.repeat(64) })) + '\n',
    JSON.stringify(request(metadata, { method: 'shell', args: { command: 'private-secret-do-not-echo' } })) + '\n',
    JSON.stringify(request(metadata, { version: 2 })) + '\n',
    JSON.stringify(request(metadata, { args: { path: 'C:\\private' } })) + '\n',
    JSON.stringify(request(metadata)) + '\n' + JSON.stringify(request(metadata)) + '\n',
  ];
  for (const sample of samples) {
    const response = await raw(metadata, Buffer.from(sample)); assert.ok(response.error); assert.doesNotMatch(JSON.stringify(response), /private-secret|C:\\\\private/); assert.equal(JSON.stringify(response).includes(metadata.token), false);
  }
  const invalidUTF8 = Buffer.from([0xff, 0x0a]); assert.equal((await raw(metadata, invalidUTF8)).error.code, 'INVALID');
  assert.equal(called, 0);
});

test('oversized requests and non-JSON handler output fail without leaking native error details', async t => {
  const f = await fixture(t, async (_method, args) => {
    if (args.text === 'throw') throw new Error('private-user-profile-and-api-key');
    if (args.text === 'large') return { text: 'x'.repeat(MAX_BRIDGE_BYTES) };
    if (args.text === 'bigint') return { value: 1n };
    return undefined;
  }), metadata = await f.metadata();
  const oversized = await raw(metadata, Buffer.alloc(MAX_BRIDGE_BYTES + 1, 120)); assert.equal(oversized.error.code, 'INVALID');
  for (const text of ['throw', 'large', 'bigint', 'undefined']) await assert.rejects(f.call({ method: 'speak', args: { text } }), error => error instanceof BridgeError && error.code === 'FAILED' && !/private-user-profile|api-key/.test(error.message));
});

test('client rejects forged metadata before connecting to another host, protocol or local path', async t => {
  const f = await fixture(t), metadata = await f.metadata(), filename = path.join(f.directory, 'ultron-bridge.json');
  for (const pipe of ['http://127.0.0.1:47833/', '127.0.0.1:9000', '\\\\other-host\\pipe\\gleyson-jarvis-' + 'a'.repeat(32), '\\\\.\\pipe\\other-application', path.join(f.directory, '..', 'other.sock')]) {
    await fs.writeFile(filename, JSON.stringify({ ...metadata, pipe }));
    await assert.rejects(f.call({ method: 'status' }), error => error.code === 'INVALID');
  }
  await fs.writeFile(filename, JSON.stringify({ ...metadata, version: 9 }));
  await assert.rejects(f.call({ method: 'status' }), error => error.code === 'INVALID');
  await fs.writeFile(filename, JSON.stringify({ ...metadata, extra: true }));
  await assert.rejects(f.call({ method: 'status' }), error => error.code === 'INVALID');
  await fs.writeFile(filename, JSON.stringify(metadata));
});

test('client validates closed argument schemas, speech size and request IDs without native effects', async t => {
  let called = 0; const f = await fixture(t, async () => { called++; return {}; });
  const invalid = [
    { method: 'browser_open', args: { url: 'https://example.org' } }, { method: 'status', args: { profileId: 'other' } },
    { method: 'weather', args: { city: 'other' } }, { method: 'open_browser', args: { url: 'https://example.org' } },
    { method: 'open_url', args: {} }, { method: 'open_url', args: { url: 'example.org', command: 'open' } },
    { method: 'speak', args: { text: '' } }, { method: 'speak', args: { text: 'x'.repeat(601) } },
    { method: 'speak', args: { text: 'hello', voice: 'other' } }, { method: 'speak', args: { text: 'private\0text' } },
    { method: 'status', args: [] }, { method: 'status', requestId: 'bad id' },
  ];
  for (const input of invalid) await assert.rejects(f.call(input), error => error.code === 'INVALID');
  assert.equal(called, 0);
});

test('website normalization preserves the requested HTTP destination and adds HTTPS only when omitted', () => {
  const allowed = new Map([
    ['para-meditacao-app.com', 'https://para-meditacao-app.com/'],
    ['EXAMPLE.org/path?q=one%20two#section', 'https://example.org/path?q=one%20two#section'],
    ['http://example.org:8080/path', 'http://example.org:8080/path'],
    ['example.org:8080/path', 'https://example.org:8080/path'],
    ['https://example.org/', 'https://example.org/'],
    ['//example.org/path', 'https://example.org/path'],
    ['http://127.0.0.1:8080/', 'http://127.0.0.1:8080/'],
    ['https://[::1]/', 'https://[::1]/'],
  ]);
  for (const [input, expected] of allowed) assert.equal(normalizeWebsiteUrl(input), expected);
});

test('website requests reject dangerous schemes, credentials, invalid hosts, controls and extra arguments before dispatch', async t => {
  let opened = 0; const f = await fixture(t, async () => { opened++; return {}; }), metadata = await f.metadata();
  const denied = [
    '', null, 123, 'javascript:alert(1)', 'file:///C:/secret.txt', 'data:text/html,private', 'ftp://example.org/',
    'https:/example.org', 'C:\\Windows\\system32', 'https://user:password@example.org/', 'https://@example.org/',
    'https://exa mple.org/', ' https://example.org', 'https://example.org/\nprivate', 'https://example.org/\tprivate',
    'https://example.org/\u007fprivate', 'https://example.org/\u00a0private', 'https://example..org/',
    'https://-bad.example.org/', 'https://bad_.example.org/', 'https://./', 'https:///', 'x'.repeat(2049),
    'https://example.org/' + 'é'.repeat(1000),
  ];
  for (const url of denied) {
    assert.throws(() => normalizeWebsiteUrl(url), error => error.code === 'INVALID');
    await assert.rejects(f.call({ method: 'open_url', args: { url } }), error => error.code === 'INVALID');
    const reply = await raw(metadata, Buffer.from(JSON.stringify(request(metadata, { method: 'open_url', args: { url } })) + '\n'));
    assert.equal(reply.error.code, 'INVALID');
  }
  assert.equal(opened, 0);
});

test('website destinations are canonical before handling and share immutable ID replay protection', async t => {
  const seen = []; const f = await fixture(t, async (method, args) => { seen.push({ method, args }); return { dispatched: true, verified: false, url: args.url }; });
  const result = await f.call({ method: 'open_url', args: { url: 'para-meditacao-app.com' }, requestId: 'one-specific-website' });
  assert.equal(result.url, 'https://para-meditacao-app.com/');
  assert.deepEqual(await f.call({ method: 'open_url', args: { url: 'https://para-meditacao-app.com/' }, requestId: 'one-specific-website' }), result);
  await assert.rejects(f.call({ method: 'open_url', args: { url: 'https://other.example/' }, requestId: 'one-specific-website' }), error => error.code === 'INVALID');
  assert.deepEqual(seen, [{ method: 'open_url', args: { url: 'https://para-meditacao-app.com/' } }]);
});

test('same ID shares one running effect and replays its detached result without a second dispatch', async t => {
  const waiting = deferred(), result = { dispatched: true, nested: { value: 'original' } }; let called = 0;
  const f = await fixture(t, async () => { called++; await waiting.promise; return result; });
  const options = { method: 'open_browser', requestId: 'one-browser-effect' };
  const first = f.call(options), second = f.call(options); await until(() => called === 1);
  waiting.resolve(); assert.deepEqual(await first, result); assert.deepEqual(await second, result);
  result.nested.value = 'changed';
  assert.equal((await f.call(options)).nested.value, 'original'); assert.equal(called, 1);
  await assert.rejects(f.call({ ...options, method: 'status' }), error => error.code === 'INVALID'); assert.equal(called, 1);
});

test('bridge admits at most four handler calls and a busy fifth never starts or retries automatically', async t => {
  const waiting = deferred(); let started = 0;
  const f = await fixture(t, async () => { started++; await waiting.promise; return {}; });
  const pending = Array.from({ length: 4 }, () => f.call({ method: 'status' })); await until(() => started === 4);
  await assert.rejects(f.call({ method: 'status' }), error => error.code === 'BUSY'); assert.equal(started, 4);
  waiting.resolve(); await Promise.all(pending);
});

test('client abort closes its socket and cancels the handler while suppressing late results', async t => {
  const waiting = deferred(); let signal, calls = 0;
  const f = await fixture(t, async (_method, _args, context) => { calls++; signal = context.signal; await waiting.promise; return { late: true }; });
  const before = new AbortController(); before.abort(); await assert.rejects(f.call({ method: 'status', signal: before.signal }), error => error.code === 'CANCELLED'); assert.equal(calls, 0);
  const controller = new AbortController(), pending = f.call({ method: 'status', signal: controller.signal, requestId: 'cancelled-correlation' }); await until(() => signal);
  controller.abort(); await assert.rejects(pending, error => error.code === 'CANCELLED'); await until(() => signal.aborted);
  await assert.rejects(f.call({ method: 'status', requestId: 'cancelled-correlation' }), error => error.code === 'CANCELLED'); assert.equal(calls, 1);
  waiting.resolve(); await flush(); assert.equal(calls, 1);
});

test('raw caller disconnect aborts work and shutdown does not wait for a handler ignoring cancellation', async t => {
  const waiting = deferred(); let signal;
  const f = await fixture(t, async (_method, _args, context) => { signal = context.signal; await waiting.promise; return {}; }), metadata = await f.metadata();
  const socket = net.createConnection({ path: metadata.pipe }); socket.on('error', () => {});
  await new Promise(resolve => socket.once('connect', resolve)); socket.write(JSON.stringify(request(metadata)) + '\n');
  await until(() => signal); socket.destroy(); await until(() => signal.aborted);
  await f.broker.close(); await assert.rejects(fs.access(path.join(f.directory, 'ultron-bridge.json')));
  waiting.resolve(); await flush();
});

test('rotating profile bridges invalidate old tokens and old close cannot remove the new metadata', async t => {
  const f = await fixture(t), first = await f.metadata();
  const newer = await f.start(async () => ({ profile: 'new' })), second = await f.metadata();
  assert.notEqual(first.pipe, second.pipe); assert.notEqual(first.token, second.token);
  const forged = request(second, { token: first.token }); assert.equal((await raw(second, Buffer.from(JSON.stringify(forged) + '\n'))).error.code, 'AUTH');
  await f.broker.close(); assert.deepEqual(await f.metadata(), second); assert.deepEqual(await f.call({ method: 'status' }), { profile: 'new' });
  await newer.close(); await assert.rejects(f.call({ method: 'status' }), error => error.code === 'NOT_RUNNING');
});

test('concurrent profile close and replacement publication always retain the newest discovery file', async t => {
  const f = await fixture(t); let current = f.broker;
  for (let generation = 1; generation <= 5; generation++) {
    const [next] = await Promise.all([f.start(async () => ({ generation })), current.close()]);
    assert.deepEqual(await f.call({ method: 'status' }), { generation }); current = next;
  }
});

test('profile shutdown cancels every in-flight call and repeated close is idempotent', async t => {
  const waiting = deferred(), signals = [];
  const f = await fixture(t, async (_method, _args, { signal }) => { signals.push(signal); await waiting.promise; return { late: true }; });
  const pending = [f.call({ method: 'speak', args: { text: 'test' } }), f.call({ method: 'weather' })];
  const settled = Promise.allSettled(pending); await until(() => signals.length === 2);
  const first = f.broker.close(); assert.equal(f.broker.close(), first); await first;
  assert.equal(signals.every(signal => signal.aborted), true);
  assert.equal((await settled).every(result => result.status === 'rejected'), true);
  waiting.resolve(); await flush();
});
