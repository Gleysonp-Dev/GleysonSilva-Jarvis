import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';
import { UltronCommands, UltronCommandError } from '../packages/ultron/commands.mjs';
import { createRuntime as createRealRuntime } from '../packages/runtime/index.mjs';
import { FIRE_TV_ACTIONS, FIRE_TV_APPS } from '../apps/desktop/fire-tv.mjs';

const require = createRequire(import.meta.url);
const mainURL = new URL('../apps/desktop/main.mjs', import.meta.url);
// The real main and its registered handlers run in memory; Electron/OS/provider boundaries are replaced.
const source = `${await readFile(mainURL, 'utf8')}\nexport { requestShutdown }; export function setSmokeForTest() { smoke = {}; }`;
const { code } = await transform(source, { format: 'cjs', target: 'node24', define: { 'import.meta.url': JSON.stringify(mainURL.href) } });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };

async function fixture(t, { blockWake = false, resetFailure = false, lateContext = false, lateOutfit = false, ultronEnabled = false, lateFireTv = false, lateRemote = false, lateTool = false, noOpenAIKey = false, realRuntime = false, platform = 'win32', tvEffectFailure = false } = {}) {
  const calls = { mute: 0, destroy: 0, hide: 0, speechReset: 0, wakeStop: 0, visionClose: 0, runtimeClose: 0, trayDestroy: 0, quit: 0, cancelledRuns: [], signals: [], errors: [], fullscreen: [], sent: [] };
  const wake = deferred(), context = deferred(), outfit = deferred(), tv = deferred(), remote = deferred(), tool = deferred(), remoteReplies = [], ipc = new Map(), windows = [], trays = [];
  const runtimeDirectory = realRuntime ? await mkdtemp(path.join(os.tmpdir(), 'jarvis-fire-tv-remote-')) : undefined;
  if (runtimeDirectory) await mkdir(path.join(runtimeDirectory, 'workspace'));
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
  const settings = class { get() { return structuredClone(current); } write(value) { Object.assign(current, value); } save(value) { Object.assign(current, value); } public() { return { ...current, hasKey:Boolean(this.getSecret()), hasElevenKey:Boolean(this.getElevenSecret()) }; } getFireTvKeyRecord() { return current.fireTvPaired ? {host:current.fireTvHost,profileId:current.profileId,paired:true} : null; } getSecret() { calls.openAIKeyReads = (calls.openAIKeyReads ?? 0) + 1; return noOpenAIKey ? '' : 'fake-key'; } getElevenSecret() { return 'fake-key'; } };
  const blocking = (_input, { signal }) => new Promise((resolve, reject) => { calls.signals.push(signal); signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }); });
  let adapters, ultronHandle;
  let runtime = { cancel(id) { calls.cancelledRuns.push(id); }, approve() {}, async call(input, options) { (calls.ultronTools ??= []).push({ input, options }); (calls.runtimeCalls ??= []).push({ input, options }); return remoteReplies.length && input.name.startsWith('tv_') ? remoteReplies.shift() : lateRemote && input.name.startsWith('tv_') ? remote.promise : { ok: true, status: 'unverified', summary: 'Dispatched', data: input.args }; }, async close() { calls.runtimeClose++; }, getSnapshot() { return { memories: [], tasks: [], procedures: [] }; } };
  const session = { setPermissionRequestHandler() {}, setPermissionCheckHandler() {}, setDevicePermissionHandler() {}, on() {} };
  const mocks = {
    electron: { app, BrowserWindow: Window, Tray, Menu: { buildFromTemplate: value => value }, nativeImage: { createFromBuffer: () => ({}) }, dialog: {}, ipcMain: { handle: (name, handler) => ipc.set(name, handler) }, protocol: { registerSchemesAsPrivileged() {}, handle() {} }, safeStorage: {}, session: { defaultSession: session }, shell: { async openExternal(url) { (calls.external ??= []).push(url); } } },
    'node:fs/promises': { async mkdir() {}, readFile() { throw new Error('Unexpected file access.'); } },
    '../../packages/runtime/index.mjs': { createRuntime: options => {
      adapters = options.platformAdapters;
      if (runtimeDirectory) {
        const actual = createRealRuntime({ ...options, dataDir: path.join(runtimeDirectory, 'private'), workspaceRoot: path.join(runtimeDirectory, 'workspace') });
        runtime = { ...actual, call(input, options) { (calls.runtimeCalls ??= []).push({ input, options }); return actual.call(input, options); }, cancel(id) { calls.cancelledRuns.push(id); return actual.cancel(id); }, async close() { calls.runtimeClose++; await actual.close(); } };
      }
      return runtime;
    } },
    '../../packages/openai/index.mjs': { OpenAIService: class { respond = (...args) => { calls.providerRespond = (calls.providerRespond ?? 0) + 1; return blocking(...args); }; executeRealtimeTool = async (input, options) => { calls.providerTool = { input, options }; return lateTool ? tool.promise : {ok:true,status:'unverified'}; }; createRealtimeSession = async (input, options) => { calls.realtimeConnection = {input,options}; return {sdp:'fake-answer'}; }; searchWeb = async (input, options) => { calls.search = { input, options }; return { text: 'Search test', sources: [] }; }; describeOutfit = async (input, options) => { calls.outfit = { input, options }; return lateOutfit ? outfit.promise : { text: 'Roupa de teste.', observedAt: Date.now() }; }; }, OpenAIServiceError: class extends Error {} },
    './fire-tv.mjs': { FIRE_TV_ACTIONS, FIRE_TV_APPS, FireTVError: class extends Error {}, FireTVController: class {
      constructor(options) { calls.tvOptions = options; }
      reset() { calls.tvReset = (calls.tvReset ?? 0) + 1; }
      async pair(options) { calls.tvPair = options; return lateFireTv ? tv.promise : {ok:true,paired:true,summary:'Paired'}; }
      async status(options) { calls.tvStatus = options; return {ok:true,connected:true,properties:{model:'Test'},summary:'Connected'}; }
      async control(action,options) { calls.tvControl={action,options}; (calls.tvEffects ??= []).push({action}); if (tvEffectFailure) throw new Error('Falha de envio; confira a TV antes de repetir.'); return {ok:true,status:'unverified',action}; }
      async openApp(application,options) { calls.tvOpen={application,options}; (calls.tvEffects ??= []).push({app:application}); if (tvEffectFailure) throw new Error('Falha de envio; confira a TV antes de repetir.'); return {ok:true,status:'unverified',app:application}; }
    } },
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
    './youtube-window.mjs': { createYouTubeWindowFactory: () => () => { throw new Error('Unexpected YouTube window.'); } },
    './youtube-smoke.mjs': { runYouTubeFixtureSmoke: () => { throw new Error('Unexpected smoke fixture.'); } },
    './youtube.mjs': { YouTubeController: class { search = async (query, options) => { calls.youtubeSearch = { query, options }; return { verified: true, results: [] }; }; play = async (videoId, options) => { calls.youtubePlay = { videoId, options }; return { verified: true }; }; control = async (action, options) => { calls.youtubeControl = { action, options }; return { verified: true }; }; close() { calls.youtubeClose = (calls.youtubeClose ?? 0) + 1; } } },
  };
  const module = { exports: {} };
  const process = { platform, argv: ['Jarvis.exe'], env: {}, resourcesPath: 'C:\\fake-engine', stdout: { write() {} } };
  new Function('require', 'module', 'exports', 'process', 'console', code)(name => Object.hasOwn(mocks, name) ? mocks[name] : require(name), module, module.exports, process, { error: value => calls.errors.push(value) });
  await flush(); assert.equal(windows.length, 1); assert.equal(ipc.has('jarvis:text'), true);
  const window = windows[0];
  const invoke = (name, input) => ipc.get('jarvis:' + name)({ sender: window.webContents, senderFrame: window.webContents.mainFrame }, input);
  t.after(async () => {
    wake.resolve(); remote.resolve({ok:false,status:'cancelled',summary:'Cancelled'}); tool.resolve({ok:false,status:'cancelled'}); await module.exports.requestShutdown('test_cleanup');
    if (runtimeDirectory) { const target = path.resolve(runtimeDirectory), prefix = path.resolve(os.tmpdir()) + path.sep + 'jarvis-fire-tv-remote-'; assert(target.startsWith(prefix)); await rm(target, { recursive: true, force: true }); }
  });
  return { calls, app, window, trays, invoke, hasHandler: name => ipc.has('jarvis:' + name), invokeFrom: (event, name, input) => ipc.get('jarvis:' + name)(event, input), invokeUltron: (method, args = {}, scope = {}) => ultronHandle(method, args, { id: crypto.randomUUID(), ...scope }), adapters, preferences: current, releaseWake: wake.resolve, resolveContext: context.resolve, resolveOutfit: outfit.resolve, resolveFireTv: tv.resolve, resolveRemote: remote.resolve, queueRemoteReply: value => remoteReplies.push(value), resolveTool: tool.resolve, setSmoke: module.exports.setSmokeForTest, shutdown: module.exports.requestShutdown };
}
const remoteInput = fields => ({ id: crypto.randomUUID(), runId: crypto.randomUUID(), profileId: 'default', ...fields });
const remoteCancelInput = ({id,runId,profileId}) => ({id,runId,profileId});
const remoteConfigured = fixture => { fixture.preferences.fireTvEnabled = true; fixture.preferences.fireTvPaired = true; fixture.preferences.fireTvHost='10.0.0.25'; return fixture; };

