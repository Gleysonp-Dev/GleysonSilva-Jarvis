import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { createHud, type HudFrame } from './hud';
import { RealtimeVoice, type VoiceState } from './realtime';
import { WeatherSource } from './weather-source';
import { createSpeechEffects, DEFAULT_SPEECH_EFFECT_AMOUNT, type SpeechEffectsController } from './speech-effects';

type Message = { id: string; role: 'user' | 'assistant'; text: string; done?: boolean; source?: JarvisWeatherAttribution | string };
type Drawer = 'settings' | 'memory' | 'activity' | 'presence' | null;
const emptySnapshot: JarvisSnapshot = { memories: [], tasks: [], procedures: [] };
const defaultSettings: JarvisSettings = { profileId: 'principal', textModel: '', realtimeModel: '', voice: '', maxSessionMinutes: 10, workspaceRoot: '', apps: [], hasKey: false };
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
    memory: <><path d="M9 4C5 2 2 7 5 10c-4 3-1 9 3 8 0 4 4 4 4 1V5c0-2-2-3-3-1Zm6 0c4-2 7 3 4 6 4 3 1 9-3 8 0 4-4 4-4 1"/><path d="m7 8 2 2m-3 5 3-1m8-6-2 2m3 5-3-1"/></>,
    activity: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
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
const toolNames: Record<string, string> = { apps_open: 'Abrir aplicativo', apps_focus: 'Trazer aplicativo para frente', browser_open: 'Abrir endereço no navegador', browser_read_selected: 'Ler trecho selecionado', projects_open: 'Abrir projeto no editor', workspace_list: 'Listar arquivos', workspace_preview_organize: 'Preparar organização de arquivos', workspace_apply_organize: 'Organizar arquivos', workspace_compensate: 'Restaurar arquivos movidos', memory_propose: 'Guardar memória', notes_dictate: 'Salvar ditado', notes_open_dictation: 'Abrir ditado no Bloco de Notas' };
function humanStatus(status?: string) { return ({ pending: 'Pendente', running: 'Em andamento', executing: 'Executando', completed: 'Concluída', done: 'Concluída', failed: 'Falhou', error: 'Falhou', cancelled: 'Cancelada', denied: 'Recusada', approved: 'Autorizada', waiting: 'Aguardando', interrupted: 'Interrompida', compensating: 'Restauração em andamento', compensated: 'Restaurada', compensation_failed: 'Falha na restauração', needs_review: 'Revisão necessária', unverified: 'Sem confirmação do aplicativo', awaiting_approval: 'Aguardando decisão' } as Record<string, string>)[status || ''] || status || 'Registrada'; }
function detail(record: JarvisRecord) { return record.text || record.summary || record.name || (record.source && record.destination ? `${record.source} → ${record.destination}` : toolNames[String(record.tool)] || 'Registro de tarefa'); }
function normalizeSnapshot(snapshot: JarvisSnapshot): JarvisSnapshot { return { memories: snapshot.memories || [], procedures: snapshot.procedures || [], tasks: (snapshot.tasks || []).map(task => ({ ...task, id: task.id || String(task.runId) })) }; }
function time(value?: string) { if (!value) return ''; const date = new Date(value); return isNaN(date.getTime()) ? '' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }

