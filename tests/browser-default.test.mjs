import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { createWindowsAdapters } from '../apps/desktop/platform/windows.mjs';
import { createRuntime } from '../packages/runtime/index.mjs';

const URL = 'https://www.google.com/';
const call = (extra = {}) => ({ id: crypto.randomUUID(), name: 'apps_open', args: { appId: 'browser' }, ...extra });
const flush = () => new Promise(resolve => setImmediate(resolve));

function adapters(openExternal, extra = {}) {
  return createWindowsAdapters({ platform: 'win32',
    getApps: () => { throw new Error('Application registration must not be consulted.'); },
    spawnImpl: () => { throw new Error('A browser must not launch through a command line.'); },
    fsImpl: { access: () => { throw new Error('No executable lookup is needed.'); } },
    openExternal, ...extra });
}

async function fixture(t, platformAdapters, allow = null) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-default-browser-'));
  const workspaceRoot = path.join(directory, 'workspace'); await fs.mkdir(workspaceRoot);
  const events = []; let runtime;
  runtime = createRuntime({ dataDir: path.join(directory, 'private'), workspaceRoot, platformAdapters,
    onEvent(event) { events.push(event); if (event.type === 'approval' && allow !== null) queueMicrotask(() => runtime.approve(event.approvalId, allow)); } });
  t.after(async () => { await runtime.close(); await fs.rm(directory, { recursive: true, force: true }); });
  return { runtime, events };
}

async function approval(f) {
  for (let i = 0; i < 100; i++) { const entry = f.events.find(event => event.type === 'approval'); if (entry) return entry; await flush(); }
  throw new Error('Approval not emitted');
}

test('default browser resolves the Windows HTTP handler without any configured executable or command line', async () => {
  const urls = []; const native = adapters(async url => { urls.push(url); });
  const result = await native.openDefaultBrowser();
  assert.deepEqual(urls, [URL]); assert.equal(result.dispatched, true); assert.equal(result.verified, false); assert.equal(result.url, URL);
  assert.equal((await native.openApp('browser')).dispatched, true);
  assert.deepEqual(urls, [URL, URL]);
});

test('browser opening redacts OS errors and refuses missing integration or unsupported platform', async () => {
  await assert.rejects(adapters(async () => { throw new Error('private-Windows-user-profile-detail'); }).openDefaultBrowser(), error => /não conseguiu encaminhar/.test(error.message) && !error.message.includes('private-Windows'));
  await assert.rejects(adapters(undefined).openDefaultBrowser(), /não está disponível/);
  let calls = 0; await assert.rejects(adapters(async () => { calls++; }, { platform: 'linux' }).openDefaultBrowser(), /exige Windows/);
  assert.equal(calls, 0);
});

test('default browser respects cancellation before dispatch and never reports late success', async () => {
  let calls = 0; const before = new AbortController(); before.abort();
  await assert.rejects(adapters(async () => { calls++; }).openDefaultBrowser({ signal: before.signal }), /cancelada/); assert.equal(calls, 0);
  let release; const during = new AbortController();
  const pending = adapters(() => { calls++; return new Promise(resolve => { release = resolve; }); }).openDefaultBrowser({ signal: during.signal });
  during.abort(); release(); await assert.rejects(pending, /cancelada/); assert.equal(calls, 1);
});

test('explicit default browser requests dispatch once without approval and retain immutable call IDs', async t => {
  const urls = [], native = adapters(async url => { urls.push(url); });
  const f = await fixture(t, { ...native, openApp: async () => { throw new Error('Aplicativo não cadastrado.'); } });
  const request = call(); const pending = f.runtime.call(request), duplicate = f.runtime.call(request);
  assert.equal(pending, duplicate); assert.equal(urls.length, 0);
  request.args.appId = 'calculator';
  const result = await pending; assert.equal(result.status, 'unverified'); assert.equal(result.ok, true); assert.equal(result.data.dispatched, true);
  assert.deepEqual(urls, [URL]); assert.equal(f.events.some(event => event.type === 'approval' || event.state === 'awaiting_approval'), false);
  assert.deepEqual(await f.runtime.call({ ...request, args: { appId: 'browser' } }), result); assert.deepEqual(urls, [URL]);
  assert.equal((await f.runtime.call(request)).status, 'failed');
  assert.equal(f.runtime.approve(crypto.randomUUID(), false), false);
});

