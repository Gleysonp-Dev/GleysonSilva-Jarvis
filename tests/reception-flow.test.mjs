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
  const globals = { window: { jarvis: bridge, location: { href: 'http://127.0.0.1:47833/' }, addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } }, document: { getElementById: () => ({}), activeElement: null, addEventListener() {}, removeEventListener() {} }, navigator: { userActivation: { hasBeenActive: true } }, Audio: AudioDouble, AudioContext: Context, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout(callback, delay) { const timer = { callback, delay, cleared: false }; timers.push(timer); return timer; }, clearTimeout(timer) { if (timer) timer.cleared = true; } };
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

test('boot stays silent; a clap prepares one outfit comment during greeting and plays it immediately after, then starts voice', async t => {
  const app = environment(t); await app.boot();
  assert.equal(app.detectors.length, 1); assert.equal(app.audios.length, 0); assert(!app.calls.includes('capture')); assert.equal(app.sessions.length, 0);
  await app.clap(); assert.equal(app.audios.length, 1); assert(app.calls.includes('capture')); assert.equal(app.sessions.length, 0);
  assert.equal(app.calls.filter(value => Array.isArray(value) && value[0] === 'speak').length, 1);
  assert(app.calls.indexOf('audio-start') < app.calls.indexOf('capture'));
  app.detectors[0].callbacks.onWake(); await tick(); assert.equal(app.audios.length, 1);
  app.audios[0].finish(); await tick();
  assert.equal(app.calls.filter(value => value === 'capture').length, 1); assert.equal(app.calls.filter(value => Array.isArray(value) && value[0] === 'observe').length, 1);
  assert.equal(app.audios.length, 2); assert.equal(app.sessions.length, 0); assert.equal(app.detectors.length, 1);
  const speech = app.calls.find(value => Array.isArray(value) && value[0] === 'speak')[1];
  assert.match(speech.runId, /^reception-/); assert.match(speech.utteranceId, /^outfit-/); assert.equal(speech.profileId, 'principal');
  assert.equal(app.audios[1].playbackRate, 0.95); assert.equal(app.audios[1].preservesPitch, true); assert(app.calls.some(value => Array.isArray(value) && value[0] === 'effect' && value[1] === 0.78));
  const capture = app.calls.indexOf('capture'), greetingEnd = app.calls.indexOf('audio-end'); assert(capture < greetingEnd);
  assert.equal(app.calls[greetingEnd + 1], 'music-stop');
  app.audios[1].finish(); await tick(); assert.equal(app.sessions.length, 1); assert.equal(app.sessions[0].profile, 'principal');
  const log = nodes(app.render()).find(node => node.props?.role === 'log'); assert.equal(text(log), '');
});

test('cancel during capture aborts the image and never observes, speaks or connects later', async t => {
  let released = false;
  const app = environment(t, { capture: ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { released = true; reject(new DOMException('Cancelled', 'AbortError')); }, { once: true })) });
  await app.boot(); await app.finishGreeting();
  await button(app.render(), 'Interromper').props.onClick(); await tick();
  assert.equal(released, true); assert(!app.calls.some(value => Array.isArray(value) && ['observe', 'speak'].includes(value[0]))); assert.equal(app.sessions.length, 0);
  app.fireTimers(4000); await tick(); assert.equal(app.detectors.length, 1);
});

test('cancel, profile reset and close ignore an outfit response that finishes late', async t => {
  let respond; const pending = new Promise(resolve => { respond = resolve; });
  const app = environment(t, { observe: () => pending }); await app.boot(); await app.finishGreeting();
  app.emit({ type: 'session.reset', profileId: 'principal', reason: 'profile_changed' });
  respond({ text: 'A late compliment.', observedAt: Date.now() }); await tick();
  assert.equal(app.sessions.length, 0); assert(!app.calls.some(value => Array.isArray(value) && value[0] === 'speak')); assert(app.calls.includes('cancel-outfit'));
  app.fireTimers(4000); await tick(); assert.equal(app.detectors.length, 1);
});

