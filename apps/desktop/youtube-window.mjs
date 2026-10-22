/** The remote page receives no Jarvis preload, Node, account cookies or media devices. */
export function createYouTubeWindowFactory({ BrowserWindow, session, product, hidden = false, fixtureSession } = {}) {
  const configured = new WeakSet();
  return ({ profileId }) => {
    if (typeof profileId !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(profileId)) throw new Error('Perfil do YouTube inválido.');
    const isolated = fixtureSession ?? session.fromPartition(`persist:jarvis-youtube-${profileId}`);
    if (!configured.has(isolated)) {
      configured.add(isolated);
      isolated.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
      isolated.setPermissionCheckHandler(() => false);
      isolated.setDevicePermissionHandler(() => false);
      isolated.on('will-download', event => event.preventDefault());
    }
    const window = new BrowserWindow({ width: 1180, height: 820, title: `${product} · YouTube`, autoHideMenuBar: true, show: !hidden,
      webPreferences: { session: isolated, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
        allowRunningInsecureContent: false, webviewTag: false, devTools: false, navigateOnDragDrop: false,
        autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false } });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('login', event => event.preventDefault());
    window.webContents.on('will-frame-navigate', (event, details) => {
      const url = typeof details === 'string' ? details : details?.url ?? event.url;
      try { if (new URL(url).protocol !== 'https:') event.preventDefault(); } catch { event.preventDefault(); }
    });
    return window;
  };
}
