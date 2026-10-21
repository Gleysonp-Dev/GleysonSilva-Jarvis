import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { join, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWindowsAdapters } from '../apps/desktop/platform/windows.mjs';

const EXE = 'C:\\Program Files\\Sample Editor\\editor.exe';
const OTHER_EXE = 'D:\\Apps\\Other\\other.exe';
const AUMID = 'Example.Sample_abc123!App';
const FOLDER = 'D:\\Arquivos de teste';
const NOW = new Date('2026-10-20T12:00:00.000Z');
const flush = () => new Promise(resolve => setImmediate(resolve));

function filesystem(initial = []) {
 const entries = new Map(initial.map(([path, entry]) => [win32.normalize(path).toLowerCase(), entry]));
 const reads = [];
 const lookup = path => { reads.push(path); const value = entries.get(win32.normalize(path).toLowerCase()); if (!value) throw new Error('private-filesystem-detail'); return value; };
 return { entries, reads, api: {
  async realpath(path) { return lookup(path).canonical || win32.normalize(path); },
  async stat(path) { const entry = lookup(path); return { isDirectory: () => entry.kind === 'folder', isFile: () => entry.kind === 'file' }; },
  async access(path) { lookup(path); },
 } };
}

function processes(responder = () => ({ apps: [] })) {
 const calls = [];
 const spawnImpl = (executable, args, options) => {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = { resume() {} }; child.kills = 0;
  child.kill = () => { child.kills++; return true; };
  const call = { executable, args, options, child, action: args[args.indexOf('-Action') + 1], payload: JSON.parse(Buffer.from(args[args.indexOf('-Payload') + 1], 'base64').toString('utf8')) };
  calls.push(call);
  queueMicrotask(async () => {
   try {
    const response = await responder(call);
    if (response === undefined) return;
    if (response instanceof Error) { child.emit('error', response); return; }
    child.stdout.emit('data', Buffer.from(typeof response.raw === 'string' ? response.raw : JSON.stringify(response)));
    child.emit('close', response.exitCode || 0);
   } catch { child.emit('error', new Error('private-process-detail')); }
  });
  return child;
 };
 return { calls, spawnImpl };
}

function fixture({ apps = [], configured = [], responder, openPath = async () => '', getKnownFolder = () => FOLDER, platform = 'win32' } = {}) {
 const fs = filesystem([[EXE, { kind: 'file' }], [OTHER_EXE, { kind: 'file' }], [FOLDER, { kind: 'folder' }]]);
 const process = processes(responder || (call => call.action === 'ListApps' ? { apps } : { verified: false, dispatched: true, summary: 'Pedido encaminhado; janela não confirmada.' }));
 const opened = [], external = [];
 const adapters = createWindowsAdapters({ platform, fsImpl: fs.api, spawnImpl: process.spawnImpl, getApps: () => configured,
  getKnownFolder, openPath: async path => { opened.push(path); return openPath(path); }, openExternal: async url => { external.push(url); }, now: () => NOW });
 return { adapters, fs, ...process, opened, external };
}

test('discovery merges observed OS apps and configured EXEs without launching or revealing targets', async () => {
 const f = fixture({ apps: [{ kind: 'exe', label: 'Éditor de Teste', path: EXE }, { kind: 'aumid', label: 'Aplicativo da Loja', aumid: AUMID }],
  configured: [{ id: 'old-vscode-slot', label: 'Outro editor cadastrado', path: OTHER_EXE, args: ['--never-forward'] }] });
 const result = await f.adapters.findApps('editor');
 assert.equal(result.apps.length, 2); assert.equal(result.observedAt, NOW.toISOString());
 for (const app of result.apps) { assert.match(app.id, /^winapp-[a-f0-9]{64}$/); assert.deepEqual(Object.keys(app).sort(), ['id', 'label']); }
 assert.equal(JSON.stringify(result).includes('Program Files'), false);
 assert.equal(f.calls.length, 1); assert.equal(f.calls[0].action, 'ListApps'); assert.deepEqual(f.calls[0].payload, {});
 assert.equal(f.calls[0].options.shell, false); assert.equal(f.calls[0].options.windowsHide, true);
 assert.match(f.calls[0].executable, /powershell\.exe$/i); assert(f.calls[0].args.includes('-File')); assert.equal(f.calls[0].args.includes('-Command'), false);
 assert.equal(f.opened.length, 0); assert.equal(f.external.length, 0);
 const again = await f.adapters.findApps('Éditor');
 assert.equal(again.apps[0].id, result.apps.find(app => app.label === 'Éditor de Teste').id);
});