test('a slow outfit synthesis continues across greeting end without replaying capture or overlapping speech', async t => {
  let deliver, request;
  const app = environment(t, { speak: input => { request = input; return new Promise(resolve => { deliver = resolve; }); } });
  await app.boot(); await app.clap();
  assert(request); assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0);
  app.audios[0].finish(); await tick();
  assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0);
  deliver({ ...request, audioBase64: Buffer.from('ready-comment').toString('base64'), mime: 'audio/mpeg' }); await tick();
  assert.equal(app.audios.length, 2); assert.equal(app.calls.filter(value => value === 'capture').length, 1);
  assert.equal(app.calls.filter(value => Array.isArray(value) && value[0] === 'speak').length, 1);
  app.audios[1].finish(); await tick(); assert.equal(app.sessions.length, 1);
});

test('closing while the next comment is prepared releases its audio without playing it', async t => {
  const app = environment(t); await app.boot(); await app.clap();
  assert.equal(app.audios.length, 1); assert.equal(app.createdUrls.length, 2);
  const preparedUrl = app.createdUrls[1]; assert(!app.revokedUrls.includes(preparedUrl));
  app.close(); await tick();
  assert(app.revokedUrls.includes(preparedUrl)); assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0);
  assert(app.calls.includes('cancel-outfit'));
});

test('an outfit audio-context failure releases its transferred URL exactly once and still starts voice', async t => {
  const app = environment(t, { context: index => { if (index === 2) throw new Error('Audio context unavailable'); } });
  await app.boot(); await app.clap();
  assert.equal(app.createdUrls.length, 2); const commentUrl = app.createdUrls[1];
  assert(!app.revokedUrls.includes(commentUrl));
  app.audios[0].finish(); await tick();
  assert.equal(app.revokedUrls.filter(value => value === commentUrl).length, 1);
  assert.equal(app.calls.filter(value => value === 'audio-start').length, 1); assert.equal(app.sessions.length, 1);
  assert.match(text(app.render()), /Não consegui reproduzir o comentário da roupa/);
  app.close(); await tick(); assert.equal(app.revokedUrls.filter(value => value === commentUrl).length, 1);
  assert.equal(app.calls.filter(value => value === 'audio-start').length, 1);
});

test('closing during prefetched synthesis discards a late audio result and cannot connect voice', async t => {
  let deliver, request;
  const app = environment(t, { speak: input => { request = input; return new Promise(resolve => { deliver = resolve; }); } });
  await app.boot(); await app.clap(); assert(request);
  app.close(); deliver({ ...request, audioBase64: Buffer.from('late-comment').toString('base64'), mime: 'audio/mpeg' }); await tick();
  assert.equal(app.createdUrls.length, 1); assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0);
  assert(app.calls.some(value => Array.isArray(value) && value[0] === 'cancel-speech' && value[1].runId === request.runId));
});

test('a wrong synthesis correlation is discarded after the greeting and never spoken', async t => {
  const app = environment(t, { speak: async input => ({ ...input, runId: 'a-different-reception', audioBase64: Buffer.from('wrong-comment').toString('base64'), mime: 'audio/mpeg' }) });
  await app.boot(); await app.clap(); assert.equal(app.audios.length, 1);
  app.audios[0].finish(); await tick(); assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 1);
  assert.match(text(app.render()), /Não consegui observar sua roupa agora/);
});

test('a greeting interrupted after playing cancels in-progress camera work and never speaks a comment', async t => {
  let aborted = false;
  const app = environment(t, { capture: ({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('Cancelled', 'AbortError')); }, { once: true })) });
  await app.boot(); await app.clap(); assert(app.calls.includes('capture'));
  app.audios[0].fail(); await tick(); assert.equal(aborted, true);
  assert.equal(app.audios.length, 1); assert.equal(app.sessions.length, 0); assert(app.calls.includes('cancel-outfit'));
});

test('camera failure gives a short notice and proceeds to voice without an invented compliment', async t => {
  const app = environment(t, { capture: async () => { throw new Error('Permission denied'); } }); await app.boot(); await app.finishGreeting();
  assert.equal(app.sessions.length, 1); assert(!app.calls.some(value => Array.isArray(value) && ['observe', 'speak'].includes(value[0])));
  assert.match(text(app.render()), /Não consegui observar sua roupa agora/);
});

test('a missing greeting cannot start the camera or voice session', async t => {
  const app = environment(t, { greeting: () => ({ text: '', audioBase64: null, mime: 'audio/mpeg', reason: 'requires_key' }) }); await app.boot(); await app.clap();
  assert(!app.calls.includes('capture')); assert.equal(app.sessions.length, 0);
});

