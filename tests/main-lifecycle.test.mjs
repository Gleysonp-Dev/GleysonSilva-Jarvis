import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';
import { ReceptionObservation, ReceptionError } from '../packages/reception/index.mjs';
import { UltronCommands, UltronCommandError } from '../packages/ultron/commands.mjs';

const require = createRequire(import.meta.url);
const mainURL = new URL('../apps/desktop/main.mjs', import.meta.url);
// The real main and its registered handlers run in memory; Electron/OS/provider boundaries are replaced.
const source = `${await readFile(mainURL, 'utf8')}\nexport { requestShutdown };`;
const { code } = await transform(source, { format: 'cjs', target: 'node24', define: { 'import.meta.url': JSON.stringify(mainURL.href) } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };

async function fixture(t, { blockWake = false, resetFailure = false, lateContext = false, lateOutfit = false, ultronEnabled = false } = {}) {
  const calls = { mute: 0, destroy: 0, hide: 0, speechReset: 0, wakeStop: 0, visionClose: 0, runtimeClose: 0, trayDestroy: 0, quit: 0, cancelledRuns: [], signals: [], errors: [], fullscreen: [], sent: [] };
  const wake = deferred(), context = deferred(), outfit = deferred(), ipc = new Map(), windows = [], trays = [];
  const current = { profileId: 'default', standbyEnabled: true, startAtLogin: false, wakeVoiceEnabled: true, startupGreeting: true, apps: [], elevenVoiceId: 'testVoice', ultronEnabled };
  const app = new EventEmitter();
  Object.assign(app, { isPackaged: true, setName() {}, enableSandbox() {}, requestSingleInstanceLock: () => true, whenReady: async () => {}, getPath: () => 'C:\\fake-private-data', isReady: () => true,
    quit() { const event = { prevented: false, preventDefault() { this.prevented = true; } }; this.emit('before-quit', event); if (!event.prevented) calls.quit++; }, exit() { throw new Error('Unexpected forced exit.'); } });
  class Window extends EventEmitter {
    destroyed = false;
    fullscreen = false;
    constructor() {
      super(); this.webContents = new EventEmitter(); const contents = this.webContents;
      contents.mainFrame = { origin: 'jarvis://app', url: 'jarvis://app/index.html' };
      Object.assign(contents, { isDestroyed: () => this.destroyed, setAudioMuted(value) { assert.equal(value, true); calls.mute++; }, setWindowOpenHandler() {}, send(...args) { calls.sent.push(args); } });
      windows.push(this);
    }
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; calls.destroy++; this.webContents.emit('render-process-gone'); this.emit('closed'); app.emit('window-all-closed'); }
    hide() { calls.hide++; }
    isFullScreen() { return this.fullscreen; }
    setFullScreen(enabled) { calls.fullscreen.push(enabled); this.fullscreen = enabled; this.emit(enabled ? 'enter-full-screen' : 'leave-full-screen'); }
    show() {} focus() {} isMinimized() { return false; }
    minimize() { this.emit('minimize'); }
    async loadURL() {}
  }
  class Tray { constructor() { trays.push(this); } setToolTip() {} on() {} setContextMenu(menu) { this.menu = menu; } destroy() { calls.trayDestroy++; } }
  const settings = class { get() { return structuredClone(current); } write(value) { Object.assign(current, value); } save(value) { Object.assign(current, value); } public() { return { ...current }; } getSecret() { return 'fake-key'; } getElevenSecret() { return 'fake-key'; } };
  const blocking = (_input, { signal }) => new Promise((resolve, reject) => { calls.signals.push(signal); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }); });
  let adapters, ultronHandle;
  const runtime = { cancel(id) { calls.cancelledRuns.push(id); }, approve() {}, async call(input, options) { (calls.ultronTools ??= []).push({ input, options }); return { ok: true, status: 'unverified', summary: 'Dispatched' }; }, async close() { calls.runtimeClose++; }, getSnapshot() { return { memories: [], tasks: [], procedures: [] }; } };
  const session = { setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {}, on() {} };
  const mocks = {
    electron: { app, BrowserWindow: Window, Tray, Menu: { buildFromTemplate: value => value }, nativeImage: { createFromBuffer: () => ({}) }, dialog: {}, ipcMain: { handle: (name, handler) => ipc.set(name, handler) }, protocol: { registerSchemesAsPrivileged() {}, handle() {} }, safeStorage: {}, session: { defaultSession: session }, shell: { async openExternal(url) { (calls.external ??= []).push(url); } } },
    'node:fs/promises': { async mkdir() {}, readFile() { throw new Error('Unexpected file access.'); } },
    '../../packages/runtime/index.mjs': { createRuntime: options => { adapters = options.platformAdapters; return runtime; } },
    '../../packages/openai/index.mjs': { OpenAIService: class { respond = blocking; searchWeb = async (input, options) => { calls.search = { input, options }; return { text: 'Search test', sources: [] }; }; describeOutfit = async (input, options) => { calls.outfit = { input, options }; return lateOutfit ? outfit.promise : { text: 'Roupa de teste.', observedAt: Date.now() }; }; }, OpenAIServiceError: class extends Error {} },
    '../../packages/reception/index.mjs': { ReceptionObservation, ReceptionError },
    '../../packages/ultron/commands.mjs': { UltronCommands, UltronCommandError },
    '../../packages/ultron/index.mjs': { async createUltronBridge({ handle }) { calls.ultronCreates = (calls.ultronCreates ?? 0) + 1; ultronHandle = handle; return { async close() { calls.ultronCloses = (calls.ultronCloses ?? 0) + 1; } }; } },
    '../../packages/web/index.mjs': { WebService: class { read = async (input, options) => { calls.website = { input, options }; return { text: 'Website test', sources: [] }; }; } },
    './settings.mjs': { SettingsStore: settings, validateSettings: value => value },
    './platform/windows.mjs': { createWindowsAdapters: () => ({}) },
    './vision.mjs': { VisionService: class { async handle(input) { if (input.type === 'reset' && resetFailure) throw new Error('reset failed'); return { available: false }; } close() { calls.visionClose++; } } },
    '../../packages/greeting/index.mjs': { StartupGreetingService: class { prepare = blocking; readWeather = async (input, options) => { calls.weather = { input, options }; return { status: 'ok' }; }; } },
    '../../packages/context/index.mjs': { ContextService: class { read(input, options) { if (!lateContext) return blocking(input, options); calls.signals.push(options.signal); return context.promise; } }, ContextError: class extends Error {} },
    '../../packages/speech/index.mjs': { SpeechService: class {}, SpeechServiceError: class extends Error {} },
    '../../packages/speech/controller.mjs': { SpeechController: class { reset() { calls.speechReset++; } }, SpeechControlError: class extends Error {} },
    './startup.mjs': { configureStartup: () => ({ available: true, enabled: false }), isStandbyLaunch: () => false, WindowsWakeService: class { async stop() { calls.wakeStop++; if (blockWake) await wake.promise; } } },
    './greeting-music.mjs': { GreetingMusicStore: class { available() { return false; } } },
    './tray-icon.mjs': { TRAY_ICON: '' },
  };
  const module = { exports: {} };
  const process = { platform: 'win32', argv: ['Jarvis.exe'], env: {}, resourcesPath: 'C:\\fake-engine', stdout: { write() {} } };
  new Function('require', 'module', 'exports', 'process', 'console', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports, process, { error: value => calls.errors.push(value) });
  await flush(); assert.equal(windows.length, 1); assert.equal(ipc.has('jarvis:text'), true);
  const window = windows[0];
  const invoke = (name, input) => ipc.get('jarvis:' + name)({ sender: window.webContents, senderFrame: window.webContents.mainFrame }, input);
  t.after(async () => { wake.resolve(); await module.exports.requestShutdown('test_cleanup'); });
  return { calls, app, window, trays, invoke, invokeFrom: (event, name, input) => ipc.get('jarvis:' + name)(event, input), invokeUltron: (method, args = {}, scope = {}) => ultronHandle(method, args, { id: crypto.randomUUID(), ...scope }), adapters, preferences: current, releaseWake: wake.resolve, resolveContext: context.resolve, resolveOutfit: outfit.resolve, shutdown: module.exports.requestShutdown };
}

