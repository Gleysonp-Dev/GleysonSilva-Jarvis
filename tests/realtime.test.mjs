import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { readFile } from 'node:fs/promises';
import * as speechEffects from '../apps/desktop/renderer/speech-effects.ts';

// Compile the real controller in memory without enumerating paths outside this project.
const source = await readFile(new URL('../apps/desktop/renderer/realtime.ts', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'ts', format: 'cjs', target: 'node24' });
const compiled = { exports: {} };
new Function('require', 'module', 'exports', code)(name => { if (name === './speech-effects') return speechEffects; throw new Error('Unexpected dependency'); }, compiled, compiled.exports);
const { RealtimeVoice, takeSpeechSegments } = compiled.exports;
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve)); };
const speechResult = input => ({ audioBase64: Buffer.from('fake-mp3').toString('base64'), mime: 'audio/mpeg', runId: input.runId, utteranceId: input.utteranceId });
class Param {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  cancelAndHoldAtTime() {}
  linearRampToValueAtTime(value) { this.value = value; }
}
class AudioNodeDouble {
  constructor(context, type) { this.context = context; this.type = type; this.edges = new Set(); }
  connect(target) { this.edges.add(target); return target; }
  disconnect(target) { if (target) this.edges.delete(target); else this.edges.clear(); }
}
async function setup(t, { speakImpl, callImpl, missingSpeech = false } = {}) {
  const audios = [], contexts = [], peers = [], revoked = [], created = [], microphone = { enabled: true, stops: 0, stop() { this.stops++; } };
  class ContextDouble {
    constructor() { this.currentTime = 0; this.sampleRate = 48000; this.state = 'running'; this.nodes = []; this.destination = this.node('destination'); this.closed = 0; contexts.push(this); }
    node(type, params = []) { const node = new AudioNodeDouble(this, type); for (const name of params) node[name] = new Param(); this.nodes.push(node); return node; }
    createAnalyser() { const node = this.node('analyser'); node.fftSize = 256; node.getByteTimeDomainData = samples => samples.fill(140); return node; }
    createGain() { return this.node('gain', ['gain']); }
    createBiquadFilter() { return this.node('filter', ['frequency', 'Q']); }
    createDelay() { return this.node('delay', ['delayTime']); }
    createDynamicsCompressor() { return this.node('compressor', ['threshold', 'knee', 'ratio', 'attack', 'release']); }
    createOscillator() { const node = this.node('oscillator', ['frequency']); node.starts = 0; node.stops = 0; node.start = () => { node.starts++; }; node.stop = () => { node.stops++; }; return node; }
    createMediaStreamSource(stream) { const node = this.node('microphone-source'); node.stream = stream; return node; }
    createMediaElementSource(audio) { const node = this.node('speech-source'); node.audio = audio; return node; }
    async resume() {}
    async close() { this.closed++; this.state = 'closed'; }
  }
  class AudioDouble {
    constructor(src) { this.src = src; this.plays = 0; this.pauses = 0; audios.push(this); }
    async play() { this.plays++; }
    pause() { this.pauses++; }
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    load() {}
    finish() { this.onended?.(); }
  }
  class PeerDouble {
    constructor() { this.connectionState = 'connected'; this.tracks = []; peers.push(this); }
    addTrack(track) { this.tracks.push(track); }
    createDataChannel() { this.dc = { readyState: 'open', sent: [], send(value) { this.sent.push(JSON.parse(value)); }, close() { this.readyState = 'closed'; this.onclose?.(); } }; return this.dc; }
    async createOffer() { return { sdp: 'v=0\r\n' }; }
    async setLocalDescription() {}
    async setRemoteDescription() { this.dc.onopen?.(); }
    close() { this.closed = true; }
  }
  const original = new Map();
  for (const [name, value] of Object.entries({ AudioContext: ContextDouble, Audio: AudioDouble, RTCPeerConnection: PeerDouble, requestAnimationFrame: () => 1, cancelAnimationFrame: () => {}, navigator: { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [microphone] }) } } })) {
    original.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => { const value = `blob:local-${created.length}`; created.push(value); return value; }; URL.revokeObjectURL = value => revoked.push(value);
  const spoken = [], cancelledSpeech = [], cancelledTools = [], tools = [], callbacks = { states: [], transcripts: [], levels: [], errors: [], ended: 0, endedReasons: [] };
  const bridge = {
    realtimeSession: async () => ({ sdp: 'v=0\r\n' }),
    speak: async input => { spoken.push(input); return speakImpl ? speakImpl(input, spoken.length) : speechResult(input); },
    cancelSpeech: async input => { cancelledSpeech.push(input); },
    cancel: async runId => { cancelledTools.push(runId); },
    callTool: async input => { tools.push(input); return callImpl ? callImpl(input) : { ok: true, status: 'verified', summary: 'Ação verificada.' }; },
  };
  if (missingSpeech) delete bridge.speak;
  const voice = new RealtimeVoice(bridge, { state: value => callbacks.states.push(value), connection() {}, transcript: (...args) => callbacks.transcripts.push(args), levels: value => callbacks.levels.push(value), error: message => callbacks.errors.push(message), ended: reason => { callbacks.ended++; callbacks.endedReasons.push(reason); } });
  t.after(async () => {
    voice.stop(); await tick();
    for (const [name, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  });
  await voice.start('principal', 2);
  const emit = event => peers[0]?.dc.onmessage({ data: JSON.stringify(event) });
  const response = (id = 'response_1') => emit({ type: 'response.created', response: { id } });
  const delta = (text, id = 'response_1') => emit({ type: 'response.output_text.delta', response_id: id, item_id: `item_${id}`, delta: text });
  const done = (status = 'completed', id = 'response_1') => emit({ type: 'response.done', response: { id, status } });
  return { voice, bridge, emit, response, delta, done, audios, contexts, peers, microphone, revoked, created, spoken, cancelledSpeech, cancelledTools, tools, callbacks };
}

test('microphone transport never plays remote OpenAI audio or remote audio transcripts', async t => {
  const x = await setup(t); assert.equal(x.peers[0].tracks[0], x.microphone);
  const remote = { enabled: true, stops: 0, stop() { this.stops++; } }; x.peers[0].ontrack({ track: remote, streams: [] });
  assert.equal(remote.enabled, false); assert.equal(remote.stops, 1);
  x.response(); x.emit({ type: 'output_audio_buffer.started' });
  x.emit({ type: 'response.output_audio_transcript.delta', response_id: 'response_1', delta: 'Outra voz' }); await tick();
  assert.equal(x.audios.length, 0); assert.equal(x.spoken.length, 0); assert.equal(x.callbacks.transcripts.length, 0);
  assert(!x.callbacks.states.includes('speak'));
});

test('normal session expiry releases microphone and reports expired once for an explicit caller-controlled renewal', async t => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  let expiry; const handle = {};
  globalThis.setTimeout = (callback, delay, ...args) => { if (delay === 120000) { expiry = callback; return handle; } return originalSet(callback, delay, ...args); };
  globalThis.clearTimeout = value => { if (value !== handle) originalClear(value); };
  t.after(() => { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; });
  const x = await setup(t); assert.equal(typeof expiry, 'function'); expiry();
  assert.deepEqual(x.callbacks.endedReasons, ['expired']); assert.equal(x.microphone.stops, 1); assert.equal(x.callbacks.errors.length, 0); assert.equal(x.peers.length, 1);
  x.voice.stop(); assert.deepEqual(x.callbacks.endedReasons, ['expired']);
});

test('manual shutdown and connection failure expose non-renewable end reasons and never acquire a second microphone', async t => {
  const x = await setup(t); x.voice.stop(); x.voice.stop();
  assert.deepEqual(x.callbacks.endedReasons, ['stopped']); assert.equal(x.microphone.stops, 1); assert.equal(x.peers.length, 1);
});

test('missing voice configuration reports an error end reason instead of a normal expiry', async t => {
  const x = await setup(t, { missingSpeech: true }); assert.deepEqual(x.callbacks.endedReasons, ['error']); assert.equal(x.peers.length, 0);
});

test('provider authentication or quota errors end with error so continuous mode cannot treat them as renewal', async t => {
  const x = await setup(t); x.emit({ type: 'error', error: { code: 'insufficient_quota', message: 'private provider detail' } }); await tick();
  assert.deepEqual(x.callbacks.endedReasons, ['error']); assert.equal(x.microphone.stops, 1); assert.equal(x.callbacks.errors.length, 1); assert(!x.callbacks.errors[0].includes('private provider detail'));
});

test('ordered sentence streaming prefetches only one clip, preserves .95 pitch and measures processed speech', async t => {
  const x = await setup(t); x.response(); x.delta('Primeira frase. Segunda frase. Terceira sem ponto'); await tick();
  assert.deepEqual(x.spoken.map(call => call.text), ['Primeira frase.', 'Segunda frase.']);
  assert.equal(x.audios.length, 1); assert.equal(x.audios[0].playbackRate, 0.95); assert.equal(x.audios[0].defaultPlaybackRate, 0.95); assert.equal(x.audios[0].preservesPitch, true);
  assert.equal(x.audios[0].plays, 1); x.voice.measure(); assert(x.callbacks.levels.at(-1).speaker > 0);
  const source = x.contexts[0].nodes.find(node => node.type === 'speech-source');
  assert([...source.edges].every(node => node.type !== 'analyser')); // Effect graph sits before output metering.
  x.emit({ type: 'response.output_text.done', response_id: 'response_1', item_id: 'item_response_1', text: 'Primeira frase. Segunda frase. Terceira sem ponto' });
  x.done(); await tick(); assert.equal(x.spoken.length, 2); // Third clip waits for its ordered prefetch slot.
  x.audios[0].finish(); await tick(); assert.equal(x.audios.length, 2); assert.equal(x.audios[1].plays, 1);
  assert.deepEqual(x.spoken.map(call => call.text), ['Primeira frase.', 'Segunda frase.', 'Terceira sem ponto']);
  x.audios[1].finish(); await tick(); assert.equal(x.audios.length, 3); x.audios[2].finish(); await tick();
  assert.equal(new Set(x.spoken.map(call => call.utteranceId)).size, 3); assert.equal(new Set(x.spoken.map(call => call.runId)).size, 1);
  assert(x.spoken.every(call => call.profileId === 'principal')); assert.equal(x.callbacks.states.at(-1), 'listen');
  assert.equal(new Set(x.revoked).size, 3);
});

test('done-only text and cancelled/incomplete tails never trigger speech or tool execution', async t => {
  const x = await setup(t); x.response();
  x.emit({ type: 'response.output_text.done', response_id: 'response_1', text: 'Texto emitido durante cancelamento.' }); x.done('cancelled');
  x.response('response_2'); x.delta('Trecho incompleto sem pontuação', 'response_2'); x.done('incomplete', 'response_2');
  x.response('response_3'); x.emit({ type: 'response.function_call_arguments.done', response_id: 'response_3', call_id: 'call_1', name: 'workspace_list', arguments: '{}' }); x.done('cancelled', 'response_3');
  await tick(); assert.equal(x.spoken.length, 0); assert.equal(x.audios.length, 0); assert.equal(x.tools.length, 0);
});

test('barge-in aborts pending synthesis, ignores late results and permits the next response immediately', async t => {
  let release;
  const x = await setup(t, { speakImpl: (input, count) => count === 1 ? new Promise(resolve => { release = () => resolve(speechResult(input)); }) : speechResult(input) });
  x.response(); x.delta('Resposta antiga. '); await tick(); assert.equal(x.spoken.length, 1);
  x.emit({ type: 'input_audio_buffer.speech_started' }); assert.equal(x.cancelledSpeech[0].runId, x.spoken[0].runId);
  x.response('response_2'); x.delta('Resposta nova. ', 'response_2'); await tick();
  assert.equal(x.spoken.length, 2); assert.equal(x.audios.length, 1);
  release(); x.delta('Nunca deve voltar. '); x.emit({ type: 'response.output_text.done', response_id: 'response_1', text: 'Nunca deve voltar.' }); x.done(); await tick();
  assert.equal(x.audios.length, 1); assert.equal(x.spoken.length, 2);
  assert(x.peers[0].dc.sent.some(event => event.type === 'response.cancel' && event.response_id === 'response_1'));
});

test('interrupting active playback discards prepared speech, stops audio and releases all graphs', async t => {
  const x = await setup(t); x.response(); x.delta('Uma frase. Outra frase. '); await tick();
  assert.equal(x.audios.length, 1); assert.equal(x.spoken.length, 2);
  x.voice.interrupt(); await tick(); assert.equal(x.audios[0].src, ''); assert(x.audios[0].pauses > 0); assert.equal(x.audios.length, 1);
  const oscillators = x.contexts[0].nodes.filter(node => node.type === 'oscillator'); assert(oscillators.every(node => node.stops === 1 && node.edges.size === 0));
  x.voice.stop(); await tick(); assert.equal(x.microphone.stops, 1); assert.equal(x.contexts[0].closed, 1); assert.equal(x.callbacks.ended, 1); assert.equal(x.callbacks.states.at(-1), 'idle');
});

test('complete typed tool calls preserve IDs/JSON, deduplicate events and continue text once after all results', async t => {
  const releases = new Map();
  const x = await setup(t, { callImpl: input => new Promise(resolve => releases.set(input.id, () => resolve({ ok: true, status: 'verified', summary: `Resultado de ${input.id}`, data: { quoted: 'Uma "nota"\nsegura.' } }))) });
  x.response();
  const first = { call_id: 'call_a', name: 'workspace_list', arguments: '{"folder":"arquivos"}' };
  x.emit({ type: 'response.function_call_arguments.done', response_id: 'response_1', ...first });
  x.emit({ type: 'response.output_item.done', response_id: 'response_1', item: { type: 'function_call', ...first } });
  x.emit({ type: 'response.function_call_arguments.done', response_id: 'response_1', call_id: 'call_b', name: 'workspace_list', arguments: '{}' });
  assert.equal(x.tools.length, 0); x.done(); await tick(); assert.equal(x.tools.length, 2);
  assert.equal(x.tools[0].id, 'call_a'); assert.deepEqual(x.tools[0].args, { folder: 'arquivos' }); assert.equal(x.tools[0].runId, x.tools[1].runId);
  releases.get('call_b')(); await tick(); assert.equal(x.peers[0].dc.sent.filter(event => event.type === 'response.create').length, 0);
  releases.get('call_a')(); await tick();
  const outputs = x.peers[0].dc.sent.filter(event => event.type === 'conversation.item.create'); assert.equal(outputs.length, 2);
  assert.equal(JSON.parse(outputs[0].item.output).data.quoted, 'Uma "nota"\nsegura.');
  const continues = x.peers[0].dc.sent.filter(event => event.type === 'response.create'); assert.equal(continues.length, 1); assert.deepEqual(continues[0].response.output_modalities, ['text']);
  assert.equal(x.spoken.length, 0);
});

test('raw JSON/code and unknown response text remain silent; tool arguments are never narrated', async t => {
  const x = await setup(t); x.delta('Fala sem resposta criada. '); x.response();
  x.delta('{"summary":"Primeira frase. '); x.delta('Segunda frase. ","ok":true}'); x.done();
  x.response('response_2'); x.delta('```json\n{"ok":true}. Mais detalhes. ', 'response_2'); x.done('completed', 'response_2');
  await tick(); assert.equal(x.spoken.length, 0);
});

test('TTS failure or mismatched audio IDs cannot play or select a fallback voice', async t => {
  const x = await setup(t, { speakImpl: input => ({ ...speechResult(input), runId: 'other-run' }) });
  x.response(); x.delta('Uma frase. '); await tick(); assert.equal(x.audios.length, 0); assert.equal(x.callbacks.errors.length, 1);
  x.delta('Não tenta outro provedor. '); x.done(); await tick(); assert.equal(x.spoken.length, 1); assert.equal(x.audios.length, 0);
});

test('missing speech bridge fails cleanly without requesting microphone or playing a substitute', async t => {
  const x = await setup(t, { missingSpeech: true }); assert.equal(x.peers.length, 0); assert.equal(x.contexts.length, 0); assert.equal(x.audios.length, 0); assert.equal(x.callbacks.ended, 1); assert.equal(x.callbacks.errors.length, 1);
});

test('provider rejection remains redacted and does not try another voice', async t => {
  const x = await setup(t, { speakImpl: () => { throw new Error('private-provider-key-123'); } });
  x.response(); x.delta('Uma frase completa. Outra frase. '); await tick();
  assert.equal(x.spoken.length, 1); assert.equal(x.audios.length, 0); assert.equal(x.callbacks.errors.length, 1);
  assert.equal(x.callbacks.errors[0].includes('private-provider-key'), false);
});

test('malformed JSON tool arguments cannot trigger a premature continuation before a second tool result', async t => {
  let release;
  const x = await setup(t, { callImpl: () => new Promise(resolve => { release = () => resolve({ ok: true, status: 'verified' }); }) });
  x.response();
  x.emit({ type: 'response.function_call_arguments.done', response_id: 'response_1', call_id: 'bad_json', name: 'workspace_list', arguments: '{broken' });
  x.emit({ type: 'response.function_call_arguments.done', response_id: 'response_1', call_id: 'good_json', name: 'workspace_list', arguments: '{}' });
  x.done(); await tick();
  assert.equal(x.tools.length, 1); assert.equal(x.tools[0].id, 'good_json');
  assert.equal(x.peers[0].dc.sent.filter(event => event.type === 'response.create').length, 0);
  release(); await tick();
  assert.equal(x.peers[0].dc.sent.filter(event => event.type === 'response.create').length, 1);
  assert.equal(x.spoken.length, 0);
});

function beginYouTubeSearch(x, responseId = 'response_search', callId = 'call_search') {
  x.response(responseId);
  x.emit({ type: 'response.function_call_arguments.done', response_id: responseId, call_id: callId, name: 'youtube_search', arguments: '{"query":"música solicitada"}' });
  x.done('completed', responseId);
}
const continuationCount = x => x.peers[0].dc.sent.filter(event => event.type === 'response.create').length;
function captureTranscriptionTimers(t) {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout, timers = [];
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay !== 3000) return originalSet(callback, delay, ...args);
    const timer = { callback, cleared: false }; timers.push(timer); return timer;
  };
  globalThis.clearTimeout = value => { if (timers.includes(value)) value.cleared = true; else originalClear(value); };
  t.after(() => { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; });
  return () => { for (const timer of timers) if (!timer.cleared) { timer.cleared = true; timer.callback(); } };
}

