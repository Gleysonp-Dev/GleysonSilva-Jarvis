export class ReceptionError extends Error {}
const reject = message => { throw new ReceptionError(message); };

/** Explicitly enabled, short-lived image analysis. Images never enter runtime history. */
export class ReceptionObservation {
  #getSettings; #describe; #now; #flights = new Map(); #attempts = new Map(); #generation = 0;
  constructor({ getSettings, describe, now = Date.now } = {}) {
    if (typeof getSettings !== 'function' || typeof describe !== 'function') throw new TypeError('Reception requires settings and observation provider.');
    this.#getSettings = getSettings; this.#describe = describe; this.#now = now;
  }
  async observe(input) {
    if (!input || Object.getPrototypeOf(input) !== Object.prototype || Object.keys(input).length !== 1 || typeof input.imageDataUrl !== 'string'
      || input.imageDataUrl.length > 700000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.imageDataUrl)) reject('Captura de roupa inválida.');
    const settings = this.#getSettings(), profileId = settings.profileId;
    if (settings.receptionOutfitEnabled !== true) reject('Ative o envio de uma captura à OpenAI nos ajustes da recepção.');
    if (typeof profileId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(profileId)) reject('Perfil de recepção inválido.');
    if (this.#flights.has(profileId)) reject('Uma captura da recepção já está sendo analisada.');
    const now = this.#now();
    if (!Number.isFinite(now)) reject('Horário da recepção indisponível.');
    const attempts = (this.#attempts.get(profileId) ?? []).filter(at => now - at < 3600000);
    if (attempts.length >= 6 || (attempts.length && now - attempts.at(-1) < 60000)) reject('Aguarde um minuto para outra captura. Limite de seis por hora.');
    attempts.push(now); this.#attempts.set(profileId, attempts);
    while (this.#attempts.size > 50) this.#attempts.delete(this.#attempts.keys().next().value);
    const controller = new AbortController(), generation = this.#generation;
    this.#flights.set(profileId, controller);
    let relay;
    try {
      const pending = Promise.resolve().then(() => {
        if (controller.signal.aborted) reject('Observação da roupa interrompida.');
        return this.#describe(input, { signal: controller.signal });
      });
      const result = await Promise.race([pending, new Promise((_, fail) => {
        relay = () => fail(new ReceptionError('Observação da roupa interrompida.'));
        controller.signal.addEventListener('abort', relay, { once: true });
        if (controller.signal.aborted) relay();
      })]);
      const current = this.#getSettings();
      if (controller.signal.aborted || generation !== this.#generation || current.profileId !== profileId || current.receptionOutfitEnabled !== true) reject('Observação da roupa interrompida.');
      if (typeof result?.text !== 'string' || !result.text.trim() || result.text.length > 1200 || !Number.isFinite(result.observedAt)) reject('Não foi possível observar a roupa nesta captura.');
      return { text: result.text, observedAt: result.observedAt };
    } finally {
      controller.signal.removeEventListener('abort', relay);
      if (this.#flights.get(profileId) === controller) this.#flights.delete(profileId);
    }
  }
  cancel() {
    const profileId = this.#getSettings().profileId, controller = this.#flights.get(profileId);
    controller?.abort();
    if (controller) this.#flights.delete(profileId);
    return { cancelled: Boolean(controller) };
  }
  reset() { this.#generation++; for (const controller of this.#flights.values()) controller.abort(); this.#flights.clear(); }
}
