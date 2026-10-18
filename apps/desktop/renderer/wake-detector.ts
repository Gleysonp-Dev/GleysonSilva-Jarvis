export type ClapFrame = {
  atMs: number;
  /** Linear RMS and sample peak, normalized to 0..1. */
  rms: number;
  peak: number;
  /** Power above 2 kHz / power in the analyzed speech/audio band. */
  highFrequencyRatio: number;
};
export type DoubleClapOptions = { minGapMs?: number; maxGapMs?: number; cooldownMs?: number };
type Transient = { atMs: number; peakRms: number };
const SETTLING_MS = 750;
const MIN_CLAP_RMS = 0.05;
const MIN_CLAP_PEAK = 0.25;

/**
 * Continuous local 20 ms frames, with no recording, network or speech recognition.
 * Two short broadband attacks are required; sustained speech/noise is rejected.
 * Opening/resetting capture settles the noise floor before accepting a pair.
 * Acoustic detection is heuristic: claps and other similar impacts can be confused.
 */
export class DoubleClapDetector {
  private readonly minGapMs: number;
  private readonly maxGapMs: number;
  private readonly cooldownMs: number;
  private noiseFloor = 0.004;
  private previousRms = 0;
  private lastFrameAt?: number;
  private settlingUntil?: number;
  private lastClapAt?: number;
  private candidate?: Transient;
  private rearmAt = 0;
  private cooldownUntil = 0;

  constructor({ minGapMs = 150, maxGapMs = 800, cooldownMs = 8000 }: DoubleClapOptions = {}) {
    if (![minGapMs, maxGapMs, cooldownMs].every(Number.isFinite) || minGapMs < 100 || maxGapMs <= minGapMs || maxGapMs > 2000 || cooldownMs < maxGapMs) throw new RangeError('Intervalos do detector de palmas inválidos.');
    this.minGapMs = minGapMs; this.maxGapMs = maxGapMs; this.cooldownMs = cooldownMs;
  }

  reset() {
    this.noiseFloor = 0.004; this.previousRms = 0; this.lastFrameAt = undefined; this.settlingUntil = undefined;
    this.lastClapAt = undefined; this.candidate = undefined; this.rearmAt = 0; this.cooldownUntil = 0;
  }

  push(frame: ClapFrame): boolean {
    const { atMs, rms, peak, highFrequencyRatio } = frame;
    if (![atMs, rms, peak, highFrequencyRatio].every(Number.isFinite) || atMs < 0 || rms < 0 || rms > 1 || peak < rms || peak > 1 || highFrequencyRatio < 0 || highFrequencyRatio > 1) {
      this.candidate = undefined; this.lastClapAt = undefined; return false;
    }
    // Delayed background timers cannot establish whether an unseen interval was quiet.
    if (this.lastFrameAt !== undefined && (atMs <= this.lastFrameAt || atMs - this.lastFrameAt > 250)) {
      this.candidate = undefined; this.lastClapAt = undefined; this.previousRms = rms;
    }
    this.lastFrameAt = atMs;
    const previous = this.previousRms; this.previousRms = rms;
    this.settlingUntil ??= atMs + SETTLING_MS;
    if (atMs < this.settlingUntil) {
      this.candidate = undefined; this.lastClapAt = undefined; this.adaptNoise(rms); return false;
    }
    if (this.lastClapAt !== undefined && atMs - this.lastClapAt > this.maxGapMs + 120) this.lastClapAt = undefined;

    const threshold = Math.max(MIN_CLAP_RMS, this.noiseFloor * 4.5);
    if (atMs < this.cooldownUntil) { this.candidate = undefined; this.adaptNoise(rms); return false; }
    if (this.candidate) {
      const transient = this.candidate;
      transient.peakRms = Math.max(transient.peakRms, rms);
      const duration = atMs - transient.atMs;
      if (rms <= Math.max(this.noiseFloor * 2, transient.peakRms * 0.42)) {
        this.candidate = undefined; this.rearmAt = atMs + 70;
        if (duration > 0 && duration <= 110) return this.acceptClap(transient.atMs);
        return false;
      }
      if (duration > 110) { this.candidate = undefined; this.rearmAt = atMs + 140; this.lastClapAt = undefined; this.adaptNoise(rms); }
      return false;
    }

    const sharpRise = rms >= previous * 2.4 && rms - previous >= threshold * 0.55;
    const broadband = highFrequencyRatio >= 0.33;
    const impulsive = peak / Math.max(rms, 0.000001) >= 2.2;
    if (atMs >= this.rearmAt && rms >= threshold && peak >= MIN_CLAP_PEAK && sharpRise && broadband && impulsive) {
      this.candidate = { atMs, peakRms: rms }; return false;
    }
    this.adaptNoise(rms);
    return false;
  }

  private adaptNoise(rms: number) { this.noiseFloor = Math.max(0.001, Math.min(0.08, this.noiseFloor + (Math.min(rms, 0.08) - this.noiseFloor) * 0.035)); }
  private acceptClap(atMs: number) {
    if (this.lastClapAt !== undefined) {
      const gap = atMs - this.lastClapAt;
      if (gap >= this.minGapMs && gap <= this.maxGapMs) { this.lastClapAt = undefined; this.cooldownUntil = atMs + this.cooldownMs; return true; }
      if (gap < this.minGapMs) return false;
    }
    this.lastClapAt = atMs; return false;
  }
}