test('greeting playback that fails before starting cannot start camera observation or voice commands', async t => {
  const app = environment(t, { play: async () => { throw new Error('Playback blocked'); } }); await app.boot(); await app.clap();
  assert(!app.calls.includes('capture')); assert.equal(app.sessions.length, 0);
});

test('a not-configured greeting is never treated as a completed reception even if it has audio', async t => {
  const app = environment(t, { greeting: () => ({ text: 'Configure sua cidade.', audioBase64: Buffer.from('mock').toString('base64'), mime: 'audio/mpeg', weatherStatus: 'not_configured' }) });
  await app.boot(); await app.finishGreeting(); assert(!app.calls.includes('capture')); assert.equal(app.sessions.length, 0);
});

test('automatic greeting at boot does not opt into a camera upload or automatic cloud microphone', async t => {
  const app = environment(t, { settings: { standbyEnabled: false, startupGreeting: true } }); await app.boot();
  assert.equal(app.audios.length, 1); app.audios[0].finish(); await tick(); assert(!app.calls.includes('capture')); assert.equal(app.sessions.length, 0);
});

test('public-default reception flags keep camera upload and automatic cloud conversation disabled even after activation', async t => {
  const app = environment(t, { settings: { receptionOutfitEnabled: false, receptionVoiceEnabled: false, continuousVoiceEnabled: false } });
  await app.boot(); await app.finishGreeting(); assert(!app.calls.includes('capture')); assert.equal(app.sessions.length, 0);
});

test('continuous mode renews only normal expiry and Interromper prevents reconnection or standby', async t => {
  const app = environment(t, { settings: { receptionOutfitEnabled: false, continuousVoiceEnabled: true } }); await app.boot(); await app.finishGreeting();
  assert.equal(app.sessions.length, 1); app.sessions[0].expire(); app.fireTimers(1200); await tick(); assert.equal(app.sessions.length, 2);
  await button(app.render(), 'Interromper').props.onClick(); app.fireTimers(1200); app.fireTimers(4000); await tick(); assert.equal(app.sessions.length, 2); assert.equal(app.detectors.length, 1);
});

test('continuous mode never retries errors and closing during a renewal gap prevents a new connection', async t => {
  const app = environment(t, { settings: { receptionOutfitEnabled: false, continuousVoiceEnabled: true } }); await app.boot(); await app.finishGreeting();
  app.sessions[0].fail(); app.fireTimers(1200); await tick(); assert.equal(app.sessions.length, 1);
  await button(app.render(), 'Iniciar conversa por voz').props.onClick(); await tick(); assert.equal(app.sessions.length, 2);
  app.sessions[1].expire(); app.close(); app.fireTimers(1200); await tick(); assert.equal(app.sessions.length, 2);
});

test('full reception preset edits only the draft; saving retains city, model, voice and existing private keys', async t => {
  const app = environment(t, { settings: { standbyEnabled: false, receptionOutfitEnabled: false, receptionVoiceEnabled: false, continuousVoiceEnabled: false } }); await app.boot();
  button(app.render(), 'Configurações').props.onClick(); button(app.render(), 'Ativar recepção completa').props.onClick();
  assert.equal(app.saved.length, 0); assert(!app.calls.includes('capture')); assert.equal(app.sessions.length, 0);
  const tree = app.render(), form = nodes(tree).find(node => node.type === 'form' && node.props.className === 'settings-form');
  await form.props.onSubmit({ preventDefault() {} }); await tick(); const saved = app.saved[0];
  for (const name of ['startAtLogin', 'startupGreeting', 'standbyEnabled', 'wakeClapEnabled', 'greetingMusicEnabled', 'receptionOutfitEnabled', 'receptionVoiceEnabled', 'continuousVoiceEnabled']) assert.equal(saved[name], true, name);
  assert.equal(saved.wakeVoiceEnabled, false); assert.equal(saved.textModel, 'test-text'); assert.equal(saved.realtimeModel, 'test-voice'); assert.equal(saved.elevenVoiceId, 'configured-voice'); assert.deepEqual(saved.weatherLocation, app.current.weatherLocation);
  assert.equal(Object.hasOwn(saved, 'apiKey'), false); assert.equal(Object.hasOwn(saved, 'elevenApiKey'), false);
});
