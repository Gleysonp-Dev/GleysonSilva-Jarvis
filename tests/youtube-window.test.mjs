import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createYouTubeWindowFactory } from '../apps/desktop/youtube-window.mjs';

function fixture() {
  const sessions = [], windows = [], profiles = [];
  const selected = new EventEmitter();
  Object.assign(selected, { setPermissionRequestHandler(fn) { this.request = fn; }, setPermissionCheckHandler(fn) { this.check = fn; }, setDevicePermissionHandler(fn) { this.device = fn; } });
  class BrowserWindow { constructor(options) { this.options = options; this.webContents = new EventEmitter(); this.webContents.setWindowOpenHandler = fn => { this.popup = fn; }; windows.push(this); } }
  const create = createYouTubeWindowFactory({ BrowserWindow, product: 'Jarvis', session: { fromPartition(profile) { profiles.push(profile); sessions.push(selected); return selected; } } });
  return { create, selected, windows, profiles };
}
test('YouTube window isolates the profile and denies devices, downloads, popups and privileged page access', () => {
  const f = fixture(), window = f.create({ profileId: 'default' }), prefs = window.options.webPreferences;
  assert.deepEqual(f.profiles, ['persist:jarvis-youtube-default']);
  for (const key of ['nodeIntegration','allowRunningInsecureContent','webviewTag','devTools','navigateOnDragDrop']) assert.equal(prefs[key], false);
  for (const key of ['sandbox','contextIsolation','webSecurity']) assert.equal(prefs[key], true);
  assert.equal(prefs.preload, undefined); assert.equal(prefs.session, f.selected);
  let allowed; f.selected.request({}, 'media', value => { allowed = value; }); assert.equal(allowed, false);
  assert.equal(f.selected.check(), false); assert.equal(f.selected.device(), false); assert.deepEqual(window.popup(), { action: 'deny' });
  let stopped = 0; const event = { preventDefault() { stopped++; } };
  f.selected.emit('will-download', event); window.webContents.emit('will-attach-webview', event); window.webContents.emit('login', event);
  assert.equal(stopped, 3);
  f.create({ profileId: 'default' }); assert.equal(f.selected.listenerCount('will-download'), 1);
});
test('YouTube frame navigation supports current Electron details and refuses non-HTTPS protocols', () => {
  const f = fixture(), window = f.create({ profileId: 'default' });
  for (const url of ['https://www.youtube.com/results?search_query=band', 'https://i.ytimg.com/test']) {
    let stopped = false; window.webContents.emit('will-frame-navigate', { url, preventDefault() { stopped = true; } }); assert.equal(stopped, false);
  }
  for (const url of ['file:///C:/private.txt', 'javascript:alert(1)', 'http://example.com/', 'not-a-url']) {
    let stopped = false; window.webContents.emit('will-frame-navigate', { url, preventDefault() { stopped = true; } }); assert.equal(stopped, true);
  }
  assert.throws(() => f.create({ profileId: '../../other' }));
});