test('Ultron stays disabled until explicitly saved and exposes only the five bounded capabilities', async t => {
  const f = await fixture(t);
  assert.equal(f.calls.ultronCreates, undefined); assert.equal((await f.invoke('boot')).capabilities.ultronBridge, true);
  await f.invoke('saveSettings', { ultronEnabled: true }); assert.equal(f.calls.ultronCreates, 1);
  const status = await f.invokeUltron('status');
  assert.equal(status.connected, true); assert.equal(status.voiceConfigured, true); assert.equal(JSON.stringify(status).includes('fake-key'), false);
  assert.deepEqual(status.tools, ['status', 'weather', 'open_browser', 'open_url', 'speak']);
  await assert.rejects(f.invokeUltron('shell', { command: 'anything' }), /inválida/);
  await assert.rejects(f.invokeUltron('open_browser', { url: 'https://example.org' }), /inválida/);
  assert.equal((await f.invokeUltron('open_browser')).status, 'unverified');
  assert.equal(f.calls.ultronTools.length, 1); assert.deepEqual(f.calls.ultronTools[0].input.args, { appId: 'browser' });
  assert.equal((await f.invokeUltron('open_url', { url: 'para-meditacao-app.com' })).status, 'unverified');
  assert.equal(f.calls.ultronTools[1].input.name, 'browser_open');
  assert.deepEqual(f.calls.ultronTools[1].input.args, { url: 'https://para-meditacao-app.com/' });
  for (const url of ['file:///C:/private.txt', 'javascript:alert(1)', 'https://user:password@example.org/']) await assert.rejects(f.invokeUltron('open_url', { url }), /inválida/);
  assert.equal(f.calls.ultronTools.length, 2);
  assert.equal((await f.invokeUltron('weather')).status, 'ok'); assert.equal(f.calls.weather.options.refresh, true);
  await f.invoke('saveSettings', { ultronEnabled: false }); assert.equal(f.calls.ultronCloses, 1);
  await assert.rejects(f.invokeUltron('status'), /Ative/);
});