test('Fire TV virtual remote reaches the real journal directly without an OpenAI key, model or provider call', async t => {
  const f = remoteConfigured(await fixture(t, { noOpenAIKey: true, realRuntime: true }));
  const button = remoteInput({action:'home'}), app = remoteInput({app:'netflix'});
  const actionResult = await f.invoke('fireTvRemote', button), appResult = await f.invoke('fireTvRemote', app);
  assert.equal(actionResult.ok,true); assert.equal(actionResult.status,'unverified'); assert.deepEqual(actionResult.data,{action:'home'});
  assert.equal(appResult.ok,true); assert.equal(appResult.status,'unverified'); assert.deepEqual(appResult.data,{app:'netflix'});
  assert.deepEqual(f.calls.tvEffects,[{action:'home'},{app:'netflix'}]);
  assert.deepEqual(f.calls.runtimeCalls.map(({input})=>input),[
    {id:button.id,runId:button.runId,profileId:'default',name:'tv_control',args:{action:'home'}},
    {id:app.id,runId:app.runId,profileId:'default',name:'tv_open_app',args:{app:'netflix'}},
  ]);
  assert.equal(f.calls.openAIKeyReads,undefined); assert.equal(f.calls.providerRespond,undefined); assert.equal(f.calls.providerTool,undefined);
  assert(f.calls.sent.some(([,event])=>event.type==='action'&&event.tool==='tv_control'&&event.status==='unverified'));
  assert.equal((await f.invoke('boot')).snapshot.tasks.some(task=>task.status==='unverified'),true);
});