test('unconfirmed VAD silences narration but empty or failed transcription never cancels a YouTube search', async t => {
  for (const transcript of ['empty', 'failed']) await t.test(transcript, async t => {
    let release;
    const x = await setup(t, { callImpl: () => new Promise(resolve => { release = resolve; }) });
    beginYouTubeSearch(x); await tick();
    x.response('response_narration'); x.delta('Estou procurando a música. ', 'response_narration'); await tick();
    assert.equal(x.audios.length, 1);
    x.emit({ type: 'input_audio_buffer.speech_started', item_id: 'input_noise' }); await tick();
    assert.equal(x.audios[0].src, ''); assert.equal(x.cancelledTools.length, 0);
    x.emit({ type: 'input_audio_buffer.speech_stopped', item_id: 'input_noise' });
    release({ ok: true, status: 'verified', data: { results: [{ videoId: 'abcdefghijk' }] } }); await tick();
    assert.equal(x.peers[0].dc.sent.filter(event => event.type === 'conversation.item.create').length, 1);
    assert.equal(continuationCount(x), 0);
    x.emit({ type: `conversation.item.input_audio_transcription.${transcript === 'empty' ? 'completed' : 'failed'}`, item_id: 'input_noise', ...(transcript === 'empty' ? { transcript: '   ' } : { error: { code: 'transcription_failed' } }) });
    assert.equal(x.cancelledTools.length, 0); assert.equal(continuationCount(x), 0);
    x.done('cancelled', 'response_narration'); await tick();
    assert.equal(continuationCount(x), 1); assert.equal(x.callbacks.errors.length, 0);
  });
});

