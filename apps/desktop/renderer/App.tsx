import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { createHud, type HudFrame } from './hud';
import { RealtimeVoice, type VoiceState } from './realtime';
import { WeatherSource } from './weather-source';
import { createSpeechEffects, DEFAULT_SPEECH_EFFECT_AMOUNT, type SpeechEffectsController } from './speech-effects';
import { LocalClapStandby } from './standby';
import { GreetingMusic } from './greeting-music';
import { ContextPanel } from './context-panel';
import { createFullscreenController } from './fullscreen';

type Message = { id: string; role: 'user' | 'assistant'; text: string; done?: boolean; origin?: 'voice' | 'greeting'; source?: JarvisWeatherAttribution | string };
type Drawer = 'settings' | 'memory' | 'activity' | 'presence' | 'context' | null;
type UltronPlayback = { requestId: string; profileId: string; runId: string; cancelled: boolean; acknowledged: boolean };
type UltronPlaybackFailure = 'busy' | 'cancelled' | 'speech_unavailable' | 'playback_failed';
type ToolSources = { tool: string; sources: Array<{ url: string; title: string; hostname: string }>; retrievedAt: number; profileId: string; runId: string; runOrder?: number };
const sourceToolNames: Record<string, string> = { web_read: 'Página', web_search: 'Pesquisa', weather_current: 'Tempo' };
const unsafeSourceText = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/;
function sourceText(value: unknown, limit = 160) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit) : ''; }
function sourceUrl(value: unknown) {
  if (typeof value !== 'string' || !value || value.length > 2048 || unsafeSourceText.test(value) || /\s/.test(value)) return null;
  try {
    if (unsafeSourceText.test(decodeURIComponent(value))) return null;
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    if ([...url.searchParams.keys()].some(key => /^(?:api[_-]?key|access[_-]?token|token|auth|authorization|password|secret|credential|signature|sig)$/i.test(key))) return null;
    return { url: url.href, hostname: url.host };
  } catch { return null; }
}
function normalizeToolSources(value: unknown): ToolSources | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const event = value as Record<string, unknown>;
  if (typeof event.tool !== 'string' || !Object.hasOwn(sourceToolNames, event.tool) || typeof event.profileId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(event.profileId)
    || typeof event.runId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(event.runId) || !Array.isArray(event.sources)) return null;
  const retrievedAt = typeof event.retrievedAt === 'number' ? event.retrievedAt : typeof event.retrievedAt === 'string' && /^\d{4}-\d\d-\d\dT/.test(event.retrievedAt) && event.retrievedAt.length < 100 ? Date.parse(event.retrievedAt) : NaN;
  if (!Number.isFinite(retrievedAt) || retrievedAt < 0 || retrievedAt > Date.now() + 15 * 60_000) return null;
  const sources: ToolSources['sources'] = [];
  const seenUrls = new Set<string>();
  for (const source of event.sources.slice(0, 24)) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue;
    const link = sourceUrl((source as Record<string, unknown>).url);
    if (!link || seenUrls.has(link.url)) continue;
    seenUrls.add(link.url); sources.push({ ...link, title: sourceText((source as Record<string, unknown>).title) || link.hostname });
    if (sources.length === 6) break;
  }
  return { tool: event.tool, sources, retrievedAt, profileId: event.profileId, runId: event.runId };
}
const emptySnapshot: JarvisSnapshot = { memories: [], tasks: [], procedures: [] };
const defaultSettings: JarvisSettings = { profileId: 'principal', textModel: '', realtimeModel: '', voice: '', maxSessionMinutes: 10, workspaceRoot: '', apps: [], hasKey: false, ultronEnabled: false, fireTvEnabled: false, fireTvHost: '', fireTvPaired: false };
const states: Record<string, { label: string }> = {
  idle: { label: 'EM ESPERA' },
  connecting: { label: 'CONECTANDO' },
  listen: { label: 'ESTOU OUVINDO' },
  think: { label: 'PROCESSANDO' },
  speak: { label: 'RESPONDENDO' },
  execute: { label: 'EM AÇÃO' },
  approval: { label: 'SUA DECISÃO' },
};
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    mic: <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
    stop: <rect x="5" y="5" width="14" height="14" rx="2"/>,
    send: <><path d="m4 12 16-8-6 16-3-7-7-1Z"/><path d="m11 13 9-9"/></>,
    settings: <><path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Z"/><circle cx="12" cy="12" r="3"/></>,
    fullscreen: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>,
    'fullscreen-exit': <path d="M3 8h5V3m8 0v5h5M3 16h5v5m8 0v-5h5"/>,
    memory: <><path d="M9 4C5 2 2 7 5 10c-4 3-1 9 3 8 0 4 4 4 4 1V5c0-2-2-3-3-1Zm6 0c4-2 7 3 4 6 4 3 1 9-3 8 0 4-4 4-4 1"/><path d="m7 8 2 2m-3 5 3-1m8-6-2 2m3 5-3-1"/></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
    context: <><circle cx="12" cy="12" r="8"/><path d="m12 7 2 5-2 5-2-5 2-5ZM4 12H2m20 0h-2M12 4V2m0 20v-2"/></>,
    camera: <><path d="M8 5 10 2h4l2 3h5v16H3V5h5Z"/><circle cx="12" cy="12" r="4"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    folder: <path d="M3 5h7l2 3h9v12H3V5Z"/>,
    shield: <><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z"/><path d="m8 12 3 3 5-6"/></>,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></>,
    plus: <path d="M12 4v16M4 12h16"/>,
    speaker: <><path d="m11 4-6 5H2v6h3l6 5V4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.arrow}</svg>;
}
function Panel({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: React.ReactNode; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>('button, input, textarea, select')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]') || []);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="panel-scrim" onClick={event => { if (event.target === event.currentTarget) onClose(); }}><div className="drawer" ref={ref} role="dialog" aria-modal="true" aria-labelledby="drawer-title"><header className="drawer-head"><div><span className="eyebrow">{eyebrow}</span><h2 id="drawer-title">{title}</h2></div><button className="icon-button" aria-label="Fechar painel" onClick={onClose}><Icon name="close"/></button></header>{children}</div></div>;
}
const toolNames: Record<string, string> = { tv_control: 'Controlar Fire TV', tv_open_app: 'Abrir aplicativo na Fire TV', apps_find: 'Procurar aplicativo instalado', apps_launch: 'Abrir aplicativo instalado', folders_open: 'Abrir pasta', web_read: 'Ler página na web', web_search: 'Pesquisar na web', youtube_search: 'Pesquisar no YouTube', youtube_play: 'Reproduzir vídeo no YouTube', youtube_control: 'Controlar reprodução no YouTube', weather_current: 'Consultar tempo atual', apps_open: 'Abrir aplicativo', apps_focus: 'Trazer aplicativo para frente', browser_open: 'Abrir endereço no navegador', browser_read_selected: 'Ler trecho selecionado', projects_open: 'Abrir projeto no editor', workspace_list: 'Listar arquivos', workspace_preview_organize: 'Preparar organização de arquivos', workspace_apply_organize: 'Organizar arquivos', workspace_compensate: 'Restaurar arquivos movidos', memory_propose: 'Guardar memória', notes_dictate: 'Salvar ditado', notes_open_dictation: 'Abrir ditado no Bloco de Notas' };
const folderNames: Record<string, string> = { desktop: 'Área de Trabalho', documents: 'Documentos', downloads: 'Downloads', pictures: 'Imagens', music: 'Música', videos: 'Vídeos' };
function approvalPresentation(record: JarvisEvent, apps: JarvisSettings['apps']) {
  const tool = typeof record.tool === 'string' ? record.tool : '';
  if (!['apps_find', 'apps_launch', 'apps_open', 'apps_focus', 'folders_open', 'web_read', 'web_search', 'weather_current'].includes(tool)) return null;
  const args = record.args && typeof record.args === 'object' && !Array.isArray(record.args) ? record.args as Record<string, unknown> : {};
  const details = record.details && typeof record.details === 'object' && !Array.isArray(record.details) ? record.details as Record<string, unknown> : {};
  const fields: Array<{ label: string; value: string }> = [];
  let concrete = '';
  if (['apps_launch', 'apps_open', 'apps_focus'].includes(tool)) {
    const id = sourceText(args.appId, 160);
    concrete = sourceText(details.appLabel || details.label, 160) || apps.find(app => app.id === id)?.label || id;
    if (concrete) fields.push({ label: 'Aplicativo', value: concrete });
  } else if (tool === 'folders_open') {
    const folder = sourceText(args.folder, 160); concrete = sourceText(details.label) || folderNames[folder] || folder;
    if (concrete) fields.push({ label: 'Pasta', value: concrete });
    const location = sourceText(details.folder, 2048);
    if (location && location !== concrete) fields.push({ label: 'Local', value: location });
  } else if (tool === 'web_read') {
    const link = sourceUrl(args.url); concrete = link?.hostname || '';
    fields.push({ label: 'Página', value: link?.url || 'Endereço indisponível' });
  } else if (tool === 'web_search' || tool === 'apps_find') {
    concrete = sourceText(args.query, 1200);
    if (concrete) fields.push({ label: 'Pesquisa', value: concrete });
  }
  const scope = sourceText(details.scope, 1000);
  if (scope) fields.push({ label: 'Acesso', value: scope });
  const destination = sourceText(details.destination, 1000);
  if (destination) fields.push({ label: 'Envio de dados', value: destination });
  return { title: `${toolNames[tool]}${concrete ? `: ${sourceText(concrete)}` : ''}`, fields };
}
function humanStatus(status?: string, tool?: string) { if (status === 'unverified' && ['tv_control', 'tv_open_app'].includes(tool || '')) return 'Comando enviado à Fire TV · confira a televisão'; return ({ pending: 'Pendente', running: 'Em andamento', executing: 'Executando', completed: 'Concluída', done: 'Concluída', failed: 'Falhou', error: 'Falhou', cancelled: 'Cancelada', denied: 'Recusada', approved: 'Autorizada', waiting: 'Aguardando', interrupted: 'Interrompida', compensating: 'Restauração em andamento', compensated: 'Restaurada', compensation_failed: 'Falha na restauração', needs_review: 'Revisão necessária', unverified: 'Enviada ao Windows · sem verificação da janela', awaiting_approval: 'Aguardando decisão' } as Record<string, string>)[status || ''] || status || 'Registrada'; }
function detail(record: JarvisRecord) { return record.text || record.summary || record.name || (record.source && record.destination ? `${record.source} → ${record.destination}` : toolNames[String(record.tool)] || 'Registro de tarefa'); }
function normalizeSnapshot(snapshot: JarvisSnapshot): JarvisSnapshot { return { memories: snapshot.memories || [], procedures: snapshot.procedures || [], tasks: (snapshot.tasks || []).map(task => ({ ...task, id: task.id || String(task.runId) })) }; }
function time(value?: string) { if (!value) return ''; const date = new Date(value); return isNaN(date.getTime()) ? '' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

function App({ skipAutomaticGreeting = false }: { skipAutomaticGreeting?: boolean }) {
  const bridge = window.jarvis;
  const [settings, setSettings] = useState<JarvisSettings>(defaultSettings);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [snapshot, setSnapshot] = useState<JarvisSnapshot>(emptySnapshot);
  const [capabilities, setCapabilities] = useState<JarvisCapabilities>({ desktop: false, vision: false });
  const capabilitiesRef = useRef(capabilities); capabilitiesRef.current = capabilities;
  const [booted, setBooted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const fullscreenController = useRef<ReturnType<typeof createFullscreenController> | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages); messagesRef.current = messages;
  const visibleMessages = messages.filter(message => !message.origin);
  const latestVisibleMessage = visibleMessages.at(-1);
  const [weatherAttribution, setWeatherAttribution] = useState<JarvisWeatherAttribution | string>();
  const [toolSources, setToolSources] = useState<ToolSources | null>(null);
  const sourceRuns = useRef(new Map<string, number>());
  const sourceRunSequence = useRef(0);
  const [input, setInput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const runRef = useRef<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micStarting, setMicStarting] = useState(false);
  const [micPending, setMicPending] = useState(false);
  const micGeneration = useRef(0);
  const micFlight = useRef<{ stream?: MediaStream; context?: AudioContext } | null>(null);
  const micTest = useRef<{ stream: MediaStream; context: AudioContext; frame: number } | null>(null);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoStarting, setDemoStarting] = useState(false);
  const [playbackKind, setPlaybackKind] = useState<'demo' | 'greeting' | 'ultron'>('demo');
  const [ultronBusy, setUltronBusy] = useState(false);
  const ultronPlayback = useRef<UltronPlayback | null>(null);
  const ultronRequests = useRef(new Set<string>());
  const demoGeneration = useRef(0);
  const demo = useRef<{ audio: HTMLAudioElement; context: AudioContext; frame: number; objectUrl?: string; effects?: SpeechEffectsController; finish(completed: boolean): void; timer?: ReturnType<typeof setTimeout> } | null>(null);
  const startupAttempted = useRef(skipAutomaticGreeting);
  const greetingGeneration = useRef(0);
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [greetingNeedsTap, setGreetingNeedsTap] = useState(false);
  const greetingAudio = useRef<{ base64: string; mime: string } | null>(null);
  const greetingInFlight = useRef(false);
  const reception = useRef<{ controller: AbortController; profileId: string } | null>(null);
  const continuousWanted = useRef(false);
  const voiceResumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const music = useRef<GreetingMusic | null>(null);
  const musicPlaying = useRef(false);
  const [standbyArmed, setStandbyArmed] = useState(false);
  const standby = useRef<LocalClapStandby | null>(null);
  const standbyWanted = useRef(false);
  const standbyGeneration = useRef(0);
  const standbyStarting = useRef(false);
  const standbyResumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wakeGreeting = useRef<(source: string) => void>(() => {});
  const wakeBusy = useRef(false);
  const lastWake = useRef(0);
  const [backendState, setBackendState] = useState('idle');
  const [approvals, setApprovals] = useState<JarvisEvent[]>([]);
  const [deciding, setDeciding] = useState('');
  const [actions, setActions] = useState<JarvisRecord[]>([]);
  const voice = useRef<RealtimeVoice | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const historyEnd = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const micMeter = useRef<HTMLDivElement>(null);
  const levels = useRef({ mic: 0, speaker: 0, wave: [] as number[] });
  const effectiveMode: HudFrame['mode'] = approvals.length ? 'approval' : demoPlaying ? 'speak' : greetingBusy || ultronBusy ? 'think' : micTesting ? 'listen' : voiceState === 'speak' || voiceState === 'listen' ? voiceState : ['execute', 'executing', 'running'].includes(backendState) ? 'execute' : runId ? 'think' : voiceState;
  const hud = useRef<HudFrame>({ mode: 'idle', levels: levels.current }); hud.current = { mode: effectiveMode, levels: levels.current };
  const seen = useRef(new Set<string>());
  const [memoryDraft, setMemoryDraft] = useState('');
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [elevenApiKey, setElevenApiKey] = useState('');
  const elevenKeyInput = useRef<HTMLInputElement>(null);
  const focusElevenKey = useRef(false);
  const [form, setForm] = useState(defaultSettings);
  const [locationName, setLocationName] = useState('');
  const [locationLatitude, setLocationLatitude] = useState('');
  const [locationLongitude, setLocationLongitude] = useState('');
  const [saving, setSaving] = useState(false);
  const [fireTvBusy, setFireTvBusy] = useState<'pair' | 'test' | null>(null);
  const [fireTvFeedback, setFireTvFeedback] = useState('');
  const fireTvFlight = useRef<{ profileId: string; host: string; kind: 'pair' | 'test' } | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [visionStatus, setVisionStatus] = useState<any>(null);
  const [faceResult, setFaceResult] = useState<any>(null);
  const [visionBusy, setVisionBusy] = useState(false);
  const [faceName, setFaceName] = useState('');
  const camera = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const faceInterval = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cameraGeneration = useRef(0);
  const [enrolling, setEnrolling] = useState(false);
  const enrollingRef = useRef(false);
  const [enrollmentProgress, setEnrollmentProgress] = useState(0);

  const showError = (value: unknown) => setError(value instanceof Error ? value.message : typeof value === 'object' && value && 'message' in value ? String(value.message) : String(value));
  async function refresh() { if (!bridge) return; try { const data = await bridge.boot(); setSnapshot(normalizeSnapshot(data.snapshot || emptySnapshot)); } catch (e) { showError(e); } }
  const upsertMessage = (message: Message) => setMessages(previous => { const i = previous.findIndex(m => m.id === message.id); if (i < 0) return [...previous, message]; return previous.map((m, n) => n === i ? { ...m, ...message } : m); });

  useEffect(() => {
    const controller = createFullscreenController({ bridge, document, window, onChange: setFullscreen, onError: showError });
    fullscreenController.current = controller;
    return () => { fullscreenController.current = null; controller.dispose(); };
  }, [bridge]);

  useEffect(() => {
    if (!bridge) { setBooted(true); return; }
    let mounted = true;
    bridge.boot().then(data => {
      if (!mounted) return;
      settingsRef.current = data.settings;
      capabilitiesRef.current = data.capabilities;
      if (data.startup?.requested && !data.startup.enabled) setNotice('O Windows não confirmou a inicialização automática. Confira Aplicativos de inicialização nas configurações do Windows.');
      setSettings(data.settings); setForm(data.settings); syncLocationForm(data.settings); setSnapshot(normalizeSnapshot(data.snapshot || emptySnapshot)); setCapabilities(data.capabilities); setBooted(true);
      if (!startupAttempted.current) {
        if (data.settings.standbyEnabled) {
          startupAttempted.current = true; standbyWanted.current = true; void startStandby();
        }
        else if (data.settings.startupGreeting && data.settings.weatherLocation?.name && data.settings.elevenVoiceId && data.settings.hasElevenKey) {
        startupAttempted.current = true;
          void startGreeting(true);
        }
        else if (data.settings.startupGreeting) setNotice('Para ouvir a saudação ao iniciar, configure a cidade, a voz e a chave ElevenLabs em Ajustes.');
      }
    }).catch(e => { if (mounted) { showError(e); setBooted(true); } });
    const unsub = bridge.onEvent(raw => {
      const e = raw.payload ? { ...raw, ...raw.payload } : raw;
      if (e.type === 'ultron.speak') { void speakUltron(e); return; }
      if (e.type === 'ultron.cancel') { const job = ultronPlayback.current; if (job && e.requestId === job.requestId) stopDemo(); return; }
      if (e.profileId && e.profileId !== settingsRef.current.profileId) return;
      if (e.type === 'fire_tv_pairing' && e.state === 'approval_required') {
        if (fireTvFlight.current?.kind === 'pair') setFireTvFeedback('Aguardando aprovação: permita este computador na tela da TV.');
        return;
      }
      if (e.type === 'session.reset') {
        fireTvFlight.current = null; setFireTvBusy(null); setFireTvFeedback('');
        setDrawer(current => current === 'context' ? null : current);
        sourceRuns.current.clear(); setToolSources(null);
        continuousWanted.current = false; clearTimeout(voiceResumeTimer.current); standbyWanted.current = false;
        pauseStandby(); music.current?.stop();
        voice.current?.stop(); voice.current = null; stopMicTest(); stopDemo(); stopCamera();
        greetingAudio.current = null; setElevenApiKey(''); setWeatherAttribution(undefined);
        runRef.current = null; setRunId(null); setBackendState('idle'); setVoiceActive(false); setVoiceConnected(false); setVoiceState('idle'); setApprovals([]);
        if (e.reason === 'profile_changed') { setMessages([]); setActions([]); }
        if (!['window_closed', 'app_quit'].includes(e.reason || '')) setNotice(e.reason === 'profile_changed' ? 'Perfil alterado. Microfone, câmera e sessão anterior foram encerrados.' : 'Configuração atualizada. Microfone, câmera e sessão anterior foram encerrados.');
        return;
      }
      if (e.type === 'wake.trigger') { wakeGreeting.current(String(e.source || 'voice')); return; }
      if (e.type === 'wake.status' && e.state === 'unavailable') {
        const clapListening = standby.current?.getState() === 'listening';
        setStandbyArmed(clapListening);
        if (!clapListening && !standbyStarting.current) { standbyWanted.current = false; setNotice('A espera local parou. Confira o microfone e tente ativar novamente.'); }
        return;
      }
      if (e.type === 'standby.pause') { standbyWanted.current = false; pauseStandby(); return; }
      if (e.type === 'standby.resume') { standbyWanted.current = true; void startStandby(); return; }
      const eventId = e.eventId || (e.type !== 'text.delta' ? e.id && `${e.type}:${e.id}:${e.status || ''}` : undefined);
      if (eventId) { if (seen.current.has(eventId)) return; if (seen.current.size > 3000) seen.current.clear(); seen.current.add(eventId); }
      if (e.type === 'sources') {
        const next = normalizeToolSources(e);
        const runOrder = next ? sourceRuns.current.get(next.runId) : undefined;
        if (!next || next.profileId !== settingsRef.current.profileId || runOrder === undefined) return;
        setToolSources(previous => previous && ((previous.runOrder || 0) > runOrder || (previous.runOrder === runOrder && previous.retrievedAt > next.retrievedAt)) ? previous : { ...next, runOrder });
        return;
      }
      if (e.type === 'text.delta') {
        const id = `assistant-${e.runId || runRef.current}`;
        setMessages(previous => { const existing = previous.find(m => m.id === id); return existing ? previous.map(m => m.id === id ? { ...m, text: m.text + (e.delta || e.text || '') } : m) : [...previous, { id, role: 'assistant', text: e.delta || e.text || '' }]; });
      }
      if (e.type === 'text.done') { if (e.text) upsertMessage({ id: `assistant-${e.runId || runRef.current}`, role: 'assistant', text: e.text, done: true }); }
      if (e.type === 'state') {
        const state = e.state || e.status || 'idle';
        if (e.profileId === settingsRef.current.profileId && typeof e.runId === 'string') {
          if (['running', 'executing', 'awaiting_approval'].includes(state) && !sourceRuns.current.has(e.runId)) {
            if (sourceRuns.current.size >= 512) sourceRuns.current.delete(sourceRuns.current.keys().next().value!);
            sourceRuns.current.set(e.runId, ++sourceRunSequence.current);
          } else if (['cancelled', 'interrupted', 'failed'].includes(state)) sourceRuns.current.delete(e.runId);
        }
        setBackendState(state);
        if (['cancelled', 'completed', 'unverified', 'interrupted', 'failed'].includes(state)) { setApprovals(items => items.filter(x => x.runId !== e.runId)); void refresh(); }
      }
      if (e.type === 'approval') {
        if (['resolved', 'approved', 'denied', 'cancelled', 'expired'].includes(e.status || '')) setApprovals(items => items.filter(x => x.approvalId !== e.approvalId));
        else setApprovals(items => items.some(x => x.approvalId === (e.approvalId || e.id)) ? items : [...items, { ...e, approvalId: e.approvalId || e.id }]);
      }
      if (e.type === 'action') { const id = e.stepId || e.id || e.callId || `${e.runId}:${e.tool || crypto.randomUUID()}`; setActions(items => { const next = { ...e, id, createdAt: e.at, updatedAt: e.at } as JarvisRecord; return [next, ...items.filter(x => x.id !== id)].slice(0, 30); }); if (['completed', 'done', 'failed', 'cancelled'].includes(e.status || '')) void refresh(); }
      if (e.type === 'memory') void refresh();
      if (e.type === 'error') showError(e.message || e.error || 'A operação não pôde ser concluída.');
    });
    const cleanup = () => { mounted = false; fireTvFlight.current = null; sourceRuns.current.clear(); continuousWanted.current = false; clearTimeout(voiceResumeTimer.current); standbyWanted.current = false; clearTimeout(standbyResumeTimer.current); pauseStandby(); music.current?.stop(); unsub(); voice.current?.stop(); stopMicTest(); stopDemo(); stopCamera(); };
    window.addEventListener('beforeunload', cleanup);
    return () => { window.removeEventListener('beforeunload', cleanup); cleanup(); };
  }, []);
  useEffect(() => { if (canvas.current) return createHud(canvas.current, () => ({ ...hud.current, levels: levels.current })); }, []);
  useEffect(() => { historyEnd.current?.scrollIntoView({ block: 'end' }); }, [latestVisibleMessage?.id, latestVisibleMessage?.text, approvals]);
  useEffect(() => { if (drawer !== 'presence') stopCamera(); }, [drawer]);
  useEffect(() => { if (drawer === 'settings' && focusElevenKey.current) { focusElevenKey.current = false; elevenKeyInput.current?.focus(); } }, [drawer]);
  useEffect(() => { sourceRuns.current.clear(); setToolSources(null); }, [settings.profileId]);
  useEffect(() => {
    const job = ultronPlayback.current;
    if (job && (job.profileId !== settings.profileId || !settings.ultronEnabled || !capabilities.ultronBridge)) stopDemo();
  }, [settings.profileId, settings.ultronEnabled, capabilities.ultronBridge]);
  useEffect(() => { if (cameraOn && video.current && camera.current) { video.current.srcObject = camera.current; void video.current.play().catch(showError); } }, [cameraOn]);

  function pauseStandby() {
    standbyGeneration.current++; clearTimeout(standbyResumeTimer.current);
    standby.current?.stop(); standby.current = null; setStandbyArmed(false);
    void bridge?.wakeStop?.().catch(() => {});
    levels.current = { mic: 0, speaker: 0, wave: [] };
  }
  function resumeStandbySoon() {
    clearTimeout(standbyResumeTimer.current);
    if (standbyWanted.current && !continuousWanted.current && !reception.current) standbyResumeTimer.current = setTimeout(() => { void startStandby(); }, 4000);
  }
  async function startStandby() {
    const current = settingsRef.current;
    if (!standbyWanted.current || !current.standbyEnabled || standbyStarting.current || standby.current || voice.current || continuousWanted.current || reception.current || ultronPlayback.current || fireTvFlight.current || micTest.current || micFlight.current || demo.current || runRef.current || greetingInFlight.current) return;
    const generation = ++standbyGeneration.current;
    standbyStarting.current = true;
    let available = false;
    try {
      if (current.wakeClapEnabled !== false) {
        const listener = new LocalClapStandby({
          onWake: () => wakeGreeting.current('clap'),
          onLevels: ({ level }) => { if (generation === standbyGeneration.current) levels.current = { mic: level, speaker: 0, wave: [] }; },
          onError: message => { if (generation === standbyGeneration.current) setError(message); },
        });
        standby.current = listener; await listener.start();
        if (generation !== standbyGeneration.current) { listener.stop(); return; }
        available = listener.getState() === 'listening';
      }
      if (bridge?.wakeStart && capabilitiesRef.current.voiceWake) {
        const native = await bridge.wakeStart();
        if (generation !== standbyGeneration.current) { void bridge.wakeStop?.(); return; }
        available = available || native.running;
        if (current.wakeVoiceEnabled && !native.running) setNotice('A ativação por voz não ficou disponível neste Windows. Confira o idioma de reconhecimento de fala instalado.');
      }
      setStandbyArmed(available);
      if (!available) { standbyWanted.current = false; standby.current?.stop(); standby.current = null; setNotice('Nenhum detector local ficou disponível. Confira o microfone e as opções de espera em Ajustes.'); }
    } catch (error) { if (generation === standbyGeneration.current) { standbyWanted.current = false; standby.current?.stop(); standby.current = null; setStandbyArmed(false); showError(error); } }
    finally {
      standbyStarting.current = false;
      if (generation !== standbyGeneration.current && standbyWanted.current && !standby.current) resumeStandbySoon();
    }
  }
  wakeGreeting.current = source => {
    if (!standbyWanted.current || wakeBusy.current || Date.now() - lastWake.current < 8000 || voice.current || continuousWanted.current || reception.current || ultronPlayback.current || fireTvFlight.current || demo.current || runRef.current || greetingInFlight.current) return;
    lastWake.current = Date.now(); wakeBusy.current = true; pauseStandby();
    void startGreeting(false, true).finally(() => { wakeBusy.current = false; });
  };
  function toggleStandby() {
    if (standbyWanted.current) { standbyWanted.current = false; pauseStandby(); }
    else { standbyWanted.current = true; void startStandby(); }
  }

  function beginGreetingMusic() {
    const current = settingsRef.current;
    if (musicPlaying.current || !current.hasGreetingMusic || current.greetingMusicEnabled === false) return;
    music.current ||= new GreetingMusic({ onError: setNotice });
    musicPlaying.current = true;
    void music.current.start({ src: new URL('./greeting-music', window.location.href).href, volume: 0.35 }).catch(() => { musicPlaying.current = false; });
  }

  async function send(text = input) {
    const clean = text.trim();
    if (!clean || runRef.current || voice.current || ultronPlayback.current || fireTvFlight.current || demo.current || demoStarting || greetingBusy || !bridge) return;
    if (!settings.hasKey) { setDrawer('settings'); return; }
    pauseStandby();
    const id = crypto.randomUUID(); runRef.current = id; setRunId(id); setBackendState('think'); setError(''); setInput('');
    const history = messagesRef.current.filter(m => m.text && m.done !== false).slice(-20).map(m => ({ role: m.role, content: m.text }));
    setMessages(previous => [...previous, { id: `user-${id}`, role: 'user', text: clean, done: true }, { id: `assistant-${id}`, role: 'assistant', text: '', done: false }]);
    try {
      const result = await bridge.text({ text: clean, history, profileId: settings.profileId, runId: id });
      const resultText = typeof result === 'string' ? result : result?.text || result?.outputText;
      if (resultText) upsertMessage({ id: `assistant-${id}`, role: 'assistant', text: resultText, done: true });
      else setMessages(items => items.map(m => m.id === `assistant-${id}` ? { ...m, done: true } : m));
      await refresh();
    } catch (e) { showError(e); setMessages(items => items.map(m => m.id === `assistant-${id}` ? { ...m, text: m.text || 'A resposta foi interrompida. Você pode tentar novamente.', done: true } : m)); }
    finally { if (runRef.current === id) { runRef.current = null; setRunId(null); setBackendState('idle'); } resumeStandbySoon(); inputRef.current?.focus(); }
  }
  async function cancel() {
    continuousWanted.current = false; clearTimeout(voiceResumeTimer.current); standbyWanted.current = false; pauseStandby();
    if (fireTvFlight.current) { fireTvFlight.current = null; setFireTvFeedback('Conexão com a TV interrompida.'); try { await bridge?.cancelFireTv?.(); } catch (e) { showError(e); } finally { if (!fireTvFlight.current) setFireTvBusy(null); } }
    void bridge?.cancelUltron?.().catch(() => {});
    stopDemo();
    voice.current?.stop(); voice.current = null; setVoiceActive(false); setVoiceConnected(false); setVoiceState('idle');
    if (runRef.current && bridge) { try { await bridge.cancel(runRef.current); setApprovals([]); } catch (e) { showError(e); } }
  }
  async function toggleVoice() {
    if (voice.current || continuousWanted.current) { continuousWanted.current = false; clearTimeout(voiceResumeTimer.current); voice.current?.stop(); voice.current = null; setVoiceActive(false); setVoiceConnected(false); setVoiceState('idle'); resumeStandbySoon(); return; }
    await startVoice(false);
  }
  async function startVoice(fromReception: boolean) {
    const current = settingsRef.current;
    if (!bridge || voice.current || runRef.current || demo.current || reception.current || ultronPlayback.current || fireTvFlight.current || micFlight.current) return;
    if (!current.hasKey) { continuousWanted.current = false; setDrawer('settings'); return; }
    if (!capabilitiesRef.current.jarvisSpeech) { continuousWanted.current = false; setError('Esta sessão usa o servidor anterior. Abra a versão atualizada para conversar com a voz Jarvis.'); return; }
    if (!current.hasElevenKey || !current.elevenVoiceId) { continuousWanted.current = false; focusElevenKey.current = true; openSettings(); return; }
    if (fromReception) continuousWanted.current = Boolean(current.continuousVoiceEnabled && current.receptionVoiceEnabled);
    pauseStandby();
    stopMicTest();
    setError(''); setVoiceActive(true);
    const session = new RealtimeVoice(bridge, {
      state: setVoiceState,
      connection: setVoiceConnected,
      transcript: (role, text, id, done) => upsertMessage({ role, text, id, done, origin: 'voice' }),
      levels: value => { levels.current = value; if (micMeter.current) micMeter.current.style.setProperty('--level', String(Math.max(value.mic, value.speaker))); },
      error: setError,
      ended: reason => {
        if (voice.current !== session) return;
        voice.current = null; setVoiceActive(false); setVoiceConnected(false); setApprovals(items => items.filter(x => !String(x.runId || '').startsWith('voice')));
        const latest = settingsRef.current;
        if (reason === 'expired' && continuousWanted.current && latest.profileId === current.profileId && latest.continuousVoiceEnabled && latest.receptionVoiceEnabled) {
          setVoiceActive(true); setVoiceState('connecting');
          clearTimeout(voiceResumeTimer.current);
          voiceResumeTimer.current = setTimeout(() => { if (continuousWanted.current && settingsRef.current.profileId === current.profileId) void startVoice(true); }, 1200);
        } else {
          continuousWanted.current = false;
          if (reason === 'expired') setNotice('A sessão de voz chegou ao limite configurado. Inicie outra quando quiser.');
          resumeStandbySoon();
        }
      },
    });
    voice.current = session;
    await session.start(current.profileId, current.maxSessionMinutes);
  }
  function stopMicTest() {
    micGeneration.current++;
    micFlight.current?.stream?.getTracks().forEach(track => track.stop());
    void micFlight.current?.context?.close().catch(() => {});
    const session = micTest.current;
    if (session) { cancelAnimationFrame(session.frame); session.stream.getTracks().forEach(track => track.stop()); void session.context.close().catch(() => {}); micTest.current = null; }
    setMicTesting(false); setMicStarting(false); levels.current = { mic: 0, speaker: 0, wave: [] }; if (micMeter.current) micMeter.current.style.setProperty('--level', '0');
  }
  async function toggleMicTest() {
    if (micStarting) { stopMicTest(); resumeStandbySoon(); return; }
    if (micTest.current) { stopMicTest(); resumeStandbySoon(); return; }
    if (voice.current || runRef.current || micFlight.current || ultronPlayback.current || fireTvFlight.current || demo.current || demoStarting || greetingBusy) return;
    pauseStandby();
    const generation = ++micGeneration.current; setMicStarting(true); setMicPending(true);
    const flight: { stream?: MediaStream; context?: AudioContext } = {};
    micFlight.current = flight;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (generation !== micGeneration.current) { stream.getTracks().forEach(track => track.stop()); return; }
      flight.stream = stream;
      context = new AudioContext(); flight.context = context; await context.resume();
      if (generation !== micGeneration.current) { stream.getTracks().forEach(track => track.stop()); await context.close(); return; }
      const analyser = context.createAnalyser(); analyser.fftSize = 256; context.createMediaStreamSource(stream).connect(analyser);
      const session = { stream, context, frame: 0 }; micTest.current = session; setMicTesting(true); setError('');
      const measure = () => {
        if (micTest.current !== session) return;
        const samples = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(samples);
        let sum = 0; for (const n of samples) sum += ((n - 128) / 128) ** 2;
        const value = Math.min(1, Math.sqrt(sum / samples.length) * 5);
        levels.current = { mic: value, speaker: 0, wave: Array.from(samples).filter((_, i) => i % 6 === 0).slice(0, 41).map(n => Math.abs((n - 128) / 128)) };
        if (micMeter.current) micMeter.current.style.setProperty('--level', String(value));
        session.frame = requestAnimationFrame(measure);
      }; measure();
    } catch (e) { stream?.getTracks().forEach(track => track.stop()); void context?.close().catch(() => {}); if (generation === micGeneration.current) showError(e); }
    finally { if (micFlight.current === flight) { micFlight.current = null; setMicPending(false); } if (generation === micGeneration.current) setMicStarting(false); if (!micTest.current) resumeStandbySoon(); }
  }
  function stopDemo(resume = true) {
    demoGeneration.current++;
    const job = ultronPlayback.current;
    if (job) {
      job.cancelled = true;
      void bridge?.cancelSpeech?.({ runId: job.runId }).catch(() => {});
      acknowledgeUltron(job, false, 'cancelled');
      ultronPlayback.current = null; setUltronBusy(false);
    }
    const activeReception = reception.current; reception.current = null;
    activeReception?.controller.abort();
    if (greetingInFlight.current) void bridge?.cancelGreeting?.().catch(() => {});
    greetingInFlight.current = false;
    musicPlaying.current = false; music.current?.stop();
    greetingGeneration.current++; setGreetingBusy(false); setGreetingNeedsTap(false);
    releasePlayback(false);
    setDemoPlaying(false); setDemoStarting(false); levels.current = { mic: 0, speaker: 0, wave: [] };
    if (micMeter.current) micMeter.current.style.setProperty('--level', '0');
    if (resume) resumeStandbySoon();
  }
  function releasePlayback(completed: boolean) {
    const session = demo.current; if (!session) return;
    demo.current = null; clearTimeout(session.timer); cancelAnimationFrame(session.frame);
    session.audio.onended = null; session.audio.onerror = null; session.audio.pause(); session.audio.removeAttribute('src'); session.audio.load();
    try { session.effects?.dispose(); } catch { /* Closing the context still releases the graph. */ }
    void session.context.close().catch(() => {});
    if (session.objectUrl) URL.revokeObjectURL(session.objectUrl);
    setDemoPlaying(false); setDemoStarting(false); levels.current = { mic: 0, speaker: 0, wave: [] };
    musicPlaying.current = false; music.current?.stop();
    session.finish(completed);
    if (!reception.current) { greetingInFlight.current = false; resumeStandbySoon(); }
  }
  async function toggleDemo() {
    if (ultronPlayback.current || fireTvFlight.current) return;
    if (demo.current || demoStarting) { stopDemo(); return; }
    if (voice.current || micTest.current || micStarting || runRef.current || greetingBusy) return;
    pauseStandby();
    await playAudio(new URL('./voice-demo.mp3', window.location.href).href, 'demo');
  }
  async function playAudio(source: string, kind: 'demo' | 'greeting' | 'ultron', objectUrl?: string, automatic = false): Promise<boolean> {
    const generation = ++demoGeneration.current; setDemoStarting(true); setError('');
    setPlaybackKind(kind);
    let context: AudioContext | undefined;
    let objectUrlOwnedBySession = false;
    try {
      const audio = new Audio(source);
      audio.defaultPlaybackRate = 0.95;
      audio.playbackRate = 0.95;
      audio.preservesPitch = true;
      audio.preload = 'auto';
      context = new AudioContext();
      const analyser = context.createAnalyser(); analyser.fftSize = 256;
      const mediaSource = context.createMediaElementSource(audio);
      let effects: SpeechEffectsController | undefined;
      try { effects = createSpeechEffects({ context, input: mediaSource, output: analyser, amount: DEFAULT_SPEECH_EFFECT_AMOUNT }); }
      catch { mediaSource.disconnect(); mediaSource.connect(analyser); setNotice('Efeito metálico indisponível neste dispositivo. Reproduzindo a voz original.'); }
      analyser.connect(context.destination);
      let finish!: (completed: boolean) => void;
      const ended = new Promise<boolean>(resolve => { finish = resolve; });
      const session = { audio, context, frame: 0, objectUrl, effects, finish, timer: undefined as ReturnType<typeof setTimeout> | undefined }; demo.current = session;
      objectUrlOwnedBySession = true;
      audio.onended = () => { if (demo.current === session) releasePlayback(true); };
      audio.onerror = () => { if (demo.current === session) { releasePlayback(false); setError(kind === 'greeting' ? 'Não foi possível reproduzir o áudio da saudação.' : kind === 'ultron' ? 'Não foi possível reproduzir a narração solicitada pelo Ultron.' : 'A amostra de voz não está disponível nesta instalação. Atualize os arquivos do aplicativo e tente novamente.'); } };
      if (automatic && context.state === 'suspended' && !navigator.userActivation?.hasBeenActive) {
        releasePlayback(false); setGreetingNeedsTap(true); setNotice('A saudação está pronta. Clique em Ouvir saudação para liberar o áudio no navegador.'); return false;
      }
      let resumeTimer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([context.resume(), ended.then(() => {}), new Promise((_, reject) => { resumeTimer = setTimeout(() => reject(new Error('audio_gesture_required')), 3000); })]); }
      finally { clearTimeout(resumeTimer); }
      if (generation !== demoGeneration.current) return false;
      session.timer = setTimeout(() => { if (demo.current === session) { releasePlayback(false); setError('A reprodução de voz demorou demais e foi interrompida.'); } }, 180000);
      let playTimer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([audio.play(), ended.then(() => {}), new Promise((_, reject) => { playTimer = setTimeout(() => reject(new Error('audio_start_timeout')), 10000); })]); }
      finally { clearTimeout(playTimer); }
      if (generation !== demoGeneration.current || demo.current !== session) { audio.pause(); return false; }
      setDemoPlaying(true); setDemoStarting(false);
      if (kind === 'greeting') { setGreetingNeedsTap(false); music.current?.duck(0.22); }
      const measure = () => {
        if (demo.current !== session) return;
        const samples = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(samples);
        let sum = 0; for (const n of samples) sum += ((n - 128) / 128) ** 2;
        const value = Math.min(1, Math.sqrt(sum / samples.length) * 5);
        levels.current = { mic: 0, speaker: value, wave: Array.from(samples).filter((_, i) => i % 6 === 0).slice(0, 41).map(n => Math.abs((n - 128) / 128)) };
        if (micMeter.current) micMeter.current.style.setProperty('--level', String(value));
        session.frame = requestAnimationFrame(measure);
      }; measure();
      return await ended;
    } catch (e) {
      if (!objectUrlOwnedBySession && objectUrl) URL.revokeObjectURL(objectUrl);
      if (generation !== demoGeneration.current) return false;
      releasePlayback(false); void context?.close().catch(() => {});
      if (kind === 'greeting') { setGreetingNeedsTap(true); setNotice('O áudio não iniciou. Clique em Ouvir saudação para tentar novamente.'); }
      else showError(e);
      return false;
    }
  }
  function acknowledgeUltron(job: UltronPlayback, played: boolean, reason?: UltronPlaybackFailure) {
    if (job.acknowledged) return;
    job.acknowledged = true;
    void bridge?.ultronPlaybackResult?.({ requestId: job.requestId, played, ...(reason ? { reason } : {}) }).catch(() => {});
  }
  async function speakUltron(event: JarvisEvent) {
    const requestId = event.requestId;
    if (typeof requestId !== 'string' || !/^[a-zA-Z0-9_-]{1,110}$/.test(requestId) || ultronRequests.current.has(requestId)) return;
    if (ultronRequests.current.size >= 128) ultronRequests.current.delete(ultronRequests.current.values().next().value!);
    ultronRequests.current.add(requestId);
    const current = settingsRef.current;
    const job: UltronPlayback = { requestId, profileId: typeof event.profileId === 'string' ? event.profileId : '', runId: `ultron-${requestId}`, cancelled: false, acknowledged: false };
    if (!capabilitiesRef.current.ultronBridge || !current.ultronEnabled || job.profileId !== current.profileId) { acknowledgeUltron(job, false, 'cancelled'); return; }
    if (voice.current || continuousWanted.current || reception.current || ultronPlayback.current || fireTvFlight.current || micTest.current || micFlight.current || demo.current || runRef.current || greetingInFlight.current) { acknowledgeUltron(job, false, 'busy'); return; }
    if (!bridge?.ultronPlaybackResult || !bridge.speak || !current.hasElevenKey || !current.elevenVoiceId || typeof event.text !== 'string' || !event.text.trim() || event.text.length > 600) { acknowledgeUltron(job, false, 'speech_unavailable'); return; }
    ultronPlayback.current = job; setUltronBusy(true); setPlaybackKind('ultron'); setDemoStarting(true); setError(''); pauseStandby();
    const active = () => ultronPlayback.current === job && !job.cancelled && settingsRef.current.profileId === job.profileId && settingsRef.current.ultronEnabled && capabilitiesRef.current.ultronBridge;
    let failure: UltronPlaybackFailure = 'speech_unavailable';
    try {
      const spoken = await bridge.speak({ text: event.text.trim(), profileId: job.profileId, runId: job.runId, utteranceId: requestId });
      if (!active()) return;
      if (spoken.runId !== job.runId || spoken.utteranceId !== requestId || spoken.mime !== 'audio/mpeg' || typeof spoken.audioBase64 !== 'string' || !spoken.audioBase64 || spoken.audioBase64.length > 12_000_000) throw new Error('speech_response_mismatch');
      failure = 'playback_failed';
      const decoded = atob(spoken.audioBase64), bytes = Uint8Array.from(decoded, char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      const played = await playAudio(url, 'ultron', url);
      if (active()) acknowledgeUltron(job, played, played ? undefined : 'playback_failed');
    } catch { if (active()) { acknowledgeUltron(job, false, failure); setError(failure === 'speech_unavailable' ? 'Não foi possível preparar a voz Jarvis solicitada pelo Ultron.' : 'Não foi possível reproduzir a narração solicitada pelo Ultron.'); } }
    finally {
      if (!job.acknowledged) acknowledgeUltron(job, false, 'cancelled');
      if (ultronPlayback.current === job) { ultronPlayback.current = null; setUltronBusy(false); setDemoStarting(false); resumeStandbySoon(); }
    }
  }
  async function playGreeting(automatic = false) {
    const audio = greetingAudio.current;
    if (!audio || demo.current || voice.current || micTest.current || runRef.current) return false;
    pauseStandby(); greetingInFlight.current = true; beginGreetingMusic();
    try {
      const decoded = atob(audio.base64), bytes = new Uint8Array(decoded.length);
      for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: audio.mime || 'audio/mpeg' }));
      return await playAudio(objectUrl, 'greeting', objectUrl, automatic);
    } catch (e) { stopDemo(); showError(e); return false; }
  }
  async function startGreeting(automatic = false, receptionRequested = false) {
    if (!bridge?.startupGreeting || voice.current || continuousWanted.current || ultronPlayback.current || fireTvFlight.current || micTest.current || micFlight.current || runRef.current || demo.current || greetingInFlight.current) return;
    pauseStandby(); stopDemo(false); const generation = ++greetingGeneration.current;
    const flow = { controller: new AbortController(), profileId: settingsRef.current.profileId };
    reception.current = flow;
    const active = () => reception.current === flow && !flow.controller.signal.aborted && settingsRef.current.profileId === flow.profileId && generation === greetingGeneration.current;
    greetingInFlight.current = true; setGreetingBusy(true); setError(''); greetingAudio.current = null; beginGreetingMusic();
    let completed = false;
    try {
      const result = await bridge.startupGreeting({ hour: new Date().getHours(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
      if (!active()) return;
      setWeatherAttribution(result.attribution);
      if (result.text) upsertMessage({ id: `greeting-${crypto.randomUUID()}`, role: 'assistant', text: result.text, done: true, origin: 'greeting' });
      if (result.audioBase64) {
        greetingAudio.current = { base64: result.audioBase64, mime: result.mime };
        const validGreeting = Boolean(result.text?.trim()) && !result.reason && !['not_configured', 'skipped', 'cancelled', 'failed'].includes(result.weatherStatus);
        completed = await playGreeting(automatic);
        completed = completed && validGreeting;
      }
      else setNotice(result.reason === 'requires_key' ? 'Configure a chave ElevenLabs em Ajustes para ouvir a saudação.' : 'Não foi possível gerar o áudio da saudação. Verifique a conexão e as permissões da chave ElevenLabs.');
    } catch (e) { if (active()) showError(e); }
    finally {
      const currentReception = active();
      if (currentReception) {
        reception.current = null; greetingInFlight.current = false; setGreetingBusy(false); musicPlaying.current = false; music.current?.stop();
        if (completed && receptionRequested && settingsRef.current.receptionVoiceEnabled) await startVoice(true);
        else resumeStandbySoon();
      }
    }
  }
  function beginJarvis() {
    if (ultronPlayback.current || fireTvFlight.current) return;
    if (greetingBusy || (playbackKind === 'greeting' && (demoPlaying || demoStarting))) { void cancel(); return; }
    const current = settingsRef.current;
    if (!current.hasElevenKey || !current.elevenVoiceId || !current.weatherLocation?.name) {
      setNotice(!current.hasElevenKey ? 'A saudação precisa da chave ElevenLabs. Informe-a no campo privado e salve para iniciar Jarvis.' : 'Configure a voz ElevenLabs e a cidade do boletim para iniciar a recepção Jarvis.');
      focusElevenKey.current = !current.hasElevenKey; openSettings(); return;
    }
    void startGreeting(false, true);
  }
  async function decide(approval: JarvisEvent, allow: boolean) {
    if (!bridge || !approval.approvalId) return;
    setDeciding(approval.approvalId);
    try { await bridge.approve({ approvalId: approval.approvalId, allow }); setApprovals(items => items.filter(x => x.approvalId !== approval.approvalId)); }
    catch (e) { showError(e); } finally { setDeciding(''); }
  }
  function syncLocationForm(value: JarvisSettings) {
    setLocationName(value.weatherLocation?.name || '');
    setLocationLatitude(value.weatherLocation ? String(value.weatherLocation.latitude) : '');
    setLocationLongitude(value.weatherLocation ? String(value.weatherLocation.longitude) : '');
  }
  function openSettings() { setForm(settings); syncLocationForm(settings); setApiKey(''); setElevenApiKey(''); setDrawer('settings'); }
  async function saveSettings(event: React.FormEvent) {
    event.preventDefault(); if (!bridge) return;
    if (voiceActive || runId || fireTvFlight.current) { setError('Encerre a operação atual antes de alterar a configuração.'); return; }
    setSaving(true); setError('');
    const previousSettings = settingsRef.current;
    try {
      let weatherLocation: JarvisSettings['weatherLocation'] = null;
      if (locationName.trim() || locationLatitude.trim() || locationLongitude.trim()) {
        const latitude = Number(locationLatitude), longitude = Number(locationLongitude);
        if (!locationName.trim() || !locationLatitude.trim() || !locationLongitude.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Informe a cidade e coordenadas válidas para o boletim do tempo.');
        weatherLocation = { name: locationName.trim(), latitude, longitude };
      }
      if (form.standbyEnabled && form.wakeClapEnabled === false && form.wakeVoiceEnabled === false) throw new Error('Escolha palmas ou a palavra Jarvis para ativar a espera.');
      if (form.standbyEnabled && (!(form.elevenVoiceId || '').trim() || (!settings.hasElevenKey && !elevenApiKey.trim()) || !weatherLocation)) throw new Error('Configure a voz, a chave ElevenLabs e a cidade antes de ativar a espera.');
      if (form.receptionVoiceEnabled && !settings.hasKey && !apiKey.trim()) throw new Error('Configure a chave OpenAI para iniciar os comandos por voz após a recepção.');
      continuousWanted.current = false; clearTimeout(voiceResumeTimer.current); standbyWanted.current = false; pauseStandby(); stopDemo(false);
      await bridge.saveSettings({ profileId: form.profileId.trim(), textModel: form.textModel.trim(), realtimeModel: form.realtimeModel.trim(), voice: form.voice.trim(), maxSessionMinutes: Number(form.maxSessionMinutes), startupGreeting: Boolean(form.startupGreeting), weatherLocation, elevenVoiceId: (form.elevenVoiceId || '').trim(), ...(capabilities.jarvisSpeech ? { startAtLogin: Boolean(form.startAtLogin), standbyEnabled: Boolean(form.standbyEnabled), wakeClapEnabled: form.wakeClapEnabled !== false, wakeVoiceEnabled: form.wakeVoiceEnabled !== false, greetingMusicEnabled: form.greetingMusicEnabled !== false, receptionVoiceEnabled: Boolean(form.receptionVoiceEnabled), continuousVoiceEnabled: Boolean(form.continuousVoiceEnabled && form.receptionVoiceEnabled) } : {}), ...(capabilities.ultronBridge ? { ultronEnabled: Boolean(form.ultronEnabled) } : {}), ...(capabilities.fireTv && !capabilities.localTest ? { fireTvEnabled: Boolean(form.fireTvEnabled), fireTvHost: (form.fireTvHost || '').trim() } : {}), ...(apiKey ? { apiKey: apiKey.trim() } : {}), ...(elevenApiKey ? { elevenApiKey: elevenApiKey.trim() } : {}) });
      setApiKey(''); setElevenApiKey('');
      const data = await bridge.boot();
      if (data.settings.profileId !== settings.profileId) { setMessages([]); setActions([]); setWeatherAttribution(undefined); }
      settingsRef.current = data.settings;
      capabilitiesRef.current = data.capabilities;
      setSettings(data.settings); setForm(data.settings); syncLocationForm(data.settings); setSnapshot(normalizeSnapshot(data.snapshot)); setCapabilities(data.capabilities); setNotice(data.capabilities.localTest ? 'Configuração aplicada nesta sessão de teste. As chaves ficam apenas na memória até encerrar o servidor local.' : 'Configuração salva neste computador.'); setDrawer(null);
      if (data.settings.standbyEnabled) { startupAttempted.current = true; standbyWanted.current = true; void startStandby(); }
      else if (!startupAttempted.current && !previousSettings.hasElevenKey && data.settings.hasElevenKey && data.settings.startupGreeting && data.settings.weatherLocation?.name && data.settings.elevenVoiceId && previousSettings.profileId === data.settings.profileId) {
        startupAttempted.current = true; void startGreeting(true);
      }
      if (data.startup?.requested && !data.startup.enabled) setNotice('Configuração salva, mas o Windows não confirmou a inicialização automática. Confira Aplicativos de inicialização nas configurações do Windows.');
    } catch (e) { showError(e); } finally { setSaving(false); }
  }
  async function configureFireTv(kind: 'pair' | 'test') {
    const current = settingsRef.current;
    if (!bridge || !capabilitiesRef.current.fireTv || capabilitiesRef.current.localTest || !booted || saving || fireTvBusy || voice.current || runRef.current || fireTvFlight.current || demo.current || demoStarting || greetingBusy || ultronPlayback.current || micFlight.current || micTest.current || visionBusy || cameraOn || enrolling
      || !current.fireTvEnabled || !(current.fireTvHost || '').trim() || Boolean(form.fireTvEnabled) !== Boolean(current.fireTvEnabled) || (form.fireTvHost || '') !== (current.fireTvHost || '') || form.profileId.trim() !== current.profileId
      || (kind === 'pair' ? !bridge.pairFireTv : !bridge.testFireTv)) return;
    const job = { profileId: current.profileId, host: current.fireTvHost!, kind };
    const active = () => fireTvFlight.current === job && settingsRef.current.profileId === job.profileId && settingsRef.current.fireTvHost === job.host && settingsRef.current.fireTvEnabled;
    fireTvFlight.current = job; setFireTvBusy(kind); setFireTvFeedback(kind === 'pair' ? 'Conectando à TV. Aprove este computador na TV se solicitado.' : 'Verificando a conexão com a TV…'); pauseStandby();
    try {
      const result = await (kind === 'pair' ? bridge.pairFireTv!() : bridge.testFireTv!());
      if (!active()) return;
      setFireTvFeedback(sourceText(result.summary, 350) || (result.ok ? 'Conexão com a TV confirmada.' : 'Não foi possível conectar à TV.'));
      const data = await bridge.boot();
      if (!active() || data.settings.profileId !== job.profileId || data.settings.fireTvHost !== job.host || !data.settings.fireTvEnabled) return;
      settingsRef.current = { ...settingsRef.current, fireTvPaired: Boolean(data.settings.fireTvPaired) };
      setSettings(previous => ({ ...previous, fireTvPaired: Boolean(data.settings.fireTvPaired) }));
      setForm(previous => ({ ...previous, fireTvPaired: Boolean(data.settings.fireTvPaired) }));
    } catch (e) { if (active()) setFireTvFeedback(sourceText(e instanceof Error ? e.message : '', 350) || 'Não foi possível concluir a conexão com a TV.'); }
    finally { if (fireTvFlight.current === job) { fireTvFlight.current = null; setFireTvBusy(null); resumeStandbySoon(); } }
  }
  async function selectWorkspace() { try { const path = await bridge?.chooseWorkspace(); if (path) { setSettings(s => ({ ...s, workspaceRoot: path })); setForm(s => ({ ...s, workspaceRoot: path })); } } catch (e) { showError(e); } }
  async function selectGreetingMusic() {
    try { const result = await bridge?.chooseGreetingMusic?.(); if (result) { setSettings(s => ({ ...s, hasGreetingMusic: result.hasGreetingMusic })); setForm(s => ({ ...s, hasGreetingMusic: result.hasGreetingMusic })); } } catch (e) { showError(e); }
  }
  async function selectApp() { try { const app = await bridge?.chooseApp(); if (app) { const data = await bridge!.boot(); setSettings(data.settings); setForm(previous => ({ ...previous, apps: data.settings.apps })); } } catch (e) { showError(e); } }
  async function saveMemory(event: React.FormEvent) {
    event.preventDefault(); if (!bridge || !memoryDraft.trim()) return;
    setMemoryBusy(true); try { await bridge.memorySave({ profileId: settings.profileId, text: memoryDraft.trim() }); setMemoryDraft(''); await refresh(); } catch (e) { showError(e); } finally { setMemoryBusy(false); }
  }
  async function deleteMemory(id: string) { if (!bridge) return; try { await bridge.memoryDelete({ profileId: settings.profileId, id }); await refresh(); } catch (e) { showError(e); } }
  function stopCamera() { cameraGeneration.current++; clearTimeout(faceInterval.current); camera.current?.getTracks().forEach(track => track.stop()); camera.current = null; if (video.current) video.current.srcObject = null; setCameraOn(false); setVisionBusy(false); }
  function cameraImage() {
    if (!video.current || !video.current.videoWidth) return null;
    const capture = document.createElement('canvas'); const width = Math.min(640, video.current.videoWidth); capture.width = width; capture.height = Math.round(video.current.videoHeight * width / video.current.videoWidth);
    capture.getContext('2d')!.drawImage(video.current, 0, 0, capture.width, capture.height); return capture.toDataURL('image/jpeg', .8);
  }
  async function startCamera() {
    if (fireTvFlight.current) return;
    setVisionBusy(true); setFaceResult(null);
    const generation = ++cameraGeneration.current;
    try {
      const status = bridge?.vision ? await bridge.vision({ type: 'status' }).catch(() => ({ available: false, reason: 'Prévia da câmera disponível. O serviço facial local ainda não está pronto.' })) : { available: false, reason: 'Prévia da câmera disponível. O reconhecimento precisa dos modelos faciais locais.' }; setVisionStatus(status);
      if (generation !== cameraGeneration.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (generation !== cameraGeneration.current) { stream.getTracks().forEach(t => t.stop()); return; }
      camera.current = stream; setCameraOn(true);
      const identify = async () => {
        if (generation !== cameraGeneration.current || !camera.current) return;
        if (enrollingRef.current) { faceInterval.current = setTimeout(identify, 600); return; }
        const imageDataUrl = cameraImage();
        try { if (imageDataUrl && status.available && bridge?.vision) { const result = await bridge.vision({ type: 'identify', imageDataUrl }); if (generation === cameraGeneration.current) setFaceResult(result); } }
        catch (e) { if (generation === cameraGeneration.current) showError(e); }
        if (generation === cameraGeneration.current) faceInterval.current = setTimeout(identify, 1500);
      };
      if (status.available) faceInterval.current = setTimeout(identify, 1500);
    } catch (e) { showError(e); stopCamera(); } finally { setVisionBusy(false); }
  }
  async function enrollFace() {
    if (!bridge?.vision || !camera.current || !faceName.trim()) return;
    const generation = cameraGeneration.current;
    setEnrolling(true); enrollingRef.current = true; setEnrollmentProgress(0);
    try {
      let enrolled = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        if (generation !== cameraGeneration.current) return;
        const imageDataUrl = cameraImage();
        if (!imageDataUrl) throw new Error('A câmera ainda está preparando a imagem. Tente novamente.');
        const result = await bridge.vision({ type: 'enroll', profileId: settings.profileId, name: faceName.trim(), imageDataUrl });
        setEnrollmentProgress(result.samples || 0);
        if (result.enrolled) { enrolled = true; break; }
        if (attempt < 5) await new Promise(resolve => setTimeout(resolve, 450));
      }
      if (!enrolled) throw new Error('Mantenha um único rosto visível e tente cadastrar novamente.');
      setNotice('Rosto cadastrado no perfil atual.'); setVisionStatus(await bridge.vision({ type: 'status' }));
    } catch (e) { showError(e); } finally { setEnrolling(false); enrollingRef.current = false; }
  }
  async function deleteFace(profileId: string) { try { await bridge?.vision?.({ type: 'delete', profileId }); setVisionStatus(await bridge?.vision?.({ type: 'status' })); setFaceResult(null); } catch (e) { showError(e); } }
  async function useFaceProfile(profileId: string) {
    if (runId || voiceActive || fireTvFlight.current) { setError('Encerre a operação atual para trocar de perfil.'); return; }
    try { await bridge?.saveSettings({ profileId }); const data = await bridge!.boot(); setSettings(data.settings); setForm(data.settings); setSnapshot(normalizeSnapshot(data.snapshot)); setMessages([]); setActions([]); stopCamera(); setDrawer(null); } catch (e) { showError(e); }
  }

  const status = demoPlaying ? { label: playbackKind === 'greeting' ? 'SAUDAÇÃO JARVIS' : playbackKind === 'ultron' ? 'NARRAÇÃO JARVIS' : 'AMOSTRA DA VOZ JARVIS' } : greetingBusy ? { label: 'PREPARANDO SAUDAÇÃO' } : ultronBusy ? { label: 'PREPARANDO NARRAÇÃO' } : micTesting ? { label: 'TESTE DE MICROFONE' } : states[effectiveMode] || states.idle;
  const profileMemories = snapshot.memories.filter(m => !m.profileId || m.profileId === settings.profileId);
  const activity = [...actions, ...snapshot.tasks.filter(t => !actions.some(a => a.id === t.id))].slice(0, 30);
  const fireTvDirty = Boolean(form.fireTvEnabled) !== Boolean(settings.fireTvEnabled) || (form.fireTvHost || '') !== (settings.fireTvHost || '') || form.profileId.trim() !== settings.profileId;
  const fireTvBlocked = !bridge || !booted || !capabilities.fireTv || capabilities.localTest || voiceActive || !!runId || saving || !!fireTvBusy || demoPlaying || demoStarting || greetingBusy || ultronBusy || micPending || micTesting || micStarting || visionBusy || cameraOn || enrolling;
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-symbol" aria-hidden="true"><i/><i/><i/></span><div><strong>J.A.R.V.I.S.</strong><span>PERSONAL INTELLIGENCE</span></div><span className="version">MVP / 07.0</span></div><div className="top-right"><span className={`connection ${voiceConnected ? 'active' : ''}`}><i/>{voiceConnected ? 'VOZ CONECTADA' : runId ? 'SESSÃO DE TEXTO' : settings.hasKey ? 'PRONTO PARA CONECTAR' : 'CONFIGURAÇÃO INICIAL'}</span><button className="icon-button fullscreen-button" type="button" aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} aria-pressed={fullscreen} title={fullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia (F11)'} onClick={() => { void fullscreenController.current?.toggle(); }}><Icon name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={18}/></button><button className="profile-button" onClick={openSettings}><span className="avatar">{(settings.profileId || 'P').slice(0, 1).toUpperCase()}</span><span>{settings.profileId || 'Perfil'}</span><Icon name="settings" size={17}/></button></div></header>
    <main className="workspace">
      <nav className="rail" aria-label="Painéis"><button className={drawer === 'context' ? 'selected' : ''} title="Contexto" aria-label="Contexto" aria-expanded={drawer === 'context'} onClick={() => setDrawer('context')}><Icon name="context"/><span>CONTEXTO</span></button><button className={drawer === 'memory' ? 'selected' : ''} title="Memória" aria-label="Memória" onClick={() => setDrawer('memory')}><Icon name="memory"/><span>MEMÓRIA</span></button><button className={drawer === 'activity' ? 'selected' : ''} title="Atividades" aria-label="Atividades" onClick={() => setDrawer('activity')}><Icon name="activity"/><span>REGISTRO</span></button><button className={drawer === 'presence' ? 'selected' : ''} title="Presença e perfis" aria-label="Presença e perfis" onClick={() => setDrawer('presence')}><Icon name="camera"/><span>PRESENÇA</span></button><div className="rail-spacer"/><button title="Configurações" aria-label="Configurações" onClick={openSettings}><Icon name="settings"/><span>AJUSTES</span></button></nav>
      <section className="core-column" aria-label="Núcleo Jarvis">
        <div className="reactor-stage">
          <canvas ref={canvas} role="img" aria-label={`Núcleo orbital azul Jarvis. ${status.label}.`}/>
          <div className="stage-label top-left"><span>ENTRADA</span><b>{demoPlaying ? 'ARQUIVO DE ÁUDIO LOCAL' : micTesting ? 'TESTE LOCAL ATIVO' : standbyArmed ? 'MICROFONE LOCAL · ESPERA' : voiceActive ? voiceConnected ? 'MICROFONE ATIVO' : 'PREPARANDO ÁUDIO' : 'TEXTO DISPONÍVEL'}</b><div className="signal-bars" ref={micMeter} aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--bar': `${20 + (i % 4) * 21}%` } as React.CSSProperties}/>)}</div></div>
          <div className="stage-label top-right"><span>MODELO</span><b>{demoPlaying ? playbackKind === 'greeting' ? 'SAUDAÇÃO ELEVENLABS' : playbackKind === 'ultron' ? 'NARRAÇÃO ELEVENLABS' : 'AMOSTRA ELEVENLABS' : voiceActive ? settings.realtimeModel || 'NÃO DEFINIDO' : settings.textModel || 'NÃO DEFINIDO'}</b><small>{demoPlaying ? playbackKind === 'demo' ? 'VOZ PERSONALIZADA · AMOSTRA' : 'VOZ JARVIS PERSONALIZADA' : voiceActive ? 'ÁUDIO EM TEMPO REAL' : 'OPENAI · RESPOSTA PROGRESSIVA'}</small></div>
          <div className="stage-label bottom-left"><span>CONTEXTO</span><b>{`${profileMemories.length} MEMÓRIA${profileMemories.length === 1 ? '' : 'S'} NO PERFIL`}</b><small>Perfil: {settings.profileId}</small></div>
          <div className="stage-label bottom-right"><span>ESPAÇO DE TRABALHO</span><b>{settings.workspaceRoot ? 'PASTA DEFINIDA' : 'NENHUMA PASTA DEFINIDA'}</b><button className="text-link" onClick={openSettings}>{settings.workspaceRoot ? 'Ver permissões' : 'Configurar acesso'} <span>↗</span></button></div>
          <div className="reactor-status" aria-live="polite"><span className="status-line"/><strong>{status.label}</strong></div>
        </div>
        <div className="core-controls"><button className="voice-button welcome-button" disabled={!bridge?.startupGreeting || !booted || !!fireTvBusy || ultronBusy || voiceActive || micTesting || micStarting || !!runId || (playbackKind === 'demo' && (demoPlaying || demoStarting))} onClick={beginJarvis}><Icon name={greetingBusy || (playbackKind === 'greeting' && (demoPlaying || demoStarting)) ? 'stop' : 'speaker'} size={19}/><span>{greetingBusy || (playbackKind === 'greeting' && (demoPlaying || demoStarting)) ? 'Parar recepção' : 'Iniciar Jarvis'}<small>Saudação, tempo atual e previsão</small></span></button><button className={`voice-button ${voiceActive ? 'enabled' : ''}`} disabled={!bridge || !booted || !!fireTvBusy || !!runId || demoPlaying || demoStarting || greetingBusy || micPending} onClick={toggleVoice}><Icon name={voiceActive ? 'stop' : 'mic'} size={19}/>{voiceActive ? 'Encerrar voz' : 'Iniciar conversa por voz'}<span className="keycap">{voiceActive ? 'ON' : 'MIC'}</span></button><button className="quiet-button interrupt" disabled={!runId && !voiceActive && !demoPlaying && !demoStarting && !greetingBusy && !fireTvBusy} onClick={cancel}><Icon name="stop" size={15}/>Interromper</button></div>
        <div className="hardware-tools">{settings.standbyEnabled && capabilities.jarvisSpeech && <><button onClick={toggleStandby} disabled={voiceActive || !!runId || demoPlaying || demoStarting || greetingBusy || micTesting || micPending}>{standbyArmed ? 'Pausar espera' : 'Ativar espera'}</button><span>·</span></>}<button disabled={!micStarting && (voiceActive || !!runId || micPending || demoPlaying || demoStarting || greetingBusy)} onClick={toggleMicTest}><Icon name="mic" size={13}/>{micStarting ? 'Cancelar teste' : micPending ? 'Permissão pendente' : micTesting ? 'Encerrar teste local' : 'Testar microfone'}</button><span>·</span><button onClick={() => setDrawer('presence')}><Icon name="camera" size={13}/>Testar câmera</button></div>
        {(voiceActive || micTesting || standbyArmed || cameraOn) && <div className="capture-indicators">{(voiceActive || micTesting || standbyArmed) && <span><Icon name="mic" size={11}/>{standbyArmed ? 'Escuta local de ativação' : 'Microfone ativo'}</span>}{cameraOn && <span><Icon name="camera" size={11}/>Câmera ativa</span>}</div>}
      </section>
      <section className="conversation" aria-label="Conversa com Jarvis"><header className="conversation-header"><h2>Conversa</h2><span className="small-pill">{voiceActive ? 'VOZ' : 'TEXTO'}</span></header>
        {!bridge && <div className="inline-note">Prévia da interface. Abra o aplicativo desktop para conectar voz, memória e ações reais.</div>}
        {capabilities.localTest && <div className="inline-note local-test-banner"><strong>TESTE LOCAL · PASTA DE ENSAIO</strong></div>}
        {greetingNeedsTap && <div className="greeting-ready"><span>Sua saudação está pronta para ouvir.</span><button type="button" className="quiet-button" disabled={voiceActive || micTesting || !!runId || demoPlaying || demoStarting || greetingBusy} onClick={() => void playGreeting()}><Icon name="speaker" size={15}/>Ouvir saudação</button></div>}
        {bridge && booted && !settings.hasKey && <button className="setup-banner" onClick={openSettings}><Icon name="plus" size={18}/><span>Conecte sua conta OpenAI<small>Adicione uma chave de API para começar.</small></span><Icon name="arrow" size={16}/></button>}
        <div className="messages" role="log" aria-label="Mensagens da conversa" aria-live="polite" aria-relevant="additions">
          {visibleMessages.map(message => <article key={message.id} className={`message ${message.role}`}><div className="message-meta"><span>{message.role === 'user' ? 'VOCÊ' : 'J.A.R.V.I.S.'}</span>{message.done === false && <i className="stream-dot"/>}</div><p>{message.text || <span className="thinking-dots" aria-label="Preparando resposta">···</span>}</p>{message.source && <WeatherSource source={message.source} onOpen={capabilities.desktop && bridge?.openExternal ? url => { void bridge.openExternal!(url).catch(showError); } : undefined}/>}</article>)}
          <div ref={historyEnd}/>
        </div>
        {toolSources?.profileId === settings.profileId && toolSources.sources.length > 0 && <aside className="tool-sources" aria-label="Fontes da última consulta"><div className="tool-sources-head"><span>FONTES · {sourceToolNames[toolSources.tool]}</span><time dateTime={new Date(toolSources.retrievedAt).toISOString()} title={new Date(toolSources.retrievedAt).toLocaleString('pt-BR')}>{new Date(toolSources.retrievedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><button className="icon-button" type="button" aria-label="Ocultar fontes" onClick={() => setToolSources(previous => previous ? { ...previous, sources: [] } : null)}><Icon name="close" size={12}/></button></div><ul>{toolSources.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" title={`${source.title} · ${source.url}`} onClick={event => { if (bridge?.openExternal) { event.preventDefault(); void bridge.openExternal(source.url).catch(showError); } }}><span>{source.title}</span><small>{source.hostname}</small></a></li>)}</ul></aside>}
        {approvals.length > 0 && <div className="approvals">{approvals.map(approval => {
          const presentation = approvalPresentation(approval, settings.apps);
          return <div className="approval-card" key={approval.approvalId}><div className="approval-title"><Icon name="shield" size={17}/><span>AÇÃO AGUARDANDO DECISÃO</span></div><strong>{presentation?.title || approval.title || approval.summary || approval.description || approval.name || 'Autorizar ação'}</strong>{presentation ? presentation.fields.length > 0 && <dl className="approval-details">{presentation.fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl> : Boolean(approval.details || approval.args) && <pre>{JSON.stringify(approval.details || approval.args, null, 2)}</pre>}<p>Esta autorização vale apenas para esta ação.</p><div className="approval-buttons"><button className="quiet-button" disabled={!!deciding} onClick={() => decide(approval, false)}>Recusar</button><button className="primary-button" disabled={!!deciding} onClick={() => decide(approval, true)}><Icon name="check" size={16}/>{deciding === approval.approvalId ? 'Aplicando…' : 'Autorizar'}</button></div></div>;
        })}</div>}
        <form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}><label className="sr-only" htmlFor="message-input">Mensagem para Jarvis</label><textarea id="message-input" ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} disabled={!bridge || voiceActive} placeholder={voiceActive ? 'Conversa por voz ativa…' : 'Diga o que precisa…'} rows={2} maxLength={16000}/><div className="composer-footer"><span>{voiceActive ? 'Encerre a voz para usar texto' : 'Enter envia · Shift + Enter nova linha'}</span><button className="send-button" type="submit" aria-label="Enviar mensagem" disabled={!input.trim() || !!runId || voiceActive || demoPlaying || demoStarting || greetingBusy || !bridge}><Icon name="send" size={19}/></button></div></form>
      </section>
    </main>
    <footer className="statusbar"><span><i/>{capabilities.desktop ? 'MOTOR LOCAL' : capabilities.localTest ? 'TESTE LOCAL · PASTA DE ENSAIO' : bridge ? booted ? 'MOTOR DISPONÍVEL' : 'INICIALIZANDO' : 'PRÉVIA SEM CONEXÃO'}</span><span>{actions.length ? `${actions.length} ${actions.length === 1 ? 'ação' : 'ações'} nesta sessão` : 'Nenhuma ação executada nesta sessão'}</span>{weatherAttribution && <WeatherSource source={weatherAttribution} compact onOpen={capabilities.desktop && bridge?.openExternal ? url => { void bridge.openExternal!(url).catch(showError); } : undefined}/>}<button onClick={() => setDrawer('activity')}>ABRIR REGISTRO <span>↗</span></button></footer>
    {(error || notice) && <div className={`toast ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}><span>{error || notice}</span><button className="icon-button" aria-label="Dispensar mensagem" onClick={() => { setError(''); setNotice(''); }}><Icon name="close" size={16}/></button></div>}

    {drawer === 'context' && <Panel title="Contexto" eyebrow="FONTES SOB DEMANDA" onClose={() => setDrawer(null)}><ContextPanel key={`${settings.profileId}:${settings.weatherLocation?.name}:${settings.weatherLocation?.latitude}:${settings.weatherLocation?.longitude}`} bridge={bridge} onSettings={openSettings} onActivity={() => setDrawer('activity')} onOpen={capabilities.desktop && bridge?.openExternal ? url => { void bridge.openExternal!(url).catch(showError); } : undefined}/></Panel>}
    {drawer === 'settings' && <Panel title="À sua maneira." eyebrow="CONFIGURAÇÕES" onClose={() => { setDrawer(null); setApiKey(''); setElevenApiKey(''); }}><form onSubmit={saveSettings} className="settings-form"><p className="drawer-intro">Conecte a inteligência e defina o que Jarvis pode acessar neste computador.</p><fieldset disabled={!bridge || voiceActive || !!runId || saving || !!fireTvBusy}><legend>01 / INTELIGÊNCIA</legend><label>Chave de API OpenAI <span>{settings.hasKey ? capabilities.localTest ? 'Chave ativa nesta sessão · preencher substitui' : 'Chave já salva · preencher substitui' : 'Obrigatória para voz e respostas'}</span><input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={settings.hasKey ? '••••••••••••••••' : 'sk-…'} spellCheck={false}/></label><p className="field-note">{capabilities.localTest ? 'Neste teste, a chave fica apenas na memória até encerrar o servidor local. Não é salva no navegador ou em arquivo.' : 'Guardada pelo aplicativo neste computador. A chave não aparece no histórico da conversa.'}</p><div className="field-grid"><label>Modelo de texto<input value={form.textModel} onChange={e => setForm({ ...form, textModel: e.target.value })} required spellCheck={false}/></label><label>Modelo de conversa<input value={form.realtimeModel} onChange={e => setForm({ ...form, realtimeModel: e.target.value })} required spellCheck={false}/></label></div><div className="field-grid"><label>Limite da sessão <span>minutos</span><input type="number" min="1" max="30" value={form.maxSessionMinutes} onChange={e => setForm({ ...form, maxSessionMinutes: Number(e.target.value) })} required/></label></div></fieldset><fieldset disabled={!bridge || voiceActive || !!runId || saving || !!fireTvBusy}>
<legend>02 / SAUDAÇÃO E TEMPO</legend>
<label className="greeting-toggle"><input type="checkbox" disabled={Boolean(form.standbyEnabled)} checked={Boolean(form.startupGreeting || form.standbyEnabled)} onChange={e => setForm({ ...form, startupGreeting: e.target.checked })}/><span>Saudação com previsão do tempo</span></label>
<p className="field-note">Usa o horário do computador, consulta o tempo atual e a previsão e pergunta como pode ajudar. Com a espera ativa, aguarda palmas ou “Jarvis”; sem a espera, fala ao abrir.</p>
<label>Chave ElevenLabs <span>{settings.hasElevenKey ? capabilities.localTest ? 'Chave ativa nesta sessão · preencher substitui' : 'Chave já salva · preencher substitui' : 'Necessária para a saudação e as respostas com a voz Jarvis'}</span><input type="password" autoComplete="off" ref={elevenKeyInput} value={elevenApiKey} onChange={e => setElevenApiKey(e.target.value)} placeholder={settings.hasElevenKey ? '••••••••••••••••' : 'Sua chave ElevenLabs'} spellCheck={false}/></label>
<p className="field-note">{capabilities.localTest ? 'A chave fica apenas na memória do servidor local até encerrá-lo.' : 'A chave é guardada pelo aplicativo com a proteção do sistema.'} Não a envie na conversa.</p>
<label>Identificador da voz ElevenLabs<input value={form.elevenVoiceId || ''} onChange={e => setForm({ ...form, elevenVoiceId: e.target.value })} placeholder="ID da voz configurada na sua conta" spellCheck={false}/></label>
<details className="weather-settings"><summary>Cidade do boletim {settings.weatherLocation?.name ? `· ${settings.weatherLocation.name}` : '· configurar'}</summary><label>Cidade<input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Cidade e região" maxLength={120}/></label><div className="field-grid"><label>Latitude<input type="number" step="any" min="-90" max="90" value={locationLatitude} onChange={e => setLocationLatitude(e.target.value)} placeholder="Coordenada da cidade"/></label><label>Longitude<input type="number" step="any" min="-180" max="180" value={locationLongitude} onChange={e => setLocationLongitude(e.target.value)} placeholder="Coordenada da cidade"/></label></div><p className="field-note">A cidade é uma configuração privada. As coordenadas permitem consultar a previsão correta sem solicitar sua localização ao navegador.</p></details>
<button type="button" className="quiet-button" disabled={!bridge?.startupGreeting || ultronBusy || (demoPlaying && playbackKind !== 'greeting') || micTesting || micStarting} onClick={() => { if (greetingBusy || (demoPlaying && playbackKind === 'greeting') || (demoStarting && playbackKind === 'greeting')) void cancel(); else void startGreeting(false); }}><Icon name={greetingBusy || (demoPlaying && playbackKind === 'greeting') ? 'stop' : 'speaker'} size={16}/>{greetingBusy || ((demoPlaying || demoStarting) && playbackKind === 'greeting') ? 'Parar saudação' : 'Testar saudação'}</button>
<button type="button" className="quiet-button sample-settings-button" disabled={ultronBusy || voiceActive || micTesting || micStarting || !!runId || greetingBusy || (playbackKind === 'greeting' && (demoPlaying || demoStarting))} onClick={toggleDemo}><Icon name={(demoPlaying || demoStarting) && playbackKind === 'demo' ? 'stop' : 'speaker'} size={16}/>{(demoPlaying || demoStarting) && playbackKind === 'demo' ? 'Parar amostra' : 'Amostra fixa da voz'}</button>
<p className="field-note greeting-test-note">A saudação e a conversa usam a mesma voz ElevenLabs, com efeito fixo e velocidade de 95%. Salve alterações antes de testar.</p>
</fieldset><fieldset disabled={!bridge || !capabilities.jarvisSpeech || voiceActive || !!runId || saving || !!fireTvBusy}>
<legend>03 / INÍCIO E ESPERA</legend>
{capabilities.startup && <><button type="button" className="quiet-button" onClick={() => setForm(current => ({ ...current, startAtLogin: true, startupGreeting: true, standbyEnabled: true, wakeClapEnabled: true, wakeVoiceEnabled: false, greetingMusicEnabled: true, receptionVoiceEnabled: true, continuousVoiceEnabled: true }))}>Ativar recepção completa</button><p className="field-note">Prepara estas opções. Clique em Salvar configuração para aplicar: entrar com o Windows, aguardar duas palmas, música e saudação com o tempo atual e comandos de voz contínuos.</p></>}
<label className="greeting-toggle"><input type="checkbox" disabled={!capabilities.startup} checked={Boolean(form.startAtLogin)} onChange={e => setForm({ ...form, startAtLogin: e.target.checked, ...(e.target.checked ? { standbyEnabled: true } : {}) })}/><span>Iniciar ao entrar no Windows</span></label>
{!capabilities.startup && <p className="field-note">Disponível no aplicativo Windows instalado ou portátil. O teste no navegador não altera a inicialização do computador.</p>}
<label className="greeting-toggle"><input type="checkbox" checked={Boolean(form.standbyEnabled)} onChange={e => setForm({ ...form, standbyEnabled: e.target.checked })}/><span>Entrar em espera e saudar após ativação</span></label>
<label className="greeting-toggle"><input type="checkbox" checked={form.wakeClapEnabled !== false} onChange={e => setForm({ ...form, wakeClapEnabled: e.target.checked })}/><span>Ativar com duas palmas</span></label>
<label className="greeting-toggle"><input type="checkbox" disabled={!capabilities.voiceWake} checked={form.wakeVoiceEnabled !== false} onChange={e => setForm({ ...form, wakeVoiceEnabled: e.target.checked })}/><span>Ativar ao dizer “Jarvis”</span></label>
<p className="field-note">A espera mantém o microfone ativo e processa a ativação neste computador. A fala “Jarvis” requer o reconhecedor de voz do Windows. A escuta pausa durante a saudação e a conversa.</p>
<label className="greeting-toggle"><input type="checkbox" checked={Boolean(form.receptionVoiceEnabled)} onChange={e => setForm({ ...form, receptionVoiceEnabled: e.target.checked, ...(!e.target.checked ? { continuousVoiceEnabled: false } : {}) })}/><span>Aguardar comandos de voz após a recepção</span></label>
<label className="greeting-toggle"><input type="checkbox" disabled={!form.receptionVoiceEnabled} checked={Boolean(form.continuousVoiceEnabled)} onChange={e => setForm({ ...form, continuousVoiceEnabled: e.target.checked })}/><span>Manter a conversa conectada à OpenAI</span></label>
<p className="field-note">A conexão começa depois da recepção. O microfone envia áudio à OpenAI enquanto a conversa estiver ativa, com cobrança da API. A opção contínua renova sessões ao atingir o limite; Interromper, Encerrar voz ou fechar o aplicativo encerra a conexão. Erros exigem iniciar novamente.</p>
{!capabilities.voiceWake && <p className="field-note">No navegador, a espera usa apenas palmas e pode ser suspensa quando a aba fica em segundo plano. Para esperar na bandeja do Windows, use o aplicativo nativo.</p>}
<label className="greeting-toggle"><input type="checkbox" checked={form.greetingMusicEnabled !== false} onChange={e => setForm({ ...form, greetingMusicEnabled: e.target.checked })}/><span>Música durante a saudação</span></label>
<div className="setting-row"><div><strong>Trilha de abertura</strong><p>{settings.hasGreetingMusic ? 'Arquivo privado pronto' : 'Aguardando arquivo de áudio'}</p></div><button className="quiet-button" type="button" disabled={!capabilities.desktop || !bridge?.chooseGreetingMusic} onClick={selectGreetingMusic}><Icon name="folder" size={16}/>Escolher áudio</button></div>
<p className="field-note">MP3, WAV, OGG ou M4A, até 20 MB. A música fica neste computador, toca em volume baixo e termina com a saudação.</p>
</fieldset><details className="weather-settings fire-tv-settings"><summary>TV · Fire TV</summary><fieldset disabled={fireTvBlocked}>
<legend className="sr-only">Controle da Fire TV</legend>
<label className="greeting-toggle"><input type="checkbox" checked={Boolean(form.fireTvEnabled)} onChange={e => { setForm({ ...form, fireTvEnabled: e.target.checked }); setFireTvFeedback(''); }}/><span>Controlar Fire TV pela rede</span></label>
<label>IP da TV <span>Salvo somente neste computador</span><input value={form.fireTvHost || ''} onChange={e => { setForm({ ...form, fireTvHost: e.target.value }); setFireTvFeedback(''); }} placeholder="IP da TV" autoComplete="off" spellCheck={false} maxLength={45}/></label>
<p className="field-note">Ative Depuração ADB na Fire TV e aprove este computador na tela da TV ao parear.</p>
<div className="fire-tv-actions"><button type="button" className="quiet-button" disabled={fireTvBlocked || fireTvDirty || !settings.fireTvEnabled || !settings.fireTvHost || !bridge?.pairFireTv} onClick={() => { void configureFireTv('pair'); }}>{fireTvBusy === 'pair' ? 'Aguardando TV…' : 'Parear TV'}</button><button type="button" className="quiet-button" disabled={fireTvBlocked || fireTvDirty || !settings.fireTvEnabled || !settings.fireTvHost || !bridge?.testFireTv} onClick={() => { void configureFireTv('test'); }}>{fireTvBusy === 'test' ? 'Verificando…' : 'Testar conexão'}</button></div>
</fieldset>{fireTvBusy && <button type="button" className="quiet-button" onClick={() => { void cancel(); }}>Interromper conexão</button>}<p className="field-note fire-tv-status" role="status" aria-live="polite">{!capabilities.fireTv || capabilities.localTest ? 'Disponível no aplicativo Windows.' : fireTvFeedback || (fireTvDirty ? 'Salve a configuração antes de parear ou testar.' : !settings.fireTvEnabled ? 'Controle da TV desativado.' : !settings.fireTvHost ? 'Informe o IP da TV e salve a configuração.' : settings.fireTvPaired ? 'Pareamento salvo. Use Testar conexão para verificar a TV.' : 'Pareamento pendente. Clique em Parear TV.')}</p></details>{capabilities.ultronBridge && <fieldset disabled={!bridge || voiceActive || !!runId || saving || !!fireTvBusy}><legend>CONEXÃO PRIVADA COM ULTRON</legend><label className="greeting-toggle"><input type="checkbox" checked={Boolean(form.ultronEnabled)} onChange={e => setForm({ ...form, ultronEnabled: e.target.checked })}/><span>Permitir que Ultron use o Jarvis neste computador</span></label><p className="field-note">Permite consultar o estado, obter o tempo atual, abrir o navegador padrão, acessar o site solicitado e narrar texto pela ponte privada. Não conecta o microfone ao Dot nem transfere suas memórias. Salve para aplicar.</p></fieldset>}<fieldset disabled={!bridge || voiceActive || !!runId || saving || !!fireTvBusy}><legend>04 / PERFIL</legend><label>Identificador do perfil<input value={form.profileId} onChange={e => setForm({ ...form, profileId: e.target.value })} maxLength={64} required/></label><p className="field-note">Cada perfil mantém suas próprias memórias. A troca encerra o histórico de conversa exibido.</p></fieldset><fieldset disabled={!bridge || voiceActive || !!runId || saving || !!fireTvBusy}><legend>05 / ACESSO LOCAL</legend><div className="setting-row"><div><strong>Pasta de trabalho</strong><p>{settings.workspaceRoot || 'Nenhuma pasta selecionada'}</p></div><button className="quiet-button" type="button" disabled={capabilities.localTest} onClick={selectWorkspace}><Icon name="folder" size={16}/>Escolher</button></div><div className="setting-row"><div><strong>Aplicativos permitidos</strong><p>{settings.apps.length ? settings.apps.map(a => a.label).join(' · ') : 'Nenhum aplicativo autorizado'}</p></div><button className="quiet-button" type="button" disabled={capabilities.localTest} onClick={selectApp}><Icon name="plus" size={16}/>Adicionar</button></div><p className="field-note">Escritas em arquivos e abertura de aplicativos passam por autorização. Não há acesso livre ao terminal.</p></fieldset>{(voiceActive || runId) && <p className="inline-note">Encerre a sessão atual para alterar estas configurações.</p>}<div className="drawer-actions"><button className="quiet-button" type="button" onClick={() => { setDrawer(null); setApiKey(''); setElevenApiKey(''); }}>Cancelar</button><button type="submit" className="primary-button" disabled={!bridge || saving || voiceActive || !!runId || !!fireTvBusy}>{saving ? 'Salvando…' : 'Salvar configuração'}<Icon name="arrow" size={16}/></button></div></form></Panel>}
    {drawer === 'memory' && <Panel title="O que permanece." eyebrow={`MEMÓRIA / ${settings.profileId}`} onClose={() => setDrawer(null)}><div className="drawer-content"><p className="drawer-intro">Preferências e informações que você escolheu guardar. Você pode ler, adicionar e apagar cada registro.</p><form className="memory-form" onSubmit={saveMemory}><label htmlFor="memory-input">Nova memória</label><textarea id="memory-input" placeholder="Ex.: prefiro respostas curtas em português." value={memoryDraft} onChange={e => setMemoryDraft(e.target.value)} maxLength={4000} rows={3}/><button className="primary-button" disabled={!bridge || !memoryDraft.trim() || memoryBusy}><Icon name="plus" size={16}/>{memoryBusy ? 'Salvando…' : 'Guardar memória'}</button></form><div className="section-label">REGISTROS / {profileMemories.length.toString().padStart(2, '0')}</div>{!profileMemories.length && <div className="empty-panel"><Icon name="memory" size={32}/><h3>Uma página em branco.</h3><p>As memórias deste perfil aparecerão aqui.</p></div>}{profileMemories.map(memory => <article className="memory-card" key={memory.id}><div><p>{detail(memory)}</p><small>{time(memory.updatedAt || memory.createdAt)}</small></div><button className="icon-button" aria-label={`Apagar memória: ${detail(memory).slice(0, 60)}`} onClick={() => deleteMemory(memory.id)}><Icon name="trash" size={17}/></button></article>)}{snapshot.procedures.length > 0 && <><div className="section-label">PROCEDIMENTOS REVISÁVEIS</div>{snapshot.procedures.map(procedure => <article className="memory-card" key={procedure.id}><div><strong>{procedure.name || 'Procedimento'}</strong><p>{procedure.text || procedure.summary}</p><small>{humanStatus(procedure.status)}</small></div></article>)}</>}</div></Panel>}
    {drawer === 'activity' && <Panel title="Cada passo, visível." eyebrow="REGISTRO DE ATIVIDADES" onClose={() => setDrawer(null)}><div className="drawer-content"><p className="drawer-intro">Ações propostas, autorizações e resultados. Interromper uma tarefa evita os próximos passos; efeitos já concluídos permanecem registrados.</p>{!activity.length && <div className="empty-panel"><Icon name="activity" size={32}/><h3>Nenhuma ação por enquanto.</h3><p>Quando Jarvis usar uma ferramenta, você acompanhará o resultado aqui.</p></div>}<ol className="timeline">{activity.map(action => <li key={action.id}><span className={`timeline-dot ${action.status}`}/><div className="timeline-meta"><span>{humanStatus(action.status, typeof action.tool === 'string' ? action.tool : undefined)}</span><time>{time(action.updatedAt || action.createdAt)}</time></div><strong>{detail(action)}</strong>{action.name && action.name !== detail(action) && <small>{action.name}</small>}{Boolean(action.error || action.reason) && <p>{String(action.error || action.reason)}</p>}</li>)}</ol></div></Panel>}
    {drawer === 'presence' && <Panel title="Reconhecer sua presença." eyebrow="CÂMERA / PROCESSAMENTO LOCAL" onClose={() => setDrawer(null)}><div className="drawer-content"><p className="drawer-intro">Ative a câmera para reconhecer um rosto cadastrado e escolher o perfil da conversa. Os quadros são enviados apenas ao serviço facial local.</p><div className={`camera-preview ${cameraOn ? 'on' : ''}`}>{cameraOn ? <video ref={video} muted autoPlay playsInline aria-label="Prévia local da câmera"/> : <><Icon name="camera" size={38}/><span>CÂMERA DESLIGADA</span></>}<div className="camera-bracket tl"/><div className="camera-bracket tr"/><div className="camera-bracket bl"/><div className="camera-bracket br"/></div><div className="camera-actions"><button className={cameraOn ? 'quiet-button' : 'primary-button'} disabled={!bridge || visionBusy} onClick={cameraOn ? stopCamera : startCamera}><Icon name={cameraOn ? 'stop' : 'camera'} size={17}/>{visionBusy ? 'Preparando…' : cameraOn ? 'Desligar câmera' : 'Ativar câmera local'}</button></div>{visionStatus?.available === false && <div className="inline-note">{visionStatus.reason || 'O reconhecimento facial requer os modelos locais. Consulte o guia de instalação do projeto.'}</div>}{cameraOn && visionStatus?.available && <><div className="face-result"><span className="eyebrow">{faceResult?.profileId ? 'PERFIL RECONHECIDO' : 'IDENTIFICAÇÃO'}</span><strong>{faceResult?.name || (faceResult?.faceCount > 1 ? 'Mantenha apenas um rosto no quadro' : 'Aguardando reconhecimento…')}</strong>{faceResult?.reason && <p>{faceResult.reason}</p>}{faceResult?.profileId && <button className="quiet-button" disabled={voiceActive || !!runId} onClick={() => useFaceProfile(faceResult.profileId)}>Usar perfil {faceResult.profileId}<Icon name="arrow" size={16}/></button>}</div><div className="section-label">CADASTRAR NO PERFIL ATUAL</div><label className="face-name">Seu nome<input value={faceName} onChange={e => setFaceName(e.target.value)} maxLength={64} placeholder="Como Jarvis deve chamar você"/></label><button className="primary-button" onClick={enrollFace} disabled={!faceName.trim() || enrolling}>{enrolling ? `Capturando ${enrollmentProgress}/3…` : `Cadastrar em ${settings.profileId}`}</button></>}{visionStatus?.profiles?.length > 0 && <><div className="section-label">ROSTOS CADASTRADOS</div>{visionStatus.profiles.map((profile: any) => <article className="memory-card" key={profile.profileId}><div><strong>{profile.name}</strong><small>{profile.profileId}</small></div><button className="icon-button" aria-label={`Apagar rosto de ${profile.name}`} onClick={() => deleteFace(profile.profileId)}><Icon name="trash" size={17}/></button></article>)}</>}<p className="field-note presence-note"><Icon name="shield" size={14}/>O reconhecimento personaliza a experiência. Autorizações de ações continuam dependendo da sua decisão.</p></div></Panel>}
  </div>;
}

class AppErrorBoundary extends React.Component<Record<string, never>, { failed: boolean; recoveries: number }> {
  state = { failed: false, recoveries: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return <App key={this.state.recoveries} skipAutomaticGreeting={this.state.recoveries > 0}/>;
    return <main className="recovery-shell" role="alert"><div className="recovery-card"><span className="eyebrow">J.A.R.V.I.S.</span><h1>Vamos recuperar a interface.</h1><p>Ocorreu uma falha ao exibir esta tela. Tente abrir a interface novamente para continuar.</p><button type="button" className="primary-button" onClick={() => this.setState(state => ({ failed: false, recoveries: state.recoveries + 1 }))}>Tentar novamente</button><small>A saudação não será repetida automaticamente.</small></div></main>;
  }
}

createRoot(document.getElementById('root')!).render(<AppErrorBoundary/>);
