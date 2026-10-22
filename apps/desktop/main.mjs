import { app, BrowserWindow, dialog, ipcMain, protocol, safeStorage, session, shell, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir, lstat, realpath, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import { createRuntime } from '../../packages/runtime/index.mjs';
import { OpenAIService, OpenAIServiceError } from '../../packages/openai/index.mjs';
import { SettingsStore, validateSettings } from './settings.mjs';
import { createWindowsAdapters } from './platform/windows.mjs';
import { VisionService } from './vision.mjs';
import { StartupGreetingService } from '../../packages/greeting/index.mjs';
import { ContextService, ContextError } from '../../packages/context/index.mjs';
import { WebService } from '../../packages/web/index.mjs';
import { SpeechService, SpeechServiceError } from '../../packages/speech/index.mjs';
import { SpeechController, SpeechControlError } from '../../packages/speech/controller.mjs';
import { configureStartup, isStandbyLaunch, WindowsWakeService } from './startup.mjs';
import { GreetingMusicStore } from './greeting-music.mjs';
import { TRAY_ICON } from './tray-icon.mjs';
import { createUltronBridge } from '../../packages/ultron/index.mjs';
import { UltronCommands, UltronCommandError } from '../../packages/ultron/commands.mjs';
import { YouTubeController } from './youtube.mjs';
import { createYouTubeWindowFactory } from './youtube-window.mjs';
import { runYouTubeFixtureSmoke } from './youtube-smoke.mjs';

const PRODUCT = 'Projeto GleysonSilva-Jarvis';
const APP_ORIGIN = 'jarvis://app';
const APP_URL = `${APP_ORIGIN}/index.html`;
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PRELOAD = fileURLToPath(new URL('./preload.cjs', import.meta.url));
const ASSETS = new Map([['/index.html', 'text/html; charset=utf-8'], ['/app.js', 'text/javascript; charset=utf-8'], ['/app.css', 'text/css; charset=utf-8'], ['/voice-demo.mp3', 'audio/mpeg']]);
const APP_SLOTS = [['calculator', 'Calculadora'], ['notepad', 'Bloco de Notas'], ['vscode', 'VS Code'], ['browser', 'Navegador']];
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src https://api.openai.com; font-src 'self'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'";
class InputError extends Error {}
const invalid = message => { throw new InputError(message); };
const identifier = value => { if (typeof value !== 'string' || !/^[a-zA-Z0-9_.:-]{1,150}$/.test(value)) invalid('Identificador inválido.'); return value; };
const record = (value, limit = 200_000) => {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype || JSON.stringify(value).length > limit) invalid('Solicitação inválida ou muito grande.');
  return value;
};
const only = (value, keys) => { if (Object.keys(value).some(key => !keys.includes(key))) invalid('Argumento não permitido.'); return value; };
function webURL(value) {
  if (typeof value !== 'string' || value.length > 2048) invalid('Endereço inválido.');
  let parsed;
  try { parsed = new URL(value); } catch { invalid('Endereço inválido.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) invalid('Use somente um endereço HTTP(S), sem credenciais.');
  return parsed.href;
}
function timeout(promise, ms, message) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new InputError(message)), ms); })]).finally(() => clearTimeout(timer));
}

app.setName(PRODUCT);
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{ scheme: 'jarvis', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
let smoke;
if (process.argv.includes('--jarvis-smoke')) {
  try {
    const directory = process.env.JARVIS_SMOKE_DATA_DIR, token = process.env.JARVIS_SMOKE_TOKEN;
    if (typeof directory !== 'string' || !path.isAbsolute(directory) || !path.basename(directory).startsWith('jarvis-native-smoke-') || !/^[a-f0-9]{64}$/.test(token ?? '')) throw new Error('invalid_smoke_configuration');
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || readdirSync(directory).length) throw new Error('invalid_smoke_directory');
    const canonical = realpathSync.native(directory);
    app.setPath('userData', canonical); app.setPath('sessionData', canonical);
    delete process.env.OPENAI_API_KEY; delete process.env.ELEVENLABS_API_KEY;
    smoke = { token };
  } catch {
    console.error('[Jarvis] JARVIS_SMOKE_CONFIGURATION_INVALID'); app.exit(1);
  }
}
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let mainWindow, settings, runtime, provider, vision, startupService, contextService, contextFlight, speech, musicStore, wakeService, tray, youtube;
let startupStatus = { available: false, enabled: false }, standbyActive = false;
let generation = 0, shuttingDown = false, cleanupPromise, shutdownPromise, shutdownComplete = false, textRunId;
let ultronBridge, ultronFlight, ultronCommands;
const runs = new Map();
const knownRuns = new Map();
const approvals = new Map();
const browserWindows = new Map();
const connectionControllers = new Set();
const startupFlights = new Map();
const startupAttempts = new Map();

