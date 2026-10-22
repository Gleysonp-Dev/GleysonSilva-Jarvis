import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUltronBridge } from '../packages/ultron/index.mjs';

const serverPath = fileURLToPath(new URL('../plugins/jarvis-ultron/server.mjs', import.meta.url));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const deadline = (promise, message = 'MCP response timed out', timeout = 4000) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeout); })])
    .finally(() => clearTimeout(timer));
};
const key = id => JSON.stringify([typeof id, id]);

async function fixture(t, handle = async method => ({ available: true, operation: method }), { bridge = true } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-mcp-'));
  const dataDir = path.join(directory, 'Projeto GleysonSilva-Jarvis');
  const broker = bridge ? await createUltronBridge({ dataDir, handle }) : null;
  const child = spawn(process.execPath, [serverPath], { cwd: path.dirname(serverPath), windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, APPDATA: directory } });
  const exited = once(child, 'exit');
  let output = '', remainder = '', stderr = '', readFailure;
  const messages = [], waiting = [];
  child.stderr.on('data', value => { stderr += value.toString(); });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', value => {
    output += value; remainder += value;
    let end;
    while ((end = remainder.indexOf('\n')) !== -1) {
      const raw = remainder.slice(0, end); remainder = remainder.slice(end + 1);
      let message;
      try { message = JSON.parse(raw); }
      catch (error) { readFailure = error; for (const waiter of waiting.splice(0)) waiter.reject(error); continue; }
      messages.push(message);
      for (let index = waiting.length - 1; index >= 0; index--) {
        const waiter = waiting[index];
        if (waiter.predicate(message)) { waiting.splice(index, 1); waiter.resolve(message); }
      }
    }
  });
  child.stdin.on('error', () => {});
  const send = (id, method, params) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...(id === undefined ? {} : { id }), method, ...(params === undefined ? {} : { params }) })}\n`);
  function wait(predicate) {
    if (readFailure) return Promise.reject(readFailure);
    const found = messages.find(predicate); if (found) return Promise.resolve(found);
    return deadline(new Promise((resolve, reject) => waiting.push({ predicate, resolve, reject })), `MCP response timed out. stderr: ${stderr}`);
  }
  const response = id => wait(message => own(message, 'id') && key(message.id) === key(id));
  const own = (value, property) => Object.prototype.hasOwnProperty.call(value, property);
  async function initialize(protocolVersion = '2025-06-18') {
    send('init', 'initialize', { protocolVersion, capabilities: {}, clientInfo: { name: 'Jarvis protocol test', version: '1.0' } });
    const reply = await response('init');
    send(undefined, 'notifications/initialized');
    return reply;
  }
  t.after(async () => {
    child.stdin.end();
    try { await deadline(exited, 'MCP child did not exit after EOF', 2000); }
    catch { child.kill(); await deadline(exited, 'MCP child did not terminate', 2000).catch(() => {}); }
    await broker?.close();
    await fs.rm(directory, { recursive: true, force: true });
  });
  return { child, exited, send, response, wait, initialize, messages, raw: data => child.stdin.write(data),
    get output() { return output; }, get stderr() { return stderr; } };
}

test('standalone MCP negotiates current, compatible and unknown protocol versions without stdout logs', async t => {
  for (const requested of ['2025-06-18', '2025-03-26', '2024-11-05', '2099-01-01']) {
    await t.test(requested, async t => {
      const f = await fixture(t, undefined, { bridge: false });
      const initialized = await f.initialize(requested);
      assert.equal(initialized.result.protocolVersion, requested === '2099-01-01' ? '2025-06-18' : requested);
      assert.deepEqual(initialized.result.capabilities, { tools: { listChanged: false } });
      f.send('ping', 'ping'); assert.deepEqual((await f.response('ping')).result, {});
      f.send('meta', 'ping', { _meta: { 'test/progress': 1 } }); assert.deepEqual((await f.response('meta')).result, {});
      for (const line of f.output.trim().split('\n')) assert.equal(JSON.parse(line).jsonrpc, '2.0');
      assert.equal(f.stderr, '');
    });
  }
});

test('MCP requires initialization and initialized notification before tool discovery or calls', async t => {
  let handled = 0; const f = await fixture(t, async () => { handled++; return {}; });
  f.send(1, 'tools/list'); assert.equal((await f.response(1)).error.code, -32002);
  f.send(2, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.ok((await f.response(2)).result);
  f.send(3, 'tools/call', { name: 'jarvis_status', arguments: {} }); assert.equal((await f.response(3)).error.code, -32002);
  f.send(undefined, 'notifications/initialized');
  f.send(4, 'tools/list'); assert.equal((await f.response(4)).result.tools.length, 5);
  f.send(5, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });
  assert.equal((await f.response(5)).error.code, -32600); assert.equal(handled, 0);
});

test('MCP exposes exactly five closed tools and accurate read-only annotations', async t => {
  const f = await fixture(t, undefined, { bridge: false }); await f.initialize();
  f.send(1, 'tools/list'); const tools = (await f.response(1)).result.tools;
  assert.deepEqual(tools.map(tool => tool.name), ['jarvis_status', 'jarvis_weather', 'jarvis_open_browser', 'jarvis_open_website', 'jarvis_speak']);
  assert.deepEqual(tools.map(tool => tool.annotations.readOnlyHint), [true, true, false, false, false]);
  for (const tool of tools) { assert.equal(tool.inputSchema.type, 'object'); assert.equal(tool.inputSchema.additionalProperties, false); }
  assert.deepEqual(tools[3].inputSchema.required, ['url']);
  assert.equal(tools[3].inputSchema.properties.url.minLength, 1); assert.equal(tools[3].inputSchema.properties.url.maxLength, 2048);
  assert.equal(tools[3].annotations.idempotentHint, false); assert.equal(tools[3].annotations.openWorldHint, true);
  assert.deepEqual(tools[4].inputSchema.required, ['text']);
  assert.equal(tools[4].inputSchema.properties.text.minLength, 1); assert.equal(tools[4].inputSchema.properties.text.maxLength, 600);
  f.send(2, 'tools/list', { cursor: 'not-supported' }); assert.equal((await f.response(2)).error.code, -32602);
});

test('MCP calls the private broker for each supported operation with exact arguments and opaque IDs', async t => {
  const calls = []; const f = await fixture(t, async (method, args, { id }) => { calls.push({ method, args, id }); return { operation: method, accepted: true }; });
  await f.initialize();
  const names = ['jarvis_status', 'jarvis_weather', 'jarvis_open_browser', 'jarvis_open_website', 'jarvis_speak'];
  for (let index = 0; index < names.length; index++) {
    const args = index === 4 ? { text: 'Olá, senhor. Esta é uma narração solicitada.' }
      : index === 3 ? { url: 'example.com/news' } : {};
    f.send(index + 1, 'tools/call', { name: names[index], arguments: args });
    const reply = await f.response(index + 1); assert.equal(reply.result.isError, undefined);
    assert.deepEqual(JSON.parse(reply.result.content[0].text), reply.result.structuredContent);
    assert.deepEqual(calls[index].args, index === 3 ? { url: 'https://example.com/news' } : args);
    assert.match(calls[index].id, /^[A-Za-z0-9_-]{1,128}$/);
  }
  assert.deepEqual(calls.map(call => call.method), ['status', 'weather', 'open_browser', 'open_url', 'speak']);
  assert.equal(new Set(calls.map(call => call.id)).size, 5);
});

test('MCP rejects unknown tools, extra arguments, null and malformed speech before reaching Jarvis', async t => {
  let handled = 0; const f = await fixture(t, async () => { handled++; return {}; }); await f.initialize();
  const invalid = [
    { name: 'unrestricted_shell', arguments: {} },
    { name: 'jarvis_status', arguments: { path: 'private' } },
    { name: 'jarvis_weather', arguments: { city: 'elsewhere' } },
    { name: 'jarvis_open_browser', arguments: { url: 'https://example.com' } },
    { name: 'jarvis_open_website', arguments: { url: 'example.com', command: 'free shell' } },
    { name: 'jarvis_speak', arguments: { text: '', voice: 'other' } },
    ...[undefined, '', '  ', 'x'.repeat(601), 'bad\u0000text', 123, null].map(text => ({ name: 'jarvis_speak', arguments: { text } })),
    { name: 'jarvis_status', arguments: null }, { name: 'jarvis_status', arguments: [] },
    { name: 'jarvis_speak', arguments: { text: 'ok' }, arbitrary: true },
  ];
  for (let index = 0; index < invalid.length; index++) {
    f.send(index + 1, 'tools/call', invalid[index]); assert.equal((await f.response(index + 1)).error.code, -32602);
  }
  assert.equal(handled, 0);
});

test('MCP rejects invalid website addresses before they reach the private backend', async t => {
  let handled = 0; const f = await fixture(t, async () => { handled++; return {}; }); await f.initialize();
  const addresses = ['', ' ', null, 42, 'x'.repeat(2049), 'file:///C:/Windows', 'javascript:alert(1)',
    'ftp://example.com/', 'https://user:password@example.com/', 'https://example.com/a b',
    'https://example.com/\nnext', 'https://', 'https://bad host/', 'https://example.com:invalid/'];
  for (let index = 0; index < addresses.length; index++) {
    f.send(index + 1, 'tools/call', { name: 'jarvis_open_website', arguments: { url: addresses[index] } });
    assert.equal((await f.response(index + 1)).error.code, -32602);
  }
  f.send('missing', 'tools/call', { name: 'jarvis_open_website', arguments: {} });
  assert.equal((await f.response('missing')).error.code, -32602); assert.equal(handled, 0);
});

test('MCP returns normal isError tool results for absent Jarvis and redacts bridge failures', async t => {
  const absent = await fixture(t, undefined, { bridge: false }); await absent.initialize();
  absent.send(1, 'tools/call', { name: 'jarvis_status', arguments: {} });
  const failure = (await absent.response(1)).result;
  assert.equal(failure.isError, true); assert.equal(JSON.parse(failure.content[0].text).code, 'NOT_RUNNING');
  const broken = await fixture(t, async () => { throw new Error('private-token-private-path-C:/Users/person'); }); await broken.initialize();
  broken.send(1, 'tools/call', { name: 'jarvis_speak', arguments: { text: 'Frase solicitada.' } });
  const reply = await broken.response(1); assert.equal(reply.result.isError, true);
  assert.equal(JSON.parse(reply.result.content[0].text).code, 'FAILED');
  assert.doesNotMatch(broken.output + broken.stderr, /private-token|private-path|C:\/Users\/person/);
});

test('MCP bounds the final output frame and never echoes an oversized duplicated tool result', async t => {
  const detail = 'private-oversized-broker-detail-';
  const f = await fixture(t, async () => ({ detail: detail + 'x'.repeat(40 * 1024) })); await f.initialize();
  f.send(1, 'tools/call', { name: 'jarvis_status', arguments: {} });
  const reply = await f.response(1);
  assert.equal(reply.result.isError, true); assert.equal(JSON.parse(reply.result.content[0].text).code, 'FAILED');
  assert.equal(reply.result.structuredContent, undefined); assert.doesNotMatch(f.output + f.stderr, /private-oversized-broker-detail/);
  // Even a large caller ID must not expand a static response beyond the transport bound.
  f.send('L'.repeat(65_000), 'tools/list');
  await f.wait(message => message.id === null && message.error?.code === -32603);
  f.send('after', 'ping'); assert.deepEqual((await f.response('after')).result, {});
  for (const line of f.output.trimEnd().split('\n')) assert.ok(Buffer.byteLength(`${line}\n`, 'utf8') <= 64 * 1024);
});

test('MCP parses fragmented UTF-8 lines, reports malformed requests, and recovers after a 64 KiB line', async t => {
  const received = []; const f = await fixture(t, async (_method, args) => { received.push(args); return { ok: true }; }); await f.initialize();
  const encoded = Buffer.from(`${JSON.stringify({ jsonrpc: '2.0', id: 'utf8', method: 'tools/call', params: { name: 'jarvis_speak', arguments: { text: 'Ação, café e céu.' } } })}\r\n`);
  const split = encoded.indexOf(Buffer.from('ç')) + 1; f.raw(encoded.subarray(0, split)); f.raw(encoded.subarray(split));
  assert.ok((await f.response('utf8')).result); assert.equal(received[0].text, 'Ação, café e céu.');
  f.raw(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d, 0x0a]));
  await f.wait(message => message.error?.code === -32700);
  f.raw('{no JSON}\n'); f.raw('[]\n'); f.raw('{"jsonrpc":"2.0","id":null,"method":"ping"}\n');
  f.raw(`${'x'.repeat(65537)}\n`); f.send('after', 'ping');
  assert.deepEqual((await f.response('after')).result, {});
  assert.ok(f.messages.filter(message => message.error?.code === -32700).length >= 3);
  assert.ok(f.messages.filter(message => message.error?.code === -32600).length >= 2);
  f.send('unknown', 'unrecognized/method'); assert.equal((await f.response('unknown')).error.code, -32601);
  f.raw('{"jsonrpc":"2.0","id":"badparams","method":"ping","params":123}\n');
  f.send('barrier', 'ping'); await f.response('barrier');
  assert.equal(f.messages.some(message => message.id === 'badparams'), false);
  assert.ok(f.messages.filter(message => message.error?.code === -32600).length >= 3);
});

test('MCP bounds concurrent bridge calls at four without starting a fifth effect', async t => {
  const gates = Array.from({ length: 4 }, deferred), arrived = deferred(); let count = 0;
  const f = await fixture(t, async () => { const index = count++; if (count === 4) arrived.resolve(); await gates[index].promise; return { completed: index }; }); await f.initialize();
  for (let id = 1; id <= 4; id++) f.send(id, 'tools/call', { name: 'jarvis_status', arguments: {} });
  await deadline(arrived.promise); f.send(5, 'tools/call', { name: 'jarvis_open_browser', arguments: {} });
  const busy = (await f.response(5)).result; assert.equal(busy.isError, true); assert.equal(JSON.parse(busy.content[0].text).code, 'BUSY'); assert.equal(count, 4);
  gates.forEach(gate => gate.resolve());
  for (let id = 1; id <= 4; id++) assert.ok((await f.response(id)).result);
});

test('MCP cancellation distinguishes numeric and string IDs and suppresses cancelled replies', async t => {
  const first = deferred(), second = deferred(), aborted = deferred(); const gates = [deferred(), deferred()]; let count = 0;
  const f = await fixture(t, async (_method, _args, { signal }) => {
    const index = count++; signal.addEventListener('abort', () => { aborted.resolve(index); gates[index].resolve(); }, { once: true });
    (index === 0 ? first : second).resolve(); await gates[index].promise; return { completed: index };
  }); await f.initialize();
  f.send(1, 'tools/call', { name: 'jarvis_status', arguments: {} }); await deadline(first.promise);
  f.send('1', 'tools/call', { name: 'jarvis_status', arguments: {} }); await deadline(second.promise);
  f.send(undefined, 'notifications/cancelled', { requestId: 1, reason: 'User stopped the request' });
  assert.equal(await deadline(aborted.promise), 0); gates[1].resolve();
  assert.deepEqual((await f.response('1')).result.structuredContent, { completed: 1 });
  f.send('barrier', 'ping'); await f.response('barrier');
  assert.equal(f.messages.some(message => message.id === 1), false); assert.equal(count, 2);
});

test('MCP duplicate pending IDs are rejected without duplicating a private operation', async t => {
  const arrived = deferred(), aborted = deferred(); let count = 0;
  const f = await fixture(t, async (_method, _args, { signal }) => { count++; arrived.resolve(); await new Promise(resolve => signal.addEventListener('abort', () => { aborted.resolve(); resolve(); }, { once: true })); return {}; });
  await f.initialize(); f.send(1, 'tools/call', { name: 'jarvis_status', arguments: {} }); await deadline(arrived.promise);
  f.send(1, 'tools/call', { name: 'jarvis_open_browser', arguments: {} }); assert.equal((await f.response(1)).error.code, -32600); assert.equal(count, 1);
  f.send(undefined, 'notifications/cancelled', { requestId: 1 }); await deadline(aborted.promise);
});

for (const termination of ['EOF', 'SIGTERM']) {
  test(`MCP ${termination} closes pending bridge work without late protocol responses`, async t => {
    const arrived = deferred(), aborted = deferred();
    const f = await fixture(t, async (_method, _args, { signal }) => {
      arrived.resolve(); await new Promise(resolve => signal.addEventListener('abort', () => { aborted.resolve(); resolve(); }, { once: true })); return { private: 'late' };
    });
    await f.initialize(); f.send(1, 'tools/call', { name: 'jarvis_status', arguments: {} }); await deadline(arrived.promise);
    if (termination === 'EOF') f.child.stdin.end(); else f.child.kill('SIGTERM');
    await deadline(aborted.promise); await deadline(f.exited);
    assert.equal(f.messages.some(message => message.id === 1), false); assert.doesNotMatch(f.output, /late/);
  });
}