test('Ultron speech completes only after the trusted renderer receipt and reset rejects late speech', async t => {
  const f = await fixture(t, { ultronEnabled: true });
  const pending = f.invokeUltron('speak', { text: 'Teste privado de voz.' });
  const event = f.calls.sent.at(-1)[1]; assert.equal(event.type, 'ultron.speak');
  await assert.rejects(f.invokeFrom({ sender: {}, senderFrame: f.window.webContents.mainFrame }, 'ultronPlaybackResult', { requestId: event.requestId, played: true }), /origem/);
  assert.equal(await f.invoke('ultronPlaybackResult', { requestId: event.requestId, played: true }), true);
  assert.deepEqual(await pending, { ok: true, played: true, evidence: 'renderer_audio_ended' });
  const next = f.invokeUltron('speak', { text: 'Este trecho será cancelado.' });
  const late = f.calls.sent.at(-1)[1], rejected = assert.rejects(next, /interrompida/);
  await f.invoke('saveSettings', { profileId: 'other' }); await rejected;
  assert.equal(await f.invoke('ultronPlaybackResult', { requestId: late.requestId, played: true }), false);
  assert(f.calls.sent.some(([, value]) => value.type === 'ultron.cancel' && value.requestId === late.requestId));
});

test('Interromper and shutdown cancel Ultron work without clearing the opt-in preference', async t => {
  const f = await fixture(t, { ultronEnabled: true });
  const pending = f.invokeUltron('speak', { text: 'Teste de interrupção.' }); const rejected = assert.rejects(pending, /interrompida/);
  assert.deepEqual(await f.invoke('cancelUltron'), { cancelled: true }); await rejected;
  assert.equal(f.preferences.ultronEnabled, true); assert.equal(f.calls.ultronCloses, undefined);
  const another = f.invokeUltron('speak', { text: 'Teste de fechamento.' }); const stopped = assert.rejects(another, /interrompida/);
  await f.shutdown('window_closed'); await stopped; assert.equal(f.calls.ultronCloses, 1);
});

test('fullscreen IPC enters, returns and publishes the actual native window state', async t => {
  const f = await fixture(t);
  assert.equal(await f.invoke('getFullscreen'), false);
  assert.equal(await f.invoke('setFullscreen', true), true);
  assert.equal(await f.invoke('getFullscreen'), true);
  assert.equal(await f.invoke('setFullscreen', false), false);
  assert.deepEqual(f.calls.fullscreen, [true, false]);
  assert.deepEqual(f.calls.sent.filter(([channel]) => channel === 'jarvis:fullscreen'), [['jarvis:fullscreen', true], ['jarvis:fullscreen', false]]);
  // A native transition can occur outside the renderer button (for example the OS).
  f.window.fullscreen = true; f.window.emit('enter-full-screen');
  assert.deepEqual(f.calls.sent.at(-1), ['jarvis:fullscreen', true]);
  await f.shutdown();
  const sent = f.calls.sent.length;
  f.window.emit('leave-full-screen');
  assert.equal(f.calls.sent.length, sent);
});

