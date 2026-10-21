import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';
import { StartupGreetingService } from '../packages/greeting/index.mjs';
import { WEATHER_ATTRIBUTION } from '../packages/greeting/index.mjs';
import { loadRendererModule } from './renderer-module-loader.mjs';

const require = createRequire(import.meta.url), realReact = require('react');
// Export only in the in-memory compiler input. The application file is untouched.
const source = `${await readFile(new URL('../apps/desktop/renderer/App.tsx', import.meta.url), 'utf8')}\nexport { App };`;
const { code } = await transform(source, { loader: 'tsx', jsx: 'automatic', format: 'cjs', target: 'node24' });
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function microphone() { const track = { stops: 0, stop() { this.stops++; } }; return { track, getTracks: () => [track] }; }

function hookRuntime() {
  const slots = []; let cursor = 0; const effects = [];
  return {
    hooks: {
      useState(initial) {
        const index = cursor++;
        if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
      },
      useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
      useEffect(effect, deps) {
        const index = cursor++, previous = slots[index];
        if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) {
          slots[index] = { deps, cleanup: previous?.cleanup };
          effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); });
        }
      },
    },
    render(App) { cursor = 0; const tree = App({}); while (effects.length) effects.shift()(); return tree; },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
  };
}
function elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
function label(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(label).join('');
  return tree?.props ? label(tree.props.children) : '';
}
function button(tree, pattern) {
  const found = elements(tree).find(element => element.type === 'button' && pattern.test(label(element)));
  assert(found, `Expected a button matching ${pattern}`); return found;
}