test('missing or uncorrelated transcription releases the bounded gate without cancelling native work', async t => {
  for (const itemId of ['input_missing_transcript', undefined]) await t.test(String(itemId), async t => {
    const expire = captureTranscriptionTimers(t); let release;
    const x = await setup(t, { callImpl: () => new Promise(resolve => { release = resolve; }) });
    beginYouTubeSearch(x); await tick();
    x.emit({ type: 'input_audio_buffer.speech_started', ...(itemId ? { item_id: itemId } : {}) });
    x.emit({ type: 'input_audio_buffer.speech_stopped', ...(itemId ? { item_id: itemId } : {}) });
    x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'unrelated_input', transcript: 'Pare.' });
    release({ ok: true, status: 'verified' }); await tick();
    assert.equal(x.cancelledTools.length, 0); assert.equal(continuationCount(x), 0);
    expire(); await tick(); assert.equal(continuationCount(x), 1); assert.equal(x.cancelledTools.length, 0);
    x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: itemId, transcript: 'Texto atrasado.' });
    assert.equal(x.cancelledTools.length, 0); assert.equal(continuationCount(x), 1);
  });
});

test('a correlated transcript cancels only captured tools even when a newer response and tool already exist', async t => {
  const releases = new Map();
  const x = await setup(t, { callImpl: input => new Promise(resolve => releases.set(input.id, resolve)) });
  beginYouTubeSearch(x); await tick(); const originalRun = x.tools[0].runId;
  x.emit({ type: 'input_audio_buffer.speech_started', item_id: 'input_change' });
  x.emit({ type: 'input_audio_buffer.speech_stopped', item_id: 'input_change' });
  beginYouTubeSearch(x, 'response_new', 'call_new'); await tick(); const newRun = x.tools[1].runId;
  x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'old_input', transcript: 'Transcrição antiga.' });
  assert.deepEqual(x.cancelledTools, []);
  x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'input_change', transcript: 'Cancele a busca anterior.' });
  assert.deepEqual(x.cancelledTools, [originalRun]); assert(!x.cancelledTools.includes(newRun));
  assert.equal(x.peers[0].dc.sent.some(event => event.type === 'response.cancel' && event.response_id === 'response_new'), false);
  releases.get('call_search')({ ok: false, status: 'cancelled' }); await tick(); assert.equal(continuationCount(x), 0);
  releases.get('call_new')({ ok: true, status: 'verified' }); await tick(); assert.equal(continuationCount(x), 1);
  x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'input_change', transcript: 'Duplicada.' });
  assert.deepEqual(x.cancelledTools, [originalRun]);
});

