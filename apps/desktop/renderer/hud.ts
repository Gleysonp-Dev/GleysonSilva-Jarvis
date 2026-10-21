import type { AudioLevels, VoiceState } from './realtime';

export type HudFrame = { mode: VoiceState | 'approval'; levels: AudioLevels };

/** Original orbital light sculpture. The empty centre contains no text or telemetry. */
export function createHud(canvas: HTMLCanvasElement, sample: () => HudFrame) {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const ctx = context;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const tau = Math.PI * 2;
  // A fixed blue/cyan light palette throughout every state; no state selects a hue.
  const light = (alpha: number) => `rgba(36,213,255,${Math.max(0, Math.min(1, alpha))})`;
  const blue = (alpha: number) => `rgba(16,79,255,${Math.max(0, Math.min(1, alpha))})`;
  const pointCount = 192;
  const maxBackingPixels = 2_400_000;
  let width = 0, height = 0, dpi = 1;
  let qualityDpi = Math.min(Math.max(devicePixelRatio || 1, 1), 1.5);
  let clock = 0, energy = 0, slowFrames = 0, frame = 0;
  let lastDraw: number | undefined;
  let disposed = false;
  const waveform = new Float32Array(48);
  const curves = Array.from({ length: 10 }, () => new Float32Array(pointCount * 2));
  const curveStrength = [.92, .34, .72, .19, .4, .82, .23, .55, .16, .63];

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
    ctx.scale(radius / 250, radius / 250);
    ctx.globalCompositeOperation = 'lighter';

    // A translucent blue field lights the open centre without covering it with a solid disc.
    const field = ctx.createRadialGradient(-12, -54, 0, 0, -10, 322);
    field.addColorStop(0, blue(.3 * luminosity));
    field.addColorStop(.4, blue(.25 * luminosity));
    field.addColorStop(.66, blue(.14 * luminosity));
    field.addColorStop(.87, blue(.035 * luminosity));
    field.addColorStop(1, blue(0));
    ctx.fillStyle = field;
    ctx.fillRect(-330, -340, 660, 660);

    // A faint local grid shows through the illuminated space, with no labels or numbers.
    const grid = ctx.createRadialGradient(0, -20, 0, 0, 0, 505);
    grid.addColorStop(0, light(.055));
    grid.addColorStop(.64, light(.035));
    grid.addColorStop(1, light(0));
    ctx.strokeStyle = grid; ctx.lineWidth = .55;
    const gridX = Math.max(360, Math.ceil(width * 125 / radius / 36) * 36);
    const gridY = Math.max(360, Math.ceil(height * 125 / radius / 36) * 36);
    ctx.beginPath();
    for (let value = -gridX; value <= gridX; value += 36) {
      ctx.moveTo(value, -gridY); ctx.lineTo(value, gridY);
    }
    for (let value = -gridY; value <= gridY; value += 36) {
      ctx.moveTo(-gridX, value); ctx.lineTo(gridX, value);
    }
    ctx.stroke();
    ctx.scale(expansion, expansion);

    // Broad annular bloom behind the varying contours.
    const halo = ctx.createRadialGradient(0, 0, 118, 0, 0, 295);
    halo.addColorStop(0, blue(0));
    halo.addColorStop(.22, blue(.017 * luminosity));
    halo.addColorStop(.43, blue(.116 * luminosity));
    halo.addColorStop(.62, blue(.082 * luminosity));
    halo.addColorStop(.85, blue(.014 * luminosity));
    halo.addColorStop(1, blue(0));
    ctx.fillStyle = halo;
    ctx.fillRect(-300, -300, 600, 600);

    // Unequal independent envelopes: a few vivid curves, with dimmer folds behind them.
    // Their broad asymmetry evolves continuously; no commercial source or asset is used.
    for (let i = 0; i < curves.length; i++) {
      const points = curves[i], phase = .73 + i * 1.927;
      const rotation = time * (i % 2 ? -.041 - i * .002 : .052 + i * .003);
      const displaced = i === 0 || i === 5 || i === 9;
      const squeezeX = displaced ? 1 + .075 * Math.sin(phase + time * .16) : 1;
      const squeezeY = displaced ? 1 - .075 * Math.cos(phase * 1.2 - time * .13) : 1;
      const offsetX = Math.sin(phase * 2 + time * .14) * (displaced ? 13 : 4);
      const offsetY = Math.cos(phase + time * .1) * (displaced ? 11 : 4);
      for (let step = 0; step < pointCount; step++) {
        const angle = step / pointCount * tau;
        const turn = angle + rotation + .055 * Math.sin(angle * 2 + phase + time * .18);
        const wavePosition = step / pointCount * waveform.length;
        const waveIndex = Math.floor(wavePosition), blend = wavePosition - waveIndex;
        const waveAt = (index: number) => waveform[(index + waveform.length) % waveform.length];
        const wave = ((waveAt(waveIndex - 1) + waveAt(waveIndex) * 2 + waveAt(waveIndex + 1)) * (1 - blend)
          + (waveAt(waveIndex) + waveAt(waveIndex + 1) * 2 + waveAt(waveIndex + 2)) * blend) / 4;
        const broad = Math.sin(angle * 2 + phase + time * .31) * (14 + i % 4 * 3.7)
          + Math.sin(angle * (i % 3 === 0 ? 4 : 3) - phase * .73 - time * .23) * (5 + i % 5 * 2)
          + Math.cos(angle + phase * .8 - time * .17) * (7 + i % 3 * 2.3);
        const fold = Math.sin(angle * 5 + phase * .53 + time * .14) * 2;
        const deformation = broad * (1 + energy * motion * .36) + fold + wave * 7 * motion;
        const radial = Math.max(161, 195 + Math.sin(phase * 2.3) * 7 + deformation);
        const twist = Math.sin(angle * 2 + phase + time * .22) * 4;
        points[step * 2] = Math.cos(turn) * radial * squeezeX + Math.sin(turn) * twist + offsetX;
        points[step * 2 + 1] = Math.sin(turn) * radial * (.96 + .025 * Math.sin(phase)) * squeezeY + Math.cos(turn) * twist + offsetY;
      }
    }

    function pointOn(points: Float32Array, position: number) {
      const wrapped = ((position % 1) + 1) % 1 * pointCount;
      const index = Math.floor(wrapped), next = (index + 1) % pointCount, mix = wrapped - index;
      return [points[index * 2] * (1 - mix) + points[next * 2] * mix,
        points[index * 2 + 1] * (1 - mix) + points[next * 2 + 1] * mix];
    }

    function filament(points: Float32Array, start = 0, length = 1) {
      ctx.beginPath();
      const count = Math.max(8, Math.ceil(pointCount * length));
      for (let step = 0; step <= count; step++) {
        const [x, y] = pointOn(points, start + step / count * length);
        if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }

    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Cobalt diffusion, a soft luminous body and a thin cyan thread share each contour.
    for (const [lineWidth, alpha, blur] of [[28, .031, 30], [6.4, .11, 16], [1.25, .44, 0]]) {
      ctx.lineWidth = lineWidth;
      ctx.shadowColor = blue(.95); ctx.shadowBlur = blur + (blur ? energy * 5 : 0);
      for (let i = 0; i < curves.length; i++) {
        filament(curves[i]);
        const strength = curveStrength[i] * (.88 + .12 * Math.sin(i * 1.8 + time * .26));
        const vivid = !blur && (i === 0 || i === 5 || i === 9);
        ctx.lineWidth = vivid ? 1.5 : lineWidth;
        ctx.strokeStyle = (blur ? blue : light)(alpha * (vivid ? 1.55 : 1) * strength * luminosity);
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    // Moving light runs along the organic curves instead of orbiting outside them.
    for (const i of [0, 2, 5, 7, 9]) {
      const head = i * .173 + time * (i % 2 ? -.019 : .023);
      for (let segment = 0; segment < 3; segment++) {
        filament(curves[i], head + segment * .055, .058);
        ctx.lineWidth = 1.55 + (2 - segment) * .18;
        ctx.strokeStyle = light((.18 + segment * .17) * curveStrength[i] * luminosity);
        ctx.shadowColor = light(.9); ctx.shadowBlur = 12 + energy * 5;
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;

    for (let i = 0; i < 3; i++) {
      const [x, y] = pointOn(curves[[0, 5, 9][i]], .48 + i * .317 + time * (i % 2 ? -.025 : .027));
      const glowRadius = 34 + energy * motion * 10;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
      glow.addColorStop(0, light(.9 * luminosity));
      glow.addColorStop(.07, light(.61 * luminosity));
      glow.addColorStop(.19, blue(.4 * luminosity));
      glow.addColorStop(.46, blue(.15 * luminosity));
      glow.addColorStop(1, blue(0));
      ctx.fillStyle = glow;
      ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);
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
