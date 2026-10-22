import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRuntime, toolDefinitions } from '../packages/runtime/index.mjs';

async function fixture(t, options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-runtime-'));
  let workspaceRoot = path.join(directory, 'workspace');
  const dataDir = path.join(directory, 'private');
  await fs.mkdir(workspaceRoot);
  workspaceRoot = await fs.realpath(workspaceRoot);
  const events = [];
  let runtime;
  const setup = () => createRuntime({ dataDir, workspaceRoot, platformAdapters: options.platformAdapters, onEvent(event) {
    events.push(event);
    options.onEvent?.(event, runtime);
    if (options.autoApprove && event.type === 'approval') queueMicrotask(() => runtime.approve(event.approvalId, true));
  } });
  runtime = setup();
  t.after(async () => {
    await runtime.close();
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}jarvis-runtime-`));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return { get runtime() { return runtime; }, events, workspaceRoot, dataDir, directory,
    async restart() { await runtime.close(); runtime = setup(); return runtime; },
    write: (name, contents) => fs.writeFile(path.join(workspaceRoot, name), contents),
    read: name => fs.readFile(path.join(workspaceRoot, name), 'utf8'),
    exists: async name => { try { await fs.lstat(path.join(workspaceRoot, name)); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } },
  };
}
const request = (name, args = {}, extras = {}) => ({ id: crypto.randomUUID(), name, args, ...extras });
async function eventAfter(events, type, start = 0) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const result = events.slice(start).find(event => event.type === type);
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error(`No ${type} event received.`);
}

test('schemas are closed and unknown tool, extra argument and app commands are rejected', async t => {
  const f = await fixture(t);
  assert.equal(f.runtime.toolDefinitions, toolDefinitions);
  for (const definition of toolDefinitions) {
    assert.equal(definition.strict, true);
    assert.equal(definition.parameters.additionalProperties, false);
    assert.deepEqual(definition.parameters.required, Object.keys(definition.parameters.properties));
  }
  for (const call of [request('shell', { command: 'whoami' }), request('workspace_list', { path: '..' }), request('apps_open', { appId: 'notepad && whoami' }), request('browser_open', { url: 'file:///C:/secret.txt' }), request('browser_open', { url: 'https://user:password@example.com' })]) {
    const result = await f.runtime.call(call);
    assert.equal(result.status, 'failed');
  }
  assert.equal(f.events.length, 0);
});

test('app actions wait for immutable approval and replay one saved effect per ID', async t => {
  const calls = [];
  const f = await fixture(t, { platformAdapters: { openApp: async id => { calls.push(id); return { verified: true, appId: id }; } } });
  const call = request('apps_open', { appId: 'notepad' }, { runId: 'app-run' });
  const pending = f.runtime.call(call);
  call.args.appId = 'calculator';
  const approval = await eventAfter(f.events, 'approval');
  assert.equal(approval.args.appId, 'notepad');
  approval.args.appId = 'browser';
  assert.deepEqual(calls, []);
  assert.equal(f.runtime.approve(approval.approvalId, true), true);
  assert.equal((await pending).status, 'verified');
  assert.deepEqual(calls, ['notepad']);
  assert.equal(f.runtime.approve(approval.approvalId, true), false);
  const original = { ...call, args: { appId: 'notepad' } };
  assert.equal((await f.runtime.call(original)).status, 'verified');
  await f.restart();
  assert.equal((await f.runtime.call(original)).status, 'verified');
  assert.equal((await f.runtime.call(call)).status, 'failed');
  assert.deepEqual(calls, ['notepad']);
});

test('duplicate concurrent URL calls share one execution and unsupported or unacknowledged adapters do not report success', async t => {
  const f = await fixture(t, { platformAdapters: { openBrowser: async () => ({ opened: true }) } });
  assert.equal((await f.runtime.call(request('apps_open', { appId: 'notepad' }))).status, 'failed');
  const call = request('browser_open', { url: 'https://example.com' });
  const a = f.runtime.call(call), b = f.runtime.call(call);
  assert.equal(a, b);
  assert.equal((await a).status, 'failed');
  assert.equal((await b).ok, false);
  assert.equal(f.events.filter(event => event.type === 'approval').length, 0);
});

test('deny and abort cancel pending effects and run cancellation blocks future calls', async t => {
  let count = 0;
  const f = await fixture(t, { platformAdapters: { openApp: async () => { count++; return { verified: true }; } } });
  const first = f.runtime.call(request('apps_open', { appId: 'notepad' }));
  const approval = await eventAfter(f.events, 'approval');
  f.runtime.approve(approval.approvalId, false);
  assert.equal((await first).status, 'cancelled');
  const start = f.events.length;
  const controller = new AbortController();
  const second = f.runtime.call(request('apps_open', { appId: 'calculator' }, { runId: 'cancelled-run' }), { signal: controller.signal });
  const next = await eventAfter(f.events, 'approval', start);
  controller.abort();
  assert.equal((await second).status, 'cancelled');
  assert.equal(f.runtime.approve(next.approvalId, true), false);
  f.runtime.cancel('future-run');
  assert.equal((await f.runtime.call(request('apps_open', { appId: 'browser' }, { runId: 'future-run' }))).status, 'cancelled');
  assert.equal(count, 0);
});

test('preview has no effects; application classifies files, verifies every move and saves an approved procedure', async t => {
  const f = await fixture(t, { autoApprove: true });
  await Promise.all([f.write('report.txt', 'private report'), f.write('photo.png', 'not a real photo'), f.write('script.py', 'print(1)'), f.write('archive.zip', 'zip'), f.write('.hidden', 'keep')]);
  await fs.mkdir(path.join(f.workspaceRoot, 'project'));
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
  assert.equal(preview.status, 'verified');
  assert.equal(preview.data.steps.length, 4);
  assert.equal(await f.exists('documents'), false);
  assert.equal(f.events.some(event => event.type === 'approval'), false);
  const applied = await f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }, { runId: 'organize-run' }));
  assert.equal(applied.status, 'verified', applied.summary);
  assert.equal(await f.read('documents/report.txt'), 'private report');
  assert.equal(await f.read('images/photo.png'), 'not a real photo');
  assert.equal(await f.read('code/script.py'), 'print(1)');
  assert.equal(await f.read('other/archive.zip'), 'zip');
  assert.equal(await f.exists('report.txt'), false);
  assert.equal(await f.read('.hidden'), 'keep');
  const snapshot = f.runtime.getSnapshot();
  assert.equal(snapshot.procedures.length, 1);
  assert.equal(snapshot.procedures[0].source, 'approved_execution');
  assert.equal(snapshot.tasks.find(task => task.runId === 'organize-run').steps.filter(step => step.status === 'completed').length, 4);
  assert.equal((await f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }))).status, 'failed');
});

test('month filtering uses modification date and preserves old files', async t => {
  const f = await fixture(t, { autoApprove: true });
  await f.write('current.txt', 'current');
  await f.write('old.txt', 'old');
  await fs.utimes(path.join(f.workspaceRoot, 'old.txt'), new Date(2020, 0, 15), new Date(2020, 0, 15));
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: true }));
  assert.deepEqual(preview.data.steps.map(step => step.source), ['current.txt']);
  const result = await f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }));
  assert.equal(result.status, 'verified', result.summary);
  assert.equal(await f.read('old.txt'), 'old');
});

test('changed fingerprint invalidates the entire approved proposal before any move', async t => {
  const f = await fixture(t);
  await f.write('a.txt', 'aaaa');
  await f.write('b.txt', 'bbbb');
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
  const pending = f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }));
  const approval = await eventAfter(f.events, 'approval');
  await f.write('b.txt', 'cccc');
  f.runtime.approve(approval.approvalId, true);
  const result = await pending;
  assert.equal(result.status, 'failed');
  assert.equal(await f.read('a.txt'), 'aaaa');
  assert.equal(await f.read('b.txt'), 'cccc');
  assert.equal(await f.exists('documents'), false);
});

test('destination created after preview is never overwritten', async t => {
  const f = await fixture(t);
  await f.write('a.txt', 'source');
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
  const pending = f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }));
  const approval = await eventAfter(f.events, 'approval');
  await fs.mkdir(path.join(f.workspaceRoot, 'documents'));
  await f.write('documents/a.txt', 'destination');
  f.runtime.approve(approval.approvalId, true);
  assert.equal((await pending).status, 'failed');
  assert.equal(await f.read('a.txt'), 'source');
  assert.equal(await f.read('documents/a.txt'), 'destination');
});

test('cancel after a verified step stops subsequent files; compensation restores only completed steps', async t => {
  const f = await fixture(t, { autoApprove: true, onEvent(event, runtime) { if (event.type === 'action' && event.status === 'completed' && event.runId === 'partial-run') runtime.cancel('partial-run'); } });
  await f.write('a.txt', 'aaa');
  await f.write('b.txt', 'bbb');
  await f.write('c.txt', 'ccc');
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
  const result = await f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }, { runId: 'partial-run' }));
  assert.equal(result.status, 'cancelled', result.summary);
  assert.equal(result.data.completed, 1);
  assert.equal(await f.read('documents/a.txt'), 'aaa');
  assert.equal(await f.read('b.txt'), 'bbb');
  assert.equal(await f.read('c.txt'), 'ccc');
  const compensated = await f.runtime.call(request('workspace_compensate', { runId: 'partial-run' }));
  assert.equal(compensated.status, 'verified', compensated.summary);
  assert.equal(compensated.data.restored, 1);
  assert.equal(await f.read('a.txt'), 'aaa');
  assert.equal(await f.exists('documents/a.txt'), false);
  assert.equal(f.runtime.getSnapshot().tasks.find(task => task.runId === 'partial-run').steps[0].status, 'compensated');
});

test('compensation refuses changed files and recreated original paths', async t => {
  const f = await fixture(t, { autoApprove: true });
  await f.write('a.txt', 'aaa');
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
  assert.equal((await f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }, { runId: 'compensate-run' }))).status, 'verified');
  assert.equal((await f.runtime.call(request('workspace_compensate', { runId: 'compensate-run' }, { profileId: 'other-profile' }))).status, 'failed');
  await f.write('a.txt', 'new original');
  const collision = await f.runtime.call(request('workspace_compensate', { runId: 'compensate-run' }));
  assert.equal(collision.status, 'failed');
  assert.equal(await f.read('a.txt'), 'new original');
  assert.equal(await f.read('documents/a.txt'), 'aaa');
  await fs.unlink(path.join(f.workspaceRoot, 'a.txt'));
  await f.write('documents/a.txt', 'modified');
  const changed = await f.runtime.call(request('workspace_compensate', { runId: 'compensate-run' }));
  assert.equal(changed.status, 'failed');
  assert.equal(await f.read('documents/a.txt'), 'modified');
  assert.equal(await f.exists('a.txt'), false);
});

test('junctions cannot redirect workspace, previews or effects outside the chosen directory', async t => {
  const f = await fixture(t);
  const outside = path.join(f.directory, 'outside');
  await fs.mkdir(outside);
  await f.write('a.txt', 'aaa');
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
  await fs.symlink(outside, path.join(f.workspaceRoot, 'documents'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => f.runtime.setWorkspace(path.join(f.workspaceRoot, 'documents')), /links|junções/);
  const pending = f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }));
  const approval = await eventAfter(f.events, 'approval');
  f.runtime.approve(approval.approvalId, true);
  assert.equal((await pending).status, 'failed');
  assert.equal(await f.read('a.txt'), 'aaa');
  assert.deepEqual(await fs.readdir(outside), []);
  const again = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
  assert.equal(again.data.steps.length, 0);
});

test('physical links and linked source files are not organized', async t => {
  const f = await fixture(t, { autoApprove: true });
  await f.write('a.txt', 'aaa');
  await fs.link(path.join(f.workspaceRoot, 'a.txt'), path.join(f.workspaceRoot, 'b.txt'));
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
  assert.equal(preview.data.steps.length, 0);
  assert.equal(preview.data.skipped.length, 2);
  assert.equal(await f.read('a.txt'), 'aaa');
  assert.equal(await f.read('b.txt'), 'aaa');
});

test('workspace changes invalidate old plans; private storage cannot overlap workspace', async t => {
  const f = await fixture(t, { autoApprove: true });
  await f.write('a.txt', 'aaa');
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
  const second = path.join(f.directory, 'second');
  await fs.mkdir(second);
  assert.equal(f.runtime.setWorkspace(second), await fs.realpath(second));
  assert.equal((await f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }))).status, 'failed');
  assert.throws(() => f.runtime.setWorkspace(f.dataDir), /separados/);
  assert.equal(await f.read('a.txt'), 'aaa');
});

test('memories are explicit, editable, isolated by profile, removable and persistent after restart', async t => {
  const f = await fixture(t);
  const pending = f.runtime.call(request('memory_propose', { text: 'Prefiro português.' }, { profileId: 'alice' }));
  const approval = await eventAfter(f.events, 'approval');
  assert.equal(f.runtime.getSnapshot('alice').memories.length, 0);
  f.runtime.approve(approval.approvalId, true);
  const result = await pending;
  assert.equal(result.status, 'verified');
  const id = result.data.id;
  assert.equal(f.runtime.getSnapshot().memories.length, 0);
  f.runtime.saveMemory({ profileId: 'alice', id, text: 'Prefiro português brasileiro.' });
  await f.restart();
  assert.equal(f.runtime.getSnapshot('alice').memories[0].text, 'Prefiro português brasileiro.');
  assert.equal(f.runtime.deleteMemory('other-profile', id), false);
  assert.equal(f.runtime.getSnapshot('alice').memories.length, 1);
  assert.equal(f.runtime.deleteMemory('alice', id), true);
  await f.restart();
  assert.equal(f.runtime.getSnapshot('alice').memories.length, 0);
});

test('dictation writes and verifies a fresh note only after approval', async t => {
  const f = await fixture(t);
  const pending = f.runtime.call(request('notes_dictate', { text: 'Texto com acentuação: reunião amanhã.' }));
  const approval = await eventAfter(f.events, 'approval');
  assert.equal(await f.exists('notes'), false);
  f.runtime.approve(approval.approvalId, true);
  const result = await pending;
  assert.equal(result.status, 'verified', result.summary);
  assert.equal(await f.read(result.data.path), 'Texto com acentuação: reunião amanhã.\n');
  assert.equal(result.data.path.startsWith(`notes${path.sep}`), true);
});

test('list does not read file contents and pending effects prevent workspace changes', async t => {
  const f = await fixture(t);
  await f.write('secret.txt', 'never expose this body');
  const listing = await f.runtime.call(request('workspace_list'));
  assert.equal(listing.status, 'verified');
  assert.equal(listing.data.files[0].name, 'secret.txt');
  assert.equal(JSON.stringify(listing).includes('never expose this body'), false);
  const pending = f.runtime.call(request('memory_propose', { text: 'Preference' }));
  const approval = await eventAfter(f.events, 'approval');
  assert.throws(() => f.runtime.setWorkspace(f.workspaceRoot), /andamento/);
  await f.runtime.close();
  assert.equal((await pending).status, 'cancelled');
  assert.equal(f.runtime.approve(approval.approvalId, true), false);
  assert.equal((await f.runtime.call(request('workspace_list'))).status, 'failed');
});

test('optional browser, editor, Notepad and focus adapters remain approved, confined and verifiable', async t => {
  const calls = [];
  const f = await fixture(t, { autoApprove: true, platformAdapters: {
    readBrowserSelection: async () => { calls.push('read'); return { verified: true, url: 'https://example.com/article', title: 'Article', text: 'x'.repeat(25000) }; },
    openProject: async workspace => { calls.push(workspace); return { verified: true }; },
    dictateNotes: async text => { calls.push(text); return { verified: true }; },
    focusApp: async appId => { calls.push(appId); return { verified: true, focused: appId === 'notepad' }; },
  } });
  const selection = await f.runtime.call(request('browser_read_selected'));
  assert.equal(selection.status, 'verified');
  assert.equal(selection.data.untrusted, true);
  assert.equal(selection.data.truncated, true);
  assert.equal(selection.data.text.length, 20000);
  assert.equal((await f.runtime.call(request('projects_open'))).status, 'verified');
  assert.equal((await f.runtime.call(request('projects_open', { path: '..' }))).status, 'failed');
  assert.equal((await f.runtime.call(request('notes_open_dictation', { text: 'My new note' }))).status, 'verified');
  assert.equal((await f.runtime.call(request('apps_focus', { appId: 'notepad' }))).status, 'verified');
  assert.equal((await f.runtime.call(request('apps_focus', { appId: 'calculator' }))).status, 'failed');
  assert.deepEqual(calls, ['read', f.workspaceRoot, 'My new note', 'notepad', 'calculator']);
  assert.equal(f.events.filter(event => event.type === 'approval').length, 5);
});

test('deleting a memory removes its text from local database and journals', async t => {
  const f = await fixture(t, { autoApprove: true });
  const text = `private-memory-marker-${crypto.randomUUID()}`;
  const result = await f.runtime.call(request('memory_propose', { text }));
  assert.equal(result.status, 'verified');
  assert.equal(Object.hasOwn(result.data, 'text'), false);
  assert.equal(f.runtime.getSnapshot().memories[0].text, text);
  assert.equal(f.runtime.deleteMemory('default', result.data.id), true);
  const files = (await fs.readdir(f.dataDir)).filter(name => name.startsWith('jarvis.sqlite'));
  for (const file of files) {
    const body = await fs.readFile(path.join(f.dataDir, file));
    assert.equal(body.includes(Buffer.from(text)), false, `Memory text retained in ${file}`);
  }
});

test('plan continuity is bounded, profile-isolated and contains only relative proposal metadata', async t => {
  const f = await fixture(t);
  for (let index = 0; index < 25; index++) await f.write(`file-${String(index).padStart(2, '0')}.txt`, 'content never sent in plan context');
  const created = [];
  for (let index = 0; index < 4; index++) created.push((await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: index % 2 === 0 }, { profileId: 'alice' }))).data.planId);
  const context = f.runtime.getPlanContext('alice');
  assert.deepEqual(context.plans.map(plan => plan.planId), created.slice(-3).reverse());
  assert.equal(context.plans.length, 3);
  assert.equal(context.plans[0].count, 25);
  assert.equal(context.plans[0].steps.length, 20);
  assert.deepEqual(context.recentEffects, []);
  assert.deepEqual(f.runtime.getPlanContext('bob'), { plans: [], recentEffects: [] });
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes(f.workspaceRoot), false);
  assert.equal(serialized.includes('content never sent'), false);
  assert.equal(serialized.includes('fingerprint'), false);
  assert.equal(serialized.includes('sha256'), false);
  for (const step of context.plans.flatMap(plan => plan.steps)) {
    assert.equal(path.isAbsolute(step.source), false);
    assert.equal(path.isAbsolute(step.destination), false);
    assert.deepEqual(Object.keys(step).sort(), ['destination', 'source']);
  }
  const second = path.join(f.directory, 'other-workspace');
  await fs.mkdir(second);
  f.runtime.setWorkspace(second);
  assert.deepEqual(f.runtime.getPlanContext('alice'), { plans: [], recentEffects: [] });
  f.runtime.setWorkspace(f.workspaceRoot);
  assert.equal(f.runtime.getPlanContext('alice').plans.length, 3);
});

test('executed plans leave preview context and completed file effects remain scoped until compensated', async t => {
  const f = await fixture(t, { autoApprove: true });
  await f.write('a.txt', 'aaa');
  const preview = await f.runtime.call(request('workspace_preview_organize', { onlyThisMonth: true }, { profileId: 'alice' }));
  const result = await f.runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }, { profileId: 'alice', runId: 'context-run' }));
  assert.equal(result.status, 'verified', result.summary);
  const context = f.runtime.getPlanContext('alice');
  assert.deepEqual(context.plans, []);
  assert.equal(context.recentEffects.length, 1);
  assert.equal(context.recentEffects[0].runId, 'context-run');
  assert.equal(context.recentEffects[0].completedCount, 1);
  assert.equal(context.recentEffects[0].status, 'completed');
  assert.ok(context.recentEffects[0].lastVerifiedAt);
  assert.deepEqual(f.runtime.getPlanContext('bob'), { plans: [], recentEffects: [] });
  await f.restart();
  assert.equal(f.runtime.getPlanContext('alice').recentEffects[0].runId, 'context-run');
  const other = path.join(f.directory, 'other-workspace');
  await fs.mkdir(other);
  f.runtime.setWorkspace(other);
  assert.deepEqual(f.runtime.getPlanContext('alice'), { plans: [], recentEffects: [] });
  f.runtime.setWorkspace(f.workspaceRoot);
  assert.equal((await f.runtime.call(request('workspace_compensate', { runId: 'context-run' }, { profileId: 'alice' }))).status, 'verified');
  assert.deepEqual(f.runtime.getPlanContext('alice').recentEffects, []);
});

test('Windows native canonicalization accepts a real 8.3 alias while still rejecting junction workspaces', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t);
  const longWorkspace = path.join(f.directory, 'Workspace with long name for short alias');
  await fs.mkdir(longWorkspace);
  const escaped = longWorkspace.replaceAll("'", "''");
  const script = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); (New-Object -ComObject Scripting.FileSystemObject).GetFolder('${escaped}').ShortPath`;
  const result = spawnSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, encoding: 'utf8', timeout: 10_000 });
  const shortWorkspace = result.stdout?.trim();
  if (result.status !== 0 || !shortWorkspace || shortWorkspace.toLowerCase() === longWorkspace.toLowerCase()) { t.skip('Este volume não fornece um nome curto 8.3 para o diretório de teste.'); return; }
  let runtime;
  runtime = createRuntime({ dataDir: path.join(f.directory, 'short-alias-private'), workspaceRoot: shortWorkspace, onEvent(event) { if (event.type === 'approval') queueMicrotask(() => runtime.approve(event.approvalId, true)); } });
  try {
    await fs.writeFile(path.join(longWorkspace, 'a.txt'), 'alias-safe');
    const preview = await runtime.call(request('workspace_preview_organize', { onlyThisMonth: false }));
    assert.equal(preview.data.steps.length, 1, JSON.stringify(preview));
    assert.equal((await runtime.call(request('workspace_apply_organize', { planId: preview.data.planId }))).status, 'verified');
    assert.equal(await fs.readFile(path.join(longWorkspace, 'documents', 'a.txt'), 'utf8'), 'alias-safe');
    const note = await runtime.call(request('notes_dictate', { text: 'Alias note' }));
    assert.equal(note.status, 'verified', note.summary);
    assert.equal(await fs.readFile(path.join(longWorkspace, note.data.path), 'utf8'), 'Alias note\n');
    const junction = path.join(longWorkspace, 'linked-directory');
    await fs.symlink(f.workspaceRoot, junction, 'junction');
    assert.throws(() => runtime.setWorkspace(junction), /links|junções/);
  } finally { await runtime.close(); }
});
