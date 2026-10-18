import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, lstat, realpath, readFile, writeFile, rename, unlink, open } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ElevenLabsService, ElevenLabsError, ELEVENLABS_DEFAULT_MODEL, validateVoiceId } from '../packages/elevenlabs/index.mjs';

const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const HELP = `Voz ElevenLabs do Projeto GleysonSilva-Jarvis (Node 24+)\n\n`
  + `node scripts/voice.mjs clone --sample "C:/caminho/exato/reference.wav" --name "Jarvis" --consent\n`
  + `node scripts/voice.mjs speak --text "Olá. Estou pronto para ajudar." [--voice-id ID] [--model eleven_flash_v2_5]\n\n`
  + `Credencial: ELEVENLABS_API_KEY somente no ambiente do processo; nunca como argumento.\n`
  + `Clone grava somente metadados em local-data/voice.json. Áudio fica em local-data/audio.\n`
  + `--replace permite substituir a configuração local após criar outra voz; não apaga a voz antiga da conta.\n`
  + `Este comando não publica a amostra ou o áudio, não exporta um modelo e não conecta a voz ao renderer.\n`;

class VoiceCLIError extends Error {
  constructor(code, message) { super(message); this.name = 'VoiceCLIError'; this.code = code; }
}
const cliError = (code, message) => new VoiceCLIError(code, message);
const active = signal => { if (signal?.aborted) throw new ElevenLabsError('cancelled'); };
function argumentsFor(argv) {
  const [command, ...items] = argv;
  if (!command || command === '--help' || command === 'help') return { command: 'help', options: {} };
  if (!['clone', 'speak'].includes(command)) throw cliError('usage', 'Comando inválido. Use clone, speak ou --help.');
  const flags = command === 'clone' ? new Set(['--sample', '--name', '--consent', '--replace']) : new Set(['--voice-id', '--text', '--model']);
  const options = {};
  for (let index = 0; index < items.length; index++) {
    const flag = items[index];
    if (!flags.has(flag) || Object.hasOwn(options, flag)) throw cliError('usage', 'Argumento inválido ou repetido. Use --help para consultar os comandos.');
    if (['--consent', '--replace'].includes(flag)) { options[flag] = true; continue; }
    const value = items[++index];
    if (typeof value !== 'string' || value.startsWith('--') || value.includes('\0')) throw cliError('usage', 'Falta o valor de um argumento. Use --help para consultar os comandos.');
    options[flag] = value;
  }
  return { command, options };
}

