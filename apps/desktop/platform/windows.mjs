import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, win32 } from 'node:path';
import { access, realpath, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const helper = fileURLToPath(new URL('./windows.ps1', import.meta.url)).replace(/([\\/])app\.asar([\\/])/i, '$1app.asar.unpacked$2');
const AUMID = /^[A-Za-z0-9][A-Za-z0-9_.!{}-]{0,255}$/;
const APP_ID = /^winapp-[a-f0-9]{64}$/;
const DEFAULT_BROWSER_URL = 'https://www.google.com/';
const ALIASES = new Map([
 ['desktop', 'desktop'], ['area de trabalho', 'desktop'],
 ['documents', 'documents'], ['documentos', 'documents'], ['meus documentos', 'documents'],
 ['downloads', 'downloads'], ['transferencias', 'downloads'],
 ['music', 'music'], ['musica', 'music'], ['musicas', 'music'],
 ['pictures', 'pictures'], ['imagens', 'pictures'], ['fotos', 'pictures'],
 ['videos', 'videos'], ['home', 'home'], ['pasta pessoal', 'home'], ['inicio', 'home'],
 ['temp', 'temp'], ['temporarios', 'temp'],
]);
const FOLDER_LABELS = { desktop: 'Área de Trabalho', documents: 'Documentos', downloads: 'Downloads', music: 'Músicas', pictures: 'Imagens', videos: 'Vídeos', home: 'Pasta pessoal', temp: 'Temporários' };
const normalize = value => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
const cancelled = signal => { if (signal?.aborted) throw new Error('Ação cancelada.'); };
const labelOf = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 160) : '';