test('UWP and classic OS AUMIDs are opaque capabilities and unobserved AppsFolder handoff stays false', async () => {
 const f = fixture({ apps: [{ kind: 'aumid', label: 'Loja', aumid: AUMID }, { kind: 'aumid', label: 'Navegador Chrome', aumid: 'Chrome' }] });
 const [{ id }] = (await f.adapters.findApps('Loja')).apps;
 const result = await f.adapters.launchApp(id);
 assert.equal(result.verified, false); assert.equal(result.dispatched, true); assert.match(result.summary, /encaminhado/);
 assert.deepEqual(f.calls[1].payload, { kind: 'aumid', aumid: AUMID });
 const chrome = await f.adapters.findApps('Chrome'); assert.equal(chrome.apps.length, 1);
});

test('only an inventory EXE ID can launch, with process/window evidence required for verified success', async () => {
 let evidence = { verified: true, observed: 'window', pid: 501, focused: true, summary: 'Janela observada.' };
 const f = fixture({ responder: call => call.action === 'ListApps' ? { apps: [{ kind: 'exe', label: 'Editor', path: EXE }] } : evidence });
 const [{ id }] = (await f.adapters.findApps('Editor')).apps;
 assert.deepEqual(await f.adapters.launchApp(id), { verified: true, dispatched: true, observed: 'window', pid: 501, focused: true, summary: 'Janela observada.' });
 assert.deepEqual(f.calls[1].payload, { kind: 'exe', path: EXE });
 evidence = { verified: true, observed: 'process', pid: 502, summary: 'Processo observado; sem janela confirmada.' };
 assert.equal((await f.adapters.launchApp(id)).verified, true);
 evidence = { verified: true, summary: 'Everything opened, without actual evidence.' };
 const unsupported = await f.adapters.launchApp(id); assert.equal(unsupported.verified, false); assert.equal(unsupported.dispatched, undefined); assert.match(unsupported.summary, /não retornou evidência/);
});

test('raw commands, URLs, scripts and forged or stale application IDs cannot execute', async () => {
 const f = fixture();
 for (const query of ['cmd /c calc', 'powershell -Command whoami', 'Editor; whoami', 'Editor & calc', 'https://example.com', EXE, 'run.ps1', 'file.cmd', 'file.url', 'name\nnext']) await assert.rejects(f.adapters.findApps(query));
 assert.equal(f.calls.length, 0);
 for (const id of [EXE, AUMID, 'https://example.com', 'notepad', `winapp-${'a'.repeat(64)}`, { id: 'fake' }]) await assert.rejects(f.adapters.launchApp(id), /inventário observado/);
 assert.equal(f.calls.length, 0);
});

test('bad inventory records are skipped and a vanished or retargeted EXE is revalidated before launch', async () => {
 const f = fixture({ apps: [
  { kind: 'exe', label: 'Editor', path: EXE },
  { kind: 'exe', label: 'Script', path: 'C:\\Apps\\file.ps1' },
  { kind: 'exe', label: 'Arguments', path: `${EXE} --execute` },
  { kind: 'exe', label: 'Network', path: '\\\\server\\share\\app.exe' },
  { kind: 'aumid', label: 'Injected', aumid: 'Chrome;calc' },
 ] });
 const [{ id }] = (await f.adapters.findApps('Editor')).apps;
 assert.equal((await f.adapters.findApps('Injected')).apps.length, 0);
 const previousSpawns = f.calls.length;
 f.fs.entries.set(EXE.toLowerCase(), { kind: 'file', canonical: OTHER_EXE });
 await assert.rejects(f.adapters.launchApp(id), /mudou desde a descoberta/); assert.equal(f.calls.length, previousSpawns);
 f.fs.entries.delete(EXE.toLowerCase());
 await assert.rejects(f.adapters.launchApp(id), error => /confirmar o executável/.test(error.message) && !error.message.includes('private-filesystem-detail'));
 assert.equal(f.calls.length, previousSpawns);
});