test('Fire TV virtual remote preserves durable ID deduplication and rejects a changed payload without another TV effect', async t => {
  const f = remoteConfigured(await fixture(t,{realRuntime:true})), request=remoteInput({action:'ok'});
  const first=await f.invoke('fireTvRemote',request), replay=await f.invoke('fireTvRemote',{...request,runId:crypto.randomUUID()});
  assert.deepEqual(replay,first); assert.deepEqual(f.calls.tvEffects,[{action:'ok'}]);
  const changed=await f.invoke('fireTvRemote',{...request,action:'right',runId:crypto.randomUUID()});
  assert.equal(changed.ok,false); assert.match(changed.summary,/ID já foi usado/); assert.deepEqual(f.calls.tvEffects,[{action:'ok'}]);
});

test('Fire TV virtual remote never repeats an uncertain failed effect even when the same request is retried', async t => {
  const f=remoteConfigured(await fixture(t,{realRuntime:true,tvEffectFailure:true})),request=remoteInput({app:'netflix'});
  const failed=await f.invoke('fireTvRemote',request); assert.equal(failed.ok,false);
  assert.deepEqual(await f.invoke('fireTvRemote',request),failed); assert.deepEqual(f.calls.tvEffects,[{app:'netflix'}]);
  assert.equal(f.calls.providerTool,undefined);
});