test('a tool completed between VAD and its confirmed transcript cannot continue or cancel a newer active response', async t => {
  let release;
  const x = await setup(t, { callImpl: () => new Promise(resolve => { release = resolve; }) });
  beginYouTubeSearch(x); await tick();
  x.emit({ type: 'input_audio_buffer.speech_started', item_id: 'input_next' });
  release({ ok: true, status: 'verified' }); await tick(); assert.equal(continuationCount(x), 0);
  x.emit({ type: 'input_audio_buffer.speech_stopped', item_id: 'input_next' }); x.response('response_next');
  x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'input_next', transcript: 'Agora outra pergunta.' });
  assert.equal(continuationCount(x), 0); assert.equal(x.cancelledTools.length, 0);
  x.delta('A nova resposta continua. ', 'response_next'); await tick(); assert.equal(x.audios.length, 1);
  x.done('completed', 'response_next'); assert.equal(continuationCount(x), 0);
});

test('confirmed speech cancels the captured search without interrupting narration from a newer active response', async t => {
  let release;
  const x = await setup(t, { callImpl: () => new Promise(resolve => { release = resolve; }) });
  beginYouTubeSearch(x); await tick(); const capturedRun = x.tools[0].runId;
  x.emit({ type: 'input_audio_buffer.speech_started', item_id: 'input_confirmed' });
  x.emit({ type: 'input_audio_buffer.speech_stopped', item_id: 'input_confirmed' });
  x.response('response_new_active'); x.delta('Resposta nova preservada. ', 'response_new_active'); await tick();
  const audio = x.audios[0]; assert(audio.src);
  x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'input_confirmed', transcript: 'Pode cancelar a pesquisa anterior.' });
  assert.deepEqual(x.cancelledTools, [capturedRun]); assert(audio.src);
  assert.equal(x.peers[0].dc.sent.some(event => event.type === 'response.cancel' && event.response_id === 'response_new_active'), false);
  release({ ok: false, status: 'cancelled' }); await tick();
  assert.equal(continuationCount(x), 0); x.done('completed', 'response_new_active'); assert.equal(continuationCount(x), 0);
});

