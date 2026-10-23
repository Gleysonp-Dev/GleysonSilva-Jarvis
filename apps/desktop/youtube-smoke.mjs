import { YouTubeController } from './youtube.mjs';
import { createYouTubeWindowFactory } from './youtube-window.mjs';

// Called only from the existing nonce-guarded, disposable --jarvis-smoke branch.
// All HTTPS requests in this separate session are answered locally; no account or network is used.
export async function runYouTubeFixtureSmoke({ BrowserWindow, session, product }) {
  const isolated = session.fromPartition('jarvis-youtube-fixture');
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const sampleRate = 8000, frames = sampleRate * 30;
  const wav = Buffer.alloc(44 + frames * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(frames * 2, 40);
  const media = `data:audio/wav;base64,${wav.toString('base64')}`;
  const videoId = 'abcdefghijk', secondVideoId = 'lmnopqrstuv';
  const secondQuery = 'Fixture second band music';
  isolated.protocol.handle('https', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'www.youtube.com') return new Response('Blocked', { status: 403 });
    const query = url.searchParams.get('search_query') ?? '';
    const search = `<form action="/results" method="get"><input name="search_query" aria-label="Search" value="${escape(query)}"><button type="submit">Search</button></form>`;
    const selectedId = url.pathname === '/watch' ? url.searchParams.get('v') : query === secondQuery ? secondVideoId : videoId;
    const title = selectedId === secondVideoId ? 'Second local fixture video' : 'Local fixture video';
    const body = url.pathname === '/watch'
      ? `<h1 class="title"><yt-formatted-string>${title}</yt-formatted-string></h1><div id="movie_player"><video class="html5-main-video" controls muted src="${media}"></video></div>`
      : query ? `<ytd-video-renderer><a id="video-title" title="${title}" href="/watch?v=${selectedId}">${title}</a><ytd-channel-name><a>Local fixture channel</a></ytd-channel-name></ytd-video-renderer>` : '';
    return new Response(`<!doctype html><html><head><title>Jarvis YouTube fixture</title></head><body><header>${search}</header>${body}</body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  });
  isolated.protocol.handle('http', () => new Response('Blocked', { status: 403 }));
  const profileId = 'youtube-fixture';
  const controller = new YouTubeController({ getProfileId: () => profileId, timeoutMs: 5000,
    createWindow: createYouTubeWindowFactory({ BrowserWindow, session, product, hidden: true, fixtureSession: isolated }) });
  let stage = 'SEARCH';
  try {
    const found = await controller.search('Fixture band music', { profileId });
    if (!found.verified || found.query !== 'Fixture band music' || found.results?.[0]?.videoId !== videoId) throw new Error('YOUTUBE_FIXTURE_SEARCH_FAILED');
    stage = 'PLAY'; const played = await controller.play(videoId, { profileId });
    if (!played.verified || !played.playing || !Number.isFinite(played.currentTime)) throw new Error('YOUTUBE_FIXTURE_PLAY_FAILED');
    stage = 'PAUSE'; const paused = await controller.control('pause', { profileId });
    if (!paused.verified || paused.playing !== false) throw new Error('YOUTUBE_FIXTURE_PAUSE_FAILED');
    stage = 'RESUME'; const resumed = await controller.control('play', { profileId });
    if (!resumed.verified || resumed.playing !== true) throw new Error('YOUTUBE_FIXTURE_RESUME_FAILED');
    // Exercise the same visible form from /watch, then choose only the newly observed result.
    // Keep the existing fixed diagnostic stages and native-runner result contract.
    stage = 'SEARCH'; const second = await controller.search(secondQuery, { profileId });
    if (!second.verified || second.query !== secondQuery || second.results?.[0]?.videoId !== secondVideoId) throw new Error('YOUTUBE_FIXTURE_SEARCH_FAILED');
    stage = 'PLAY'; const replayed = await controller.play(second.results[0].videoId, { profileId });
    if (!replayed.verified || replayed.videoId !== secondVideoId || replayed.playing !== true || !Number.isFinite(replayed.currentTime)) throw new Error('YOUTUBE_FIXTURE_PLAY_FAILED');
    return true;
  } catch { throw new Error(`JARVIS_YOUTUBE_FIXTURE_${stage}_FAILED`); }
  finally { controller.close(); isolated.protocol.unhandle('https'); isolated.protocol.unhandle('http'); }
}