async function safeDirectory(parent, name) {
  const location = path.join(parent, name);
  try { await mkdir(location, { mode: 0o700 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const stat = await lstat(location);
  if (!stat.isDirectory() || stat.isSymbolicLink() || path.resolve(await realpath(location)).toLowerCase() !== path.resolve(location).toLowerCase()) throw cliError('storage', 'A pasta privada não pode ser um link ou junção.');
  return location;
}
async function configExists(file) {
  try { const stat = await lstat(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 32_768) throw cliError('storage', 'Configuração local inválida. Revise local-data/voice.json antes de continuar.'); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function saveConfig(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    await rename(temp, file);
  } finally { await unlink(temp).catch(() => {}); }
}

/** Exported for offline CLI tests. Production calls use only the process environment for keys. */
export async function runVoiceCLI(argv, { rootDir = PROJECT_ROOT, service, env = process.env, signal, stdout = process.stdout } = {}) {
  const { command, options } = argumentsFor(argv);
  if (command === 'help') { stdout.write(HELP); return { command: 'help' }; }
  if (command === 'clone' && options['--consent'] !== true) throw new ElevenLabsError('consent_required');
  if (command === 'clone' && (!options['--sample'] || !options['--name'])) throw cliError('usage', 'Informe --sample com caminho absoluto e --name.');
  if (command === 'speak' && !options['--text']) throw cliError('usage', 'Informe o texto em --text.');
  if (!path.isAbsolute(rootDir)) throw cliError('storage', 'A raiz de armazenamento precisa ser absoluta.');
  active(signal);
  const client = service ?? new ElevenLabsService({ getKey: () => env.ELEVENLABS_API_KEY ?? '' });
  let dataDir;
  try { dataDir = await safeDirectory(rootDir, 'local-data'); }
  catch (error) { if (error instanceof VoiceCLIError) throw error; throw cliError('storage', 'Não foi possível preparar o armazenamento privado local.'); }
  const configFile = path.join(dataDir, 'voice.json');
  if (command === 'clone') {
    if (await configExists(configFile) && !options['--replace']) throw cliError('exists', 'Já existe uma voz configurada em local-data/voice.json. Use-a ou escolha --replace explicitamente para criar outra.');
    const result = await client.cloneVoice({ samplePath: options['--sample'], name: options['--name'], consent: true }, { signal });
    active(signal);
    try { await saveConfig(configFile, { provider: 'elevenlabs', voiceId: validateVoiceId(result.voiceId), name: result.name,
      requiresVerification: result.requiresVerification === true, modelId: ELEVENLABS_DEFAULT_MODEL,
      consentRecordedAt: new Date().toISOString(), sample: result.sample }); }
    catch { throw cliError('storage_after_clone', 'A voz pode ter sido criada na conta, mas sua configuração local não foi salva. Confira My Voices antes de repetir a clonagem.'); }
    stdout.write(`${JSON.stringify({ ok: true, config: 'local-data/voice.json', requiresVerification: result.requiresVerification === true, status: result.requiresVerification ? 'verification_required' : 'created' })}\n`);
    return { command, configFile, requiresVerification: result.requiresVerification === true };
  }
  let voiceId = options['--voice-id'];
  if (!voiceId) {
    try {
      if (!await configExists(configFile)) throw cliError('no_voice', 'Configure uma voz com clone ou informe --voice-id.');
      const saved = JSON.parse(await readFile(configFile, 'utf8'));
      if (saved.requiresVerification) throw cliError('verification', 'A voz salva exige verificação na conta antes de gerar fala.');
      voiceId = validateVoiceId(saved.voiceId);
    } catch (error) { if (error instanceof VoiceCLIError || error instanceof ElevenLabsError) throw error; throw cliError('storage', 'Não foi possível ler a configuração privada de voz.'); }
  }
  validateVoiceId(voiceId);
  const outputDir = await safeDirectory(dataDir, 'audio');
  const basename = `jarvis-${Date.now()}-${randomUUID()}.mp3`;
  const destination = path.join(outputDir, basename);
  const temporary = `${destination}.partial`;
  let handle;
  try {
    handle = await open(temporary, 'wx', 0o600);
    let bytes = 0;
    for await (const chunk of client.streamSpeech({ voiceId, text: options['--text'], modelId: options['--model'] ?? ELEVENLABS_DEFAULT_MODEL, outputFormat: 'mp3_44100_128' }, { signal })) {
      active(signal);
      let offset = 0;
      while (offset < chunk.byteLength) {
        const { bytesWritten } = await handle.write(chunk, offset, chunk.byteLength - offset);
        if (bytesWritten <= 0) throw new Error('write failed');
        offset += bytesWritten;
      }
      bytes += chunk.byteLength;
    }
    active(signal);
    if (!bytes) throw new ElevenLabsError('invalid_response');
    await handle.close(); handle = undefined;
    await rename(temporary, destination);
    stdout.write(`${JSON.stringify({ ok: true, audio: `local-data/audio/${basename}`, bytes, synthetic: true })}\n`);
    return { command, destination, bytes };
  } catch (error) {
    if (error instanceof ElevenLabsError) throw error;
    throw cliError('storage', 'Não foi possível salvar o áudio privado. Arquivos incompletos são descartados.');
  } finally { await handle?.close().catch(() => {}); await unlink(temporary).catch(() => {}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try { await runVoiceCLI(process.argv.slice(2), { signal: controller.signal }); }
  catch (error) {
    const safe = error instanceof ElevenLabsError || error instanceof VoiceCLIError ? error : new ElevenLabsError('connection');
    process.stderr.write(`${safe.message}\n`);
    process.exitCode = safe.code === 'cancelled' ? 130 : 1;
  } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}