test('Fire TV virtual remote accepts exactly one allowlisted action or app, with explicit valid request and profile IDs', async t => {
  const f=remoteConfigured(await fixture(t));
  const malformed=[{}, {action:'home',app:'netflix'}, {action:'power'}, {action:'right; reboot'}, {app:'com.netflix.ninja'}, {app:'__proto__'},
    {action:'home',host:'10.0.0.25'},{app:'netflix',package:'com.netflix.ninja'},{action:'home',command:'input keyevent 3'},
    {action:'home',id:''},{action:'home',runId:'bad id'},{action:'home',profileId:undefined},{action:undefined},{app:null}];
  for(const fields of malformed) await assert.rejects(f.invoke('fireTvRemote',remoteInput(fields)));
  for(const action of FIRE_TV_ACTIONS) assert.equal((await f.invoke('fireTvRemote',remoteInput({action}))).ok,true);
  for(const app of Object.keys(FIRE_TV_APPS)) assert.equal((await f.invoke('fireTvRemote',remoteInput({app}))).ok,true);
  assert.equal(f.calls.runtimeCalls.length,FIRE_TV_ACTIONS.length+Object.keys(FIRE_TV_APPS).length);
  for(const malformed of [undefined,{}, {runId:'other'}, {...remoteCancelInput(remoteInput({action:'home'})),host:'10.0.0.25'}]) await assert.rejects(f.invoke('cancelFireTvRemote',malformed));
});

test('Fire TV virtual remote and cancellation require the trusted main frame and current profile', async t => {
  const f=remoteConfigured(await fixture(t)), request=remoteInput({action:'home'}),frame=f.window.webContents.mainFrame;
  for(const event of [{sender:{},senderFrame:frame},{sender:f.window.webContents,senderFrame:{...frame}},{sender:f.window.webContents,senderFrame:undefined}]){
    await assert.rejects(f.invokeFrom(event,'fireTvRemote',request),/origem/);await assert.rejects(f.invokeFrom(event,'cancelFireTvRemote'),/origem/);
  }
  frame.url='https://example.com/'; await assert.rejects(f.invoke('fireTvRemote',request),/origem/); frame.url='jarvis://app/index.html';
  await assert.rejects(f.invoke('fireTvRemote',{...request,profileId:'other'}),/perfil mudou/);
  assert.equal(f.calls.runtimeCalls,undefined);assert.deepEqual(await f.invoke('cancelFireTvRemote',remoteCancelInput(request)),{cancelled:false});
});

test('Fire TV virtual remote rejects missing pairing, disabled settings, unsupported hosts and smoke mode before dispatch',async t=>{
  const f=await fixture(t),request=remoteInput({action:'home'});
  await assert.rejects(f.invoke('fireTvRemote',request),/pareie/);
  f.preferences.fireTvEnabled=true;await assert.rejects(f.invoke('fireTvRemote',request),/pareie/);
  f.preferences.fireTvPaired=true;f.setSmoke();await assert.rejects(f.invoke('fireTvRemote',request),/aplicativo Windows/);assert.equal(f.calls.runtimeCalls,undefined);
  const other=remoteConfigured(await fixture(t,{platform:'darwin'}));await assert.rejects(other.invoke('fireTvRemote',request),/aplicativo Windows/);assert.equal(other.calls.runtimeCalls,undefined);
});

test('Fire TV virtual remote blocks concurrent buttons, pairing and model tools until its flight finishes',async t=>{
  const f=remoteConfigured(await fixture(t,{lateRemote:true})),request=remoteInput({action:'home'}),pending=f.invoke('fireTvRemote',request);
  await flush();
  await assert.rejects(f.invoke('fireTvRemote',remoteInput({action:'back'})),/Aguarde/);
  await assert.rejects(f.invoke('pairFireTv'),/Interrompa/);await assert.rejects(f.invoke('testFireTv'),/Interrompa/);
  await assert.rejects(f.invoke('text',{runId:'blocked',text:'test',history:[]}),/controle da TV/);
  await assert.rejects(f.invoke('callTool',{id:'blocked',runId:'blocked',name:'tv_control',args:{action:'home'}}),/controle da TV/);
  assert.equal(f.calls.runtimeCalls.length,1);f.resolveRemote({ok:true,status:'unverified',summary:'Dispatched'});await pending;
  assert.equal((await f.invoke('pairFireTv')).status,'paired');
});