function greetingInput(input) {
  only(record(input, 1000), ['hour', 'timezone']);
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) invalid('Horário inválido para a saudação.');
  if (input.timezone !== undefined) {
    if (typeof input.timezone !== 'string' || input.timezone.length > 80 || !/^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)*$/.test(input.timezone)) invalid('Fuso horário inválido.');
    try { new Intl.DateTimeFormat('pt-BR', { timeZone: input.timezone }).format(); } catch { invalid('Fuso horário inválido.'); }
  }
  return { hour: input.hour, ...(input.timezone ? { timezone: input.timezone } : {}) };
}

function publish(event) {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send('jarvis:event', event);
}
function activeProfile(request = {}) {
  const profileId = settings.get().profileId;
  if (request.profileId !== undefined && request.profileId !== profileId) invalid('O perfil mudou. Inicie uma nova solicitação no perfil atual.');
  return profileId;
}
async function stopUltronBridge() {
  ultronCommands?.reset();
  const previous = ultronBridge; ultronBridge = undefined;
  await Promise.allSettled([previous?.close(), ultronFlight]);
}
async function startUltronBridge() {
  if (ultronBridge || smoke || shuttingDown || process.platform !== 'win32' || settings.get().ultronEnabled !== true) return;
  if (ultronFlight) return ultronFlight;
  const startGeneration = generation;
  const operation = (async () => {
    const bridge = await createUltronBridge({ dataDir: app.getPath('userData'), handle: (method, args, scope) => ultronCommands.run(method, args, scope) });
    if (shuttingDown || generation !== startGeneration || !settings.get().ultronEnabled) { await bridge.close(); return; }
    ultronBridge = bridge;
  })();
  const flight = operation.finally(() => { if (ultronFlight === flight) ultronFlight = undefined; });
  ultronFlight = flight;
  try { await flight; }
  catch { throw new InputError('Não foi possível iniciar a conexão privada com Ultron. Tente salvar a opção novamente.'); }
}
function runtimeEvent(event) {
  if (event.type === 'approval') approvals.set(event.approvalId, { profileId: event.profileId, runId: event.runId, generation });
  if (event.profileId !== settings.get().profileId) {
    if (event.type === 'approval') runtime.approve(event.approvalId, false);
    return;
  }
  publish(event);
}
function providerEvent(event) {
  const run = runs.get(event.runId);
  if (!run || run.generation !== generation || run.profileId !== settings.get().profileId || run.controller.signal.aborted) return;
  publish({ ...event, profileId: run.profileId });
}
function newRun(runId, profileId, kind) {
  const existing = runs.get(runId);
  if (existing) {
    if (existing.profileId !== profileId || existing.generation !== generation || existing.controller.signal.aborted) invalid('Esta execução foi interrompida. Inicie outra solicitação.');
    return existing;
  }
  if (knownRuns.has(runId) && knownRuns.get(runId) !== profileId) invalid('Identificador já usado em outro perfil.');
  const run = { controller: new AbortController(), profileId, generation, kind };
  runs.set(runId, run); knownRuns.set(runId, profileId);
  return run;
}
async function clearSessions(reason) {
  generation++;
  const ultronStopped = stopUltronBridge();
  youtube?.close();
  speech?.reset();
  const wakeStopped = wakeService?.stop(); standbyActive = false; updateTray();
  for (const [runId, run] of runs) { run.controller.abort(); runtime?.cancel(runId); }
  for (const controller of connectionControllers) controller.abort();
  connectionControllers.clear();
  contextFlight = undefined;
  startupFlights.clear();
  for (const [approvalId] of approvals) runtime?.approve(approvalId, false);
  approvals.clear(); runs.clear(); textRunId = undefined;
  await wakeStopped;
  await ultronStopped;
  for (const window of browserWindows.values()) if (!window.isDestroyed()) window.destroy();
  browserWindows.clear();
  await vision?.handle({ type: 'reset' }).catch(() => {});
  publish({ type: 'session.reset', reason });
}