test('fullscreen IPC accepts only booleans from the trusted main frame and stops on shutdown', async t => {
  const f = await fixture(t), frame = f.window.webContents.mainFrame;
  for (const value of [undefined, null, 1, 0, 'true', {}, []]) await assert.rejects(f.invoke('setFullscreen', value), /inválido/);
  const untrusted = [
    { sender: {}, senderFrame: frame },
    { sender: f.window.webContents, senderFrame: { ...frame } },
    { sender: f.window.webContents, senderFrame: undefined },
  ];
  for (const event of untrusted) {
    await assert.rejects(f.invokeFrom(event, 'getFullscreen'), /origem não autorizada/);
    await assert.rejects(f.invokeFrom(event, 'setFullscreen', true), /origem não autorizada/);
  }
  const originalURL = frame.url;
  frame.url = 'https://example.org/';
  await assert.rejects(f.invoke('setFullscreen', true), /origem não autorizada/);
  frame.url = originalURL;
  assert.deepEqual(f.calls.fullscreen, []);
  await f.shutdown();
  await assert.rejects(f.invoke('setFullscreen', true));
  assert.deepEqual(f.calls.fullscreen, []);
});

test('fullscreen native errors are redacted without closing the app or stopping voice', async t => {
  const f = await fixture(t);
  f.window.setFullScreen = () => { throw new Error('C:\\private\\secret'); };
  await assert.rejects(f.invoke('setFullscreen', true), error => {
    assert.doesNotMatch(error.message, /private|secret/);
    return /operação não pôde ser concluída/.test(error.message);
  });
  assert.equal(f.window.isDestroyed(), false); assert.equal(f.calls.speechReset, 0); assert.equal(f.calls.wakeStop, 0);
});

test('outfit IPC requires enabled choice, exposes capability and aborts before X cleanup finishes', async t => {
  const f = await fixture(t, { lateOutfit: true });
  const input = { imageDataUrl: 'data:image/jpeg;base64,/9j/2Q==' };
  assert.equal((await f.invoke('boot')).capabilities.outfitObservation, true);
  await assert.rejects(f.invoke('observeOutfit', input), /Ative/); assert.equal(f.calls.outfit, undefined);
  f.preferences.receptionOutfitEnabled = true;
  const pending = f.invoke('observeOutfit', input); await flush();
  const rejected = assert.rejects(pending, /interrompida/);
  await f.shutdown('window_closed'); await rejected; assert.equal(f.calls.outfit.options.signal.aborted, true);
  f.resolveOutfit({ text: 'Late', observedAt: Date.now() }); await flush();
});

test('native runtime wires website, search and forced fresh weather without greeting', async t => {
  const f = await fixture(t); const signal = new AbortController().signal;
  assert.equal((await f.adapters.readWebsite({ url: 'https://example.com' }, { signal })).text, 'Website test');
  assert.equal(f.calls.website.options.signal, signal);
  assert.equal((await f.adapters.searchWeb({ query: 'current test' }, { signal })).text, 'Search test');
  assert.deepEqual(f.calls.search.input, { query: 'current test' });
  await f.adapters.readWeather({ signal, refresh: false });
  assert.deepEqual(f.calls.weather.input, {}); assert.equal(f.calls.weather.options.refresh, true); assert.equal(f.calls.weather.options.signal, signal);
});

test('requested sites dispatch through the default Windows browser and never create a dedicated window', async t => {
  const f = await fixture(t); const signal = new AbortController().signal;
  assert.deepEqual(await f.adapters.openBrowser('https://para-meditacao-app.com/', { signal }), { dispatched: true, verified: false, url: 'https://para-meditacao-app.com/' });
  assert.deepEqual(f.calls.external, ['https://para-meditacao-app.com/']);
  await assert.rejects(f.adapters.readBrowserSelection(), /navegador externo/);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(f.adapters.openBrowser('https://example.com/', { signal: cancelled.signal }), /cancelada/);
  for (const url of ['file:///C:/private.txt', 'javascript:alert(1)', 'https://user:password@example.org/']) await assert.rejects(f.adapters.openBrowser(url));
  assert.equal(f.calls.external.length, 1);
});

test('explicit source clicks open general HTTP(S) links but refuse files, protocols and credentials', async t => {
  const f = await fixture(t);
  assert.equal(await f.invoke('openExternal', 'https://example.org/research'), true);
  assert.equal(await f.invoke('openExternal', 'http://example.net/'), true);
  assert.deepEqual(f.calls.external, ['https://example.org/research', 'http://example.net/']);
  for (const value of ['file:///C:/secret.txt', 'javascript:alert(1)', 'ms-settings:privacy', 'https://user:pass@example.org/']) await assert.rejects(f.invoke('openExternal', value));
  assert.equal(f.calls.external.length, 2);
});

