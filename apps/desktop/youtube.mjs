const HOME = 'https://www.youtube.com/';
const WORLD = 999;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const messages = Object.freeze({
  INVALID: 'Informe uma busca válida ou escolha um vídeo observado na última busca do YouTube.',
  CANCELLED: 'A operação do YouTube foi interrompida.',
  TIMEOUT: 'O YouTube não confirmou a operação em até 15 segundos. A janela foi mantida aberta; confira anúncios, carregamento ou avisos e continue manualmente.',
  CONSENT: 'O YouTube solicitou consentimento, login ou uma verificação. Conclua essa etapa manualmente e tente novamente.',
  UNAVAILABLE: 'Não foi possível confirmar esta operação no YouTube. Confira a janela; anúncios, restrições ou mudanças da página podem exigir uma ação manual.',
});
export class YouTubeError extends Error {
  constructor(code = 'UNAVAILABLE') { super(messages[code] ?? messages.UNAVAILABLE); this.name = 'YouTubeError'; this.code = Object.hasOwn(messages, code) ? code : 'UNAVAILABLE'; }
}
function allowed(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'www.youtube.com' && !url.port && !url.username && !url.password; } catch { return false; }
}
function watch(value, id) { try { const url = new URL(value); return allowed(url.href) && url.pathname === '/watch' && url.searchParams.get('v') === id; } catch { return false; } }
const clean = (value, limit) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit) : '';

