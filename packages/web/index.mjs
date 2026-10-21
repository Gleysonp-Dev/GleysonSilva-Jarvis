import http from 'node:http';
import https from 'node:https';
import { lookup as systemLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { Readable } from 'node:stream';

export const WEB_LIMITS = Object.freeze({ bytes: 2 * 1024 * 1024, text: 20_000, title: 200, redirects: 3, timeoutMs: 12_000, url: 4096 });

const messages = Object.freeze({
  invalid_input: 'Informe uma URL pública HTTP ou HTTPS válida.',
  blocked_destination: 'Este destino não é um site público permitido.',
  unavailable: 'Não foi possível consultar esse site agora.',
  unsupported_content: 'Esta página não oferece um formato de texto compatível.',
  empty_content: 'A página não contém texto legível sem executar programas.',
  redirect_limit: 'A página excedeu o limite de redirecionamentos.',
  timeout: 'A consulta ao site excedeu o tempo disponível.',
  cancelled: 'A consulta ao site foi cancelada.'
});

export class WebServiceError extends Error {
  constructor(code = 'unavailable') { super(messages[code] ?? messages.unavailable); this.name = 'WebServiceError'; this.code = Object.hasOwn(messages, code) ? code : 'unavailable'; }
}
const fail = code => new WebServiceError(code);

// Conservative exclusions from IANA special-purpose registries. Transition IPv6
// ranges are deliberately excluded: they can encode or translate a private IPv4.
const blocked = new BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) blocked.addSubnet(address, prefix, 'ipv4');
blocked.addAddress('168.63.129.16', 'ipv4'); // Azure platform/metadata virtual IP.
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]]) blocked.addSubnet(address, prefix, 'ipv6');
const globalV6 = new BlockList(); globalV6.addSubnet('2000::', 3, 'ipv6');

function publicAddress(address) {
  const family = typeof address === 'string' ? isIP(address) : 0;
  return family === 4 ? !blocked.check(address, 'ipv4') : family === 6 && globalV6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}

function parseUrl(input, base) {
  if (typeof input !== 'string' || !input || input.length > WEB_LIMITS.url || /[\u0000-\u0020\u007f\\]/u.test(input)) throw fail('invalid_input');
  let url; try { url = base ? new URL(input, base) : new URL(input); } catch { throw fail('invalid_input'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) throw fail('invalid_input');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (isIP(hostname)) { if (!publicAddress(hostname)) throw fail('blocked_destination'); }
  else {
    const labels = hostname.split('.');
    if (labels.length < 2 || hostname.length > 253 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label)) || /^\d+$/u.test(labels.at(-1)) || /(?:^|\.)(?:localhost|local|internal|lan|home|onion|invalid|test)$/u.test(hostname) || hostname === 'metadata.google.internal') throw fail('blocked_destination');
    url.hostname = hostname;
  }
  url.hash = '';
  return { url, hostname };
}

function abortError(signal) { return signal.reason instanceof WebServiceError ? signal.reason : fail('cancelled'); }
function check(signal) { if (signal.aborted) throw abortError(signal); }
function bounded(promise, signal) {
  if (signal.aborted) { Promise.resolve(promise).catch(() => {}); throw abortError(signal); }
  check(signal);
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError(signal)); };
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(value => { signal.removeEventListener('abort', abort); if (signal.aborted) reject(abortError(signal)); else resolve(value); }, error => { signal.removeEventListener('abort', abort); reject(signal.aborted ? abortError(signal) : error); });
  });
}

async function resolveDestination(hostname, lookup, signal) {
  check(signal);
  if (isIP(hostname)) return { address: hostname, family: isIP(hostname) };
  const answers = await bounded(Promise.resolve().then(() => lookup(hostname, { all: true, verbatim: true })), signal);
  if (!Array.isArray(answers) || !answers.length || answers.length > 64 || answers.some(answer => !answer || !publicAddress(answer.address) || answer.family !== isIP(answer.address))) throw fail('blocked_destination');
  return { address: answers[0].address, family: answers[0].family };
}

const requestHeaders = Object.freeze({
  accept: 'text/html, application/xhtml+xml, text/plain;q=0.9',
  'accept-encoding': 'identity',
  'user-agent': 'GleysonSilva-Jarvis-WebReader/0.4'
});

function pinnedRequest(url, hostname, destination, signal) {
  check(signal);
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const lookup = (requested, options, callback) => {
      if (typeof options === 'function') { callback = options; options = {}; }
      if (signal.aborted || requested.replace(/\.$/, '').toLowerCase() !== hostname) { callback(fail(signal.aborted ? 'cancelled' : 'blocked_destination')); return; }
      // Node may request one address or all addresses. Both paths return ONLY the
      // address from the completed, fully validated DNS answer set.
      if (options?.all) callback(null, [{ ...destination }]); else callback(null, destination.address, destination.family);
    };
    const request = transport.request(url, { method: 'GET', headers: requestHeaders, signal, agent: false, family: destination.family, autoSelectFamily: false, lookup, maxHeaderSize: 16_384, ...(url.protocol === 'https:' ? { rejectUnauthorized: true, ...(isIP(hostname) ? {} : { servername: hostname }) } : {}) }, response => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) if (value !== undefined) for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
      resolve({ status: response.statusCode, headers, body: Readable.toWeb(response), cancel: () => response.destroy() });
    });
    request.once('error', reject);
    request.end();
  });
}

