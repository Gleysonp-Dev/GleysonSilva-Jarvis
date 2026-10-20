import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHud } from '../apps/desktop/renderer/hud.ts';

function fixture(t, { mode = 'idle', reducedMotion = false, width = 800, height = 800 } = {}) {
  const originals = new Map();
  const install = (name, value) => {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  t.after(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  });
  let raf, observer, cancelled, disconnected = false;
  const listeners = new Set();
  const media = { matches: reducedMotion, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  const calls = { clears: 0, scales: [], points: [], colors: [], text: 0 };
  const ctx = {
    setTransform() {}, clearRect() { calls.clears++; calls.points = []; }, save() {}, restore() {}, translate() {},
    scale(x, y) { calls.scales.push([x, y]); }, beginPath() {},
    moveTo(x, y) { calls.points.push([x, y]); }, lineTo(x, y) { calls.points.push([x, y]); },
    createRadialGradient() { return { addColorStop(_, color) { calls.colors.push(color); } }; },
    fillRect() {}, stroke() { calls.colors.push(this.strokeStyle); }, arc() {}, fill() { calls.colors.push(this.fillStyle); },
    fillText() { calls.text++; },
  };
  install('matchMedia', () => media);
  install('devicePixelRatio', 2);
  install('document', { hidden: false });
  install('requestAnimationFrame', fn => { raf = fn; return 7; });
  install('cancelAnimationFrame', id => { cancelled = id; });
  install('ResizeObserver', class { constructor(fn) { observer = fn; } observe() {} disconnect() { disconnected = true; } });
  const state = { mode, levels: { mic: 0, speaker: 0, wave: [] } };
  const canvas = { width: 0, height: 0, getContext: () => ctx, getBoundingClientRect: () => ({ width, height }) };
  const dispose = createHud(canvas, () => state);
  observer();
  return { state, canvas, calls, dispose, listeners, media, tick: ms => raf(ms), get cancelled() { return cancelled; }, get disconnected() { return disconnected; } };
}

test('orbital HUD follows microphone and speaker levels while keeping a single blue hue and an empty centre', t => {
  const hud = fixture(t, { mode: 'listen' });
  hud.tick(0);
  const quietScale = hud.calls.scales.at(-1)[0];
  hud.state.levels.mic = 1; hud.state.levels.wave = Array(41).fill(.4);
  for (let i = 1; i <= 10; i++) hud.tick(i * 40);
  assert(hud.calls.scales.at(-1)[0] > quietScale * 1.03);
  hud.state.mode = 'speak'; hud.state.levels.mic = 0; hud.state.levels.speaker = 1;
  hud.tick(440);
  assert(hud.calls.scales.at(-1)[0] > quietScale * 1.03);
  assert.equal(hud.calls.text, 0);
  assert(hud.calls.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) > 140));
  assert(hud.calls.colors.every(color => /^rgba\(70,190,255,/.test(color)));
  hud.dispose();
});

test('orbital HUD limits idle frames to 15fps and active frames to 30fps', t => {
  const hud = fixture(t);
  hud.tick(0); const initial = hud.calls.clears;
  hud.tick(34); hud.tick(65); assert.equal(hud.calls.clears, initial);
  hud.tick(67); assert.equal(hud.calls.clears, initial + 1);
  hud.state.mode = 'execute';
  hud.tick(99); assert.equal(hud.calls.clears, initial + 1);
  hud.tick(101); assert.equal(hud.calls.clears, initial + 2);
  hud.dispose();
});

test('reduced motion freezes orbital geometry even during loud speech', t => {
  const hud = fixture(t, { mode: 'speak', reducedMotion: true });
  hud.tick(0);
  const before = structuredClone(hud.calls.points), scale = hud.calls.scales.at(-1);
  hud.state.levels.speaker = 1; hud.state.levels.wave = Array(41).fill(1);
  hud.tick(100); hud.tick(200);
  assert.deepEqual(hud.calls.points, before);
  assert.deepEqual(hud.calls.scales.at(-1), scale);
  hud.dispose();
});

test('orbital HUD caps backing resolution and releases its observer, media listener and animation', t => {
  const hud = fixture(t, { width: 4000, height: 2400 });
  assert(hud.canvas.width * hud.canvas.height <= 2_402_000);
  assert.equal(hud.listeners.size, 1);
  hud.dispose();
  assert(hud.disconnected); assert.equal(hud.cancelled, 7); assert.equal(hud.listeners.size, 0);
  const count = hud.calls.clears;
  hud.tick(100);
  assert.equal(hud.calls.clears, count);
});
