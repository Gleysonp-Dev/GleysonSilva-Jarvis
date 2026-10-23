import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { transform } from 'esbuild';
import { loadRendererModule } from './renderer-module-loader.mjs';

const require = createRequire(import.meta.url), React = require('react');
// Export test entry points only in memory; the renderer's production API stays unchanged.
const source = `${await readFile(new URL('../apps/desktop/renderer/App.tsx', import.meta.url), 'utf8')}\nexport { App, normalizeToolSources, approvalPresentation };`;
const { code } = await transform(source, { loader: 'tsx', jsx: 'automatic', format: 'cjs', target: 'node24' });
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
function elements(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree?.props ? text(tree.props.children) : '';
}
function button(tree, label) {
  const result = elements(tree).find(element => element.type === 'button' && (label instanceof RegExp ? label.test(text(element)) : text(element) === label || element.props['aria-label'] === label));
  assert(result, `Expected button ${label}`); return result;
}
const sources = (runId, overrides = {}) => ({ type: 'sources', tool: 'web_search', profileId: 'principal', runId,
  retrievedAt: Date.now() - 1000, sources: [{ url: 'https://example.org/research', title: 'Pesquisa verificável' }], ...overrides });
function environment(t, options = {}) {
  const slots = [], pending = [], subscribers = new Set(), domListeners = new Map(), opened = [], decisions = [], voiceSessions = [], fullscreenRequests = [], fullscreenSubscribers = new Set();
  let fullscreen = false;
  let cursor = 0;
  const hooks = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect, deps) { const index = cursor++, previous = slots[index]; if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) { slots[index] = { deps, cleanup: previous?.cleanup }; pending.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); }); } },
  };
  const current = { profileId: 'principal', textModel: 'test-text', realtimeModel: 'test-voice', voice: 'legacy', maxSessionMinutes: 10,
    workspaceRoot: '', apps: [], hasKey: true, hasElevenKey: true, elevenVoiceId: 'test-voice-id', startupGreeting: false, standbyEnabled: false, ...options.settings };
  const capabilities = { desktop: true, vision: false, jarvisSpeech: true, ...options.capabilities };
  const tvCalls = [];
  const emit = event => { for (const callback of subscribers) callback(event); };
  const bridge = {
    async boot() { return { settings: { ...current }, snapshot: { memories: [], tasks: [], procedures: [] }, capabilities: { ...capabilities } }; },
    async pairFireTv() { tvCalls.push('pair'); const result = await (options.pair?.() ?? { ok: true, status: 'paired', summary: 'Computador autorizado pela TV.' }); if (result.ok) current.fireTvPaired = true; return result; },
    async testFireTv() { tvCalls.push('test'); return options.testTv?.() ?? { ok: true, status: 'connected', summary: 'Conexão com a TV confirmada.' }; },
    async cancelFireTv() { tvCalls.push('cancel'); },
    onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
    async wakeStop() {}, async cancelGreeting() {}, async cancelSpeech() {},
    async openExternal(url) { opened.push(url); },
    async getFullscreen() { return fullscreen; },
    async setFullscreen(enabled) { fullscreenRequests.push(enabled); fullscreen = enabled; return fullscreen; },
    onFullscreen(callback) { fullscreenSubscribers.add(callback); return () => fullscreenSubscribers.delete(callback); },
    async approve(input) { decisions.push(input); },
    async saveSettings(value) { const previous = current.profileId; Object.assign(current, value); emit({ type: 'session.reset', profileId: previous, reason: 'profile_changed' }); },
  };
  class Voice {
    constructor(_bridge, callbacks) { this.callbacks = callbacks; voiceSessions.push(this); }
    async start() { this.callbacks.connection(true); this.callbacks.state('listen'); }
    stop() { this.callbacks.connection(false); this.callbacks.ended(); }
    interrupt() {}
  }
  const globals = {
    window: { jarvis: bridge, location: { href: 'http://127.0.0.1:47833/' }, addEventListener(name, callback) { domListeners.set(name, callback); }, removeEventListener(name) { domListeners.delete(name); } },
    document: { getElementById: () => ({}), activeElement: null, addEventListener() {}, removeEventListener() {} },
  };
  const originals = new Map();
  for (const [key, value] of Object.entries(globals)) { originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); }
  const compiled = { exports: {} };
  const localRequire = name => {
    if (name === 'react') return { ...React, ...hooks };
    if (name === 'react-dom/client') return { createRoot: () => ({ render() {} }) };
    if (name === './styles.css') return {};
    if (name === './hud') return { createHud: () => () => {} };
    if (name === './realtime') return { RealtimeVoice: Voice };
    if (name.startsWith('./')) return loadRendererModule(name.slice(2));
    return require(name);
  };
  new Function('require', 'module', 'exports', code)(localRequire, compiled, compiled.exports);
  t.after(() => {
    for (const slot of slots) slot?.cleanup?.();
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  return { ...compiled.exports, opened, decisions, voiceSessions, fullscreenRequests, emit, current, tvCalls,
    changeFullscreen(enabled) { fullscreen = enabled; for (const callback of fullscreenSubscribers) callback(enabled); },
    render() { cursor = 0; const tree = compiled.exports.App({ skipAutomaticGreeting: true }); while (pending.length) pending.shift()(); return tree; },
    running(runId, profileId = current.profileId) { emit({ type: 'state', state: 'running', tool: 'web_search', runId, profileId }); },
  };
}

test('header fullscreen button reflects native state and returns to the normal window without interrupting voice', async t => {
  const f = environment(t); let tree = f.render(); await flush(); tree = f.render();
  assert.equal(button(tree, 'Tela cheia').props['aria-pressed'], false);
  await button(tree, /^Iniciar conversa por voz/).props.onClick(); await flush();
  assert.equal(f.voiceSessions.length, 1);
  await button(f.render(), 'Tela cheia').props.onClick(); await flush();
  tree = f.render(); assert.equal(button(tree, 'Sair da tela cheia').props['aria-pressed'], true);
  await button(tree, 'Sair da tela cheia').props.onClick(); await flush();
  assert.equal(button(f.render(), 'Tela cheia').props['aria-pressed'], false);
  assert.deepEqual(f.fullscreenRequests, [true, false]);
  assert.equal(f.voiceSessions.length, 1); assert(button(f.render(), /^Encerrar voz/));
  f.changeFullscreen(true); assert.equal(button(f.render(), 'Sair da tela cheia').props['aria-pressed'], true);
});

test('TV drawer gates configured access, preserves idle voice, and blocks controls during voice actions or reset', async t => {
  const app = environment(t, { capabilities: { fireTv: true }, settings: { fireTvEnabled: true, fireTvHost: '10.0.0.25', fireTvPaired: true } });
  app.render(); await flush(); let tree = app.render();
  assert.equal(elements(tree).some(element => element.type?.name === 'TvRemote'), false);
  button(tree, 'Controle da TV').props.onClick(); tree = app.render();
  const control = () => elements(app.render()).find(element => element.type?.name === 'TvRemote');
  assert(control()); assert.equal(control().props.available, true); assert.equal(control().props.blocked, false);
  assert.equal(Object.hasOwn(control().props, 'host'), false);
  await button(tree, /^Iniciar conversa por voz/).props.onClick(); await flush();
  assert.equal(control().props.blocked, false, 'idle connected voice remains usable alongside the remote');
  control().props.onPendingChange(true, 'remote-test-id'); tree = app.render();
  assert(button(tree, /^Encerrar voz/)); assert.equal(app.voiceSessions.length, 1);
  let remoteInterrupts = 0;
  control().props.onCancelReady(() => { remoteInterrupts++; });
  await button(tree, 'Interromper').props.onClick(); await flush();
  assert.equal(remoteInterrupts, 1); assert(button(app.render(), /^Encerrar voz/));
  assert.equal(control().props.blocked, true);
  control().props.onPendingChange(false, 'old-remote-id'); assert.equal(control().props.blocked, true);
  control().props.onPendingChange(false, 'remote-test-id');
  app.voiceSessions[0].callbacks.state('execute'); assert.equal(control().props.blocked, true);
  app.voiceSessions[0].callbacks.state('listen'); assert.equal(control().props.blocked, false);
  app.emit({ type: 'session.reset', profileId: 'principal', reason: 'configuration_changed' });
  assert.equal(control(), undefined);
});

test('source normalization permits bounded public HTTP links and removes credentials, controls, unsafe schemes and duplicates', t => {
  const { normalizeToolSources } = environment(t);
  const valid = Array.from({ length: 8 }, (_, i) => ({ url: `https://example.org/${i}`, title: `${'Título '.repeat(60)}\u202esecreto` }));
  const result = normalizeToolSources(sources('run-safe', { sources: [
    { url: 'javascript:alert(1)', title: 'Bad' }, { url: 'file:///C:/private', title: 'Bad' },
    { url: 'https://user:password@example.org/', title: 'Bad' }, { url: 'https://example.org/?token=private', title: 'Bad' },
    { url: 'https://example.org/\ncontrol', title: 'Bad' }, { url: 'https://example.org/%0a', title: 'Bad' },
    ...valid, valid[0],
  ] }));
  assert.equal(result.sources.length, 6);
  assert.equal(new Set(result.sources.map(item => item.url)).size, 6);
  for (const item of result.sources) { assert.match(item.url, /^https:\/\/example.org\//); assert.equal(item.hostname, 'example.org'); assert(item.title.length <= 160); assert.equal(item.title.includes('\u202e'), false); }
  const http = normalizeToolSources(sources('run-http', { retrievedAt: new Date(Date.now() - 1000).toISOString(), sources: [{ url: 'http://example.org/', title: {} }] }));
  assert.equal(http.sources[0].title, 'example.org'); assert.equal(typeof http.retrievedAt, 'number');
  for (const input of [null, [], sources('run', { retrievedAt: NaN }), sources('run', { retrievedAt: Date.now() + 3600_000 }), sources('run', { profileId: '' }), sources('run', { tool: 'invented' }), sources('run', { sources: {} })]) assert.equal(normalizeToolSources(input), null);
});

test('voice consultations expose compact source links outside the message log without displaying spoken transcripts or opening a panel', async t => {
  const app = environment(t); app.render(); await flush(); let tree = app.render();
  assert.equal(elements(tree).some(element => element.props?.className === 'tool-sources'), false);
  await button(tree, /^Iniciar conversa por voz/).props.onClick(); await flush();
  app.voiceSessions[0].callbacks.transcript('user', 'Pergunta falada privada.', 'voice-user', true);
  app.voiceSessions[0].callbacks.transcript('assistant', 'Resposta falada privada.', 'voice-answer', true);
  app.running('voice-consultation'); app.emit(sources('voice-consultation'));
  tree = app.render();
  const strip = elements(tree).find(element => element.type === 'aside' && element.props?.className === 'tool-sources');
  assert(strip); assert.match(text(strip), /Pesquisa verificável/); assert.match(text(strip), /example.org/);
  const messages = elements(tree).find(element => element.props?.className === 'messages');
  assert.equal(elements(messages).some(element => element.type === 'a'), false);
  assert.equal(elements(tree).some(element => element.type === 'article'), false);
  assert.equal(text(tree).includes('falada privada'), false);
  assert.equal(elements(tree).some(element => element.props?.title === 'Contexto' && element.props['aria-expanded'] === true), false);
  const link = elements(strip).find(element => element.type === 'a'); let prevented = false;
  link.props.onClick({ preventDefault() { prevented = true; } }); await flush();
  assert.equal(prevented, true); assert.deepEqual(app.opened, ['https://example.org/research']);
  assert.equal(elements(tree).some(element => element.type === 'canvas'), true);
  assert.match(text(tree), /MVP \/ 07\.1/);
});

test('last sources persist until the next consultation and slower earlier runs cannot replace a newer result', async t => {
  const app = environment(t); app.render(); await flush(); app.render();
  app.running('first'); app.emit(sources('first', { retrievedAt: Date.now() - 3000 }));
  app.running('second'); assert.match(text(app.render()), /Pesquisa verificável/);
  app.emit(sources('second', { tool: 'web_read', retrievedAt: Date.now() - 2000, sources: [{ url: 'https://new.example.org/page', title: 'Consulta mais nova' }] }));
  assert.match(text(app.render()), /Consulta mais nova/);
  app.emit(sources('first', { retrievedAt: Date.now() - 1000, sources: [{ url: 'https://old.example.org/', title: 'Resposta tardia antiga' }] }));
  assert.equal(text(app.render()).includes('Resposta tardia antiga'), false);
  assert.match(text(app.render()), /Consulta mais nova/);
  app.emit(sources('second', { retrievedAt: Date.now(), sources: [] }));
  assert.equal(elements(app.render()).some(element => element.props?.className === 'tool-sources'), false);
});

test('reset, cancellation and profile boundaries prevent late sources from crossing into another session', async t => {
  const app = environment(t); app.render(); await flush(); app.render();
  app.running('before-reset'); app.emit(sources('before-reset')); assert.match(text(app.render()), /Pesquisa verificável/);
  app.emit({ type: 'session.reset', profileId: 'principal', reason: 'configuration_changed' });
  app.emit(sources('before-reset', { retrievedAt: Date.now() }));
  assert.equal(elements(app.render()).some(element => element.props?.className === 'tool-sources'), false);
  app.running('cancelled'); app.emit({ type: 'state', state: 'cancelled', profileId: 'principal', runId: 'cancelled' });
  app.emit(sources('cancelled')); assert.equal(text(app.render()).includes('Pesquisa verificável'), false);
  app.running('wrong-profile', 'another-profile'); app.emit(sources('wrong-profile', { profileId: 'another-profile' }));
  assert.equal(text(app.render()).includes('Pesquisa verificável'), false);
  app.running('fresh'); app.emit(sources('fresh')); assert.match(text(app.render()), /Pesquisa verificável/);
  button(app.render(), 'Ocultar fontes').props.onClick(); assert.equal(text(app.render()).includes('Pesquisa verificável'), false);
});

test('changing the configured profile clears sources and accepts only new runs for the new profile', async t => {
  const app = environment(t); app.render(); await flush(); app.render();
  app.running('old-profile-run'); app.emit(sources('old-profile-run'));
  const profile = elements(app.render()).find(element => element.props?.className === 'profile-button'); profile.props.onClick();
  let tree = app.render();
  const profileLabel = elements(tree).find(element => element.type === 'label' && text(element).startsWith('Identificador do perfil'));
  const input = elements(profileLabel).find(element => element.type === 'input'); input.props.onChange({ target: { value: 'new-profile' } });
  tree = app.render(); const settingsForm = elements(tree).find(element => element.type === 'form' && element.props?.className === 'settings-form');
  await settingsForm.props.onSubmit({ preventDefault() {} }); await flush(); app.render();
  assert.equal(app.current.profileId, 'new-profile'); assert.equal(text(app.render()).includes('Pesquisa verificável'), false);
  app.emit(sources('old-profile-run')); assert.equal(text(app.render()).includes('Pesquisa verificável'), false);
  app.running('new-profile-run'); app.emit(sources('new-profile-run', { profileId: 'new-profile', sources: [{ url: 'https://new-profile.example.org/', title: 'Fonte do perfil novo' }] }));
  assert.match(text(app.render()), /Fonte do perfil novo/);
});

test('new application, folder and web approvals show concrete readable parameters and retain explicit decision controls', async t => {
  const app = environment(t); app.render(); await flush(); app.render();
  const presentation = app.approvalPresentation({ tool: 'apps_launch', args: { appId: 'opaque-application-id' }, details: { appLabel: 'Editor de ensaio' } }, []);
  assert.match(presentation.title, /Editor de ensaio/); assert.equal(JSON.stringify(presentation).includes('opaque-application-id'), false);
  const browser = app.approvalPresentation({ tool: 'apps_open', args: { appId: 'browser' }, details: { appId: 'browser', appLabel: 'Navegador padrão do Windows' } }, []);
  assert.deepEqual(browser.fields, [{ label: 'Aplicativo', value: 'Navegador padrão do Windows' }]);
  assert.match(browser.title, /Navegador padrão do Windows/);
  const folder = app.approvalPresentation({ tool: 'folders_open', args: { folder: 'downloads' }, details: { folder: 'C:\\Sandbox\\Downloads', label: 'Downloads' } }, []);
  assert.deepEqual(folder.fields, [{ label: 'Pasta', value: 'Downloads' }, { label: 'Local', value: 'C:\\Sandbox\\Downloads' }]);
  const query = app.approvalPresentation({ tool: 'web_search', args: { query: 'tempo em cidade de teste' }, details: { scope: 'Pesquisa pública' } }, []);
  assert.equal(query.fields[0].value, 'tempo em cidade de teste'); assert.equal(query.fields[1].label, 'Acesso');
  const web = app.approvalPresentation({ tool: 'web_read', args: { url: 'https://example.org/public' }, details: { destination: 'Texto público poderá seguir à IA.' } }, []);
  assert.deepEqual(web.fields, [{ label: 'Página', value: 'https://example.org/public' }, { label: 'Envio de dados', value: 'Texto público poderá seguir à IA.' }]);
  app.emit({ type: 'approval', tool: 'apps_launch', approvalId: 'approval-app', profileId: 'principal', runId: 'approval-run', args: { appId: 'opaque-application-id' }, details: { appLabel: 'Editor de ensaio' } });
  const tree = app.render(), card = elements(tree).find(element => element.props?.className === 'approval-card');
  assert.match(text(card), /Abrir aplicativo instalado: Editor de ensaio/);
  assert.equal(elements(card).some(element => element.type === 'pre'), false); assert(elements(card).some(element => element.type === 'dl'));
  await button(card, 'Recusar').props.onClick(); assert.deepEqual(app.decisions, [{ approvalId: 'approval-app', allow: false }]);
  assert(button(card, 'Autorizar'));
});

test('a Windows launch without window evidence is presented as dispatched, never as completed', async t => {
  const app = environment(t); app.render(); await flush(); app.render();
  app.emit({ type: 'action', id: 'windows-dispatch', tool: 'apps_launch', status: 'unverified', profileId: 'principal', runId: 'windows-run', at: new Date().toISOString() });
  button(app.render(), 'Atividades').props.onClick();
  const timeline = elements(app.render()).find(element => element.type === 'ol' && element.props?.className === 'timeline');
  assert(timeline); assert.match(text(timeline), /Enviada ao Windows/); assert.match(text(timeline), /sem verificação da janela/);
  assert.equal(text(timeline).includes('Concluída'), false);
});

test('Fire TV commands report dispatch to the television without claiming verified execution or a Windows action', async t => {
  const app = environment(t); app.render(); await flush(); app.render();
  for (const tool of ['tv_control', 'tv_open_app']) app.emit({ type: 'action', id: `dispatch-${tool}`, tool, status: 'unverified', profileId: 'principal', runId: `run-${tool}`, at: new Date().toISOString() });
  button(app.render(), 'Atividades').props.onClick();
  const timeline = elements(app.render()).find(element => element.type === 'ol' && element.props?.className === 'timeline');
  assert.match(text(timeline), /Comando enviado à Fire TV · confira a televisão/);
  assert.match(text(timeline), /Controlar Fire TV/); assert.match(text(timeline), /Abrir aplicativo na Fire TV/);
  assert.equal(text(timeline).includes('Windows'), false); assert.equal(text(timeline).includes('Concluída'), false);
});

function openSettings(app) {
  elements(app.render()).find(element => element.props?.className === 'profile-button').props.onClick();
  return app.render();
}
function field(tree, startsWith) {
  const label = elements(tree).find(element => element.type === 'label' && text(element).startsWith(startsWith));
  assert(label, `Expected field ${startsWith}`);
  return elements(label).find(element => element.type === 'input');
}

test('Fire TV saves explicit configuration before pairing, requests on-TV approval, and preserves unrelated form edits', async t => {
  let finishPair;
  const pair = new Promise(resolve => { finishPair = resolve; });
  const app = environment(t, { capabilities: { fireTv: true }, pair: () => pair });
  app.render(); await flush(); let tree = openSettings(app);
  assert.deepEqual(app.tvCalls, []);
  field(tree, 'Controlar Fire TV').props.onChange({ target: { checked: true } }); tree = app.render();
  field(tree, 'IP da TV').props.onChange({ target: { value: '10.0.0.25' } }); tree = app.render();
  assert.equal(button(tree, 'Parear TV').props.disabled, true);
  await elements(tree).find(element => element.type === 'form' && element.props.className === 'settings-form').props.onSubmit({ preventDefault() {} });
  await flush(); tree = openSettings(app);
  assert.equal(app.current.fireTvHost, '10.0.0.25'); assert.equal(app.current.fireTvEnabled, true);
  assert.deepEqual(app.tvCalls, []); assert.equal(button(tree, 'Parear TV').props.disabled, false);
  field(tree, 'Modelo de texto').props.onChange({ target: { value: 'unsaved-model' } }); tree = app.render();
  button(tree, 'Parear TV').props.onClick(); await flush(); tree = app.render();
  assert.deepEqual(app.tvCalls, ['pair']);
  assert.equal(button(tree, 'Salvar configuração').props.disabled, true); assert.equal(button(tree, 'Testar conexão').props.disabled, true);
  app.emit({ type: 'fire_tv_pairing', state: 'approval_required', profileId: 'principal' });
  assert.match(text(app.render()), /Aguardando aprovação: permita este computador na tela da TV/);
  finishPair({ ok: true, status: 'paired', summary: 'Computador autorizado pela TV.' }); await flush(); tree = app.render();
  assert.match(text(tree), /Computador autorizado pela TV/); assert.equal(button(tree, 'Parear TV').props.disabled, false);
  assert.equal(field(tree, 'Modelo de texto').props.value, 'unsaved-model'); assert.equal(app.current.textModel, 'test-text');
  button(tree, 'Testar conexão').props.onClick(); await flush(); tree = app.render();
  assert.deepEqual(app.tvCalls, ['pair', 'test']); assert.match(text(tree), /Conexão com a TV confirmada/);
});

test('unsaved Fire TV address, enablement or profile changes cannot dispatch pairing or connection tests', async t => {
  const app = environment(t, { capabilities: { fireTv: true }, settings: { fireTvEnabled: true, fireTvHost: '10.0.0.25' } });
  app.render(); await flush(); let tree = openSettings(app);
  field(tree, 'IP da TV').props.onChange({ target: { value: '10.0.0.26' } }); tree = app.render();
  assert.equal(button(tree, 'Parear TV').props.disabled, true); assert.equal(button(tree, 'Testar conexão').props.disabled, true);
  button(tree, 'Parear TV').props.onClick(); button(tree, 'Testar conexão').props.onClick(); await flush();
  assert.deepEqual(app.tvCalls, []);
  field(tree, 'IP da TV').props.onChange({ target: { value: '10.0.0.25' } }); tree = app.render();
  field(tree, 'Identificador do perfil').props.onChange({ target: { value: 'different-profile' } }); tree = app.render();
  assert.equal(button(tree, 'Parear TV').props.disabled, true); button(tree, 'Parear TV').props.onClick(); await flush();
  assert.deepEqual(app.tvCalls, []);
});

test('Fire TV pairing results and approval events are ignored after reset or explicit interruption', async t => {
  let finishPair;
  const app = environment(t, { capabilities: { fireTv: true }, settings: { fireTvEnabled: true, fireTvHost: '10.0.0.25' }, pair: () => new Promise(resolve => { finishPair = resolve; }) });
  app.render(); await flush(); let tree = openSettings(app);
  button(tree, 'Parear TV').props.onClick(); await flush();
  app.emit({ type: 'session.reset', profileId: 'principal', reason: 'configuration_changed' });
  app.emit({ type: 'fire_tv_pairing', state: 'approval_required', profileId: 'principal' });
  finishPair({ ok: true, status: 'paired', summary: 'Late result from the old connection.' }); await flush(); tree = app.render();
  assert.equal(text(tree).includes('Late result'), false); assert.equal(text(tree).includes('Aguardando aprovação'), false);
  assert.equal(button(tree, 'Parear TV').props.disabled, false);
  button(tree, 'Parear TV').props.onClick(); await flush(); tree = app.render();
  button(tree, 'Interromper conexão').props.onClick(); await flush();
  assert.deepEqual(app.tvCalls, ['pair', 'pair', 'cancel']);
  finishPair({ ok: true, status: 'paired', summary: 'Late result from an interrupted connection.' }); await flush();
  assert.equal(text(app.render()).includes('Late result'), false); assert.match(text(app.render()), /Conexão com a TV interrompida/);
});

test('Fire TV actions stay unavailable in the local browser test', async t => {
  const app = environment(t, { capabilities: { fireTv: true, localTest: true }, settings: { fireTvEnabled: true, fireTvHost: '10.0.0.25' } });
  app.render(); await flush(); let tree = openSettings(app);
  assert.equal(button(tree, 'Parear TV').props.disabled, true); assert.match(text(tree), /Disponível no aplicativo Windows/);
  button(tree, 'Parear TV').props.onClick(); await flush(); assert.deepEqual(app.tvCalls, []);
});

test('an active voice session blocks Fire TV pairing and configuration testing', async t => {
  const app = environment(t, { capabilities: { fireTv: true }, settings: { fireTvEnabled: true, fireTvHost: '10.0.0.25' } });
  app.render(); await flush(); let tree = openSettings(app);
  await button(tree, /^Iniciar conversa por voz/).props.onClick(); await flush(); tree = app.render();
  assert.equal(button(tree, 'Parear TV').props.disabled, true); assert.equal(button(tree, 'Testar conexão').props.disabled, true);
  button(tree, 'Parear TV').props.onClick(); button(tree, 'Testar conexão').props.onClick(); await flush();
  assert.deepEqual(app.tvCalls, []);
});
