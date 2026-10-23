import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { YouTubeController, YouTubeError } from '../apps/desktop/youtube.mjs';

const FIRST = 'abcdefghijk', SECOND = 'lmnopqrstuv';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) { const end = Date.now() + 1000; while (Date.now() < end) { if (predicate()) return; await tick(); } assert.fail('Expected local controller state was not reached.'); }

function fixture(t, options = {}) {
  const calls = [], windows = [], contexts = []; let profileId = 'principal';
  const entries = options.results ?? [
    { videoId: FIRST, title: 'Respiração guiada', channel: 'Canal de teste', url: `https://www.youtube.com/watch?v=${FIRST}&source=observed` },
    { videoId: SECOND, title: 'Relaxamento', channel: 'Outro canal', url: `https://www.youtube.com/watch?v=${SECOND}` },
  ];
  class Element {
    isConnected = true; hidden = false; textContent = '';
    constructor(properties = {}) { Object.assign(this, properties); }
    getClientRects() { return this.hidden ? [] : [this.getBoundingClientRect()]; }
    getBoundingClientRect() { return { top: 20, bottom: 80, left: 20, right: 400, width: 380, height: 60 }; }
    getAttribute(name) { return this[name] ?? null; }
    closest(selector) { if (selector === 'form') return this.form; if (selector === 'ytd-video-renderer') return this.renderer; if (selector.includes('ytd-ad-slot')) return this.ad ? {} : null; return null; }
    querySelector() { return this.channelElement; }
    focus() { calls.push('focus-search'); }
    dispatchEvent(event) { calls.push(['event', event.type]); return true; }
  }
  class Input extends Element {
    #value = '';
    get value() { return this.#value; }
    set value(value) { this.#value = value; calls.push(['fill', value]); }
  }
  class Video extends Element {
    paused = true; ended = false; readyState = 4; time = 0;
    get currentTime() { if (!this.paused && options.advance !== false) this.time += 0.1; return this.time; }
    play() { calls.push('play-video'); if (options.playGate) return options.playGate.promise.then(() => { this.paused = false; }); if (options.rejectPlay) return Promise.reject(new Error('private-native-autoplay')); this.paused = false; return Promise.resolve(); }
    pause() { calls.push('pause-video'); this.paused = true; }
  }
  class Window extends EventEmitter {
    destroyed = false; url = 'about:blank'; navigation = 0;
    constructor() {
      super(); this.video = new Video(); this.field = new Input();
      this.hiddenVideo = new Video(); this.hiddenVideo.hidden = true; this.hiddenVideo.paused = false;
      this.field.form = { action: 'https://www.youtube.com/results', requestSubmit: () => {
        calls.push(['submit', this.field.value]);
        if (!options.ignoreSubmit) this.url = `https://www.youtube.com/results?search_query=${encodeURIComponent(this.field.value)}`;
      } };
      if (options.noForm) this.field.form = null;
      this.searchButtons = (options.searchButtons ?? []).map((button, index) => new Element({ ...button, 'aria-disabled': button.ariaDisabled, click: () => {
        calls.push(['click-search', index, this.field.value]);
        if (!options.ignoreButton) this.url = `https://www.youtube.com/results?search_query=${encodeURIComponent(this.field.value)}`;
      } }));
      this.anchors = entries.map(entry => {
        const channelElement = new Element({ textContent: entry.channel, hidden: entry.channelHidden });
        const renderer = new Element({ channelElement });
        return new Element({ ...entry, href: entry.url ?? `https://www.youtube.com/watch?v=${entry.videoId}`, textContent: entry.title, renderer, hidden: entry.hidden, ad: entry.ad });
      });
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, {
        isDestroyed: () => this.destroyed, getURL: () => this.url, getTitle: () => 'Vídeo do teste',
        stop: () => { this.navigation++; calls.push('stop-navigation'); },
        setWindowOpenHandler: handler => { this.openHandler = handler; },
        executeJavaScriptInIsolatedWorld: async (world, scripts, gesture) => {
          calls.push(['execute', world, gesture, scripts[0].code]);
          const kind = /"kind":"([^"]+)"/.exec(scripts[0].code)?.[1];
          if (options.scriptGate && (!options.scriptGateKind || options.scriptGateKind === kind)) await options.scriptGate.promise;
          options.beforeScript?.({ kind, window: this });
          const document = {
            title: 'Vídeo do teste',
            querySelectorAll: selector => {
              if (selector.includes('input[name="search_query"]')) return options.noField ? [] : [this.field];
              if (selector.includes('ytSearchboxComponentSearchButton')) return this.searchButtons;
              if (selector.includes('ytd-video-renderer a#video-title')) return this.url.includes('/results?') ? this.anchors : [];
              if (selector === '#movie_player video' || selector === 'video') return this.url.includes('/watch?') && !options.noVideo ? [...(options.hiddenVideoFirst ? [this.hiddenVideo] : []), this.video] : [];
              if (options.consent && selector.includes('ytd-consent-bump')) return [new Element()];
              if (options.login && selector.includes('[role="dialog"]')) return [new Element({ textContent: 'Sign in before you continue' })];
              if (options.captcha && selector.includes('#captcha')) return [new Element()];
              if (options.emptyMarker && selector === 'ytd-background-promo-renderer') return [new Element({ textContent: 'No results found' })];
              return [];
            },
            querySelector: selector => {
              if (selector.includes('skip')) return { click() { calls.push('skip-ad'); } };
              if (selector === '#movie_player') return { classList: { contains: name => options.ad && name === 'ad-showing' } };
              if (selector.includes('video')) return this.url.includes('/watch?') && !options.noVideo ? this.video : null;
              if (selector.includes('h1')) return new Element({ textContent: 'Título observado do vídeo' });
              return null;
            },
          };
          const context = { document, location: { href: this.url }, HTMLInputElement: Input, HTMLVideoElement: Video, Event: class { constructor(type) { this.type = type; } }, URL, Promise,
            innerHeight: 900, innerWidth: 1200, getComputedStyle: element => ({ display: element.hidden ? 'none' : 'block', visibility: 'visible' }) };
          contexts.push(context);
          return vm.runInNewContext(scripts[0].code, context, { timeout: 100 });
        },
      });
    }
    async loadURL(url) { const navigation = ++this.navigation; calls.push(['load', url]); if (options.loadGate) await options.loadGate.promise; if (!this.destroyed && navigation === this.navigation) this.url = url; }
    isDestroyed() { return this.destroyed; }
    show() { calls.push('show-window'); }
    destroy() { this.destroyed = true; calls.push('destroy-window'); this.emit('closed'); }
  }
  const controller = new YouTubeController({ getProfileId: () => profileId, createWindow: ({ profileId: requested }) => { calls.push(['create', requested]); const window = new Window(); windows.push(window); return window; }, timeoutMs: options.timeoutMs ?? 2000, pollIntervalMs: 2 });
  t.after(() => controller.close());
  return { controller, calls, windows, contexts, options, setProfile(value) { profileId = value; }, scope: () => ({ profileId }), search: query => controller.search(query, { profileId }), play: id => controller.play(id, { profileId }), control: action => controller.control(action, { profileId }) };
}

