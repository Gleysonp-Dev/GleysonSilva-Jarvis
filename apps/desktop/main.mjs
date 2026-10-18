import { app, BrowserWindow, dialog, ipcMain, protocol, safeStorage, session, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, mkdir, lstat, realpath, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRuntime } from '../../packages/runtime/index.mjs';
import { OpenAIService, OpenAIServiceError } from '../../packages/openai/index.mjs';
import { SettingsStore, validateSettings } from './settings.mjs';
import { createWindowsAdapters } from './platform/windows.mjs';
import { VisionService } from './vision.mjs';
import { StartupGreetingService } from '../../packages/greeting/index.mjs';

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
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let mainWindow, settings, runtime, provider, vision, startupService;
let generation = 0, shuttingDown = false, cleanupPromise, textRunId;
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
  for (const [runId, run] of runs) { run.controller.abort(); runtime?.cancel(runId); }
  for (const controller of connectionControllers) controller.abort();
  connectionControllers.clear();
  startupFlights.clear();
  for (const [approvalId] of approvals) runtime?.approve(approvalId, false);
  approvals.clear(); runs.clear(); textRunId = undefined;
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
  const profileId = settings.get().profileId;
  const window = dedicatedBrowser(profileId);
  const stop = () => { if (!window.isDestroyed()) window.webContents.stop(); };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    await timeout(window.loadURL(url), 20_000, 'O navegador não confirmou a navegação no prazo.');
    if (signal?.aborted || window.isDestroyed()) throw new InputError('Ação cancelada.');
    const finalURL = webURL(window.webContents.getURL());
    window.show(); window.focus();
    return { verified: true, url: finalURL, title: window.webContents.getTitle().slice(0, 300) };
  } finally { signal?.removeEventListener('abort', stop); }
}
async function readBrowserSelection({ signal } = {}) {
  const window = browserWindows.get(settings.get().profileId);
  if (!window || window.isDestroyed()) throw new InputError('Abra uma página no navegador dedicado e selecione o trecho que deseja compartilhar.');
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
      if (error instanceof InputError || error instanceof OpenAIServiceError) throw new Error(error.message);
      // Native errors may include OS paths, command arguments or credentials.
      throw new Error('A operação não pôde ser concluída. Revise a configuração e o histórico local.');
    }
  });
}
function registerIPC() {
  handle('boot', async () => ({ settings: settings.public(), snapshot: runtime.getSnapshot(settings.get().profileId), capabilities: { desktop: process.platform === 'win32', vision: (await vision.handle({ type: 'status' })).available === true }, productName: PRODUCT }));
  handle('saveSettings', async input => {
    only(record(input, 5000), ['profileId', 'textModel', 'realtimeModel', 'voice', 'maxSessionMinutes', 'apiKey', 'startupGreeting', 'weatherLocation', 'elevenVoiceId', 'elevenApiKey']);
    validateSettings(input);
    for (const field of ['apiKey', 'elevenApiKey']) if (input[field] !== undefined && (typeof input[field] !== 'string' || input[field].length > 512 || /[\r\n\0]/.test(input[field]))) invalid('Chave inválida.');
    await clearSessions(input.profileId && input.profileId !== settings.get().profileId ? 'profile_changed' : 'settings_changed');
    settings.save(input);
    return settings.public();
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
    connectionControllers.add(controller);
    try {
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
    const url = new URL(webURL(value));
    if (url.protocol !== 'https:' || !['github.com', 'developers.openai.com', 'platform.openai.com', 'docs.opencv.org', 'www.electronjs.org'].includes(url.hostname)) invalid('Este link externo não está na lista de documentação permitida.');
    await shell.openExternal(url.href); return true;
  });
}

async function cleanup(reason = 'window_closed') {
  if (cleanupPromise) return cleanupPromise;
  shuttingDown = true;
  cleanupPromise = (async () => { await clearSessions(reason); vision?.close(); await runtime?.close(); })();
  return cleanupPromise;
}

if (singleInstance) {
  app.on('second-instance', () => { if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  await app.whenReady();
  const userData = app.getPath('userData');
  settings = new SettingsStore(userData, safeStorage);
  const fallbackWorkspace = path.join(userData, 'workspace');
  await mkdir(fallbackWorkspace, { recursive: true });
  let workspaceRoot = settings.get().workspaceRoot || fallbackWorkspace;
  const windows = createWindowsAdapters({ getApps: () => settings.get().apps, openExternal: url => shell.openExternal(webURL(url)) });
  const adapters = { ...windows, openBrowser, readBrowserSelection, openProject };
  try { runtime = createRuntime({ dataDir: path.join(userData, 'runtime'), workspaceRoot, platformAdapters: adapters, onEvent: runtimeEvent }); }
  catch {
    workspaceRoot = fallbackWorkspace;
    runtime = createRuntime({ dataDir: path.join(userData, 'runtime'), workspaceRoot, platformAdapters: adapters, onEvent: runtimeEvent });
  }
  settings.write({ workspaceRoot });
  provider = new OpenAIService({ getKey: () => settings.getSecret(), getSettings: () => settings.get(), runtime, onEvent: providerEvent });
  startupService = new StartupGreetingService({ getSettings: () => settings.get(), getKey: () => settings.getElevenSecret() });
  vision = new VisionService({ dataDir: path.join(userData, 'vision'), modelsDir: path.join(userData, 'models'), crypto: safeStorage, ...(app.isPackaged ? { workerPath: path.join(process.resourcesPath, 'vision', 'worker.py') } : {}) });
  protocol.handle('jarvis', async request => {
    const url = new URL(request.url), mime = ASSETS.get(url.pathname);
    // Node's URL.origin is "null" for custom schemes, even when Chromium registered a standard origin.
    if (url.protocol !== 'jarvis:' || url.host !== 'app' || !mime || request.method !== 'GET' || url.search) return new Response('Not found', { status: 404 });
    try {
      const body = await readFile(path.join(ROOT, 'dist', path.basename(url.pathname)));
      return new Response(body, { headers: { 'Content-Type': mime, 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(self), microphone=(self)', 'Cache-Control': 'no-store' } });
    } catch { return new Response('Compile a interface antes de iniciar o aplicativo.', { status: 503 }); }
  });
  mainWindow = new BrowserWindow({ width: 1460, height: 960, minWidth: 960, minHeight: 700, title: PRODUCT, backgroundColor: '#030d10', autoHideMenuBar: true,
    webPreferences: { preload: PRELOAD, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, navigateOnDragDrop: false, autoplayPolicy: 'no-user-gesture-required' } });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(contents === mainWindow?.webContents && permission === 'media' && details.isMainFrame === true && details.requestingUrl === APP_URL));
  session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => contents === mainWindow?.webContents && permission === 'media' && details.isMainFrame === true && details.requestingUrl === APP_URL && requestingOrigin.replace(/\/$/, '') === APP_ORIGIN);
  session.defaultSession.setDevicePermissionHandler(() => false);
  session.defaultSession.on('will-download', event => event.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => { if (url !== APP_URL) event.preventDefault(); });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('render-process-gone', () => { void clearSessions('renderer_closed'); vision.close(); });
  mainWindow.on('close', event => { if (!shuttingDown) { event.preventDefault(); void cleanup().finally(() => { if (!mainWindow.isDestroyed()) mainWindow.destroy(); app.quit(); }); } });
  app.on('before-quit', event => { if (!shuttingDown) { event.preventDefault(); void cleanup().finally(() => app.quit()); } });
  app.on('window-all-closed', () => app.quit());
  registerIPC();
  await mainWindow.loadURL(APP_URL);
}
