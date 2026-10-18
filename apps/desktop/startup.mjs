import { spawn } from 'node:child_process';
import { join, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

const STANDBY_ARGUMENT = '--jarvis-standby';
// Conservative local heuristics; engine confidence is relative, not identity or intent proof.
export const NATIVE_WAKE_POLICY = Object.freeze({ minConfidence: 0.92, minWordConfidence: 0.9,
  minDurationMs: 250, maxDurationMs: 1500, startupQuietMs: 1200, cooldownMs: 10000 });
const bundledHelper = fileURLToPath(new URL('./platform/windowsSpeech.ps1', import.meta.url))
  .replace(/([\\/])app\.asar([\\/])/i, '$1app.asar.unpacked$2');

export function isStandbyLaunch(argv = process.argv) {
  return Array.isArray(argv) && argv.includes(STANDBY_ARGUMENT);
}

// Only the native main process calls this after app.whenReady(). No OS changes occur on import.
export function configureStartup(app, settings, { platform = process.platform, env = process.env, execPath = env.PORTABLE_EXECUTABLE_FILE || process.execPath } = {}) {
  if (typeof settings?.startAtLogin !== 'boolean') throw new Error('Opção de início automático inválida.');
  const requested = settings.startAtLogin;
  if (platform !== 'win32' || app?.isPackaged !== true) {
    return { available: false, requested, enabled: false, reason: 'requires_packaged_windows' };
  }
  if (typeof app.setLoginItemSettings !== 'function' || typeof app.getLoginItemSettings !== 'function') {
    return { available: false, requested, enabled: false, reason: 'startup_api_unavailable' };
  }
  // Portable builds extract process.execPath into a temporary directory. Register the stable outer EXE.
  if (typeof execPath !== 'string' || !win32.isAbsolute(execPath) || !/\.exe$/i.test(execPath) || /[\r\n\0"]/.test(execPath)) {
    return { available: true, requested, enabled: false, reason: 'startup_path_unavailable' };
  }
  const launch = { path: execPath, args: [STANDBY_ARGUMENT] };
  try {
    app.setLoginItemSettings({ openAtLogin: requested, ...launch });
    const current = app.getLoginItemSettings(launch);
    const enabled = current.openAtLogin === true && current.executableWillLaunchAtLogin !== false;
    return { available: true, requested, enabled, ...(enabled !== requested ? { reason: 'startup_not_confirmed' } : {}) };
  } catch {
    return { available: true, requested, enabled: false, reason: 'startup_configuration_failed' };
  }
}

export class WindowsWakeService {
  #child = null;
  #status;
  #starting = null;
  #resolveStart = null;
  #stopping = null;
  #startupTimer = null;
  #abortCleanup = null;
  #buffer = '';
  #lastWake = -Infinity;
  #listeningAt = Infinity;
  #generation = 0;

  constructor({ onWake = () => {}, onState = () => {}, platform = process.platform, spawnImpl = spawn, now = Date.now } = {}) {
    this.onWake = onWake;
    this.onState = onState;
    this.platform = platform;
    this.spawnImpl = spawnImpl;
    this.now = now;
    this.#status = { available: false, running: false, state: platform === 'win32' ? 'stopped' : 'unavailable', ...(platform !== 'win32' ? { reason: 'requires_windows' } : {}) };
  }

  status() { return { ...this.#status }; }

  #update(value) {
    this.#status = value;
    try { this.onState(this.status()); } catch { /* Consumers cannot break microphone cleanup. */ }
  }

  #settleStart() {
    clearTimeout(this.#startupTimer);
    this.#startupTimer = null;
    if (this.#resolveStart) this.#resolveStart(this.status());
    this.#resolveStart = null;
    this.#starting = null;
  }

  async start({ signal } = {}) {
    if (this.#stopping) await this.#stopping;
    if (this.#starting) return this.#starting;
    if (this.#child && this.#status.running) return this.status();
    if (signal?.aborted) return { ...this.status(), running: false, reason: 'cancelled' };
    if (this.platform !== 'win32') return this.status();
    this.#buffer = '';
    this.#listeningAt = Infinity;
    const generation = ++this.#generation;
    this.#update({ available: false, running: false, state: 'starting' });
    this.#starting = new Promise(resolve => { this.#resolveStart = resolve; });
    const pending = this.#starting;
    const fail = reason => {
      if (generation !== this.#generation) return;
      this.#update({ available: false, running: false, state: 'unavailable', reason });
      this.#settleStart();
      void this.stop({ preserveStatus: true });
    };
    try {
      this.#child = this.spawnImpl(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'RemoteSigned', '-File', bundledHelper],
        { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      fail('speech_worker_unavailable');
      return pending;
    }
    const child = this.#child;
    // Ignore stderr contents: only the fixed JSON protocol is surfaced to the UI.
    child.stderr?.resume();
    child.stdin?.on('error', () => {});
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (generation !== this.#generation || this.#stopping) return;
      this.#buffer += chunk;
      if (this.#buffer.length > 8192) return fail('invalid_worker_output');
      let separator;
      while ((separator = this.#buffer.indexOf('\n')) !== -1) {
        const line = this.#buffer.slice(0, separator).trim();
        this.#buffer = this.#buffer.slice(separator + 1);
        if (!line) continue;
        let event;
        try { event = JSON.parse(line); } catch { return fail('invalid_worker_output'); }
        if (event?.type === 'ready' && typeof event.culture === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(event.culture)) {
          if (!this.#status.running) this.#listeningAt = this.now();
          this.#update({ available: true, running: true, state: 'listening', culture: event.culture });
          this.#settleStart();
        } else if (event?.type === 'unavailable') {
          const reasons = ['speech_engine_missing', 'microphone_unavailable', 'speech_initialization_failed'];
          return fail(reasons.includes(event.reason) ? event.reason : 'speech_initialization_failed');
        } else if (event?.type === 'wake' && this.#status.running && event.keyword === 'Jarvis'
          && Number.isFinite(event.confidence) && event.confidence >= NATIVE_WAKE_POLICY.minConfidence && event.confidence <= 1
          && Number.isFinite(event.wordConfidence) && event.wordConfidence >= NATIVE_WAKE_POLICY.minWordConfidence && event.wordConfidence <= 1
          && event.wordCount === 1 && Number.isFinite(event.durationMs) && event.durationMs >= NATIVE_WAKE_POLICY.minDurationMs && event.durationMs <= NATIVE_WAKE_POLICY.maxDurationMs) {
          const at = this.now();
          if (!Number.isFinite(at) || at - this.#listeningAt < NATIVE_WAKE_POLICY.startupQuietMs || at - this.#lastWake < NATIVE_WAKE_POLICY.cooldownMs) continue;
          this.#lastWake = at;
          try { this.onWake({ source: 'voice', keyword: 'Jarvis', confidence: event.confidence }); } catch { /* Keep listening. */ }
        }
      }
    });
    child.on('error', () => fail('speech_worker_unavailable'));
    child.on('close', () => {
      if (generation !== this.#generation || this.#stopping) return;
      this.#child = null;
      this.#abortCleanup?.(); this.#abortCleanup = null;
      this.#update({ available: false, running: false, state: 'unavailable', reason: 'speech_worker_closed' });
      this.#settleStart();
    });
    if (signal) {
      const aborted = () => { void this.stop(); };
      signal.addEventListener('abort', aborted, { once: true });
      this.#abortCleanup = () => signal.removeEventListener('abort', aborted);
      if (signal.aborted) aborted();
    }
    this.#startupTimer = setTimeout(() => fail('speech_start_timeout'), 12000);
    this.#startupTimer.unref?.();
    return pending;
  }

  async stop({ preserveStatus = false } = {}) {
    if (this.#stopping) return this.#stopping;
    const child = this.#child;
    ++this.#generation;
    this.#child = null;
    this.#abortCleanup?.(); this.#abortCleanup = null;
    this.#buffer = '';
    this.#listeningAt = Infinity;
    if (!preserveStatus) this.#update({ available: this.#status.available, running: false, state: 'stopped' });
    this.#settleStart();
    if (!child) return this.status();
    this.#stopping = new Promise(resolve => {
      let timer;
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        this.#stopping = null;
        resolve(this.status());
      };
      child.once('close', done);
      child.once('error', done);
      timer = setTimeout(() => { try { child.kill(); } catch {} done(); }, 1000);
      timer.unref?.();
      try { child.stdin.end('STOP\n'); } catch { try { child.kill(); } catch {} done(); }
    });
    return this.#stopping;
  }
}