test('a late transcript from a replaced VAD candidate cannot cancel the current search', async t => {
  let release;
  const x = await setup(t, { callImpl: () => new Promise(resolve => { release = resolve; }) });
  beginYouTubeSearch(x); await tick();
  x.emit({ type: 'input_audio_buffer.speech_started', item_id: 'input_old' });
  x.emit({ type: 'input_audio_buffer.speech_stopped', item_id: 'input_old' });
  x.emit({ type: 'input_audio_buffer.speech_started', item_id: 'input_current' });
  x.emit({ type: 'input_audio_buffer.speech_stopped', item_id: 'input_current' });
  x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'input_old', transcript: 'Texto atrasado.' });
  assert.equal(x.cancelledTools.length, 0);
  x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'input_current', transcript: '' });
  release({ ok: true, status: 'verified' }); await tick();
  assert.equal(x.cancelledTools.length, 0); assert.equal(continuationCount(x), 1);
});

test('VAD completion cannot start a continuation while audio input is still arriving', async t => {
  let release;
  const x = await setup(t, { callImpl: () => new Promise(resolve => { release = resolve; }) });
  beginYouTubeSearch(x); await tick();
  x.emit({ type: 'input_audio_buffer.speech_started', item_id: 'input_still_speaking' });
  release({ ok: true, status: 'verified' }); await tick();
  x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'input_still_speaking', transcript: '' });
  assert.equal(continuationCount(x), 0);
  x.emit({ type: 'input_audio_buffer.speech_stopped', item_id: 'input_still_speaking' });
  assert.equal(continuationCount(x), 1);
});

