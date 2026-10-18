import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import * as fs from 'node:fs/promises';
import { VisionService, normalizedEmbedding, matchEmbedding } from '../apps/desktop/vision.mjs';

const python = process.env.JARVIS_PYTHON || 'python';
const probe = spawnSync(python, ['--version'], { timeout: 10_000, windowsHide: true });
const pythonAvailable = !probe.error && probe.status === 0;
const embedding = index => Array.from({ length: 128 }, (_, i) => +(i === index));
const image = (seq, face = 0, extra = {}) => `data:image/jpeg;base64,${Buffer.from(JSON.stringify({ seq, face, ...extra })).toString('base64')}`;
const waitFrame = () => new Promise(resolve => setTimeout(resolve, 270));

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-vision-'));
  const key = randomBytes(32);
  const crypto = {
    isEncryptionAvailable: () => true,
    encryptString(text) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]); },
    decryptString(data) { const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'); },
  };
  const dataDir = path.join(dir, 'private'), modelsDir = path.join(dir, 'models'), workerPath = path.join(dir, 'fake_worker.py');
  await fs.mkdir(modelsDir);
  for (const name of ['face_detection_yunet_2023mar.onnx', 'face_recognition_sface_2021dec.onnx']) await fs.writeFile(path.join(modelsDir, name), Buffer.alloc(2048));
  // A deterministic private pipe worker exercises service policy, not actual face-recognition accuracy.
  await fs.writeFile(workerPath, `import sys,json,base64,time
for line in sys.stdin:
 r=json.loads(line)
 if r.get('type')=='status': out={'ok':True,'available':True,'backend':'synthetic-test'}
 else:
  data=json.loads(base64.b64decode(r['imageBase64']))
  if data.get('delay'): time.sleep(0.25)
  vector=[0.0]*128;vector[data['face']]=1.0
  face={'score':0.99,'embedding':vector}
  out={'ok':True,'faces':[] if data.get('empty') else [face,face] if data.get('multiple') else [face],'multipleFaces':bool(data.get('multiple'))}
 out['id']=r['id']; print(json.dumps(out),flush=True)
`);
  let service = new VisionService({ dataDir, modelsDir, crypto, python, workerPath });
  t.after(async () => {
    service.close();
    const resolved = path.resolve(dir);
    assert.ok(resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}jarvis-vision-`));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return { get service() { return service; }, dataDir, crypto,
    restart() { service.close(); service = new VisionService({ dataDir, modelsDir, crypto, python, workerPath }); },
  };
}

test('face matcher rejects malformed, unknown and ambiguous synthetic vectors', () => {
  assert.throws(() => normalizedEmbedding([1]), /inválida/);
  assert.throws(() => normalizedEmbedding(Array(128).fill(NaN)), /inválida/);
  const alice = { profileId: 'alice', name: 'Alice', embeddings: [embedding(0), embedding(0), embedding(0)] };
  assert.deepEqual(matchEmbedding(embedding(0), [alice]), { profileId: 'alice', name: 'Alice' });
  assert.equal(matchEmbedding(embedding(1), [alice]), null);
  assert.equal(matchEmbedding(embedding(0), [alice, { ...alice, profileId: 'other', name: 'Other' }]), null);
});

test('vision remains optional without protected storage or local models', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jarvis-vision-'));
  const service = new VisionService({ dataDir: dir, crypto: { isEncryptionAvailable: () => false } });
  t.after(async () => { service.close(); assert.ok(path.resolve(dir).startsWith(`${path.resolve(os.tmpdir())}${path.sep}jarvis-vision-`)); await fs.rm(dir, { recursive: true, force: true }); });
  assert.equal((await service.handle({ type: 'status' })).available, false);
  await assert.rejects(service.handle({ type: 'enroll', profileId: 'alice', name: 'Alice', imageDataUrl: image(1) }), /cifrado/);
  await assert.rejects(service.handle({ type: 'identify', path: 'C:\\secret.jpg' }), /permitido/);
  assert.deepEqual((await service.handle({ type: 'status' })).profiles, []);
});

test('three distinct consistent enrollment frames persist encrypted; identity needs three later matches and deletion clears cadastro', { skip: !pythonAvailable }, async t => {
  const f = await fixture(t);
  assert.equal((await f.service.handle({ type: 'status' })).available, true);
  const enroll = seq => f.service.handle({ type: 'enroll', profileId: 'alice', name: 'Alice Private Name', imageDataUrl: image(seq) });
  assert.equal((await enroll(1)).samples, 1);
  assert.equal((await enroll(1)).samples, 1, 'duplicate frames must not count twice');
  assert.equal((await enroll(2)).samples, 2);
  assert.equal((await enroll(3)).enrolled, true);
  const encrypted = await fs.readFile(path.join(f.dataDir, 'faces.bin'));
  assert.equal(encrypted.includes(Buffer.from('Alice Private Name')), false);
  assert.equal(encrypted.includes(Buffer.from('embeddings')), false);
  f.restart();
  assert.deepEqual((await f.service.handle({ type: 'status' })).profiles.map(profile => profile.profileId), ['alice']);
  for (let i = 4; i <= 6; i++) {
    await waitFrame();
    const result = await f.service.handle({ type: 'identify', imageDataUrl: image(i) });
    assert.equal(Object.hasOwn(result, 'embedding'), false);
    assert.equal(Object.hasOwn(result, 'embeddings'), false);
    if (i < 6) assert.equal(result.profileId, undefined);
    else assert.equal(result.profileId, 'alice');
  }
  await waitFrame();
  const multiple = await f.service.handle({ type: 'identify', imageDataUrl: image(7, 0, { multiple: true }) });
  assert.equal(multiple.faceCount, 2);
  assert.equal(multiple.profileId, undefined);
  await waitFrame();
  assert.equal((await f.service.handle({ type: 'identify', imageDataUrl: image(8) })).profileId, undefined, 'multiple faces reset temporal agreement');
  assert.equal((await f.service.handle({ type: 'delete', profileId: 'alice' })).deleted, true);
  f.restart();
  assert.deepEqual((await f.service.handle({ type: 'status' })).profiles, []);
  assert.deepEqual(JSON.parse(f.crypto.decryptString(await fs.readFile(path.join(f.dataDir, 'faces.bin')))), []);
});

test('inconsistent enrollment and stale in-flight frames never create a profile', { skip: !pythonAvailable }, async t => {
  const f = await fixture(t);
  assert.equal((await f.service.handle({ type: 'enroll', profileId: 'alice', name: 'Alice', imageDataUrl: image(1) })).samples, 1);
  assert.equal((await f.service.handle({ type: 'enroll', profileId: 'alice', name: 'Alice', imageDataUrl: image(2, 1) })).samples, 0);
  const pending = f.service.handle({ type: 'enroll', profileId: 'alice', name: 'Alice', imageDataUrl: image(3, 0, { delay: true }) });
  await f.service.handle({ type: 'reset' });
  await assert.rejects(pending, /sessão encerrada/);
  assert.deepEqual((await f.service.handle({ type: 'status' })).profiles, []);
});
