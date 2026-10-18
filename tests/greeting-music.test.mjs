import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRendererModule } from './renderer-module-loader.mjs';
const { GreetingMusic } = loadRendererModule('greeting-music.ts');

function environment({ failGraph = false } = {}) {
  const saved = new Map(['window', 'Audio', 'AudioContext'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const audios = [], contexts = [];
  class Audio {
    paused = true; onerror = null; loop = false;
    constructor(src) { this.src = src; audios.push(this); }
    async play() { this.paused = false; }
    pause() { this.paused = true; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() {}
  }
  class Context {
    state = 'suspended'; currentTime = 10; closes = 0; destination = {};
    constructor() { contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.closes++; this.state = 'closed'; }
    createMediaElementSource() { if (failGraph) throw new Error('private graph detail'); return { connect() {}, disconnect() {} }; }
    createGain() {
      const parameter = { value: 0, ramps: [], holds: [], setValueAtTime(value) { this.value = value; }, cancelAndHoldAtTime(at) { this.holds.push(at); }, linearRampToValueAtTime(value, at) { this.value = value; this.ramps.push([value, at]); } };
      const gain = { gain: parameter, connect() {}, disconnect() {} }; this.gain = gain; return gain;
    }
  }
  for (const [name, value] of [['window', { location: { href: 'http://127.0.0.1:47832/index.html' } }], ['Audio', Audio], ['AudioContext', Context]]) Object.defineProperty(globalThis, name, { configurable: true, value });
  return { audios, contexts, restore() { for (const [name, descriptor] of saved) if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } };
}

test('music remains silent until supplied a local file, ducks smoothly and stops cleanly', async () => {
  const env = environment(), music = new GreetingMusic();
  try {
    assert.equal(env.audios.length, 0);
    await music.start({ src: 'blob:http://127.0.0.1:47832/user-file', volume: 0.2 });
    assert.equal(env.audios[0].paused, false); assert.equal(env.audios[0].loop, true);
    assert.equal(env.contexts[0].gain.gain.value, 0.2);
    music.duck(); assert.deepEqual(env.contexts[0].gain.gain.ramps, [[0.06, 10.15]]);
    music.stop(); assert.equal(env.audios[0].paused, true); assert.equal(env.audios[0].src, ''); assert.equal(env.contexts[0].state, 'closed');
    music.stop(); assert.equal(env.contexts[0].closes, 1);
  } finally { music.stop(); env.restore(); }
});
test('no default track or remote media URL can be invented by the music controller', async () => {
  const env = environment(), music = new GreetingMusic();
  try {
    await assert.rejects(music.start({ src: '' }));
    await assert.rejects(music.start({ src: 'https://example.com/music.mp3' }));
    await assert.rejects(music.start({ src: './music.mp3', volume: -1 }));
    assert.equal(env.audios.length, 0);
  } finally { music.stop(); env.restore(); }
});
test('partial audio graph failures release their context and expose only a generic error', async () => {
  const env = environment({ failGraph: true }), errors = [], music = new GreetingMusic({ onError: message => errors.push(message) });
  try {
    await assert.rejects(music.start({ src: 'blob:http://127.0.0.1:47832/user-file' }), /A música não iniciou/);
    assert.equal(env.contexts[0].state, 'closed'); assert.equal(env.audios[0].paused, true); assert.equal(env.audios[0].src, '');
    assert.equal(errors.length, 1); assert.equal(errors[0].includes('private graph detail'), false);
  } finally { music.stop(); env.restore(); }
});