function App({ skipAutomaticGreeting = false }: { skipAutomaticGreeting?: boolean }) {
  const bridge = window.jarvis;
  const [settings, setSettings] = useState<JarvisSettings>(defaultSettings);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const [snapshot, setSnapshot] = useState<JarvisSnapshot>(emptySnapshot);
  const [capabilities, setCapabilities] = useState<JarvisCapabilities>({ desktop: false, vision: false });
  const [booted, setBooted] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef(messages); messagesRef.current = messages;
  const [input, setInput] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const runRef = useRef<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micStarting, setMicStarting] = useState(false);
  const micGeneration = useRef(0);
  const micTest = useRef<{ stream: MediaStream; context: AudioContext; frame: number } | null>(null);
  const [demoPlaying, setDemoPlaying] = useState(false);
  const [demoStarting, setDemoStarting] = useState(false);
  const [playbackKind, setPlaybackKind] = useState<'demo' | 'greeting'>('demo');
  const demoGeneration = useRef(0);
  const demo = useRef<{ audio: HTMLAudioElement; context: AudioContext; frame: number; objectUrl?: string; effects?: SpeechEffectsController } | null>(null);
  const startupAttempted = useRef(skipAutomaticGreeting);
  const greetingGeneration = useRef(0);
  const [greetingBusy, setGreetingBusy] = useState(false);
  const [greetingNeedsTap, setGreetingNeedsTap] = useState(false);
  const greetingAudio = useRef<{ base64: string; mime: string } | null>(null);
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
  const effectiveMode: HudFrame['mode'] = approvals.length ? 'approval' : demoPlaying ? 'speak' : greetingBusy ? 'think' : micTesting ? 'listen' : voiceState === 'speak' || voiceState === 'listen' ? voiceState : ['execute', 'executing', 'running'].includes(backendState) ? 'execute' : runId ? 'think' : voiceState;
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
    if (!bridge) { setBooted(true); return; }
    let mounted = true;
    bridge.boot().then(data => {
      if (!mounted) return;
      settingsRef.current = data.settings;
      setSettings(data.settings); setForm(data.settings); syncLocationForm(data.settings); setSnapshot(normalizeSnapshot(data.snapshot || emptySnapshot)); setCapabilities(data.capabilities); setBooted(true);
      if (!startupAttempted.current) {
        if (data.settings.startupGreeting && data.settings.weatherLocation?.name && data.settings.elevenVoiceId && data.settings.hasElevenKey) {
        startupAttempted.current = true;
          void startGreeting(true);
        }
        else if (data.settings.startupGreeting) setNotice('Para ouvir a saudação ao iniciar, configure a cidade, a voz e a chave ElevenLabs em Ajustes.');
      }
    }).catch(e => { if (mounted) { showError(e); setBooted(true); } });
    const unsub = bridge.onEvent(raw => {
      const e = raw.payload ? { ...raw, ...raw.payload } : raw;
      if (e.profileId && e.profileId !== settingsRef.current.profileId) return;
      if (e.type === 'session.reset') {
        voice.current?.stop(); voice.current = null; stopMicTest(); stopDemo(); stopCamera();
        greetingAudio.current = null; setElevenApiKey('');
        runRef.current = null; setRunId(null); setBackendState('idle'); setVoiceActive(false); setVoiceConnected(false); setVoiceState('idle'); setApprovals([]);
        if (e.reason === 'profile_changed') { setMessages([]); setActions([]); }
        if (!['window_closed', 'app_quit'].includes(e.reason || '')) setNotice(e.reason === 'profile_changed' ? 'Perfil alterado. Microfone, câmera e sessão anterior foram encerrados.' : 'Configuração atualizada. Microfone, câmera e sessão anterior foram encerrados.');
        return;
      }
      const eventId = e.eventId || (e.type !== 'text.delta' ? e.id && `${e.type}:${e.id}:${e.status || ''}` : undefined);
      if (eventId) { if (seen.current.has(eventId)) return; if (seen.current.size > 3000) seen.current.clear(); seen.current.add(eventId); }
      if (e.type === 'text.delta') {
        const id = `assistant-${e.runId || runRef.current}`;
        setMessages(previous => { const existing = previous.find(m => m.id === id); return existing ? previous.map(m => m.id === id ? { ...m, text: m.text + (e.delta || e.text || '') } : m) : [...previous, { id, role: 'assistant', text: e.delta || e.text || '' }]; });
      }
      if (e.type === 'text.done') { if (e.text) upsertMessage({ id: `assistant-${e.runId || runRef.current}`, role: 'assistant', text: e.text, done: true }); }
      if (e.type === 'state') { setBackendState(e.state || e.status || 'idle'); if (['cancelled', 'completed', 'interrupted', 'failed'].includes(e.state || e.status || '')) { setApprovals(items => items.filter(x => x.runId !== e.runId)); void refresh(); } }
      if (e.type === 'approval') {
        if (['resolved', 'approved', 'denied', 'cancelled', 'expired'].includes(e.status || '')) setApprovals(items => items.filter(x => x.approvalId !== e.approvalId));
        else setApprovals(items => items.some(x => x.approvalId === (e.approvalId || e.id)) ? items : [...items, { ...e, approvalId: e.approvalId || e.id }]);
      }
      if (e.type === 'action') { const id = e.stepId || e.id || e.callId || `${e.runId}:${e.tool || crypto.randomUUID()}`; setActions(items => { const next = { ...e, id, createdAt: e.at, updatedAt: e.at } as JarvisRecord; return [next, ...items.filter(x => x.id !== id)].slice(0, 30); }); if (['completed', 'done', 'failed', 'cancelled'].includes(e.status || '')) void refresh(); }
      if (e.type === 'memory') void refresh();
      if (e.type === 'error') showError(e.message || e.error || 'A operação não pôde ser concluída.');
    });
    const cleanup = () => { mounted = false; unsub(); voice.current?.stop(); stopMicTest(); stopDemo(); stopCamera(); };
    window.addEventListener('beforeunload', cleanup);
    return () => { window.removeEventListener('beforeunload', cleanup); cleanup(); };
  }, []);
  useEffect(() => { if (canvas.current) return createHud(canvas.current, () => ({ ...hud.current, levels: levels.current })); }, []);
  useEffect(() => { historyEnd.current?.scrollIntoView({ block: 'end' }); }, [messages, approvals]);
  useEffect(() => { if (drawer !== 'presence') stopCamera(); }, [drawer]);
  useEffect(() => { if (drawer === 'settings' && focusElevenKey.current) { focusElevenKey.current = false; elevenKeyInput.current?.focus(); } }, [drawer]);
  useEffect(() => { if (cameraOn && video.current && camera.current) { video.current.srcObject = camera.current; void video.current.play().catch(showError); } }, [cameraOn]);

  async function send(text = input) {
    const clean = text.trim();
    if (!clean || runRef.current || voice.current || demo.current || demoStarting || greetingBusy || !bridge) return;
    if (!settings.hasKey) { setDrawer('settings'); return; }
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
    finally { if (runRef.current === id) { runRef.current = null; setRunId(null); setBackendState('idle'); } inputRef.current?.focus(); }
  }
  async function cancel() {
    stopDemo();
    voice.current?.interrupt();
    if (runRef.current && bridge) { try { await bridge.cancel(runRef.current); setApprovals([]); } catch (e) { showError(e); } }
  }
  async function toggleVoice() {
    if (voice.current) { voice.current.stop(); voice.current = null; return; }
    if (!bridge || runId || demo.current || demoStarting || greetingBusy) return;
    if (!settings.hasKey) { setDrawer('settings'); return; }
    stopMicTest();
    setError(''); setVoiceActive(true);
    const session = new RealtimeVoice(bridge, {
      state: setVoiceState,
      connection: setVoiceConnected,
      transcript: (role, text, id, done) => upsertMessage({ role, text, id, done }),
      levels: value => { levels.current = value; if (micMeter.current) micMeter.current.style.setProperty('--level', String(Math.max(value.mic, value.speaker))); },
      error: setError,
      ended: () => { if (voice.current === session) voice.current = null; setVoiceActive(false); setVoiceConnected(false); setApprovals(items => items.filter(x => !String(x.runId || '').startsWith('voice'))); },
    });
    voice.current = session;
    await session.start(settings.profileId, settings.maxSessionMinutes);
  }
  function stopMicTest() {
    micGeneration.current++;
    const session = micTest.current;
    if (session) { cancelAnimationFrame(session.frame); session.stream.getTracks().forEach(track => track.stop()); void session.context.close().catch(() => {}); micTest.current = null; }
    setMicTesting(false); setMicStarting(false); levels.current = { mic: 0, speaker: 0, wave: [] }; if (micMeter.current) micMeter.current.style.setProperty('--level', '0');
  }
  async function toggleMicTest() {
    if (micTest.current) { stopMicTest(); return; }
    if (voice.current || runRef.current || micStarting || demo.current || demoStarting || greetingBusy) return;
    const generation = ++micGeneration.current; setMicStarting(true);
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      if (generation !== micGeneration.current) { stream.getTracks().forEach(track => track.stop()); return; }
      context = new AudioContext(); await context.resume();
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
    } catch (e) { stream?.getTracks().forEach(track => track.stop()); void context?.close().catch(() => {}); showError(e); } finally { if (generation === micGeneration.current) setMicStarting(false); }
  }
  function stopDemo() {
    demoGeneration.current++;
    greetingGeneration.current++; setGreetingBusy(false); setGreetingNeedsTap(false);
    const session = demo.current;
    if (session) {
      demo.current = null; cancelAnimationFrame(session.frame);
      session.audio.onended = null; session.audio.onerror = null; session.audio.pause(); session.audio.removeAttribute('src'); session.audio.load();
      try { session.effects?.dispose(); } catch { /* Closing the context still releases the graph. */ }
      void session.context.close().catch(() => {});
      if (session.objectUrl) URL.revokeObjectURL(session.objectUrl);
    }
    setDemoPlaying(false); setDemoStarting(false); levels.current = { mic: 0, speaker: 0, wave: [] };
    if (micMeter.current) micMeter.current.style.setProperty('--level', '0');
  }
  async function toggleDemo() {
    if (demo.current || demoStarting) { stopDemo(); return; }
    if (voice.current || micTest.current || micStarting || runRef.current || greetingBusy) return;
    await playAudio(new URL('./voice-demo.mp3', window.location.href).href, 'demo');
  }
  async function playAudio(source: string, kind: 'demo' | 'greeting', objectUrl?: string, automatic = false) {
    const generation = ++demoGeneration.current; setDemoStarting(true); setError('');
    setPlaybackKind(kind);
    let context: AudioContext | undefined;
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
      const session = { audio, context, frame: 0, objectUrl, effects }; demo.current = session;
      audio.onended = () => { if (demo.current === session) stopDemo(); };
      audio.onerror = () => { if (demo.current === session) { stopDemo(); setError(kind === 'greeting' ? 'Não foi possível reproduzir o áudio da saudação.' : 'A amostra de voz não está disponível nesta instalação. Atualize os arquivos do aplicativo e tente novamente.'); } };
      if (automatic && context.state === 'suspended' && !navigator.userActivation?.hasBeenActive) {
        stopDemo(); setGreetingNeedsTap(true); setNotice('A saudação está pronta. Clique em Ouvir saudação para liberar o áudio no navegador.'); return;
      }
      let resumeTimer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([context.resume(), new Promise((_, reject) => { resumeTimer = setTimeout(() => reject(new Error('audio_gesture_required')), 3000); })]); }
      finally { clearTimeout(resumeTimer); }
      if (generation !== demoGeneration.current) return;
      await audio.play();
      if (generation !== demoGeneration.current) { audio.pause(); return; }
      setDemoPlaying(true); setDemoStarting(false);
      if (kind === 'greeting') setGreetingNeedsTap(false);
      const measure = () => {
        if (demo.current !== session) return;
        const samples = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(samples);
        let sum = 0; for (const n of samples) sum += ((n - 128) / 128) ** 2;
        const value = Math.min(1, Math.sqrt(sum / samples.length) * 5);
        levels.current = { mic: 0, speaker: value, wave: Array.from(samples).filter((_, i) => i % 6 === 0).slice(0, 41).map(n => Math.abs((n - 128) / 128)) };
        if (micMeter.current) micMeter.current.style.setProperty('--level', String(value));
        session.frame = requestAnimationFrame(measure);
      }; measure();
    } catch (e) {
      if (generation !== demoGeneration.current) return;
      stopDemo(); void context?.close().catch(() => {}); if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (kind === 'greeting') { setGreetingNeedsTap(true); setNotice('O áudio não iniciou. Clique em Ouvir saudação para tentar novamente.'); }
      else showError(e);
    }
  }
  async function playGreeting(automatic = false) {
    const audio = greetingAudio.current;
    if (!audio || demo.current || voice.current || micTest.current || runRef.current) return;
    try {
      const decoded = atob(audio.base64), bytes = new Uint8Array(decoded.length);
      for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: audio.mime || 'audio/mpeg' }));
      await playAudio(objectUrl, 'greeting', objectUrl, automatic);
    } catch (e) { showError(e); }
  }
  async function startGreeting(automatic = false) {
    if (!bridge?.startupGreeting || voice.current || micTest.current || runRef.current || demo.current) return;
    stopDemo(); const generation = ++greetingGeneration.current; setGreetingBusy(true); setError(''); greetingAudio.current = null;
    try {
      const result = await bridge.startupGreeting({ hour: new Date().getHours(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
      if (generation !== greetingGeneration.current) return;
      setGreetingBusy(false);
      if (result.text) upsertMessage({ id: `greeting-${crypto.randomUUID()}`, role: 'assistant', text: result.text, done: true, source: result.attribution });
      if (result.audioBase64) { greetingAudio.current = { base64: result.audioBase64, mime: result.mime }; await playGreeting(automatic); }
      else setNotice(result.reason === 'requires_key' ? 'Saudação pronta em texto. Configure a chave ElevenLabs em Ajustes para ouvi-la.' : 'Saudação pronta em texto. Não foi possível gerar áudio; verifique a conexão e as permissões da chave ElevenLabs.');
    } catch (e) { if (generation === greetingGeneration.current) showError(e); }
    finally { if (generation === greetingGeneration.current) setGreetingBusy(false); }
  }
  function beginJarvis() {
    if (greetingBusy || (playbackKind === 'greeting' && (demoPlaying || demoStarting))) { void cancel(); return; }
    const current = settingsRef.current;
    if (!current.hasElevenKey || !current.elevenVoiceId || !current.weatherLocation?.name) {
      setNotice(!current.hasElevenKey ? 'A saudação precisa da chave ElevenLabs. Informe-a no campo privado e salve para iniciar Jarvis.' : 'Configure a voz ElevenLabs e a cidade do boletim para iniciar a recepção Jarvis.');
      focusElevenKey.current = !current.hasElevenKey; openSettings(); return;
    }
    void startGreeting(false);
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
    if (voiceActive || runId) { setError('Encerre a sessão atual antes de alterar a configuração.'); return; }
    setSaving(true);
    const previousSettings = settingsRef.current;
    try {
      let weatherLocation: JarvisSettings['weatherLocation'] = null;
      if (locationName.trim() || locationLatitude.trim() || locationLongitude.trim()) {
        const latitude = Number(locationLatitude), longitude = Number(locationLongitude);
        if (!locationName.trim() || !locationLatitude.trim() || !locationLongitude.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('Informe a cidade e coordenadas válidas para o boletim do tempo.');
        weatherLocation = { name: locationName.trim(), latitude, longitude };
      }
      await bridge.saveSettings({ profileId: form.profileId.trim(), textModel: form.textModel.trim(), realtimeModel: form.realtimeModel.trim(), voice: form.voice.trim(), maxSessionMinutes: Number(form.maxSessionMinutes), startupGreeting: Boolean(form.startupGreeting), weatherLocation, elevenVoiceId: (form.elevenVoiceId || '').trim(), ...(apiKey ? { apiKey: apiKey.trim() } : {}), ...(elevenApiKey ? { elevenApiKey: elevenApiKey.trim() } : {}) });
      setApiKey(''); setElevenApiKey('');
      const data = await bridge.boot();
      if (data.settings.profileId !== settings.profileId) { setMessages([]); setActions([]); }
      settingsRef.current = data.settings;
      setSettings(data.settings); setForm(data.settings); syncLocationForm(data.settings); setSnapshot(normalizeSnapshot(data.snapshot)); setCapabilities(data.capabilities); setNotice(data.capabilities.localTest ? 'Configuração aplicada nesta sessão de teste. As chaves ficam apenas na memória até encerrar o servidor local.' : 'Configuração salva neste computador.'); setDrawer(null);
      if (!startupAttempted.current && !previousSettings.hasElevenKey && data.settings.hasElevenKey && data.settings.startupGreeting && data.settings.weatherLocation?.name && data.settings.elevenVoiceId && previousSettings.profileId === data.settings.profileId) {
        startupAttempted.current = true; void startGreeting(true);
      }
    } catch (e) { showError(e); } finally { setSaving(false); }
  }
  async function selectWorkspace() { try { const path = await bridge?.chooseWorkspace(); if (path) { setSettings(s => ({ ...s, workspaceRoot: path })); setForm(s => ({ ...s, workspaceRoot: path })); } } catch (e) { showError(e); } }
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
    if (runId || voiceActive) { setError('Encerre a conversa atual para trocar de perfil.'); return; }
    try { await bridge?.saveSettings({ profileId }); const data = await bridge!.boot(); setSettings(data.settings); setForm(data.settings); setSnapshot(normalizeSnapshot(data.snapshot)); setMessages([]); setActions([]); stopCamera(); setDrawer(null); } catch (e) { showError(e); }
  }

  const status = demoPlaying ? { label: playbackKind === 'greeting' ? 'SAUDAÇÃO JARVIS' : 'AMOSTRA DA VOZ JARVIS' } : greetingBusy ? { label: 'PREPARANDO SAUDAÇÃO' } : micTesting ? { label: 'TESTE DE MICROFONE' } : states[effectiveMode] || states.idle;
  const profileMemories = snapshot.memories.filter(m => !m.profileId || m.profileId === settings.profileId);
  const activity = [...actions, ...snapshot.tasks.filter(t => !actions.some(a => a.id === t.id))].slice(0, 30);
  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-symbol" aria-hidden="true"><i/><i/><i/></span><div><strong>J.A.R.V.I.S.</strong><span>PERSONAL INTELLIGENCE</span></div><span className="version">MVP / 01</span></div><div className="top-right"><span className={`connection ${voiceConnected ? 'active' : ''}`}><i/>{voiceConnected ? 'VOZ CONECTADA' : runId ? 'SESSÃO DE TEXTO' : settings.hasKey ? 'PRONTO PARA CONECTAR' : 'CONFIGURAÇÃO INICIAL'}</span><button className="profile-button" onClick={openSettings}><span className="avatar">{(settings.profileId || 'P').slice(0, 1).toUpperCase()}</span><span>{settings.profileId || 'Perfil'}</span><Icon name="settings" size={17}/></button></div></header>
    <main className="workspace">
      <nav className="rail" aria-label="Painéis"><button className={drawer === 'memory' ? 'selected' : ''} title="Memória" aria-label="Memória" onClick={() => setDrawer('memory')}><Icon name="memory"/><span>MEMÓRIA</span></button><button className={drawer === 'activity' ? 'selected' : ''} title="Atividades" aria-label="Atividades" onClick={() => setDrawer('activity')}><Icon name="activity"/><span>REGISTRO</span></button><button className={drawer === 'presence' ? 'selected' : ''} title="Presença e perfis" aria-label="Presença e perfis" onClick={() => setDrawer('presence')}><Icon name="camera"/><span>PRESENÇA</span></button><div className="rail-spacer"/><button title="Configurações" aria-label="Configurações" onClick={openSettings}><Icon name="settings"/><span>AJUSTES</span></button></nav>
      <section className="core-column" aria-label="Núcleo Jarvis">
        <div className="reactor-stage">
          <canvas ref={canvas} role="img" aria-label={`Núcleo holográfico ciano Jarvis. ${status.label}.`}/>
          <div className="stage-label top-left"><span>ENTRADA</span><b>{demoPlaying ? 'ARQUIVO DE ÁUDIO LOCAL' : micTesting ? 'TESTE LOCAL ATIVO' : voiceActive ? voiceConnected ? 'MICROFONE ATIVO' : 'PREPARANDO ÁUDIO' : 'TEXTO DISPONÍVEL'}</b><div className="signal-bars" ref={micMeter} aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} style={{ '--bar': `${20 + (i % 4) * 21}%` } as React.CSSProperties}/>)}</div></div>
          <div className="stage-label top-right"><span>MODELO</span><b>{demoPlaying ? playbackKind === 'greeting' ? 'SAUDAÇÃO ELEVENLABS' : 'AMOSTRA ELEVENLABS' : voiceActive ? settings.realtimeModel || 'NÃO DEFINIDO' : settings.textModel || 'NÃO DEFINIDO'}</b><small>{demoPlaying ? 'VOZ PERSONALIZADA · AMOSTRA' : voiceActive ? 'ÁUDIO EM TEMPO REAL' : 'OPENAI · RESPOSTA PROGRESSIVA'}</small></div>
          <div className="stage-label bottom-left"><span>CONTEXTO</span><b>{`${profileMemories.length} MEMÓRIA${profileMemories.length === 1 ? '' : 'S'} NO PERFIL`}</b><small>Perfil: {settings.profileId}</small></div>
          <div className="stage-label bottom-right"><span>ESPAÇO DE TRABALHO</span><b>{settings.workspaceRoot ? 'PASTA DEFINIDA' : 'NENHUMA PASTA DEFINIDA'}</b><button className="text-link" onClick={openSettings}>{settings.workspaceRoot ? 'Ver permissões' : 'Configurar acesso'} <span>↗</span></button></div>
          <div className="reactor-status" aria-live="polite"><span className="status-line"/><strong>{status.label}</strong></div>
        </div>
        <div className="core-controls"><button className="voice-button welcome-button" disabled={!bridge?.startupGreeting || !booted || voiceActive || micTesting || micStarting || !!runId || (playbackKind === 'demo' && (demoPlaying || demoStarting))} onClick={beginJarvis}><Icon name={greetingBusy || (playbackKind === 'greeting' && (demoPlaying || demoStarting)) ? 'stop' : 'speaker'} size={19}/><span>{greetingBusy || (playbackKind === 'greeting' && (demoPlaying || demoStarting)) ? 'Parar recepção' : 'Iniciar Jarvis'}<small>Saudação, tempo atual e previsão</small></span></button><button className={`voice-button ${voiceActive ? 'enabled' : ''}`} disabled={!bridge || !booted || !!runId || demoPlaying || demoStarting || greetingBusy} onClick={toggleVoice}><Icon name={voiceActive ? 'stop' : 'mic'} size={19}/>{voiceActive ? 'Encerrar voz' : 'Iniciar conversa por voz'}<span className="keycap">{voiceActive ? 'ON' : 'MIC'}</span></button><button className="quiet-button interrupt" disabled={!runId && !voiceActive && !demoPlaying && !demoStarting && !greetingBusy} onClick={cancel}><Icon name="stop" size={15}/>Interromper</button></div>
        <div className="hardware-tools"><button disabled={voiceActive || !!runId || micStarting || demoPlaying || demoStarting || greetingBusy} onClick={toggleMicTest}><Icon name="mic" size={13}/>{micStarting ? 'Preparando microfone…' : micTesting ? 'Encerrar teste local' : 'Testar microfone'}</button><span>·</span><button onClick={() => setDrawer('presence')}><Icon name="camera" size={13}/>Testar câmera</button></div>
        {(voiceActive || micTesting || cameraOn) && <div className="capture-indicators">{(voiceActive || micTesting) && <span><Icon name="mic" size={11}/>Microfone ativo</span>}{cameraOn && <span><Icon name="camera" size={11}/>Câmera ativa</span>}</div>}
      </section>
      <section className="conversation" aria-label="Conversa com Jarvis"><header className="conversation-header"><h2>Conversa</h2><span className="small-pill">{voiceActive ? 'VOZ' : 'TEXTO'}</span></header>
        {!bridge && <div className="inline-note">Prévia da interface. Abra o aplicativo desktop para conectar voz, memória e ações reais.</div>}
        {capabilities.localTest && <div className="inline-note local-test-banner"><strong>TESTE LOCAL · PASTA DE ENSAIO</strong></div>}
        {greetingNeedsTap && <div className="greeting-ready"><span>Sua saudação está pronta para ouvir.</span><button type="button" className="quiet-button" disabled={voiceActive || micTesting || !!runId || demoPlaying || demoStarting || greetingBusy} onClick={() => void playGreeting()}><Icon name="speaker" size={15}/>Ouvir saudação</button></div>}
        {bridge && booted && !settings.hasKey && <button className="setup-banner" onClick={openSettings}><Icon name="plus" size={18}/><span>Conecte sua conta OpenAI<small>Adicione uma chave de API para começar.</small></span><Icon name="arrow" size={16}/></button>}
        <div className="messages" role="log" aria-label="Mensagens da conversa" aria-live="polite" aria-relevant="additions">
          {messages.map(message => <article key={message.id} className={`message ${message.role}`}><div className="message-meta"><span>{message.role === 'user' ? 'VOCÊ' : 'J.A.R.V.I.S.'}</span>{message.done === false && <i className="stream-dot"/>}</div><p>{message.text || <span className="thinking-dots" aria-label="Preparando resposta">···</span>}</p>{message.source && <WeatherSource source={message.source} onOpen={capabilities.desktop && bridge?.openExternal ? url => { void bridge.openExternal!(url).catch(showError); } : undefined}/>}</article>)}
          <div ref={historyEnd}/>
        </div>
        {approvals.length > 0 && <div className="approvals">{approvals.map(approval => <div className="approval-card" key={approval.approvalId}><div className="approval-title"><Icon name="shield" size={17}/><span>AÇÃO AGUARDANDO DECISÃO</span></div><strong>{approval.title || approval.summary || approval.description || approval.name || 'Autorizar ação'}</strong>{Boolean(approval.details || approval.args) && <pre>{JSON.stringify(approval.details || approval.args, null, 2)}</pre>}<p>Esta autorização vale apenas para esta ação.</p><div className="approval-buttons"><button className="quiet-button" disabled={!!deciding} onClick={() => decide(approval, false)}>Recusar</button><button className="primary-button" disabled={!!deciding} onClick={() => decide(approval, true)}><Icon name="check" size={16}/>{deciding === approval.approvalId ? 'Aplicando…' : 'Autorizar'}</button></div></div>)}</div>}
        <form className="composer" onSubmit={e => { e.preventDefault(); void send(); }}><label className="sr-only" htmlFor="message-input">Mensagem para Jarvis</label><textarea id="message-input" ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} disabled={!bridge || voiceActive} placeholder={voiceActive ? 'Conversa por voz ativa…' : 'Diga o que precisa…'} rows={2} maxLength={16000}/><div className="composer-footer"><span>{voiceActive ? 'Encerre a voz para usar texto' : 'Enter envia · Shift + Enter nova linha'}</span><button className="send-button" type="submit" aria-label="Enviar mensagem" disabled={!input.trim() || !!runId || voiceActive || demoPlaying || demoStarting || greetingBusy || !bridge}><Icon name="send" size={19}/></button></div></form>
      </section>
    </main>
    <footer className="statusbar"><span><i/>{capabilities.desktop ? 'MOTOR LOCAL' : capabilities.localTest ? 'TESTE LOCAL · PASTA DE ENSAIO' : bridge ? booted ? 'MOTOR DISPONÍVEL' : 'INICIALIZANDO' : 'PRÉVIA SEM CONEXÃO'}</span><span>{actions.length ? `${actions.length} ${actions.length === 1 ? 'ação' : 'ações'} nesta sessão` : 'Nenhuma ação executada nesta sessão'}</span><button onClick={() => setDrawer('activity')}>ABRIR REGISTRO <span>↗</span></button></footer>
    {(error || notice) && <div className={`toast ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}><span>{error || notice}</span><button className="icon-button" aria-label="Dispensar mensagem" onClick={() => { setError(''); setNotice(''); }}><Icon name="close" size={16}/></button></div>}

    {drawer === 'settings' && <Panel title="À sua maneira." eyebrow="CONFIGURAÇÕES" onClose={() => { setDrawer(null); setApiKey(''); setElevenApiKey(''); }}><form onSubmit={saveSettings} className="settings-form"><p className="drawer-intro">Conecte a inteligência e defina o que Jarvis pode acessar neste computador.</p><fieldset disabled={!bridge || voiceActive || !!runId || saving}><legend>01 / INTELIGÊNCIA</legend><label>Chave de API OpenAI <span>{settings.hasKey ? capabilities.localTest ? 'Chave ativa nesta sessão · preencher substitui' : 'Chave já salva · preencher substitui' : 'Obrigatória para voz e respostas'}</span><input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={settings.hasKey ? '••••••••••••••••' : 'sk-…'} spellCheck={false}/></label><p className="field-note">{capabilities.localTest ? 'Neste teste, a chave fica apenas na memória até encerrar o servidor local. Não é salva no navegador ou em arquivo.' : 'Guardada pelo aplicativo neste computador. A chave não aparece no histórico da conversa.'}</p><div className="field-grid"><label>Modelo de texto<input value={form.textModel} onChange={e => setForm({ ...form, textModel: e.target.value })} required spellCheck={false}/></label><label>Modelo de voz<input value={form.realtimeModel} onChange={e => setForm({ ...form, realtimeModel: e.target.value })} required spellCheck={false}/></label></div><div className="field-grid"><label>Voz<input value={form.voice} onChange={e => setForm({ ...form, voice: e.target.value })} required spellCheck={false}/></label><label>Limite da sessão <span>minutos</span><input type="number" min="1" max="30" value={form.maxSessionMinutes} onChange={e => setForm({ ...form, maxSessionMinutes: Number(e.target.value) })} required/></label></div></fieldset><fieldset disabled={!bridge || voiceActive || !!runId || saving}>
<legend>02 / SAUDAÇÃO E TEMPO</legend>
<label className="greeting-toggle"><input type="checkbox" checked={Boolean(form.startupGreeting)} onChange={e => setForm({ ...form, startupGreeting: e.target.checked })}/><span>Cumprimentar ao iniciar</span></label>
<p className="field-note">Usa o horário do computador, consulta o tempo atual e a previsão para a cidade configurada e termina perguntando como pode ajudar.</p>
<label>Chave ElevenLabs <span>{settings.hasElevenKey ? capabilities.localTest ? 'Chave ativa nesta sessão · preencher substitui' : 'Chave já salva · preencher substitui' : 'Necessária para falar a saudação com a voz Jarvis'}</span><input type="password" autoComplete="off" ref={elevenKeyInput} value={elevenApiKey} onChange={e => setElevenApiKey(e.target.value)} placeholder={settings.hasElevenKey ? '••••••••••••••••' : 'Sua chave ElevenLabs'} spellCheck={false}/></label>
<p className="field-note">{capabilities.localTest ? 'A chave fica apenas na memória do servidor local até encerrá-lo.' : 'A chave é guardada pelo aplicativo com a proteção do sistema.'} Não a envie na conversa.</p>
<label>Identificador da voz ElevenLabs<input value={form.elevenVoiceId || ''} onChange={e => setForm({ ...form, elevenVoiceId: e.target.value })} placeholder="ID da voz configurada na sua conta" spellCheck={false}/></label>
<details className="weather-settings"><summary>Cidade do boletim {settings.weatherLocation?.name ? `· ${settings.weatherLocation.name}` : '· configurar'}</summary><label>Cidade<input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Cidade e região" maxLength={120}/></label><div className="field-grid"><label>Latitude<input type="number" step="any" min="-90" max="90" value={locationLatitude} onChange={e => setLocationLatitude(e.target.value)} placeholder="Coordenada da cidade"/></label><label>Longitude<input type="number" step="any" min="-180" max="180" value={locationLongitude} onChange={e => setLocationLongitude(e.target.value)} placeholder="Coordenada da cidade"/></label></div><p className="field-note">A cidade é uma configuração privada. As coordenadas permitem consultar a previsão correta sem solicitar sua localização ao navegador.</p></details>
<button type="button" className="quiet-button" disabled={!bridge?.startupGreeting || (demoPlaying && playbackKind !== 'greeting') || micTesting || micStarting} onClick={() => { if (greetingBusy || (demoPlaying && playbackKind === 'greeting') || (demoStarting && playbackKind === 'greeting')) void cancel(); else void startGreeting(false); }}><Icon name={greetingBusy || (demoPlaying && playbackKind === 'greeting') ? 'stop' : 'speaker'} size={16}/>{greetingBusy || ((demoPlaying || demoStarting) && playbackKind === 'greeting') ? 'Parar saudação' : 'Testar saudação'}</button>
<button type="button" className="quiet-button sample-settings-button" disabled={voiceActive || micTesting || micStarting || !!runId || greetingBusy || (playbackKind === 'greeting' && (demoPlaying || demoStarting))} onClick={toggleDemo}><Icon name={(demoPlaying || demoStarting) && playbackKind === 'demo' ? 'stop' : 'speaker'} size={16}/>{(demoPlaying || demoStarting) && playbackKind === 'demo' ? 'Parar amostra' : 'Amostra fixa da voz'}</button>
<p className="field-note greeting-test-note">O teste usa a configuração salva. Salve alterações de chave, voz ou cidade antes de testar. A conversa ao vivo continua usando a voz OpenAI.</p>
</fieldset><fieldset disabled={!bridge || voiceActive || !!runId || saving}><legend>03 / PERFIL</legend><label>Identificador do perfil<input value={form.profileId} onChange={e => setForm({ ...form, profileId: e.target.value })} maxLength={64} required/></label><p className="field-note">Cada perfil mantém suas próprias memórias. A troca encerra o histórico de conversa exibido.</p></fieldset><fieldset disabled={!bridge || voiceActive || !!runId || saving}><legend>04 / ACESSO LOCAL</legend><div className="setting-row"><div><strong>Pasta de trabalho</strong><p>{settings.workspaceRoot || 'Nenhuma pasta selecionada'}</p></div><button className="quiet-button" type="button" disabled={capabilities.localTest} onClick={selectWorkspace}><Icon name="folder" size={16}/>Escolher</button></div><div className="setting-row"><div><strong>Aplicativos permitidos</strong><p>{settings.apps.length ? settings.apps.map(a => a.label).join(' · ') : 'Nenhum aplicativo autorizado'}</p></div><button className="quiet-button" type="button" disabled={capabilities.localTest} onClick={selectApp}><Icon name="plus" size={16}/>Adicionar</button></div><p className="field-note">Escritas em arquivos e abertura de aplicativos passam por autorização. Não há acesso livre ao terminal.</p></fieldset>{(voiceActive || runId) && <p className="inline-note">Encerre a sessão atual para alterar estas configurações.</p>}<div className="drawer-actions"><button className="quiet-button" type="button" onClick={() => { setDrawer(null); setApiKey(''); setElevenApiKey(''); }}>Cancelar</button><button type="submit" className="primary-button" disabled={!bridge || saving || voiceActive || !!runId}>{saving ? 'Salvando…' : 'Salvar configuração'}<Icon name="arrow" size={16}/></button></div></form></Panel>}
    {drawer === 'memory' && <Panel title="O que permanece." eyebrow={`MEMÓRIA / ${settings.profileId}`} onClose={() => setDrawer(null)}><div className="drawer-content"><p className="drawer-intro">Preferências e informações que você escolheu guardar. Você pode ler, adicionar e apagar cada registro.</p><form className="memory-form" onSubmit={saveMemory}><label htmlFor="memory-input">Nova memória</label><textarea id="memory-input" placeholder="Ex.: prefiro respostas curtas em português." value={memoryDraft} onChange={e => setMemoryDraft(e.target.value)} maxLength={4000} rows={3}/><button className="primary-button" disabled={!bridge || !memoryDraft.trim() || memoryBusy}><Icon name="plus" size={16}/>{memoryBusy ? 'Salvando…' : 'Guardar memória'}</button></form><div className="section-label">REGISTROS / {profileMemories.length.toString().padStart(2, '0')}</div>{!profileMemories.length && <div className="empty-panel"><Icon name="memory" size={32}/><h3>Uma página em branco.</h3><p>As memórias deste perfil aparecerão aqui.</p></div>}{profileMemories.map(memory => <article className="memory-card" key={memory.id}><div><p>{detail(memory)}</p><small>{time(memory.updatedAt || memory.createdAt)}</small></div><button className="icon-button" aria-label={`Apagar memória: ${detail(memory).slice(0, 60)}`} onClick={() => deleteMemory(memory.id)}><Icon name="trash" size={17}/></button></article>)}{snapshot.procedures.length > 0 && <><div className="section-label">PROCEDIMENTOS REVISÁVEIS</div>{snapshot.procedures.map(procedure => <article className="memory-card" key={procedure.id}><div><strong>{procedure.name || 'Procedimento'}</strong><p>{procedure.text || procedure.summary}</p><small>{humanStatus(procedure.status)}</small></div></article>)}</>}</div></Panel>}
    {drawer === 'activity' && <Panel title="Cada passo, visível." eyebrow="REGISTRO DE ATIVIDADES" onClose={() => setDrawer(null)}><div className="drawer-content"><p className="drawer-intro">Ações propostas, autorizações e resultados. Interromper uma tarefa evita os próximos passos; efeitos já concluídos permanecem registrados.</p>{!activity.length && <div className="empty-panel"><Icon name="activity" size={32}/><h3>Nenhuma ação por enquanto.</h3><p>Quando Jarvis usar uma ferramenta, você acompanhará o resultado aqui.</p></div>}<ol className="timeline">{activity.map(action => <li key={action.id}><span className={`timeline-dot ${action.status}`}/><div className="timeline-meta"><span>{humanStatus(action.status)}</span><time>{time(action.updatedAt || action.createdAt)}</time></div><strong>{detail(action)}</strong>{action.name && action.name !== detail(action) && <small>{action.name}</small>}{Boolean(action.error || action.reason) && <p>{String(action.error || action.reason)}</p>}</li>)}</ol></div></Panel>}
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