test('explicit interrupt and shutdown still cancel tools immediately without waiting for VAD transcription', async t => {
  for (const action of ['interrupt', 'stop']) await t.test(action, async t => {
    let release;
    const x = await setup(t, { callImpl: () => new Promise(resolve => { release = resolve; }) });
    beginYouTubeSearch(x); await tick(); const runId = x.tools[0].runId;
    x.emit({ type: 'input_audio_buffer.speech_started', item_id: 'input_late' });
    x.voice[action](); assert(x.cancelledTools.includes(runId));
    const cancelled = x.cancelledTools.length;
    x.emit({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'input_late', transcript: 'Texto posterior.' });
    release({ ok: false, status: 'cancelled' }); await tick();
    assert.equal(x.cancelledTools.length, cancelled); assert.equal(continuationCount(x), 0);
  });
});

test('sentence segmentation preserves decimals and bounds unpunctuated text without splitting surrogate pairs', () => {
  assert.deepEqual(takeSpeechSegments('Agora faz 25.5 graus. Próxima'), { segments: ['Agora faz 25.5 graus.'], rest: 'Próxima' });
  assert.deepEqual(takeSpeechSegments('Ainda sem término.'), { segments: [], rest: 'Ainda sem término.' });
  assert.deepEqual(takeSpeechSegments('Ainda sem término.', true), { segments: ['Ainda sem término.'], rest: '' });
  const text = 'a'.repeat(599) + '😀' + 'b'.repeat(610);
  const result = takeSpeechSegments(text, true); assert(result.segments.every(segment => segment.length <= 600 && !/[\uD800-\uDBFF]$/.test(segment)));
  assert.equal(result.segments.join(''), text);
});
