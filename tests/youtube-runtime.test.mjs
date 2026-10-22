import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { createRuntime, toolDefinitions } from '../packages/runtime/index.mjs';
import { OpenAIService } from '../packages/openai/index.mjs';

const VIDEO = 'AbCdEf123_-', OTHER = 'ZyXwVu987_-';
const videoUrl = id => `https://www.youtube.com/watch?v=${id}`;
const searchUrl = query => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
const searched = (query, results = [{ videoId: VIDEO, title: 'Uma música', channel: 'Canal observado' }]) => ({ verified: true, query, url: searchUrl(query), results });
const played = (playing = true, extra = {}) => ({ verified: true, videoId: VIDEO, url: videoUrl(VIDEO), title: 'Uma música', playing, currentTime: 1.25, ...extra });
const request = (name, args, extra = {}) => ({ id: crypto.randomUUID(), name, args, ...extra });
const tick = () => new Promise(resolve => setImmediate(resolve));
async function fixture(t, platformAdapters) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-youtube-'));
  const workspaceRoot = path.join(directory, 'workspace'); await fs.mkdir(workspaceRoot);
  const events = []; const runtime = createRuntime({ dataDir: path.join(directory, 'private'), workspaceRoot, platformAdapters, onEvent: event => events.push(event) });
  t.after(async () => { await runtime.close(); await fs.rm(directory, { recursive: true, force: true }); });
  return { runtime, events };
}

test('YouTube schemas are closed and invalid queries, IDs, controls or extra actions never reach adapters', async t => {
  let called = 0; const adapter = async () => { called++; };
  const f = await fixture(t, { searchYouTube: adapter, playYouTube: adapter, controlYouTube: adapter });
  for (const name of ['youtube_search', 'youtube_play', 'youtube_control']) {
    const definition = toolDefinitions.find(tool => tool.name === name); assert(definition);
    assert.equal(definition.strict, true); assert.equal(definition.parameters.additionalProperties, false);
    assert.deepEqual(definition.parameters.required, Object.keys(definition.parameters.properties));
  }
  for (const [name, args] of [
    ['youtube_search', { query: '' }], ['youtube_search', { query: '   ' }], ['youtube_search', { query: 'x'.repeat(301) }], ['youtube_search', { query: 'a\nb' }], ['youtube_search', { query: 'a\tb' }], ['youtube_search', { query: 'a\0b' }], ['youtube_search', { query: 'x', click: true }],
    ['youtube_play', { videoId: 'https://youtube.com/watch?v=test' }], ['youtube_play', { videoId: 'too-short' }], ['youtube_play', { videoId: 'abcdefghij;' }], ['youtube_play', { videoId: VIDEO, url: videoUrl(VIDEO) }],
    ['youtube_control', { action: 'next' }], ['youtube_control', { action: 'pause', selector: '#anything' }], ['youtube_control', { action: 'login' }],
  ]) assert.equal((await f.runtime.call(request(name, args))).status, 'failed');
  assert.equal(called, 0); assert.equal(f.events.length, 0);
});

test('requested YouTube search runs without extra approval and returns bounded observed metadata as untrusted data', async t => {
  const calls = [];
  const f = await fixture(t, { searchYouTube: async (query, options) => { calls.push({ query, ...options }); return searched(query, [
    { videoId: VIDEO, title: '  Música\nobservada  ', channel: 'Canal\u0000real', url: 'javascript:alert(1)' },
    { videoId: VIDEO, title: 'Duplicate', channel: 'Duplicate' }, { videoId: 12345678901, title: 'Not a string ID' }, { videoId: 'fake', title: 'Invalid' }, { videoId: OTHER, title: '  ' },
    ...Array.from({ length: 15 }, (_, i) => ({ videoId: `videoid${String(i).padStart(4, '0')}`, title: `Result ${i}`, channel: 'c'.repeat(300) })),
  ]); } });
  const result = await f.runtime.call(request('youtube_search', { query: '  AC/DC    Faixa de Teste  ' }, { profileId: 'owner' }));
  assert.equal(result.status, 'verified'); assert.equal(result.data.query, 'AC/DC Faixa de Teste'); assert.equal(result.data.untrusted, true); assert.equal(result.data.results.length, 8);
  assert.deepEqual(result.data.results[0], { videoId: VIDEO, title: 'Músicaobservada', channel: 'Canalreal', url: videoUrl(VIDEO) });
  assert.equal(result.data.results[1].channel.length, 200); assert.equal(calls[0].profileId, 'owner'); assert(calls[0].signal instanceof AbortSignal);
  assert.equal(f.events.some(event => event.type === 'approval' || event.state === 'awaiting_approval'), false);
  assert.equal(f.events.filter(event => event.type === 'action').length, 1);
});

