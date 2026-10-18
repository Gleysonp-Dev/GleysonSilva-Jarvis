import { constants, mkdirSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { lstat, open, rename, unlink } from 'node:fs/promises';
import { resolve, parse, join, isAbsolute, extname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const MAX_BYTES = 20 * 1024 * 1024;
const MIME_BY_EXTENSION = { '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4' };
const allowedMime = new Set(Object.values(MIME_BY_EXTENSION));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs;

function inspectDirectories(directory, allowMissing = false) {
  const absolute = resolve(directory), root = parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    let stat;
    try { stat = lstatSync(current); } catch (error) { if (allowMissing && error.code === 'ENOENT') return; throw error; }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('A pasta de áudio precisa ser um diretório local sem links.');
  }
}

function sniffMime(bytes) {
  if (bytes.length < 12) return null;
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE' && bytes.length >= 44 && bytes.readUInt32LE(4) <= bytes.length - 8) return 'audio/wav';
  if (bytes.toString('ascii', 0, 4) === 'OggS' && bytes.length >= 28 && bytes[4] === 0) {
    const offset = 27 + bytes[26];
    if (offset + 8 <= bytes.length && (bytes.toString('ascii', offset, offset + 8) === 'OpusHead' || bytes.subarray(offset, offset + 7).equals(Buffer.from([1, 118, 111, 114, 98, 105, 115])))) return 'audio/ogg';
  }
  if (bytes.toString('ascii', 4, 8) === 'ftyp') {
    const boxSize = bytes.readUInt32BE(0);
    if (boxSize >= 16 && boxSize <= Math.min(bytes.length, 4096)) {
      const brands = [bytes.toString('ascii', 8, 12)];
      for (let offset = 16; offset + 4 <= boxSize; offset += 4) brands.push(bytes.toString('ascii', offset, offset + 4));
      if (brands.includes('M4A ')) return 'audio/mp4';
    }
  }
  let start = 0;
  if (bytes.toString('ascii', 0, 3) === 'ID3') {
    if (bytes.length < 10 || ![2, 3, 4].includes(bytes[3]) || bytes.subarray(6, 10).some(value => value > 127)) return null;
    start = 10 + ((bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9]);
    if (bytes[3] === 4 && (bytes[5] & 0x10)) start += 10;
  }
  for (let offset = start; offset + 4 <= Math.min(bytes.length, start > 0 ? start + 4096 : 4); offset++) {
    const first = bytes[offset], second = bytes[offset + 1], third = bytes[offset + 2];
    if (first === 0xff && (second & 0xe0) === 0xe0 && ((second >> 3) & 3) !== 1 && ((second >> 1) & 3) !== 0 && (third >> 4) !== 0 && (third >> 4) !== 15 && ((third >> 2) & 3) !== 3) return 'audio/mpeg';
  }
  return null;
}

async function readBounded(file, limit = MAX_BYTES) {
  const before = await lstat(file);
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > limit) throw new Error('Escolha um arquivo de áudio regular com até 20 MiB.');
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const opened = await handle.stat();
    if (!sameFile(before, opened) || !opened.isFile()) throw new Error('O arquivo mudou durante a leitura.');
    const bytes = Buffer.alloc(opened.size + 1);
    let total = 0;
    while (total < bytes.length) {
      const { bytesRead } = await handle.read(bytes, total, bytes.length - total, total);
      if (!bytesRead) break;
      total += bytesRead;
    }
    if (total !== opened.size || !sameFile(opened, await handle.stat()) || !sameFile(opened, await lstat(file))) throw new Error('O arquivo mudou durante a leitura.');
    return bytes.subarray(0, total);
  } finally { await handle.close(); }
}

export class GreetingMusicStore {
  #directory; #directoryId; #audio; #metadata; #queue = Promise.resolve();

