import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRendererModule } from './renderer-module-loader.mjs';
const { DoubleClapDetector } = loadRendererModule('wake-detector.ts');

function timeline({ claps = [], until = 2000, step = 10, background = () => ({ rms: 0.004, peak: 0.012, highFrequencyRatio: 0.12 }) } = {}) {
  const detector = new DoubleClapDetector(), wakes = [];
  for (let atMs = 0; atMs <= until; atMs += step) {
    const feature = claps.includes(atMs) ? { rms: 0.2, peak: 0.95, highFrequencyRatio: 0.64 } : background(atMs);
    if (detector.push({ atMs, ...feature })) wakes.push(atMs);
  }
  return wakes;
}

test('two short broadband claps activate once, with 150..800 ms inclusive spacing', () => {
  assert.equal(timeline({ claps: [100, 250] }).length, 1);
  assert.equal(timeline({ claps: [100, 900] }).length, 1);
  assert.equal(timeline({ claps: [100, 400] }).length, 1);
});
test('one clap, rapid echoes and widely separated impacts do not activate', () => {
  for (const claps of [[100], [100, 180], [100, 1000]]) assert.deepEqual(timeline({ claps }), []);
});
test('cooldown suppresses nearby pairs and permits a second independent activation', () => {
  const wakes = timeline({ claps: [100, 400, 800, 1100, 8600, 8900], until: 9200 });
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
  quiet(0); clap(100); quiet(120);
  assert.equal(clap(600), false); assert.equal(quiet(620), false);
  detector.reset(); quiet(0); clap(100); quiet(120);
  detector.push({ atMs: 130, rms: NaN, peak: 0.2, highFrequencyRatio: 0.5 });
  quiet(200); clap(400); assert.equal(quiet(420), false);
  detector.reset(); quiet(500); clap(600); detector.reset(); quiet(620); clap(900); assert.equal(quiet(920), false);
});
