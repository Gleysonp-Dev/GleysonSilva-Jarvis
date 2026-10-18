import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import * as fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createLocalTestServer } from '../scripts/local-test.mjs';

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-local-test-'));
  const dataDir = path.join(directory, 'private'), assetsDir = path.join(directory, 'assets');
  await fs.mkdir(assetsDir);
  await fs.writeFile(path.join(assetsDir, 'index.html'), '<!doctype html><head></head><body><script src="/app.js"></script></body>');
  await fs.writeFile(path.join(assetsDir, 'app.js'), 'window.testApp=true;');
  await fs.writeFile(path.join(assetsDir, 'app.css'), ':root{color:white}');
  let local = await createLocalTestServer({ port: 0, dataDir, assetsDir });
  let token;
  async function refreshToken() { const html = await (await fetch(local.url)).text(); token = /name="jarvis-token" content="([a-f0-9]{64})"/.exec(html)?.[1]; assert.ok(token); }
  await refreshToken();
  t.after(async () => {
    await local.close();
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}jarvis-local-test-`));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return { get local() { return local; }, get token() { return token; }, dataDir,
    async post(method, value = null, overrides = {}) {
      return fetch(`${local.url}/api/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jarvis-Token': token, Origin: local.url, ...overrides }, body: JSON.stringify(value) });
    },
    async value(method, value = null) { const response = await this.post(method, value); assert.equal(response.status, 200, await response.clone().text()); return (await response.json()).result; },
    async restart() { await local.close(); local = await createLocalTestServer({ port: 0, dataDir, assetsDir }); await refreshToken(); },
  };
}

test('loopback serves only allowlisted assets and rejects Host, origin, CSRF and GET effects', async t => {
  const f = await fixture(t);
  const index = await fetch(f.local.url);
  const html = await index.text();
  assert.match(html, /test-bridge\.js/);
  assert.match(index.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(index.headers.get('access-control-allow-origin'), null);
  for (const suffix of ['/settings.json', '/%2e%2e/package.json', '/package.json', '/node_modules/electron/index.js']) assert.equal((await fetch(f.local.url + suffix)).status, 404);
  assert.equal((await fetch(`${f.local.url}/api/memorySave`)).status, 405);
  assert.equal((await f.post('memorySave', { text: 'forbidden' }, { 'X-Jarvis-Token': '0'.repeat(64) })).status, 403);
  assert.equal((await f.post('memorySave', { text: 'forbidden' }, { Origin: 'https://evil.example' })).status, 403);
  const noOrigin = await fetch(`${f.local.url}/api/memorySave`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jarvis-Token': f.token }, body: '{"text":"forbidden"}' });
  assert.equal(noOrigin.status, 403);
  assert.equal((await f.post('constructor')).status, 404);
  assert.equal((await f.value('boot')).snapshot.memories.length, 0);
  const badHost = await new Promise((resolve, reject) => {
    const req = request(f.local.url, { headers: { Host: 'evil.example:1234' } }, res => { res.resume(); res.once('end', () => resolve(res.statusCode)); }); req.on('error', reject); req.end();
  });
  assert.equal(badHost, 403);
});

test('body limits, fixed workspace and unavailable native integrations are enforced', async t => {
  const f = await fixture(t);
  const large = await fetch(`${f.local.url}/api/boot`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jarvis-Token': f.token, Origin: f.local.url }, body: JSON.stringify('x'.repeat(3 * 1024 * 1024)) });
  assert.equal(large.status, 413);
  const boot = await f.value('boot');
  assert.equal(boot.capabilities.desktop, false);
  assert.equal(boot.settings.apps.length, 0);
  assert.equal(await f.value('chooseWorkspace'), path.join(f.dataDir, 'workspace'));
  assert.equal(await f.value('chooseApp'), null);
  const result = await f.value('callTool', { id: randomUUID(), runId: randomUUID(), profileId: boot.settings.profileId, name: 'apps_open', args: { appId: 'notepad' } });
  assert.equal(result.status, 'failed');
  assert.equal((await f.post('openExternal', 'https://example.com')).status, 400);
  assert.equal((await f.post('saveSettings', { workspaceRoot: 'C:\\private' })).status, 400);
});

test('settings and keys remain in memory while saved memories remain isolated across profiles and restart', async t => {
  const f = await fixture(t);
  const secret = `test-only-secret-${randomUUID()}`;
  const saved = await f.value('saveSettings', { profileId: 'alice', apiKey: secret, textModel: 'test-model' });
  assert.equal(saved.hasKey, true);
  assert.equal(JSON.stringify(saved).includes(secret), false);
  await f.value('memorySave', { profileId: 'alice', text: 'Alice memory' });
  const alice = await f.value('boot');
  assert.equal(alice.snapshot.memories[0].text, 'Alice memory');
  assert.equal(JSON.stringify(alice).includes(secret), false);
  await f.value('saveSettings', { profileId: 'bob' });
  assert.equal((await f.value('boot')).snapshot.memories.length, 0);
  assert.equal((await f.post('memorySave', { profileId: 'alice', text: 'cross-profile' })).status, 400);
  const entries = await fs.readdir(f.dataDir, { recursive: true });
  for (const name of entries) {
    const file = path.join(f.dataDir, name);
    if ((await fs.lstat(file)).isFile()) assert.equal((await fs.readFile(file)).includes(Buffer.from(secret)), false, `Key retained in ${name}`);
  }
  await f.restart();
  const restarted = await f.value('boot');
  assert.equal(restarted.settings.profileId, 'default');
  assert.equal(restarted.settings.textModel === 'test-model', false);
  assert.equal(restarted.settings.hasKey, Boolean(process.env.OPENAI_API_KEY));
  await f.value('saveSettings', { profileId: 'alice' });
  assert.equal((await f.value('boot')).snapshot.memories[0].text, 'Alice memory');
});

test('protected event stream carries a real approval and approved dictation writes only inside demo workspace', async t => {
  const f = await fixture(t), controller = new AbortController();
  assert.equal((await fetch(`${f.local.url}/events`)).status, 403);
  const stream = await fetch(`${f.local.url}/events`, { headers: { 'X-Jarvis-Token': f.token }, signal: controller.signal });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  t.after(() => { controller.abort(); });
  const boot = await f.value('boot');
  const pending = f.value('callTool', { id: randomUUID(), runId: randomUUID(), profileId: boot.settings.profileId, name: 'notes_dictate', args: { text: 'Approved local note' } });
  let buffer = '', approval;
  const decoder = new TextDecoder();
  const deadline = setTimeout(() => controller.abort(), 5000);
  try {
    while (!approval) {
      const chunk = await reader.read(); assert.equal(chunk.done, false); buffer += decoder.decode(chunk.value, { stream: true });
      for (const line of buffer.split('\n')) if (line.startsWith('data: ')) { try { const event = JSON.parse(line.slice(6)); if (event.type === 'approval') approval = event; } catch {} }
    }
    assert.equal(approval.details.text, 'Approved local note');
    assert.equal(await f.value('approve', { approvalId: approval.approvalId, allow: true }), true);
    const result = await pending;
    assert.equal(result.status, 'verified');
    assert.equal(await fs.readFile(path.join(f.dataDir, 'workspace', result.data.path), 'utf8'), 'Approved local note\n');
  } finally { clearTimeout(deadline); controller.abort(); await reader.cancel().catch(() => {}); }
});