test('folder aliases resolve via trusted known-folder callback and outside-workspace local folders open honestly', async () => {
 const aliases = [];
 const f = fixture({ getKnownFolder: alias => { aliases.push(alias); return FOLDER; } });
 assert.deepEqual(await f.adapters.resolveFolder('documentos'), { path: FOLDER, label: 'Documentos' });
 assert.deepEqual(await f.adapters.resolveFolder('Área de Trabalho'), { path: FOLDER, label: 'Área de Trabalho' });
 assert.deepEqual(aliases, ['documents', 'desktop']);
 assert.deepEqual(await f.adapters.resolveFolder('D:/Arquivos de teste'), { path: FOLDER, label: 'Arquivos de teste' });
 const opened = await f.adapters.openFolder(FOLDER);
 assert.equal(opened.verified, false); assert.equal(opened.dispatched, true); assert.match(opened.summary, /encaminhada/); assert.deepEqual(f.opened, [FOLDER]);
 assert.equal(f.calls.length, 0); // Folders use no shell command or directory-content read.
});

test('folder inputs reject files, relative paths, UNC, devices, streams and URLs before shell.openPath', async () => {
 const f = fixture();
 for (const folder of ['relative', 'C:relative', 'https://example.com', 'file:///C:/Users', '\\\\server\\share', '\\\\?\\C:\\Users', '\\\\.\\C:\\Users', 'C:\\Users:stream', 'C:\\NUL', 'C:\\COM1.txt', 'C:\\unsafe.\\folder', 'C:\\a\u0000b']) {
  await assert.rejects(f.adapters.resolveFolder(folder)); await assert.rejects(f.adapters.openFolder(folder));
 }
 await assert.rejects(f.adapters.resolveFolder(EXE), /pasta existente/);
 assert.equal(f.opened.length, 0); assert.equal(f.calls.length, 0);
});

test('canonical folders are checked again on open, including junctions to UNC and folder-to-file replacement', async () => {
 const f = fixture();
 await f.adapters.resolveFolder(FOLDER);
 f.fs.entries.set(FOLDER.toLowerCase(), { kind: 'file' });
 await assert.rejects(f.adapters.openFolder(FOLDER), /pasta existente/); assert.equal(f.opened.length, 0);
 f.fs.entries.set(FOLDER.toLowerCase(), { kind: 'folder', canonical: '\\\\server\\share' });
 await assert.rejects(f.adapters.openFolder(FOLDER), /pasta local existente/); assert.equal(f.opened.length, 0);
});

test('folder retargeted to another existing local directory after approval cannot be opened', async () => {
 const f = fixture(), outside = 'E:\\Outra pasta local';
 const approved = await f.adapters.resolveFolder(FOLDER);
 f.fs.entries.set(outside.toLowerCase(), { kind: 'folder' });
 f.fs.entries.set(FOLDER.toLowerCase(), { kind: 'folder', canonical: outside });
 await assert.rejects(f.adapters.openFolder(approved.path), /mudou desde a confirmação/);
 assert.equal(f.opened.length, 0); assert.equal(f.calls.length, 0);
});

test('openPath failure is redacted and never misreported as an observed folder window', async () => {
 const f = fixture({ openPath: async () => 'private-shell-detail' });
 await assert.rejects(f.adapters.openFolder(FOLDER), error => /não conseguiu encaminhar/.test(error.message) && !error.message.includes('private-shell-detail'));
 const inconsistent = fixture({ openPath: async () => undefined });
 await assert.rejects(inconsistent.adapters.openFolder(FOLDER));
});