test('search fills and submits the actual visible DOM field and reports only observed video links', async t => {
  const f = fixture(t); const result = await f.search('  meditação   guiada  ');
  assert.equal(result.verified, true); assert.equal(result.query, 'meditação guiada');
  assert.equal(new URL(result.url).searchParams.get('search_query'), 'meditação guiada');
  assert.deepEqual(result.results.map(item => [item.videoId, item.title, item.channel]), [[FIRST, 'Respiração guiada', 'Canal de teste'], [SECOND, 'Relaxamento', 'Outro canal']]);
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'load'), [['load', 'https://www.youtube.com/']]);
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'fill'), [['fill', 'meditação guiada']]);
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'event'), [['event', 'input'], ['event', 'change']]);
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'submit'), [['submit', 'meditação guiada']]);
  assert.equal(f.windows[0].openHandler().action, 'deny');
  assert(f.calls.filter(call => Array.isArray(call) && call[0] === 'execute').every(call => call[1] === 999));
});

test('search text stays a value in a constant isolated script, including executable-looking text', async t => {
  const f = fixture(t), query = 'x");globalThis.__injected=true;//';
  const result = await f.search(query); assert.equal(result.query, query);
  assert.equal(f.contexts.some(context => context.__injected === true), false);
  assert.equal(f.windows[0].field.value, query);
});