  constructor({ dataDir } = {}) {
    if (typeof dataDir !== 'string' || !isAbsolute(dataDir) || dataDir.includes('\0')) throw new Error('A trilha precisa de uma pasta privada absoluta.');
    inspectDirectories(dataDir, true);
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    inspectDirectories(dataDir);
    this.#directory = realpathSync.native(dataDir);
    this.#directoryId = lstatSync(this.#directory);
    this.#audio = join(this.#directory, 'greeting-music.audio');
    this.#metadata = join(this.#directory, 'greeting-music.json');
  }

  #checkDirectory() {
    inspectDirectories(this.#directory);
    const current = lstatSync(this.#directory);
    if (current.dev !== this.#directoryId.dev || current.ino !== this.#directoryId.ino) throw new Error('A pasta privada de áudio mudou.');
  }

  #readMetadata() {
    this.#checkDirectory();
    const metadataStat = lstatSync(this.#metadata), audioStat = lstatSync(this.#audio);
    if (!metadataStat.isFile() || metadataStat.isSymbolicLink() || metadataStat.size > 1024 || !audioStat.isFile() || audioStat.isSymbolicLink() || audioStat.nlink !== 1) return null;
    const metadata = JSON.parse(readFileSync(this.#metadata, 'utf8'));
    if (!metadata || Object.keys(metadata).sort().join(',') !== 'mime,sha256,size,version' || metadata.version !== 1 || !allowedMime.has(metadata.mime) || !Number.isSafeInteger(metadata.size) || metadata.size < 1 || metadata.size > MAX_BYTES || metadata.size !== audioStat.size || !/^[a-f0-9]{64}$/.test(metadata.sha256)) return null;
    return metadata;
  }

  available() {
    try { return this.#readMetadata() !== null; } catch { return false; }
  }

  async read() {
    try {
      const metadata = this.#readMetadata();
      if (!metadata) return null;
      const bytes = await readBounded(this.#audio);
      this.#checkDirectory();
      if (bytes.length !== metadata.size || sniffMime(bytes) !== metadata.mime || digest(bytes) !== metadata.sha256) return null;
      return { bytes, mime: metadata.mime };
    } catch { return null; }
  }

  importFile(sourcePath) {
    const next = this.#queue.then(() => this.#import(sourcePath));
    this.#queue = next.catch(() => {});
    return next;
  }

  async #import(sourcePath) {
    if (typeof sourcePath !== 'string' || !isAbsolute(sourcePath) || sourcePath.includes('\0')) throw new Error('Selecione um arquivo de áudio local.');
    const expectedMime = MIME_BY_EXTENSION[extname(sourcePath).toLowerCase()];
    if (!expectedMime) throw new Error('Use um arquivo MP3, WAV, OGG ou M4A.');
    inspectDirectories(parse(sourcePath).dir);
    const bytes = await readBounded(sourcePath);
    const mime = sniffMime(bytes);
    if (!mime || mime !== expectedMime) throw new Error('O conteúdo não corresponde ao formato de áudio selecionado.');
    this.#checkDirectory();
    for (const destination of [this.#audio, this.#metadata]) {
      try { const stat = await lstat(destination); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('O destino privado de áudio não é seguro.'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const suffix = randomUUID(), audioTemp = `${this.#audio}.${suffix}.tmp`, metadataTemp = `${this.#metadata}.${suffix}.tmp`;
    try {
      for (const [file, contents] of [[audioTemp, bytes], [metadataTemp, JSON.stringify({ version: 1, mime, size: bytes.length, sha256: digest(bytes) })]]) {
        const handle = await open(file, 'wx', 0o600);
        try { await handle.writeFile(contents); await handle.sync(); } finally { await handle.close(); }
      }
      this.#checkDirectory();
      await rename(audioTemp, this.#audio);
      await rename(metadataTemp, this.#metadata);
      if (!(await this.read())) throw new Error('A cópia privada da trilha não pôde ser confirmada.');
      return { hasGreetingMusic: true };
    } finally {
      await Promise.allSettled([unlink(audioTemp), unlink(metadataTemp)]);
    }
  }
}