test('an actual empty search stays honest and unverified, mismatched or off-site searches cannot claim success', async t => {
  let output; const f = await fixture(t, { searchYouTube: async () => output });
  output = searched('nothing', []); const empty = await f.runtime.call(request('youtube_search', { query: 'nothing' }));
  assert.equal(empty.status, 'verified'); assert.deepEqual(empty.data.results, []); assert.match(empty.summary, /nenhum vídeo/);
  for (const value of [searched('different'), { ...searched('wanted'), verified: false }, { ...searched('wanted'), results: null }, { ...searched('wanted'), url: 'https://example.com/results?search_query=wanted' }, { ...searched('wanted'), url: 'https://consent.youtube.com/results?search_query=wanted' }, { ...searched('wanted'), url: searchUrl('other') }]) {
    output = value; assert.equal((await f.runtime.call(request('youtube_search', { query: 'wanted' }))).status, 'failed');
  }
});

test('play only succeeds when the native profile registry accepts an observed ID and player evidence matches', async t => {
  const observed = new Map(), effects = [], contexts = [];
  const f = await fixture(t, {
    searchYouTube: async (query, { profileId }) => { observed.set(profileId, new Set([VIDEO])); return searched(query); },
    playYouTube: async (videoId, options) => { contexts.push(options); if (!observed.get(options.profileId)?.has(videoId)) throw new Error('Vídeo não observado neste perfil.'); effects.push(videoId); return played(true); },
  });
  assert.equal((await f.runtime.call(request('youtube_play', { videoId: VIDEO }))).status, 'failed');
  await f.runtime.call(request('youtube_search', { query: 'Uma música' }));
  assert.equal((await f.runtime.call(request('youtube_play', { videoId: VIDEO }, { profileId: 'guest' }))).status, 'failed');
  assert.equal((await f.runtime.call(request('youtube_play', { videoId: OTHER }))).status, 'failed');
  const result = await f.runtime.call(request('youtube_play', { videoId: VIDEO }));
  assert.equal(result.status, 'verified'); assert.equal(result.data.playing, true); assert.equal(result.data.videoId, VIDEO); assert.deepEqual(effects, [VIDEO]);
  assert(contexts.at(-1).signal instanceof AbortSignal); assert.equal(contexts.at(-1).profileId, 'default');
  assert.equal(f.events.some(event => event.type === 'approval'), false);
});

test('play and pause require matching observed player state instead of trusting a navigation acknowledgement', async t => {
  let output; const f = await fixture(t, { playYouTube: async () => output, controlYouTube: async () => output });
  for (const value of [played(true, { verified: false }), { dispatched: true }, played(false), played(true, { currentTime: -1 }), played(true, { currentTime: '5' }), played(true, { currentTime: Infinity }), played(true, { videoId: OTHER }), played(true, { url: videoUrl(OTHER) }), played(true, { url: `https://example.com/watch?v=${VIDEO}` })]) {
    output = value; assert.equal((await f.runtime.call(request('youtube_play', { videoId: VIDEO }))).status, 'failed');
  }
  output = played(false); assert.equal((await f.runtime.call(request('youtube_control', { action: 'pause' }))).status, 'verified');
  assert.equal((await f.runtime.call(request('youtube_control', { action: 'play' }))).status, 'failed');
  output = played(true); assert.equal((await f.runtime.call(request('youtube_control', { action: 'play' }))).status, 'verified');
  assert.equal((await f.runtime.call(request('youtube_control', { action: 'pause' }))).status, 'failed');
});

