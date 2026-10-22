import net from 'node:net';
import path from 'node:path';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export const MAX_BRIDGE_BYTES = 64 * 1024;
const MESSAGES = Object.freeze({
  NOT_RUNNING: 'Abra o Jarvis e ative a conexão local com o Ultron.',
  INVALID: 'A solicitação ou a conexão local não é válida.',
  AUTH: 'A autorização local expirou. Reconecte o Ultron ao Jarvis.',
  UNAVAILABLE: 'A conexão local com o Jarvis não está disponível.',
  BUSY: 'O Jarvis está ocupado. Aguarde antes de tentar novamente.',
  TIMEOUT: 'O Jarvis não concluiu a solicitação dentro do tempo permitido.',
  CANCELLED: 'A solicitação ao Jarvis foi cancelada.',
  FAILED: 'O Jarvis não conseguiu concluir esta solicitação.',
});

export class BridgeError extends Error {
  constructor(code = 'FAILED') { super(MESSAGES[code] ?? MESSAGES.FAILED); this.name = 'BridgeError'; this.code = Object.hasOwn(MESSAGES, code) ? code : 'FAILED'; }
}
export const bridgeTimeout = method => method === 'speak' ? 110_000 : 30_000;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
export const validBridgeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

/** Website destinations only; no credentials, paths disguised as schemes or shell protocols. */
export function normalizeWebsiteUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\u0000-\u0020\u007f\s\\]/u.test(value)) throw new BridgeError('INVALID');
  try {
    const scheme = /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value);
    const hostPort = /^(?:[^/?#:\s]+\.[^/?#:\s]+|localhost|\[[a-fA-F0-9:.]+\]):\d+(?:[/?#]|$)/i.test(value);
    let destination;
    if (scheme && !hostPort) {
      if (!/^https?:\/\//i.test(value)) throw new BridgeError('INVALID');
      destination = value;
    } else destination = value.startsWith('//') ? `https:${value}` : `https://${value}`;
    const parsed = new URL(destination);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || /^[^/]*@/.test(destination.slice(destination.indexOf('://') + 3))) throw new BridgeError('INVALID');
    const hostname = parsed.hostname, address = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
    const domain = hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
    if (!net.isIP(address) && (!domain || domain.length > 253 || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))) throw new BridgeError('INVALID');
    if (parsed.href.length > 2048) throw new BridgeError('INVALID');
    return parsed.href;
  } catch { throw new BridgeError('INVALID'); }
}

/** The plugin has no general tool, filesystem, shell, microphone or camera endpoint. */
export function validateBridgeCall(method, args) {
  if (!['status', 'weather', 'open_browser', 'open_url', 'speak'].includes(method) || !plain(args)) throw new BridgeError('INVALID');
  const keys = Object.keys(args);
  if (method === 'open_url') {
    if (keys.length !== 1 || keys[0] !== 'url') throw new BridgeError('INVALID');
    return { url: normalizeWebsiteUrl(args.url) };
  }
  if (method === 'speak') {
    if (keys.length !== 1 || keys[0] !== 'text' || typeof args.text !== 'string' || !args.text.trim() || args.text.length > 600 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(args.text)) throw new BridgeError('INVALID');
    return { text: args.text };
  }
  if (keys.length) throw new BridgeError('INVALID');
  return {};
}

export function bridgeDataDir(dataDir) {
  const candidate = dataDir ?? (process.env.APPDATA && path.join(process.env.APPDATA, 'Projeto GleysonSilva-Jarvis'));
  if (typeof candidate !== 'string' || !path.isAbsolute(candidate) || candidate.includes('\0')) throw new BridgeError('UNAVAILABLE');
  return path.resolve(candidate);
}

export function validBridgePipe(pipe, dataDir) {
  if (typeof pipe !== 'string') return false;
  if (process.platform === 'win32') return /^\\\\\.\\pipe\\gleyson-jarvis-[a-f0-9]{32}$/.test(pipe);
  // Unix sockets exist only for local source tests, never TCP or a remote host.
  const basename = path.basename(pipe);
  return /^ultron-[a-f0-9]{32}\.sock$/.test(basename) && pipe === path.join(bridgeDataDir(dataDir), basename);
}

