import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIService, OpenAIServiceError, DEFAULT_MODELS, JARVIS_INSTRUCTIONS } from '../packages/openai/index.mjs';

const KEY = 'mock-secret-openai-search-key';
const search = { type: 'web_search_call', status: 'completed', id: 'search_1', action: { type: 'search', query: 'Consulta' } };
const annotation = (url = 'https://example.com/article', title = 'Fonte consultada') => ({ type: 'url_citation', url, title, start_index: 0, end_index: 10 });
const message = (text = 'Resumo atual da pesquisa.', annotations = [annotation()]) => ({ type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text, annotations }] });
const completed = (...output) => ({ status: 'completed', output: output.length ? output : [search, message()] });
const jsonResponse = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup({ fetch, getKey = () => KEY, getSettings = () => ({}), runtime, ...options } = {}) {
  const requests = [];
  const service = new OpenAIService({ getKey, getSettings, runtime,
    fetch: async (url, init) => { requests.push({ url, init, json: JSON.parse(init.body) }); return fetch ? fetch(url, init) : jsonResponse(completed()); }, ...options });
  return { service, requests };
}

test('search forces hosted live web search using the configured text model without private memory/history', async () => {
  const privateMemory = 'PRIVATE_LOCAL_MEMORY_DO_NOT_SEND';
  const { service, requests } = setup({ getSettings: () => ({ textModel: 'gpt-5.4-mini', realtimeModel: 'gpt-realtime', voice: 'unchanged' }),
    runtime: { getSnapshot() { throw new Error(privateMemory); }, getPlanContext() { throw new Error(privateMemory); }, toolDefinitions: [{ type: 'function', name: 'never_local_action' }], call() { throw new Error('Local execution forbidden'); } } });
  const before = Date.now(); const result = await service.searchWeb({ query: '  Notícias atuais de tecnologia  ' }); const after = Date.now();
  assert.deepEqual({ ...result, retrievedAt: 0 }, { query: 'Notícias atuais de tecnologia', text: 'Resumo atual da pesquisa.', sources: [{ url: 'https://example.com/article', title: 'Fonte consultada' }], retrievedAt: 0, untrusted: true });
  assert.ok(result.retrievedAt >= before && result.retrievedAt <= after); assert.equal(requests.length, 1);
  const { url, init, json } = requests[0]; assert.equal(url, 'https://api.openai.com/v1/responses'); assert.equal(init.method, 'POST'); assert.equal(init.redirect, 'error'); assert.equal(init.headers.Authorization, `Bearer ${KEY}`);
  assert.equal(json.model, 'gpt-5.4-mini'); assert.equal(json.input, 'Notícias atuais de tecnologia'); assert.equal(json.store, false); assert.equal(json.stream, false); assert.equal(json.max_output_tokens, 1500); assert.equal(json.tool_choice, 'required');
  assert.deepEqual(json.tools, [{ type: 'web_search', external_web_access: true, search_context_size: 'medium' }]);
  assert.equal(json.previous_response_id, undefined); assert.equal(json.conversation, undefined); assert.equal(json.safety_identifier, undefined);
  assert.equal(JSON.stringify(json).includes(privateMemory), false); assert.equal(JSON.stringify(result).includes(KEY), false);
});

test('default model remains unchanged and account-specific model IDs are preserved', async () => {
  const normal = setup(); await normal.service.searchWeb({ query: 'Uma consulta' }); assert.equal(normal.requests[0].json.model, DEFAULT_MODELS.textModel);
  const configured = setup({ getSettings: () => ({ textModel: 'custom-supported-search-model' }) });
  await configured.service.searchWeb({ query: 'Outra consulta' }); assert.equal(configured.requests[0].json.model, 'custom-supported-search-model');
});

test('only safe URL citation annotations contribute up to six unique sources; missing titles use the hostname', async () => {
  const ignored = ['javascript:alert(1)', 'file:///private.txt', 'data:text/html,secret', 'https://user:password@example.com/', 'https://127.0.0.1/', 'http://2130706433/', 'https://[::ffff:127.0.0.1]/', 'https://[fe80::1]/', 'https://metadata.google.internal/', 'http://localhost/', 'http://printer/', 'https://example.com/\r\nprivate', 'https://example.com\\@127.0.0.1/'];
  const annotations = [...ignored.map(url => annotation(url)), { type: 'file_citation', url: 'https://not-a-web-source.example.org/' }, annotation('https://example.com/1', 'Título\u0000\u202e limpo'), annotation('https://example.com/1', 'Duplicada'), annotation('https://example.com/2', ''), ...Array.from({ length: 9 }, (_, index) => annotation(`https://example.org/${index}`, 'x'.repeat(300)))];
  const { service } = setup({ fetch: async () => jsonResponse(completed({ ...search, action: { type: 'search', sources: [{ url: 'https://not-from-annotation.example.org/' }] } }, message('Resultado.', annotations))) });
  const result = await service.searchWeb({ query: 'Consulta' }); assert.equal(result.sources.length, 6);
  assert.deepEqual(result.sources.slice(0, 2), [{ url: 'https://example.com/1', title: 'Título limpo' }, { url: 'https://example.com/2', title: 'example.com' }]);
  assert.equal(result.sources[2].title.length, 200); assert.equal(result.sources.some(source => source.url.includes('not-from-annotation')), false);
});

