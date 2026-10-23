import { connect } from 'node:net';
import { constants, createPrivateKey, createPublicKey, generateKeyPairSync, privateEncrypt } from 'node:crypto';

// Independent interoperability implementation of the AOSP ADB wire/auth formats:
// https://android.googlesource.com/platform/system/adb/+/refs/heads/main/protocol.txt
// https://android.googlesource.com/platform/packages/modules/adb/+/HEAD/client/auth.cpp
// https://android.googlesource.com/platform/system/core/+/refs/heads/main/libcrypto_utils/android_pubkey.cpp
// No adb server, subprocess, default adb key, SDK, or external package is used.
const PORT = 5555, MAX_PACKET = 1024 * 1024, VERSION = 0x01000000;
const COMMANDS = Object.freeze({ CNXN: 0x4e584e43, AUTH: 0x48545541, OPEN: 0x4e45504f, OKAY: 0x59414b4f, CLSE: 0x45534c43, WRTE: 0x45545257 });
const COMMAND_VALUES = new Set(Object.values(COMMANDS));
export const FIRE_TV_ACTIONS = Object.freeze(['home', 'back', 'up', 'down', 'left', 'right', 'ok', 'volume_up', 'volume_down', 'mute', 'play', 'pause']);
const KEYS = Object.freeze({ home: 3, back: 4, up: 19, down: 20, left: 21, right: 22, ok: 23, volume_up: 24, volume_down: 25, mute: 164, play: 126, pause: 127 });
export const FIRE_TV_APPS = Object.freeze({
  netflix: Object.freeze({ label: 'Netflix', packages: Object.freeze(['com.netflix.ninja', 'com.netflix.mediaclient']) }),
  prime_video: Object.freeze({ label: 'Prime Video', packages: Object.freeze(['com.amazon.firebat', 'com.amazon.avod.thirdpartyclient', 'com.amazon.avod']) }),
  youtube: Object.freeze({ label: 'YouTube', packages: Object.freeze(['com.amazon.firetv.youtube', 'com.google.android.youtube.tv']) }),
  disney_plus: Object.freeze({ label: 'Disney+', packages: Object.freeze(['com.disney.disneyplus']) }),
  max: Object.freeze({ label: 'Max', packages: Object.freeze(['com.wbd.stream', 'com.hbo.hbonow', 'com.hbo.hbogo']) }),
  spotify: Object.freeze({ label: 'Spotify', packages: Object.freeze(['com.spotify.tv.android', 'com.spotify.music']) }),
});
const MESSAGES = Object.freeze({
  INVALID: 'Informe um IP privado válido da Fire TV e um comando disponível.',
  DISABLED: 'Ative a conexão com a Fire TV nos Ajustes.',
  NOT_PAIRED: 'Conecte e autorize a Fire TV nos Ajustes antes de usar o controle.',
  APPROVAL_REQUIRED: 'A Fire TV ainda aguarda a autorização deste Jarvis na tela da televisão. Confira a TV e tente conectar novamente.',
  AUTH: 'A Fire TV não autorizou a chave deste Jarvis. Use Parear TV nos Ajustes e aprove na televisão.',
  TIMEOUT: 'A Fire TV não confirmou a operação a tempo. Confira a televisão antes de repetir o comando.',
  CANCELLED: 'A operação da Fire TV foi interrompida.',
  UNAVAILABLE: 'Não foi possível confirmar a operação na Fire TV. Confira a televisão antes de repetir o comando.',
  PROTOCOL: 'A conexão da Fire TV retornou dados inválidos e foi encerrada.',
  APP_NOT_INSTALLED: 'Este aplicativo não foi encontrado entre os aplicativos instalados na Fire TV.',
});
export class FireTVError extends Error {
  constructor(code = 'UNAVAILABLE') { const safeCode = Object.hasOwn(MESSAGES, code) ? code : 'UNAVAILABLE'; super(MESSAGES[safeCode]); this.name = 'FireTVError'; this.code = safeCode; }
}
export function validateFireTvHost(host) {
  if (typeof host !== 'string' || !/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(host)) return false;
  const parts = host.split('.').map(Number);
  return parts.every(part => part <= 255) && (parts[0] === 10 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 192 && parts[1] === 168);
}
const sameConfig = (a, b) => a?.enabled === true && b?.enabled === true && a.host === b.host && a.profileId === b.profileId;
const safeError = error => error instanceof FireTVError ? error : new FireTVError('UNAVAILABLE');
function validConfig(config) {
  if (config?.enabled !== true) throw new FireTVError('DISABLED');
  if (!validateFireTvHost(config.host) || typeof config.profileId !== 'string' || !config.profileId || config.profileId.length > 128) throw new FireTVError('INVALID');
  return { enabled: true, host: config.host, profileId: config.profileId };
}
function checksum(data) { let sum = 0; for (const byte of data) sum = (sum + byte) >>> 0; return sum; }
function packet(command, arg0 = 0, arg1 = 0, payload = Buffer.alloc(0)) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf8'), header = Buffer.alloc(24);
  header.writeUInt32LE(COMMANDS[command], 0); header.writeUInt32LE(arg0, 4); header.writeUInt32LE(arg1, 8); header.writeUInt32LE(data.length, 12);
  header.writeUInt32LE(checksum(data), 16); header.writeUInt32LE((COMMANDS[command] ^ 0xffffffff) >>> 0, 20);
  return Buffer.concat([header, data]);
}
function keyObject(record, config) {
  if (!record || record.host !== config.host || record.profileId !== config.profileId || typeof record.privateKey !== 'string' || record.privateKey.length > 4096) return null;
  try {
    const key = createPrivateKey(record.privateKey);
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails?.modulusLength !== 2048 || key.asymmetricKeyDetails?.publicExponent !== 65537n) return null;
    return key;
  } catch { return null; }
}
function littleEndian(value, length) {
  const data = Buffer.alloc(length);
  for (let index = 0; index < length; index++) { data[index] = Number(value & 255n); value >>= 8n; }
  return data;
}
function publicPayload(key) {
  const jwk = createPublicKey(key).export({ format: 'jwk' }), modulus = Buffer.from(jwk.n, 'base64url');
  const n = BigInt(`0x${modulus.toString('hex')}`), word = n & 0xffffffffn, mask = 0xffffffffn;
  // Newton inversion modulo 2^32 for an odd RSA modulus; R^2 = 2^4096 mod n.
  let inverse = 1n; for (let index = 0; index < 5; index++) inverse = (inverse * (2n - word * inverse)) & mask;
  const data = Buffer.alloc(524); data.writeUInt32LE(64, 0); data.writeUInt32LE(Number((-inverse) & mask), 4);
  littleEndian(n, 256).copy(data, 8); littleEndian((1n << 4096n) % n, 256).copy(data, 264); data.writeUInt32LE(65537, 520);
  // A fixed comment avoids transmitting this computer's user name or host name.
  return `${data.toString('base64')} jarvis@local\0`;
}
function signature(key, token) {
  // ADB's token already IS the SHA-1 digest: RSA_sign(NID_sha1, token, 20).
  // crypto.sign('sha1', token) would incorrectly hash the token a second time.
  const digestInfo = Buffer.concat([Buffer.from('3021300906052b0e03021a05000414', 'hex'), token]);
  return privateEncrypt({ key, padding: constants.RSA_PKCS1_PADDING }, digestInfo);
}