test('a JS-managed search form uses one modern visible button click instead of its non-navigating submit handler', async t => {
  const f = fixture(t, { ignoreSubmit: true, searchButtons: [{}] });
  const found = await f.search('Thunderstruck AC/DC');
  assert.equal(found.verified, true); assert.equal(found.query, 'Thunderstruck AC/DC');
  assert.equal(new URL(found.url).pathname, '/results');
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'click-search'), [['click-search', 0, 'Thunderstruck AC/DC']]);
  assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'submit'), false);
  assert.equal((await f.play(FIRST)).verified, true);
  const second = await f.search('nova música'); assert.equal(second.verified, true);
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'click-search').length, 2);
  assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'submit'), false);
});

test('known search buttons require exactly one visible enabled target and never bypass a disabled or ambiguous control', async t => {
  const scenarios = [
    { name: 'hidden earlier button', buttons: [{ hidden: true }, {}], index: 1 },
    { name: 'disabled earlier button', buttons: [{ disabled: true }, {}], index: 1 },
    { name: 'ARIA-disabled earlier button', buttons: [{ ariaDisabled: 'true' }, {}], index: 1 },
    { name: 'only hidden', buttons: [{ hidden: true }] },
    { name: 'only disabled', buttons: [{ disabled: true }] },
    { name: 'only ARIA-disabled', buttons: [{ ariaDisabled: 'true' }] },
    { name: 'ambiguous visible buttons', buttons: [{}, {}] },
  ];
  for (const scenario of scenarios) await t.test(scenario.name, async t => {
    const f = fixture(t, { searchButtons: scenario.buttons });
    if (scenario.index === undefined) await assert.rejects(f.search('música'), error => error.code === 'UNAVAILABLE');
    else assert.equal((await f.search('música')).verified, true);
    assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'click-search').map(call => call[1]), scenario.index === undefined ? [] : [scenario.index]);
    assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'submit'), false);
  });
});

test('an inconclusive search click is not repeated or followed by form submission', async t => {
  const f = fixture(t, { searchButtons: [{}], ignoreButton: true, timeoutMs: 80 });
  await assert.rejects(f.search('música'), error => error.code === 'TIMEOUT');
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'click-search').length, 1);
  assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'submit'), false);
  assert.equal(f.windows[0].url, 'https://www.youtube.com/'); assert.equal(f.windows[0].destroyed, false);
});

test('result collection excludes hidden, promoted, foreign, malformed, duplicate and unlabelled entries and caps eight', async t => {
  const good = Array.from({ length: 12 }, (_, index) => ({ videoId: `video${String(index).padStart(6, '0')}`, title: `Vídeo ${index}`, channel: 'Canal' }));
  const f = fixture(t, { results: [
    { videoId: FIRST, title: 'Oculto', channel: 'Canal', hidden: true },
    { videoId: FIRST, title: 'Anúncio', channel: 'Canal', ad: true },
    { videoId: FIRST, title: 'Outro host', channel: 'Canal', url: `https://example.org/watch?v=${FIRST}` },
    { videoId: 'bad', title: 'ID inválido', channel: 'Canal' },
    { videoId: FIRST, title: 'Sem canal', channel: '' }, ...good, good[0],
  ] });
  const result = await f.search('música'); assert.equal(result.results.length, 8);
  assert.deepEqual(result.results.map(item => item.title), good.slice(0, 8).map(item => item.title));
});

test('play loads an observed watch URL once and confirms real media progression rather than URL dispatch', async t => {
  const f = fixture(t); await f.search('respiração'); const result = await f.play(FIRST);
  assert.deepEqual({ verified: result.verified, videoId: result.videoId, playing: result.playing, title: result.title }, { verified: true, videoId: FIRST, playing: true, title: 'Título observado do vídeo' });
  assert.ok(result.currentTime > 0); assert.equal(result.url, `https://www.youtube.com/watch?v=${FIRST}&source=observed`);
  assert.equal(f.calls.filter(call => call === 'play-video').length, 1);
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'load').at(-1), ['load', result.url]);
});