test('a completed actual search without citations returns an honest empty source list', async () => {
  const { service } = setup({ fetch: async () => jsonResponse(completed(search, message('Não encontrei evidência suficiente.', []))) });
  assert.deepEqual((await service.searchWeb({ query: 'Consulta rara' })).sources, []);
});

test('search results cannot claim success without a completed response, completed search call and real output text', async () => {
  for (const payload of [null, [], {}, { status: 'in_progress', output: [search, message()] }, { status: 'completed', error: { message: KEY }, output: [search, message()] }, completed(message()), completed({ ...search, status: 'in_progress' }, message()), completed(search), completed(search, message('')), completed(search, message('  \u0000  ')), completed(search, { ...message(), content: [{ type: 'refusal', refusal: 'Refused' }] }), completed(search, { ...message(), role: 'user' }), completed(search, { ...message(), status: 'incomplete' }), completed(search, { ...message(), content: 'broken' }), completed(search, { ...message(), content: [{ type: 'output_text', text: 1 }] }), completed(search, { ...message(), content: [{ type: 'output_text', text: 'A', annotations: {} }] }), completed(search, null)]) {
    const { service } = setup({ fetch: async () => jsonResponse(payload) }); await assert.rejects(service.searchWeb({ query: 'Consulta' }), { code: 'invalid_response' });
  }
});

test('invalid and oversized queries or additional history fields are refused before a request', async () => {
  const { service, requests } = setup();
  for (const input of [null, [], {}, { query: '' }, { query: '   ' }, { query: 2 }, { query: 'x'.repeat(1201) }, { query: 'Consulta\0privada' }, { query: 'Consulta\u0007privada' }, { query: 'Consulta', history: [] }, { query: 'Consulta', profileId: 'other' }]) await assert.rejects(service.searchWeb(input), { code: 'invalid_input' });
  assert.equal(requests.length, 0);
  await service.searchWeb({ query: 'x'.repeat(1200) }); assert.equal(requests.length, 1);
});

test('provider errors and network exceptions never expose keys, request URLs or error HTML', async () => {
  for (const [status, code] of [[400, 'request_rejected'], [401, 'authentication'], [403, 'permission'], [429, 'rate_limit'], [500, 'unavailable']]) {
    const { service } = setup({ fetch: async () => new Response(`<html>PRIVATE_ERROR ${KEY} https://secret.example/?token=private</html>`, { status }) });
    await assert.rejects(service.searchWeb({ query: 'Consulta' }), error => error instanceof OpenAIServiceError && error.code === code && !error.message.includes(KEY) && !error.message.includes('PRIVATE_ERROR') && !error.message.includes('https://'));
  }
  const broken = setup({ fetch: async () => { throw new Error(`PRIVATE_EXCEPTION ${KEY}`); } });
  await assert.rejects(broken.service.searchWeb({ query: 'Consulta' }), { code: 'connection' });
  const missing = setup({ getKey: () => '' }); await assert.rejects(missing.service.searchWeb({ query: 'Consulta' }), { code: 'missing_key' }); assert.equal(missing.requests.length, 0);
});

test('bounded response parsing rejects invalid JSON, wrong MIME, malformed UTF-8 and text exceeding the returned-data limit', async () => {
  for (const response of [new Response('{broken', { headers: { 'content-type': 'application/json' } }), new Response('<html>PRIVATE</html>', { headers: { 'content-type': 'text/html' } }), new Response(new Uint8Array([0xff, 0xfe]), { headers: { 'content-type': 'application/json' } }), jsonResponse(completed(search, message('x'.repeat(20_001))))]) {
    const { service } = setup({ fetch: async () => response }); await assert.rejects(service.searchWeb({ query: 'Consulta' }), { code: 'invalid_response' });
  }
});

test('both a declared large response and a streaming JSON body above one MiB are cancelled before parsing', async () => {
  for (const declared of [true, false]) {
    let cancelled = false;
    const { service } = setup({ fetch: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1_048_577)); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json', ...(declared ? { 'content-length': '1048577' } : {}) } }) });
    await assert.rejects(service.searchWeb({ query: 'Consulta' }), { code: 'invalid_response' }); assert.equal(cancelled, true);
  }
});

test('streamed JSON supports arbitrary UTF-8 boundaries while control characters remain inert', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(completed(search, message('Olá 🌎!\u0000\u202e Agora.', []))));
  const { service } = setup({ fetch: async () => new Response(new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } }), { headers: { 'content-type': 'application/json' } }) });
  assert.equal((await service.searchWeb({ query: 'Notícias' })).text, 'Olá 🌎! Agora.');
});

