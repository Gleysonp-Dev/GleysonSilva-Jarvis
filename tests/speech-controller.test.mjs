import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechController } from '../packages/speech/controller.mjs';
const request = { text: 'Uma resposta curta.', profileId: 'primary', runId: 'voice-1', utteranceId: 'part-1' };
test('speech reuses an identical utterance and rejects a changed payload or another profile', async () => {
 let calls = 0;
 const control = new SpeechController({ service: { async prepare(value) { calls++; return { runId: value.runId, utteranceId: value.utteranceId, audioBase64: 'eA==', mime: 'audio/mpeg' }; } }, getProfile: () => 'primary' });
 const first = await control.speak(request); assert.deepEqual(await control.speak(request), first); assert.equal(calls, 1);
 await assert.rejects(control.speak({ ...request, text: 'Outro texto.' }), /utilizado/);
 await assert.rejects(control.speak({ ...request, profileId: 'other' }), /sessão/);
});
test('interrupt aborts generation and never accepts a delayed result or another queued chunk for that run', async () => {
 let release, signal;
 const control = new SpeechController({ service: { prepare(_value, options) { signal = options.signal; return new Promise(resolve => { release = resolve; }); } }, getProfile: () => 'primary' });
 const promise = control.speak(request); await Promise.resolve(); control.cancel({ runId: request.runId }); assert.equal(signal.aborted, true);
 release({ runId: request.runId, audioBase64: 'eA==' }); await assert.rejects(promise, /interrompida/);
 await assert.rejects(control.speak({ ...request, utteranceId: 'part-2' }), /interrompida/);
});
test('profile/settings reset discards in-flight results and preserves the generation budget', async () => {
 let release, profile = 'primary';
 const control = new SpeechController({ service: { prepare() { return new Promise(resolve => { release = resolve; }); } }, getProfile: () => profile });
 const promise = control.speak(request); await Promise.resolve(); control.reset(); profile = 'other'; release({ runId: request.runId }); await assert.rejects(promise, /interrompida/);
});
test('speech rate limit stops further synthesis before calling the provider', async () => {
 let calls = 0;
 const control = new SpeechController({ service: { async prepare(value) { calls++; return { runId: value.runId }; } }, getProfile: () => 'primary', now: () => 1000 });
 for (let index=0; index<30; index++) await control.speak({ ...request, utteranceId: `part-${index}` });
 await assert.rejects(control.speak({ ...request, utteranceId: 'part-31' }), /Limite/); assert.equal(calls, 30);
});