test('Fire TV virtual remote rejects active pairing, text and tool work but permits a connected idle voice session',async t=>{
  const paired=remoteConfigured(await fixture(t,{lateFireTv:true})),pairing=paired.invoke('pairFireTv');await flush();
  await assert.rejects(paired.invoke('fireTvRemote',remoteInput({action:'home'})),/Aguarde/);paired.resolveFireTv({ok:true,summary:'Paired'});await pairing;
  const text=remoteConfigured(await fixture(t)),responding=text.invoke('text',{runId:'active-text',text:'test',history:[]});const stopped=assert.rejects(responding);await flush();
  await assert.rejects(text.invoke('fireTvRemote',remoteInput({action:'home'})),/Aguarde/);await text.invoke('cancel','active-text');await stopped;
  const tool=remoteConfigured(await fixture(t,{lateTool:true})),working=tool.invoke('callTool',{id:'active-tool',runId:'tool-run',name:'tv_control',args:{action:'home'}});await flush();
  await assert.rejects(tool.invoke('fireTvRemote',remoteInput({action:'home'})),/Aguarde/);tool.resolveTool({ok:true,status:'unverified'});await working;
  const voice=remoteConfigured(await fixture(t));await voice.invoke('realtimeSession',{profileId:'default',sdp:'fake-offer'});const wakeStops=voice.calls.wakeStop;
  assert.equal((await voice.invoke('fireTvRemote',remoteInput({action:'home'}))).ok,true);assert.equal(voice.calls.wakeStop,wakeStops);assert.equal(voice.calls.speechReset,0);
});

test('cancelling a Fire TV remote flight stops only that dispatch and suppresses late success without resetting voice',async t=>{
  const f=remoteConfigured(await fixture(t,{lateRemote:true})),request=remoteInput({action:'right'}),pending=f.invoke('fireTvRemote',request),rejected=assert.rejects(pending,/interrompido/);
  await flush();const signal=f.calls.runtimeCalls[0].options.signal;
  assert.deepEqual(await f.invoke('cancelFireTvRemote',remoteCancelInput(request)),{cancelled:true});assert.equal(signal.aborted,true);assert.deepEqual(f.calls.cancelledRuns,[request.runId]);
  assert.equal(f.calls.speechReset,0);assert.equal(f.calls.wakeStop,0);assert.equal(f.calls.tvReset,undefined);assert.equal(f.calls.sent.some(([,event])=>event.type==='session.reset'),false);
  f.resolveRemote({ok:true,status:'unverified',summary:'Late result'});await rejected;
  assert.deepEqual(await f.invoke('cancelFireTvRemote',remoteCancelInput(request)),{cancelled:false});assert.equal((await f.invoke('pairFireTv')).status,'paired');
});

test('a delayed cancellation for a completed TV request cannot abort a newer request or idle voice',async t=>{
  const f=remoteConfigured(await fixture(t)),first=remoteInput({action:'home'});
  await f.invoke('fireTvRemote',first);const waiting=deferred();f.queueRemoteReply(waiting.promise);
  const second=remoteInput({action:'right'}),pending=f.invoke('fireTvRemote',second),rejected=assert.rejects(pending,/interrompido/);await flush();
  const firstSignal=f.calls.runtimeCalls[0].options.signal,secondSignal=f.calls.runtimeCalls[1].options.signal;
  assert.deepEqual(await f.invoke('cancelFireTvRemote',remoteCancelInput(first)),{cancelled:false});assert.equal(firstSignal.aborted,false);assert.equal(secondSignal.aborted,false);assert.deepEqual(f.calls.cancelledRuns,[]);
  for(const mismatch of [{id:first.id},{runId:first.runId},{profileId:'another-profile'}]){
    assert.deepEqual(await f.invoke('cancelFireTvRemote',{...remoteCancelInput(second),...mismatch}),{cancelled:false});assert.equal(secondSignal.aborted,false);
  }
  assert.deepEqual(await f.invoke('cancelFireTvRemote',remoteCancelInput(second)),{cancelled:true});assert.equal(secondSignal.aborted,true);assert.deepEqual(f.calls.cancelledRuns,[second.runId]);
  assert.equal(f.calls.speechReset,0);assert.equal(f.calls.wakeStop,0);assert.equal(f.calls.sent.some(([,event])=>event.type==='session.reset'),false);
  waiting.resolve({ok:true,status:'unverified',summary:'Late second reply'});await rejected;
});

test('profile changes and X abort a Fire TV remote flight and prevent its old result returning to the interface',async t=>{
  for(const close of [false,true]){
    const f=remoteConfigured(await fixture(t,{lateRemote:true})),request=remoteInput({app:'netflix'}),pending=f.invoke('fireTvRemote',request),rejected=assert.rejects(pending,/interrompido/);await flush();
    const signal=f.calls.runtimeCalls[0].options.signal;
    if(close) await f.shutdown('window_closed');else await f.invoke('saveSettings',{profileId:'other'});
    assert.equal(signal.aborted,true);assert(f.calls.cancelledRuns.includes(request.runId));f.resolveRemote({ok:true,status:'unverified',summary:'Old profile private result'});await rejected;
  }
});

