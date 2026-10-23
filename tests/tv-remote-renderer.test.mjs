import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadRendererModule } from './renderer-module-loader.mjs';

const { TvRemote } = loadRendererModule('tv-remote.tsx');
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const sent = input => ({ ok: true, status: 'unverified', summary: 'Not displayed.', data: input.action ? { action: input.action } : { app: input.app } });
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
  const found = elements(tree).find(element => element.type === 'button' && (element.props['aria-label'] === label || text(element) === label));
  assert(found, `Expected button ${label}`); return found;
}

function remote(t, overrides = {}) {
  const slots = [], effects = [], subscribers = new Set(), listeners = new Map(), calls = [], pending = [], cancellation = [];
  let cursor = 0, unmounted = false, updates = 0, cancelHandler;
  const originalHooks = new Map(), originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const hooks = {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial }; return [slots[index].value, next => { updates++; slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useEffect(effect, dependencies) { const index = cursor++, previous = slots[index]; if (!previous || !dependencies || dependencies.some((value, i) => value !== previous.dependencies?.[i])) { slots[index] = { dependencies, cleanup: previous?.cleanup }; effects.push(() => { slots[index].cleanup?.(); slots[index].cleanup = effect(); }); } },
  };
  for (const [name, hook] of Object.entries(hooks)) { originalHooks.set(name, React[name]); React[name] = hook; }
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: {
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
  } });
  const bridge = {
    async fireTvRemote(input) { calls.push(input); return overrides.send ? overrides.send(input) : sent(input); },
    async cancelFireTvRemote(input) { cancellation.push(input); return { cancelled: true }; },
    onEvent(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
  };
  const props = { bridge, profileId: 'principal', available: true, blocked: false, onSettings() { pending.push('settings'); }, onPendingChange(value) { pending.push(value); }, onCancelReady(value) { cancelHandler = value; } };
  const unmount = () => { if (unmounted) return; unmounted = true; for (const slot of slots) slot?.cleanup?.(); effects.length = 0; };
  t.after(() => {
    unmount();
    for (const [name, original] of originalHooks) React[name] = original;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globalThis.window;
  });
  return {
    calls, pending, cancellation, props, listeners, unmount,
    get updates() { return updates; },
    render() { cursor = 0; return TvRemote(props); },
    commit() { while (effects.length) effects.shift()(); },
    mount() { const tree = this.render(); this.commit(); return tree; },
    emit(event) { for (const callback of subscribers) callback(event); },
    cancel() { cancelHandler?.(); },
  };
}

test('TV remote renders accessible fixed controls without reading the TV, exposing addresses or adding unsupported buttons', async t => {
  const view = remote(t);
  view.mount(); await flush(); const tree = view.render();
  assert.deepEqual(view.calls, []); assert.deepEqual(view.pending, []); assert.deepEqual(view.cancellation, []);
  for (const label of ['Voltar', 'Início', 'Cima', 'Baixo', 'Esquerda', 'Direita', 'Confirmar', 'Aumentar volume', 'Diminuir volume', 'Silenciar ou ativar som', 'Reproduzir', 'Pausar', 'Netflix', 'Prime Video', 'YouTube', 'Disney+', 'Max', 'Spotify']) assert.equal(button(tree, label).props.disabled, false);
  const markup = renderToStaticMarkup(tree);
  assert.match(markup, /role="group" aria-label="Navegação"/); assert.match(markup, /role="status" aria-live="polite"/);
  assert.equal(elements(tree).some(element => element.type === 'input'), false);
  assert.equal(/power|desligar|ligar TV|menu|10\.0\.|172\.20\.|senha|api.?key/i.test(markup), false);
});

test('one click sends one scoped intent and synchronous repeated handlers cannot interleave another command', async t => {
  const reply = deferred();
  const view = remote(t, { send: () => reply.promise });
  let tree = view.mount();
  const first = button(tree, 'Início'); first.props.onClick(); first.props.onClick(); button(tree, 'Netflix').props.onClick();
  assert.equal(view.calls.length, 1); assert.deepEqual(view.pending, [true]);
  const input = view.calls[0];
  assert.deepEqual(Object.keys(input).sort(), ['action', 'id', 'profileId', 'runId']);
  assert.equal(input.action, 'home'); assert.equal(input.profileId, 'principal'); assert.match(input.id, /^[0-9a-f-]{36}$/); assert.match(input.runId, /^tv-remote-[0-9a-f-]{36}$/);
  tree = view.render(); assert.equal(button(tree, 'Netflix').props.disabled, true); assert.match(text(tree), /Enviando comando/);
  reply.resolve(sent(input)); await flush(); tree = view.render();
  assert.match(text(tree), /Comando enviado · confira a televisão/); assert.equal(button(tree, 'Netflix').props.disabled, false); assert.deepEqual(view.pending, [true, false]);
  assert.equal(/verificad|reproduzindo|abriu/i.test(text(tree)), false);
});