test('YouTube calls preserve immutable inputs, duplicate replay and cancellation before queued actions', async t => {
  let finishSearch; const calls = [];
  const f = await fixture(t, { searchYouTube: query => new Promise(resolve => { calls.push(query); finishSearch = () => resolve(searched(query)); }), playYouTube: async id => { calls.push(id); return played(); } });
  const input = request('youtube_search', { query: 'requested' }); const first = f.runtime.call(input), duplicate = f.runtime.call(input);
  assert.equal(first, duplicate); input.args.query = 'mutated';
  for (let i = 0; i < 100 && !finishSearch; i++) await tick(); assert.equal(typeof finishSearch, 'function');
  const queued = f.runtime.call(request('youtube_play', { videoId: VIDEO }, { runId: 'queued-youtube' })); f.runtime.cancel('queued-youtube');
  finishSearch(); const result = await first; assert.equal(result.status, 'verified'); assert.equal((await queued).status, 'cancelled');
  assert.deepEqual(calls, ['requested']); assert.deepEqual(await f.runtime.call({ ...input, args: { query: 'requested' } }), result); assert.deepEqual(calls, ['requested']);
  assert.equal((await f.runtime.call(input)).status, 'failed');
});

test('late search and player answers after interruption emit no completed action or usable result', async t => {
  for (const [name, args, result] of [['youtube_search', { query: 'late' }, searched('late')], ['youtube_play', { videoId: VIDEO }, played()], ['youtube_control', { action: 'pause' }, played(false)]]) {
    let finish; const method = { youtube_search: 'searchYouTube', youtube_play: 'playYouTube', youtube_control: 'controlYouTube' }[name];
    const f = await fixture(t, { [method]: () => new Promise(resolve => { finish = resolve; }) });
    const controller = new AbortController(), pending = f.runtime.call(request(name, args), { signal: controller.signal });
    for (let i = 0; i < 100 && !finish; i++) await tick(); assert.equal(typeof finish, 'function');
    controller.abort(); finish(result); const stopped = await pending;
    assert.equal(stopped.status, 'cancelled'); assert.equal(stopped.data, undefined); assert.equal(f.events.some(event => event.type === 'action'), false);
  }
});

function response(output) {
  return new Response(`event: response.completed\ndata: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output } })}\n\n`, { headers: { 'content-type': 'text/event-stream' } });
}
const toolCall = (id, name, args) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) });

test('text and realtime expose the same YouTube actions and continue from observed search IDs to verified playback', async t => {
  const calls = [], requests = []; const observed = new Set();
  const f = await fixture(t, {
    searchYouTube: async query => { calls.push(['search', query]); observed.add(VIDEO); return searched(query); },
    playYouTube: async videoId => { assert(observed.has(videoId)); calls.push(['play', videoId]); return played(); },
    controlYouTube: async action => { calls.push(['control', action]); return played(action === 'play'); },
  });
  const pending = [response([toolCall('yt-search', 'youtube_search', { query: 'AC/DC Faixa de Teste' })]), response([toolCall('yt-play', 'youtube_play', { videoId: VIDEO })]), response([{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Reproduzindo, senhor.' }] }])];
  const service = new OpenAIService({ getKey: () => 'mock-not-a-real-key', getSettings: () => ({}), runtime: f.runtime,
    fetch: async (_url, init) => { requests.push(JSON.parse(init.body)); assert(pending.length); return pending.shift(); } });
  assert.equal((await service.respond({ text: 'Jarvis toque AC/DC Faixa de Teste', runId: 'youtube-text' })).text, 'Reproduzindo, senhor.');
  assert.equal((await service.executeRealtimeTool({ id: 'yt-pause', name: 'youtube_control', args: { action: 'pause' }, runId: 'youtube-voice' })).status, 'verified');
  assert.deepEqual(calls, [['search', 'AC/DC Faixa de Teste'], ['play', VIDEO], ['control', 'pause']]);
  const tools = requests[0].tools.filter(tool => tool.name.startsWith('youtube_')); assert.equal(tools.length, 3); assert(tools.every(tool => tool.strict));
  const found = JSON.parse(requests[1].input.at(-1).output); assert.equal(found.data.results[0].videoId, VIDEO);
  const playback = JSON.parse(requests[2].input.at(-1).output); assert.equal(playback.data.playing, true);
  assert.equal(f.events.some(event => event.type === 'approval'), false);
});
