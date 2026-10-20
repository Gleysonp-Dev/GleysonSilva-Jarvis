import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadRendererModule } from './renderer-module-loader.mjs';
import { WEATHER_ATTRIBUTION } from '../packages/greeting/index.mjs';

const { ContextPanel } = loadRendererModule('context-panel.tsx');
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const instant = Date.UTC(2026, 9, 20, 14, 30);
function context(overrides = {}) {
  const value = {
    generatedAt: instant,
    weather: { status: 'ok', timezone: 'UTC', locationLabel: 'Cidade de ensaio',
      weather: { date: '2026-10-20', observedAt: instant - 600_000, currentTemperature: 23.4, weatherCode: 3,
        condition: 'Céu encoberto', minimum: 18.2, maximum: 27.1, precipitationProbability: 45 },
      attribution: WEATHER_ATTRIBUTION, fetchedAt: instant - 60_000, cache: { hit: true, expiresAt: instant + 540_000 } },
    activity: { status: 'ok', observedAt: instant, total: 0, observedCount: 0, limit: 100,
      counts: { running: 0, awaitingApproval: 0, completed: 0, failed: 0, cancelled: 0, interrupted: 0 }, tasks: [], truncated: false },
    sources: [{ id: 'weather', label: 'Clima · Open-Meteo', status: 'ok', observedAt: instant - 600_000, attribution: WEATHER_ATTRIBUTION },
      { id: 'local_activity', label: 'Atividade local · Jarvis', status: 'ok', observedAt: instant }],
  };
  return { ...value, ...overrides };
}
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
  const result = elements(tree).find(element => element.type === 'button' && text(element) === label);
  assert(result, `Expected button ${label}`); return result;
}

// Like app-lifecycle.test.mjs, drive real renderer exports with a minimal hook
// lifecycle. Keep JSX and nested source attribution as real React elements. This
// verifies effects and event handlers without claiming browser/layout coverage.
function panel(t, bridge) {
  const slots = [], pendingEffects = [], listeners = new Map();
  let cursor = 0, unmounted = false, updates = 0;
  const originalHooks = new Map(), originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { updates++; slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect, dependencies) {
      const index = cursor++, previous = slots[index];
      if (!previous || !dependencies || dependencies.some((value, i) => value !== previous.dependencies?.[i])) {
        slots[index] = { dependencies, cleanup: previous?.cleanup };
        pendingEffects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  for (const [name, hook] of Object.entries(hooks)) { originalHooks.set(name, React[name]); React[name] = hook; }
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: {
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
  } });
  const callbacks = { settings: 0, activity: 0, external: [] };
  const props = { bridge, onSettings() { callbacks.settings++; }, onActivity() { callbacks.activity++; }, onOpen(url) { callbacks.external.push(url); } };
  const unmount = () => { if (unmounted) return; unmounted = true; for (const slot of slots) slot?.cleanup?.(); pendingEffects.length = 0; };
  t.after(() => {
    unmount();
    for (const [name, value] of originalHooks) React[name] = value;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globalThis.window;
  });
  return {
    callbacks, listeners, unmount,
    get updates() { return updates; },
    render() { cursor = 0; return ContextPanel(props); },
    commit() { while (pendingEffects.length) pendingEffects.shift()(); },
    mount() { const tree = this.render(); this.commit(); return tree; },
  };
}

test('rendering is dormant until mounted, then queries once with the computer timezone and no capture or narration', async t => {
  const calls = [], unexpected = [];
  const bridge = { async readContext(input) { calls.push(input); return context(); }, async cancelContext() {},
    startupGreeting() { unexpected.push('greeting'); }, speak() { unexpected.push('speech'); }, wakeStart() { unexpected.push('microphone'); },
    vision() { unexpected.push('camera'); }, text() { unexpected.push('model'); } };
  const view = panel(t, bridge);
  assert.equal(calls.length, 0);
  view.render(); assert.equal(calls.length, 0, 'Rendering must not query before an effect is committed');
  view.commit(); await flush();
  assert.deepEqual(calls, [{ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }]);
  const tree = view.render(); view.commit(); await flush();
  assert.equal(calls.length, 1, 'Rerenders must not poll');
  assert.deepEqual(unexpected, []);
  assert.match(text(tree), /23,4 °C/);
  assert.match(text(tree), /45%/);
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /href="https:\/\/open-meteo\.com\/"/);
  assert.match(markup, /href="https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/"/);
  assert.match(markup, /Em cache/);
  assert.match(markup, /válido até/);
});

test('refresh reads again, removes the previous data while pending and displays the new response', async t => {
  const second = deferred(); let reads = 0;
  const view = panel(t, { readContext() { return ++reads === 1 ? Promise.resolve(context()) : second.promise; }, async cancelContext() {} });
  view.mount(); await flush();
  assert.match(text(view.render()), /23,4 °C/);
  button(view.render(), 'Atualizar').props.onClick();
  const loading = view.render();
  assert.equal(reads, 2); assert.equal(button(loading, 'Atualizar').props.disabled, true);
  assert.equal(text(loading).includes('23,4 °C'), false, 'A fresh pending query must not present old weather as current');
  const newer = context(); newer.weather.weather.currentTemperature = 19.8; newer.weather.cache.hit = false;
  second.resolve(newer); await flush();
  const updated = view.render();
  assert.equal(button(updated, 'Atualizar').props.disabled, false);
  assert.match(text(updated), /19,8 °C/); assert.equal(text(updated).includes('23,4 °C'), false);
  assert.match(text(updated), /Consultado na fonte/);
});