function dedicatedBrowser(profileId) {
  const existing = browserWindows.get(profileId);
  if (existing && !existing.isDestroyed()) return existing;
  const browserSession = session.fromPartition(`persist:jarvis-browser-${profileId}`);
  browserSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  browserSession.setPermissionCheckHandler(() => false);
  browserSession.setDevicePermissionHandler(() => false);
  browserSession.on('will-download', event => event.preventDefault());
  const window = new BrowserWindow({ width: 1180, height: 820, title: `${PRODUCT} · Navegador dedicado`, autoHideMenuBar: true,
    webPreferences: { session: browserSession, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, devTools: false, navigateOnDragDrop: false, autoplayPolicy: 'document-user-activation-required' } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const allowNavigation = (event, url) => { try { webURL(url); } catch { event.preventDefault(); } };
  window.webContents.on('will-navigate', allowNavigation);
  window.webContents.on('will-redirect', allowNavigation);
  window.on('closed', () => browserWindows.delete(profileId));
  browserWindows.set(profileId, window);
  return window;
}
async function openBrowser(value, { signal } = {}) {
  const url = webURL(value);
  if (signal?.aborted) throw new InputError('Ação cancelada.');
  try {
    await shell.openExternal(url);
  } catch { throw new InputError('O Windows não conseguiu encaminhar o endereço ao navegador padrão.'); }
  if (signal?.aborted) throw new InputError('Ação cancelada.');
  return { dispatched: true, verified: false, url };
}
async function readBrowserSelection({ signal } = {}) {
  const window = browserWindows.get(settings.get().profileId);
  if (!window || window.isDestroyed()) throw new InputError('A seleção do navegador externo não está acessível. Peça para consultar o endereço do site.');
  if (signal?.aborted) throw new InputError('Leitura cancelada.');
  const url = webURL(window.webContents.getURL());
  // Constant script: model/page strings are never interpolated into executable code.
  const text = await timeout(window.webContents.executeJavaScript("window.getSelection()?.toString().slice(0, 20000) || ''", false), 3000, 'Não foi possível confirmar o trecho selecionado.');
  if (signal?.aborted || window.isDestroyed() || webURL(window.webContents.getURL()) !== url || typeof text !== 'string') throw new InputError('A página mudou durante a leitura. Selecione novamente o trecho.');
  return { verified: true, url, title: window.webContents.getTitle().slice(0, 300), text: text.slice(0, 20000) };
}
async function openProject(workspaceRoot, { signal } = {}) {
  const editor = settings.get().apps.find(item => item.id === 'vscode');
  if (!editor) throw new InputError('Cadastre o executável do VS Code nas configurações.');
  if (signal?.aborted) throw new InputError('Ação cancelada.');
  await access(editor.path);
  const child = spawn(editor.path, ['--reuse-window', workspaceRoot], { shell: false, windowsHide: true, stdio: 'ignore', detached: false });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', () => reject(new InputError('Não foi possível iniciar o editor cadastrado.'))); });
  // Starting the process does not prove which folder the editor displayed.
  return { verified: false, summary: 'A abertura foi solicitada ao editor cadastrado; a pasta exibida ainda não foi confirmada.' };
}

function trustedSender(event) {
  const frame = event.senderFrame;
  return !!mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents && frame === mainWindow.webContents.mainFrame && frame?.origin === APP_ORIGIN && frame.url === APP_URL;
}
function handle(name, fn) {
  ipcMain.handle(`jarvis:${name}`, async (event, input) => {
    if (!trustedSender(event)) throw new Error('Solicitação de uma origem não autorizada.');
    if (shuttingDown) throw new Error('O aplicativo está encerrando.');
    try { return await fn(input); }
    catch (error) {
      if (error instanceof InputError || error instanceof ContextError || error instanceof OpenAIServiceError || error instanceof SpeechServiceError || error instanceof SpeechControlError || error instanceof UltronCommandError) throw new Error(error.message);
      // Native errors may include OS paths, command arguments or credentials.
      throw new Error('A operação não pôde ser concluída. Revise a configuração e o histórico local.');
    }
  });
}
function registerIPC() {
  handle('ultronPlaybackResult', input => ultronCommands?.finish(input) ?? false);
  handle('cancelUltron', input => { if (input != null) only(record(input, 100), []); ultronCommands?.reset(); return { cancelled: true }; });
  handle('getFullscreen', input => {
    if (input != null) only(record(input, 100), []);
    return mainWindow.isFullScreen();
  });
  handle('setFullscreen', enabled => {
    if (typeof enabled !== 'boolean') invalid('Estado de tela cheia inválido.');
    mainWindow.setFullScreen(enabled);
    return mainWindow.isFullScreen();
  });
  handle('readContext', async input => {
    only(record(input, 1000), ['timezone']);
    contextFlight?.abort();
    const controller = new AbortController(), profileId = settings.get().profileId, startGeneration = generation;
    contextFlight = controller; connectionControllers.add(controller);
    try {
      const result = await contextService.read(input, { signal: controller.signal });
      if (controller.signal.aborted || generation !== startGeneration || settings.get().profileId !== profileId) invalid('A leitura do contexto foi interrompida.');
      return result;
    } finally { if (contextFlight === controller) contextFlight = undefined; connectionControllers.delete(controller); }
  });
  handle('cancelContext', input => {
    if (input != null) only(record(input, 100), []);
    const controller = contextFlight;
    controller?.abort(); contextFlight = undefined;
    return { cancelled: Boolean(controller) };
  });
  handle('boot', async () => ({ settings: { ...settings.public(), hasGreetingMusic: musicStore.available() }, snapshot: runtime.getSnapshot(settings.get().profileId), capabilities: { desktop: process.platform === 'win32', vision: (await vision.handle({ type: 'status' })).available === true, startup: startupStatus.available, voiceWake: process.platform === 'win32', jarvisSpeech: true, ultronBridge: process.platform === 'win32' && !smoke }, startup: startupStatus, productName: PRODUCT }));
  handle('saveSettings', async input => {
    only(record(input, 5000), ['profileId', 'textModel', 'realtimeModel', 'voice', 'maxSessionMinutes', 'apiKey', 'startupGreeting', 'weatherLocation', 'elevenVoiceId', 'elevenApiKey', 'startAtLogin', 'standbyEnabled', 'wakeClapEnabled', 'wakeVoiceEnabled', 'greetingMusicEnabled', 'receptionOutfitEnabled', 'receptionVoiceEnabled', 'continuousVoiceEnabled', 'ultronEnabled']);
    validateSettings(input);
    for (const field of ['apiKey', 'elevenApiKey']) if (input[field] !== undefined && (typeof input[field] !== 'string' || input[field].length > 512 || /[\r\n\0]/.test(input[field]))) invalid('Chave inválida.');
    await clearSessions(input.profileId && input.profileId !== settings.get().profileId ? 'profile_changed' : 'settings_changed');
    settings.save(input);
    startupStatus = configureStartup(app, settings.get());
    updateTray();
    await startUltronBridge();
    return settings.public();
  });
  handle('speak', input => speech.speak(input));
  handle('cancelGreeting', () => {
    const profileId = settings.get().profileId, controller = startupFlights.get(profileId);
    if (controller) { controller.abort(); startupFlights.delete(profileId); connectionControllers.delete(controller); }
    return { cancelled: Boolean(controller) };
  });
  handle('cancelSpeech', input => { only(record(input, 1000), ['runId']); return speech.cancel(input); });
  handle('wakeStart', async () => {
    const current = settings.get();
    if (!current.standbyEnabled) return { available: false, running: false, state: 'disabled' };
    standbyActive = true; updateTray();
    if (!current.wakeVoiceEnabled) return { available: true, running: false, state: 'clap_only' };
    return wakeService.start();
  });
  handle('wakeStop', async () => { standbyActive = false; updateTray(); return wakeService.stop(); });
  handle('chooseGreetingMusic', async () => {
    const selected = await dialog.showOpenDialog(mainWindow, { title: 'Escolha a trilha da saudação', properties: ['openFile'], filters: [{ name: 'Áudio', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }] });
    if (selected.canceled || !selected.filePaths[0]) return { hasGreetingMusic: musicStore.available() };
    return musicStore.importFile(selected.filePaths[0]);
  });
  handle('chooseWorkspace', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Escolha a pasta que Jarvis pode organizar', properties: ['openDirectory', 'createDirectory'], buttonLabel: 'Autorizar esta pasta' });
    if (result.canceled || !result.filePaths[0]) return null;
    try { runtime.setWorkspace(result.filePaths[0]); } catch (error) { throw new InputError(error.message); }
    settings.write({ workspaceRoot: result.filePaths[0] });
    return result.filePaths[0];
  });
  handle('chooseApp', async () => {
    if (process.platform !== 'win32') invalid('O cadastro de executáveis deste MVP exige Windows.');
    const slot = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Cadastrar aplicativo', message: 'Qual integração este executável deve usar?', buttons: [...APP_SLOTS.map(([, label]) => label), 'Cancelar'], cancelId: 4, noLink: true });
    if (slot.response >= APP_SLOTS.length) return null;
    const [id, label] = APP_SLOTS[slot.response];
    const result = await dialog.showOpenDialog(mainWindow, { title: `Escolha o executável de ${label}`, properties: ['openFile'], filters: [{ name: 'Aplicativo Windows', extensions: ['exe'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const selected = result.filePaths[0], stat = await lstat(selected);
    if (!stat.isFile() || stat.isSymbolicLink() || path.extname(selected).toLowerCase() !== '.exe') invalid('Selecione um executável Windows comum.');
    const executable = await realpath(selected);
    settings.write({ apps: [...settings.get().apps.filter(item => item.id !== id), { id, label, path: executable }] });
    return { id, label };
  });
  handle('text', async input => {
    only(record(input), ['text', 'history', 'profileId', 'runId']);
    const profileId = activeProfile(input), runId = identifier(input.runId);
    if (textRunId) invalid('Uma resposta já está em andamento. Interrompa-a antes de enviar outra.');
    const run = newRun(runId, profileId, 'text'); textRunId = runId;
    try { return await provider.respond({ text: input.text, history: input.history, profileId, runId }, { signal: run.controller.signal }); }
    finally { if (textRunId === runId) textRunId = undefined; if (runs.get(runId) === run) runs.delete(runId); }
  });
  handle('cancel', async runId => {
    identifier(runId);
    if (knownRuns.get(runId) !== settings.get().profileId) return false;
    runs.get(runId)?.controller.abort();
    runtime.cancel(runId);
    for (const [approvalId, entry] of approvals) if (entry.runId === runId) { runtime.approve(approvalId, false); approvals.delete(approvalId); publish({ type: 'approval', approvalId, runId, status: 'cancelled' }); }
    return true;
  });
  handle('callTool', async input => {
    only(record(input, 100_000), ['id', 'name', 'args', 'profileId', 'runId']);
    const profileId = activeProfile(input), runId = identifier(input.runId), id = identifier(input.id);
    const run = newRun(runId, profileId, 'tool');
    return provider.executeRealtimeTool({ id, name: input.name, args: input.args, profileId, runId }, { signal: run.controller.signal });
  });
  handle('approve', async input => {
    only(record(input, 1000), ['approvalId', 'allow']);
    identifier(input.approvalId);
    const entry = approvals.get(input.approvalId);
    if (!entry || entry.profileId !== settings.get().profileId || entry.generation !== generation || typeof input.allow !== 'boolean') invalid('Esta autorização expirou ou pertence a outro perfil.');
    approvals.delete(input.approvalId);
    const result = runtime.approve(input.approvalId, input.allow);
    publish({ type: 'approval', approvalId: input.approvalId, runId: entry.runId, status: input.allow ? 'approved' : 'denied' });
    return result;
  });
  handle('memorySave', input => { only(record(input, 5000), ['profileId', 'text', 'id']); return runtime.saveMemory({ ...input, profileId: activeProfile(input) }); });
  handle('memoryDelete', input => { only(record(input, 1000), ['profileId', 'id']); return runtime.deleteMemory(activeProfile(input), identifier(input.id)); });
  handle('realtimeSession', async input => {
    only(record(input, 130_000), ['profileId', 'sdp']);
    const profileId = activeProfile(input), controller = new AbortController(), sessionGeneration = generation;
    if (!settings.getElevenSecret() || !settings.get().elevenVoiceId) invalid('Configure a voz Jarvis e a chave ElevenLabs antes de iniciar a conversa.');
    connectionControllers.add(controller);
    try {
      await wakeService.stop();
      if (controller.signal.aborted || sessionGeneration !== generation || settings.get().profileId !== profileId) invalid('A configuração mudou. Inicie outra sessão.');
      const result = await provider.createRealtimeSession({ sdp: input.sdp, profileId }, { signal: controller.signal });
      if (controller.signal.aborted || sessionGeneration !== generation) invalid('A configuração mudou. Inicie outra sessão.');
      return result;
    } finally { connectionControllers.delete(controller); }
  });
  handle('listModels', async () => provider.listModels());
  handle('startupGreeting', async input => {
    const payload = greetingInput(input), profileId = settings.get().profileId, startGeneration = generation;
    if (startupFlights.has(profileId)) invalid('Uma saudação já está sendo preparada.');
    if (settings.get().startupGreeting === true) {
      const timestamp = Date.now(), attempts = (startupAttempts.get(profileId) ?? []).filter(at => timestamp - at < 3_600_000);
      if (attempts.length >= 6 || (attempts.length && timestamp - attempts.at(-1) < 60_000)) invalid('Aguarde um minuto para testar outra saudação. Limite de seis por hora.');
      attempts.push(timestamp); startupAttempts.set(profileId, attempts);
    }
    const controller = new AbortController(); startupFlights.set(profileId, controller); connectionControllers.add(controller);
    try {
      const result = await startupService.prepare(payload, { signal: controller.signal });
      if (controller.signal.aborted || generation !== startGeneration || settings.get().profileId !== profileId) invalid('A configuração mudou. A saudação anterior foi interrompida.');
      return result;
    } finally { if (startupFlights.get(profileId) === controller) startupFlights.delete(profileId); connectionControllers.delete(controller); }
  });
  handle('vision', async input => {
    record(input, 2_701_000);
    const profileId = activeProfile(input);
    if (['enroll', 'delete'].includes(input.type)) return vision.handle({ ...input, profileId });
    return vision.handle(input);
  });
  handle('openExternal', async value => {
    // This bridge is used by explicit clicks in the trusted local interface.
    // Model-initiated navigation continues through the reviewed browser_open tool.
    await shell.openExternal(webURL(value)); return true;
  });
}

async function cleanup(reason = 'window_closed') {
  if (cleanupPromise) return cleanupPromise;
  shuttingDown = true;
  cleanupPromise = (async () => {
    try { await clearSessions(reason); }
    finally {
      await Promise.allSettled([
        Promise.resolve().then(() => vision?.close()),
        Promise.resolve().then(() => { tray?.destroy(); tray = undefined; }),
        Promise.resolve().then(() => runtime?.close()),
      ]);
    }
  })();
  return cleanupPromise;
}

function requestShutdown(reason = 'window_closed') {
  if (shutdownPromise) return shutdownPromise;
  shuttingDown = true;
  shutdownPromise = (async () => {
    // Stop playback and renderer-owned capture immediately, before any worker awaits.
    if (mainWindow && !mainWindow.isDestroyed()) {
      try { mainWindow.webContents.setAudioMuted(true); } catch { /* Destruction still stops the renderer. */ }
      try { mainWindow.destroy(); } catch { console.error('[Jarvis] JARVIS_WINDOW_DESTROY_FAILED'); }
    }
    try { await cleanup(reason); }
    catch { console.error('[Jarvis] JARVIS_SHUTDOWN_FAILED'); }
    finally { shutdownComplete = true; app.quit(); }
  })();
  return shutdownPromise;
}

async function startApplication() {
  app.on('second-instance', () => { if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  await app.whenReady();
  const userData = app.getPath('userData');
  settings = new SettingsStore(userData, safeStorage);
  musicStore = new GreetingMusicStore({ dataDir: userData });
  if (!smoke) startupStatus = configureStartup(app, settings.get());
  wakeService = new WindowsWakeService({ onWake: event => { if (!standbyActive || shuttingDown) return; mainWindow?.show(); mainWindow?.focus(); publish({ type: 'wake.trigger', source: event.source }); }, onState: state => publish({ type: 'wake.status', ...state }) });
  speech = new SpeechController({ service: new SpeechService({ getSettings: () => settings.get(), getKey: () => settings.getElevenSecret() }), getProfile: () => settings.get().profileId });
  const fallbackWorkspace = path.join(userData, 'workspace');
  await mkdir(fallbackWorkspace, { recursive: true });
  let workspaceRoot = settings.get().workspaceRoot || fallbackWorkspace;
  const windows = createWindowsAdapters({ getApps: () => settings.get().apps, openExternal: url => shell.openExternal(webURL(url)),
    openPath: folder => shell.openPath(folder), getKnownFolder: name => app.getPath(name) });
  youtube = new YouTubeController({ getProfileId: () => settings.get().profileId,
    createWindow: createYouTubeWindowFactory({ BrowserWindow, session, product: PRODUCT }) });
  const web = new WebService();
  const adapters = { ...windows, openBrowser, readBrowserSelection, openProject,
    searchYouTube: (query, options) => youtube.search(query, options),
    playYouTube: (videoId, options) => youtube.play(videoId, options),
    controlYouTube: (action, options) => youtube.control(action, options),
    readWebsite: (input, options) => web.read(input, options),
    searchWeb: (input, options) => provider.searchWeb(input, options),
    readWeather: options => startupService.readWeather({}, { ...options, refresh: true }) };
  try { runtime = createRuntime({ dataDir: path.join(userData, 'runtime'), workspaceRoot, platformAdapters: adapters, onEvent: runtimeEvent }); }
  catch {
    workspaceRoot = fallbackWorkspace;
    runtime = createRuntime({ dataDir: path.join(userData, 'runtime'), workspaceRoot, platformAdapters: adapters, onEvent: runtimeEvent });
  }
  settings.write({ workspaceRoot });
  provider = new OpenAIService({ getKey: () => settings.getSecret(), getSettings: () => settings.get(), runtime, onEvent: providerEvent });
  startupService = new StartupGreetingService({ getSettings: () => settings.get(), getKey: () => settings.getElevenSecret() });
  ultronCommands = new UltronCommands({
    getSettings: () => ({ ...settings.get(), hasElevenKey: Boolean(settings.getElevenSecret()) }),
    getVersion: () => app.getVersion?.() || '0.6.2', emit: publish,
    isWindowAvailable: () => Boolean(mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()),
    readWeather: options => startupService.readWeather({}, options),
    openBrowser: ({ signal }) => runtime.call({ id: randomUUID(), runId: `ultron-${randomUUID()}`, profileId: settings.get().profileId, name: 'apps_open', args: { appId: 'browser' } }, { signal }),
    openWebsite: (url, { signal }) => runtime.call({ id: randomUUID(), runId: `ultron-${randomUUID()}`, profileId: settings.get().profileId, name: 'browser_open', args: { url } }, { signal }),
  });
  contextService = new ContextService({ weather: startupService, getProfileId: () => settings.get().profileId, getSnapshot: profileId => runtime.getSnapshot(profileId) });
  vision = new VisionService({ dataDir: path.join(userData, 'vision'), modelsDir: path.join(userData, 'models'), crypto: safeStorage, ...(app.isPackaged ? { workerPath: path.join(process.resourcesPath, 'vision', 'worker.py') } : {}) });
  protocol.handle('jarvis', async request => {
    const url = new URL(request.url), mime = ASSETS.get(url.pathname);
    if (url.protocol === 'jarvis:' && url.host === 'app' && url.pathname === '/greeting-music' && request.method === 'GET' && !url.search) {
      const music = await musicStore.read();
      return music ? new Response(music.bytes, { headers: { 'Content-Type': music.mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }) : new Response('Not found', { status: 404 });
    }
    // Node's URL.origin is "null" for custom schemes, even when Chromium registered a standard origin.
    if (url.protocol !== 'jarvis:' || url.host !== 'app' || !mime || request.method !== 'GET' || url.search) return new Response('Not found', { status: 404 });
    try {
      const body = await readFile(path.join(ROOT, 'dist', path.basename(url.pathname)));
      return new Response(body, { headers: { 'Content-Type': mime, 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(self), microphone=(self)', 'Cache-Control': 'no-store' } });
    } catch { return new Response('Compile a interface antes de iniciar o aplicativo.', { status: 503 }); }
  });
  mainWindow = new BrowserWindow({ width: 1460, height: 960, minWidth: 960, minHeight: 700, title: PRODUCT, backgroundColor: '#030d10', autoHideMenuBar: true, show: !smoke && (!isStandbyLaunch() || !settings.get().standbyEnabled),
    webPreferences: { preload: PRELOAD, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, navigateOnDragDrop: false, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false } });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(!smoke && contents === mainWindow?.webContents && permission === 'media' && details.isMainFrame === true && details.requestingUrl === APP_URL));
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => !smoke && contents === mainWindow?.webContents && permission === 'media' && details.isMainFrame === true && details.requestingUrl === APP_URL && requestingOrigin.replace(/\/$/, '') === APP_ORIGIN);
  session.defaultSession.setDevicePermissionHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== APP_URL) event.preventDefault(); });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('render-process-gone', () => { if (!shuttingDown) { void clearSessions('renderer_closed'); vision.close(); } });
  const publishFullscreen = () => {
    if (!shuttingDown && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send('jarvis:fullscreen', mainWindow.isFullScreen());
  };
  mainWindow.on('enter-full-screen', publishFullscreen);
  mainWindow.on('leave-full-screen', publishFullscreen);
  mainWindow.on('close', event => { if (!shutdownComplete) { event.preventDefault(); void requestShutdown('window_closed'); } });
  app.on('before-quit', event => { if (!shutdownComplete) { event.preventDefault(); void requestShutdown('app_quit'); } });
  app.on('window-all-closed', () => { if (!shuttingDown) void requestShutdown('all_windows_closed'); });
  registerIPC();
  if (process.platform === 'win32' && !smoke) { try { tray = new Tray(nativeImage.createFromBuffer(Buffer.from(TRAY_ICON, 'base64'))); tray.setToolTip(PRODUCT); tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); }); updateTray(); } catch { tray = undefined; mainWindow.show(); } }
  await mainWindow.loadURL(APP_URL);
  try { await startUltronBridge(); } catch { publish({ type: 'ultron.status', state: 'unavailable' }); }
  if (smoke) {
    const result = await timeout(mainWindow.webContents.executeJavaScript(`(async () => {
      const deadline = Date.now() + 15000;
      while (!document.querySelector('#root .app-shell') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
      const dom = !!document.querySelector('#root .app-shell');
      const preload = typeof window.jarvis?.boot === 'function';
      const data = preload ? await window.jarvis.boot() : null;
      const fullscreenButton = document.querySelector('button.fullscreen-button');
      const waitFullscreen = async enabled => {
        const limit = Date.now() + 3000;
        while (Date.now() < limit) {
          if (await window.jarvis.getFullscreen() === enabled && fullscreenButton?.getAttribute('aria-pressed') === String(enabled)) return true;
          await new Promise(resolve => setTimeout(resolve, 25));
        }
        return false;
      };
      let fullscreen = false;
      if (fullscreenButton && typeof window.jarvis?.getFullscreen === 'function' && typeof window.jarvis?.setFullscreen === 'function') {
        await new Promise(resolve => setTimeout(resolve, 50));
        fullscreenButton.click();
        const entered = await waitFullscreen(true);
        fullscreenButton.click();
        fullscreen = entered && await waitFullscreen(false);
      }
      return { dom, preload, fullscreen, boot: !!(data && typeof data.settings?.profileId === 'string' && Array.isArray(data.snapshot?.memories) && Array.isArray(data.snapshot?.tasks) && typeof data.capabilities?.desktop === 'boolean') };
    })()`, false), 20000, 'JARVIS_SMOKE_TIMEOUT');
    if (!result?.dom || !result?.preload || !result?.boot || !result?.fullscreen) throw new Error('JARVIS_SMOKE_NOT_READY');
    result.youtube = await runYouTubeFixtureSmoke({ BrowserWindow, session, product: PRODUCT });
    process.stdout.write(`JARVIS_NATIVE_SMOKE=${JSON.stringify({ token: smoke.token, ready: app.isReady(), window: !mainWindow.isDestroyed(), ...result, packaged: app.isPackaged })}\n`);
    await cleanup('smoke_test'); app.exit(0);
  }
}

async function handleStartupFailure(error) {
  const message = 'Não foi possível iniciar o Jarvis. O aplicativo será encerrado. Tente abrir novamente; se o problema persistir, informe o código JARVIS_STARTUP_FAILED.';
  console.error('[Jarvis] JARVIS_STARTUP_FAILED');
  if (smoke) process.stdout.write(`JARVIS_NATIVE_SMOKE=${JSON.stringify({ token: smoke.token, ready: false, error: /^JARVIS_YOUTUBE_FIXTURE_(SEARCH|PLAY|PAUSE|RESUME)_FAILED$/.test(error?.message || '') ? error.message : 'JARVIS_STARTUP_FAILED' })}\n`);
  else try { dialog.showErrorBox(PRODUCT, message); } catch { /* The fixed diagnostic above is also available to the launcher. */ }
  try { await cleanup('startup_failed'); } catch { /* Exit still releases native resources when initialization was incomplete. */ }
  app.exit(1);
}

// Electron waits for ESM entry evaluation before emitting ready. Waiting at module
// scope would therefore prevent the very event that startApplication needs.
if (singleInstance) void startApplication().catch(handleStartupFailure);

function updateTray() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Jarvis', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: standbyActive ? 'Pausar espera' : 'Ativar espera', enabled: settings.get().standbyEnabled, click: () => { const active = standbyActive; if (active) { standbyActive = false; void wakeService.stop(); } publish({ type: active ? 'standby.pause' : 'standby.resume' }); updateTray(); } },
    { type: 'separator' }, { label: 'Sair', click: () => { void requestShutdown('app_quit'); } },
  ]));
}
