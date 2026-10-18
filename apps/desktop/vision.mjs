import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, renameSync, lstatSync, existsSync } from 'node:fs';

const MAX_IMAGE_BYTES = 2_000_000;
const DIMENSIONS = 128;
const MODEL_NAMES = ['face_detection_yunet_2023mar.onnx', 'face_recognition_sface_2021dec.onnx'];
const safeProfile = value => { if (typeof value !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(value)) throw new Error('Perfil inválido.'); return value; };
const safeName = value => { if (typeof value !== 'string' || !value.trim() || value.length > 64 || /[\u0000-\u001f]/.test(value)) throw new Error('Use um nome de até 64 caracteres.'); return value.trim(); };

export function normalizedEmbedding(value) {
  if (!Array.isArray(value) || value.length !== DIMENSIONS || value.some(n => typeof n !== 'number' || !Number.isFinite(n) || Math.abs(n) > 2)) throw new Error('Representação facial inválida.');
  const norm = Math.sqrt(value.reduce((sum, n) => sum + n * n, 0));
  if (norm < 0.5 || norm > 1.5) throw new Error('Representação facial inválida.');
  return value.map(n => n / norm);
}
const cosine = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const average = values => normalizedEmbedding(values[0].map((_, i) => values.reduce((sum, v) => sum + v[i], 0) / values.length));

/** Thresholds are conservative defaults, not a measured identity accuracy or proof of life. */
export function matchEmbedding(embedding, profiles, { threshold = 0.55, margin = 0.08 } = {}) {
  const feature = normalizedEmbedding(embedding);
  const scored = profiles.map(profile => ({ profileId: profile.profileId, name: profile.name, score: cosine(feature, average(profile.embeddings.map(normalizedEmbedding))) })).sort((a, b) => b.score - a.score);
  if (!scored[0] || scored[0].score < threshold || (scored[1] && scored[0].score - scored[1].score < margin)) return null;
  return { profileId: scored[0].profileId, name: scored[0].name };
}