test('closing cancels the query, removes its page listener and discards a late successful response', async t => {
  const pending = deferred(); let cancellations = 0;
  const view = panel(t, { readContext: () => pending.promise, async cancelContext() { cancellations++; } });
  view.mount(); assert.equal(view.listeners.has('beforeunload'), true);
  view.unmount(); const updatesAtClose = view.updates;
  assert.equal(cancellations, 1); assert.equal(view.listeners.size, 0);
  pending.resolve(context()); await flush();
  assert.equal(view.updates, updatesAtClose, 'No setters may run for a closed panel even if the provider ignores cancellation');
});

test('page shutdown cancels and ignores a late rejection without surfacing private provider errors', async t => {
  const pending = deferred(); let cancellations = 0;
  const view = panel(t, { readContext: () => pending.promise, async cancelContext() { cancellations++; } });
  view.mount(); view.listeners.get('beforeunload')();
  const updatesAtClose = view.updates;
  pending.reject(new Error('PRIVATE-CREDENTIAL-PATH')); await flush();
  assert.equal(cancellations, 1); assert.equal(view.updates, updatesAtClose);
  assert.equal(text(view.render()).includes('PRIVATE-CREDENTIAL-PATH'), false);
});

test('missing city has no invented forecast and offers configuration while independent local activity remains usable', async t => {
  const value = context(); value.weather = { ...value.weather, status: 'not_configured', locationLabel: '', weather: null, attribution: null, fetchedAt: null, cache: { hit: false, expiresAt: null } };
  value.sources[0] = { id: 'weather', label: 'Clima · Open-Meteo', status: 'not_configured', observedAt: null };
  const view = panel(t, { readContext: async () => value, async cancelContext() {} });
  view.mount(); await flush(); const tree = view.render(), content = text(tree);
  assert.equal(content.includes('°C'), false); assert.equal(content.includes('45%'), false);
  assert.equal(content.includes('Cidade de ensaio'), false);
  button(tree, 'Configurar cidade').props.onClick(); assert.equal(view.callbacks.settings, 1);
  button(tree, 'Abrir registro').props.onClick(); assert.equal(view.callbacks.activity, 1);
  assert.match(content, /Nenhuma execução registrada/);
});

test('unavailable weather and activity show independent source failures instead of zero values or stale data', async t => {
  const value = context(); value.weather = { ...value.weather, status: 'unavailable', weather: null, attribution: null };
  value.activity = { ...value.activity, status: 'unavailable' };
  const view = panel(t, { readContext: async () => value, async cancelContext() {} });
  view.mount(); await flush(); const tree = view.render(), content = text(tree);
  assert.equal(content.includes('°C'), false); assert.equal(content.includes('0execuções'), false);
  assert.equal(elements(tree).some(element => element.props?.className === 'context-total'), false);
  assert.equal(elements(tree).some(element => element.props?.className === 'context-counts'), false);
  assert.match(content, /fonte do tempo não respondeu/); assert.match(content, /registro local não está disponível/);
});

test('observed activity is explicitly bounded and never presented as the unlimited history total', async t => {
  const value = context();
  value.activity = { ...value.activity, total: 1000, observedCount: 100, limit: 100, counts: { ...value.activity.counts, completed: 98, running: 2 },
    tasks: Array.from({ length: 8 }, (_, i) => ({ runId: `run-${i}`, status: i < 2 ? 'running' : 'completed', updatedAt: new Date(instant - i * 1000).toISOString(), tool: i ? 'workspace_list' : 'UNKNOWN-PRIVATE-TOOL' })), truncated: true };
  const view = panel(t, { readContext: async () => value, async cancelContext() {} });
  view.mount(); await flush(); const tree = view.render(), content = text(tree);
  const total = elements(tree).find(element => element.props?.className === 'context-total');
  assert.equal(text(total), '100execuções observadas');
  assert.match(content, /até 100 execuções recentes/); assert.match(content, /8 execuções mais recentes do recorte/);
  assert.equal(content.includes('1000'), false); assert.equal(content.includes('UNKNOWN-PRIVATE-TOOL'), false);
  assert.equal(elements(tree).filter(element => element.type === 'li').length, 8);
  const counts = elements(tree).find(element => element.props?.className === 'context-counts');
  assert.match(text(counts), /Em andamento2/); assert.match(text(counts), /Concluídas98/);
});

test('refresh failure clears previous values and exposes only a safe error with a retry control', async t => {
  let reads = 0;
  const view = panel(t, { async readContext() { if (++reads > 1) throw new Error('SECRET-KEY-IN-PROVIDER-ERROR'); return context(); }, async cancelContext() {} });
  view.mount(); await flush(); assert.match(text(view.render()), /23,4 °C/);
  button(view.render(), 'Atualizar').props.onClick(); await flush();
  const tree = view.render(), content = text(tree);
  assert.equal(content.includes('23,4 °C'), false); assert.equal(content.includes('SECRET-KEY-IN-PROVIDER-ERROR'), false);
  assert(elements(tree).some(element => element.props?.role === 'alert'));
  assert.equal(button(tree, 'Atualizar').props.disabled, false);
});

test('an older bridge cannot silently substitute fake context or start a query', t => {
  const view = panel(t, {}); view.mount();
  const tree = view.render();
  assert.equal(button(tree, 'Atualizar').props.disabled, true);
  assert.equal(elements(tree).some(element => element.type === 'section'), false);
  assert.match(text(tree), /Contexto indisponível nesta versão/);
});
