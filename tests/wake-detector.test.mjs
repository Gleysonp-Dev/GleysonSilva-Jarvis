import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRendererModule } from './renderer-module-loader.mjs';
const { DoubleClapDetector } = loadRendererModule('wake-detector.ts');

function timeline({ claps = [], until = 2500, step = 10, clap = { rms: 0.2, peak: 0.95, highFrequencyRatio: 0.64 }, background = () => ({ rms: 0.004, peak: 0.012, highFrequencyRatio: 0.12 }) } = {}) {
  const detector = new DoubleClapDetector(), wakes = [];
  for (let atMs = 0; atMs <= until; atMs += step) {
    const feature = claps.includes(atMs) ? clap : background(atMs);
    if (detector.push({ atMs, ...feature })) wakes.push(atMs);
  }
  return wakes;
}

test('two short broadband claps activate once, with 150..800 ms inclusive spacing', () => {
  assert.equal(timeline({ claps: [1000, 1150] }).length, 1);
  assert.equal(timeline({ claps: [1000, 1800] }).length, 1);
  assert.equal(timeline({ claps: [1000, 1300] }).length, 1);
});
test('one clap, rapid echoes and widely separated impacts do not activate', () => {
  for (const claps of [[1000], [1000, 1080], [1000, 1900]]) assert.deepEqual(timeline({ claps }), []);
});
test('cooldown suppresses nearby pairs and permits a second independent activation', () => {
  const wakes = timeline({ claps: [1000, 1300, 1700, 2000, 9800, 10100], until: 10500 });
  assert.equal(wakes.length, 2); assert.ok(wakes[1] - wakes[0] >= 8000);
});
test('ordinary voiced envelopes and sustained broadband speech/noise do not activate', () => {
  assert.deepEqual(timeline({ until: 7000, background: at => { const rms = 0.035 + (0.5 + 0.5 * Math.sin(at / 90)) * 0.04; return { rms, peak: Math.min(1, rms * 3), highFrequencyRatio: 0.16 }; } }), []);
  assert.deepEqual(timeline({ until: 5000, background: at => at % 1800 < 1200 ? { rms: 0.12, peak: 0.8, highFrequencyRatio: 0.8 } : { rms: 0.004, peak: 0.01, highFrequencyRatio: 0.1 } }), []);
});
test('adaptive room noise rejects modest fluctuations but preserves strong isolated claps', () => {
  const background = at => { const rms = 0.03 + 0.004 * Math.sin(at / 40); return { rms, peak: rms * 2.7, highFrequencyRatio: 0.4 }; };
  assert.deepEqual(timeline({ until: 6000, background }), []);
  assert.equal(timeline({ claps: [4000, 4400], until: 5000, background }).length, 1);
});
test('missing frames, malformed samples and reset cannot complete a stale pair', () => {
  const detector = new DoubleClapDetector();
  const quiet = atMs => detector.push({ atMs, rms: 0.004, peak: 0.01, highFrequencyRatio: 0.1 });
  const clap = atMs => detector.push({ atMs, rms: 0.2, peak: 0.9, highFrequencyRatio: 0.65 });
  const settle = start => { for (let at = start; at <= start + 900; at += 20) quiet(at); };
  settle(0); clap(1000); quiet(1020);
  assert.equal(clap(1500), false); assert.equal(quiet(1520), false);
  detector.reset(); settle(0); clap(1000); quiet(1020);
  detector.push({ atMs: 1030, rms: NaN, peak: 0.2, highFrequencyRatio: 0.5 });
  quiet(1100); clap(1300); assert.equal(quiet(1320), false);
  detector.reset(); settle(0); clap(1000); quiet(1020); detector.reset(); settle(1100); clap(2100); assert.equal(quiet(2120), false);
});

test('opening microphone transients are ignored and cannot contribute half of a later pair', () => {
  assert.deepEqual(timeline({ claps: [100, 400] }), []);
  assert.deepEqual(timeline({ claps: [700, 950] }), []);
  assert.equal(timeline({ claps: [100, 400, 1100, 1400] }).length, 1);
});

test('weak typing-like impacts and low-energy sharp spikes do not trigger even in pairs', () => {
  const impacts = [1000, 1160, 1480, 1700, 2100, 2260];
  for (const clap of [
    { rms: 0.025, peak: 0.14, highFrequencyRatio: 0.8 },
    { rms: 0.035, peak: 0.21, highFrequencyRatio: 0.7 },
    { rms: 0.038, peak: 0.65, highFrequencyRatio: 0.8 },
    { rms: 0.07, peak: 0.21, highFrequencyRatio: 0.6 },
  ]) assert.deepEqual(timeline({ claps: impacts, clap }), []);
});

test('clear broadband claps still activate across different strong envelopes after settling', () => {
  for (const clap of [
    { rms: 0.08, peak: 0.4, highFrequencyRatio: 0.52 },
    { rms: 0.12, peak: 0.7, highFrequencyRatio: 0.7 },
    { rms: 0.2, peak: 0.95, highFrequencyRatio: 0.64 },
  ]) assert.equal(timeline({ claps: [1100, 1400], clap }).length, 1);
});