test('context bridge rejects caller-selected profiles and cancels reading without affecting speech', async t => {
  const f = await fixture(t);
  await assert.rejects(f.invoke('readContext', { timezone: 'UTC', profileId: 'other' }), /Argumento não permitido/);
  const reading = f.invoke('readContext', { timezone: 'UTC' });
  const rejected = assert.rejects(reading);
  await flush(); assert.equal(f.calls.signals.length, 1);
  assert.deepEqual(await f.invoke('cancelContext'), { cancelled: true });
  await rejected; assert.equal(f.calls.signals[0].aborted, true);
  assert.equal(f.calls.speechReset, 0);
  assert.deepEqual(await f.invoke('cancelContext'), { cancelled: false });
});

test('context results from an earlier profile cannot return after settings reset', async t => {
  const f = await fixture(t, { lateContext: true });
  const reading = f.invoke('readContext', { timezone: 'UTC' });
  const rejected = assert.rejects(reading, /leitura do contexto foi interrompida/);
  await flush();
  await f.invoke('saveSettings', { profileId: 'other' });
  assert.equal(f.calls.signals[0].aborted, true);
  f.resolveContext({ weather: { locationLabel: 'old-profile-private-data' } });
  await rejected;
});

test('X also aborts a context request before worker cleanup', async t => {
  const f = await fixture(t, { blockWake: true });
  const reading = f.invoke('readContext', { timezone: 'UTC' });
  const rejected = assert.rejects(reading);
  await flush(); f.window.emit('close', { preventDefault() {} });
  assert.equal(f.window.isDestroyed(), true); assert.equal(f.calls.signals[0].aborted, true);
  await rejected; f.releaseWake(); await f.shutdown();
});

test('X destroys the standby window immediately and cancels pending work before slow worker cleanup', async t => {
  const f = await fixture(t, { blockWake: true });
  const text = f.invoke('text', { profileId: 'default', runId: 'pending-text', text: 'test', history: [] });
  const greeting = f.invoke('startupGreeting', { hour: 9 });
  const pending = Promise.allSettled([text, greeting]);
  await flush(); assert.equal(f.calls.signals.length, 2);
  let prevented = false; f.window.emit('close', { preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(f.calls.hide, 0); assert.equal(f.calls.mute, 1); assert.equal(f.window.isDestroyed(), true);
  assert.equal(f.calls.signals.every(signal => signal.aborted), true); assert.deepEqual(f.calls.cancelledRuns, ['pending-text']);
  assert.equal(f.calls.speechReset, 1); assert.equal(f.calls.wakeStop, 1); assert.equal(f.calls.quit, 0);
  f.releaseWake(); await f.shutdown('duplicate');
  assert.equal((await pending).every(result => result.status === 'rejected'), true); assert.equal(f.calls.quit, 1);
});

test('before-quit, X, render teardown and tray exit share one cleanup and defer actual quit until it finishes', async t => {
  const f = await fixture(t, { blockWake: true });
  const event = { prevented: false, preventDefault() { this.prevented = true; } }; f.app.emit('before-quit', event);
  assert.equal(event.prevented, true); assert.equal(f.calls.destroy, 1); assert.equal(f.calls.mute, 1);
  const first = f.shutdown('again'); const second = f.shutdown('another'); assert.equal(first, second);
  f.window.emit('close', { preventDefault() {} }); f.app.emit('before-quit', { preventDefault() {} });
  f.trays[0].menu.find(item => item.label === 'Sair').click();
  assert.equal(f.calls.speechReset, 1); assert.equal(f.calls.wakeStop, 1); assert.equal(f.calls.quit, 0);
  f.releaseWake(); await first;
  assert.equal(f.calls.visionClose, 1); assert.equal(f.calls.runtimeClose, 1); assert.equal(f.calls.trayDestroy, 1); assert.equal(f.calls.quit, 1);
});

test('minimize preserves optional standby while X always exits, even with standby enabled', async t => {
  const f = await fixture(t); f.window.minimize();
  assert.equal(f.window.isDestroyed(), false); assert.equal(f.calls.mute, 0); assert.equal(f.calls.wakeStop, 0); assert.equal(f.calls.quit, 0);
  f.window.emit('close', { preventDefault() {} }); await f.shutdown();
  assert.equal(f.window.isDestroyed(), true); assert.equal(f.calls.hide, 0); assert.equal(f.calls.quit, 1);
});