function environment(t, { getUserMedia, settings = {}, capabilities = {}, greeting, mockVoice = false } = {}) {
  const original = new Map(), timeouts = new Map(), intervals = new Map(), audios = [], contexts = [];
  let sequence = 0, nativeStarts = 0, cancelledGreetings = 0;
  const listeners = new Set(), domListeners = new Map(), voiceSessions = [], textRequests = [];
  const current = { profileId: 'principal', textModel: 'gpt-5.4-mini', realtimeModel: 'gpt-realtime', voice: 'marin', maxSessionMinutes: 10,
    workspaceRoot: '', apps: [], hasKey: false, hasElevenKey: true, elevenVoiceId: 'mock-approved-voice', startupGreeting: true,
    weatherLocation: { name: 'Cidade de teste', latitude: 10, longitude: 20 }, standbyEnabled: true, wakeClapEnabled: true,
    wakeVoiceEnabled: false, greetingMusicEnabled: false, hasGreetingMusic: false, ...settings };
  const caps = { desktop: false, vision: false, localTest: true, jarvisSpeech: true, voiceWake: false, ...capabilities };
  const bridge = {
    async boot() { return { settings: structuredClone(current), snapshot: { memories: [], tasks: [], procedures: [] }, capabilities: { ...caps } }; },
    onEvent(callback) { listeners.add(callback); return () => listeners.delete(callback); },
    async wakeStart() { nativeStarts++; return { available: true, running: true, state: 'listening' }; },
    async wakeStop() { return { running: false, state: 'stopped' }; },
    async startupGreeting(input) { return greeting?.start(input); },
    async cancelGreeting() { cancelledGreetings++; greeting?.cancel(); return { cancelled: true }; },
    async text(input) { textRequests.push(input); return { text: 'Resposta digitada preservada.' }; },
  };
  class Voice {
    constructor(_bridge, callbacks) { this.callbacks = callbacks; this.interruptions = 0; this.stops = 0; voiceSessions.push(this); }
    async start() { this.callbacks.connection(true); this.callbacks.state('listen'); }
    interrupt() { this.interruptions++; }
    stop() { this.stops++; this.callbacks.connection(false); this.callbacks.ended('stopped'); }
  }
  class Context {
    state = 'running'; sampleRate = 48000; currentTime = 0; destination = {};
    constructor() { contexts.push(this); }
    async resume() {}
    async close() { this.state = 'closed'; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 1024, frequencyBinCount: 512, disconnect() {}, getFloatTimeDomainData(array) { array.fill(0); }, getFloatFrequencyData(array) { array.fill(-Infinity); } }; }
  }
  class Audio { constructor(src) { this.src = src; audios.push(this); } }
  const values = {
    window: { jarvis: bridge, location: { href: 'http://127.0.0.1:47833/index.html' }, addEventListener(name, callback) { domListeners.set(name, callback); }, removeEventListener(name) { domListeners.delete(name); } },
    document: { getElementById: () => ({}), activeElement: null, addEventListener() {}, removeEventListener() {} },
    navigator: { mediaDevices: { getUserMedia: getUserMedia ?? (async () => microphone()) } },
    AudioContext: Context, Audio,
    setTimeout(callback, ms) { const id = ++sequence; timeouts.set(id, { callback, ms }); return id; },
    clearTimeout(id) { timeouts.delete(id); },
    setInterval(callback, ms) { const id = ++sequence; intervals.set(id, { callback, ms }); return id; },
    clearInterval(id) { intervals.delete(id); },
    cancelAnimationFrame() {}, requestAnimationFrame: () => ++sequence,
  };
  for (const [name, value] of Object.entries(values)) { original.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, writable: true, value }); }
  const hooks = hookRuntime(), compiled = { exports: {} };
  t.after(async () => {
    hooks.unmount(); greeting?.cancel(); await flush();
    for (const [name, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  });
  const localRequire = name => {
    if (name === 'react') return { ...realReact, ...hooks.hooks };
    if (name === 'react-dom/client') return { createRoot: () => ({ render() {} }) };
    if (name === './styles.css') return {};
    if (name === './hud') return { createHud: () => () => {} };
    if (name === './weather-source') return loadRendererModule('weather-source.tsx');
    if (name === './realtime' && mockVoice) return { RealtimeVoice: Voice };
    if (name.startsWith('./')) return loadRendererModule(name.slice(2));
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, compiled, compiled.exports);
  const render = () => hooks.render(compiled.exports.App);
  return { render, audios, contexts, voiceSessions, textRequests, get nativeStarts() { return nativeStarts; }, get cancelledGreetings() { return cancelledGreetings; },
    emit(event) { for (const callback of listeners) callback(event); },
    runDelay(ms) { for (const [id, timer] of [...timeouts]) if (timer.ms === ms && timeouts.delete(id)) timer.callback(); },
  };
}

test('boot uses its newly returned native wake capability before React commits another render', async t => {
  const app = environment(t, { settings: { wakeClapEnabled: false, wakeVoiceEnabled: true }, capabilities: { voiceWake: true, desktop: true } });
  app.render(); await flush();
  // No rerender has applied setCapabilities yet: only the boot-updated ref can enable this.
  assert.equal(app.nativeStarts, 1);
  assert(button(app.render(), /^Pausar espera$/));
});

test('pause/resume while permission is pending keeps one microphone request and rearms after the late stream is closed', async t => {
  const firstPermission = deferred(), secondPermission = deferred(), first = microphone(), second = microphone();
  let requests = 0, pending = 0, maximumPending = 0;
  const app = environment(t, { getUserMedia: () => {
    requests++; pending++; maximumPending = Math.max(maximumPending, pending);
    return (requests === 1 ? firstPermission.promise : secondPermission.promise).finally(() => { pending--; });
  } });
  app.render(); await flush(); assert.equal(requests, 1);
  button(app.render(), /^Ativar espera$/).props.onClick(); // Pause the still-starting detector.
  button(app.render(), /^Ativar espera$/).props.onClick(); // Request resume before permission resolves.
  await flush(); assert.equal(requests, 1); assert.equal(maximumPending, 1);
  firstPermission.resolve(first); await flush(); assert(first.track.stops > 0);
  app.runDelay(4000); await flush(); assert.equal(requests, 2); assert.equal(maximumPending, 1);
  secondPermission.resolve(second); await flush(); assert(button(app.render(), /^Pausar espera$/));
  app.emit({ type: 'standby.pause' }); await flush(); assert(second.track.stops > 0); assert(app.contexts.every(context => context.state === 'closed'));
});

test('Interromper aborts real greeting synthesis, drops late audio and keeps the microphone stopped until explicit reactivation', async t => {
  const provider = deferred(), controller = new AbortController();
  let providerSignal, syntheses = 0, requests = 0;
  const initial = microphone(), resumed = microphone();
  const service = new StartupGreetingService({ getSettings: () => ({ startupGreeting: true, elevenVoiceId: 'mockVoice', weatherLocation: { name: 'Cidade de teste', latitude: 10, longitude: 20 } }),
    getKey: () => 'mock-key-never-real', fetch: async () => new Response('', { status: 503 }),
    elevenlabs: { synthesizeSpeech(_options, { signal }) { syntheses++; providerSignal = signal; return provider.promise; } } });
  const app = environment(t, { getUserMedia: async () => ++requests === 1 ? initial : resumed,
    greeting: { start: input => service.prepare(input, { signal: controller.signal }), cancel: () => controller.abort() } });
  app.render(); await flush(); assert(button(app.render(), /^Pausar espera$/));
  button(app.render(), /^Iniciar Jarvis/).props.onClick(); await flush();
  assert.equal(syntheses, 1); assert.equal(providerSignal.aborted, false); assert(initial.track.stops > 0);
  await button(app.render(), /^Interromper$/).props.onClick(); await flush();
  assert.equal(app.cancelledGreetings, 1); assert.equal(providerSignal.aborted, true);
  provider.resolve({ audio: Buffer.from('late-fake-mp3'), contentType: 'audio/mpeg' }); await flush();
  assert.equal(app.audios.length, 0); assert.equal(syntheses, 1);
  app.runDelay(4000); await flush(); assert.equal(requests, 1); assert(button(app.render(), /^Ativar espera$/));
  button(app.render(), /^Ativar espera$/).props.onClick(); await flush(); assert.equal(requests, 2); assert(button(app.render(), /^Pausar espera$/));
});

test('repeated greetings stay out of the conversation while one compact weather credit and useful errors remain', async t => {
  const app = environment(t, { settings: { standbyEnabled: false, startupGreeting: false },
    greeting: { async start() { return { text: 'Bom dia. Saudação falada com previsão.', audioBase64: null, weatherStatus: 'ok', attribution: WEATHER_ATTRIBUTION }; }, cancel() {} } });
  app.render(); await flush();
  for (let attempt = 0; attempt < 2; attempt++) { button(app.render(), /^Iniciar Jarvis/).props.onClick(); await flush(); }
  const tree = app.render();
  assert.equal(elements(tree).filter(element => element.type === 'article').length, 0);
  assert.equal(label(tree).includes('Saudação falada com previsão'), false);
  const footer = elements(tree).find(element => element.type === 'footer');
  const credits = elements(footer).filter(element => element.props?.source);
  assert.equal(credits.length, 1); assert.equal(credits[0].props.compact, true);
  assert.deepEqual(credits[0].props.source, WEATHER_ATTRIBUTION);
  assert.match(label(tree), /Não foi possível gerar o áudio da saudação/);
  app.emit({ type: 'error', message: 'Falha de rede de teste.' });
  assert.match(label(app.render()), /Falha de rede de teste/);
});

test('voice transcripts do not render or autoscroll; typed messages, voice controls and internal context are preserved', async t => {
  const app = environment(t, { mockVoice: true, settings: { hasKey: true, standbyEnabled: false, startupGreeting: false } });
  app.render(); await flush();
  let tree = app.render(), scrolls = 0;
  const history = elements(tree).find(element => element.props?.className === 'messages');
  elements(history).find(element => element.type === 'div' && element.props.ref).props.ref.current = { scrollIntoView() { scrolls++; } };
  await button(tree, /^Iniciar conversa por voz/).props.onClick(); await flush(); app.render();
  const session = app.voiceSessions[0]; assert(session);
  const initialScrolls = scrolls;
  session.callbacks.transcript('user', 'Pergunta falada oculta.', 'voice-user-test', true);
  session.callbacks.transcript('assistant', 'Resposta falada', 'voice-assistant-test', false);
  app.render();
  session.callbacks.transcript('assistant', 'Resposta falada oculta.', 'voice-assistant-test', true);
  tree = app.render();
  assert.equal(elements(tree).filter(element => element.type === 'article').length, 0);
  assert.equal(label(tree).includes('falada oculta'), false); assert.equal(scrolls, initialScrolls);
  button(tree, /^Interromper$/).props.onClick(); assert.equal(session.stops, 1); assert.equal(session.interruptions, 0);
  session.callbacks.error('Falha de síntese de teste.');
  assert.match(label(app.render()), /Falha de síntese de teste/);
  await flush(); tree = app.render(); assert(button(tree, /^Iniciar conversa por voz/));
  elements(tree).find(element => element.type === 'textarea' && element.props.id === 'message-input').props.onChange({ target: { value: 'Pergunta digitada preservada?' } });
  tree = app.render(); elements(tree).find(element => element.props?.className === 'composer').props.onSubmit({ preventDefault() {} });
  await flush(); tree = app.render();
  const messages = elements(tree).filter(element => element.type === 'article');
  assert.equal(messages.length, 2);
  assert.match(label(messages), /Pergunta digitada preservada\?/); assert.match(label(messages), /Resposta digitada preservada/);
  assert.equal(label(tree).includes('falada oculta'), false);
  assert(app.textRequests[0].history.some(message => message.content === 'Pergunta falada oculta.'));
  assert(app.textRequests[0].history.some(message => message.content === 'Resposta falada oculta.'));
  assert(scrolls > initialScrolls);
});
