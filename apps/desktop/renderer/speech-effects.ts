/** Local, subtle metallic narration treatment. The source voice is never regenerated. */
export const DEFAULT_SPEECH_EFFECT_AMOUNT = 0.65;

export type SpeechEffectsController = {
  setAmount(amount: number): void;
  getAmount(): number;
  /** Disconnects this graph only; the caller still owns the source, output and context. */
  dispose(): void;
};

export type SpeechEffectsOptions = {
  context: BaseAudioContext;
  input: AudioNode;
  output: AudioNode;
  /** 0 = untouched dry audio; 1 = the strongest, still conservative, treatment. */
  amount?: number;
};

const RAMP_SECONDS = 0.03;
const MAX_WET = 0.4;

function validateAmount(amount: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > 1) {
    throw new RangeError('A intensidade da voz deve estar entre 0 e 1.');
  }
  return amount;
}

/** Insert between a speech source and its analyser/output, before connecting playback. */
export function createSpeechEffects({ context, input, output, amount = DEFAULT_SPEECH_EFFECT_AMOUNT }: SpeechEffectsOptions): SpeechEffectsController {
  let currentAmount = validateAmount(amount);
  if (context.state === 'closed') throw new Error('O contexto de áudio já foi encerrado.');
  if (input.context !== context || output.context !== context || input === output) {
    throw new Error('A entrada e a saída devem pertencer ao mesmo contexto de áudio e ser diferentes.');
  }

  const owned: AudioNode[] = [];
  const sources: OscillatorNode[] = [];
  const inputEdges: AudioNode[] = [];
  let disposed = false;
  const own = <T extends AudioNode>(node: T): T => { owned.push(node); return node; };
  const oscillator = (): OscillatorNode => {
    const node = own(context.createOscillator());
    sources.push(node);
    return node;
  };
  const connectInput = (target: AudioNode): void => {
    // Record before connect so a partially failed connection is also cleaned up.
    inputEdges.push(target); input.connect(target);
  };
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (const node of sources) { try { node.stop(); } catch { /* Already stopped or not started. */ } }
    for (const target of inputEdges) { try { input.disconnect(target); } catch { /* Context or edge already gone. */ } }
    for (const node of owned) { try { node.disconnect(); } catch { /* Context already gone. */ } }
  };
  const initial = (param: AudioParam, value: number): void => { param.setValueAtTime(value, context.currentTime); };
  const ramp = (param: AudioParam, value: number): void => {
    const now = context.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else {
      const held = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(held, now);
    }
    param.linearRampToValueAtTime(value, now + RAMP_SECONDS);
  };

  try {
    // The dry path contains no filter/compressor/delay: amount 0 is a real bypass.
    const dry = own(context.createGain());
    const wet = own(context.createGain());
    const highpass = own(context.createBiquadFilter());
    highpass.type = 'highpass';
    initial(highpass.frequency, 90); initial(highpass.Q, Math.SQRT1_2);
    const lowpass = own(context.createBiquadFilter());
    lowpass.type = 'lowpass';
    initial(lowpass.frequency, Math.min(7000, context.sampleRate * 0.42)); initial(lowpass.Q, Math.SQRT1_2);

    // Short, quiet comb coloration; no feedback, pitch change or long echo tail.
    const body = own(context.createGain()); initial(body.gain, 0.66);
    const delay = own(context.createDelay(0.03)); initial(delay.delayTime, 0.011);
    const reflection = own(context.createGain()); initial(reflection.gain, 0.34);
    const metallic = own(context.createGain());
    const pulse = oscillator(); pulse.type = 'sine'; initial(pulse.frequency, 43);
    const pulseDepth = own(context.createGain());
    const drift = oscillator(); drift.type = 'sine'; initial(drift.frequency, 0.65);
    const driftDepth = own(context.createGain());
    const compressor = own(context.createDynamicsCompressor());
    initial(compressor.threshold, -16); initial(compressor.knee, 12); initial(compressor.ratio, 2.5);
    initial(compressor.attack, 0.004); initial(compressor.release, 0.09);

    const apply = (next: number, animate: boolean): void => {
      const set = animate ? ramp : initial;
      const wetAmount = MAX_WET * next;
      set(dry.gain, 1 - wetAmount); set(wet.gain, wetAmount);
      // The modulation is unipolar, never boosting the wet signal above unity.
      set(metallic.gain, 1 - 0.4 * next); set(pulseDepth.gain, 0.4 * next);
      set(driftDepth.gain, 0.00065 * next);
    };
    apply(currentAmount, false);

    dry.connect(output);
    highpass.connect(lowpass);
    lowpass.connect(body); body.connect(metallic);
    lowpass.connect(delay); delay.connect(reflection); reflection.connect(metallic);
    pulse.connect(pulseDepth); pulseDepth.connect(metallic.gain);
    drift.connect(driftDepth); driftDepth.connect(delay.delayTime);
    metallic.connect(compressor); compressor.connect(wet); wet.connect(output);
    // Parameters and internal routes are ready before exposing the source to them.
    connectInput(dry); connectInput(highpass);
    pulse.start(); drift.start();

    return {
      setAmount(next: number): void {
        if (disposed) throw new Error('O efeito de voz já foi encerrado.');
        validateAmount(next);
        if (next === currentAmount) return;
        apply(next, true); currentAmount = next;
      },
      getAmount: () => currentAmount,
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
