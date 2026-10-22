import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { createRuntime, normalizeBrowserUrl } from '../packages/runtime/index.mjs';
import { OpenAIService } from '../packages/openai/index.mjs';

const TARGET = 'https://para-meditacao-app.com/';
const request = (args = { url: 'para-meditacao-app.com' }, extra = {}) => ({ id: crypto.randomUUID(), name: 'browser_open', args, ...extra });
const tick = () => new Promise(resolve => setImmediate(resolve));
async function fixture(t, platformAdapters) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-url-request-'));
  const workspaceRoot = path.join(directory, 'workspace'); await fs.mkdir(workspaceRoot);
  const events = []; const runtime = createRuntime({ dataDir: path.join(directory, 'private'), workspaceRoot, platformAdapters, onEvent: event => events.push(event) });
  t.after(async () => { await runtime.close(); await fs.rm(directory, { recursive: true, force: true }); });
  return { runtime, events };
}

test('navigation normalizes explicit bare domains to HTTPS without turning them into searches', () => {
  assert.equal(normalizeBrowserUrl('para-meditacao-app.com'), TARGET);
  assert.equal(normalizeBrowserUrl('WWW.Example.COM/a?b=c#section'), 'https://www.example.com/a?b=c#section');
  assert.equal(normalizeBrowserUrl('http://localhost:8000/test'), 'http://localhost:8000/test');
  assert.equal(normalizeBrowserUrl('https://example.com/áudio'), 'https://example.com/%C3%A1udio');
  assert.throws(() => normalizeBrowserUrl('example.com', { allowBareDomain: false }));
});

test('navigation rejects scripts, protocol handlers, file paths, credentials and ambiguous command text', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'file:///C:/secret.txt', 'ms-settings:', 'mailto:test@example.com', 'https://user:password@example.com', 'user@example.com', '//example.com', 'https:example.com', 'C:\\apps\\browser.exe', 'example.com\\evil', 'example.com && calc', 'example.com\n', 'example.com\0', 'abra o site', 'localhost', '', 'a'.repeat(2049), null, {}]) assert.throws(() => normalizeBrowserUrl(value), String(value));
});

test('the exact requested website opens once, without default-page fallback or an extra approval', async t => {
  const urls = []; let defaults = 0, reads = 0;
  const f = await fixture(t, { openBrowser: async (url, options) => { assert(options.signal instanceof AbortSignal); urls.push(url); return { verified: true, url }; },
    openDefaultBrowser: async () => { defaults++; }, readWebsite: async () => { reads++; } });
  const input = request(); const pending = f.runtime.call(input), duplicate = f.runtime.call(input);
  assert.equal(pending, duplicate); input.args.url = 'https://other.example/';
  const result = await pending; assert.equal(result.status, 'verified'); assert.equal(result.data.url, TARGET);
  assert.deepEqual(urls, [TARGET]); assert.equal(defaults, 0); assert.equal(reads, 0);
  assert.equal(f.events.some(event => event.type === 'approval' || event.state === 'awaiting_approval'), false);
  assert.deepEqual(await f.runtime.call({ ...input, args: { url: TARGET } }), result); assert.deepEqual(urls, [TARGET]);
  assert.equal((await f.runtime.call(input)).status, 'failed'); assert.deepEqual(urls, [TARGET]);
});

test('browser navigation cannot carry form data, executable arguments or another tool request', async t => {
  let opened = 0; const f = await fixture(t, { openBrowser: async () => { opened++; return { verified: true }; } });
  for (const args of [{ url: TARGET, body: 'password=value' }, { url: TARGET, method: 'POST' }, { url: TARGET, args: ['--exec'] }, { url: TARGET, read: true }, { url: 'file:///C:/secret' }]) assert.equal((await f.runtime.call(request(args))).status, 'failed');
  assert.equal(opened, 0); assert.equal(f.events.length, 0);
});

test('website reading and other native actions retain approval after navigation is allowed', async t => {
  let reads = 0, opened = 0;
  const f = await fixture(t, { readWebsite: async () => { reads++; }, openApp: async () => { opened++; } });
  for (const [name, args] of [['web_read', { url: TARGET }], ['apps_open', { appId: 'notepad' }]]) {
    const pending = f.runtime.call(request(args, { name }));
    for (let i = 0; i < 100 && !f.events.some(event => event.type === 'approval' && event.tool === name); i++) await tick();
    const approval = f.events.find(event => event.type === 'approval' && event.tool === name); assert(approval);
    f.runtime.approve(approval.approvalId, false); assert.equal((await pending).status, 'cancelled');
  }
  assert.equal(reads, 0); assert.equal(opened, 0);
});

test('cancelled and unacknowledged URL dispatches never become verified success', async t => {
  let finish; const f = await fixture(t, { openBrowser: () => new Promise(resolve => { finish = resolve; }) });
  const pending = f.runtime.call(request(undefined, { runId: 'cancel-url' }));
  for (let i = 0; i < 100 && !finish; i++) await tick(); assert.equal(typeof finish, 'function');
  f.runtime.cancel('cancel-url'); finish({ verified: true, url: TARGET });
  assert.equal((await pending).status, 'cancelled'); assert.equal(f.events.some(event => event.type === 'action'), false);
  const acknowledged = await fixture(t, { openBrowser: async () => ({ dispatched: true, verified: false }) });
  const dispatched = await acknowledged.runtime.call(request()); assert.equal(dispatched.ok, true); assert.equal(dispatched.status, 'unverified'); assert.equal(dispatched.data.url, TARGET);
  const missing = await fixture(t, { openBrowser: async () => ({ opened: true }) });
  assert.equal((await missing.runtime.call(request())).status, 'failed');
});

function response(output) {
  return new Response(`event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output } })}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
}

test('text and realtime tools share the same exact-domain navigation without opening Google or waiting for approval', async t => {
  const urls = [], bodies = [];
  const f = await fixture(t, { openBrowser: async url => { urls.push(url); return { verified: true, url }; } });
  const responses = [response([{ type: 'function_call', call_id: 'requested-site-text', name: 'browser_open', arguments: JSON.stringify({ url: 'para-meditacao-app.com' }) }]),
    response([{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Site aberto, senhor.' }] }])];
  const service = new OpenAIService({ getKey: () => 'mock-not-a-real-key', getSettings: () => ({}), runtime: f.runtime,
    fetch: async (_url, init) => { bodies.push(JSON.parse(init.body)); assert(responses.length); return responses.shift(); } });
  assert.equal((await service.respond({ text: 'Jarvis acesse para-meditacao-app.com', runId: 'requested-site-run' })).text, 'Site aberto, senhor.');
  assert.equal((await service.executeRealtimeTool({ id: 'requested-site-voice', name: 'browser_open', args: { url: TARGET }, runId: 'requested-site-realtime' })).status, 'verified');
  assert.deepEqual(urls, [TARGET, TARGET]); assert.equal(f.events.some(event => event.type === 'approval'), false);
  assert.equal(bodies[0].input.at(-1).content, 'Jarvis acesse para-meditacao-app.com');
  const toolResult = JSON.parse(bodies[1].input.at(-1).output); assert.equal(toolResult.data.url, TARGET);
});
