import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { constants, createPublicKey, generateKeyPairSync, publicDecrypt, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { FireTVController, FireTVError, FIRE_TV_APPS, FIRE_TV_ACTIONS, validateFireTvHost } from '../apps/desktop/fire-tv.mjs';

// Every test uses an in-memory fake daemon. These freshly generated test keys
// are never written to disk and no test connects to a TV or a host adb server.
const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
const C = { CNXN: 0x4e584e43, AUTH: 0x48545541, OPEN: 0x4e45504f, OKAY: 0x59414b4f, CLSE: 0x45534c43, WRTE: 0x45545257 };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) { const end = Date.now() + 2000; while (Date.now() < end) { if (check()) return; await tick(); } assert.fail('Expected in-memory daemon state was not reached.'); }
const sum = bytes => [...bytes].reduce((total, byte) => (total + byte) >>> 0, 0);
function encode(command, arg0 = 0, arg1 = 0, payload = Buffer.alloc(0)) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload), header = Buffer.alloc(24);
  header.writeUInt32LE(C[command], 0); header.writeUInt32LE(arg0, 4); header.writeUInt32LE(arg1, 8); header.writeUInt32LE(body.length, 12); header.writeUInt32LE(sum(body), 16); header.writeUInt32LE((C[command] ^ 0xffffffff) >>> 0, 20);
  return Buffer.concat([header, body]);
}
function decode(bytes) {
  assert.equal(bytes.length, 24 + bytes.readUInt32LE(12));
  assert.equal(bytes.readUInt32LE(20), (bytes.readUInt32LE(0) ^ 0xffffffff) >>> 0);
  const payload = bytes.subarray(24); assert.equal(bytes.readUInt32LE(16), sum(payload));
  return { command: Object.keys(C).find(key => C[key] === bytes.readUInt32LE(0)), arg0: bytes.readUInt32LE(4), arg1: bytes.readUInt32LE(8), payload };
}
function asBigIntLE(bytes) { return BigInt(`0x${Buffer.from(bytes).reverse().toString('hex')}`); }
function fixture(t, options = {}) {
  let config = { enabled: true, host: '192.168.50.20', profileId: 'test-profile' };
  let record = options.noKey ? null : { host: config.host, profileId: config.profileId, privateKey, paired: options.unpaired !== true };
  const sockets = [], commands = [], events = [], saves = [], connections = [];
  class Socket extends EventEmitter {
    readyState = 'opening'; destroyed = false; token = randomBytes(20); authSignatures = 0; publicKeys = 0; streams = new Map();
    constructor() { super(); if (!options.noConnect) queueMicrotask(() => { if (!this.destroyed) { this.readyState = 'open'; this.emit('connect'); } }); }
    setNoDelay(value) { assert.equal(value, true); }
    destroy() { if (this.destroyed) return; this.destroyed = true; this.readyState = 'closed'; queueMicrotask(() => this.emit('close')); }
    data(bytes) {
      const parts = options.fragment ? [...bytes].map(byte => Buffer.from([byte])) : [bytes];
      for (const part of parts) queueMicrotask(() => { if (!this.destroyed) this.emit('data', part); });
    }
    connected() { this.data(encode('CNXN', options.remoteVersion ?? 0x01000000, 256 * 1024, 'device::features=\0')); }
    write(bytes) {
      assert.equal(this.destroyed, false); const message = decode(bytes);
      if (message.command === 'CNXN') {
        assert.equal(message.arg0, 0x01000000); assert.equal(message.payload.toString(), 'host::jarvis\0');
        if (options.silent) return;
        if (options.noAuth) { this.connected(); return; }
        let auth = encode('AUTH', options.authType ?? 1, 0, options.token ?? this.token);
        if (options.corruptMagic) auth.writeUInt32LE(0, 20);
        if (options.corruptChecksum) auth.writeUInt32LE(0, 16);
        if (options.hugePacket) auth.writeUInt32LE(1024 * 1024 + 1, 12);
        if (options.unknownCommand) { auth.writeUInt32LE(0x11111111, 0); auth.writeUInt32LE(0xeeeeeeee, 20); }
        this.data(auth); return;
      }
      if (message.command === 'AUTH' && message.arg0 === 2) {
        this.authSignatures++; assert.equal(message.payload.length, 256);
        const digest = publicDecrypt({ key: createPublicKey(record.privateKey), padding: constants.RSA_PKCS1_PADDING }, message.payload);
        assert.equal(digest.toString('hex'), `3021300906052b0e03021a05000414${this.token.toString('hex')}`);
        if (options.requireApproval || options.rejectSignature) this.data(encode('AUTH', 1, 0, randomBytes(20))); else this.connected();
        return;
      }
      if (message.command === 'AUTH' && message.arg0 === 3) {
        this.publicKeys++; const wire = message.payload.toString(); assert.match(wire, /^[A-Za-z0-9+/]+=* jarvis@local\0$/);
        const key = Buffer.from(wire.split(' ')[0], 'base64'); assert.equal(key.length, 524); assert.equal(key.readUInt32LE(0), 64); assert.equal(key.readUInt32LE(520), 65537);
        const n = asBigIntLE(key.subarray(8, 264)), n0inv = BigInt(key.readUInt32LE(4));
        assert.equal(((n & 0xffffffffn) * n0inv) & 0xffffffffn, 0xffffffffn);
        assert.equal(asBigIntLE(key.subarray(264, 520)), (1n << 4096n) % n);
        const jwk = createPublicKey(record.privateKey).export({ format: 'jwk' }); assert.equal(n, BigInt(`0x${Buffer.from(jwk.n, 'base64url').toString('hex')}`));
        if (options.denyApproval) queueMicrotask(() => this.emit('end'));
        else if (options.extraChallenge) this.data(encode('AUTH', 1, 0, randomBytes(20)));
        else if (!options.holdApproval) this.connected();
        return;
      }
      if (message.command === 'OPEN') {
        assert.equal(message.arg1, 0); assert.ok(message.arg0 > 0); assert.equal(message.payload.at(-1), 0);
        const service = message.payload.subarray(0, -1).toString(); assert.ok(service.startsWith('shell:')); const command = service.slice(6); commands.push(command);
        options.onCommand?.(command, { setConfig: value => { config = value; }, socket: this });
        if (options.eofOnCommand) { queueMicrotask(() => this.emit('end')); return; }
        if (options.holdCommand?.(command)) return;
        if (options.rejectOpen) { this.data(encode('CLSE', 0, message.arg0)); return; }
        const remoteId = 40 + message.arg0;
        let output = options.outputs?.[command] ?? (command === 'pm list packages' ? 'package:com.netflix.ninja\npackage:com.amazon.firetv.youtube\n' : command.startsWith('monkey ') ? 'Events injected: 1\n' : command === 'getprop ro.product.model' ? 'Test TV\r\n' : command === 'getprop ro.product.brand' ? 'Hisense\r\n' : command === 'getprop ro.build.version.name' ? '8.1.8.0\r\n' : '');
        output = Buffer.from(output);
        const parts = []; for (let offset = 0; offset < output.length; offset += options.outputChunk ?? 8192) parts.push(output.subarray(offset, offset + (options.outputChunk ?? 8192)));
        this.streams.set(message.arg0, { remoteId, parts, command });
        this.data(encode('OKAY', options.wrongOkayId ? 0 : remoteId, options.wrongLocalId ? message.arg0 + 1 : message.arg0));
        this.advance(message.arg0); return;
      }
      if (message.command === 'OKAY') {
        const stream = this.streams.get(message.arg0); assert.ok(stream); assert.equal(message.arg1, stream.remoteId); assert.equal(message.payload.length, 0);
        this.advance(message.arg0); return;
      }
      if (message.command === 'CLSE') {
        const stream = this.streams.get(message.arg0); assert.ok(stream); assert.equal(message.arg1, stream.remoteId); this.streams.delete(message.arg0);
        if (options.echoClose) {
          const echo = encode(options.echoWrite ? 'WRTE' : 'CLSE', stream.remoteId + (options.echoWrongId ? 1 : 0), message.arg0, options.echoPayload ? 'unexpected payload' : '');
          for (let index = 0; index < (options.echoCount ?? 1); index++) this.data(echo);
        }
        return;
      }
      assert.fail('Client attempted an unsupported protocol operation.');
    }
    advance(localId) {
      const stream = this.streams.get(localId), part = stream.parts.shift();
      if (part) this.data(encode('WRTE', stream.remoteId + (options.wrongWriteId ? 1 : 0), localId, part));
      else { options.onOutputEnd?.(stream.command); this.data(encode('CLSE', stream.remoteId, localId)); }
    }
  }
  const controller = new FireTVController({
    getConfig: () => config, getKeyRecord: () => record,
    setKeyRecord: value => { record = { ...value }; saves.push({ paired: value.paired, host: value.host, profileId: value.profileId }); },
    onEvent: event => events.push(event), timeoutMs: options.timeoutMs ?? 1000, pairTimeoutMs: options.pairTimeoutMs ?? 1000,
    socketFactory: connection => { connections.push(connection); const socket = new Socket(); sockets.push(socket); return socket; },
  });
  t.after(() => controller.reset());
  return { controller, commands, events, saves, sockets, connections, config: () => config, setConfig: value => { config = value; }, record: () => record, setRecord: value => { record = value; } };
}
const fails = code => error => error instanceof FireTVError && error.code === code && !error.message.includes('PRIVATE KEY');