function discard(response) {
  try { response?.cancel?.(); } catch { /* Disposal must not expose transport errors. */ }
  try { const pending = response?.body?.cancel?.(); pending?.catch?.(() => {}); } catch { /* It may already have a locked reader. */ }
}

async function readBytes(response, maxBytes, signal) {
  if (!response.body?.getReader) throw fail('empty_content');
  const reader = response.body.getReader(); const chunks = []; let size = 0, truncated = false, completed = false;
  const cancel = () => { try { const pending = reader.cancel(); pending?.catch?.(() => {}); } catch {} try { response.cancel?.(); } catch {} };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      const { value, done } = await bounded(reader.read(), signal);
      if (done) { completed = true; break; }
      if (!(value instanceof Uint8Array)) throw fail('unavailable');
      const remaining = maxBytes - size;
      if (value.byteLength > remaining) { if (remaining) chunks.push(Buffer.from(value.subarray(0, remaining))); size += remaining; truncated = true; cancel(); break; }
      chunks.push(Buffer.from(value)); size += value.byteLength;
    }
    check(signal);
    return { bytes: Buffer.concat(chunks, size), truncated };
  } finally { signal.removeEventListener('abort', cancel); if (!completed && !truncated) cancel(); try { reader.releaseLock(); } catch {} }
}

const entities = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™', euro: '€', pound: '£', yen: '¥', cent: '¢', deg: '°', plusmn: '±', times: '×', divide: '÷', laquo: '«', raquo: '»', aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï', oacute: 'ó', ograve: 'ò', ocirc: 'ô', otilde: 'õ', ouml: 'ö', uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü', ccedil: 'ç', ntilde: 'ñ', yacute: 'ý', Aacute: 'Á', Agrave: 'À', Acirc: 'Â', Atilde: 'Ã', Auml: 'Ä', Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Euml: 'Ë', Iacute: 'Í', Oacute: 'Ó', Ocirc: 'Ô', Otilde: 'Õ', Ouml: 'Ö', Uacute: 'Ú', Uuml: 'Ü', Ccedil: 'Ç', Ntilde: 'Ñ' });
function decodeEntities(text) {
  return text.replace(/&(#x[\da-f]{1,8}|#\d{1,8}|[a-z][a-z\d]{1,31});?/giu, (source, name) => {
    if (name[0] !== '#') return Object.hasOwn(entities, name) ? entities[name] : source;
    const value = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : '�';
  });
}
function clean(text) { return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/gu, '').replace(/\r\n?/gu, '\n').replace(/[^\S\n]+/gu, ' ').replace(/ *\n */gu, '\n').replace(/\n{3,}/gu, '\n\n').trim(); }
function clip(text, limit) { const value = text.slice(0, limit); return /[\ud800-\udbff]$/u.test(value) ? value.slice(0, -1) : value; }
const omittedTags = new Set(['script', 'style', 'template', 'noscript', 'svg', 'math', 'iframe', 'object', 'canvas', 'audio', 'video']);
const blockTags = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'table', 'tr', 'blockquote', 'br', 'hr', 'pre', 'address', 'dl', 'dt', 'dd']);

// A bounded inert tokenizer, not an HTML renderer. It never constructs a DOM,
// follows resource links, evaluates attributes, or executes embedded programs.
function htmlText(source) {
  const lower = source.toLowerCase(); const parts = []; const titleParts = [];
  let position = 0, inHead = false, inTitle = false, hadTitle = false;
  while (position < source.length) {
    if (source[position] !== '<') {
      const next = source.indexOf('<', position), end = next === -1 ? source.length : next;
      if (inTitle) titleParts.push(source.slice(position, Math.min(end, position + 2048))); else if (!inHead) parts.push(source.slice(position, end));
      position = end; continue;
    }
    if (source.startsWith('<!--', position)) { const end = source.indexOf('-->', position + 4); position = end === -1 ? source.length : end + 3; continue; }
    const match = /^<\/?([a-z][a-z\d:-]*)\b/iu.exec(source.slice(position, position + 160));
    if (!match && !/^<[!?]/u.test(source.slice(position, position + 2))) { if (!inHead && !inTitle) parts.push('<'); position++; continue; }
    let end = position + 1, quote = '';
    for (; end < source.length; end++) { const char = source[end]; if (quote) { if (char === quote) quote = ''; } else if (char === '"' || char === "'") quote = char; else if (char === '>') break; }
    if (end === source.length) break;
    position = end + 1;
    if (!match) continue;
    const tag = match[1].toLowerCase(), closing = match[0][1] === '/';
    if (tag === 'body' && !closing) inHead = false; // </head> is optional in HTML.
    if (omittedTags.has(tag) && !closing) {
      let found = lower.indexOf(`</${tag}`, position);
      while (found !== -1 && !/[\s/>]/u.test(lower[found + tag.length + 2] ?? '>')) found = lower.indexOf(`</${tag}`, found + tag.length + 2);
      position = found === -1 ? source.length : found;
      continue;
    }
    if (tag === 'head') inHead = !closing;
    if (tag === 'title') { if (closing) { inTitle = false; hadTitle = true; } else inTitle = !hadTitle; }
    if (tag === 'td' || tag === 'th') { if (!inHead) parts.push(' '); }
    else if (blockTags.has(tag) && !inHead) parts.push('\n');
  }
  return { title: clean(decodeEntities(titleParts.join(' '))).replace(/\n/gu, ' '), text: clean(decodeEntities(parts.join(''))) };
}