test('pause and resume verify the HTML media state in the same observed video', async t => {
  const f = fixture(t); await f.search('música'); await f.play(FIRST);
  const paused = await f.control('pause'); assert.equal(paused.verified, true); assert.equal(paused.playing, false); assert.equal(f.windows[0].video.paused, true);
  const resumed = await f.control('play'); assert.equal(resumed.verified, true); assert.equal(resumed.playing, true); assert.ok(resumed.currentTime > paused.currentTime);
  assert.equal(f.calls.filter(call => call === 'pause-video').length, 1); assert.equal(f.calls.filter(call => call === 'play-video').length, 2);
});

test('invalid inputs, unseen IDs and unsupported controls cannot open or operate a video', async t => {
  const f = fixture(t);
  for (const query of ['', ' ', null, 'x'.repeat(301), 'hello\nworld']) await assert.rejects(f.search(query), error => error.code === 'INVALID');
  await assert.rejects(f.play(FIRST), error => error.code === 'INVALID');
  await assert.rejects(f.control('pause'), error => error.code === 'INVALID');
  await assert.rejects(f.control('volume'), error => error.code === 'INVALID');
  assert.equal(f.windows.length, 0);
  await f.search('observados'); const before = f.calls.length;
  await assert.rejects(f.play('zzzzzzzzzzz'), error => error.code === 'INVALID');
  assert.equal(f.calls.slice(before).some(call => Array.isArray(call) && call[0] === 'load'), false);
});

test('a new search invalidates prior selections and an empty search result never invents a match', async t => {
  const f = fixture(t, { timeoutMs: 80 }); await f.search('primeira');
  f.windows[0].anchors.length = 0;
  await assert.rejects(f.search('sem resultados'), error => error.code === 'TIMEOUT');
  await assert.rejects(f.play(FIRST), error => ['INVALID', 'CANCELLED'].includes(error.code));
  assert.equal(f.calls.filter(call => call === 'play-video').length, 0);
});

test('an observed no-results marker verifies an empty list, while missing renderers alone are not evidence', async t => {
  const f = fixture(t, { results: [], emptyMarker: true }); const result = await f.search('sem vídeos');
  assert.equal(result.verified, true); assert.deepEqual(result.results, []);
  assert.equal(f.windows[0].destroyed, false);
});

test('a missing submit control never claims a new search from an already matching result page', async t => {
  const f = fixture(t, { noForm: true });
  await assert.rejects(f.search('sem formulário'), error => error.code === 'UNAVAILABLE');
  assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'submit'), false);
});

test('resume after an ended video verifies progress from its restarted timeline', async t => {
  const f = fixture(t); await f.search('repetir'); await f.play(FIRST);
  const video = f.windows[0].video; video.ended = true; video.paused = true; video.time = 30;
  const original = video.play.bind(video); video.play = () => { video.time = 0; video.ended = false; return original(); };
  const result = await f.control('play'); assert.equal(result.verified, true); assert.equal(result.playing, true); assert.ok(result.currentTime < 1);
});

test('consent, login and captcha hand off without accepting terms, clicking login or searching', async t => {
  for (const blocked of ['consent', 'login', 'captcha']) await t.test(blocked, async t => {
    const f = fixture(t, { [blocked]: true }); await assert.rejects(f.search('música'), error => error instanceof YouTubeError && error.code === 'CONSENT');
    assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'submit'), false); assert.equal(f.calls.includes('play-video'), false);
  });
});

test('autoplay rejection remains an honest failure with one requested play and no retry loop', async t => {
  const f = fixture(t, { rejectPlay: true }); await f.search('vídeo');
  await assert.rejects(f.play(FIRST), error => error.code === 'UNAVAILABLE');
  assert.equal(f.calls.filter(call => call === 'play-video').length, 1); assert.equal(f.windows[0].destroyed, false);
});

test('an observed advertisement is awaited naturally and content progress starts from a fresh timeline', async t => {
  let states = 0;
  const f = fixture(t, { ad: true, beforeScript({ kind, window }) {
    if (kind !== 'media-state') return;
    if (++states === 1) window.video.time = 25;
    if (states === 3) { f.options.ad = false; window.video.time = 0; window.video.paused = true; }
  } });
  await f.search('vídeo com publicidade'); const result = await f.play(FIRST);
  assert.equal(result.verified, true); assert.equal(result.playing, true); assert.ok(result.currentTime > 0 && result.currentTime < 1);
  assert.equal(f.calls.filter(call => call === 'play-video').length, 2); // One per observed ad/content phase.
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'load' && call[1].includes('/watch?')).length, 1);
  assert.equal(f.calls.filter(call => call === 'skip-ad').length, 0);
});

