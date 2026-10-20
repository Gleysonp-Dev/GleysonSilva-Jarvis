import React, { useEffect, useRef, useState } from 'react';
import { WeatherSource } from './weather-source';

function timestamp(value: number | string | null | undefined, timezone?: string) {
  if (value === null || value === undefined) return 'Horário indisponível';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Horário indisponível';
  const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', ...(timezone ? { timeZone: timezone } : {}) };
  try { return date.toLocaleString('pt-BR', options); }
  catch { return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
}
function number(value: number | undefined, suffix = '') { return Number.isFinite(value) ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value!)}${suffix}` : '—'; }
const actionNames: Record<string, string> = { apps_open: 'Abrir aplicativo', apps_focus: 'Focar aplicativo', browser_open: 'Abrir endereço', browser_read_selected: 'Ler seleção', projects_open: 'Abrir projeto', workspace_list: 'Listar arquivos', workspace_preview_organize: 'Preparar organização', workspace_apply_organize: 'Organizar arquivos', workspace_compensate: 'Restaurar arquivos', memory_propose: 'Guardar memória', notes_dictate: 'Salvar ditado', notes_open_dictation: 'Abrir ditado' };
const taskStatus: Record<string, string> = { pending: 'Pendente', running: 'Em andamento', executing: 'Executando', completed: 'Concluída', done: 'Concluída', failed: 'Falhou', error: 'Falhou', cancelled: 'Cancelada', denied: 'Recusada', interrupted: 'Interrompida', awaiting_approval: 'Aguardando decisão', needs_review: 'Revisão necessária', unverified: 'Sem verificação' };
const countLabels = [ ['running', 'Em andamento'], ['awaitingApproval', 'Aguardando decisão'], ['completed', 'Concluídas'], ['failed', 'Falharam'], ['cancelled', 'Canceladas'], ['interrupted', 'Interrompidas'] ] as const;

/** A read-only view: no microphone, model, speech or automatic dashboard activity. */
export function ContextPanel({ bridge, onSettings, onActivity, onOpen }: { bridge?: JarvisBridge; onSettings(): void; onActivity(): void; onOpen?: (url: string) => void }) {
  const [context, setContext] = useState<JarvisContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function load() {
    if (!bridge?.readContext) return;
    const current = ++generation.current;
    setLoading(true); setError(''); setContext(null);
    try {
      const result = await bridge.readContext({ timezone });
      if (current === generation.current) setContext(result);
    } catch {
      if (current === generation.current) setError('Não foi possível consultar as fontes agora. Tente atualizar.');
    } finally { if (current === generation.current) setLoading(false); }
  }
  useEffect(() => {
    void load();
    const cancel = () => { generation.current++; void bridge?.cancelContext?.().catch(() => {}); };
    window.addEventListener('beforeunload', cancel);
    return () => { window.removeEventListener('beforeunload', cancel); cancel(); };
  }, [bridge]);

  const weather = context?.weather;
  const currentWeather = weather?.status === 'ok' ? weather.weather : null;
  const activity = context?.activity;
  const weatherSource = context?.sources.find(source => source.id === 'weather');
  const activitySource = context?.sources.find(source => source.id === 'local_activity');

  return <div className="drawer-content context-content">
    <div className="context-toolbar"><span role="status" aria-live="polite">{loading ? 'Consultando fontes…' : context ? `Consulta: ${timestamp(context.generatedAt, timezone)}` : 'Consulta sob demanda'}</span><button className="quiet-button" type="button" onClick={() => void load()} disabled={loading || !bridge?.readContext}>Atualizar</button></div>
    {!bridge?.readContext && <p className="context-empty" role="status">Contexto indisponível nesta versão. Abra uma versão atualizada do aplicativo.</p>}
    {error && <p className="context-empty" role="alert">{error}</p>}
    {loading && <div className="context-loading" aria-hidden="true"><i/><i/></div>}
    {context && <>
      <section className="context-card" aria-labelledby="context-weather-title">
        <header><h3 id="context-weather-title">Tempo</h3><span className="context-state">{weather?.status === 'ok' ? 'Dados disponíveis' : weather?.status === 'not_configured' ? 'Configurar cidade' : 'Indisponível'}</span></header>
        {currentWeather ? <>
          <p className="context-location">{weather?.locationLabel || 'Local configurado'}</p>
          <div className="context-temperature"><strong>{number(currentWeather.currentTemperature, ' °C')}</strong><span>{currentWeather.condition}</span></div>
          <dl className="context-weather-metrics"><div><dt>Mínima hoje</dt><dd>{number(currentWeather.minimum, ' °C')}</dd></div><div><dt>Máxima hoje</dt><dd>{number(currentWeather.maximum, ' °C')}</dd></div><div><dt>Chance de chuva hoje</dt><dd>{number(currentWeather.precipitationProbability, '%')}</dd></div></dl>
          <p className="context-freshness">Observação: {timestamp(currentWeather.observedAt, weather?.timezone)}</p>
          <p className="context-freshness">{weather?.cache.hit ? 'Em cache' : 'Consultado na fonte'} · {timestamp(weather?.fetchedAt, timezone)}{weather?.cache.hit && weather.cache.expiresAt ? ` · válido até ${timestamp(weather.cache.expiresAt, timezone)}` : ''}</p>
        </> : <div className="context-empty"><p>{weather?.status === 'not_configured' ? 'Defina sua cidade em Ajustes para consultar o tempo.' : 'A fonte do tempo não respondeu. Nenhum valor foi estimado.'}</p>{weather?.status === 'not_configured' && <button type="button" className="quiet-button" onClick={onSettings}>Configurar cidade</button>}</div>}
        <footer className="context-source"><span>{weatherSource?.label || 'Fonte do tempo'} · {weather?.status === 'ok' ? 'disponível' : weather?.status === 'not_configured' ? 'sem cidade configurada' : 'indisponível'}</span>{weather?.attribution && <WeatherSource source={weather.attribution} onOpen={onOpen}/>}</footer>
      </section>
      <section className="context-card" aria-labelledby="context-activity-title">
        <header><h3 id="context-activity-title">Atividade local</h3><span className="context-state">{activity?.status === 'ok' ? 'Registro do perfil' : 'Indisponível'}</span></header>
        <p className="context-scope">{activity?.status === 'ok' ? `Recorte de até ${number(activity.limit ?? 100)} execuções recentes do Jarvis neste perfil.` : 'Execuções recentes do Jarvis neste perfil.'} Não é uma agenda.</p>
        {activity?.status === 'ok' ? <>
          <p className="context-total"><strong>{number(activity.observedCount ?? activity.total)}</strong><span>execuções observadas</span></p>
          <dl className="context-counts">{countLabels.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{number(activity.counts[key])}</dd></div>)}</dl>
          {activity.tasks.length ? <ul className="context-task-list" aria-label="Execuções recentes">{activity.tasks.map((task, index) => <li key={`${task.runId}:${index}`}><div><strong>{task.tool && actionNames[task.tool] ? actionNames[task.tool] : 'Execução do Jarvis'}</strong><span>{taskStatus[task.status] || 'Registrada'}</span></div><time>{timestamp(task.updatedAt, timezone)}</time></li>)}</ul> : <p className="context-empty">Nenhuma execução registrada neste perfil.</p>}
          {activity.truncated && <p className="context-freshness">Lista com {number(activity.tasks.length)} execuções mais recentes do recorte.</p>}
          <button className="quiet-button context-record-button" type="button" onClick={onActivity}>Abrir registro</button>
        </> : <p className="context-empty">O registro local não está disponível agora.</p>}
        <footer className="context-source"><span>Fonte: {activitySource?.label || 'Registro local do Jarvis'} · {activity?.status === 'ok' ? `lido em ${timestamp(activity.observedAt, timezone)}` : 'indisponível'}</span></footer>
      </section>
    </>}
  </div>;
}
