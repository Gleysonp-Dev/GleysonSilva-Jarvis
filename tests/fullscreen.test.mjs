import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { transform } from 'esbuild';

const source = await readFile(new URL('../apps/desktop/renderer/fullscreen.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'cjs', target: 'node24' });
const compiled = { exports: {} };
new Function('module', 'exports', code)(compiled, compiled.exports);
const { createFullscreenController } = compiled.exports;
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };

function surface() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(name, fn) { const set = listeners.get(name) ?? new Set(); set.add(fn); listeners.set(name, set); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, event = {}) { for (const fn of listeners.get(name) ?? []) fn(event); },
  };
}
function fixture(t, { native = true, initial = false, get, set } = {}) {
  const host = surface(), page = { ...surface(), fullscreenElement: initial ? {} : null }, changed = [], errors = [], requests = [], subscribers = new Set();
  let current = initial;
  const bridge = {
    async getFullscreen() { return get ? get() : current; },
    async setFullscreen(enabled) { requests.push(enabled); if (set) return set(enabled); current = enabled; return current; },
    onFullscreen(callback) { subscribers.add(callback); return () => subscribers.delete(callback); },
  };
  page.documentElement = { async requestFullscreen() { requests.push(true); page.fullscreenElement = page.documentElement; page.emit('fullscreenchange'); } };
  page.exitFullscreen = async () => { requests.push(false); page.fullscreenElement = null; page.emit('fullscreenchange'); };
  const controller = createFullscreenController({ bridge: native ? bridge : undefined, document: page, window: host, onChange: enabled => changed.push(enabled), onError: error => errors.push(error) });
  const key = (key, options = {}) => {
    const event = { key, repeat: false, ctrlKey: false, altKey: false, metaKey: false, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...options };
    host.emit('keydown', event); return event;
  };
  t.after(() => controller.dispose());
  return { ...controller, bridge, host, page, changed, errors, requests, subscribers, key, external(enabled) { current = enabled; for (const callback of subscribers) callback(enabled); } };
}

test('native fullscreen toggles both ways and follows external transitions without touching audio', async t => {
  const f = fixture(t); await tick();
  assert.deepEqual(f.changed, [false]);
  assert.equal(await f.toggle(), true); assert.equal(await f.toggle(), false);
  assert.deepEqual(f.requests, [true, false]);
  f.external(true); assert.equal(await f.set(true), true);
  assert.deepEqual(f.requests, [true, false]);
  f.external(false); assert.equal(f.changed.at(-1), false);
  assert.equal(f.errors.length, 0);
});

test('F11 enters and exits, Escape exits only fullscreen, held and modified keys do not retrigger', async t => {
  const f = fixture(t); await tick();
  assert.equal(f.key('Escape').prevented, false);
  const enter = f.key('F11'); await tick();
  assert.equal(enter.prevented, true); assert.equal(enter.stopped, true); assert.deepEqual(f.requests, [true]);
  assert.equal(f.key('F11', { repeat: true }).prevented, true); await tick();
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) assert.equal(f.key('F11', { [modifier]: true }).prevented, false);
  assert.deepEqual(f.requests, [true]);
  assert.equal(f.key('Escape').prevented, true); await tick(); assert.deepEqual(f.requests, [true, false]);
  f.key('F11'); await tick(); f.key('F11'); await tick(); assert.deepEqual(f.requests, [true, false, true, false]);
});

test('native fullscreen ignores stale initial reads and stale command results after newer state events', async t => {
  const initial = deferred(), command = deferred();
  const f = fixture(t, { get: () => initial.promise, set: () => command.promise });
  f.external(true); initial.resolve(false); await tick();
  assert.deepEqual(f.changed, [true]);
  const request = f.set(false); f.external(false); f.external(true); command.resolve(false);
  assert.equal(await request, true); assert.equal(f.changed.at(-1), true);
});

test('fullscreen serializes requests and recovers after failure with a safe visible error', async t => {
  const command = deferred(); let attempt = 0;
  const f = fixture(t, { set: enabled => ++attempt === 1 ? command.promise : enabled }); await tick();
  const request = f.toggle(); await f.toggle(); await f.set(true);
  assert.deepEqual(f.requests, [true]);
  command.reject(new Error('private native internals')); assert.equal(await request, false);
  assert.equal(f.errors.length, 1); assert.doesNotMatch(f.errors[0].message, /private native internals/);
  assert.equal(await f.toggle(), true); assert.deepEqual(f.requests, [true, true]);
});

test('browser fullscreen uses user-gesture APIs and synchronizes when the browser leaves fullscreen', async t => {
  const f = fixture(t, { native: false });
  assert.equal(await f.toggle(), true); assert.equal(f.page.fullscreenElement, f.page.documentElement);
  f.page.fullscreenElement = null; f.page.emit('fullscreenchange');
  assert.equal(f.changed.at(-1), false);
  await f.toggle(); f.key('Escape'); await tick();
  assert.deepEqual(f.requests, [true, true, false]);
  f.page.documentElement.requestFullscreen = async () => { throw new Error('denied'); };
  assert.equal(await f.toggle(), false); assert.equal(f.errors.length, 1);
});

test('dispose removes fullscreen listeners and ignores late completions and rejections', async t => {
  const initial = deferred(), command = deferred();
  const f = fixture(t, { get: () => initial.promise, set: () => command.promise });
  const pending = f.toggle(); f.dispose(); f.dispose();
  assert.equal(f.subscribers.size, 0); assert.equal(f.host.listeners.get('keydown').size, 0);
  initial.reject(new Error('late')); command.resolve(true); await pending; await tick();
  assert.deepEqual(f.changed, []); assert.deepEqual(f.errors, []);
  assert.equal(await f.toggle(), false); assert.deepEqual(f.requests, [true]);
  const browser = fixture(t, { native: false }); browser.dispose();
  assert.equal(browser.page.listeners.get('fullscreenchange').size, 0);
});

test('preload exposes only fullscreen operations, filters notifications and unsubscribes exactly its listener', async () => {
  const source = await readFile(new URL('../apps/desktop/preload.cjs', import.meta.url), 'utf8');
  const ipc = new EventEmitter(), requests = []; let exposed;
  ipc.invoke = async (...args) => { requests.push(args); return true; };
  const electron = { contextBridge: { exposeInMainWorld(name, bridge) { assert.equal(name, 'jarvis'); exposed = bridge; } }, ipcRenderer: ipc };
  new Function('require', source)(name => { assert.equal(name, 'electron'); return electron; });
  assert.equal(Object.isFrozen(exposed), true); assert.equal(exposed.ipcRenderer, undefined);
  await exposed.getFullscreen(); await exposed.setFullscreen(false);
  assert.deepEqual(requests, [['jarvis:getFullscreen', undefined], ['jarvis:setFullscreen', false]]);
  const first = [], second = [];
  const unsubscribe = exposed.onFullscreen(enabled => first.push(enabled));
  const removeSecond = exposed.onFullscreen(enabled => second.push(enabled));
  assert.throws(() => exposed.onFullscreen(null), /Callback inválido/);
  ipc.emit('jarvis:fullscreen', { sender: 'private' }, true);
  for (const value of [undefined, null, 1, 'true', {}, []]) ipc.emit('jarvis:fullscreen', {}, value);
  unsubscribe(); unsubscribe(); ipc.emit('jarvis:fullscreen', {}, false);
  assert.deepEqual(first, [true]); assert.deepEqual(second, [true, false]);
  removeSecond(); assert.equal(ipc.listenerCount('jarvis:fullscreen'), 0);
});