test('Fire TV permits canonical private IPv4 only and never DNS/public/loopback/ports', () => {
  for (const host of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.100']) assert.equal(validateFireTvHost(host), true);
  for (const host of ['127.0.0.1', '169.254.1.2', '172.15.0.1', '172.32.0.1', '192.169.1.2', '8.8.8.8', '0.0.0.0', 'tv.local', '192.168.1.2:5555', '192.168.01.2', '192.168.1.256', '::1', '::ffff:192.168.1.2', ' 10.0.0.1', '10.0.0.1\n', null]) assert.equal(validateFireTvHost(host), false);
});
test('Fire TV generates a private RSA2048 key only for explicit pair, authenticates, and stores paired after CNXN', async t => {
  const f = fixture(t, { noKey: true, requireApproval: true, fragment: true });
  assert.equal(f.record(), null); const result = await f.controller.pair();
  assert.deepEqual(result, { ok: true, paired: true, summary: 'Fire TV conectada e autorizada para este perfil.' });
  assert.deepEqual(f.saves.map(value => value.paired), [false, true]); assert.equal(f.sockets[0].authSignatures, 1); assert.equal(f.sockets[0].publicKeys, 1);
  assert.deepEqual(f.events, [{ type: 'approval_required' }]); assert.deepEqual(f.commands, []); assert.equal(f.sockets[0].destroyed, true);
  assert.equal(JSON.stringify(result).includes('PRIVATE KEY'), false); assert.equal(JSON.stringify(f.events).includes('PRIVATE KEY'), false);
  assert.deepEqual(f.connections.map(value => ({ port: value.port, family: value.family })), [{ port: 5555, family: 4 }]);
});
test('Fire TV explicit pair reuses a pending key instead of rotating it on every approval retry', async t => {
  const f = fixture(t, { unpaired: true, requireApproval: true }); const original = f.record().privateKey;
  await f.controller.pair(); assert.equal(f.record().privateKey === original, true); assert.deepEqual(f.saves.map(value => value.paired), [true]);
});
test('Fire TV status reads only three fixed identity properties, including fragmented packets and multiple ACKs', async t => {
  const f = fixture(t, { fragment: true, outputChunk: 2 }); const result = await f.controller.status();
  assert.deepEqual(result.properties, { model: 'Test TV', brand: 'Hisense', reportedVersionName: '8.1.8.0' });
  assert.deepEqual(f.commands, ['getprop ro.product.model', 'getprop ro.product.brand', 'getprop ro.build.version.name']); assert.deepEqual(f.events, []); assert.deepEqual(f.saves, []);
});
test('Fire TV accepts a modern daemon max version while requiring legacy checksums negotiated by this client', async t => {
  const f = fixture(t, { remoteVersion: 0x01000001 }); assert.equal((await f.controller.status()).connected, true);
});
test('Fire TV accepts a late duplicate empty CLSE for an exact completed stream between identity queries', async t => {
  const f = fixture(t, { echoClose: true }); const result = await f.controller.status();
  assert.deepEqual(result.properties, { model: 'Test TV', brand: 'Hisense', reportedVersionName: '8.1.8.0' });
  assert.deepEqual(f.commands, ['getprop ro.product.model', 'getprop ro.product.brand', 'getprop ro.build.version.name']); assert.equal(f.sockets.length, 1);
});
for (const [label, options] of [['WRTE from a closed stream', { echoWrite: true }], ['CLSE with another remote id', { echoWrongId: true }], ['CLSE carrying payload', { echoPayload: true }]]) test(`Fire TV never mistakes ${label} for a harmless duplicate`, async t => {
  const f = fixture(t, { echoClose: true, ...options }); await assert.rejects(f.controller.status(), fails('PROTOCOL')); assert.equal(f.sockets.length, 1); assert.equal(f.commands.length, 2);
});
test('Fire TV bounds repeated duplicate CLSE packets without extending its deadline', async t => {
  const f = fixture(t, { echoClose: true, echoCount: 65 }); await assert.rejects(f.controller.status(), fails('PROTOCOL')); assert.equal(f.sockets.length, 1);
});
test('Fire TV rejects a connection that never challenges its key instead of marking plaintext daemon paired', async t => {
  const f = fixture(t, { unpaired: true, noAuth: true }); await assert.rejects(f.controller.pair(), fails('AUTH')); assert.deepEqual(f.saves, []);
});
for (const operation of ['status', 'control', 'openApp']) test(`Fire TV ${operation} never generates or offers a public key without explicit pair`, async t => {
  const f = fixture(t, { noKey: true });
  const promise = operation === 'control' ? f.controller.control('home') : operation === 'openApp' ? f.controller.openApp('netflix') : f.controller.status();
  await assert.rejects(promise, fails('NOT_PAIRED')); assert.equal(f.sockets.length, 0); assert.deepEqual(f.saves, []);
});
test('Fire TV normal operation rejects a revoked key without sending a new approval request', async t => {
  const f = fixture(t, { rejectSignature: true }); await assert.rejects(f.controller.control('home'), fails('AUTH'));
  assert.equal(f.sockets[0].authSignatures, 1); assert.equal(f.sockets[0].publicKeys, 0); assert.deepEqual(f.events, []); assert.deepEqual(f.commands, []);
});
test('Fire TV pending approval expires once, closes the socket, and never marks the key paired', async t => {
  const f = fixture(t, { unpaired: true, requireApproval: true, holdApproval: true, pairTimeoutMs: 40 });
  await assert.rejects(f.controller.pair(), fails('APPROVAL_REQUIRED')); assert.deepEqual(f.events, [{ type: 'approval_required' }]); assert.deepEqual(f.saves, []); assert.equal(f.record().paired, false); assert.equal(f.sockets[0].destroyed, true);
});
test('Fire TV abort while awaiting on-screen approval is immediate and no app command is sent', async t => {
  const f = fixture(t, { unpaired: true, requireApproval: true, holdApproval: true }), abort = new AbortController();
  const promise = f.controller.pair({ signal: abort.signal }); await until(() => f.events.length === 1); abort.abort();
  await assert.rejects(promise, fails('CANCELLED')); assert.equal(f.sockets[0].destroyed, true); assert.deepEqual(f.commands, []);
});
test('Fire TV repeated AUTH after public key is refused without repeated public-key packets', async t => {
  const f = fixture(t, { unpaired: true, requireApproval: true, extraChallenge: true }); await assert.rejects(f.controller.pair(), fails('AUTH')); assert.equal(f.sockets[0].publicKeys, 1); assert.equal(f.record().paired, false);
});
test('Fire TV declined on-screen approval is an authorization failure, without storing paired or retrying', async t => {
  const f = fixture(t, { unpaired: true, requireApproval: true, denyApproval: true });
  await assert.rejects(f.controller.pair(), fails('AUTH')); assert.equal(f.record().paired, false); assert.equal(f.sockets[0].publicKeys, 1); assert.deepEqual(f.saves, []);
});
for (const [name, options] of [['magic', { corruptMagic: true }], ['checksum', { corruptChecksum: true }], ['payload bound', { hugePacket: true }], ['unknown command', { unknownCommand: true }], ['short token', { token: Buffer.alloc(19) }], ['wrong auth type', { authType: 3 }]]) test(`Fire TV rejects invalid ${name} before an effect`, async t => {
  const f = fixture(t, options); await assert.rejects(f.controller.control('home'), fails('PROTOCOL')); assert.deepEqual(f.commands, []); assert.equal(f.sockets[0].destroyed, true);
});
for (const [name, options] of [['zero remote id', { wrongOkayId: true }], ['wrong local id', { wrongLocalId: true }], ['changed WRTE id', { wrongWriteId: true }]]) test(`Fire TV rejects ${name} and never repeats uncertain effects`, async t => {
  const f = fixture(t, options); await assert.rejects(f.controller.status(), fails('PROTOCOL')); assert.equal(f.commands.length, 1); assert.equal(f.sockets.length, 1);
});
test('Fire TV control accepts only the fixed key allowlist and sends exactly one key per request', async t => {
  const f = fixture(t); const codes = [3, 4, 19, 20, 21, 22, 23, 24, 25, 164, 126, 127];
  for (let index = 0; index < FIRE_TV_ACTIONS.length; index++) { const result = await f.controller.control(FIRE_TV_ACTIONS[index]); assert.equal(result.status, 'unverified'); assert.equal(f.commands[index], `input keyevent ${codes[index]}`); }
  for (const action of ['power', 'reboot', 'home; reboot', 'input keyevent 3', '__proto__', {}, null]) await assert.rejects(f.controller.control(action), fails('INVALID'));
  assert.equal(f.commands.length, FIRE_TV_ACTIONS.length);
});
test('Fire TV launches only a fixed package actually observed in the installed package list', async t => {
  const f = fixture(t); const result = await f.controller.openApp('netflix');
  assert.deepEqual(f.commands, ['pm list packages', 'monkey -p com.netflix.ninja -c android.intent.category.LAUNCHER -c android.intent.category.LEANBACK_LAUNCHER 1']);
  assert.equal(result.ok, true); assert.equal(result.status, 'unverified'); assert.equal(result.app, 'netflix'); assert.equal(Object.hasOwn(result, 'packages'), false); assert.equal(Object.hasOwn(result, 'privateKey'), false);
});
test('Fire TV selects a known installed alternate package without guessing from its label', async t => {
  const f = fixture(t, { outputs: { 'pm list packages': 'package:com.google.android.youtube.tv\npackage:private.other\n' } });
  await f.controller.openApp('youtube'); assert.match(f.commands[1], /^monkey -p com\.google\.android\.youtube\.tv /);
});
test('Fire TV missing application never installs, navigates the store, or launches another app', async t => {
  const f = fixture(t); await assert.rejects(f.controller.openApp('spotify'), fails('APP_NOT_INSTALLED')); assert.deepEqual(f.commands, ['pm list packages']);
});
test('Fire TV ignores forged partial package lines and shell injection text', async t => {
  const f = fixture(t, { outputs: { 'pm list packages': 'notpackage:com.netflix.ninja\npackage:com.netflix.ninja; reboot\npackage:com.netflix.ninja.extra\n' } });
  await assert.rejects(f.controller.openApp('netflix'), fails('APP_NOT_INSTALLED')); assert.equal(f.commands.length, 1);
  for (const app of ['Netflix', 'com.netflix.ninja', 'netflix; reboot', '__proto__', {}, null]) await assert.rejects(f.controller.openApp(app), fails('INVALID'));
  assert.equal(f.commands.length, 1);
});
test('Fire TV launch output failure is sanitized and never retried', async t => {
  const launch = 'monkey -p com.netflix.ninja -c android.intent.category.LAUNCHER -c android.intent.category.LEANBACK_LAUNCHER 1';
  const f = fixture(t, { outputs: { [launch]: 'private diagnostic text\n** No activities found, monkey aborted.\n' } });
  await assert.rejects(f.controller.openApp('netflix'), error => fails('UNAVAILABLE')(error) && !error.message.includes('private diagnostic')); assert.equal(f.commands.filter(value => value.startsWith('monkey')).length, 1);
});
test('Fire TV caps the installed package list at 128 KiB before launch', async t => {
  const f = fixture(t, { outputs: { 'pm list packages': `package:com.netflix.ninja\n${'x'.repeat(128 * 1024)}` } });
  await assert.rejects(f.controller.openApp('netflix'), fails('PROTOCOL')); assert.deepEqual(f.commands, ['pm list packages']);
});
test('Fire TV never retries a key if the socket ends after its OPEN', async t => {
  const f = fixture(t, { eofOnCommand: true }); await assert.rejects(f.controller.control('home'), fails('UNAVAILABLE')); assert.deepEqual(f.commands, ['input keyevent 3']); assert.equal(f.sockets.length, 1);
});
test('Fire TV command timeout closes the connection after exactly one effect attempt', async t => {
  const f = fixture(t, { holdCommand: () => true, timeoutMs: 30 }); await assert.rejects(f.controller.control('home'), fails('TIMEOUT')); assert.deepEqual(f.commands, ['input keyevent 3']); assert.equal(f.sockets[0].destroyed, true);
});
test('Fire TV connection timeout cannot send auth or commands later', async t => {
  const f = fixture(t, { noConnect: true, timeoutMs: 30 }); await assert.rejects(f.controller.status(), fails('TIMEOUT')); assert.deepEqual(f.commands, []); assert.equal(f.sockets[0].destroyed, true);
});
test('Fire TV EOF in a partial authentication header is bounded and cannot execute a command', async t => {
  const f = fixture(t, { silent: true }); const promise = f.controller.control('home'); await until(() => f.sockets.length === 1);
  f.sockets[0].data(encode('AUTH', 1, 0, f.sockets[0].token).subarray(0, 13)); queueMicrotask(() => f.sockets[0].emit('end'));
  await assert.rejects(promise, fails('UNAVAILABLE')); assert.deepEqual(f.commands, []); assert.equal(f.sockets[0].destroyed, true);
});
test('Fire TV disabled/invalid configuration and key bound to another host fail before networking', async t => {
  const f = fixture(t); f.setConfig({ ...f.config(), enabled: false }); await assert.rejects(f.controller.status(), fails('DISABLED'));
  f.setConfig({ ...f.config(), enabled: true, host: 'tv.example.com' }); await assert.rejects(f.controller.status(), fails('INVALID'));
  f.setConfig({ ...f.config(), host: '10.0.0.40' }); await assert.rejects(f.controller.status(), fails('NOT_PAIRED')); assert.equal(f.sockets.length, 0);
});
test('Fire TV revalidates profile before launching from an observed package list', async t => {
  let f; f = fixture(t, { onOutputEnd: command => { if (command === 'pm list packages') f.setConfig({ ...f.config(), profileId: 'other-profile' }); } });
  await assert.rejects(f.controller.openApp('netflix'), fails('CANCELLED')); assert.deepEqual(f.commands, ['pm list packages']);
});
test('Fire TV revalidates host before any command after authentication', async t => {
  const f = fixture(t, { silent: true }); const promise = f.controller.control('home'); await until(() => f.sockets.length === 1);
  f.setConfig({ ...f.config(), host: '10.0.0.21' }); f.sockets[0].data(encode('AUTH', 1, 0, f.sockets[0].token));
  await assert.rejects(promise, fails('CANCELLED')); assert.deepEqual(f.commands, []); assert.equal(f.sockets[0].authSignatures, 0);
});
test('Fire TV reset cancels active and queued operations without a second connection', async t => {
  const f = fixture(t, { holdCommand: () => true }); const first = f.controller.control('home'), second = f.controller.openApp('netflix');
  const failures = Promise.all([assert.rejects(first, fails('CANCELLED')), assert.rejects(second, fails('CANCELLED'))]);
  await until(() => f.commands.length === 1); f.controller.reset(); await failures; assert.equal(f.sockets.length, 1); assert.deepEqual(f.commands, ['input keyevent 3']);
});
test('Fire TV external abort of a queued command resolves without waiting for an unrelated active command', async t => {
  const f = fixture(t, { holdCommand: () => true }), abort = new AbortController();
  const first = f.controller.control('home'); const firstFailure = assert.rejects(first, fails('CANCELLED'));
  await until(() => f.commands.length === 1); const second = f.controller.control('back', { signal: abort.signal }); abort.abort();
  await assert.rejects(second, fails('CANCELLED')); assert.deepEqual(f.commands, ['input keyevent 3']); f.controller.reset(); await firstFailure; assert.equal(f.sockets.length, 1);
});
test('Fire TV does not leak callback exceptions or private key text through its public errors', async () => {
  const controller = new FireTVController({ getConfig: () => ({ enabled: true, host: '10.0.0.2', profileId: 'a' }), getKeyRecord: () => { throw new Error('PRIVATE KEY private callback diagnostic'); }, setKeyRecord: () => {}, socketFactory: () => { assert.fail('Unexpected network connection.'); } });
  await assert.rejects(controller.status(), error => fails('UNAVAILABLE')(error) && !error.message.includes('callback diagnostic'));
});
test('Fire TV serializes simultaneous commands in order and does not reuse a closed stream', async t => {
  const f = fixture(t); await Promise.all([f.controller.control('home'), f.controller.control('back'), f.controller.openApp('netflix')]);
  assert.deepEqual(f.commands.slice(0, 3), ['input keyevent 3', 'input keyevent 4', 'pm list packages']); assert.equal(f.sockets.length, 3); assert.equal(f.sockets.every(socket => socket.destroyed), true);
});
test('Fire TV pre-aborted operations never inspect the TV or create keys', async t => {
  const f = fixture(t, { noKey: true }), abort = new AbortController(); abort.abort(); await assert.rejects(f.controller.pair({ signal: abort.signal }), fails('CANCELLED')); assert.equal(f.sockets.length, 0); assert.deepEqual(f.saves, []);
});
test('Fire TV public implementation has no subprocess, host adb server, environment key paths, or Python dependency', async () => {
  const source = await readFile(new URL('../apps/desktop/fire-tv.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"](?:node:)?(?:child_process|fs|os)['"]|process\.env|adbkey|5037|spawn\(|execFile\(|python/i);
  assert.deepEqual(Object.keys(FIRE_TV_APPS), ['netflix', 'prime_video', 'youtube', 'disney_plus', 'max', 'spotify']);
});