test('long advertisements never verify content playback and leave the observed player available for explicit pause', async t => {
  const f = fixture(t, { ad: true, timeoutMs: 150 }); await f.search('vídeo');
  await assert.rejects(f.play(FIRST), error => error.code === 'TIMEOUT');
  assert.equal(f.windows[0].destroyed, false); assert.equal(f.calls.filter(call => call === 'play-video').length, 1);
  const paused = await f.control('pause');
  assert.equal(paused.verified, true); assert.equal(paused.playing, false); assert.equal(paused.advertisement, true); assert.equal(f.windows[0].video.paused, true);
});

test('a delayed ad marker still permits one new content-phase play after the advertisement ends', async t => {
  let states = 0, starts = 0;
  const f = fixture(t, { beforeScript({ kind, window }) {
    if (kind !== 'media-state') return;
    states++;
    if (states === 1) {
      const original = window.video.play.bind(window.video);
      window.video.play = () => { if (++starts === 1) f.options.ad = true; return original(); };
    }
    if (states === 3) { f.options.ad = false; window.video.time = 0; window.video.paused = true; }
  } });
  await f.search('vídeo'); const result = await f.play(FIRST);
  assert.equal(result.verified, true); assert.equal(result.playing, true); assert.equal(starts, 2);
  assert.equal(f.calls.filter(call => call === 'skip-ad').length, 0);
});

test('the visible content element is controlled even when an old hidden ad video appears first', async t => {
  const f = fixture(t, { hiddenVideoFirst: true }); await f.search('vídeo'); const result = await f.play(FIRST);
  assert.equal(result.verified, true); assert.equal(f.windows[0].video.paused, false); assert.equal(f.windows[0].hiddenVideo.time, 0);
  assert.equal(f.calls.filter(call => call === 'play-video').length, 1);
});

test('a paused or frozen timeline times out without retrying play or returning a late verified result', async t => {
  const f = fixture(t, { advance: false, timeoutMs: 80 }); await f.search('vídeo');
  await assert.rejects(f.play(FIRST), error => error.code === 'TIMEOUT');
  assert.equal(f.calls.filter(call => call === 'play-video').length, 1); assert.equal(f.windows[0].destroyed, false);
});

test('timeout preserves the window but an expired queued script cannot begin a late media action', async t => {
  const f = fixture(t, { timeoutMs: 150 }); await f.search('vídeo');
  const gate = deferred(); f.options.scriptGate = gate; f.options.scriptGateKind = 'media-control';
  const pending = f.play(FIRST); await assert.rejects(pending, error => error.code === 'TIMEOUT');
  assert.equal(f.windows[0].destroyed, false); assert.equal(f.calls.includes('play-video'), false);
  gate.resolve(); await tick(); assert.equal(f.calls.includes('play-video'), false);
  f.options.scriptGate = null;
  assert.equal((await f.control('pause')).verified, true);
});

test('an unfinished navigation is stopped on timeout without closing the handoff window or replaying a load', async t => {
  const f = fixture(t, { timeoutMs: 150 }); await f.search('vídeo');
  const gate = deferred(); f.options.loadGate = gate;
  await assert.rejects(f.play(FIRST), error => error.code === 'TIMEOUT');
  assert.equal(f.windows[0].destroyed, false); assert.equal(f.calls.filter(call => call === 'stop-navigation').length, 1);
  const url = f.windows[0].url; gate.resolve(); await tick(); assert.equal(f.windows[0].url, url);
  assert.equal(f.calls.filter(call => Array.isArray(call) && call[0] === 'load' && call[1].includes('/watch?')).length, 1);
});

