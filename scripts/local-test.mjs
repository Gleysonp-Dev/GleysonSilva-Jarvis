import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { randomBytes, randomUUID, timingSafeEqual, createCipheriv, createDecipheriv } from 'node:crypto';
import { createRuntime } from '../packages/runtime/index.mjs';
import { OpenAIService, OpenAIServiceError } from '../packages/openai/index.mjs';
import { VisionService } from '../apps/desktop/vision.mjs';
import { defaults, validateSettings } from '../apps/desktop/settings.mjs';
import { StartupGreetingService, StartupGreetingError } from '../packages/greeting/index.mjs';
import { SpeechService, SpeechServiceError } from '../packages/speech/index.mjs';
import { SpeechController, SpeechControlError } from '../packages/speech/controller.mjs';
import { GreetingMusicStore } from '../apps/desktop/greeting-music.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BRIDGE = fileURLToPath(new URL('./test-bridge.js', import.meta.url));
const MAX_BODY = 3 * 1024 * 1024;
const ASSETS = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/index.html', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']], ['/app.css', ['app.css', 'text/css; charset=utf-8']], ['/voice-demo.mp3', ['voice-demo.mp3', 'audio/mpeg']]]);
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://api.openai.com; font-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
class ClientError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const reject = (message, status = 400) => { throw new ClientError(message, status); };
const identifier = value => { if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,150}$/.test(value)) reject('Identificador inválido.'); return value; };
const object = (value, allowed) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).some(key => !allowed.includes(key))) reject('Argumentos inválidos.');
  return value;
};

