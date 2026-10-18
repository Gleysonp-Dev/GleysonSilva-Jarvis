import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechEffects, DEFAULT_SPEECH_EFFECT_AMOUNT } from '../apps/desktop/renderer/speech-effects.ts';

class Param {
  constructor(value = 0) { this.value = value; this.calls = []; }
  setValueAtTime(value, time) { this.value = value; this.calls.push(['set', value, time]); }
  cancelAndHoldAtTime(time) { this.calls.push(['hold', time]); }
  cancelScheduledValues(time) { this.calls.push(['cancel', time]); }
  linearRampToValueAtTime(value, time) { this.value = value; this.calls.push(['ramp', value, time]); }
}
class Node {
  constructor(context, kind) { this.context = context; this.kind = kind; this.edges = new Set(); this.disconnects = []; }
  connect(target) { if (this.context.failConnect === this.kind) throw new Error('connect failed'); this.edges.add(target); return target; }
  disconnect(target) {
    this.disconnects.push(target || 'all');
    if (target) this.edges.delete(target); else this.edges.clear();
  }
}
class Context {
  constructor() { this.currentTime = 2; this.sampleRate = 48000; this.state = 'running'; this.nodes = []; this.closeCalls = 0; }
  node(kind, params = []) {
    const node = new Node(this, kind);
    for (const key of params) node[key] = new Param(key === 'gain' ? 1 : 0);
    this.nodes.push(node); return node;
  }
  createGain() { return this.node('gain', ['gain']); }
  createBiquadFilter() { return this.node('filter', ['frequency', 'Q']); }
  createDelay(maxDelay) { const node = this.node('delay', ['delayTime']); node.maxDelay = maxDelay; return node; }
  createDynamicsCompressor() { return this.node('compressor', ['threshold', 'knee', 'ratio', 'attack', 'release']); }
  createOscillator() {
    const node = this.node('oscillator', ['frequency']); node.starts = 0; node.stops = 0;
    node.start = () => { node.starts++; if (this.failStart && node.starts) throw new Error('start failed'); };
    node.stop = () => { node.stops++; }; return node;
  }
  close() { this.closeCalls++; }
}
function setup(amount = 0.2, context = new Context()) {
  const input = context.node('source'), output = context.node('output');
  const unrelated = context.node('unrelated'); input.connect(unrelated);
  const effect = createSpeechEffects({ context, input, output, amount });
  const gains = context.nodes.filter(node => node.kind === 'gain');
  return { context, input, output, unrelated, effect, dry: gains[0], wet: gains[1], gains };
}

test('amount 0 routes an untouched dry signal, with no compressor or filter on that path', () => {
  const { context, input, output, dry, wet, effect } = setup(0);
  assert.equal(dry.gain.value, 1); assert.equal(wet.gain.value, 0);
  assert.deepEqual([...dry.edges], [output]);
  assert(input.edges.has(dry));
  assert.equal(context.nodes.filter(node => node.kind === 'filter').length, 2);
  assert(!dry.edges.has(context.nodes.find(node => node.kind === 'compressor')));
  effect.dispose();
});

test('fixed cinematic preset keeps 68.8% dry voice, caps the wet mix and avoids wet amplification', () => {
  assert.equal(DEFAULT_SPEECH_EFFECT_AMOUNT, 0.78);
  const context = new Context(), input = context.node('source'), output = context.node('output');
  const effect = createSpeechEffects({ context, input, output });
  assert.equal(effect.getAmount(), 0.78);
  const gains = context.nodes.filter(node => node.kind === 'gain');
  assert(Math.abs(gains[0].gain.value - 0.688) < Number.EPSILON);
  assert(Math.abs(gains[1].gain.value - 0.312) < Number.EPSILON);
  assert(Math.abs(gains[5].gain.value - 0.312) < Number.EPSILON);
  for (const amount of [0, 0.2, 0.5, 1]) {
    effect.setAmount(amount);
    assert.equal(gains[1].gain.value, 0.4 * amount);
    assert.equal(gains[0].gain.value + gains[1].gain.value, 1);
    const [, , body, reflection, metallic, pulseDepth, driftDepth] = gains;
    assert.equal(body.gain.value + reflection.gain.value, 1);
    assert.equal(metallic.gain.value + pulseDepth.gain.value, 1);
    assert(metallic.gain.value - pulseDepth.gain.value >= 0.2 - Number.EPSILON);
    assert(driftDepth.gain.value <= 0.00065);
  }
  const delay = context.nodes.find(node => node.kind === 'delay');
  assert(delay.delayTime.value - 0.00065 > 0);
  assert(delay.delayTime.value + 0.00065 < delay.maxDelay);
  assert.equal(delay.edges.size, 1); // No feedback loop.
  effect.dispose();
});

