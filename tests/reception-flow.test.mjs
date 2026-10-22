import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';
import { loadRendererModule } from './renderer-module-loader.mjs';

const require = createRequire(import.meta.url), React = require('react');
const source = `${await readFile(new URL('../apps/desktop/renderer/App.tsx', import.meta.url), 'utf8')}\nexport { App };`;
const { code } = await transform(source, { loader: 'tsx', jsx: 'automatic', format: 'cjs', target: 'node24' });
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)]; }
function text(tree) { if (typeof tree === 'string' || typeof tree === 'number') return String(tree); if (Array.isArray(tree)) return tree.map(text).join(''); return tree?.props ? text(tree.props.children) : ''; }
function button(tree, label) { const value = nodes(tree).find(node => node.type === 'button' && (node.props['aria-label'] === label || text(node).includes(label))); assert(value, `Missing ${label}`); return value; }
function environment(t, options = {}) {
  const slots = [], effects = [], subscribers = new Set(), listeners = new Map(), timers = [], audios = [], detectors = [], sessions = [], calls = [], saved = [], createdUrls = [], revokedUrls = [];
  let cursor = 0, contextCount = 0;
  const hooks = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect, deps) { const index = cursor++, previous = slots[index]; if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) { slots[index] = { deps, cleanup: previous?.cleanup }; effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); }); } },
  };
  const current = { profileId: 'principal', textModel: 'test-text', realtimeModel: 'test-voice', voice: 'legacy', maxSessionMinutes: 10, workspaceRoot: '', apps: [], hasKey: true, hasElevenKey: true, elevenVoiceId: 'configured-voice', weatherLocation: { name: 'Test city', latitude: 1, longitude: 1 }, standbyEnabled: true, wakeClapEnabled: true, wakeVoiceEnabled: false, hasGreetingMusic: true, greetingMusicEnabled: true, receptionOutfitEnabled: true, receptionVoiceEnabled: true, continuousVoiceEnabled: false, ...options.settings };
  const bridge = {
    async boot() { return { settings: { ...current }, snapshot: { memories: [], tasks: [], procedures: [] }, capabilities: { desktop: true, vision: false, jarvisSpeech: true, startup: true, outfitObservation: true } }; },
    onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    async startupGreeting() { calls.push('greeting'); return options.greeting ? options.greeting() : { text: 'Boa tarde, senhor. Tempo atual. Em que posso ajudá-lo?', weatherStatus: 'ok', audioBase64: Buffer.from('mock-greeting').toString('base64'), mime: 'audio/mpeg' }; },
    async observeOutfit(input) { calls.push(['observe', input]); return options.observe ? options.observe(input) : { text: 'A sua camisa azul está elegante, senhor.', observedAt: Date.now() }; },
    async speak(input) { calls.push(['speak', input]); return options.speak ? options.speak(input) : { ...input, audioBase64: Buffer.from('mock-outfit').toString('base64'), mime: 'audio/mpeg' }; },
    async cancelGreeting() { calls.push('cancel-greeting'); }, async cancelOutfit() { calls.push('cancel-outfit'); }, async cancelSpeech(input) { calls.push(['cancel-speech', input]); }, async wakeStop() {},
    async saveSettings(value) { saved.push(value); Object.assign(current, value); },
  };
  class Voice {
    constructor(_bridge, callbacks) { this.callbacks = callbacks; sessions.push(this); }
    async start(profile, limit) { this.profile = profile; this.limit = limit; this.callbacks.connection(true); this.callbacks.state('listen'); calls.push('voice-start'); }
    stop(reason = 'stopped') { this.callbacks.connection(false); this.callbacks.state('idle'); this.callbacks.ended(reason); }
    interrupt() { calls.push('voice-interrupt'); }
    expire() { this.stop('expired'); }
    fail() { this.callbacks.error('Network unavailable'); this.stop('error'); }
  }
  class Standby {
    constructor(callbacks) { this.callbacks = callbacks; detectors.push(this); }
    async start() { this.listening = true; calls.push('standby-start'); }
    stop() { this.listening = false; }
    getState() { return this.listening ? 'listening' : 'idle'; }
  }
  class Music { async start(input) { calls.push(['music-start', input]); } stop() { calls.push('music-stop'); } duck(value) { calls.push(['music-duck', value]); } }
  class AudioDouble {
    constructor(src) { this.src = src; audios.push(this); }
    async play() { calls.push('audio-start'); if (options.play) await options.play(this); }
    pause() {} removeAttribute() {} load() {}
    finish() { calls.push('audio-end'); this.onended?.(); } fail() { this.onerror?.(); }
  }
  class Context {
    constructor() { this.state = 'running'; this.destination = {}; options.context?.(++contextCount); }
    createAnalyser() { return { fftSize: 256, connect() {}, getByteTimeDomainData(samples) { samples.fill(128); } }; }
    createMediaElementSource() { return { connect() {}, disconnect() {} }; }
    async resume() {} async close() {}
  }
  const fakeCapture = async input => { calls.push('capture'); return options.capture ? options.capture(input) : 'data:image/jpeg;base64,/9j/2Q=='; };
  const originals = new Map();
  const globals = { window: { jarvis: bridge, location: { href: 'http://127.0.0.1:47833/' }, addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } }, document: { getElementById: () => ({}), activeElement: null, addEventListener() {}, removeEventListener() {} }, navigator: { userActivation: { hasBeenActive: true }, mediaDevices: { async getUserMedia(constraints) { calls.push(['media', constraints]); throw new Error('Unexpected camera capture during reception'); } } }, Audio: AudioDouble, AudioContext: Context, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout(callback, delay) { const timer = { callback, delay, cleared: false }; timers.push(timer); return timer; }, clearTimeout(timer) { if (timer) timer.cleared = true; } };
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
    if (name === './outfit-camera') return { captureOutfitImage: fakeCapture };
    if (name === './fullscreen') return loadRendererModule('fullscreen.ts');
    if (name === './speech-effects') return { DEFAULT_SPEECH_EFFECT_AMOUNT: 0.78, createSpeechEffects(input) { calls.push(['effect', input.amount]); return { dispose() {} }; } };
    if (name.startsWith('./')) return {};
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, compiled, compiled.exports);
  t.after(() => { for (const slot of slots) slot?.cleanup?.(); URL.createObjectURL = createUrl; URL.revokeObjectURL = revokeUrl; for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  return { current, calls, saved, bridge, audios, detectors, sessions, timers, createdUrls, revokedUrls,
    render() { cursor = 0; const tree = compiled.exports.App({}); while (effects.length) effects.shift()(); return tree; },
    emit(event) { for (const callback of subscribers) callback(event); },
    close() { listeners.get('beforeunload')?.(); },
    async boot() { this.render(); await tick(); return this.render(); },
    async clap() { detectors.at(-1).callbacks.onWake(); await tick(); },
    async finishGreeting() { await this.clap(); audios[0].finish(); await tick(); },
    fireTimers(delay) { for (const timer of timers.filter(timer => !timer.cleared && timer.delay === delay)) { timer.cleared = true; timer.callback(); } },
  };
}

function noAutomaticOutfit(app) {
  assert(!app.calls.includes('capture'), 'reception must not invoke the legacy capture helper');
  assert(!app.calls.some(call => Array.isArray(call) && call[0] === 'media' && call[1]?.video), 'reception must not request camera video');
  assert(!app.calls.some(call => Array.isArray(call) && ['observe', 'speak'].includes(call[0])), 'reception must not observe or synthesize clothing text');
}

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('boot waits silently; two claps play only music and greeting, then voice, even with the legacy clothing option enabled', async t => {
  const app = environment(t); await app.boot();
  assert.equal(app.current.receptionOutfitEnabled, true);
  assert.equal(app.detectors.length, 1); assert.equal(app.audios.length, 0); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
  await app.clap(); assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
  assert.equal(app.calls.filter(call => call === 'greeting').length, 1);
  assert.equal(app.calls.filter(call => Array.isArray(call) && call[0] === 'music-start').length, 1);
  assert.equal(app.audios[0].playbackRate, 0.95); assert.equal(app.audios[0].preservesPitch, true);
  assert(app.calls.some(call => Array.isArray(call) && call[0] === 'effect' && call[1] === 0.78));
  app.detectors[0].callbacks.onWake(); await tick(); assert.equal(app.audios.length, 1);
  app.audios[0].finish(); await tick();
  assert.equal(app.sessions.length, 1); assert.equal(app.sessions[0].profile, 'principal'); assert.equal(app.audios.length, 1); noAutomaticOutfit(app);
  const greetingEnd = app.calls.indexOf('audio-end'), voiceStart = app.calls.indexOf('voice-start');
  assert(greetingEnd >= 0 && voiceStart > greetingEnd);
  assert(app.calls.slice(greetingEnd + 1, voiceStart).includes('music-stop'));
  assert.equal(app.createdUrls.length, 1); assert.equal(app.revokedUrls.filter(url => url === app.createdUrls[0]).length, 1);
  app.detectors[0].callbacks.onWake(); await tick(); assert.equal(app.sessions.length, 1);
  assert.equal(text(nodes(app.render()).find(node => node.props?.role === 'log')), '');
});

test('the manual reception button also skips camera and clothing work before entering voice', async t => {
  const app = environment(t, { settings: { standbyEnabled: false } }); await app.boot();
  await button(app.render(), 'Iniciar Jarvis').props.onClick(); await tick();
  assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
  app.audios[0].finish(); await tick(); assert.equal(app.sessions.length, 1); assert.equal(app.audios.length, 1); noAutomaticOutfit(app);
});

test('cancelling a greeting preparation discards its late audio and never connects voice', async t => {
  const pending = deferred(), app = environment(t, { greeting: () => pending.promise });
  await app.boot(); await app.clap(); assert.equal(app.audios.length, 0);
  await button(app.render(), 'Interromper').props.onClick();
  pending.resolve({ text: 'Late greeting.', weatherStatus: 'ok', audioBase64: Buffer.from('late-greeting').toString('base64'), mime: 'audio/mpeg' }); await tick();
  assert(app.calls.includes('cancel-greeting')); assert.equal(app.audios.length, 0); assert.equal(app.createdUrls.length, 0); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
  app.fireTimers(4000); await tick(); assert.equal(app.detectors.length, 1);
});

test('a profile reset discards a greeting response from the previous reception', async t => {
  const pending = deferred(), app = environment(t, { greeting: () => pending.promise });
  await app.boot(); await app.clap(); app.emit({ type: 'session.reset', profileId: 'principal', reason: 'profile_changed' });
  pending.resolve({ text: 'Old profile greeting.', weatherStatus: 'ok', audioBase64: Buffer.from('old-greeting').toString('base64'), mime: 'audio/mpeg' }); await tick();
  assert.equal(app.audios.length, 0); assert.equal(app.sessions.length, 0); assert(app.calls.includes('cancel-greeting')); noAutomaticOutfit(app);
  app.fireTimers(4000); await tick(); assert.equal(app.detectors.length, 1);
});

for (const stop of ['cancel', 'reset', 'close']) test(stop + ' during greeting playback releases its only audio and cannot start voice from a late ended event', async t => {
  const app = environment(t); await app.boot(); await app.clap();
  const audio = app.audios[0], ended = audio.onended, url = app.createdUrls[0];
  assert.equal(app.createdUrls.length, 1);
  if (stop === 'cancel') await button(app.render(), 'Interromper').props.onClick();
  else if (stop === 'reset') app.emit({ type: 'session.reset', profileId: 'principal', reason: 'profile_changed' });
  else app.close();
  ended(); await tick();
  assert.equal(app.revokedUrls.filter(value => value === url).length, 1); assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
});

test('a greeting audio error releases playback without starting camera, another narration or voice', async t => {
  const app = environment(t); await app.boot(); await app.clap();
  app.audios[0].fail(); await tick(); assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
  assert.equal(app.revokedUrls.filter(url => url === app.createdUrls[0]).length, 1);
});

test('a missing greeting cannot start camera or voice commands', async t => {
  const app = environment(t, { greeting: () => ({ text: '', audioBase64: null, mime: 'audio/mpeg', reason: 'requires_key' }) }); await app.boot(); await app.clap();
  assert.equal(app.audios.length, 0); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
});

test('greeting playback blocked before starting never connects voice or requests camera', async t => {
  const app = environment(t, { play: async () => { throw new Error('Playback blocked'); } }); await app.boot(); await app.clap();
  assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
});

test('a not-configured greeting cannot complete reception even when its audio ends', async t => {
  const app = environment(t, { greeting: () => ({ text: 'Configure sua cidade.', audioBase64: Buffer.from('mock').toString('base64'), mime: 'audio/mpeg', weatherStatus: 'not_configured' }) });
  await app.boot(); await app.finishGreeting(); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
});

test('automatic greeting at boot never opts into camera upload or an automatic cloud conversation', async t => {
  const app = environment(t, { settings: { standbyEnabled: false, startupGreeting: true } }); await app.boot();
  assert.equal(app.audios.length, 1); app.audios[0].finish(); await tick(); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
});

test('disabled voice continuation ends reception after the greeting despite a legacy true clothing setting', async t => {
  const app = environment(t, { settings: { receptionVoiceEnabled: false, continuousVoiceEnabled: false } });
  await app.boot(); await app.finishGreeting(); assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
});

test('continuous mode renews only normal expiry and Interromper prevents reconnection or standby', async t => {
  const app = environment(t, { settings: { continuousVoiceEnabled: true } }); await app.boot(); await app.finishGreeting();
  assert.equal(app.sessions.length, 1); app.sessions[0].expire(); app.fireTimers(1200); await tick(); assert.equal(app.sessions.length, 2);
  await button(app.render(), 'Interromper').props.onClick(); app.fireTimers(1200); app.fireTimers(4000); await tick(); assert.equal(app.sessions.length, 2); assert.equal(app.detectors.length, 1); noAutomaticOutfit(app);
});

test('continuous mode never retries errors and closing during a renewal gap prevents another connection', async t => {
  const app = environment(t, { settings: { continuousVoiceEnabled: true } }); await app.boot(); await app.finishGreeting();
  app.sessions[0].fail(); app.fireTimers(1200); await tick(); assert.equal(app.sessions.length, 1);
  await button(app.render(), 'Iniciar conversa por voz').props.onClick(); await tick(); assert.equal(app.sessions.length, 2);
  app.sessions[1].expire(); app.close(); app.fireTimers(1200); await tick(); assert.equal(app.sessions.length, 2); noAutomaticOutfit(app);
});

test('the reception preset keeps city, model, voice and keys while removing the clothing option from UI and saved payload', async t => {
  const app = environment(t, { settings: { standbyEnabled: false, receptionVoiceEnabled: false, continuousVoiceEnabled: false } }); await app.boot();
  button(app.render(), 'Configurações').props.onClick(); button(app.render(), 'Ativar recepção completa').props.onClick();
  assert.equal(app.saved.length, 0); assert.equal(app.sessions.length, 0); noAutomaticOutfit(app);
  const tree = app.render(); assert.doesNotMatch(text(tree), /comentar a roupa|captura da roupa|observar a roupa/i);
  const form = nodes(tree).find(node => node.type === 'form' && node.props.className === 'settings-form');
  await form.props.onSubmit({ preventDefault() {} }); await tick(); const saved = app.saved[0];
  for (const name of ['startAtLogin', 'startupGreeting', 'standbyEnabled', 'wakeClapEnabled', 'greetingMusicEnabled', 'receptionVoiceEnabled', 'continuousVoiceEnabled']) assert.equal(saved[name], true, name);
  assert.equal(Object.hasOwn(saved, 'receptionOutfitEnabled'), false);
  assert.equal(saved.wakeVoiceEnabled, false); assert.equal(saved.textModel, 'test-text'); assert.equal(saved.realtimeModel, 'test-voice'); assert.equal(saved.elevenVoiceId, 'configured-voice'); assert.deepEqual(saved.weatherLocation, app.current.weatherLocation);
  assert.equal(Object.hasOwn(saved, 'apiKey'), false); assert.equal(Object.hasOwn(saved, 'elevenApiKey'), false);
});

test('a legacy enabled clothing setting does not require OpenAI when automatic voice continuation is disabled', async t => {
  const app = environment(t, { settings: { hasKey: false, receptionVoiceEnabled: false } }); await app.boot();
  button(app.render(), 'Configurações').props.onClick();
  const form = nodes(app.render()).find(node => node.type === 'form' && node.props.className === 'settings-form');
  await form.props.onSubmit({ preventDefault() {} }); await tick();
  assert.equal(app.saved.length, 1); assert.equal(Object.hasOwn(app.saved[0], 'receptionOutfitEnabled'), false); noAutomaticOutfit(app);
});