/** Functional loopback harness: no shell/native app authority, no persisted provider key. */
export async function createLocalTestServer({ port = 47832, dataDir = path.join(ROOT, 'local-data'), assetsDir = path.join(ROOT, 'dist'), python, modelsDir = path.join(dataDir, 'models'), fetch: fetchImpl = globalThis.fetch } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Porta inválida.');
  if (!path.isAbsolute(dataDir) || !path.isAbsolute(assetsDir) || !path.isAbsolute(modelsDir)) throw new Error('As pastas do servidor devem usar caminhos absolutos.');
  dataDir = path.resolve(dataDir);
  const workspaceRoot = path.join(dataDir, 'workspace');
  await mkdir(workspaceRoot, { recursive: true });
  for (const [name, body] of [['exemplo.txt', 'Arquivo demonstrativo do Jarvis.\n'], ['ideia.md', '# Ideia demonstrativa\nEste arquivo pode ser organizado e restaurado.\n'], ['rascunho.json', '{"demo":true}\n']]) {
    try { await writeFile(path.join(workspaceRoot, name), body, { flag: 'wx', mode: 0o600 }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  const sessionDir = path.join(dataDir, `vision-session-${randomUUID()}`);
  const faceKey = randomBytes(32);
  const ephemeralCrypto = {
    isEncryptionAvailable: () => true,
    encryptString(value) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', faceKey, iv); const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]); },
    decryptString(data) { const decipher = createDecipheriv('aes-256-gcm', faceKey, data.subarray(0, 12)); decipher.setAuthTag(data.subarray(12, 28)); return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8'); },
  };
  const token = randomBytes(32).toString('hex');
  let privateConfig = {};
  try { privateConfig = validateSettings(JSON.parse(await readFile(path.join(dataDir, 'config.json'), 'utf8'))); } catch { /* An absent or invalid private config uses generic defaults. */ }
  let settings = { ...defaults, ...privateConfig, workspaceRoot, apps: [] }, key = '', elevenKey = '', generation = 0, closing = false, textRunId;
  const clients = new Set(), runs = new Map(), knownRuns = new Map(), approvals = new Map(), connections = new Set();
  const startupFlights = new Map(), startupAttempts = new Map();
  let runtime;
  const emit = event => {
    if (event.profileId && event.profileId !== settings.profileId) return;
    for (const client of clients) {
      if (client.writableLength > 256_000) { client.destroy(); clients.delete(client); continue; }
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };
  runtime = createRuntime({ dataDir: path.join(dataDir, 'runtime'), workspaceRoot, onEvent(event) {
    if (event.type === 'approval') approvals.set(event.approvalId, { event, generation });
    if (event.profileId !== settings.profileId) { if (event.type === 'approval') runtime.approve(event.approvalId, false); return; }
    if (event.type === 'state' && ['cancelled', 'completed', 'failed'].includes(event.state)) for (const [id, entry] of approvals) if (entry.event.runId === event.runId) approvals.delete(id);
    emit(event);
  } });
  const vision = new VisionService({ dataDir: sessionDir, modelsDir, crypto: ephemeralCrypto, ...(python ? { python } : {}) });
  const provider = new OpenAIService({ getKey: () => key || process.env.OPENAI_API_KEY || '', getSettings: () => settings, runtime, fetch: fetchImpl, onEvent(event) {
    const run = runs.get(event.runId);
    if (run && run.generation === generation && !run.controller.signal.aborted) emit({ ...event, profileId: run.profileId });
  } });
  const startupService = new StartupGreetingService({ getSettings: () => settings, getKey: () => elevenKey || process.env.ELEVENLABS_API_KEY || '', fetch: fetchImpl });
  const speech = new SpeechController({ service: new SpeechService({ getSettings: () => settings, getKey: () => elevenKey || process.env.ELEVENLABS_API_KEY || '', fetch: fetchImpl }), getProfile: () => settings.profileId });
  const musicStore = new GreetingMusicStore({ dataDir });
  const publicSettings = () => ({ ...settings, apps: [], hasKey: Boolean(key || process.env.OPENAI_API_KEY), hasElevenKey: Boolean(elevenKey || process.env.ELEVENLABS_API_KEY), hasGreetingMusic: musicStore.available() });
  const profile = input => { if (input.profileId !== undefined && input.profileId !== settings.profileId) reject('O perfil mudou. Inicie outra solicitação no perfil atual.'); return settings.profileId; };
  function runFor(runId, profileId) {
    const previous = runs.get(runId);
    if (previous) { if (previous.generation !== generation || previous.profileId !== profileId || previous.controller.signal.aborted) reject('Esta execução foi interrompida. Inicie outra.'); return previous; }
    if (knownRuns.has(runId) && knownRuns.get(runId) !== profileId) reject('Identificador usado em outro perfil.');
    const run = { profileId, generation, controller: new AbortController() }; runs.set(runId, run); knownRuns.set(runId, profileId); return run;
  }
  async function reset(reason) {
    generation++;
    speech.reset();
    for (const [runId, run] of runs) { run.controller.abort(); runtime.cancel(runId); }
    for (const controller of connections) controller.abort();
    for (const [id] of approvals) runtime.approve(id, false);
    approvals.clear(); runs.clear(); connections.clear(); startupFlights.clear(); textRunId = undefined;
    await vision.handle({ type: 'reset' });
    emit({ type: 'session.reset', reason });
  }
  const handlers = {
    async boot() { const status = await vision.handle({ type: 'status' }); return { settings: publicSettings(), snapshot: runtime.getSnapshot(settings.profileId), capabilities: { desktop: false, vision: status.available === true, localTest: true, ephemeralBiometrics: true, jarvisSpeech: true, startup: false, voiceWake: false } }; },
    async saveSettings(input) {
      object(input, ['profileId', 'textModel', 'realtimeModel', 'voice', 'maxSessionMinutes', 'apiKey', 'startupGreeting', 'weatherLocation', 'elevenVoiceId', 'elevenApiKey', 'startAtLogin', 'standbyEnabled', 'wakeClapEnabled', 'wakeVoiceEnabled', 'greetingMusicEnabled']);
      let valid;
      try { valid = validateSettings(input); } catch (error) { reject(error.message); }
      for (const field of ['apiKey', 'elevenApiKey']) if (input[field] !== undefined && (typeof input[field] !== 'string' || input[field].length > 512 || /[\r\n\0]/.test(input[field]))) reject('Chave inválida.');
      await reset(input.profileId && input.profileId !== settings.profileId ? 'profile_changed' : 'settings_changed');
      settings = { ...settings, ...valid };
      if (settings.standbyEnabled) settings.startupGreeting = true;
      if (input.apiKey?.trim()) key = input.apiKey.trim();
      if (input.elevenApiKey?.trim()) elevenKey = input.elevenApiKey.trim();
      return publicSettings();
    },
    async chooseWorkspace() { return workspaceRoot; },
    async chooseApp() { return null; },
    async chooseGreetingMusic() { return { available: false, hasGreetingMusic: musicStore.available(), reason: 'requires_native_windows' }; },
    async wakeStart() { return { available: false, running: false, state: 'unavailable', reason: 'requires_native_windows' }; },
    async wakeStop() { return { available: false, running: false, state: 'unavailable', reason: 'requires_native_windows' }; },
    async speak(input) { return speech.speak(input); },
    async cancelSpeech(input) { object(input, ['runId']); return speech.cancel(input); },
    async text(input) {
      object(input, ['text', 'history', 'profileId', 'runId']);
      const profileId = profile(input), runId = identifier(input.runId);
      if (textRunId) reject('Uma resposta já está em andamento. Interrompa-a antes de enviar outra.');
      const run = runFor(runId, profileId); textRunId = runId;
      try { return await provider.respond({ ...input, profileId, runId }, { signal: run.controller.signal }); }
      finally { if (textRunId === runId) textRunId = undefined; if (runs.get(runId) === run) runs.delete(runId); }
    },
    async cancel(input) {
      const runId = identifier(input);
      if (knownRuns.get(runId) !== settings.profileId) return false;
      runs.get(runId)?.controller.abort(); runtime.cancel(runId);
      for (const [id, entry] of approvals) if (entry.event.runId === runId) { runtime.approve(id, false); approvals.delete(id); emit({ type: 'approval', approvalId: id, runId, status: 'cancelled' }); }
      return true;
    },
    async callTool(input) {
      object(input, ['id', 'name', 'args', 'profileId', 'runId']);
      const profileId = profile(input), runId = identifier(input.runId), id = identifier(input.id), run = runFor(runId, profileId);
      return provider.executeRealtimeTool({ id, name: input.name, args: input.args, profileId, runId }, { signal: run.controller.signal });
    },
    async approve(input) {
      object(input, ['approvalId', 'allow']); identifier(input.approvalId);
      const entry = approvals.get(input.approvalId);
      if (!entry || entry.generation !== generation || entry.event.profileId !== settings.profileId || typeof input.allow !== 'boolean') reject('Esta autorização expirou.');
      approvals.delete(input.approvalId);
      const allowed = runtime.approve(input.approvalId, input.allow);
      emit({ type: 'approval', approvalId: input.approvalId, runId: entry.event.runId, status: input.allow ? 'approved' : 'denied' }); return allowed;
    },
    async memorySave(input) { object(input, ['profileId', 'id', 'text']); try { return runtime.saveMemory({ ...input, profileId: profile(input) }); } catch (error) { if (error instanceof ClientError) throw error; reject('Memória inválida. Use até 2.000 caracteres.'); } },
    async memoryDelete(input) { object(input, ['profileId', 'id']); return runtime.deleteMemory(profile(input), identifier(input.id)); },
    async realtimeSession(input) {
      object(input, ['profileId', 'sdp']); const profileId = profile(input);
      if (!(elevenKey || process.env.ELEVENLABS_API_KEY) || !settings.elevenVoiceId) reject('Configure a voz Jarvis e a chave ElevenLabs antes de iniciar a conversa.');
      const controller = new AbortController(), startGeneration = generation; connections.add(controller);
      try { const response = await provider.createRealtimeSession({ sdp: input.sdp, profileId }, { signal: controller.signal }); if (startGeneration !== generation || controller.signal.aborted) reject('A configuração mudou. Inicie outra sessão.'); return response; }
      finally { connections.delete(controller); }
    },
    async vision(input) { object(input, ['type', 'profileId', 'name', 'imageDataUrl']); const profileId = profile(input); try { return await vision.handle(['enroll', 'delete'].includes(input.type) ? { ...input, profileId } : input); } catch { reject('Não foi possível concluir a análise facial local. Confira os modelos e a câmera.'); } },
    async openExternal() { reject('A abertura de aplicativos externos está desativada no teste local.'); },
    async listModels() { return provider.listModels(); },
    async cancelGreeting() {
      const profileId = settings.profileId, controller = startupFlights.get(profileId);
      if (!controller) return { cancelled: false };
      controller.abort(); startupFlights.delete(profileId); connections.delete(controller);
      return { cancelled: true };
    },
    async startupGreeting(input) {
      object(input, ['hour', 'timezone']);
      if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) reject('Horário inválido para a saudação.');
      if (input.timezone !== undefined) {
        if (typeof input.timezone !== 'string' || input.timezone.length > 80 || !/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(input.timezone)) reject('Fuso horário inválido.');
        try { new Intl.DateTimeFormat('pt-BR', { timeZone: input.timezone }).format(); } catch { reject('Fuso horário inválido.'); }
      }
      const profileId = settings.profileId, startGeneration = generation;
      if (startupFlights.has(profileId)) reject('Uma saudação já está sendo preparada.');
      if (settings.startupGreeting === true) {
        const timestamp = Date.now(), attempts = (startupAttempts.get(profileId) ?? []).filter(at => timestamp - at < 3_600_000);
        if (attempts.length >= 6 || (attempts.length && timestamp - attempts.at(-1) < 60_000)) reject('Aguarde um minuto para testar outra saudação. Limite de seis por hora.', 429);
        attempts.push(timestamp); startupAttempts.set(profileId, attempts);
      }
      const controller = new AbortController(); startupFlights.set(profileId, controller); connections.add(controller);
      try {
        const result = await startupService.prepare({ hour: input.hour, ...(input.timezone ? { timezone: input.timezone } : {}) }, { signal: controller.signal });
        if (controller.signal.aborted || startGeneration !== generation || profileId !== settings.profileId) reject('A configuração mudou. A saudação anterior foi interrompida.');
        return result;
      } finally { if (startupFlights.get(profileId) === controller) startupFlights.delete(profileId); connections.delete(controller); }
    },
  };

  function headers(res, type = 'application/json; charset=utf-8') {
    res.setHeader('Content-Type', type); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Content-Security-Policy', CSP); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)');
  }
  function csrf(req) {
    const supplied = req.headers['x-jarvis-token'];
    if (typeof supplied !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) reject('Token local ausente ou inválido.', 403);
  }
  async function body(req) {
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') reject('Envie JSON.', 415);
    if (Number(req.headers['content-length']) > MAX_BODY) reject('Solicitação muito grande.', 413);
    let bytes = 0, pieces = [];
    for await (const piece of req) { bytes += piece.length; if (bytes > MAX_BODY) reject('Solicitação muito grande.', 413); pieces.push(piece); }
    try { return JSON.parse(Buffer.concat(pieces).toString('utf8')); } catch { reject('JSON inválido.'); }
  }
  const server = createServer(async (req, res) => {
    headers(res);
    try {
      if (closing) reject('O teste local está encerrando.', 503);
      const activePort = server.address()?.port;
      const host = req.headers.host;
      if (typeof host !== 'string' || ![`127.0.0.1:${activePort}`, `localhost:${activePort}`].includes(host) || req.rawHeaders.filter((value, index) => index % 2 === 0 && value.toLowerCase() === 'host').length !== 1) reject('Host não autorizado.', 403);
      const origin = `http://${host}`;
      const url = new URL(req.url, origin);
      if (url.origin !== origin || url.search || url.hash || req.url.includes('%') || req.url.includes('\\')) reject('Caminho inválido.', 404);
      if (url.pathname === '/events') {
        if (req.method !== 'GET') reject('Método não permitido.', 405);
        csrf(req);
        if (req.headers.origin && req.headers.origin !== origin) reject('Origem não autorizada.', 403);
        headers(res, 'text/event-stream; charset=utf-8'); res.writeHead(200); res.write(': connected\n\n'); clients.add(res);
        for (const entry of approvals.values()) if (entry.generation === generation && entry.event.profileId === settings.profileId) res.write(`data: ${JSON.stringify(entry.event)}\n\n`);
        const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': heartbeat\n\n'); }, 15_000);
        res.on('close', () => { clearInterval(heartbeat); clients.delete(res); }); return;
      }
      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'POST') reject('Método não permitido.', 405);
        csrf(req);
        if (req.headers.origin !== origin || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) reject('Origem não autorizada.', 403);
        const method = url.pathname.slice(5);
        if (!Object.hasOwn(handlers, method)) reject('Método não encontrado.', 404);
        const input = await body(req), result = await handlers[method](input);
        res.writeHead(200); res.end(JSON.stringify({ ok: true, result })); return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') reject('Método não permitido.', 405);
      if (url.pathname === '/greeting-music') {
        if ((req.headers.origin && req.headers.origin !== origin) || (req.headers['sec-fetch-site'] && req.headers['sec-fetch-site'] !== 'same-origin')) reject('Origem não autorizada.', 403);
        // Audio elements send same-origin Fetch Metadata; non-browser clients must prove the session token.
        if (req.headers['sec-fetch-site'] !== 'same-origin') csrf(req);
        const audio = await musicStore.read();
        if (!audio) reject('Nenhuma trilha privada válida foi importada.', 404);
        headers(res, audio.mime); res.setHeader('Content-Length', audio.bytes.length); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
        res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : audio.bytes); return;
      }
      if (url.pathname === '/test-bridge.js') {
        headers(res, 'text/javascript; charset=utf-8'); const bridge = await readFile(BRIDGE); res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : bridge); return;
      }
      const asset = ASSETS.get(url.pathname);
      if (!asset) reject('Arquivo não encontrado.', 404);
      let content = await readFile(path.join(assetsDir, asset[0]));
      if (asset[0] === 'index.html') content = Buffer.from(content.toString('utf8').replace('</head>', `<meta name="jarvis-token" content="${token}"><script src="/test-bridge.js" defer></script></head>`));
      headers(res, asset[1]); res.writeHead(200); res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) {
      const safeError = error instanceof ClientError || error instanceof OpenAIServiceError || error instanceof SpeechServiceError || error instanceof SpeechControlError || error instanceof StartupGreetingError;
      const message = safeError ? error.message : 'Não foi possível concluir a operação local.';
      if (!res.headersSent) { res.writeHead(error instanceof ClientError ? error.status : safeError ? 400 : 500); res.end(JSON.stringify({ ok: false, error: message })); }
      else res.end();
    }
  });
  server.requestTimeout = 240_000;
  await new Promise((resolve, rejectListen) => { server.once('error', rejectListen); server.listen(port, '127.0.0.1', resolve); });
  const url = `http://127.0.0.1:${server.address().port}`;
  let closePromise;
  return { url, async close() {
    if (closePromise) return closePromise;
    closing = true;
    closePromise = (async () => {
      await reset('server_closed');
      for (const client of clients) client.end(); clients.clear();
      const stopped = new Promise(resolve => server.close(resolve)); server.closeIdleConnections();
      vision.close(); await runtime.close(); server.closeAllConnections(); await stopped; faceKey.fill(0); key = ''; elevenKey = '';
      const relative = path.relative(dataDir, sessionDir);
      if (!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(sessionDir).startsWith('vision-session-')) await rm(sessionDir, { recursive: true, force: true });
    })();
    return closePromise;
  } };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const local = await createLocalTestServer({ port: Number(process.env.JARVIS_TEST_PORT || 47832) });
  console.log(`Jarvis funcional local: ${local.url}`);
  console.log('Chave OpenAI em memória; rostos cifrados com chave temporária e descartados ao encerrar. Sem controle de aplicativos nativos.');
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void local.close().finally(() => process.exit(0)); });
}
