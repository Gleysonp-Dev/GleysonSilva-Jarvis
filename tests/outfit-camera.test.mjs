import test from 'node:test';
import assert from 'node:assert/strict';
import { captureOutfitImage } from '../apps/desktop/renderer/outfit-camera.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(t, { permission, play, readyState = 4, image = 'data:image/jpeg;base64,/9j/2Q==' } = {}) {
  const track = { stops: 0, stop() { this.stops++; } }, calls = [], listeners = new Map(), draws = [];
  const stream = { getTracks: () => [track] };
  const video = { muted: false, playsInline: false, srcObject: null, readyState, videoWidth: 1920, videoHeight: 1080,
    play: play || (async () => {}), pause() { this.paused = true; }, removeAttribute() {}, load() {},
    addEventListener(name, callback) { listeners.set(name, callback); }, removeEventListener(name) { listeners.delete(name); } };
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage(...args) { draws.push(args); } }), toDataURL(type, quality) { calls.push({ type, quality }); return image; } };
  const originals = new Map();
  for (const [key, value] of Object.entries({ navigator: { mediaDevices: { getUserMedia(input) { calls.push(input); return permission || Promise.resolve(stream); } } }, document: { createElement(name) { return name === 'video' ? video : canvas; } } })) {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, value });
  }
  t.after(() => { for (const [key, value] of originals) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } });
  return { track, stream, video, canvas, calls, listeners, draws };
}

test('one bounded JPEG is captured with video only, no preview, then every camera track is released before return', async t => {
  const env = setup(t);
  const result = await captureOutfitImage();
  assert.equal(result, 'data:image/jpeg;base64,/9j/2Q==');
  assert.deepEqual(env.calls[0], { audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 } } });
  assert.equal(env.canvas.width, 640); assert.equal(env.canvas.height, 360); assert.equal(env.draws.length, 1);
  assert.deepEqual(env.calls[1], { type: 'image/jpeg', quality: 0.78 });
  assert.equal(env.track.stops, 1); assert.equal(env.video.srcObject, null); assert.equal(env.video.paused, true);
});

test('cancelling a permission prompt settles immediately and stops a stream granted later', async t => {
  let grant; const permission = new Promise(resolve => { grant = resolve; }); const env = setup(t, { permission });
  const controller = new AbortController(), capture = captureOutfitImage({ signal: controller.signal });
  controller.abort(); await assert.rejects(capture, { name: 'AbortError' });
  grant(env.stream); await tick(); assert.equal(env.track.stops, 1); assert.equal(env.draws.length, 0);
});

test('an aborted or timed out first-frame wait releases tracks and removes camera listeners', async t => {
  const env = setup(t, { readyState: 1 });
  await assert.rejects(captureOutfitImage({ timeoutMs: 10 }), { name: 'AbortError' });
  assert.equal(env.track.stops, 1); assert.equal(env.listeners.size, 0); assert.equal(env.draws.length, 0); assert.equal(env.video.srcObject, null);
});

test('camera playback errors release the camera and never produce an image', async t => {
  const env = setup(t, { play: async () => { throw new Error('camera denied'); } });
  await assert.rejects(captureOutfitImage(), /camera denied/); assert.equal(env.track.stops, 1); assert.equal(env.draws.length, 0);
});

test('aborting just as video playback starts consumes its late rejection and releases the camera', async t => {
  const controller = new AbortController();
  const env = setup(t, { play: () => { controller.abort(); return Promise.reject(new Error('late video failure')); } });
  await assert.rejects(captureOutfitImage({ signal: controller.signal }), { name: 'AbortError' });
  await tick(); assert.equal(env.track.stops, 1); assert.equal(env.draws.length, 0);
});

test('oversized captures are rejected after releasing the camera', async t => {
  const env = setup(t, { image: `data:image/jpeg;base64,${'A'.repeat(700000)}` });
  await assert.rejects(captureOutfitImage(), /tamanho permitido/); assert.equal(env.track.stops, 1);
});

test('non-JPEG capture data is rejected and never returned for upload', async t => {
  const env = setup(t, { image: 'data:image/png;base64,AAAA' });
  await assert.rejects(captureOutfitImage(), /tamanho permitido/); assert.equal(env.track.stops, 1);
});

test('an already cancelled reception never requests camera permission', async t => {
  const env = setup(t), controller = new AbortController(); controller.abort();
  await assert.rejects(captureOutfitImage({ signal: controller.signal }), { name: 'AbortError' }); assert.equal(env.calls.length, 0);
});