export class VisionService {
  #dataDir; #modelsDir; #crypto; #python; #workerPath; #child; #pending = new Map(); #buffer = ''; #closed = false;
  #profiles = []; #enrollment; #candidate; #busy = false; #lastAnalysis = 0; #lastFrameHash; #generation = 0;
  constructor({ dataDir, modelsDir, crypto, python = process.env.JARVIS_PYTHON || 'python', workerPath = fileURLToPath(new URL('../../services/vision/worker.py', import.meta.url)) } = {}) {
    if (typeof dataDir !== 'string' || !path.isAbsolute(dataDir)) throw new Error('A visão local precisa de uma pasta privada absoluta.');
    this.#dataDir = dataDir; this.#modelsDir = modelsDir ?? path.join(dataDir, 'models'); this.#crypto = crypto; this.#python = python; this.#workerPath = workerPath;
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    mkdirSync(this.#modelsDir, { recursive: true, mode: 0o700 });
    const file = path.join(dataDir, 'faces.bin');
    try {
      if (!this.#crypto?.isEncryptionAvailable() || !existsSync(file)) return;
      const stat = lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 2_000_000) return;
      const records = JSON.parse(this.#crypto.decryptString(readFileSync(file)));
      if (!Array.isArray(records) || records.length > 32) return;
      this.#profiles = records.map(record => ({ profileId: safeProfile(record.profileId), name: safeName(record.name), updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '', embeddings: record.embeddings.map(normalizedEmbedding) })).filter(record => record.embeddings.length === 3);
    } catch { this.#profiles = []; }
  }
  #listProfiles() { return this.#profiles.map(({ profileId, name, updatedAt }) => ({ profileId, name, updatedAt })); }
  #persist() {
    if (!this.#crypto?.isEncryptionAvailable()) throw new Error('O armazenamento cifrado do sistema não está disponível; o cadastro facial permanece desligado.');
    const payload = this.#crypto.encryptString(JSON.stringify(this.#profiles));
    if (!Buffer.isBuffer(payload) || payload.length > 2_000_000) throw new Error('Não foi possível proteger o cadastro facial.');
    const destination = path.join(this.#dataDir, 'faces.bin');
    writeFileSync(`${destination}.tmp`, payload, { mode: 0o600, flag: 'w' });
    renameSync(`${destination}.tmp`, destination);
  }
  #worker() {
    if (this.#child) return this.#child;
    if (this.#closed) throw new Error('A visão local está encerrada.');
    const child = spawn(this.#python, ['-I', this.#workerPath, '--models-dir', this.#modelsDir], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
    this.#child = child;
    child.stderr.resume(); // Native backend diagnostics may include private paths; never forward them.
    const end = () => {
      if (this.#child !== child) return;
      this.#child = undefined; this.#buffer = '';
      for (const item of this.#pending.values()) { clearTimeout(item.timer); item.reject(new Error('O serviço de visão local não está disponível. Confira Python e os modelos opcionais.')); }
      this.#pending.clear();
    };
    child.on('error', end); child.on('exit', end); child.stdin.on('error', end);
    child.stdout.on('data', data => {
      if (this.#child !== child) return;
      this.#buffer += data.toString('utf8');
      if (this.#buffer.length > 350_000) { child.kill(); end(); return; }
      let newline;
      while ((newline = this.#buffer.indexOf('\n')) !== -1) {
        const line = this.#buffer.slice(0, newline); this.#buffer = this.#buffer.slice(newline + 1);
        let response;
        try { response = JSON.parse(line); } catch { child.kill(); end(); return; }
        const item = this.#pending.get(response.id);
        if (!item) continue;
        this.#pending.delete(response.id); clearTimeout(item.timer); item.resolve(response);
      }
    });
    return child;
  }
  #request(body) {
    const child = this.#worker();
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => { this.#pending.delete(id); child.kill(); reject(new Error('A análise local excedeu o tempo disponível.')); }, 12_000);
      this.#pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ ...body, id })}\n`, error => { if (error) { clearTimeout(timer); this.#pending.delete(id); reject(new Error('Não foi possível enviar o quadro ao serviço local.')); } });
    });
  }
  async #status() {
    const profiles = this.#listProfiles();
    if (!this.#crypto?.isEncryptionAvailable()) return { available: false, reason: 'O armazenamento cifrado do sistema não está disponível. Nenhum rosto será cadastrado.', profiles };
    if (MODEL_NAMES.some(name => { try { const stat = lstatSync(path.join(this.#modelsDir, name)); return !stat.isFile() || stat.isSymbolicLink() || stat.size < 1024; } catch { return true; } })) return { available: false, reason: 'Instale os modelos opcionais YuNet e SFace na pasta privada de modelos. Consulte o guia do projeto.', profiles };
    try {
      const status = await this.#request({ type: 'status' });
      return { available: status.available === true, reason: status.available ? 'Reconhecimento local disponível. Limiares iniciais exigem validação no seu equipamento; a webcam não autentica ações.' : status.reason?.message ?? 'Visão local indisponível.', profiles, backend: status.available ? status.backend : undefined };
    } catch (error) { return { available: false, reason: error.message, profiles }; }
  }
  #image(value) {
    if (typeof value !== 'string' || value.length > 2_700_100) throw new Error('Quadro inválido ou muito grande.');
    const match = /^data:image\/(?:jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match || match[1].length % 4 !== 0) throw new Error('Envie somente um quadro local JPEG ou PNG.');
    const bytes = Buffer.from(match[1], 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== match[1]) throw new Error('Quadro inválido ou muito grande.');
    return { imageBase64: match[1], digest: createHash('sha256').update(bytes).digest('hex') };
  }
  async handle(request) {
    if (this.#closed) throw new Error('A visão local está encerrada.');
    if (!request || Object.getPrototypeOf(request) !== Object.prototype || !['status', 'identify', 'enroll', 'delete', 'reset'].includes(request.type)) throw new Error('Solicitação de visão local inválida.');
    if (Object.keys(request).some(key => !['type', 'profileId', 'name', 'imageDataUrl'].includes(key))) throw new Error('Argumento de visão local não permitido.');
    if (request.type === 'status') return this.#status();
    if (request.type === 'reset') { this.#generation++; this.#enrollment = undefined; this.#candidate = undefined; this.#lastFrameHash = undefined; return { ok: true }; }
    if (request.type === 'delete') {
      const profileId = safeProfile(request.profileId);
      const previous = this.#profiles;
      this.#profiles = previous.filter(record => record.profileId !== profileId);
      try { this.#persist(); } catch (error) { this.#profiles = previous; throw error; }
      this.#generation++; this.#enrollment = undefined; this.#candidate = undefined; this.#lastFrameHash = undefined;
      return { deleted: this.#profiles.length !== previous.length, profiles: this.#listProfiles() };
    }
    if (!this.#crypto?.isEncryptionAvailable()) throw new Error('O armazenamento cifrado do sistema não está disponível.');
    if (this.#busy) return { busy: true, faceCount: 0, reason: 'Aguarde a análise do quadro anterior.' };
    if (request.type === 'identify' && Date.now() - this.#lastAnalysis < 250) return { busy: true, faceCount: 0, reason: 'Aguarde o próximo quadro.' };
    const { imageBase64, digest } = this.#image(request.imageDataUrl);
    const profileId = request.type === 'enroll' ? safeProfile(request.profileId) : undefined;
    const name = request.type === 'enroll' ? safeName(request.name) : undefined;
    this.#busy = true;
    const generation = this.#generation;
    try {
      const response = await this.#request({ type: 'analyze', imageBase64 });
      if (this.#closed || generation !== this.#generation) throw new Error('O quadro pertence a uma sessão encerrada. Capture novamente.');
      this.#lastAnalysis = Date.now();
      if (response.ok !== true) throw new Error(response.error?.message ?? 'Não foi possível analisar o quadro localmente.');
      if (!Array.isArray(response.faces) || response.faces.length > 6) throw new Error('O serviço local retornou um quadro inválido.');
      const faceCount = response.multipleFaces ? Math.max(2, response.faces.length) : response.faces.length;
      if (faceCount !== 1 || response.truncated) {
        this.#candidate = undefined;
        if (request.type === 'enroll') this.#enrollment = undefined;
        return { faceCount, enrolled: false, samples: 0, required: 3, reason: faceCount > 1 ? 'Há mais de uma pessoa no quadro. A identificação permanece suspensa.' : 'Posicione somente seu rosto, com boa iluminação, e tente novamente.' };
      }
      const face = response.faces[0];
      if (typeof face.score !== 'number' || !Number.isFinite(face.score) || face.score < 0.85) { this.#candidate = undefined; return { faceCount, reason: 'Detecção insuficiente para identificar uma pessoa.' }; }
      const embedding = normalizedEmbedding(face.embedding);
      if (request.type === 'enroll') {
        let enrollment = this.#enrollment;
        if (!enrollment || enrollment.profileId !== profileId || enrollment.name !== name || Date.now() - enrollment.startedAt > 60_000) enrollment = { profileId, name, embeddings: [], digests: new Set(), startedAt: Date.now() };
        if (enrollment.digests.has(digest)) { this.#enrollment = enrollment; return { enrolled: false, samples: enrollment.embeddings.length, required: 3, faceCount, reason: 'Capture outro quadro e mova levemente a cabeça.' }; }
        if (enrollment.embeddings.some(previous => cosine(previous, embedding) < 0.65)) { this.#enrollment = undefined; return { enrolled: false, samples: 0, required: 3, faceCount, reason: 'Os quadros não foram consistentes. Reinicie com a mesma pessoa em boa luz.' }; }
        enrollment.embeddings.push(embedding); enrollment.digests.add(digest); this.#enrollment = enrollment;
        if (enrollment.embeddings.length < 3) return { enrolled: false, samples: enrollment.embeddings.length, required: 3, faceCount, reason: 'Mova levemente a cabeça para completar três quadros consistentes.' };
        if (!this.#profiles.some(record => record.profileId === profileId) && this.#profiles.length >= 32) throw new Error('Limite de 32 perfis faciais atingido. Apague um cadastro antes de continuar.');
        const record = { profileId, name, embeddings: enrollment.embeddings, updatedAt: new Date().toISOString() };
        const previous = this.#profiles;
        this.#profiles = [...previous.filter(item => item.profileId !== profileId), record];
        try { this.#persist(); } catch (error) { this.#profiles = previous; throw error; }
        this.#enrollment = undefined; this.#candidate = undefined;
        return { enrolled: true, samples: 3, required: 3, profileId, name, faceCount };
      }
      const match = matchEmbedding(embedding, this.#profiles);
      if (!match) { this.#candidate = undefined; this.#lastFrameHash = digest; return { faceCount, reason: 'Pessoa não identificada com segurança suficiente.' }; }
      const sameCandidate = this.#candidate?.profileId === match.profileId && Date.now() - this.#candidate.lastAt < 8000;
      const count = sameCandidate ? this.#candidate.count + (this.#lastFrameHash === digest ? 0 : 1) : 1;
      this.#candidate = { profileId: match.profileId, count, lastAt: Date.now() }; this.#lastFrameHash = digest;
      if (count < 3) return { faceCount, reason: 'Confirmando a consistência da identificação em três quadros.' };
      return { faceCount, ...match, reason: 'Perfil sugerido para personalização. Selecione-o manualmente; o rosto não autoriza acesso nem ações.' };
    } finally { this.#busy = false; }
  }
  close() {
    this.#generation++; this.#closed = true; this.#enrollment = undefined; this.#candidate = undefined; this.#profiles = [];
    for (const item of this.#pending.values()) { clearTimeout(item.timer); item.reject(new Error('A visão local foi encerrada.')); }
    this.#pending.clear(); this.#child?.stdin.end(); this.#child?.kill(); this.#child = undefined;
  }
}
