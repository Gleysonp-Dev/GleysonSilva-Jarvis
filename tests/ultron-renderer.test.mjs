import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { transform } from 'esbuild';
import { loadRendererModule } from './renderer-module-loader.mjs';

const require = createRequire(import.meta.url), React = require('react');
const source = `${await readFile(new URL('../apps/desktop/renderer/App.tsx', import.meta.url), 'utf8')}\nexport { App };`;
const { code } = await transform(source, { loader: 'tsx', jsx: 'automatic', format: 'cjs', target: 'node24' });
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)]; }
function text(tree) { if (typeof tree === 'string' || typeof tree === 'number') return String(tree); if (Array.isArray(tree)) return tree.map(text).join(''); return tree?.props ? text(tree.props.children) : ''; }
function button(tree, label) { const result = nodes(tree).find(node => node.type === 'button' && (node.props['aria-label'] === label || text(node).includes(label))); assert(result, `Missing button ${label}`); return result; }
const speechEvent = (requestId = 'request-1', fields = {}) => ({ type: 'ultron.speak', requestId, profileId: 'principal', text: 'Frase autorizada para narrar.', ...fields });

function environment(t, options = {}) {
  const slots = [], effects = [], subscribers = new Set(), listeners = new Map(), timers = [], calls = [], audios = [], sessions = [], acknowledgements = [], createdUrls = [], revokedUrls = [], saved = [];
  let cursor = 0, captureCount = 0;
  const hooks = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect, deps) { const index = cursor++, previous = slots[index]; if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) { slots[index] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); }); } },
  };
  const current = { profileId: 'principal', textModel: 'test-text', realtimeModel: 'test-voice', voice: 'legacy', maxSessionMinutes: 10, workspaceRoot: '', apps: [], hasKey: true, hasElevenKey: true, elevenVoiceId: 'configured-voice', weatherLocation: { name: 'Test city', latitude: 1, longitude: 1 }, startupGreeting: false, standbyEnabled: false, ultronEnabled: true, ...options.settings };
  const capabilities = { desktop: true, vision: false, jarvisSpeech: true, ultronBridge: true, ...options.capabilities };
  const bridge = {
    async boot() { return { settings: { ...current }, snapshot: { memories: [], tasks: [], procedures: [] }, capabilities: { ...capabilities } }; },
    onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    async speak(input) { calls.push(['speak', input]); return options.speak ? options.speak(input) : { ...input, audioBase64: Buffer.from('mock-audio').toString('base64'), mime: 'audio/mpeg' }; },
    async ultronPlaybackResult(value) { acknowledgements.push(value); return true; },
    async cancelSpeech(input) { calls.push(['cancel-speech', input]); },
    async cancelUltron() { calls.push('cancel-ultron'); return { cancelled: true }; },
    async wakeStop() {},
    async startupGreeting() { calls.push('greeting'); return options.greeting ? options.greeting() : { text: 'Saudação.', weatherStatus: 'ok', audioBase64: Buffer.from('mock-greeting').toString('base64'), mime: 'audio/mpeg' }; },
    async cancelGreeting() { calls.push('cancel-greeting'); },
    async saveSettings(value) { saved.push(value); Object.assign(current, value); },
    async text(input) { calls.push(['text', input]); return options.text ? options.text(input) : { text: 'Resposta.' }; },
  };
  class Voice {
    constructor(_bridge, callbacks) { this.callbacks = callbacks; this.stops = 0; sessions.push(this); }
    async start() { this.callbacks.connection(true); this.callbacks.state('listen'); }
    stop(reason = 'stopped') { this.stops++; this.callbacks.connection(false); this.callbacks.state('idle'); this.callbacks.ended(reason); }
  }
  class Standby { async start() { calls.push('standby-start'); } stop() {} getState() { return 'listening'; } }
  class Music { async start() { calls.push('music-start'); } stop() {} duck() {} }
  class AudioDouble {
    constructor(src) { if (options.audioConstructorError) throw new Error('audio_constructor'); this.src = src; this.paused = false; audios.push(this); }
    async play() { calls.push('audio-start'); if (options.play) await options.play(this); }
    pause() { this.paused = true; } removeAttribute() {} load() {}
    finish() { this.onended?.(); } fail() { this.onerror?.(); }
  }
  class Context {
    state = 'running'; destination = {};
    createAnalyser() { return { fftSize: 256, frequencyBinCount: 128, connect() {}, getByteTimeDomainData(samples) { samples.fill(128); } }; }
    createMediaElementSource() { return { connect() {}, disconnect() {} }; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    async resume() {} async close() { this.state = 'closed'; }
  }
  const originals = new Map();
  const globals = {
    window: { jarvis: bridge, location: { href: 'jarvis://app/index.html' }, addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } },
    document: { getElementById: () => ({}), activeElement: null, addEventListener() {}, removeEventListener() {} },
    navigator: { userActivation: { hasBeenActive: true }, mediaDevices: { async getUserMedia() { captureCount++; return { getTracks: () => [{ stop() {} }] }; } } },
    Audio: AudioDouble, AudioContext: Context, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    setTimeout(callback, delay) { const timer = { callback, delay, cleared: false }; timers.push(timer); return timer; }, clearTimeout(timer) { if (timer) timer.cleared = true; },
  };
  for (const [key, value] of Object.entries(globals)) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  const createUrl = URL.createObjectURL, revokeUrl = URL.revokeObjectURL;
  URL.createObjectURL = value => { const url = createUrl.call(URL, value); createdUrls.push(url); return url; };
  URL.revokeObjectURL = value => { revokedUrls.push(value); revokeUrl.call(URL, value); };
  const compiled = { exports: {} };
  const localRequire = name => {
    if (name === 'react') return { ...React, ...hooks };
    if (name === 'react-dom/client') return { createRoot: () => ({ render() {} }) };
    if (name === './styles.css') return {};
    if (name === './hud') return { createHud: () => () => {} };
    if (name === './realtime') return { RealtimeVoice: Voice };
    if (name === './standby') return { LocalClapStandby: Standby };
    if (name === './greeting-music') return { GreetingMusic: Music };
    if (name === './fullscreen') return loadRendererModule('fullscreen.ts');
    if (name === './speech-effects') return { DEFAULT_SPEECH_EFFECT_AMOUNT: 0.78, createSpeechEffects(input) { calls.push(['effect', input.amount]); return { dispose() {} }; } };
    if (name.startsWith('./')) return {};
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, compiled, compiled.exports);
  t.after(async () => { for (const slot of slots) slot?.cleanup?.(); await tick(); URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { current, bridge, capabilities, calls, audios, sessions, acknowledgements, createdUrls, revokedUrls, saved, get captures() { return captureCount; },
    render() { cursor = 0; const tree = compiled.exports.App({}); while (effects.length) effects.shift()(); return tree; },
    emit(event) { for (const callback of subscribers) callback(event); },
    close() { listeners.get('beforeunload')?.(); },
    async boot() { this.render(); await tick(); return this.render(); },
  };
}

test('Ultron narration keeps the approved voice effects, stays out of the dashboard and acknowledges only actual audio end', async t => {
  const app = environment(t); await app.boot();
  app.emit(speechEvent()); await tick();
  assert.equal(app.calls.filter(call => Array.isArray(call) && call[0] === 'speak').length, 1);
  assert.deepEqual(app.calls.find(call => call[0] === 'speak')[1], { text: 'Frase autorizada para narrar.', profileId: 'principal', runId: 'ultron-request-1', utteranceId: 'request-1' });
  assert.equal(app.audios.length, 1); assert.equal(app.audios[0].playbackRate, 0.95); assert.equal(app.audios[0].preservesPitch, true);
  assert(app.calls.some(call => Array.isArray(call) && call[0] === 'effect' && call[1] === 0.78));
  assert.deepEqual(app.acknowledgements, []); assert.equal(app.captures, 0); assert(!app.calls.includes('music-start'));
  assert.equal(text(nodes(app.render()).find(node => node.props?.role === 'log')), '');
  assert(text(app.render()).includes('NARRAÇÃO JARVIS'));
  app.emit(speechEvent()); await tick(); assert.equal(app.audios.length, 1);
  app.audios[0].finish(); await tick();
  assert.deepEqual(app.acknowledgements, [{ requestId: 'request-1', played: true }]);
  assert.deepEqual(app.revokedUrls, app.createdUrls);
  app.emit(speechEvent()); await tick(); assert.equal(app.audios.length, 1); assert.equal(app.acknowledgements.length, 1);
});

test('Ultron disabled, wrong profile, unavailable native capability or missing configured speech never starts TTS', async t => {
  for (const options of [{ settings: { ultronEnabled: false } }, { capabilities: { ultronBridge: false } }, { settings: { hasElevenKey: false } }, { wrongProfile: true }]) await t.test(JSON.stringify(options), async t => {
    const app = environment(t, options); await app.boot();
    app.emit(speechEvent('rejected', options.wrongProfile ? { profileId: 'other-profile' } : {})); await tick();
    assert.equal(app.audios.length, 0); assert.equal(app.calls.filter(call => Array.isArray(call) && call[0] === 'speak').length, 0);
    assert.equal(app.acknowledgements.length, 1); assert.equal(app.acknowledgements[0].played, false);
    assert.equal(app.captures, 0);
  });
});

test('Ultron rejects while voice, reception, microphone test, text or another narration is busy without interrupting the existing task', async t => {
  for (const mode of ['voice', 'greeting', 'microphone', 'text', 'ultron']) await t.test(mode, async t => {
    const pending = deferred(); const app = environment(t, { greeting: () => pending.promise, text: () => pending.promise, ...(mode === 'ultron' ? { speak: () => pending.promise } : {}) }); await app.boot();
    let local;
    if (mode === 'voice') { await button(app.render(), 'Iniciar conversa por voz').props.onClick(); await tick(); }
    if (mode === 'greeting') { button(app.render(), 'Iniciar Jarvis').props.onClick(); await tick(); }
    if (mode === 'microphone') { await button(app.render(), 'Testar microfone').props.onClick(); await tick(); }
    if (mode === 'text') {
      const input = nodes(app.render()).find(node => node.type === 'textarea' && node.props.id === 'message-input'); input.props.onChange({ target: { value: 'Pedido digitado.' } });
      local = nodes(app.render()).find(node => node.type === 'form' && node.props.className === 'composer').props.onSubmit({ preventDefault() {} }); await tick();
    }
    if (mode === 'ultron') { app.emit(speechEvent('first')); await tick(); }
    const before = app.calls.filter(call => Array.isArray(call) && call[0] === 'speak').length;
    app.emit(speechEvent('busy-request')); await tick();
    assert.deepEqual(app.acknowledgements.at(-1), { requestId: 'busy-request', played: false, reason: 'busy' });
    assert.equal(app.calls.filter(call => Array.isArray(call) && call[0] === 'speak').length, before);
    if (mode === 'voice') assert.equal(app.sessions[0].stops, 0);
    assert.equal(app.calls.filter(call => Array.isArray(call) && call[0] === 'cancel-speech').length, 0);
    app.close(); pending.resolve({ text: 'Fim.', audioBase64: null, weatherStatus: 'ok' }); await local; await tick();
  });
});

test('matching cancellation during synthesis or playback discards late results and acknowledges once', async t => {
  for (const during of ['synthesis', 'playback']) await t.test(during, async t => {
    const pending = deferred(); let input;
    const app = environment(t, during === 'synthesis' ? { speak: value => { input = value; return pending.promise; } } : {}); await app.boot();
    app.emit(speechEvent()); await tick();
    app.emit({ type: 'ultron.cancel', requestId: 'another' }); app.emit({ type: 'ultron.cancel' }); await tick();
    assert.deepEqual(app.acknowledgements, []);
    const audio = app.audios[0], lateEnded = audio?.onended;
    app.emit({ type: 'ultron.cancel', requestId: 'request-1' }); await tick();
    assert.deepEqual(app.acknowledgements, [{ requestId: 'request-1', played: false, reason: 'cancelled' }]);
    assert(app.calls.some(call => Array.isArray(call) && call[0] === 'cancel-speech' && call[1].runId === 'ultron-request-1'));
    if (during === 'synthesis') { pending.resolve({ ...input, mime: 'audio/mpeg', audioBase64: Buffer.from('late').toString('base64') }); await tick(); assert.equal(app.audios.length, 0); }
    else { assert.equal(audio.paused, true); lateEnded?.(); await tick(); assert.deepEqual(app.revokedUrls, app.createdUrls); }
    assert.equal(app.acknowledgements.length, 1);
  });
});

test('Interromper, window close and profile reset cancel Ultron before late synthesis can play', async t => {
  for (const stop of ['interrupt', 'close', 'profile']) await t.test(stop, async t => {
    const pending = deferred(); let input;
    const app = environment(t, { speak: value => { input = value; return pending.promise; } }); await app.boot();
    app.emit(speechEvent()); await tick();
    if (stop === 'interrupt') await button(app.render(), 'Interromper').props.onClick();
    if (stop === 'close') app.close();
    if (stop === 'profile') app.emit({ type: 'session.reset', profileId: 'principal', reason: 'profile_changed' });
    await tick(); pending.resolve({ ...input, mime: 'audio/mpeg', audioBase64: Buffer.from('late').toString('base64') }); await tick();
    assert.equal(app.audios.length, 0); assert.deepEqual(app.acknowledgements, [{ requestId: 'request-1', played: false, reason: 'cancelled' }]);
    if (stop === 'interrupt') assert(app.calls.includes('cancel-ultron'));
  });
});

test('Ultron synthesis failure, mismatched response and playback failure never acknowledge played and release Blob URLs once', async t => {
  for (const mode of ['tts', 'mismatch', 'play', 'constructor', 'audio-error']) await t.test(mode, async t => {
    const options = mode === 'tts' ? { speak: async () => { throw new Error('provider'); } } : mode === 'mismatch' ? { speak: async input => ({ ...input, runId: 'wrong', mime: 'audio/mpeg', audioBase64: 'YQ==' }) } : mode === 'play' ? { play: async () => { throw new Error('blocked'); } } : mode === 'constructor' ? { audioConstructorError: true } : {};
    const app = environment(t, options); await app.boot(); app.emit(speechEvent()); await tick();
    if (mode === 'audio-error') { app.audios[0].fail(); await tick(); }
    assert.equal(app.acknowledgements.length, 1); assert.equal(app.acknowledgements[0].played, false);
    assert.equal(app.acknowledgements[0].reason, ['tts', 'mismatch'].includes(mode) ? 'speech_unavailable' : 'playback_failed');
    assert.deepEqual(app.revokedUrls, app.createdUrls); assert.equal(new Set(app.revokedUrls).size, app.revokedUrls.length);
    assert.equal(text(nodes(app.render()).find(node => node.props?.role === 'log')), '');
  });
});

test('Ultron opt-in is native-only and saving a different setting cannot opt a local test harness into the bridge', async t => {
  for (const capable of [false, true]) await t.test(String(capable), async t => {
    const app = environment(t, { settings: { ultronEnabled: false }, capabilities: { ultronBridge: capable, desktop: capable } }); await app.boot();
    button(app.render(), 'Configurações').props.onClick(); let tree = app.render();
    const checkbox = nodes(tree).find(node => node.type === 'label' && text(node).includes('Permitir que Ultron use o Jarvis neste computador'));
    assert.equal(Boolean(checkbox), capable);
    if (capable) nodes(checkbox).find(node => node.type === 'input').props.onChange({ target: { checked: true } });
    tree = app.render(); await nodes(tree).find(node => node.type === 'form' && node.props.className === 'settings-form').props.onSubmit({ preventDefault() {} }); await tick();
    assert.equal(Object.hasOwn(app.saved[0], 'ultronEnabled'), capable);
    if (capable) assert.equal(app.saved[0].ultronEnabled, true);
  });
});

test('preload exposes only explicit playback acknowledgement and cancellation methods over fixed IPC names', async () => {
  const ipc = new EventEmitter(), requests = []; let bridge;
  ipc.invoke = async (...input) => { requests.push(input); return true; };
  const preload = await readFile(new URL('../apps/desktop/preload.cjs', import.meta.url), 'utf8');
  new Function('require', preload)(name => { assert.equal(name, 'electron'); return { contextBridge: { exposeInMainWorld(_name, value) { bridge = value; } }, ipcRenderer: ipc }; });
  await bridge.ultronPlaybackResult({ requestId: 'test', played: false, reason: 'busy' }); await bridge.cancelUltron();
  assert.deepEqual(requests, [['jarvis:ultronPlaybackResult', { requestId: 'test', played: false, reason: 'busy' }], ['jarvis:cancelUltron', undefined]]);
});
