import test from 'node:test';
import assert from 'node:assert/strict';
import { ReceptionObservation } from '../packages/reception/index.mjs';

const imageDataUrl = 'data:image/jpeg;base64,/9j/2Q==';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(options = {}) {
  const settings = { profileId: 'default', receptionOutfitEnabled: true }; const calls = []; let at = Date.now();
  const service = new ReceptionObservation({ getSettings: () => settings, now: () => at,
    describe: async (input, config) => { calls.push({ input, ...config }); return options.describe ? options.describe(input, config) : { text: 'Sua camisa azul ficou elegante, senhor.', observedAt: at }; } });
  return { service, settings, calls, advance: ms => { at += ms; } };
}

test('outfit observation requires explicit setting and exact bounded input before contacting provider', async () => {
  const f = fixture(); f.settings.receptionOutfitEnabled = false;
  await assert.rejects(f.service.observe({ imageDataUrl }), /Ative/); assert.equal(f.calls.length, 0);
  f.settings.receptionOutfitEnabled = true;
  for (const input of [{ imageDataUrl, profileId: 'other' }, { imageDataUrl: 'https://example.com/picture.jpg' }, { imageDataUrl: 'data:image/png;base64,abc' }, { imageDataUrl: 'x'.repeat(700001) }, null]) await assert.rejects(f.service.observe(input));
  assert.equal(f.calls.length, 0);
});

test('one enabled observation returns only description and time without exposing or persisting image', async () => {
  const f = fixture(); const result = await f.service.observe({ imageDataUrl });
  assert.equal(result.text, 'Sua camisa azul ficou elegante, senhor.'); assert.ok(Number.isFinite(result.observedAt));
  assert.equal(JSON.stringify(result).includes(imageDataUrl), false); assert.equal(f.calls[0].input.imageDataUrl, imageDataUrl); assert.equal(f.calls[0].signal.aborted, false);
});

test('capture has one flight per profile, one per minute and six per hour, unaffected by reset', async () => {
  const d = deferred(), f = fixture({ describe: () => d.promise }); const pending = f.service.observe({ imageDataUrl });
  await assert.rejects(f.service.observe({ imageDataUrl }), /já está/); d.resolve({ text: 'Azul.', observedAt: Date.now() }); await pending;
  await assert.rejects(f.service.observe({ imageDataUrl }), /minuto/); f.service.reset();
  await assert.rejects(f.service.observe({ imageDataUrl }), /minuto/);
  for (let i = 0; i < 5; i++) { f.advance(60001); await f.service.observe({ imageDataUrl }); }
  f.advance(60001); await assert.rejects(f.service.observe({ imageDataUrl }), /seis/);
  assert.equal(f.calls.length, 6);
});

test('cancellation aborts promptly and ignores a provider that resolves later', async () => {
  const d = deferred(), f = fixture({ describe: () => d.promise }); const pending = f.service.observe({ imageDataUrl }); await flush();
  assert.deepEqual(f.service.cancel(), { cancelled: true }); assert.equal(f.calls[0].signal.aborted, true);
  await assert.rejects(pending, /interrompida/); d.resolve({ text: 'Late', observedAt: Date.now() }); await flush();
  assert.deepEqual(f.service.cancel(), { cancelled: false });
});

test('settings reset, profile change and revoked option cannot deliver old image descriptions', async () => {
  for (const change of [f => f.service.reset(), f => { f.settings.profileId = 'guest'; }, f => { f.settings.receptionOutfitEnabled = false; }]) {
    const d = deferred(), f = fixture({ describe: () => d.promise }); const pending = f.service.observe({ imageDataUrl }); await flush();
    change(f); d.resolve({ text: 'Old profile', observedAt: Date.now() }); await assert.rejects(pending, /interrompida/);
  }
});

test('invalid provider output cannot become an outfit compliment', async () => {
  for (const value of [{}, { text: '', observedAt: Date.now() }, { text: 'x'.repeat(1201), observedAt: Date.now() }, { text: 'Test', observedAt: NaN }]) {
    const f = fixture({ describe: () => value }); await assert.rejects(f.service.observe({ imageDataUrl }), /observar/);
  }
});