test('explicit cancellation while awaiting an ad closes the player and cannot start a later content phase', async t => {
  const f = fixture(t, { ad: true }); await f.search('vídeo'); const controller = new AbortController();
  const pending = f.controller.play(FIRST, { ...f.scope(), signal: controller.signal });
  await until(() => f.calls.includes('play-video')); controller.abort();
  await assert.rejects(pending, error => error.code === 'CANCELLED'); assert.equal(f.windows[0].destroyed, true);
  f.options.ad = false; await tick();
  assert.equal(f.calls.filter(call => call === 'play-video').length, 1);
  await assert.rejects(f.play(FIRST), error => error.code === 'INVALID');
});

test('cancel during a pending native load destroys the window and late load completion cannot submit', async t => {
  const gate = deferred(), f = fixture(t, { loadGate: gate }), controller = new AbortController();
  const pending = f.controller.search('cancelar', { ...f.scope(), signal: controller.signal });
  await until(() => f.windows.length === 1); controller.abort(); await assert.rejects(pending, error => error.code === 'CANCELLED');
  assert.equal(f.windows[0].destroyed, true); gate.resolve(); await tick();
  assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'submit'), false);
});

test('cancellation before execution and a closed window revoke authority without reopening old video IDs', async t => {
  const f = fixture(t), controller = new AbortController(); controller.abort();
  await assert.rejects(f.controller.search('cancelada', { ...f.scope(), signal: controller.signal }), error => error.code === 'CANCELLED'); assert.equal(f.windows.length, 0);
  await f.search('seleção'); f.windows[0].destroy();
  await assert.rejects(f.play(FIRST), error => error.code === 'INVALID'); assert.equal(f.windows.length, 1);
  await f.search('nova seleção'); assert.equal(f.windows.length, 2);
});

test('profile changes revoke observed IDs, while synchronous close cancels a hung isolated script immediately', async t => {
  const f = fixture(t); await f.search('perfil um'); f.setProfile('other');
  await assert.rejects(f.play(FIRST), error => error.code === 'INVALID'); assert.equal(f.windows[0].destroyed, true);
  await f.search('perfil dois'); assert.equal(f.windows.length, 2);
  const gate = deferred(); f.options.scriptGate = gate;
  const pending = f.search('pendente'); await tick(); f.controller.close();
  await assert.rejects(pending, error => error.code === 'CANCELLED'); assert.equal(f.windows[1].destroyed, true);
  gate.resolve(); await tick();
});

test('serialized searches perform one submission each, and an aborted queued slot does not bypass an active request', async t => {
  const gate = deferred(), f = fixture(t, { loadGate: gate }), queued = new AbortController();
  const first = f.search('primeiro'), second = f.controller.search('cancelado', { ...f.scope(), signal: queued.signal }), third = f.search('terceiro');
  await until(() => f.windows.length === 1); queued.abort(); await assert.rejects(second, error => error.code === 'CANCELLED'); await tick();
  assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'submit'), false);
  gate.resolve(); await first; await third;
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'submit').map(call => call[1]), ['primeiro', 'terceiro']);
});

test('navigation denies popups and external hosts with both current and deprecated Electron event shapes', async t => {
  for (const modern of [false, true]) await t.test(String(modern), async t => {
    const f = fixture(t); await f.search('navegação'); let prevented = false;
    const event = { preventDefault() { prevented = true; }, ...(modern ? { url: 'https://accounts.google.com/login' } : {}) };
    f.windows[0].webContents.emit('will-redirect', event, ...(modern ? [] : ['https://accounts.google.com/login']));
    assert.equal(prevented, true); await assert.rejects(f.play(FIRST), error => error.code === 'CONSENT');
    assert.equal(f.calls.includes('play-video'), false);
    f.windows[0].webContents.emit('will-navigate', { url: 'https://www.youtube.com/', preventDefault() { assert.fail('Allowed manual navigation must remain available.'); } });
    assert.equal((await f.play(FIRST)).verified, true);
  });
});

