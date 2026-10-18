import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRendererModule } from './renderer-module-loader.mjs';
const { LocalClapStandby } = loadRendererModule('standby.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function stream() { const track = { stops: 0, stop() { this.stops++; } }; return { track, getTracks: () => [track] }; }
function environment(getUserMedia, resume) {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator'), previousAudio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext'), contexts = [];
  class Context {
    state = 'suspended'; sampleRate = 48000; closes = 0;
    constructor() { contexts.push(this); }
    async resume() { if (resume) await resume(); this.state = 'running'; }
    async close() { this.closes++; this.state = 'closed'; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 1024, frequencyBinCount: 512, disconnect() {}, getFloatTimeDomainData(array) { array.fill(0); }, getFloatFrequencyData(array) { array.fill(-Infinity); } }; }
  }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia } } });
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  return { contexts, restore() { if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else delete globalThis.navigator; if (previousAudio) Object.defineProperty(globalThis, 'AudioContext', previousAudio); else delete globalThis.AudioContext; } };
}

test('suspend closes a late permission result; resume never creates parallel microphone requests', async () => {
  const permission = deferred(), first = stream(), second = stream(); let requests = 0;
  const env = environment(() => ++requests === 1 ? permission.promise : Promise.resolve(second));
  const errors = [], standby = new LocalClapStandby({ onWake() {}, onError: message => errors.push(message) });
  try {
    const starting = standby.start(); assert.equal(standby.getState(), 'starting');
    standby.suspend(); const resuming = standby.resume(); await flush(); assert.equal(requests, 1);
    permission.resolve(first); await Promise.all([starting, resuming]);
    assert.equal(first.track.stops, 1); assert.equal(requests, 2); assert.equal(standby.getState(), 'listening');
    standby.suspend(); assert.ok(second.track.stops >= 1); assert.equal(standby.getState(), 'suspended');
    standby.stop(); await standby.resume(); assert.equal(requests, 2); assert.deepEqual(errors, []);
  } finally { standby.stop(); env.restore(); }
});
test('suspend releases stream and context even while AudioContext.resume is pending', async () => {
  const ready = deferred(), input = stream(); const env = environment(async () => input, () => ready.promise);
  const standby = new LocalClapStandby({ onWake() {} });
  try {
    const pending = standby.start(); await flush(); assert.equal(env.contexts.length, 1);
    standby.suspend(); assert.ok(input.track.stops >= 1); assert.ok(env.contexts[0].closes >= 1);
    ready.resolve(); await pending; assert.equal(standby.getState(), 'suspended');
  } finally { standby.stop(); env.restore(); }
});
test('permission denial stays suspended and reports a safe local error without retrying', async () => {
  let requests = 0; const env = environment(async () => { requests++; throw new DOMException('private device detail', 'NotAllowedError'); });
  const errors = [], standby = new LocalClapStandby({ onWake() {}, onError: message => errors.push(message) });
  try {
    await standby.start(); await flush(); assert.equal(requests, 1); assert.equal(standby.getState(), 'suspended');
    assert.equal(errors.length, 1); assert.equal(errors[0].includes('private device detail'), false); assert.equal(env.contexts.length, 0);
  } finally { standby.stop(); env.restore(); }
});
