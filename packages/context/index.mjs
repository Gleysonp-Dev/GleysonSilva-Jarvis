import { validateWeatherRequest } from '../greeting/index.mjs';

const SNAPSHOT_LIMIT = 100;
const DISPLAY_LIMIT = 8;
const PROFILE_ID = /^[a-zA-Z0-9_.:-]{1,160}$/;
const TASK_STATUSES = new Set(['running', 'awaiting_approval', 'completed', 'unverified', 'failed', 'cancelled', 'interrupted']);
const TASK_TOOLS = new Set(['apps_find', 'apps_launch', 'folders_open', 'web_read', 'web_search', 'weather_current', 'apps_open', 'apps_focus', 'browser_open', 'browser_read_selected', 'projects_open', 'workspace_list',
  'workspace_preview_organize', 'workspace_apply_organize', 'workspace_compensate', 'memory_propose', 'notes_dictate', 'notes_open_dictation']);
const emptyCounts = () => ({ running: 0, awaitingApproval: 0, completed: 0, unverified: 0, failed: 0, cancelled: 0, interrupted: 0 });

export class ContextError extends Error {
  constructor(code = 'invalid_input') {
    const safeCode = ['cancelled', 'invalid_input', 'profile_changed'].includes(code) ? code : 'invalid_input';
    super(safeCode === 'cancelled' ? 'Consulta de contexto interrompida.' : safeCode === 'profile_changed' ? 'O perfil mudou durante a consulta. Atualize o contexto.' : 'Consulta de contexto inválida.');
    this.name = 'ContextError'; this.code = safeCode;
  }
}
const active = signal => { if (signal?.aborted) throw new ContextError('cancelled'); };
const clock = read => {
  let value;
  try { value = read(); } catch { throw new ContextError('invalid_input'); }
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new ContextError('invalid_input');
  return value.getTime();
};
const unavailableActivity = observedAt => ({ status: 'unavailable', observedAt, total: 0, observedCount: 0, limit: SNAPSHOT_LIMIT,
  counts: emptyCounts(), tasks: [], truncated: false });
const unavailableWeather = timezone => ({ status: 'unavailable', timezone, locationLabel: '', weather: null, attribution: null,
  fetchedAt: null, cache: { hit: false, expiresAt: null } });

async function bounded(read, { signal, timeoutMs }) {
  active(signal);
  let timer, relay;
  try {
    return await Promise.race([Promise.resolve().then(() => { active(signal); return read(); }),
      new Promise((_, reject) => {
        relay = () => reject(new ContextError('cancelled'));
        signal?.addEventListener('abort', relay, { once: true });
        if (signal?.aborted) relay();
        timer = setTimeout(() => reject(new Error('Context source timeout.')), timeoutMs);
      })]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', relay); }
}

function observedActivity(snapshot, observedAt) {
  if (!snapshot || !Array.isArray(snapshot.tasks)) return unavailableActivity(observedAt);
  const counts = emptyCounts();
  const tasks = [];
  for (const entry of snapshot.tasks.slice(0, SNAPSHOT_LIMIT)) {
    if (!entry || typeof entry !== 'object' || typeof entry.runId !== 'string' || !PROFILE_ID.test(entry.runId)
      || !TASK_STATUSES.has(entry.status) || typeof entry.updatedAt !== 'string') continue;
    const timestamp = Date.parse(entry.updatedAt);
    if (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > observedAt + 15 * 60_000) continue;
    counts[entry.status === 'awaiting_approval' ? 'awaitingApproval' : entry.status]++;
    tasks.push({ runId: entry.runId, status: entry.status, ...(TASK_TOOLS.has(entry.tool) ? { tool: entry.tool } : {}), updatedAt: new Date(timestamp).toISOString() });
  }
  tasks.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return { status: 'ok', observedAt, total: tasks.length, observedCount: tasks.length, limit: SNAPSHOT_LIMIT, counts,
    tasks: tasks.slice(0, DISPLAY_LIMIT), truncated: snapshot.tasks.length > SNAPSHOT_LIMIT || tasks.length > DISPLAY_LIMIT };
}

/** Data for an explicitly requested panel. It never runs tools, narrates, exposes memories, or treats task history as an agenda. */
export class ContextService {
  #weather; #getSnapshot; #getProfileId; #now; #snapshotTimeoutMs; #weatherTimeoutMs;
  constructor({ weather, getSnapshot, getProfileId = () => 'default', now = () => new Date(), snapshotTimeoutMs = 2000, weatherTimeoutMs = 10_000 } = {}) {
    if (typeof weather?.readWeather !== 'function' || typeof getSnapshot !== 'function' || typeof getProfileId !== 'function' || typeof now !== 'function'
      || !Number.isFinite(snapshotTimeoutMs) || snapshotTimeoutMs <= 0 || snapshotTimeoutMs > 30_000
      || !Number.isFinite(weatherTimeoutMs) || weatherTimeoutMs <= 0 || weatherTimeoutMs > 30_000) throw new TypeError('ContextService requires bounded sources and trusted profile functions.');
    this.#weather = weather; this.#getSnapshot = getSnapshot; this.#getProfileId = getProfileId; this.#now = now;
    this.#snapshotTimeoutMs = snapshotTimeoutMs; this.#weatherTimeoutMs = weatherTimeoutMs;
  }

  #profile() {
    let value;
    try { value = this.#getProfileId(); } catch { throw new ContextError('invalid_input'); }
    if (typeof value !== 'string' || !PROFILE_ID.test(value)) throw new ContextError('invalid_input');
    return value;
  }

  async read(input = {}, { signal } = {}) {
    active(signal);
    let request;
    try { request = validateWeatherRequest(input); } catch { throw new ContextError('invalid_input'); }
    const profileId = this.#profile();
    clock(this.#now);
    const ensureProfile = () => { if (this.#profile() !== profileId) throw new ContextError('profile_changed'); };
    const [weather, activity] = await Promise.all([
      bounded(() => this.#weather.readWeather(request, { signal }), { signal, timeoutMs: this.#weatherTimeoutMs })
        .catch(error => { active(signal); if (error?.code === 'cancelled') throw new ContextError('cancelled'); return unavailableWeather(request.timezone); }),
      bounded(() => this.#getSnapshot(profileId), { signal, timeoutMs: this.#snapshotTimeoutMs })
        .then(snapshot => observedActivity(snapshot, clock(this.#now)))
        .catch(() => { active(signal); return unavailableActivity(clock(this.#now)); }),
    ]);
    active(signal); ensureProfile();
    const generatedAt = clock(this.#now);
    return { generatedAt, weather, activity, sources: [
      { id: 'weather', label: 'Clima · Open-Meteo', status: weather.status, observedAt: weather.weather?.observedAt ?? null,
        ...(weather.attribution ? { attribution: { ...weather.attribution } } : {}) },
      { id: 'local_activity', label: 'Atividade local · Jarvis', status: activity.status, observedAt: activity.status === 'ok' ? activity.observedAt : null },
    ] };
  }
}