test('intensity changes hold current values then ramp, including return to an exact bypass', () => {
  const { context, dry, wet, effect } = setup(0.2);
  context.currentTime = 9; effect.setAmount(1);
  assert.deepEqual(dry.gain.calls.slice(-2), [['hold', 9], ['ramp', 0.6, 9.03]]);
  assert.deepEqual(wet.gain.calls.slice(-2), [['hold', 9], ['ramp', 0.4, 9.03]]);
  context.currentTime = 10; effect.setAmount(0);
  assert.equal(dry.gain.value, 1); assert.equal(wet.gain.value, 0);
  const count = wet.gain.calls.length; effect.setAmount(0);
  assert.equal(wet.gain.calls.length, count);
  effect.dispose();
});

test('automation fallback preserves a held value when cancelAndHoldAtTime is unavailable', () => {
  const { context, dry, effect } = setup(0.2);
  dry.gain.cancelAndHoldAtTime = undefined;
  const held = dry.gain.value; context.currentTime = 5; effect.setAmount(0.5);
  assert.deepEqual(dry.gain.calls.slice(-3), [['cancel', 5], ['set', held, 5], ['ramp', 0.8, 5.03]]);
  effect.dispose();
});

test('invalid strengths do not allocate a graph or change an existing one', () => {
  for (const amount of [-1, 1.001, NaN, Infinity, '0.2', null]) {
    const context = new Context(), input = context.node('source'), output = context.node('output');
    assert.throws(() => createSpeechEffects({ context, input, output, amount }), RangeError);
    assert.equal(context.nodes.length, 2);
  }
  const { effect, wet } = setup(0.2); const count = wet.gain.calls.length;
  assert.throws(() => effect.setAmount(NaN), RangeError);
  assert.equal(effect.getAmount(), 0.2); assert.equal(wet.gain.calls.length, count);
  effect.dispose();
});

test('cleanup is idempotent, stops both oscillators and preserves unrelated caller edges/context', () => {
  const { context, input, output, unrelated, effect } = setup();
  const callerRoute = context.node('callerRoute'); output.connect(callerRoute);
  effect.dispose(); effect.dispose();
  assert.deepEqual([...input.edges], [unrelated]);
  assert.deepEqual([...output.edges], [callerRoute]);
  assert.equal(context.closeCalls, 0);
  const oscillators = context.nodes.filter(node => node.kind === 'oscillator');
  assert.equal(oscillators.length, 2);
  assert(oscillators.every(node => node.starts === 1 && node.stops === 1 && node.edges.size === 0));
  assert(context.nodes.filter(node => !['source', 'output', 'unrelated', 'callerRoute'].includes(node.kind)).every(node => node.edges.size === 0));
  assert(input.disconnects.every(target => target !== 'all'));
  assert.throws(() => effect.setAmount(0.5), /encerrado/);
});

test('initialization failure removes partial routes and oscillators without touching caller connections', () => {
  for (const failure of ['connect', 'start']) {
    const context = new Context(), input = context.node('source'), output = context.node('output'), other = context.node('other');
    input.connect(other);
    if (failure === 'connect') context.failConnect = 'source'; else context.failStart = true;
    assert.throws(() => createSpeechEffects({ context, input, output }), new RegExp(`${failure} failed`));
    assert.deepEqual([...input.edges], [other]);
    assert.equal(context.closeCalls, 0);
    assert(context.nodes.filter(node => node.kind === 'oscillator').every(node => node.stops === 1 && !node.edges.size));
    assert(context.nodes.filter(node => !['source', 'output', 'other'].includes(node.kind)).every(node => !node.edges.size));
  }
});

test('closed contexts, mismatched contexts and self-feedback are rejected before allocation', () => {
  const context = new Context(), input = context.node('source'), output = context.node('output');
  const other = new Context();
  assert.throws(() => createSpeechEffects({ context, input, output: other.node('output') }), /mesmo contexto/);
  assert.throws(() => createSpeechEffects({ context, input, output: input }), /diferentes/);
  context.state = 'closed';
  assert.throws(() => createSpeechEffects({ context, input, output }), /encerrado/);
  assert.equal(context.nodes.length, 2);
});