test('cancellation reaches an in-flight request and late responses are disposed without returning results', async () => {
  const controller = new AbortController(); let providerSignal, complete, cancelled = false;
  const { service, requests } = setup({ fetch: async (_url, init) => { providerSignal = init.signal; return new Promise(resolve => { complete = resolve; }); } });
  const pending = service.searchWeb({ query: 'Consulta' }, { signal: controller.signal }); await tick(); controller.abort();
  await assert.rejects(pending, { code: 'cancelled' }); assert.equal(providerSignal.aborted, true);
  complete(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } })); await tick(); assert.equal(cancelled, true);
  await assert.rejects(service.searchWeb({ query: 'Consulta' }, { signal: controller.signal }), { code: 'cancelled' }); assert.equal(requests.length, 1);
});

test('deadline bounds a stuck provider, missing key getter and pending streamed body without waiting for cleanup', async () => {
  for (const stage of ['provider', 'key', 'body', 'error-cancel']) {
    let cancelled = false;
    const { service } = setup({ searchTimeoutMs: 15, ...(stage === 'key' ? { getKey: () => new Promise(() => {}) } : {}), fetch: async () => {
      if (stage === 'provider') return new Promise(() => {});
      if (stage === 'error-cancel') return { ok: false, status: 403, body: { cancel() { return new Promise(() => {}); } } };
      return new Response(new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } });
    } });
    await assert.rejects(service.searchWeb({ query: 'Consulta' }), { code: stage === 'error-cancel' ? 'permission' : 'timeout' }); if (stage === 'body') assert.equal(cancelled, true);
  }
  assert.throws(() => setup({ searchTimeoutMs: 60_001 }), TypeError); assert.throws(() => setup({ searchTimeoutMs: 0 }), TypeError);
});

test('cancelled pending JSON reads do not leak results or cancel another concurrent search', async () => {
  const controller = new AbortController(); let cancelled = false;
  const { service } = setup({ fetch: async (_url, init) => JSON.parse(init.body).input === 'Lenta' ? new Response(new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }) : jsonResponse(completed(search, message('Resultado independente.', []))) });
  const pending = service.searchWeb({ query: 'Lenta' }, { signal: controller.signal }); await tick();
  const other = await service.searchWeb({ query: 'Rápida' }); controller.abort(); await assert.rejects(pending, { code: 'cancelled' });
  assert.equal(cancelled, true); assert.equal(other.text, 'Resultado independente.'); assert.equal(other.query, 'Rápida');
});

test('dispatch-only results preserve unverified status in typed tools and Responses continuation', async () => {
  const definition = { type: 'function', name: 'apps_launch', parameters: { type: 'object', properties: { appId: { type: 'string' } }, required: ['appId'], additionalProperties: false } };
  const dispatched = { ok: true, status: 'unverified', summary: 'Solicitei a abertura; a janela não foi verificada.' };
  const context = setup({ runtime: { toolDefinitions: [definition], call: async () => dispatched } });
  assert.deepEqual(await context.service.executeRealtimeTool({ id: 'call_1', name: 'apps_launch', args: { appId: 'opaque-id' }, runId: 'run_1' }), dispatched);
  const requests = []; let step = 0;
  const stream = output => new Response(`data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output } })}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } });
  const service = new OpenAIService({ getKey: () => KEY, runtime: { toolDefinitions: [definition], call: async () => dispatched }, fetch: async (_url, init) => {
    requests.push(JSON.parse(init.body)); return step++ === 0 ? stream([{ type: 'function_call', call_id: 'call_1', name: 'apps_launch', arguments: '{"appId":"opaque-id"}' }]) : stream([message('Solicitei a abertura; ainda não confirmei a janela.')]);
  } });
  await service.respond({ text: 'Abra o aplicativo escolhido.', runId: 'run_2' });
  assert.deepEqual(JSON.parse(requests[1].input.at(-1).output), dispatched);
});

test('text and realtime instructions require user requests, opaque app IDs, fresh weather and honest unverified dispatch', async () => {
  const requests = [];
  const service = new OpenAIService({ getKey: () => KEY, fetch: async (_url, init) => { requests.push(JSON.parse(init.body.get('session'))); return new Response('v=0\r\ns=answer\r\n'); } });
  await service.createRealtimeSession({ sdp: 'v=0\r\ns=offer\r\n' });
  const instructions = requests[0].instructions;
  assert.ok(instructions.includes(JARVIS_INSTRUCTIONS)); assert.ok(instructions.includes('unverified confirma somente o envio do comando'));
  assert.ok(JARVIS_INSTRUCTIONS.includes('apps_find')); assert.ok(JARVIS_INSTRUCTIONS.includes('apps_launch')); assert.ok(JARVIS_INSTRUCTIONS.includes('identificador opaco exato')); assert.ok(JARVIS_INSTRUCTIONS.includes('weather_current com dados novos')); assert.ok(JARVIS_INSTRUCTIONS.includes('somente quando a pessoa pedir explicitamente'));
  assert.deepEqual(requests[0].output_modalities, ['text']); assert.equal(requests[0].audio.output, undefined);
});
