import net from 'node:net';
import path from 'node:path';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { BridgeError, bridgeDataDir, bridgeTimeout, MAX_BRIDGE_BYTES, validBridgeId, validateBridgeCall, readBridgeMetadata } from '../../plugins/jarvis-ultron/bridge.mjs';
export { bridgeCall, BridgeError, normalizeWebsiteUrl } from '../../plugins/jarvis-ultron/bridge.mjs';

const CACHE_LIMIT = 256;
const metadataEffects = new Map();
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const encode = value => Buffer.from(JSON.stringify(value) + '\n');
async function metadataEffect(directory, effect) {
  const key = process.platform === 'win32' ? directory.toLowerCase() : directory;
  const previous = metadataEffects.get(key) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(effect);
  metadataEffects.set(key, pending);
  try { return await pending; } finally { if (metadataEffects.get(key) === pending) metadataEffects.delete(key); }
}

/** Opt-in bridge: randomized local pipe, private rotating capability and bounded operations. */
export async function createUltronBridge({ dataDir, handle } = {}) {
  if (typeof handle !== 'function') throw new BridgeError('INVALID');
  const directory = bridgeDataDir(dataDir), nonce = randomBytes(16).toString('hex'), token = randomBytes(32).toString('hex');
  const pipe = process.platform === 'win32' ? `\\\\.\\pipe\\gleyson-jarvis-${nonce}` : path.join(directory, `ultron-${nonce}.sock`);
  const metadataPath = path.join(directory, 'ultron-bridge.json'), tempPath = `${metadataPath}.${nonce}.tmp`;
  const sockets = new Set(), entries = new Map();
  let closed = false, active = 0, closePromise;
  await mkdir(directory, { recursive: true, mode: 0o700 }).catch(() => { throw new BridgeError('UNAVAILABLE'); });

  function response(socket, id, value) {
    if (closed || socket.destroyed) return;
    let payload;
    try { payload = encode({ id, ...value }); } catch { payload = encode({ id, error: { code: 'FAILED', message: new BridgeError().message } }); }
    if (payload.length > MAX_BRIDGE_BYTES) payload = encode({ id, error: { code: 'FAILED', message: new BridgeError().message } });
    socket.end(payload, () => socket.destroy());
  }
  function fail(socket, id, code) { const error = new BridgeError(code); response(socket, id, { error: { code: error.code, message: error.message } }); }

  const server = net.createServer(socket => {
    if (closed || sockets.size >= 12) { socket.destroy(); return; }
    sockets.add(socket);
    let buffer = Buffer.alloc(0), accepted = false, entry;
    const timer = setTimeout(() => socket.destroy(), 30_000);
    socket.on('error', () => {});
    socket.on('close', () => {
      clearTimeout(timer); sockets.delete(socket);
      if (entry) {
        entry.clients.delete(socket);
        if (!entry.finished && !entry.clients.size) entry.controller.abort();
      }
    });
    socket.on('data', chunk => {
      if (accepted) { socket.destroy(); return; }
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > MAX_BRIDGE_BYTES) { accepted = true; fail(socket, null, 'INVALID'); return; }
      const newline = buffer.indexOf(10);
      if (newline < 0) return;
      accepted = true; clearTimeout(timer);
      let request;
      try {
        if (buffer.subarray(newline + 1).length) throw new BridgeError('INVALID');
        request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, newline)));
        if (!plain(request) || Object.keys(request).sort().join(',') !== 'args,id,method,token,version' || request.version !== 1 || !validBridgeId(request.id)) throw new BridgeError('INVALID');
        if (typeof request.token !== 'string' || !/^[a-f0-9]{64}$/.test(request.token) || !timingSafeEqual(Buffer.from(request.token, 'hex'), Buffer.from(token, 'hex'))) throw new BridgeError('AUTH');
        request.args = validateBridgeCall(request.method, request.args);
      } catch (error) { fail(socket, validBridgeId(request?.id) ? request.id : null, error instanceof BridgeError ? error.code : 'INVALID'); return; }
      const signature = createHash('sha256').update(JSON.stringify([request.method, request.args])).digest('hex');
      const previous = entries.get(request.id);
      if (previous && previous.signature !== signature) { fail(socket, request.id, 'INVALID'); return; }
      if (!previous && active >= 4) { fail(socket, request.id, 'BUSY'); return; }
      if (previous) {
        if (previous.controller.signal.aborted) { fail(socket, request.id, 'CANCELLED'); return; }
        entry = previous; entry.clients.add(socket);
        if (entry.finished) response(socket, request.id, entry.value);
        return;
      }
      while (entries.size >= CACHE_LIMIT) {
        const completed = [...entries].find(([, value]) => value.finished);
        if (!completed) { fail(socket, request.id, 'BUSY'); return; }
        entries.delete(completed[0]);
      }
      entry = { signature, clients: new Set([socket]), controller: new AbortController(), finished: false };
      entries.set(request.id, entry); active++;
      const current = entry, deadline = setTimeout(() => {
        current.controller.abort(); for (const client of current.clients) client.destroy();
      }, bridgeTimeout(request.method));
      // The broker passes a detached validated value, never a caller-owned object.
      void Promise.resolve().then(() => {
        if (current.controller.signal.aborted || closed) throw new BridgeError('CANCELLED');
        return handle(request.method, request.args, { signal: current.controller.signal, id: request.id });
      }).then(result => {
        if (result === undefined) throw new BridgeError('FAILED');
        const serialized = encode({ id: request.id, result });
        if (serialized.length > MAX_BRIDGE_BYTES) throw new BridgeError('FAILED');
        // Round-tripping also detaches the cache from mutable handler results.
        current.value = { result: JSON.parse(serialized.toString('utf8')).result };
      }).catch(error => {
        const safe = new BridgeError(error instanceof BridgeError ? error.code : 'FAILED');
        current.value = { error: { code: safe.code, message: safe.message } };
      }).finally(() => {
        clearTimeout(deadline); active--; current.finished = true;
        if (closed || current.controller.signal.aborted) { current.value = { error: { code: 'CANCELLED', message: new BridgeError('CANCELLED').message } }; return; }
        for (const client of current.clients) response(client, request.id, current.value);
      });
    });
  });

  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen({ path: pipe, exclusive: true, readableAll: false, writableAll: false }, () => { server.removeListener('error', reject); resolve(); }); });
    const file = await open(tempPath, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify({ version: 1, pipe, token })); } finally { await file.close(); }
    await metadataEffect(directory, () => rename(tempPath, metadataPath));
  } catch {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => { if (server.listening) server.close(resolve); else resolve(); });
    await unlink(tempPath).catch(() => {});
    throw new BridgeError('UNAVAILABLE');
  }
  server.on('error', () => { void close(); });

  function close() {
    if (closePromise) return closePromise;
    closed = true;
    for (const entry of entries.values()) entry.controller.abort();
    for (const socket of sockets) socket.destroy();
    closePromise = (async () => {
      await new Promise(resolve => server.close(resolve));
      // Another enabled profile may already have rotated the discovery file.
      await metadataEffect(directory, async () => {
        try { const metadata = await readBridgeMetadata(directory); if (metadata.pipe === pipe && metadata.token === token) await unlink(metadataPath); } catch { /* Missing/rotated metadata must not prevent shutdown. */ }
      });
      entries.clear();
    })();
    return closePromise;
  }
  return Object.freeze({ close });
}