test('abort prevents dispatch, kills a pending inventory helper and suppresses later success', async () => {
 const before = new AbortController(); before.abort(); const f = fixture();
 await assert.rejects(f.adapters.findApps('Editor', { signal: before.signal }), /cancelada/);
 await assert.rejects(f.adapters.resolveFolder(FOLDER, { signal: before.signal }), /cancelada/);
 await assert.rejects(f.adapters.openFolder(FOLDER, { signal: before.signal }), /cancelada/);
 assert.equal(f.calls.length, 0); assert.equal(f.fs.reads.length, 0);
 const pending = fixture({ responder: () => undefined }), controller = new AbortController();
 const promise = pending.adapters.findApps('Editor', { signal: controller.signal }); await flush();
 controller.abort(); await assert.rejects(promise, /cancelada/); assert.equal(pending.calls[0].child.kills, 1);
 pending.calls[0].child.stdout.emit('data', Buffer.from(JSON.stringify({ apps: [] }))); pending.calls[0].child.emit('close', 0);
 assert.equal(pending.calls.length, 1);
});

test('malformed/oversized helper output and native failures do not become successful launches', async () => {
 const malformed = fixture({ responder: () => ({ raw: 'not-json private-detail' }) });
 await assert.rejects(malformed.adapters.findApps('Editor'), error => /confirmação válida/.test(error.message) && !error.message.includes('private-detail'));
 const oversized = fixture({ responder: () => ({ raw: 'x'.repeat(1_000_001) }) });
 await assert.rejects(oversized.adapters.findApps('Editor'), /limite de resposta/); assert.equal(oversized.calls[0].child.kills, 1);
 const failed = fixture({ responder: () => new Error('private-process-detail') });
 await assert.rejects(failed.adapters.findApps('Editor'), error => !error.message.includes('private-process-detail'));
});

test('legacy configured app, browser and dictation methods retain their contracts', async () => {
 const f = fixture({ configured: [{ id: 'vscode', label: 'Editor', path: EXE }], responder: () => ({ verified: true, summary: 'Janela confirmada.', pid: 123 }) });
 assert.equal((await f.adapters.openApp('vscode')).verified, true); assert.equal(f.calls[0].action, 'OpenApp'); assert.deepEqual(f.calls[0].payload, { path: EXE });
 assert.equal((await f.adapters.dictateNotes('Texto seguro.')).verified, true); assert.equal(f.calls[1].action, 'DictateNotes'); assert.deepEqual(f.calls[1].payload, { text: 'Texto seguro.' });
 assert.equal((await f.adapters.openBrowser('https://example.com')).verified, false); assert.deepEqual(f.external, ['https://example.com/']);
 await assert.rejects(f.adapters.openBrowser('javascript:alert(1)')); assert.equal(f.external.length, 1);
});

test('unsupported platforms refuse native discovery and folders without spawning or opening', async () => {
 const f = fixture({ platform: 'linux' });
 await assert.rejects(f.adapters.findApps('Editor'), /exige Windows/); await assert.rejects(f.adapters.resolveFolder(FOLDER), /exige Windows/); await assert.rejects(f.adapters.openFolder(FOLDER), /exige Windows/);
 assert.equal(f.calls.length, 0); assert.equal(f.opened.length, 0);
});

test('Windows PowerShell parses the helper AST without executing any application action', { skip: process.platform !== 'win32' }, () => {
 const helper = fileURLToPath(new URL('../apps/desktop/platform/windows.ps1', import.meta.url));
 const encodedPath = Buffer.from(helper, 'utf8').toString('base64');
 const script = `$tokens=$null;$errors=$null;$path=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'));[void][System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors);if($errors.Count){$errors|ForEach-Object{$_.Message};exit 1}`;
 const result = spawnSync(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
 assert.equal(result.status, 0, `${result.stdout || ''}${result.stderr || ''}`);
});
