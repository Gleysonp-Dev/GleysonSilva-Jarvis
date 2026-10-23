import React, { useEffect, useRef, useState } from 'react';

type RemoteAction = 'home' | 'back' | 'up' | 'down' | 'left' | 'right' | 'ok' | 'volume_up' | 'volume_down' | 'mute' | 'play' | 'pause';
type RemoteApp = 'netflix' | 'prime_video' | 'youtube' | 'disney_plus' | 'max' | 'spotify';
type Intent = { action: RemoteAction; app?: never } | { app: RemoteApp; action?: never };
type RemoteJob = { id: string; runId: string; profileId: string; intent: Intent };
const applications: Array<{ app: RemoteApp; label: string; initial: string }> = [
  { app: 'netflix', label: 'Netflix', initial: 'N' },
  { app: 'prime_video', label: 'Prime Video', initial: 'P' },
  { app: 'youtube', label: 'YouTube', initial: 'Y' },
  { app: 'disney_plus', label: 'Disney+', initial: 'D' },
  { app: 'max', label: 'Max', initial: 'M' },
  { app: 'spotify', label: 'Spotify', initial: 'S' },
];

function RemoteIcon({ name }: { name: RemoteAction }) {
  const paths: Record<RemoteAction, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10h-6v-6H9v6H3V10Z"/></>,
    back: <><path d="m9 6-6 6 6 6M3 12h11a7 7 0 0 1 7 7"/></>,
    up: <path d="m6 15 6-6 6 6"/>, down: <path d="m6 9 6 6 6-6"/>,
    left: <path d="m15 6-6 6 6 6"/>, right: <path d="m9 6 6 6-6 6"/>,
    ok: <path d="m5 12 4 4L19 6"/>,
    volume_up: <><path d="m10 4-5 5H2v6h3l5 5V4ZM15 12h7m-3.5-3.5v7"/></>,
    volume_down: <><path d="m10 4-5 5H2v6h3l5 5V4ZM15 12h7"/></>,
    mute: <><path d="m10 4-5 5H2v6h3l5 5V4Zm5 5 6 6m0-6-6 6"/></>,
    play: <path d="m8 4 12 8-12 8V4Z"/>,
    pause: <><path d="M8 4v16M16 4v16"/></>,
  };
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