test('a new explicit search recovers a previous denied navigation without enabling the denied destination', async t => {
  for (const eventName of ['will-navigate', 'will-redirect']) for (const shape of ['current', 'legacy', 'details']) await t.test(`${eventName} ${shape}`, async t => {
    const f = fixture(t); await f.search('primeira seleção');
    const deniedUrl = shape === 'legacy' ? 'https://example.org/' : 'https://accounts.google.com/login';
    const code = shape === 'legacy' ? 'UNAVAILABLE' : 'CONSENT';
    let prevented = false;
    const event = { preventDefault() { prevented = true; }, ...(shape === 'current' ? { url: deniedUrl } : {}) };
    f.windows[0].webContents.emit(eventName, event, ...(shape === 'legacy' ? [deniedUrl] : shape === 'details' ? [{ url: deniedUrl }] : []));
    assert.equal(prevented, true);
    await assert.rejects(f.play(FIRST), error => error.code === code);
    f.windows[0].anchors.shift();
    const result = await f.search('nova seleção');
    assert.equal(result.verified, true); assert.equal(result.query, 'nova seleção');
    assert.deepEqual(result.results.map(item => item.videoId), [SECOND]);
    await assert.rejects(f.play(FIRST), error => error.code === 'INVALID');
    assert.equal((await f.play(SECOND)).verified, true);
    assert(f.calls.filter(call => Array.isArray(call) && call[0] === 'load').every(call => new URL(call[1]).origin === 'https://www.youtube.com'));
    assert.equal(f.windows.length, 1);
  });
});

test('a queued recovery search cannot hide the blocked navigation of the current request', async t => {
  const gate = deferred(); let redirected = false;
  const f = fixture(t, { scriptGate: gate, scriptGateKind: 'results', beforeScript({ kind, window }) {
    if (kind === 'results' && !redirected) {
      redirected = true;
      window.webContents.emit('will-redirect', { url: 'https://consent.youtube.com/', preventDefault() {} });
    }
  } });
  const first = assert.rejects(f.search('bloqueada'), error => error.code === 'CONSENT');
  await until(() => f.calls.some(call => Array.isArray(call) && call[0] === 'execute' && call[3].includes('"kind":"results"')));
  const second = f.search('recuperação solicitada'); gate.resolve();
  await first; const recovered = await second;
  assert.equal(recovered.verified, true); assert.equal(recovered.query, 'recuperação solicitada');
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'submit').map(call => call[1]), ['bloqueada', 'recuperação solicitada']);
  assert.equal(f.calls.includes('play-video'), false);
});

test('invalid and cancelled recovery searches cannot clear a prior navigation block', async t => {
  const f = fixture(t); await f.search('seleção');
  f.windows[0].webContents.emit('will-redirect', { url: 'https://accounts.google.com/login', preventDefault() {} });
  await assert.rejects(f.search(' '), error => error.code === 'INVALID');
  const abort = new AbortController(); abort.abort();
  await assert.rejects(f.controller.search('cancelada', { ...f.scope(), signal: abort.signal }), error => error.code === 'CANCELLED');
  await assert.rejects(f.play(FIRST), error => error.code === 'CONSENT');
  assert.equal(f.windows[0].destroyed, false);
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'submit').map(call => call[1]), ['seleção']);
  assert.equal((await f.search('nova tentativa')).verified, true);
});

test('recovery still hands off a visible consent prompt and revalidates the current origin', async t => {
  const f = fixture(t); await f.search('seleção');
  f.options.consent = true;
  f.windows[0].webContents.emit('will-redirect', { url: 'https://consent.youtube.com/', preventDefault() {} });
  await assert.rejects(f.search('aviso continua'), error => error.code === 'CONSENT');
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'submit').map(call => call[1]), ['seleção']);
  f.options.consent = false; f.windows[0].url = 'https://example.org/';
  f.windows[0].webContents.emit('will-navigate', { url: 'https://example.org/', preventDefault() {} });
  const recovered = await f.search('origem revalidada'); assert.equal(recovered.verified, true);
  assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'load').map(call => call[1]), ['https://www.youtube.com/', 'https://www.youtube.com/']);
});

test('native failures are redacted and the controller never falls back to ordinary page-world execution', async t => {
  const f = fixture(t); await f.search('teste');
  let ordinary = false; f.windows[0].webContents.executeJavaScript = () => { ordinary = true; };
  f.windows[0].webContents.executeJavaScriptInIsolatedWorld = async () => { throw new Error('private-path-and-user-key'); };
  await assert.rejects(f.control('pause'), error => error.code === 'INVALID');
  await assert.rejects(f.search('falha'), error => error instanceof YouTubeError && !/private-path|user-key/.test(error.message));
  assert.equal(ordinary, false);
});