test('preload forwards the virtual Fire TV remote over fixed IPC channels and exposes no additional TV internals',async()=>{
  const preload=await readFile(new URL('../apps/desktop/preload.cjs',import.meta.url),'utf8'),calls=[];let bridge;
  new Function('require',preload)(name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld(name,value){assert.equal(name,'jarvis');bridge=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return {ok:true};}}};});
  const request=remoteInput({action:'ok'}),cancellation=remoteCancelInput(request);await bridge.fireTvRemote(request);await bridge.cancelFireTvRemote(cancellation);
  assert.deepEqual(calls,[['jarvis:fireTvRemote',request],['jarvis:cancelFireTvRemote',cancellation]]);assert.equal(bridge.adb,undefined);assert.equal(bridge.shell,undefined);assert.equal(bridge.fireTvHost,undefined);assert.equal(Object.isFrozen(bridge),true);
});

test('Fire TV native configuration is explicit, private and remains usable after a completed voice tool', async t => {
  const f = await fixture(t);assert.equal((await f.invoke('boot')).capabilities.fireTv,true);assert.equal(f.calls.tvPair,undefined);
  await f.invoke('callTool',{id:'tv-call',runId:'voice-tool',name:'tv_control',args:{action:'home'}});
  assert.equal((await f.invoke('pairFireTv')).status,'paired');assert(f.calls.tvPair.signal instanceof AbortSignal);
  assert.equal((await f.invoke('testFireTv')).status,'connected');
  await f.adapters.openFireTvApp('netflix',{profileId:'default'});assert.equal(f.calls.tvOpen.application,'netflix');
  assert.throws(()=>f.adapters.controlFireTv('home',{profileId:'other'}),/perfil mudou/);
  await assert.rejects(f.invoke('pairFireTv',{host:'10.0.0.3'}),/Argumento/);
  f.calls.tvOptions.onEvent({type:'approval_required'});assert(f.calls.sent.some(([,event])=>event.type==='fire_tv_pairing'&&event.state==='approval_required'));
});
test('Fire TV configuration rejects concurrent work and cancellation suppresses late pairing answers',async t=>{
  const f=await fixture(t,{lateFireTv:true});const pending=f.invoke('pairFireTv');await flush();
  await assert.rejects(f.invoke('text',{text:'test',runId:'blocked'}),/Fire TV/);
  await assert.rejects(f.invoke('callTool',{id:'blocked',runId:'blocked',name:'tv_control',args:{action:'home'}}),/Fire TV/);
  await assert.rejects(f.invoke('pairFireTv'),/sessão/);
  const rejected=assert.rejects(pending,/interrompida/);await f.invoke('cancelFireTv');assert.equal(f.calls.tvPair.signal.aborted,true);
  f.resolveFireTv({ok:true,paired:true});await rejected;assert(f.calls.tvReset>=1);
});

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

test('retired outfit observation has no IPC route or capability even with the old preference enabled', async t => {
  const f = await fixture(t);
  f.preferences.receptionOutfitEnabled = true;
  assert.equal((await f.invoke('boot')).capabilities.outfitObservation, undefined);
  assert.equal(f.hasHandler('observeOutfit'), false);
  assert.equal(f.hasHandler('cancelOutfit'), false);
  assert.equal(f.hasHandler('vision'), true);
  assert.equal(f.calls.outfit, undefined);
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

test('YouTube adapters forward the current operation scope and close before slow shutdown cleanup', async t => {
  const f = await fixture(t, { blockWake: true }), signal = new AbortController().signal, options = { signal, profileId: 'default' };
  await f.adapters.searchYouTube('Banda Música', options);
  await f.adapters.playYouTube('abcdefghijk', options);
  await f.adapters.controlYouTube('pause', options);
  assert.deepEqual(f.calls.youtubeSearch, { query: 'Banda Música', options });
  assert.deepEqual(f.calls.youtubePlay, { videoId: 'abcdefghijk', options });
  assert.deepEqual(f.calls.youtubeControl, { action: 'pause', options });
  const stopped = f.shutdown('window_closed'); assert.equal(f.calls.youtubeClose, 1);
  f.releaseWake(); await stopped;
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
