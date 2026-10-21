type FullscreenBridge = Pick<JarvisBridge, 'getFullscreen' | 'setFullscreen' | 'onFullscreen'>;

export function createFullscreenController({
  bridge, document: page, window: host, onChange, onError,
}: {
  bridge?: FullscreenBridge;
  document: Document;
  window: Window;
  onChange(enabled: boolean): void;
  onError(error: Error): void;
}) {
  const native = typeof bridge?.getFullscreen === 'function' && typeof bridge?.setFullscreen === 'function';
  let current = native ? false : Boolean(page.fullscreenElement);
  let pending = false;
  let disposed = false;
  let revision = 0;
  let unsubscribe: (() => void) | undefined;

  const update = (enabled: boolean) => {
    if (disposed) return;
    revision++;
    current = enabled;
    onChange(current);
  };
  const reportError = () => {
    if (!disposed) onError(new Error('Não foi possível alterar a tela cheia. Tente novamente pelo botão no topo.'));
  };
  const browserChanged = () => update(Boolean(page.fullscreenElement));

  async function set(enabled: boolean) {
    if (disposed || pending || enabled === current) return current;
    pending = true;
    const requestRevision = ++revision;
    try {
      if (native) {
        const actual = await bridge!.setFullscreen!(enabled);
        if (!disposed && revision === requestRevision) update(actual === true);
      } else {
        if (enabled) await page.documentElement.requestFullscreen();
        else await page.exitFullscreen();
        if (!disposed) browserChanged();
      }
    } catch { reportError(); }
    finally { pending = false; }
    return current;
  }
  const toggle = () => set(!current);
  const keydown = (event: KeyboardEvent) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const toggleKey = event.key === 'F11';
    const exitKey = event.key === 'Escape' && current;
    if (!toggleKey && !exitKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) void (exitKey ? set(false) : toggle());
  };

  host.addEventListener('keydown', keydown, true);
  if (native) {
    try {
      unsubscribe = bridge!.onFullscreen?.(enabled => update(enabled === true));
      const initialRevision = revision;
      void bridge!.getFullscreen!().then(enabled => {
        if (!disposed && revision === initialRevision) update(enabled === true);
      }).catch(reportError);
    } catch { reportError(); }
  } else {
    page.addEventListener('fullscreenchange', browserChanged);
    onChange(current);
  }

  return {
    set,
    toggle,
    dispose() {
      if (disposed) return;
      disposed = true;
      host.removeEventListener('keydown', keydown, true);
      page.removeEventListener('fullscreenchange', browserChanged);
      unsubscribe?.();
    },
  };
}