export async function readBridgeMetadata(dataDir) {
  const directory = bridgeDataDir(dataDir);
  let handle;
  try {
    const filename = path.join(directory, 'ultron-bridge.json'), before = await lstat(filename);
    if (!before.isFile() || before.isSymbolicLink()) throw new BridgeError('INVALID');
    handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.ino !== before.ino || stat.dev !== before.dev || stat.size > 4096 || (process.platform !== 'win32' && ((stat.mode & 0o077) || stat.uid !== process.getuid()))) throw new BridgeError('INVALID');
    const buffer = Buffer.alloc(4097), { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 4096) throw new BridgeError('INVALID');
    const metadata = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, bytesRead)));
    if (!plain(metadata) || Object.keys(metadata).sort().join(',') !== 'pipe,token,version' || metadata.version !== 1 || !/^[a-f0-9]{64}$/.test(metadata.token) || !validBridgePipe(metadata.pipe, directory)) throw new BridgeError('INVALID');
    return metadata;
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    throw new BridgeError(error?.code === 'ENOENT' ? 'NOT_RUNNING' : 'INVALID');
  } finally { await handle?.close().catch(() => {}); }
}

/** One authenticated, bounded local IPC exchange. No automatic replay of effects. */
export async function bridgeCall({ dataDir, method, args = {}, signal, requestId = randomUUID() } = {}) {
  if (signal?.aborted) throw new BridgeError('CANCELLED');
  const input = validateBridgeCall(method, args);
  if (!validBridgeId(requestId)) throw new BridgeError('INVALID');
  const metadata = await readBridgeMetadata(dataDir);
  if (signal?.aborted) throw new BridgeError('CANCELLED');
  const payload = Buffer.from(JSON.stringify({ version: 1, id: requestId, token: metadata.token, method, args: input }) + '\n');
  if (payload.length > MAX_BRIDGE_BYTES) throw new BridgeError('INVALID');
  return new Promise((resolve, reject) => {
    let complete = false, buffer = Buffer.alloc(0);
    let socket;
    try { socket = net.createConnection({ path: metadata.pipe }); }
    catch { reject(new BridgeError('UNAVAILABLE')); return; }
    const finish = (error, value) => {
      if (complete) return;
      complete = true; clearTimeout(timer); signal?.removeEventListener('abort', aborted); socket.destroy();
      error ? reject(error) : resolve(value);
    };
    const aborted = () => finish(new BridgeError('CANCELLED'));
    const timer = setTimeout(() => finish(new BridgeError('TIMEOUT')), bridgeTimeout(method));
    signal?.addEventListener('abort', aborted, { once: true });
    socket.on('connect', () => { if (!complete) socket.write(payload); });
    socket.on('data', chunk => {
      if (complete) return;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_BRIDGE_BYTES) { finish(new BridgeError('INVALID')); return; }
      const newline = buffer.indexOf(10);
      if (newline < 0) return;
      try {
        if (buffer.subarray(newline + 1).length) throw new BridgeError('INVALID');
        const response = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, newline)));
        if (!plain(response) || response.id !== requestId || Object.keys(response).some(key => !['id', 'result', 'error'].includes(key)) || Object.hasOwn(response, 'result') === Object.hasOwn(response, 'error')) throw new BridgeError('INVALID');
        if (Object.hasOwn(response, 'error')) throw new BridgeError(response.error?.code);
        finish(null, response.result);
      } catch (error) { finish(error instanceof BridgeError ? error : new BridgeError('INVALID')); }
    });
    socket.on('error', () => finish(new BridgeError('UNAVAILABLE')));
    socket.on('close', () => { if (!complete) finish(new BridgeError('UNAVAILABLE')); });
    if (signal?.aborted) aborted();
  });
}