class AdbTransport {
  #socket; #assert; #signal; #failed; #waiter; #packets = []; #queuedBytes = 0;
  #header = Buffer.alloc(24); #headerBytes = 0; #incoming; #payloadBytes = 0; #readyResolve; #readyReject; #onAbort;
  constructor({ socketFactory, config, assert, signal }) {
    this.#assert = assert; this.#signal = signal;
    this.ready = new Promise((resolve, reject) => { this.#readyResolve = resolve; this.#readyReject = reject; });
    // Attach a rejection handler immediately; a failed socket can precede await ready.
    this.ready.catch(() => {});
    try { this.#socket = socketFactory({ host: config.host, port: PORT, family: 4 }); }
    catch { this.#fail(new FireTVError('UNAVAILABLE')); return; }
    if (!this.#socket || typeof this.#socket.on !== 'function' || typeof this.#socket.write !== 'function' || typeof this.#socket.destroy !== 'function') { this.#fail(new FireTVError('UNAVAILABLE')); return; }
    this.#socket.on('connect', () => this.#readyResolve());
    this.#socket.on('data', data => this.#data(data));
    this.#socket.on('error', () => this.#fail(new FireTVError('UNAVAILABLE')));
    this.#socket.on('end', () => this.#fail(new FireTVError('UNAVAILABLE')));
    this.#socket.on('close', () => this.#fail(new FireTVError('UNAVAILABLE')));
    this.#onAbort = () => this.#fail(safeError(this.#signal.reason));
    signal.addEventListener('abort', this.#onAbort, { once: true });
    if (signal.aborted) this.#onAbort();
    else if (this.#socket.readyState === 'open') this.#readyResolve();
    this.#socket.setNoDelay?.(true);
  }
  #fail(error) {
    if (this.#failed) return;
    this.#failed = safeError(error); this.#readyReject(this.#failed);
    this.#waiter?.reject(this.#failed); this.#waiter = undefined; this.#packets = []; this.#queuedBytes = 0; this.#incoming = undefined;
    this.#socket?.destroy?.();
  }
  #deliver(value) {
    if (this.#waiter) { const waiter = this.#waiter; this.#waiter = undefined; waiter.resolve(value); return; }
    if (this.#packets.length >= 64 || this.#queuedBytes + value.payload.length > MAX_PACKET) { this.#fail(new FireTVError('PROTOCOL')); return; }
    this.#packets.push(value); this.#queuedBytes += value.payload.length;
  }
  #data(chunk) {
    if (this.#failed) return;
    if (!Buffer.isBuffer(chunk)) { this.#fail(new FireTVError('PROTOCOL')); return; }
    let offset = 0;
    // Incremental copies bound retained input even when a peer fragments a header,
    // concatenates packets, or announces a malicious payload length.
    while (offset < chunk.length && !this.#failed) {
      if (!this.#incoming) {
        const count = Math.min(24 - this.#headerBytes, chunk.length - offset);
        chunk.copy(this.#header, this.#headerBytes, offset, offset + count); this.#headerBytes += count; offset += count;
        if (this.#headerBytes !== 24) continue;
        const command = this.#header.readUInt32LE(0), length = this.#header.readUInt32LE(12);
        if (!COMMAND_VALUES.has(command) || this.#header.readUInt32LE(20) !== ((command ^ 0xffffffff) >>> 0) || length > MAX_PACKET) { this.#fail(new FireTVError('PROTOCOL')); return; }
        this.#incoming = { command, arg0: this.#header.readUInt32LE(4), arg1: this.#header.readUInt32LE(8), expectedChecksum: this.#header.readUInt32LE(16), payload: Buffer.alloc(length) };
        this.#payloadBytes = 0; this.#headerBytes = 0;
      }
      const incoming = this.#incoming, count = Math.min(incoming.payload.length - this.#payloadBytes, chunk.length - offset);
      chunk.copy(incoming.payload, this.#payloadBytes, offset, offset + count); this.#payloadBytes += count; offset += count;
      if (this.#payloadBytes !== incoming.payload.length) continue;
      this.#incoming = undefined;
      if (checksum(incoming.payload) !== incoming.expectedChecksum) { this.#fail(new FireTVError('PROTOCOL')); return; }
      this.#deliver(incoming);
    }
  }
  async send(command, arg0 = 0, arg1 = 0, payload) {
    await this.#assert();
    if (this.#failed) throw this.#failed;
    try { this.#socket.write(packet(command, arg0, arg1, payload)); }
    catch { this.#fail(new FireTVError('UNAVAILABLE')); throw this.#failed; }
  }
  async read() {
    await this.#assert();
    if (this.#failed) throw this.#failed;
    const value = this.#packets.shift();
    if (value) { this.#queuedBytes -= value.payload.length; return value; }
    if (this.#waiter) throw new FireTVError('PROTOCOL');
    return new Promise((resolve, reject) => { this.#waiter = { resolve, reject }; });
  }
  close() { if (this.#onAbort) this.#signal.removeEventListener('abort', this.#onAbort); this.#fail(new FireTVError('CANCELLED')); }
}

export class FireTVController {
  #getConfig; #getKeyRecord; #setKeyRecord; #onEvent; #socketFactory; #timeoutMs; #pairTimeoutMs;
  #generation = 0; #tail = Promise.resolve(); #scopes = new Set();
  constructor({ getConfig, getKeyRecord, setKeyRecord, onEvent = () => {}, socketFactory = options => connect(options), timeoutMs = 10000, pairTimeoutMs = 30000 } = {}) {
    if ([getConfig, getKeyRecord, setKeyRecord, socketFactory, onEvent].some(value => typeof value !== 'function') || !Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(pairTimeoutMs) || pairTimeoutMs <= 0) throw new TypeError('FireTVController requires configuration and private key callbacks.');
    this.#getConfig = getConfig; this.#getKeyRecord = getKeyRecord; this.#setKeyRecord = setKeyRecord; this.#onEvent = onEvent; this.#socketFactory = socketFactory; this.#timeoutMs = timeoutMs; this.#pairTimeoutMs = pairTimeoutMs;
  }
  reset() { this.#generation++; for (const scope of this.#scopes) scope.abort.abort(new FireTVError('CANCELLED')); }
  async #assert(scope) {
    if (scope.deadline && Date.now() >= scope.deadline && !scope.abort.signal.aborted) scope.abort.abort(new FireTVError(scope.approval ? 'APPROVAL_REQUIRED' : 'TIMEOUT'));
    if (scope.generation !== this.#generation || scope.abort.signal.aborted) throw safeError(scope.abort.signal.reason ?? new FireTVError('CANCELLED'));
    const current = validConfig(await this.#getConfig());
    if (scope.generation !== this.#generation || scope.abort.signal.aborted || scope.config && !sameConfig(scope.config, current)) throw new FireTVError('CANCELLED');
    return current;
  }
  #run(options, pairing, operation) {
    const scope = { generation: this.#generation, abort: new AbortController(), config: undefined, transport: undefined, timer: undefined, approval: false };
    const abort = () => scope.abort.abort(new FireTVError('CANCELLED'));
    if (options?.signal?.aborted) abort(); else options?.signal?.addEventListener('abort', abort, { once: true });
    this.#scopes.add(scope);
    const task = this.#tail.catch(() => {}).then(async () => {
      scope.config = await this.#assert(scope);
      const timeout = pairing ? this.#pairTimeoutMs : this.#timeoutMs;
      scope.deadline = Date.now() + timeout;
      scope.timer = setTimeout(() => scope.abort.abort(new FireTVError(scope.approval ? 'APPROVAL_REQUIRED' : 'TIMEOUT')), timeout);
      let record = await this.#getKeyRecord(), key = keyObject(record, scope.config);
      await this.#assert(scope);
      if (pairing && !key) {
        const generated = generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 65537, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
        record = { ...scope.config, privateKey: generated.privateKey, paired: false }; delete record.enabled;
        key = keyObject(record, scope.config);
        await this.#assert(scope); await this.#setKeyRecord(record); await this.#assert(scope);
      }
      if (!key || !pairing && record?.paired !== true) throw new FireTVError('NOT_PAIRED');
      await this.#assert(scope);
      scope.transport = new AdbTransport({ socketFactory: this.#socketFactory, config: scope.config, assert: () => this.#assert(scope), signal: scope.abort.signal });
      await scope.transport.ready; await this.#handshake(scope, key, pairing);
      await this.#assert(scope);
      if (pairing) {
        await this.#setKeyRecord({ host: scope.config.host, profileId: scope.config.profileId, privateKey: record.privateKey, paired: true });
        await this.#assert(scope);
      }
      const result = await operation(scope); await this.#assert(scope); return result;
    }).catch(error => { const safe = safeError(error); throw scope.approval && safe.code === 'UNAVAILABLE' ? new FireTVError('AUTH') : safe; }).finally(() => {
      clearTimeout(scope.timer); scope.transport?.close(); options?.signal?.removeEventListener('abort', abort); this.#scopes.delete(scope);
    });
    this.#tail = task.catch(() => {});
    let onAbort;
    const cancelled = new Promise((_, reject) => {
      onAbort = () => reject(safeError(scope.abort.signal.reason));
      if (scope.abort.signal.aborted) onAbort(); else scope.abort.signal.addEventListener('abort', onAbort, { once: true });
    });
    return Promise.race([task, cancelled]).finally(() => scope.abort.signal.removeEventListener('abort', onAbort));
  }
  async #handshake(scope, key, pairing) {
    const connection = scope.transport; await connection.send('CNXN', VERSION, 256 * 1024, 'host::jarvis\0');
    let signed = false, publicSent = false;
    for (;;) {
      const message = await connection.read(); await this.#assert(scope);
      if (message.command === COMMANDS.CNXN) {
        // A modern daemon advertises its maximum version here. Our initial
        // VERSION 0x01000000 keeps checksums required by the negotiated minimum.
        if (!signed || ![VERSION, VERSION + 1].includes(message.arg0) || message.arg1 < 4096 || message.arg1 > MAX_PACKET || message.payload.length > 4096) throw new FireTVError('AUTH');
        return;
      }
      if (message.command !== COMMANDS.AUTH || message.arg0 !== 1 || message.arg1 !== 0 || message.payload.length !== 20) throw new FireTVError('PROTOCOL');
      if (!signed) { signed = true; await connection.send('AUTH', 2, 0, signature(key, message.payload)); continue; }
      if (!pairing || publicSent) throw new FireTVError('AUTH');
      publicSent = true; scope.approval = true; await connection.send('AUTH', 3, 0, publicPayload(key));
      try { this.#onEvent({ type: 'approval_required' }); } catch { /* Notification failures cannot expose raw ADB state. */ }
    }
  }
  async #shell(scope, command, maxOutput = 16384) {
    const connection = scope.transport, localId = (scope.nextId = (scope.nextId ?? 0) + 1);
    await connection.send('OPEN', localId, 0, `shell:${command}\0`);
    let message = await this.#readShell(scope);
    if (message.command === COMMANDS.CLSE && message.arg1 === localId && message.payload.length === 0) throw new FireTVError('UNAVAILABLE');
    if (message.command !== COMMANDS.OKAY || !message.arg0 || message.arg1 !== localId || message.payload.length) throw new FireTVError('PROTOCOL');
    const remoteId = message.arg0, output = []; let size = 0;
    for (;;) {
      message = await this.#readShell(scope);
      if (message.arg0 !== remoteId || message.arg1 !== localId) throw new FireTVError('PROTOCOL');
      if (message.command === COMMANDS.CLSE && message.payload.length === 0) {
        // Some adbd implementations echo the close acknowledgement after the
        // next stream has opened. Remember only exact pairs already closed here.
        scope.closedStreams ??= new Set();
        if (scope.closedStreams.size >= 16) throw new FireTVError('PROTOCOL');
        scope.closedStreams.add(`${remoteId}:${localId}`);
        await connection.send('CLSE', localId, remoteId);
        return Buffer.concat(output, size).toString('utf8');
      }
      if (message.command !== COMMANDS.WRTE || (size += message.payload.length) > maxOutput) throw new FireTVError('PROTOCOL');
      output.push(message.payload); await connection.send('OKAY', localId, remoteId);
    }
  }
  async #readShell(scope) {
    for (;;) {
      const message = await scope.transport.read();
      if (message.command !== COMMANDS.CLSE || message.payload.length !== 0 || !scope.closedStreams?.has(`${message.arg0}:${message.arg1}`)) return message;
      // A duplicate cannot carry output, create a stream, change ids, or extend
      // the operation's deadline. Bound even a peer repeatedly echoing CLSE.
      scope.duplicateCloses = (scope.duplicateCloses ?? 0) + 1;
      if (scope.duplicateCloses > 64) throw new FireTVError('PROTOCOL');
    }
  }
  pair(options = {}) { return this.#run(options, true, async () => ({ ok: true, paired: true, summary: 'Fire TV conectada e autorizada para este perfil.' })); }
  status(options = {}) {
    return this.#run(options, false, async scope => {
      const properties = {};
      for (const [field, property] of [['model', 'ro.product.model'], ['brand', 'ro.product.brand'], ['reportedVersionName', 'ro.build.version.name']]) {
        const value = await this.#shell(scope, `getprop ${property}`, 1024);
        properties[field] = value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
      }
      return { ok: true, connected: true, paired: true, properties, summary: 'Fire TV conectada. Identificação básica consultada.' };
    });
  }
  control(action, options = {}) {
    if (typeof action !== 'string' || !Object.hasOwn(KEYS, action)) return Promise.reject(new FireTVError('INVALID'));
    return this.#run(options, false, async scope => {
      const output = await this.#shell(scope, `input keyevent ${KEYS[action]}`);
      if (output.trim()) throw new FireTVError('UNAVAILABLE');
      return { ok: true, status: 'unverified', action, summary: 'Comando enviado uma vez à Fire TV. Confira o resultado na televisão.' };
    });
  }
  openApp(app, options = {}) {
    if (typeof app !== 'string' || !Object.hasOwn(FIRE_TV_APPS, app)) return Promise.reject(new FireTVError('INVALID'));
    return this.#run(options, false, async scope => {
      const output = await this.#shell(scope, 'pm list packages', 128 * 1024), observed = new Set();
      for (const line of output.split(/\r?\n/)) { const match = /^package:([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+)\s*$/.exec(line); if (match) observed.add(match[1]); }
      const packageName = FIRE_TV_APPS[app].packages.find(candidate => observed.has(candidate));
      if (!packageName) throw new FireTVError('APP_NOT_INSTALLED');
      // AOSP Monkey queues its initial activity before generating random events.
      // Count 1 consumes that launch only; --dbg-no-events would skip it as well.
      const result = await this.#shell(scope, `monkey -p ${packageName} -c android.intent.category.LAUNCHER -c android.intent.category.LEANBACK_LAUNCHER 1`);
      if (!/\bEvents injected:\s*1\b/.test(result) || /(?:error|exception|aborted|no activities found)/i.test(result)) throw new FireTVError('UNAVAILABLE');
      return { ok: true, status: 'unverified', app, summary: `Solicitação para abrir ${FIRE_TV_APPS[app].label} enviada uma vez à Fire TV. Confira o resultado na televisão.` };
    });
  }
}
