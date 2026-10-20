import type { AudioLevels, VoiceState } from './realtime';

export type HudFrame = { mode: VoiceState | 'approval'; levels: AudioLevels };

/** Original orbital light sculpture. The empty centre contains no text or telemetry. */
export function createHud(canvas: HTMLCanvasElement, sample: () => HudFrame) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const ctx = context;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tau = Math.PI * 2;
  // One blue hue throughout every state; only opacity, light and scale respond.
  const light = (alpha: number) => `rgba(70,190,255,${Math.max(0, Math.min(1, alpha))})`;
  const pointCount = 192;
  const maxBackingPixels = 2_400_000;
  let width = 0, height = 0, dpi = 1;
  let qualityDpi = Math.min(Math.max(devicePixelRatio || 1, 1), 1.5);
  let clock = 0, energy = 0, slowFrames = 0, frame = 0;
  let lastDraw: number | undefined;
  let disposed = false;
  const waveform = new Float32Array(48);

  function finiteLevel(value: number) {
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  }

  function update(state: HudFrame, dt: number) {
    const { mode, levels } = state;
    let target = 0;
    if (mode === 'listen') target = .045 + finiteLevel(levels.mic) * .955;
    if (mode === 'speak') target = .065 + finiteLevel(levels.speaker) * .935;
    if (mode === 'execute') target = .23 + .28 * (.5 - .5 * Math.cos(clock * tau * .68));
    if (mode === 'think' || mode === 'connecting') target = .12 + .1 * (.5 - .5 * Math.cos(clock * tau * .32));
    if (mode === 'approval') target = .035;
    // Fast attack and slower release follow actual audio without a flickering edge.
    const smoothing = 1 - Math.exp(-dt / (target > energy ? .085 : .24));
    energy += (target - energy) * smoothing;
    const followsAudio = mode === 'listen' || mode === 'speak';
    const waveBlend = 1 - Math.exp(-dt / .12);
    for (let i = 0; i < waveform.length; i++) {
      const index = Math.floor(i * levels.wave.length / waveform.length);
      const value = followsAudio ? finiteLevel(levels.wave[index] || 0) : 0;
      waveform[i] += (value - waveform[i]) * waveBlend;
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(0, rect.width); height = Math.max(0, rect.height);
    if (!width || !height) return;
    dpi = Math.min(qualityDpi, Math.sqrt(maxBackingPixels / (width * height)));
    const backingWidth = Math.max(1, Math.round(width * dpi));
    const backingHeight = Math.max(1, Math.round(height * dpi));
    if (canvas.width !== backingWidth) canvas.width = backingWidth;
    if (canvas.height !== backingHeight) canvas.height = backingHeight;
    draw();
  }

  function draw() {
    if (disposed || width <= 0 || height <= 0) return;
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const radius = Math.min(width * .4, height * .4, 310);
    if (radius <= 0) return;
    const motion = reduced.matches ? 0 : 1;
    const time = clock * motion;
    const expansion = 1 + motion * (.004 * Math.sin(time * .65) + energy * .055);
    const luminosity = 1 + energy * .95;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(radius / 250 * expansion, radius / 250 * expansion);
    ctx.globalCompositeOperation = 'lighter';

    // An annular haze keeps the centre dark and gives the thin filaments depth.
    const halo = ctx.createRadialGradient(0, 0, 116, 0, 0, 300);
    halo.addColorStop(0, light(0));
    halo.addColorStop(.28, light(.016 * luminosity));
    halo.addColorStop(.47, light(.075 * luminosity));
    halo.addColorStop(.62, light(.05 * luminosity));
    halo.addColorStop(.85, light(.009 * luminosity));
    halo.addColorStop(1, light(0));
    ctx.fillStyle = halo;
    ctx.fillRect(-300, -300, 600, 600);

    function filament(seed: number, start = 0, length = tau, detail = pointCount) {
      const phase = seed * 1.738;
      const rotation = time * (.025 + (seed % 4) * .007) * (seed % 2 ? -1 : 1);
      const centreRadius = 199 + Math.sin(seed * 2.31) * 9;
      ctx.beginPath();
      for (let step = 0; step <= detail; step++) {
        const angle = start + step / detail * length;
        const turn = angle + rotation;
        const waveIndex = Math.floor((angle / tau % 1 + 1) % 1 * waveform.length);
        const audioRipple = waveform[waveIndex] * 15 * motion;
        // Different winding counts cross continuously, without rigid concentric rings.
        const winding = Math.sin(angle * 3 + phase + time * .19) * (12 + seed % 4 * 2);
        const fine = Math.sin(angle * 7 - phase * .6 - time * .12) * 3.8;
        const radial = centreRadius + winding + fine + audioRipple;
        const x = Math.cos(turn) * radial;
        const y = Math.sin(turn) * radial * (.92 + .035 * Math.sin(phase));
        const twist = Math.sin(angle * 2 + phase + time * .08) * 5.5;
        const px = x + Math.sin(turn) * twist;
        const py = y + Math.cos(turn) * twist;
        if (!step) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
    }

    // Soft secondary paths make a light cloud, with no hard mechanical outline.
    ctx.lineWidth = 3.6;
    for (let i = 0; i < 7; i++) {
      filament(i * 1.13 + 2.4);
      ctx.strokeStyle = light((.055 + i % 3 * .012) * luminosity);
      ctx.shadowColor = light(.7); ctx.shadowBlur = i < 3 ? 12 : 0;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.05;
    for (let i = 0; i < 16; i++) {
      filament(i);
      ctx.strokeStyle = light((.38 + i % 4 * .045) * luminosity);
      ctx.stroke();
    }

    // Travelling highlights follow the same filaments; they are not activity meters.
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const seed = i * 3.21 + .6;
      const start = i * 1.39 + time * (i % 2 ? -.07 : .06);
      filament(seed, start, .9 + .24 * Math.sin(i * 2), 48);
      ctx.lineWidth = i % 2 ? 1.15 : 1.45;
      ctx.strokeStyle = light((.69 + .12 * Math.sin(i * 1.3)) * luminosity);
      ctx.shadowColor = light(.85); ctx.shadowBlur = 12 + energy * 6;
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Sparse motes remain around the orbital envelope, leaving its centre empty.
    for (let i = 0; i < 32; i++) {
      const angle = i * 2.39996 + time * (.008 + i % 3 * .003);
      const distance = 184 + (Math.sin(i * 7.13) * .5 + .5) * 64;
      const opacity = (.12 + .22 * (.5 + .5 * Math.sin(i * 3.2 + time * .4))) * luminosity;
      ctx.fillStyle = light(opacity);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * distance, Math.sin(angle) * distance * .94, i % 7 ? .55 : 1.05, 0, tau);
      ctx.fill();
    }
    ctx.restore();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const onMotionChange = () => { if (!disposed) draw(); };
  reduced.addEventListener('change', onMotionChange);

  function animate(ms: number) {
    if (disposed) return;
    const state = sample();
    const quiet = state.mode === 'idle' || state.mode === 'approval' || reduced.matches;
    const interval = 1000 / (quiet ? 15 : 30);
    if (lastDraw === undefined || ms - lastDraw >= interval) {
      const dt = lastDraw === undefined ? interval / 1000 : Math.min((ms - lastDraw) / 1000, .1);
      lastDraw = ms;
      if (!document.hidden && width > 0 && height > 0) {
        if (!reduced.matches) clock += dt;
        update(state, dt);
        const started = performance.now();
        draw();
        slowFrames = performance.now() - started > 20 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (slowFrames >= 3 && qualityDpi > 1) { qualityDpi = 1; slowFrames = 0; resize(); }
      }
    }
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  return () => {
    disposed = true;
    observer.disconnect();
    reduced.removeEventListener('change', onMotionChange);
    cancelAnimationFrame(frame);
  };
}