// Never allow URLs, UNC/device paths, drive-relative paths or NTFS streams.
function localPath(value) {
 if (typeof value !== 'string' || value.length > 4096 || !/^[A-Za-z]:[\\/]/.test(value) || /[\u0000-\u001f\u007f<>"|?*]/.test(value) || value.slice(2).includes(':')) throw new Error('Informe um caminho absoluto de uma pasta ou aplicativo local.');
 const path = win32.normalize(value);
 for (const part of path.slice(3).split('\\').filter(Boolean)) {
  if (/[. ]$/.test(part) || /^(?:CON(?:IN\$|OUT\$)?|PRN|AUX|NUL|CLOCK\$|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part.normalize('NFKC'))) throw new Error('Caminho de dispositivo não permitido.');
 }
 return path;
}
function queryText(value) {
 if (typeof value !== 'string' || !value.trim() || value.length > 120 || /[\u0000-\u001f\u007f:;&|`<>"\\/]/.test(value) || /(?:^|\s)--?[A-Za-z]/.test(value) || /\.(?:ps1|cmd|bat|vbs|js|url|lnk)(?:\s|$)/i.test(value)) throw new Error('Informe somente o nome do aplicativo, sem caminho, URL ou comandos.');
 return normalize(value);
}

export function createWindowsAdapters({ getApps = () => [], openExternal, openPath, getKnownFolder, spawnImpl = spawn, platform = process.platform, fsImpl = { access, realpath, stat }, now = () => new Date() } = {}) {
 const applications = new Map();
 const windowsOnly = () => { if (platform !== 'win32') throw new Error('Esta integração exige Windows.'); };

 async function canonicalPath(value, kind, signal) {
  cancelled(signal); const requested = localPath(value);
  if (kind === 'exe' && win32.extname(requested).toLowerCase() !== '.exe') throw new Error('O aplicativo não corresponde a um executável local.');
  let canonical, info;
  try { canonical = localPath(await fsImpl.realpath(requested)); cancelled(signal); info = await fsImpl.stat(canonical); }
  catch { cancelled(signal); throw new Error(kind === 'folder' ? 'Não foi possível confirmar uma pasta local existente.' : 'Não foi possível confirmar o executável local.'); }
  cancelled(signal);
  if (kind === 'folder' ? !info.isDirectory() : !info.isFile() || win32.extname(canonical).toLowerCase() !== '.exe') throw new Error(kind === 'folder' ? 'O caminho não corresponde a uma pasta existente.' : 'O aplicativo não corresponde a um executável local.');
  return canonical;
 }

 async function run(action, payload, { signal } = {}, mode = 'legacy') {
  windowsOnly(); cancelled(signal);
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  return new Promise((resolve, reject) => {
   let child, out = '', settled = false, timer;
   const finish = (error, value) => {
    if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
    if (error) reject(error); else resolve(value);
   };
   const abort = () => { finish(new Error('Ação cancelada.')); child?.kill(); };
   try {
    child = spawnImpl(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', helper, '-Action', action, '-Payload', encoded], { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
   } catch { finish(new Error('Não foi possível iniciar a integração Windows.')); return; }
   timer = setTimeout(() => { finish(new Error('O Windows não confirmou a ação no prazo.')); child.kill(); }, 18000);
   signal?.addEventListener('abort', abort, { once: true });
   child.stdout.on('data', data => {
    if (settled) return;
    out += data.toString('utf8');
    if (out.length > (mode === 'inventory' ? 1_000_000 : 64_000)) { finish(new Error('A integração Windows excedeu o limite de resposta.')); child.kill(); }
   });
   child.stderr.resume();
   child.on('error', () => finish(new Error(signal?.aborted ? 'Ação cancelada.' : 'Não foi possível iniciar a integração Windows.')));
   child.on('close', code => {
    if (settled) return;
    try {
     const result = JSON.parse(out.trim());
     if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
     if (code || (mode === 'legacy' && result.verified !== true)) { finish(new Error(labelOf(result.summary) || 'Não foi possível confirmar a ação.')); return; }
     if (mode === 'inventory' && !Array.isArray(result.apps)) throw new Error();
     finish(null, result);
    } catch { finish(new Error('A integração Windows não retornou uma confirmação válida.')); }
   });
   if (signal?.aborted) abort();
  });
 }

 async function register(raw, signal) {
  if (!raw || typeof raw !== 'object' || !labelOf(raw.label)) return null;
  let target, kind;
  if (raw.kind === 'aumid' && typeof raw.aumid === 'string' && AUMID.test(raw.aumid)) { target = raw.aumid; kind = 'aumid'; }
  else if (typeof raw.path === 'string') {
   try { target = await canonicalPath(raw.path, 'exe', signal); kind = 'exe'; } catch { cancelled(signal); return null; }
  } else return null;
  const id = `winapp-${createHash('sha256').update(`${kind}:${target.toLowerCase()}`).digest('hex')}`;
  const entry = { id, kind, target, label: labelOf(raw.label) };
  if (applications.size >= 4096 && !applications.has(id)) applications.delete(applications.keys().next().value);
  applications.set(id, entry); return entry;
 }

 async function openDefaultBrowser({ signal } = {}) {
  windowsOnly(); cancelled(signal);
  if (typeof openExternal !== 'function') throw new Error('A abertura do navegador padrão não está disponível nesta integração.');
  // Let Windows resolve the registered HTTP(S) handler. A model-provided path,
  // executable, command line or application registration is never involved.
  try { await openExternal(DEFAULT_BROWSER_URL); }
  catch { cancelled(signal); throw new Error('O Windows não conseguiu encaminhar a abertura do navegador padrão.'); }
  cancelled(signal);
  return { verified: false, dispatched: true, url: DEFAULT_BROWSER_URL, summary: 'A abertura foi encaminhada ao navegador padrão do Windows. A janela ainda não foi verificada.' };
 }

 return {
  openDefaultBrowser,
  // Legacy, explicitly configured integrations remain available to existing callers.
  async openApp(appId, options) {
   if (appId === 'browser') return openDefaultBrowser(options);
   const app = getApps().find(item => item.id === appId); if (!app) throw new Error('Aplicativo não cadastrado.');
   await fsImpl.access(app.path); return run('OpenApp', { path: app.path }, options);
  },
  async openBrowser(url, { signal } = {}) {
   cancelled(signal); const parsed = new URL(url);
   if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('URL não permitida.');
   await openExternal(parsed.href); cancelled(signal);
   return { verified: false, summary: 'A URL foi encaminhada ao navegador. O conteúdo da página ainda não foi verificado.', url: parsed.href };
  },
  async dictateNotes(text, options) { return run('DictateNotes', { text }, options); },

  async findApps(query, { signal } = {}) {
   windowsOnly(); cancelled(signal); const needle = queryText(query);
   const inventory = await run('ListApps', {}, { signal }, 'inventory');
   const configured = getApps(); const entries = new Map();
   for (const raw of [...inventory.apps.slice(0, 2000), ...(Array.isArray(configured) ? configured.slice(0, 100) : [])]) {
    cancelled(signal); const entry = await register(raw, signal); if (!entry) continue;
    const labelKey = normalize(entry.label), previous = entries.get(labelKey);
    if (!previous || (entry.kind === 'exe' && previous.kind !== 'exe')) entries.set(labelKey, entry);
   }
   const apps = [...entries.values()].filter(entry => normalize(entry.label).includes(needle) || (entry.kind === 'exe' && normalize(win32.basename(entry.target, '.exe')).includes(needle)))
    .sort((left, right) => Number(normalize(right.label) === needle) - Number(normalize(left.label) === needle) || left.label.localeCompare(right.label, 'pt-BR'))
    .slice(0, 50).map(({ id, label }) => ({ id, label }));
   cancelled(signal); return { apps, observedAt: now().toISOString() };
  },
  async launchApp(id, { signal } = {}) {
   windowsOnly(); cancelled(signal);
   const entry = typeof id === 'string' && APP_ID.test(id) ? applications.get(id) : null;
   if (!entry) throw new Error('Escolha um aplicativo do inventário observado antes de abrir.');
   let payload;
   if (entry.kind === 'exe') {
    const path = await canonicalPath(entry.target, 'exe', signal);
    if (path.toLowerCase() !== entry.target.toLowerCase()) throw new Error('O aplicativo mudou desde a descoberta. Faça uma nova busca.');
    payload = { kind: 'exe', path };
   } else payload = { kind: 'aumid', aumid: entry.target };
   const result = await run('LaunchInstalledApp', payload, { signal }, 'launch'); cancelled(signal);
   if (result.verified === true && Number.isSafeInteger(result.pid) && result.pid > 0 && ['window', 'process'].includes(result.observed)) return { verified: true, dispatched: true, summary: labelOf(result.summary) || 'Processo do aplicativo observado.', pid: result.pid, observed: result.observed, ...(typeof result.focused === 'boolean' ? { focused: result.focused } : {}) };
   return { verified: false, ...(result.dispatched === true ? { dispatched: true } : {}), summary: result.verified === true ? 'O Windows não retornou evidência de um processo ou janela do aplicativo.' : labelOf(result.summary) || 'O pedido foi encaminhado ao Windows. A janela do aplicativo ainda não foi confirmada.' };
  },
  async resolveFolder(folder, { signal } = {}) {
   windowsOnly(); cancelled(signal);
   const alias = typeof folder === 'string' ? ALIASES.get(normalize(folder)) : undefined;
   let value = folder;
   if (alias) {
    if (typeof getKnownFolder !== 'function') throw new Error('As pastas conhecidas não estão disponíveis nesta integração.');
    value = await getKnownFolder(alias); cancelled(signal);
   }
   const path = await canonicalPath(value, 'folder', signal);
   return { path, label: alias ? FOLDER_LABELS[alias] : win32.basename(path) || path };
  },
  async openFolder(path, { signal } = {}) {
   windowsOnly(); cancelled(signal);
   if (typeof openPath !== 'function') throw new Error('A abertura de pastas não está disponível nesta integração.');
   const canonical = await canonicalPath(path, 'folder', signal); cancelled(signal);
   if (canonical.toLowerCase() !== localPath(path).toLowerCase()) throw new Error('A pasta mudou desde a confirmação. Faça uma nova busca antes de abrir.');
   const error = await openPath(canonical); cancelled(signal);
   if (error !== '') throw new Error('O Windows não conseguiu encaminhar a abertura da pasta.');
   return { verified: false, dispatched: true, summary: 'A pasta foi encaminhada ao Explorador. A janela ainda não foi verificada.', path: canonical };
  },
 };
}
