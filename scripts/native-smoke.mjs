import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtemp, lstat, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const MARKER = 'JARVIS_NATIVE_SMOKE=';
const CHECKS = ['ready', 'window', 'dom', 'preload', 'boot', 'fullscreen'];
const EXCLUDED_ENV = new Set(['OPENAI_API_KEY', 'ELEVENLABS_API_KEY', 'ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS']);

function validReport(report, token, expectedPackaged) {
  return report && report.token === token && CHECKS.every(key => report[key] === true) && report.packaged === expectedPackaged;
}

async function terminate(child) {
  if (!child?.pid) { try { child?.kill(); } catch {} return; }
  if (process.platform === 'win32' && Number.isInteger(child.pid) && child.pid > 0) {
    await new Promise(resolve => execFile(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
      ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, shell: false, timeout: 5000 }, () => resolve()));
  } else { try { child.kill(); } catch {} }
}

/** Exercises a real Electron main, preload and renderer using an empty disposable profile. */
export async function runNativeSmoke({ executable = path.join(ROOT, 'release', 'win-unpacked', 'GleysonSilva-Jarvis.exe'), expectedPackaged = true,
  timeoutMs = 30_000, spawnImpl = spawn, terminateImpl = terminate, env = process.env } = {}) {
  if (typeof executable !== 'string' || !path.isAbsolute(executable) || !/\.exe$/i.test(executable) || /[\r\n\0]/.test(executable)) throw new Error('Informe o executável Windows absoluto do pacote.');
  if (typeof expectedPackaged !== 'boolean' || !Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('Configuração do ensaio nativo inválida.');
  const executableStat = await lstat(executable);
  if (!executableStat.isFile() || executableStat.isSymbolicLink()) throw new Error('O executável do ensaio deve ser um arquivo comum.');
  const tempRoot = await realpath(tmpdir());
  const dataDir = await mkdtemp(path.join(tempRoot, 'jarvis-native-smoke-'));
  const token = randomBytes(32).toString('hex');
  const childEnv = { ...env };
  for (const key of Object.keys(childEnv)) if (EXCLUDED_ENV.has(key.toUpperCase())) delete childEnv[key];
  childEnv.JARVIS_SMOKE_TOKEN = token;
  childEnv.JARVIS_SMOKE_DATA_DIR = dataDir;
  let child;
  try {
    const report = await new Promise((resolve, reject) => {
      let completed = false, stopped = false, buffer = '', outputBytes = 0, confirmed;
      const finish = async (error, value) => {
        if (completed) return;
        completed = true;
        clearTimeout(timer);
        if (error && !stopped) await terminateImpl(child);
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => { void finish(new Error('O aplicativo nativo não concluiu a abertura no prazo.')); }, timeoutMs);
      try {
        child = spawnImpl(executable, ['--jarvis-smoke'], { cwd: path.dirname(executable), env: childEnv, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch {
        void finish(new Error('Não foi possível iniciar o executável do ensaio nativo.')); return;
      }
      child.stderr.resume(); // Native diagnostics can contain private paths; never publish them.
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', chunk => {
        outputBytes += Buffer.byteLength(chunk);
        if (outputBytes > 64_000) { void finish(new Error('A saída do ensaio nativo excedeu o limite.')); return; }
        buffer += chunk;
        let separator;
        while ((separator = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, separator).trim(); buffer = buffer.slice(separator + 1);
          if (!line.startsWith(MARKER)) continue;
          try {
            const value = JSON.parse(line.slice(MARKER.length));
            if (validReport(value, token, expectedPackaged)) confirmed = value;
          } catch { /* A marker is accepted only with the process nonce and all real checks. */ }
        }
      });
      child.once('error', () => { void finish(new Error('O processo do ensaio nativo falhou ao iniciar.')); });
      child.once('close', code => {
        stopped = true;
        if (code !== 0) { void finish(new Error('O aplicativo nativo encerrou com falha.')); return; }
        if (!confirmed) { void finish(new Error('A abertura nativa não confirmou janela, interface e comunicação interna.')); return; }
        void finish(null, Object.fromEntries([...CHECKS, 'packaged'].map(key => [key, confirmed[key]])));
      });
    });
    return report;
  } finally {
    // This is exactly the fresh directory created above, never a caller-selected user profile.
    const absolute = path.resolve(dataDir);
    if (path.dirname(absolute) !== tempRoot || !path.basename(absolute).startsWith('jarvis-native-smoke-')) throw new Error('A pasta descartável do ensaio não pôde ser validada.');
    await rm(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

function commandLine(argv) {
  if (!argv.length || (argv.length === 1 && argv[0] === '--packaged')) return {};
  if (argv.length === 2 && argv[0] === '--executable') return { executable: path.resolve(argv[1]) };
  throw new Error('Use --packaged ou --executable CAMINHO_DO_EXE.');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const result = await runNativeSmoke(commandLine(process.argv.slice(2)));
    console.log(`Abertura nativa aprovada: ${JSON.stringify(result)}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