test('default browser has no approval to deny and an already cancelled request cannot open it', async t => {
  let opened = 0; const native = adapters(async () => { opened++; });
  const noApproval = await fixture(t, native, false);
  assert.equal((await noApproval.runtime.call(call())).status, 'unverified'); assert.equal(opened, 1);
  assert.equal(noApproval.events.some(event => event.type === 'approval'), false);
  const cancelled = await fixture(t, native); const controller = new AbortController(); controller.abort();
  assert.equal((await cancelled.runtime.call(call(), { signal: controller.signal })).status, 'cancelled');
  assert.equal(cancelled.runtime.approve(crypto.randomUUID(), true), false); assert.equal(opened, 1);
  assert.equal(cancelled.events.some(event => event.type === 'approval'), false);
});

test('default browser interrupted after dispatch remains cancelled, and lack of OS acknowledgement stays failed', async t => {
  let finish; const f = await fixture(t, { openDefaultBrowser: () => new Promise(resolve => { finish = resolve; }) });
  const pending = f.runtime.call(call({ runId: 'browser-aborted' }));
  for (let i = 0; i < 100 && !finish; i++) await flush();
  assert.equal(typeof finish, 'function'); f.runtime.cancel('browser-aborted'); finish({ verified: false, dispatched: true });
  assert.equal((await pending).status, 'cancelled'); assert.equal(f.events.some(event => event.type === 'action'), false);
  assert.equal(f.events.some(event => event.type === 'approval'), false);
  const missing = await fixture(t, { openDefaultBrowser: async () => ({ verified: false }) });
  assert.equal((await missing.runtime.call(call())).status, 'failed');
  assert.equal(missing.events.some(event => event.type === 'action' || event.type === 'approval'), false);
});

test('default browser shares the effect queue and cancelling a queued request prevents dispatch', async t => {
  let finish, opened = 0;
  const f = await fixture(t, {
    openApp: () => new Promise(resolve => { finish = resolve; }),
    openDefaultBrowser: async () => { opened++; return { dispatched: true, verified: false }; },
  }, true);
  const first = f.runtime.call(call({ args: { appId: 'notepad' } }));
  for (let i = 0; i < 100 && !finish; i++) await flush(); assert.equal(typeof finish, 'function');
  const pending = f.runtime.call(call({ runId: 'queued-default-browser' }));
  await flush(); assert.equal(opened, 0);
  f.runtime.cancel('queued-default-browser'); finish({ verified: true });
  assert.equal((await first).status, 'verified'); assert.equal((await pending).status, 'cancelled'); assert.equal(opened, 0);
  const approvals = f.events.filter(event => event.type === 'approval');
  assert.equal(approvals.length, 1); assert.equal(approvals[0].args.appId, 'notepad');
});

test('other application openings still require an explicit approval before native dispatch', async t => {
  const opened = []; const f = await fixture(t, { openApp: async appId => { opened.push(appId); return { verified: true }; } });
  const pending = f.runtime.call(call({ args: { appId: 'calculator' } })); const entry = await approval(f);
  assert.deepEqual(opened, []); assert.equal(entry.tool, 'apps_open'); assert.equal(entry.args.appId, 'calculator');
  f.runtime.approve(entry.approvalId, false);
  assert.equal((await pending).status, 'cancelled'); assert.deepEqual(opened, []);
});

test('URL-specific browser tool retains its dedicated browser adapter and strict URL-only schema', async t => {
  let requested, defaults = 0;
  const f = await fixture(t, { openDefaultBrowser: async () => { defaults++; }, openBrowser: async url => { requested = url; return { verified: true, url }; } });
  const pending = f.runtime.call(call({ name: 'browser_open', args: { url: 'https://example.com/path' } }));
  const entry = await approval(f); assert.equal(entry.tool, 'browser_open'); assert.equal(requested, undefined);
  f.runtime.approve(entry.approvalId, true); const result = await pending;
  assert.equal(result.status, 'verified'); assert.equal(requested, 'https://example.com/path'); assert.equal(defaults, 0);
  for (const args of [{ appId: 'browser', url: 'https://example.com' }, { appId: 'browser', path: 'C:\\apps\\browser.exe' }, { appId: 'browser --arbitrary' }]) {
    assert.equal((await f.runtime.call(call({ args }))).status, 'failed');
  }
  assert.equal(defaults, 0);
  assert.equal(f.events.filter(event => event.type === 'approval').length, 1);
});

test('unobservable focus on an external browser is not misreported or opened as a side effect', async t => {
  let count = 0; const f = await fixture(t, { openApp: async () => { count++; }, openDefaultBrowser: async () => { count++; } }, true);
  const result = await f.runtime.call(call({ name: 'apps_focus' }));
  assert.equal(result.status, 'failed'); assert.match(result.summary, /foco.*não pode ser verificado/); assert.equal(count, 0);
  assert.equal(f.events.some(event => event.type === 'approval'), false);
});
