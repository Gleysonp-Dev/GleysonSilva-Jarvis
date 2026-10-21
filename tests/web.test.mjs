import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import http from 'node:http';
import https from 'node:https';
import { WebService, WebServiceError, WEB_LIMITS } from '../packages/web/index.mjs';

const PUBLIC = { address: '93.184.215.14', family: 4 };
const V6 = { address: '2606:4700:4700::1111', family: 6 };
const fixedTime = Date.parse('2026-10-20T14:00:00Z');
function setup({ lookup, fetch, ...options } = {}) {
  const requests = [], resolutions = [];
  const service = new WebService({ now: () => fixedTime, ...options,
    lookup: async (...args) => { resolutions.push(args); return lookup ? lookup(...args) : [PUBLIC]; },
    fetch: async (...args) => { requests.push(args); return fetch ? fetch(...args) : new Response('Conteúdo público.', { headers: { 'content-type': 'text/plain' } }); }
  });
  return { service, requests, resolutions };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('extracts inert HTML text, a decoded title and one final source without executing or fetching resources', async () => {
  globalThis.__jarvisWebExecution = false;
  const html = `<!doctype html><html><head><title>Pre&ccedil;o &amp; clima &#x1f30e;</title><meta http-equiv="refresh" content="0;url=http://127.0.0.1"><style>secret-style</style></head><body><h1>Ol&aacute;, mundo</h1><p>Agora: 23 &deg;C.<br>Chuva &lt; 10%.</p><script>globalThis.__jarvisWebExecution=true;fetch('http://localhost/private')</script><iframe src="http://127.0.0.1">private-frame</iframe><svg><text>hidden-svg</text></svg><template>hidden-template</template><noscript>hidden-noscript</noscript><p title="leak" onclick="alert(1)">Fim &#65; &#0;.</p><!-- private-comment --></body></html>`;
  const { service, requests, resolutions } = setup({ fetch: async () => new Response(html, { headers: { 'content-type': 'text/html; charset=UTF-8' } }) });
  const result = await service.read({ url: 'https://Example.com/article#part' });
  assert.deepEqual(result, { url: 'https://example.com/article', title: 'Preço & clima 🌎', text: 'Olá, mundo\n\nAgora: 23 °C.\nChuva < 10%.\n\nFim A �.', retrievedAt: '2026-10-20T14:00:00.000Z', contentType: 'text/html', truncated: false, sources: [{ url: 'https://example.com/article', title: 'Preço & clima 🌎' }] });
  assert.equal(globalThis.__jarvisWebExecution, false); delete globalThis.__jarvisWebExecution;
  assert.equal(requests.length, 1); assert.deepEqual(resolutions, [['example.com', { all: true, verbatim: true }]]);
  const init = requests[0][1]; assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual'); assert.equal(init.credentials, 'omit');
  assert.deepEqual(Object.keys(init.headers).sort(), ['accept', 'accept-encoding', 'user-agent']);
  assert.equal(init.headers['accept-encoding'], 'identity'); assert.equal(init.referrerPolicy, 'no-referrer');
});

test('plain text, XHTML and legacy charset are readable without requiring an LLM', async () => {
  const { service } = setup({ fetch: async url => url.includes('legacy') ? new Response(new Uint8Array([0x50, 0x72, 0x65, 0xe7, 0x6f]), { headers: { 'content-type': 'text/plain;charset=iso-8859-1' } }) : new Response('<html><head><title>Documento</title></head><body><p>Texto</p></body></html>', { headers: { 'content-type': 'application/xhtml+xml' } }) });
  assert.equal((await service.read({ url: 'http://example.com/legacy' })).text, 'Preço');
  assert.equal((await service.read({ url: 'https://example.com/xhtml' })).text, 'Texto');
  assert.equal((await service.read({ url: 'http://example.com/legacy' })).title, 'example.com');
});

test('input rejects credentials, unsafe schemes, invalid values and unknown fields before any lookup or connection', async () => {
  const { service, requests, resolutions } = setup();
  for (const input of [null, [], {}, { url: '' }, { url: 3 }, { url: 'file:///C:/secret.txt' }, { url: 'javascript:alert(1)' }, { url: 'ftp://example.com/file' }, { url: 'https://user:secret@example.com' }, { url: 'https://example.com/\r\nprivate' }, { url: 'https://example.com\\@127.0.0.1' }, { url: `https://example.com/${'x'.repeat(4096)}` }, { url: 'https://example.com/', headers: { Authorization: 'secret' } }]) {
    await assert.rejects(service.read(input), { code: 'invalid_input' });
  }
  assert.equal(requests.length, 0); assert.equal(resolutions.length, 0);
});

test('private, loopback, metadata, unusual IPv4 notation and nonpublic IPv6 cannot reach a transport', async () => {
  const { service, requests, resolutions } = setup();
  for (const host of ['0.1.2.3', '10.1.2.3', '100.100.100.200', '127.0.0.1', '127.22.3.4', '169.254.169.254', '172.31.2.3', '192.168.1.1', '192.0.0.170', '192.0.2.1', '198.19.1.1', '198.51.100.1', '203.0.113.1', '224.0.0.1', '255.255.255.255', '168.63.129.16', '2130706433', '0177.0.0.1', '0x7f000001', '127.1', '[::1]', '[::]', '[::ffff:127.0.0.1]', '[::ffff:7f00:1]', '[::ffff:8.8.8.8]', '[64:ff9b::a00:1]', '[fc00::1]', '[fd00::1]', '[fe80::1]', '[ff02::1]', '[2001:db8::1]', '[2001:0:abcd::1]', '[2002:7f00:1::1]', '[3fff::1]']) {
    await assert.rejects(service.read({ url: `http://${host}/private` }), { code: 'blocked_destination' }, host);
  }
  assert.equal(requests.length, 0); assert.equal(resolutions.length, 0);
});

test('local names, single-label names, reserved suffixes and trailing-dot variants are refused', async () => {
  const { service, requests, resolutions } = setup();
  for (const host of ['localhost', 'localhost.', 'sub.localhost', 'printer', 'home.local', 'foo.internal', 'foo.lan', 'foo.home', 'hidden.onion', 'foo.invalid', 'foo.test', 'metadata.google.internal', 'foo..com', '-a.example.com']) {
    await assert.rejects(service.read({ url: `http://${host}/` }), { code: 'blocked_destination' }, host);
  }
  assert.equal(requests.length, 0); assert.equal(resolutions.length, 0);
});

test('all DNS answers must be public, well formed and family-consistent', async () => {
  for (const answers of [[PUBLIC, { address: '127.0.0.1', family: 4 }], [V6, { address: '::ffff:10.0.0.1', family: 6 }], [{ address: 'not-an-ip', family: 4 }], [{ address: PUBLIC.address, family: 6 }], [], null, Array(65).fill(PUBLIC)]) {
    const { service, requests } = setup({ lookup: async () => answers });
    await assert.rejects(service.read({ url: 'https://public.example.com/' }), { code: 'blocked_destination' }); assert.equal(requests.length, 0);
  }
  const valid = setup({ lookup: async () => [V6, PUBLIC] });
  assert.equal((await valid.service.read({ url: 'https://example.com/' })).text, 'Conteúdo público.');
});

test('public IP literals are validated without DNS; a public trailing-dot hostname is normalized', async () => {
  const { service, resolutions, requests } = setup();
  await service.read({ url: 'https://8.8.8.8/' }); await service.read({ url: 'https://[2606:4700:4700::1111]/' });
  assert.equal(resolutions.length, 0);
  await service.read({ url: 'https://example.com./page#part' });
  assert.equal(requests.at(-1)[0], 'https://example.com/page'); assert.equal(resolutions[0][0], 'example.com');
});

test('each redirect is independently resolved and validated and only the final page is returned as source', async () => {
  const { service, requests, resolutions } = setup({ fetch: async url => url === 'https://example.com/start' ? new Response(null, { status: 302, headers: { location: '/step' } }) : url === 'https://example.com/step' ? new Response(null, { status: 307, headers: { location: 'https://other.example.org/final#fragment', 'set-cookie': 'private=1' } }) : new Response('<title>Final</title><p>Resultado final</p>', { headers: { 'content-type': 'text/html' } }) });
  const result = await service.read({ url: 'https://example.com/start' });
  assert.equal(result.url, 'https://other.example.org/final'); assert.deepEqual(result.sources, [{ url: result.url, title: 'Final' }]);
  assert.deepEqual(resolutions.map(call => call[0]), ['example.com', 'example.com', 'other.example.org']);
  assert.equal(requests.length, 3); assert.equal(requests.at(-1)[1].headers.cookie, undefined);
});

test('redirects to private destinations, private DNS, credentials or file URLs stop before the next connection', async () => {
  for (const location of ['http://127.0.0.1/admin', 'http://[::ffff:127.0.0.1]/', 'http://metadata.google.internal/', 'https://secret:pass@example.com/', 'file:///private']) {
    const { service, requests } = setup({ fetch: async () => new Response(null, { status: 302, headers: { location } }) });
    await assert.rejects(service.read({ url: 'https://example.com/' }), error => ['blocked_destination', 'invalid_input'].includes(error.code)); assert.equal(requests.length, 1);
  }
  const { service, requests } = setup({ lookup: async host => host === 'public.example.org' ? [{ address: '192.168.1.4', family: 4 }] : [PUBLIC], fetch: async () => new Response(null, { status: 301, headers: { location: 'https://public.example.org/' } }) });
  await assert.rejects(service.read({ url: 'https://example.com/' }), { code: 'blocked_destination' }); assert.equal(requests.length, 1);
});

test('same-host rebinding on a redirect is blocked and redirect chains stop after three hops', async () => {
  let resolution = 0;
  const rebound = setup({ lookup: async () => ++resolution === 1 ? [PUBLIC] : [{ address: '169.254.169.254', family: 4 }], fetch: async () => new Response(null, { status: 302, headers: { location: '/next' } }) });
  await assert.rejects(rebound.service.read({ url: 'https://example.com/' }), { code: 'blocked_destination' }); assert.equal(rebound.requests.length, 1);
  const long = setup({ fetch: async url => new Response(null, { status: 302, headers: { location: `/${Number(new URL(url).pathname.slice(1)) + 1}` } }) });
  await assert.rejects(long.service.read({ url: 'https://example.com/0' }), { code: 'redirect_limit' }); assert.equal(long.requests.length, 4);
  const cycle = setup({ fetch: async () => new Response(null, { status: 302, headers: { location: '/' } }) });
  await assert.rejects(cycle.service.read({ url: 'https://example.com/' }), { code: 'redirect_limit' }); assert.equal(cycle.requests.length, 1);
});

test('default native HTTP(S) transport pins only the validated DNS answer and preserves host/TLS verification', async context => {
  for (const [transport, protocol] of [[http, 'http:'], [https, 'https:']]) {
    let resolutions = 0, options, requestedUrl;
    const pinned = [];
    const mocked = context.mock.method(transport, 'request', (url, init, onResponse) => {
      requestedUrl = url; options = init;
      const request = new EventEmitter();
      request.end = () => queueMicrotask(() => {
        init.lookup('example.com', {}, (error, address, family) => { assert.ifError(error); pinned.push({ address, family }); });
        init.lookup('example.com', { all: true }, (error, addresses) => { assert.ifError(error); pinned.push(...addresses); });
        const response = Readable.from([Buffer.from('Conexão pública fixada.')]); response.statusCode = 200; response.headers = { 'content-type': 'text/plain' }; onResponse(response);
      }); return request;
    });
    try {
      const service = new WebService({ lookup: async () => { resolutions++; return [PUBLIC, V6]; } });
      const result = await service.read({ url: `${protocol}//example.com/path?q=1` });
      assert.equal(result.text, 'Conexão pública fixada.'); assert.equal(resolutions, 1); assert.deepEqual(pinned, [PUBLIC, PUBLIC]);
      assert.equal(requestedUrl.hostname, 'example.com'); assert.equal(options.agent, false); assert.equal(options.family, 4); assert.equal(options.autoSelectFamily, false); assert.equal(options.maxHeaderSize, 16_384);
      if (protocol === 'https:') { assert.equal(options.servername, 'example.com'); assert.equal(options.rejectUnauthorized, true); }
      let rejection; options.lookup('other.example.org', {}, error => { rejection = error; }); assert.equal(rejection.code, 'blocked_destination');
    } finally { mocked.mock.restore(); }
  }
});

test('byte and text limits truncate cleanly, cancel remaining bodies and cap constructor overrides', async () => {
  let cancelled = false;
  const limited = setup({ maxBytes: 16, fetch: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('Texto público excessivo para a leitura.')); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/plain' } }) });
  const result = await limited.service.read({ url: 'https://example.com/' }); assert.equal(result.truncated, true); assert.ok(Buffer.byteLength(result.text) <= 16); assert.equal(cancelled, true);
  const text = setup({ fetch: async () => new Response('x'.repeat(WEB_LIMITS.text + 1), { headers: { 'content-type': 'text/plain' } }) });
  const capped = await text.service.read({ url: 'https://example.com/' }); assert.equal(capped.text.length, 20_000); assert.equal(capped.truncated, true);
  for (const options of [{ maxBytes: 0 }, { maxBytes: WEB_LIMITS.bytes + 1 }, { timeoutMs: 30_001 }, { lookup: 3 }, { fetch: null }]) assert.throws(() => new WebService(options), TypeError);
});

test('UTF-8 split across streamed chunks is decoded after bounded collection; control and direction characters are removed', async () => {
  const encoded = new TextEncoder().encode('Olá 🌎!\u0000\u202e fim');
  const { service } = setup({ fetch: async () => new Response(new ReadableStream({ start(controller) { for (const byte of encoded) controller.enqueue(new Uint8Array([byte])); controller.close(); } }), { headers: { 'content-type': 'text/plain' } }) });
  assert.equal((await service.read({ url: 'https://example.com/' })).text, 'Olá 🌎! fim');
});

test('script-only, malformed HTML, fake mime, downloads, binaries and error pages expose no raw provider body', async () => {
  const privateBody = 'SECRET_EXCEPTION_BODY https://private.example/token?secret=123';
  for (const response of [new Response(privateBody, { status: 403, headers: { 'content-type': 'text/html' } }), new Response(privateBody, { headers: { 'content-type': 'application/pdf' } }), new Response(privateBody, { headers: { 'content-type': 'text/html', 'content-disposition': 'attachment; filename=secret.html' } }), new Response(privateBody, { headers: { 'content-type': 'text/plain', 'content-encoding': 'gzip' } }), new Response(privateBody, { headers: { 'content-type': 'text/plain; charset=unknown-private-encoding' } }), new Response('<head><title>Only title</title></head><script>SECRET_EXCEPTION_BODY</script>', { headers: { 'content-type': 'text/html' } }), new Response('<script data-open="x>SECRET_EXCEPTION_BODY', { headers: { 'content-type': 'text/html' } })]) {
    const { service } = setup({ fetch: async () => response });
    await assert.rejects(service.read({ url: 'https://example.com/?private=123' }), error => error instanceof WebServiceError && !error.message.includes('SECRET') && !error.message.includes('https://') && !error.message.includes('private=123'));
  }
  const rejected = setup({ fetch: async () => { throw new Error(privateBody); } });
  await assert.rejects(rejected.service.read({ url: 'https://example.com/' }), { code: 'unavailable', message: 'Não foi possível consultar esse site agora.' });
});

test('HTML tokenizer handles quoted >, comments, malformed tags, case and false closing-tag prefixes without leaking script text', async () => {
  const { service } = setup({ fetch: async () => new Response('<TITLE>A &amp; B</TITLE><!--<p>comment</p>--><DIV data-x="1>2"><b>Um</b> &amp; dois</DIV><SCRIPT>PRIVATE</scripture>STILL_PRIVATE</SCRIPT><p>Fim</p><broken title="unclosed', { headers: { 'content-type': 'text/html' } }) });
  const result = await service.read({ url: 'https://example.com/' }); assert.equal(result.title, 'A & B'); assert.equal(result.text, 'Um & dois\n\nFim');
});

test('an optional closing head tag does not hide the body, and an auto-following injected transport is refused', async () => {
  const html = setup({ fetch: async () => new Response('<html><head><title>Título</title><body><p>Corpo legível</p>', { headers: { 'content-type': 'text/html' } }) });
  assert.equal((await html.service.read({ url: 'https://example.com/' })).text, 'Corpo legível');
  const followed = setup({ fetch: async () => ({ redirected: true, status: 200, headers: new Headers({ 'content-type': 'text/plain' }) }) });
  await assert.rejects(followed.service.read({ url: 'https://example.com/' }), { code: 'unavailable' });
});

test('deadline bounds a DNS resolver and transport that ignore cancellation; late work never starts a request', async () => {
  let resolveDns;
  const dns = setup({ timeoutMs: 15, lookup: () => new Promise(resolve => { resolveDns = resolve; }) });
  await assert.rejects(dns.service.read({ url: 'https://example.com/' }), { code: 'timeout' }); resolveDns([PUBLIC]); await tick(); assert.equal(dns.requests.length, 0);
  let transportSignal;
  const transport = setup({ timeoutMs: 15, fetch: async (_url, init) => { transportSignal = init.signal; return new Promise(() => {}); } });
  await assert.rejects(transport.service.read({ url: 'https://example.com/' }), { code: 'timeout' }); assert.equal(transportSignal.aborted, true);
});

test('deadline and cancellation abort pending body reads and ignore late responses', async () => {
  let bodyCancelled = false;
  const body = setup({ timeoutMs: 15, fetch: async () => new Response(new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { bodyCancelled = true; } }), { headers: { 'content-type': 'text/plain' } }) });
  await assert.rejects(body.service.read({ url: 'https://example.com/' }), { code: 'timeout' }); assert.equal(bodyCancelled, true);
  const controller = new AbortController(); let completeTransport, providerSignal, discarded = false;
  const late = setup({ fetch: async (_url, init) => { providerSignal = init.signal; return new Promise(resolve => { completeTransport = resolve; }); } });
  const pending = late.service.read({ url: 'https://example.com/' }, { signal: controller.signal }); await tick(); controller.abort();
  await assert.rejects(pending, { code: 'cancelled' }); assert.equal(providerSignal.aborted, true);
  completeTransport(new Response(new ReadableStream({ cancel() { discarded = true; } }), { headers: { 'content-type': 'text/plain' } })); await tick(); assert.equal(discarded, true);
  await assert.rejects(late.service.read({ url: 'https://example.com/' }, { signal: controller.signal }), { code: 'cancelled' }); assert.equal(late.requests.length, 1);
});

test('aborting one concurrent consultation does not cancel another or reuse response/profile data', async () => {
  const controller = new AbortController(); let finish;
  const { service, requests } = setup({ fetch: async url => url.endsWith('/slow') ? new Promise(resolve => { finish = resolve; }) : new Response('Resultado independente.', { headers: { 'content-type': 'text/plain' } }) });
  const pending = service.read({ url: 'https://example.com/slow' }, { signal: controller.signal }); await tick();
  const other = await service.read({ url: 'https://example.org/fast' }); controller.abort(); await assert.rejects(pending, { code: 'cancelled' });
  finish(new Response('Descartado', { headers: { 'content-type': 'text/plain' } })); await tick();
  assert.equal(other.text, 'Resultado independente.'); assert.equal(other.url, 'https://example.org/fast'); assert.equal(requests.length, 2);
});
