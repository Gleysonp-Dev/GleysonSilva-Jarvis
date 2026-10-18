const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,150}$/.test(value);
export class SpeechControlError extends Error {}
const reject = message => { throw new SpeechControlError(message); };

/** Per-session speech authority: fixed profile, bounded cost, cancellation and replay protection. */
export class SpeechController {
  #service; #getProfile; #now; #flights = new Map(); #completed = new Map(); #attempts = new Map(); #cancelled = new Set(); #version = 0;
  constructor({ service, getProfile, now = Date.now } = {}) {
    if (!service?.prepare || typeof getProfile !== 'function') throw new TypeError('Speech controller requires a service and active profile.');
    this.#service = service; this.#getProfile = getProfile; this.#now = now;
  }
  async speak(input) {
    if (!input || Object.getPrototypeOf(input) !== Object.prototype || Object.keys(input).some(key => !['text','profileId','runId','utteranceId'].includes(key))) reject('Solicitação de voz inválida.');
    const { text, profileId, runId, utteranceId } = input;
    if (profileId !== this.#getProfile() || !validId(profileId) || !validId(runId) || !validId(utteranceId)) reject('A sessão de voz mudou. Inicie outra conversa.');
    if (typeof text !== 'string' || !text.trim() || text.length > 600 || /\0/.test(text)) reject('O trecho de fala deve conter até 600 caracteres.');
    const key = `${profileId}:${runId}:${utteranceId}`, cancelledKey = `${profileId}:${runId}`, now = this.#now();
    if (this.#cancelled.has(cancelledKey)) reject('A fala foi interrompida.');
    const active = this.#flights.get(key);
    if (active) { if (active.text !== text) reject('Identificador de fala já utilizado.'); return active.promise; }
    for (const [id, saved] of this.#completed) if (now - saved.at > 60_000) this.#completed.delete(id);
    const saved = this.#completed.get(key);
    if (saved) { if (saved.text !== text) reject('Identificador de fala já utilizado.'); return saved.result; }
    if (this.#flights.size >= 2) reject('A voz está preparando outro trecho. Aguarde.');
    const attempts = (this.#attempts.get(profileId) || []).filter(at => now - at < 3_600_000);
    if (attempts.length >= 300 || attempts.filter(at => now - at < 60_000).length >= 30) reject('Limite de geração de voz atingido. Aguarde antes de continuar.');
    attempts.push(now); this.#attempts.set(profileId, attempts);
    while (this.#attempts.size > 50) this.#attempts.delete(this.#attempts.keys().next().value);
    const controller = new AbortController(), version = this.#version;
    const entry = { controller, text, profileId, runId, promise: null };
    entry.promise = Promise.resolve().then(() => this.#service.prepare(input, { signal: controller.signal })).then(result => {
      if (controller.signal.aborted || version !== this.#version || profileId !== this.#getProfile()) reject('A fala foi interrompida.');
      this.#completed.set(key, { text, result, at: this.#now() });
      while (this.#completed.size > 8) this.#completed.delete(this.#completed.keys().next().value);
      return result;
    }).finally(() => { if (this.#flights.get(key) === entry) this.#flights.delete(key); });
    this.#flights.set(key, entry);
    return entry.promise;
  }
  cancel({ runId } = {}) {
    if (!validId(runId)) reject('Identificador de fala inválido.');
    const profileId = this.#getProfile();
    this.#cancelled.add(`${profileId}:${runId}`);
    while (this.#cancelled.size > 200) this.#cancelled.delete(this.#cancelled.values().next().value);
    for (const entry of this.#flights.values()) if (entry.profileId === profileId && entry.runId === runId) entry.controller.abort();
    for (const [key, saved] of this.#completed) if (saved.result.runId === runId) this.#completed.delete(key);
    return true;
  }
  reset() {
    this.#version++;
    for (const entry of this.#flights.values()) entry.controller.abort();
    this.#flights.clear(); this.#completed.clear(); this.#cancelled.clear();
  }
}