test('application shortcuts send app intents and held keyboard events do not dispatch or repeat requests', async t => {
  const view = remote(t); let tree = view.mount();
  const netflix = button(tree, 'Netflix');
  assert.equal(netflix.props.onPointerDown, undefined); assert.equal(netflix.props.onMouseDown, undefined);
  let prevented = false; netflix.props.onKeyDown({ repeat: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(view.calls.length, 0);
  netflix.props.onClick(); await flush(); tree = view.render();
  assert.equal(view.calls.length, 1); assert.equal(view.calls[0].app, 'netflix'); assert.equal(Object.hasOwn(view.calls[0], 'action'), false);
  button(tree, 'Pausar').props.onClick(); await flush();
  assert.equal(view.calls[1].action, 'pause'); assert.notEqual(view.calls[0].id, view.calls[1].id); assert.notEqual(view.calls[0].runId, view.calls[1].runId);
});

test('unsupported or unpaired configuration and busy voice/runtime state prevent dispatch even through stale button handlers', async t => {
  const view = remote(t); const tree = view.mount();
  view.props.available = false; let disabled = view.render(); view.commit();
  assert.equal(button(disabled, 'Início').props.disabled, true); button(tree, 'Início').props.onClick();
  button(disabled, 'Abrir Ajustes').props.onClick(); assert.deepEqual(view.pending, ['settings']);
  view.props.available = true; view.props.blocked = true; disabled = view.render(); view.commit();
  assert.match(text(disabled), /Aguarde a operação atual terminar/); button(disabled, 'Netflix').props.onClick();
  await flush(); assert.deepEqual(view.calls, []);
});

test('failure, malformed success and thrown private messages stay local and never become verified claims or exposed internals', async t => {
  let response = { ok: true, status: 'verified', summary: 'private credential mock-secret at 10.0.0.25', data: { app: 'netflix' } };
  const view = remote(t, { send: () => { if (response instanceof Error) throw response; return response; } });
  view.mount();
  for (const result of [response, { ok: true, status: 'unverified', data: { app: 'youtube' } }, { ok: false, status: 'failed', summary: 'private mock-secret 10.0.0.25' }, new Error('private mock-secret 10.0.0.25')]) {
    response = result; button(view.render(), 'Netflix').props.onClick(); await flush();
    const output = text(view.render()); assert.match(output, /Não foi possível/); assert.equal(/mock-secret|10\.0\.0\.25|credential|verified/.test(output), false); assert.equal(output.includes('Comando enviado'), false);
  }
  assert.equal(view.calls.length, 4); assert.equal(view.cancellation.length, 0);
});

test('explicit interruption aborts only the pending remote command once and ignores a late successful reply', async t => {
  const reply = deferred(); const view = remote(t, { send: () => reply.promise });
  view.mount(); button(view.render(), 'Netflix').props.onClick();
  button(view.render(), 'Interromper envio').props.onClick(); view.cancel(); await flush();
  assert.equal(view.cancellation.length, 1); assert.deepEqual(view.pending, [true, false]);
  assert.deepEqual(view.cancellation[0], { id: view.calls[0].id, runId: view.calls[0].runId, profileId: view.calls[0].profileId });
  reply.resolve(sent(view.calls[0])); await flush();
  assert.match(text(view.render()), /Comando interrompido/); assert.equal(text(view.render()).includes('Comando enviado'), false);
});

test('session reset and profile change cancel pending delivery and exclude late results from the next profile', async t => {
  const replies = [deferred(), deferred()]; let index = 0;
  const view = remote(t, { send: () => replies[index++].promise });
  view.mount(); button(view.render(), 'Início').props.onClick();
  view.emit({ type: 'session.reset', profileId: 'another-profile' }); assert.equal(view.cancellation.length, 0);
  view.emit({ type: 'session.reset', profileId: 'principal' }); await flush();
  replies[0].resolve(sent(view.calls[0])); await flush(); assert.equal(text(view.render()).includes('Comando enviado'), false);
  button(view.render(), 'Netflix').props.onClick();
  view.props.profileId = 'new-profile'; view.render(); view.commit(); await flush();
  replies[1].resolve(sent(view.calls[1])); await flush();
  assert.equal(text(view.render()).includes('Comando enviado'), false); assert.equal(view.cancellation.length, 2);
});

test('closing the drawer or window cancels delivery and prevents state updates from a late reply', async t => {
  const reply = deferred(); const view = remote(t, { send: () => reply.promise });
  view.mount(); button(view.render(), 'Netflix').props.onClick();
  view.listeners.get('beforeunload')(); view.unmount(); await flush();
  assert.equal(view.cancellation.length, 1); const updates = view.updates;
  reply.resolve(sent(view.calls[0])); await flush(); assert.equal(view.updates, updates);
  assert.deepEqual(view.pending, [true, false]); assert.equal(view.listeners.size, 0);
});
