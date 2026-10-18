(() => {
  'use strict';
  const token = document.querySelector('meta[name="jarvis-token"]')?.content;
  if (!token) throw new Error('O token do teste local não está disponível.');
  const listeners = new Set();
  let stopped = false, streamController, resolveConnected;
  const connected = new Promise(resolve => { resolveConnected = resolve; });
  const dispatch = event => { for (const listener of listeners) { try { listener(event); } catch { /* One view cannot break the event stream. */ } } };
  async function events() {
    while (!stopped) {
      streamController = new AbortController();
      try {
        const response = await fetch('/events', { headers: { 'X-Jarvis-Token': token }, credentials: 'same-origin', signal: streamController.signal });
        if (!response.ok || !response.body) throw new Error('O canal de eventos local não respondeu.');
        resolveConnected();
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 1_000_000) throw new Error('O canal local excedeu o tamanho permitido.');
          let boundary;
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
            const text = block.split('\n').filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n');
            if (text) { try { dispatch(JSON.parse(text)); } catch { dispatch({ type: 'error', message: 'Evento local inválido.' }); } }
          }
        }
      } catch (error) { streamController?.abort(); if (!stopped) dispatch({ type: 'error', message: 'O canal local foi interrompido. Tentando reconectar…' }); }
      if (!stopped) await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  void events();
  async function invoke(method, value) {
    if (['text', 'callTool'].includes(method)) {
      let timer;
      try { await Promise.race([connected, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('O canal de eventos ainda não está conectado. Tente novamente.')), 5000); })]); }
      finally { clearTimeout(timer); }
    }
    const response = await fetch(`/api/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Jarvis-Token': token }, credentials: 'same-origin', body: JSON.stringify(value === undefined ? null : value) });
    let payload;
    try { payload = await response.json(); } catch { throw new Error('O servidor local retornou uma resposta inválida.'); }
    if (!response.ok || payload.ok !== true) throw new Error(payload.error || 'A solicitação local falhou.');
    return payload.result;
  }
  const methods = ['boot', 'saveSettings', 'chooseWorkspace', 'chooseApp', 'text', 'cancel', 'callTool', 'approve', 'memorySave', 'memoryDelete', 'realtimeSession', 'vision', 'openExternal', 'listModels', 'startupGreeting'];
  const bridge = Object.fromEntries(methods.map(method => [method, value => invoke(method, value)]));
  bridge.onEvent = callback => { if (typeof callback !== 'function') throw new Error('Callback inválido.'); listeners.add(callback); return () => listeners.delete(callback); };
  Object.defineProperty(window, 'jarvis', { value: Object.freeze(bridge), configurable: false, writable: false });
  window.addEventListener('beforeunload', () => { stopped = true; streamController?.abort(); });
})();
