import { randomUUID } from 'node:crypto';
import { bridgeCall, normalizeWebsiteUrl } from './bridge.mjs';

// STDIO is the MCP transport: stdout contains JSON-RPC messages only.
const MAX_LINE_BYTES = 64 * 1024;
const MAX_CALLS = 4;
const LATEST_PROTOCOL = '2025-06-18';
const PROTOCOLS = new Set([LATEST_PROTOCOL, '2025-03-26', '2024-11-05']);
const decoder = new TextDecoder('utf-8', { fatal: true });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const closed = (value, keys) => object(value) && Object.keys(value).every(key => keys.includes(key));
const validId = id => typeof id === 'string' || (Number.isSafeInteger(id) && typeof id === 'number');
const idKey = id => JSON.stringify([typeof id, id]);
const emptySchema = Object.freeze({ type: 'object', properties: {}, additionalProperties: false });
const tools = [
  { name: 'jarvis_status', title: 'Estado do Jarvis', description: 'Consulta o estado limitado do Jarvis e da ponte local.', inputSchema: emptySchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } },
  { name: 'jarvis_weather', title: 'Tempo atual', description: 'Consulta o tempo atual para a cidade já configurada no Jarvis.', inputSchema: emptySchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } },
  { name: 'jarvis_open_browser', title: 'Abrir navegador', description: 'Solicita a abertura da página fixa https://www.google.com/ no navegador padrão do Windows.', inputSchema: emptySchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: 'jarvis_open_website', title: 'Abrir site', description: 'Solicita a abertura do site HTTP(S) informado pelo usuário. Endereços sem esquema usam HTTPS.',
    inputSchema: { type: 'object', properties: { url: { type: 'string', minLength: 1, maxLength: 2048 } }, required: ['url'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: 'jarvis_speak', title: 'Falar com a voz Jarvis', description: 'Narra o texto solicitado com a voz já configurada no Jarvis. Não altera a voz nem suas configurações.',
    inputSchema: { type: 'object', properties: { text: { type: 'string', minLength: 1, maxLength: 600 } }, required: ['text'], additionalProperties: false },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
];
const methods = new Map([
  ['jarvis_status', 'status'], ['jarvis_weather', 'weather'],
  ['jarvis_open_browser', 'open_browser'], ['jarvis_open_website', 'open_url'], ['jarvis_speak', 'speak'],
]);
const messages = {
  NOT_RUNNING: 'O Jarvis não está disponível. Abra o aplicativo e habilite a ponte local.',
  AUTH: 'Não foi possível autenticar a ponte local do Jarvis.',
  INVALID: 'A solicitação à ponte local é inválida.',
  UNAVAILABLE: 'Esta operação não está disponível no Jarvis agora.',
  BUSY: 'O Jarvis está ocupado. Tente novamente depois.',
  TIMEOUT: 'A ponte local não respondeu dentro do prazo.',
  CANCELLED: 'A operação foi cancelada.',
  FAILED: 'Não foi possível concluir a operação no Jarvis.',
};
const active = new Map();
let initialized = false;
let ready = false;
let closing = false;
let line = Buffer.alloc(0);
let dropping = false;

function encodeFrame(message) {
  const payload = `${JSON.stringify(message)}\n`;
  return Buffer.byteLength(payload, 'utf8') <= MAX_LINE_BYTES ? payload : null;
}
function send(message) {
  if (closing || process.stdout.destroyed) return;
  const payload = encodeFrame(message) ?? encodeFrame({ jsonrpc: '2.0', id: null,
    error: { code: -32603, message: 'A resposta excede o limite de 64 KiB.' } });
  if (!process.stdout.write(payload)) process.stdin.pause();
}
function result(id, value) { send({ jsonrpc: '2.0', id, result: value }); }
function error(id, code, message) { send({ jsonrpc: '2.0', id, error: { code, message } }); }
function toolError(id, code) {
  const safeCode = own(messages, code) ? code : 'FAILED';
  result(id, { isError: true, content: [{ type: 'text', text: JSON.stringify({ code: safeCode, message: messages[safeCode] }) }] });
}
function validInitialize(params) {
  return closed(params, ['protocolVersion', 'capabilities', 'clientInfo', '_meta'])
    && typeof params.protocolVersion === 'string' && params.protocolVersion.length > 0
    && object(params.capabilities) && object(params.clientInfo)
    && typeof params.clientInfo.name === 'string' && params.clientInfo.name.length > 0
    && typeof params.clientInfo.version === 'string' && params.clientInfo.version.length > 0
    && (!own(params, '_meta') || object(params._meta));
}
function emptyParams(params) {
  return params === undefined || (closed(params, ['_meta']) && (!own(params, '_meta') || object(params._meta)));
}
function validCall(params) {
  if (!closed(params, ['name', 'arguments', '_meta']) || !methods.has(params.name)
      || (own(params, '_meta') && !object(params._meta))) return false;
  const args = params.arguments === undefined ? {} : params.arguments;
  if (params.name === 'jarvis_open_website') {
    if (!closed(args, ['url']) || typeof args.url !== 'string' || args.url.length < 1 || args.url.length > 2048) return false;
    try { normalizeWebsiteUrl(args.url); return true; } catch { return false; }
  }
  if (params.name !== 'jarvis_speak') return closed(args, []);
  return closed(args, ['text']) && typeof args.text === 'string'
    && args.text.trim().length > 0 && args.text.length <= 600
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(args.text);
}
async function callTool(id, params) {
  if (active.size >= MAX_CALLS) { toolError(id, 'BUSY'); return; }
  const key = idKey(id);
  const call = { controller: new AbortController(), cancelled: false };
  active.set(key, call);
  try {
    const value = await bridgeCall({ method: methods.get(params.name), args: params.arguments ?? {},
      signal: call.controller.signal, requestId: randomUUID() });
    if (!call.cancelled && !closing) {
      const response = { content: [{ type: 'text', text: JSON.stringify(value ?? null) }] };
      if (object(value)) response.structuredContent = value;
      // The MCP representation repeats structured data in its text content.
      // Bound the final frame, not just the private broker's smaller result.
      if (encodeFrame({ jsonrpc: '2.0', id, result: response }) === null) toolError(id, 'FAILED');
      else result(id, response);
    }
  } catch (failure) {
    if (!call.cancelled && !closing) toolError(id, failure?.code);
  } finally {
    if (active.get(key) === call) active.delete(key);
  }
}
function notification(message) {
  if (message.method === 'notifications/initialized') {
    if (initialized && emptyParams(message.params)) ready = true;
  } else if (message.method === 'notifications/cancelled') {
    const params = message.params;
    if (!closed(params, ['requestId', 'reason']) || !validId(params.requestId)
        || (own(params, 'reason') && typeof params.reason !== 'string')) return;
    const call = active.get(idKey(params.requestId));
    if (call) { call.cancelled = true; call.controller.abort(); }
  }
}
function receive(buffer) {
  if (closing) return;
  if (buffer.at(-1) === 13) buffer = buffer.subarray(0, -1);
  if (buffer.length === 0) return;
  let message;
  try { message = JSON.parse(decoder.decode(buffer)); }
  catch { error(null, -32700, 'JSON ou UTF-8 inválido.'); return; }
  if (!closed(message, ['jsonrpc', 'id', 'method', 'params']) || message.jsonrpc !== '2.0'
      || typeof message.method !== 'string' || message.method.length === 0
      || (own(message, 'id') && !validId(message.id))
      || (own(message, 'params') && !object(message.params) && !Array.isArray(message.params))) {
    error(null, -32600, 'Mensagem JSON-RPC inválida.'); return;
  }
  if (!own(message, 'id')) { notification(message); return; }
  const { id, method, params } = message;
  if (active.has(idKey(id))) { error(id, -32600, 'Identificador já está em uso.'); return; }
  if (method === 'initialize') {
    if (initialized) { error(id, -32600, 'A sessão já foi inicializada.'); return; }
    if (!validInitialize(params)) { error(id, -32602, 'Parâmetros de inicialização inválidos.'); return; }
    initialized = true;
    result(id, { protocolVersion: PROTOCOLS.has(params.protocolVersion) ? params.protocolVersion : LATEST_PROTOCOL,
      capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'jarvis-ultron', version: '0.6.0' } });
  } else if (method === 'ping') {
    if (!emptyParams(params)) error(id, -32602, 'Parâmetros inválidos.');
    else result(id, {});
  } else if (method === 'tools/list' || method === 'tools/call') {
    if (!ready) { error(id, -32002, 'Inicialize a sessão MCP primeiro.'); return; }
    if (method === 'tools/list') {
      if (!emptyParams(params)) error(id, -32602, 'Parâmetros inválidos.');
      else result(id, { tools });
    } else if (!validCall(params)) error(id, -32602, 'Ferramenta ou argumentos inválidos.');
    else void callTool(id, params);
  } else error(id, -32601, 'Método não encontrado.');
}
process.stdin.on('data', chunk => {
  if (closing) return;
  let start = 0;
  for (let end = 0; end <= chunk.length; end++) {
    if (end !== chunk.length && chunk[end] !== 10) continue;
    const part = chunk.subarray(start, end);
    if (!dropping) {
      if (line.length + part.length > MAX_LINE_BYTES) {
        line = Buffer.alloc(0); dropping = true;
        error(null, -32700, 'Mensagem excede o limite de 64 KiB.');
      } else if (part.length) line = line.length ? Buffer.concat([line, part]) : Buffer.from(part);
    }
    if (end < chunk.length) {
      if (!dropping) receive(line);
      line = Buffer.alloc(0); dropping = false;
    }
    start = end + 1;
  }
});
function shutdown() {
  if (closing) return;
  closing = true;
  line = Buffer.alloc(0);
  for (const call of active.values()) { call.cancelled = true; call.controller.abort(); }
  process.stdin.destroy();
  process.exitCode = 0;
}
process.stdin.on('end', shutdown);
process.stdin.on('error', shutdown);
process.stdout.on('drain', () => { if (!closing) process.stdin.resume(); });
process.stdout.on('error', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