/** A button sends one intent. No polling, held-key repetition or inferred TV state. */
export function TvRemote({ bridge, profileId, available, blocked = false, onSettings, onPendingChange, onCancelReady }: {
  bridge?: JarvisBridge;
  profileId: string;
  available: boolean;
  blocked?: boolean;
  onSettings(): void;
  onPendingChange(pending: boolean, requestId: string): void;
  onCancelReady?(cancel: (() => void) | null): void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const mounted = useRef(false);
  const flight = useRef<RemoteJob | null>(null);
  const cancelling = useRef<Promise<unknown> | null>(null);
  const latest = useRef({ bridge, profileId, available, blocked, onPendingChange, onCancelReady });
  latest.current = { bridge, profileId, available, blocked, onPendingChange, onCancelReady };
  const ready = Boolean(available && bridge?.fireTvRemote && bridge?.cancelFireTvRemote);

  function interrupt(update = true) {
    const job = flight.current;
    if (!job) return;
    flight.current = null;
    if (update && mounted.current) setFeedback('Comando interrompido. Confira a televisão antes de repetir.');
    const pending = Promise.resolve().then(() => bridge?.cancelFireTvRemote?.({ id: job.id, runId: job.runId, profileId: job.profileId })).catch(() => undefined);
    cancelling.current = pending;
    void pending.finally(() => {
      if (cancelling.current !== pending) return;
      cancelling.current = null;
      if (mounted.current) setBusy(false);
      latest.current.onPendingChange(false, job.id);
    });
  }

  useEffect(() => {
    mounted.current = true;
    setFeedback('');
    latest.current.onCancelReady?.(() => interrupt());
    const reset = (event: JarvisEvent) => {
      const value = event.payload ? { ...event, ...event.payload } : event;
      if (value.type !== 'session.reset' || (value.profileId && value.profileId !== profileId)) return;
      interrupt();
      if (!flight.current && !cancelling.current) { setFeedback(''); setBusy(false); }
    };
    const unsubscribe = bridge?.onEvent(reset);
    const unloading = () => interrupt(false);
    window.addEventListener('beforeunload', unloading);
    return () => {
      mounted.current = false;
      latest.current.onCancelReady?.(null);
      unsubscribe?.(); window.removeEventListener('beforeunload', unloading);
      interrupt(false);
    };
  }, [bridge, profileId, available]);

  async function send(intent: Intent) {
    const current = latest.current;
    if (!mounted.current || !ready || !current.available || current.blocked || flight.current || cancelling.current || !current.bridge?.fireTvRemote || !current.bridge.cancelFireTvRemote) return;
    const job: RemoteJob = { id: crypto.randomUUID(), runId: `tv-remote-${crypto.randomUUID()}`, profileId: current.profileId, intent };
    flight.current = job; setBusy(true); setFeedback(''); current.onPendingChange(true, job.id);
    const active = () => mounted.current && flight.current === job && latest.current.profileId === job.profileId && latest.current.available;
    try {
      const result = await current.bridge.fireTvRemote({ id: job.id, runId: job.runId, profileId: job.profileId, ...intent });
      if (!active()) return;
      const key = intent.action ? 'action' : 'app';
      if (result?.ok === true && result.status === 'unverified' && result.data?.[key] === intent[key]) setFeedback('Comando enviado · confira a televisão.');
      else if (result?.status === 'cancelled') setFeedback('Comando interrompido. Confira a televisão antes de repetir.');
      else setFeedback('Não foi possível confirmar o envio. Confira a televisão antes de tentar novamente.');
    } catch {
      if (active()) setFeedback('Não foi possível enviar o comando. Confira a conexão da TV nos Ajustes.');
    } finally {
      if (flight.current === job) {
        flight.current = null;
        if (mounted.current) setBusy(false);
        latest.current.onPendingChange(false, job.id);
      }
    }
  }

  const disabled = !ready || blocked || busy;
  const actionButton = (action: RemoteAction, label: string, className = '') => <button key={action} type="button" className={`tv-remote-button ${className}`} aria-label={label} title={label} disabled={disabled} onKeyDown={event => { if (event.repeat) event.preventDefault(); }} onClick={() => { void send({ action }); }}><RemoteIcon name={action}/>{action === 'ok' && <span>OK</span>}</button>;

  return <div className="drawer-content tv-remote-content">
    <div className="tv-remote-heading"><span className="tv-device-symbol" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4"/></svg></span><div><strong>Fire TV</strong><span>Controle pela rede local</span></div></div>
    {!ready && <div className="tv-remote-setup"><p>Configure e pareie sua Fire TV para usar o controle.</p><button className="quiet-button" type="button" onClick={onSettings}>Abrir Ajustes</button></div>}
    <div className="tv-remote-body" aria-label="Controle remoto da Fire TV" aria-busy={busy}>
      <div className="tv-remote-navigation">{actionButton('back', 'Voltar')}{actionButton('home', 'Início')}</div>
      <div className="tv-remote-dpad" role="group" aria-label="Navegação">{actionButton('up', 'Cima', 'tv-up')}{actionButton('left', 'Esquerda', 'tv-left')}{actionButton('ok', 'Confirmar', 'tv-ok')}{actionButton('right', 'Direita', 'tv-right')}{actionButton('down', 'Baixo', 'tv-down')}</div>
      <div className="tv-remote-volume" role="group" aria-label="Volume">{actionButton('volume_down', 'Diminuir volume')}{actionButton('mute', 'Silenciar ou ativar som')}{actionButton('volume_up', 'Aumentar volume')}</div>
      <div className="tv-remote-playback" role="group" aria-label="Reprodução">{actionButton('play', 'Reproduzir')}{actionButton('pause', 'Pausar')}</div>
    </div>
    <div className="tv-remote-apps" role="group" aria-label="Abrir aplicativo na TV">{applications.map(application => <button key={application.app} type="button" className="tv-app-button" aria-label={application.label} disabled={disabled} onKeyDown={event => { if (event.repeat) event.preventDefault(); }} onClick={() => { void send({ app: application.app }); }}><span aria-hidden="true">{application.initial}</span>{application.label}</button>)}</div>
    <div className="tv-remote-feedback"><p role="status" aria-live="polite">{busy ? 'Enviando comando…' : feedback || (blocked && ready ? 'Aguarde a operação atual terminar.' : ready ? 'Escolha um comando.' : '')}</p>{busy && <button type="button" className="quiet-button" onClick={() => interrupt()}>Interromper envio</button>}</div>
  </div>;
}