// This fixed function runs in an isolated world. Callers supply typed values only;
// neither model output nor page strings become selectors or executable source.
function pageOperation(input) {
  // A queued renderer task must not begin a delayed action after its request expired.
  if (!Number.isFinite(input.expiresAt) || Date.now() >= input.expiresAt) return { state: 'expired' };
  const text = (value, limit = 200) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
  const visible = element => {
    if (!element || !element.isConnected || element.hidden || element.getClientRects().length === 0) return false;
    const style = getComputedStyle(element), rectangle = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && rectangle.width > 0 && rectangle.height > 0 && rectangle.bottom > 0 && rectangle.right > 0 && rectangle.top < innerHeight && rectangle.left < innerWidth;
  };
  const visibleMatch = selector => [...document.querySelectorAll(selector)].some(visible);
  const url = new URL(location.href);
  if (url.protocol !== 'https:' || url.hostname !== 'www.youtube.com' || url.port || url.username || url.password) return { state: 'blocked' };
  if (visibleMatch('ytd-consent-bump-v2-lightbox, form[action*="consent.youtube.com"], iframe[src*="recaptcha"], #captcha, form[action*="/sorry/"]')) return { state: 'consent' };
  for (const dialog of document.querySelectorAll('tp-yt-paper-dialog[opened], [role="dialog"]')) {
    if (visible(dialog) && /consent|cookie|before you continue|antes de continuar|sign in|fazer login|confirm.*not a bot|confirme.*rob[oô]/i.test(text(dialog.textContent, 2000))) return { state: 'consent' };
  }
  if (visibleMatch('ytd-enforcement-message-view-model, ytd-player-error-message-renderer, #error-screen')) return { state: 'unavailable' };
  const field = [...document.querySelectorAll('input[name="search_query"], ytd-searchbox input#search, yt-searchbox input')].find(visible);
  if (input.kind === 'search-ready') return { state: 'ready', field: Boolean(field), url: url.href };
  if (input.kind === 'search-submit') {
    if (!field) return { state: 'not_ready' };
    const form = field.closest('form');
    const buttons = () => [...document.querySelectorAll('yt-searchbox button.ytSearchboxComponentSearchButton, ytd-searchbox button#search-icon-legacy, yt-searchbox button[type="submit"]')];
    const enabled = values => values.filter(button => visible(button) && !button.disabled && button.getAttribute('aria-disabled') !== 'true' && typeof button.click === 'function');
    const initialButtons = buttons();
    if (initialButtons.length ? enabled(initialButtons).length !== 1 : !form || typeof form.requestSubmit !== 'function') return { state: 'not_ready' };
    if (form?.action) {
      const destination = new URL(form.action, url.href);
      if (destination.origin !== 'https://www.youtube.com' || destination.pathname !== '/results') return { state: 'blocked' };
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    if (!setter) return { state: 'not_ready' };
    field.focus(); setter.call(field, input.query);
    field.dispatchEvent(new Event('input', { bubbles: true })); field.dispatchEvent(new Event('change', { bubbles: true }));
    const currentButtons = buttons(), submit = enabled(currentButtons);
    if (Date.now() >= input.expiresAt) return { state: 'expired' };
    // Modern YouTube handles the search button click rather than form submission.
    // Activate once; an inconclusive click must never fall back to another action.
    if (currentButtons.length && submit.length === 1) submit[0].click();
    else if (!initialButtons.length && !currentButtons.length && form && typeof form.requestSubmit === 'function') form.requestSubmit();
    else return { state: 'not_ready' };
    return { state: 'submitted' };
  }
  if (input.kind === 'results') {
    if (url.pathname !== '/results' || url.searchParams.get('search_query') !== input.query || !field || text(field.value, 300) !== input.query) return { state: 'not_ready' };
    const results = [], seen = new Set();
    for (const anchor of [...document.querySelectorAll('ytd-video-renderer a#video-title[href], yt-lockup-view-model a.ytLockupMetadataViewModelTitle[href]')].slice(0, 80)) {
      if (!visible(anchor) || anchor.closest('ytd-ad-slot-renderer, ytd-promoted-video-renderer')) continue;
      const destination = new URL(anchor.href, url.href), videoId = destination.searchParams.get('v');
      if (destination.origin !== 'https://www.youtube.com' || destination.pathname !== '/watch' || destination.username || destination.password || !/^[A-Za-z0-9_-]{11}$/.test(videoId || '') || seen.has(videoId)) continue;
      const modern = anchor.closest('yt-lockup-view-model'), renderer = modern || anchor.closest('ytd-video-renderer');
      if (!renderer || renderer.querySelector('feed-ad-metadata-view-model')) continue;
      const channelElement = [...renderer.querySelectorAll(modern ? 'yt-content-metadata-view-model a[href]' : 'ytd-channel-name a[href], #channel-name a[href]')].slice(0, 20).find(element => {
        if (!visible(element) || element.closest(modern ? 'yt-lockup-view-model' : 'ytd-video-renderer') !== renderer || !text(element.textContent, 100)) return false;
        try {
          const channelUrl = new URL(element.href, url.href);
          return channelUrl.origin === 'https://www.youtube.com' && !channelUrl.username && !channelUrl.password && /^\/(?:@[^/]+|(?:channel|c|user)\/[^/]+)\/?$/.test(channelUrl.pathname);
        } catch { return false; }
      });
      const title = text(anchor.getAttribute('title') || anchor.textContent), channel = text(channelElement?.textContent, 100);
      if (!title || !channel || !visible(channelElement)) continue;
      seen.add(videoId); results.push({ videoId, title, channel, url: destination.href });
      if (results.length === 8) break;
    }
    const empty = !results.length && [...document.querySelectorAll('ytd-background-promo-renderer')].some(element => visible(element) && /no results found|nenhum resultado|n[aã]o foram encontrados resultados/i.test(text(element.textContent, 1000)));
    return { state: empty ? 'empty' : 'ready', query: input.query, url: url.href, results };
  }
  if (url.pathname !== '/watch' || url.searchParams.get('v') !== input.videoId) return { state: 'not_ready' };
  const player = document.querySelector('#movie_player');
  const advertisement = Boolean(player?.classList.contains('ad-showing') || player?.classList.contains('ad-interrupting'));
  const videos = [...document.querySelectorAll(player ? '#movie_player video' : 'video')].filter(element => element instanceof HTMLVideoElement && visible(element));
  // YouTube can leave a hidden former ad element before the visible content video.
  const video = videos.find(element => !element.paused && !element.ended) || videos.find(element => element.readyState >= 2) || videos[0];
  if (!video) return { state: 'not_ready' };
  const heading = document.querySelector('ytd-watch-metadata h1 yt-formatted-string, h1.title yt-formatted-string');
  const snapshot = () => ({ state: 'ready', videoId: input.videoId, url: location.href, title: text(heading?.textContent || document.title), advertisement, paused: video.paused, ended: video.ended, readyState: video.readyState, currentTime: video.currentTime });
  if (input.kind === 'media-state') return snapshot();
  if (input.kind === 'media-control') {
    if (input.action === 'pause') { video.pause(); return snapshot(); }
    if (input.action === 'play') return Promise.resolve(video.play()).then(snapshot, () => ({ state: 'unavailable' }));
  }
  return { state: 'blocked' };
}

export class YouTubeController {
  #createWindow; #getProfileId; #timeoutMs; #pollIntervalMs; #now;
  #window; #profileId; #blocked; #generation = 0; #observed = new Map(); #playingId;
  #tail = Promise.resolve(); #scopes = new Set();
  constructor({ createWindow, getProfileId, timeoutMs = 15000, pollIntervalMs = 200, now = Date.now } = {}) {
    if (typeof createWindow !== 'function' || typeof getProfileId !== 'function' || typeof now !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs < 10 || timeoutMs > 15000 || !Number.isFinite(pollIntervalMs) || pollIntervalMs < 1 || pollIntervalMs > 1000) throw new YouTubeError('INVALID');
    this.#createWindow = createWindow; this.#getProfileId = getProfileId; this.#timeoutMs = timeoutMs; this.#pollIntervalMs = pollIntervalMs; this.#now = now;
  }
  async search(query, options = {}) {
    if (typeof query !== 'string' || query.length > 300 || /[\u0000-\u001f\u007f]/.test(query) || !query.trim()) throw new YouTubeError('INVALID');
    query = query.trim().replace(/\s+/g, ' ');
    return this.#run(options, async scope => {
      this.#observed.clear(); this.#playingId = undefined;
      const window = this.#ensureWindow(scope);
      if (!allowed(window.webContents.getURL())) await this.#load(scope, HOME);
      await this.#poll(scope, async () => { const state = await this.#script(scope, { kind: 'search-ready' }); return state?.state === 'ready' && state.field ? state : null; });
      const submitted = await this.#script(scope, { kind: 'search-submit', query }, true);
      if (submitted?.state !== 'submitted') throw new YouTubeError('UNAVAILABLE');
      const result = await this.#poll(scope, async () => {
        const state = await this.#script(scope, { kind: 'results', query });
        if (!['ready', 'empty'].includes(state?.state) || state.query !== query || !Array.isArray(state.results) || (!state.results.length && state.state !== 'empty')) return null;
        const url = new URL(state.url);
        if (!allowed(url.href) || url.pathname !== '/results' || url.searchParams.get('search_query') !== query || window.webContents.getURL() !== url.href) return null;
        const results = [], seen = new Set();
        for (const item of state.results.slice(0, 8)) {
          if (!VIDEO_ID.test(item?.videoId || '') || !watch(item.url, item.videoId) || seen.has(item.videoId)) continue;
          const title = clean(item.title, 200), channel = clean(item.channel, 100);
          if (!title || !channel) continue;
          seen.add(item.videoId); results.push({ videoId: item.videoId, title, channel, url: item.url });
        }
        return results.length || state.state === 'empty' ? { verified: true, query, url: url.href, results } : null;
      });
      this.#assert(scope);
      for (const item of result.results) this.#observed.set(item.videoId, { ...item });
      return structuredClone(result);
    }, { recoverBlocked: true });
  }
  async play(videoId, options = {}) {
    if (typeof videoId !== 'string' || !VIDEO_ID.test(videoId)) throw new YouTubeError('INVALID');
    return this.#run(options, async scope => {
      const window = this.#requireWindow(scope), item = this.#observed.get(videoId);
      if (!item || !watch(item.url, videoId)) throw new YouTubeError('INVALID');
      this.#playingId = videoId; await this.#load(scope, item.url);
      return this.#media(scope, 'play', videoId);
    });
  }
  async control(action, options = {}) {
    if (!['play', 'pause'].includes(action)) throw new YouTubeError('INVALID');
    return this.#run(options, scope => {
      this.#requireWindow(scope);
      if (!this.#playingId || !this.#observed.has(this.#playingId)) throw new YouTubeError('INVALID');
      return this.#media(scope, action, this.#playingId);
    });
  }
  async #media(scope, action, videoId) {
    const first = await this.#poll(scope, async () => {
      const state = await this.#script(scope, { kind: 'media-state', videoId });
      return state?.state === 'ready' && Number.isFinite(state.currentTime) && state.currentTime >= 0 ? state : null;
    });
    const changed = action === 'play' && first.advertisement && first.paused === false ? first : await this.#script(scope, { kind: 'media-control', action, videoId }, true);
    if (changed?.state !== 'ready' || !Number.isFinite(changed.currentTime) || changed.currentTime < 0) throw new YouTubeError('UNAVAILABLE');
    let advertisementObserved = first.advertisement === true || changed.advertisement === true;
    let postAdvertisementContentHandled = false;
    let baseline = changed.advertisement ? undefined : changed.currentTime;
    return this.#poll(scope, async () => {
      const state = await this.#script(scope, { kind: 'media-state', videoId });
      if (state?.state !== 'ready' || state.videoId !== videoId || !watch(state.url, videoId) || scope.window.webContents.getURL() !== state.url || !Number.isFinite(state.currentTime) || state.currentTime < 0 || !clean(state.title, 200)) return null;
      if (action === 'pause') return state.paused === true ? { verified: true, videoId, url: state.url, title: clean(state.title, 200), playing: false, currentTime: state.currentTime, ...(state.advertisement ? { advertisement: true } : {}) } : null;
      if (state.advertisement) { advertisementObserved = true; baseline = undefined; return null; }
      if (advertisementObserved && !postAdvertisementContentHandled) {
        postAdvertisementContentHandled = true;
        if (state.paused) {
          // One play for the newly observed content phase, never an ad-skip or a retry loop.
          const content = await this.#script(scope, { kind: 'media-control', action: 'play', videoId }, true);
          if (content?.state !== 'ready' || !Number.isFinite(content.currentTime) || content.currentTime < 0) throw new YouTubeError('UNAVAILABLE');
          baseline = content.advertisement ? undefined : content.currentTime; return null;
        }
        baseline = state.currentTime; return null;
      }
      if (baseline === undefined || state.currentTime < baseline) { baseline = state.currentTime; return null; }
      const confirmed = state.paused === false && !state.ended && state.readyState >= 2 && state.currentTime > baseline + 0.05;
      return confirmed ? { verified: true, videoId, url: state.url, title: clean(state.title, 200), playing: true, currentTime: state.currentTime } : null;
    });
  }
  async #load(scope, url) {
    this.#assert(scope); scope.pendingNavigation = true;
    try { await this.#wait(scope.window.loadURL(url), scope); }
    finally { scope.pendingNavigation = false; }
  }
  #ensureWindow(scope) {
    if (this.#window && (this.#profileId !== scope.profileId || this.#window.isDestroyed())) this.close();
    this.#assert(scope);
    if (!this.#window) {
      const window = this.#createWindow({ profileId: scope.profileId });
      if (!window || typeof window.webContents?.executeJavaScriptInIsolatedWorld !== 'function') throw new YouTubeError('UNAVAILABLE');
      this.#window = window; this.#profileId = scope.profileId; this.#blocked = undefined;
      window.webContents.setWindowOpenHandler?.(() => ({ action: 'deny' }));
      const navigate = (event, value) => {
        const url = typeof value === 'string' ? value : value?.url ?? event.url;
        if (!allowed(url)) { event.preventDefault(); if (this.#window === window) this.#blocked = /consent|accounts\.google|\/sorry\//i.test(url || '') ? 'CONSENT' : 'UNAVAILABLE'; }
        else if (this.#window === window) this.#blocked = undefined;
      };
      window.webContents.on('will-navigate', navigate); window.webContents.on('will-redirect', navigate);
      window.on('closed', () => { if (this.#window === window) this.close(); });
      window.webContents.on('render-process-gone', () => { if (this.#window === window) this.close(); });
    }
    scope.window = this.#window; this.#window.show?.(); return this.#window;
  }
  #requireWindow(scope) {
    this.#assert(scope);
    if (!this.#window || this.#window.isDestroyed() || this.#profileId !== scope.profileId) throw new YouTubeError('INVALID');
    scope.window = this.#window; this.#window.show?.(); return this.#window;
  }
  async #script(scope, args, gesture = false) {
    this.#assert(scope);
    if (!allowed(scope.window.webContents.getURL())) throw new YouTubeError('UNAVAILABLE');
    const code = `(${pageOperation.toString()})(${JSON.stringify({ ...args, expiresAt: Date.now() + Math.max(0, scope.deadline - this.#now()) })})`;
    const result = await this.#wait(scope.window.webContents.executeJavaScriptInIsolatedWorld(WORLD, [{ code }], gesture), scope);
    this.#assert(scope);
    if (result?.state === 'expired') { scope.reason = 'TIMEOUT'; scope.controller.abort(); throw new YouTubeError('TIMEOUT'); }
    if (result?.state === 'consent' || result?.state === 'blocked') throw new YouTubeError('CONSENT');
    if (result?.state === 'unavailable') throw new YouTubeError('UNAVAILABLE');
    return result;
  }
  async #poll(scope, read) {
    for (;;) {
      this.#assert(scope);
      const result = await read();
      this.#assert(scope); if (result) return result;
      await this.#wait(new Promise(resolve => setTimeout(resolve, this.#pollIntervalMs)), scope);
    }
  }
  #assert(scope) {
    if (scope.signal.aborted) throw new YouTubeError(scope.reason || 'CANCELLED');
    if (scope.generation !== this.#generation || this.#getProfileId() !== scope.profileId) {
      if (scope.window && scope.window === this.#window) this.close();
      throw new YouTubeError('CANCELLED');
    }
    if (scope.window && (scope.window.isDestroyed() || scope.window.webContents.isDestroyed?.())) throw new YouTubeError('CANCELLED');
    if (this.#blocked && !scope.recoveringBlocked) throw new YouTubeError(this.#blocked);
    if (this.#now() >= scope.deadline) { scope.reason = 'TIMEOUT'; scope.controller.abort(); throw new YouTubeError('TIMEOUT'); }
  }
  #wait(promise, scope) {
    this.#assert(scope);
    return new Promise((resolve, reject) => {
      const abort = () => { cleanup(); reject(new YouTubeError(scope.reason || 'CANCELLED')); };
      const cleanup = () => scope.signal.removeEventListener('abort', abort);
      scope.signal.addEventListener('abort', abort, { once: true });
      Promise.resolve(promise).then(value => { cleanup(); try { this.#assert(scope); resolve(value); } catch (error) { reject(error); } }, () => { cleanup(); reject(new YouTubeError('UNAVAILABLE')); });
      if (scope.signal.aborted) abort();
    });
  }
  async #run({ signal, profileId } = {}, perform, { recoverBlocked = false } = {}) {
    if (typeof profileId !== 'string' || !profileId || profileId.length > 100 || this.#getProfileId() !== profileId) throw new YouTubeError('CANCELLED');
    if (this.#window && this.#profileId !== profileId) this.close();
    const controller = new AbortController(), scope = { controller, signal: controller.signal, profileId, generation: this.#generation, deadline: this.#now() + this.#timeoutMs, recoveringBlocked: recoverBlocked };
    const cancel = () => { scope.reason = 'CANCELLED'; controller.abort(); };
    const aborted = () => {
      if (!scope.window || this.#window !== scope.window) return;
      if (scope.reason === 'TIMEOUT') {
        // Preserve the page and observed selection for an honest manual handoff.
        // Cancel only an unfinished navigation; no further scripted actions are scheduled.
        if (scope.pendingNavigation) { try { scope.window.webContents.stop?.(); } catch {} }
      } else this.close();
    };
    const timer = setTimeout(() => { scope.reason = 'TIMEOUT'; controller.abort(); }, this.#timeoutMs);
    signal?.addEventListener('abort', cancel, { once: true }); controller.signal.addEventListener('abort', aborted, { once: true });
    this.#scopes.add(scope); if (signal?.aborted) cancel();
    const previous = this.#tail; let release;
    const slot = new Promise(resolve => { release = resolve; }); this.#tail = previous.catch(() => {}).then(() => slot);
    try {
      await this.#wait(previous, scope); this.#assert(scope);
      // A new search may recover only after the previous request has reported
      // its blocked navigation. Every DOM/navigation step still checks it anew.
      if (scope.recoveringBlocked) { this.#blocked = undefined; scope.recoveringBlocked = false; }
      this.#assert(scope); const result = await perform(scope); this.#assert(scope); return result;
    }
    catch (error) { throw error instanceof YouTubeError ? error : new YouTubeError('UNAVAILABLE'); }
    finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); controller.signal.removeEventListener('abort', aborted); this.#scopes.delete(scope); release(); }
  }
  close() {
    this.#generation++; this.#observed.clear(); this.#playingId = undefined; this.#blocked = undefined;
    const window = this.#window; this.#window = undefined; this.#profileId = undefined;
    for (const scope of this.#scopes) { scope.reason ||= 'CANCELLED'; scope.controller.abort(); }
    if (window && !window.isDestroyed()) { try { if (typeof window.destroy === 'function') window.destroy(); else window.close(); } catch { /* Closing must cancel authority even when the native window is already gone. */ } }
  }
}