export class WebService {
  constructor({ fetch, lookup = systemLookup, now = Date.now, timeoutMs = WEB_LIMITS.timeoutMs, maxBytes = WEB_LIMITS.bytes } = {}) {
    if ((fetch !== undefined && typeof fetch !== 'function') || typeof lookup !== 'function' || typeof now !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000 || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > WEB_LIMITS.bytes) throw new TypeError('Configuração inválida do leitor de páginas.');
    this.fetch = fetch; this.lookup = lookup; this.now = now; this.timeoutMs = timeoutMs; this.maxBytes = maxBytes;
  }

  async read(input, { signal } = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => key !== 'url')) throw fail('invalid_input');
    let target = parseUrl(input.url);
    const controller = new AbortController();
    const abort = () => controller.abort(fail('cancelled'));
    if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
    const deadline = setTimeout(() => controller.abort(fail('timeout')), this.timeoutMs);
    let response;
    try {
      const visited = new Set();
      for (let hop = 0; ; hop++) {
        check(controller.signal);
        if (visited.has(target.url.href)) throw fail('redirect_limit');
        visited.add(target.url.href);
        const destination = await resolveDestination(target.hostname, this.lookup, controller.signal);
        // An explicitly injected transport is trusted test/application code. The
        // default transport always pins DNS; native/global fetch is NOT the default.
        const request = this.fetch
          ? Promise.resolve().then(() => this.fetch(target.url.href, { method: 'GET', headers: { ...requestHeaders }, redirect: 'manual', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal }))
          : pinnedRequest(target.url, target.hostname, destination, controller.signal);
        response = await bounded(request.then(value => { if (controller.signal.aborted) { discard(value); throw abortError(controller.signal); } return value; }), controller.signal);
        if (!response || response.redirected || !Number.isInteger(response.status) || !response.headers?.get) throw fail('unavailable');
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          discard(response); response = undefined;
          if (hop >= WEB_LIMITS.redirects) throw fail('redirect_limit');
          if (!location) throw fail('unavailable');
          target = parseUrl(location, target.url); continue;
        }
        if (response.status < 200 || response.status >= 300) throw fail('unavailable');
        const declaredType = response.headers.get('content-type') ?? '';
        const contentType = declaredType.split(';', 1)[0].trim().toLowerCase();
        if (!['text/html', 'application/xhtml+xml', 'text/plain'].includes(contentType) || /\battachment\b/iu.test(response.headers.get('content-disposition') ?? '') || !['', 'identity'].includes((response.headers.get('content-encoding') ?? '').trim().toLowerCase())) throw fail('unsupported_content');
        let decoder; try { decoder = new TextDecoder(/charset\s*=\s*["']?([^;\s"']+)/iu.exec(declaredType)?.[1] ?? 'utf-8'); } catch { throw fail('unsupported_content'); }
        const { bytes, truncated } = await readBytes(response, this.maxBytes, controller.signal);
        const source = decoder.decode(bytes);
        const extracted = contentType !== 'text/plain' || /^\s*<(?:!doctype\b|html\b|head\b|body\b)/iu.test(source) ? htmlText(source) : { title: '', text: clean(source) };
        if (!extracted.text) throw fail('empty_content');
        check(controller.signal);
        const title = clip(extracted.title || target.hostname, WEB_LIMITS.title);
        return { url: target.url.href, title, text: clip(extracted.text, WEB_LIMITS.text), retrievedAt: new Date(this.now()).toISOString(), contentType, truncated: truncated || extracted.text.length > WEB_LIMITS.text, sources: [{ url: target.url.href, title }] };
      }
    } catch (error) { if (controller.signal.aborted) throw abortError(controller.signal); throw error instanceof WebServiceError ? error : fail('unavailable'); }
    finally { clearTimeout(deadline); signal?.removeEventListener('abort', abort); discard(response); }
  }
}
