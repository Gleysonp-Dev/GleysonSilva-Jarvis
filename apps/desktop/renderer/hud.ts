import type { AudioLevels, VoiceState } from './realtime';
export type HudFrame = { mode: VoiceState | 'approval'; levels: AudioLevels };

/** Original segmented HUD. No simulated telemetry or remote widget dependencies. */
export function createHud(canvas: HTMLCanvasElement, sample: () => HudFrame) {
  const c = canvas.getContext('2d');
  if (!c) return () => {};
  const ctx = c;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let w = 0, h = 0, clock = 0, last = 0, frame = 0, energy = 0;
  let backingDpi = Math.min(devicePixelRatio || 1, 1.5), slowFrames = 0;
  const tau = Math.PI * 2;
  function arc(r: number, a: number, b: number, color: string, width = 1, glow = 0) {
    ctx.beginPath(); ctx.arc(0, 0, r, a, b); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.shadowBlur = glow; ctx.shadowColor = color; ctx.stroke(); ctx.shadowBlur = 0;
  }
  function sector(r1: number, r2: number, a: number, b: number, fill: string) {
    ctx.beginPath(); ctx.arc(0, 0, r1, a, b); ctx.arc(0, 0, r2, b, a, true); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function line(x: number, y: number, x2: number, y2: number, color: string, width = 1) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function radial(r1: number, r2: number, a: number, color: string, width = 1) { line(Math.cos(a) * r1, Math.sin(a) * r1, Math.cos(a) * r2, Math.sin(a) * r2, color, width); }
  function label(text: string, x: number, y: number, size: number, color: string, spacing = 0) {
    ctx.save(); ctx.font = `500 ${size}px Bahnschrift,Segoe UI,sans-serif`; ctx.fillStyle = color; ctx.textAlign = 'center'; (ctx as any).letterSpacing = `${spacing}px`; ctx.fillText(text, x, y); ctx.restore();
  }
  function draw() {
    if (w <= 0 || h <= 0) return;
    const { mode, levels } = sample();
    const d = backingDpi;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
    ctx.save();
    for (let x = 0; x < w; x += 32) line(x, 0, x, h, '#69c5d407');
    for (let y = 0; y < h; y += 32) line(0, y, w, y, '#69c5d407');
    for (let j = 0; j < 12; j++) {
      const x = (j * 137 + 23) % w, y = (j * 83 + 47) % h;
      ctx.strokeStyle = '#6da9b512'; ctx.strokeRect(x, y, 34 + (j % 4) * 13, 19 + (j % 3) * 9);
      for (let k = 0; k < 4; k++) line(x + 5, y + 6 + k * 3, x + 21, y + 6 + k * 3, '#7ec1c510');
    }
    ctx.restore();
    const R = Math.min(w * .44, h * .43, 315), scale = R / 277;
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.scale(scale, scale);
    let target = 0;
    if (mode === 'listen') target = .07 + Math.min(.9, levels.mic);
    if (mode === 'speak') target = .13 + Math.min(.87, levels.speaker);
    if (mode === 'execute') target = .23 + .45 * Math.pow(.5 - .5 * Math.cos(clock * tau * .65), 2);
    if (mode === 'think' || mode === 'connecting') target = .13 + .16 * (.5 - .5 * Math.cos(clock * tau * .45));
    if (mode === 'approval') target = .1;
    if (reduced.matches) target = 0;
    energy += (target - energy) * .19;
    const breath = 1 + energy * .035, p = .72 + energy * .95;
    ctx.save(); ctx.scale(breath, breath);
    const halo = ctx.createRadialGradient(0, 0, 70, 0, 0, 316);
    halo.addColorStop(0, `rgba(91,211,228,${.015 + energy * .04})`); halo.addColorStop(.55, `rgba(54,182,202,${.055 * p})`); halo.addColorStop(.82, `rgba(87,211,224,${.055 * p})`); halo.addColorStop(1, '#57dae300');
    ctx.fillStyle = halo; ctx.fillRect(-330, -330, 660, 660);
    if (energy > .11 && !reduced.matches && mode !== 'approval') {
      for (let j = 0; j < 2; j++) { const phase = (clock * .6 + j * .5) % 1; arc(230 + phase * 72, 0, tau, `rgba(150,239,248,${(1 - phase) * .16 * energy})`, 1.1, 5); }
    }
    for (const r of [34, 56, 63, 96, 101, 131, 139, 147]) arc(r, 0, tau, '#73d5dc15', .7);
    for (let j = 0; j < 36; j++) radial(42, 146, j * Math.PI / 18, j % 3 ? '#80d4dd0b' : '#80d4dd20', .7);
    for (let j = 0; j < 12; j++) { const a = j * Math.PI / 6 + clock * .018; arc(121, a, a + .19, '#9cdfe629', 2); radial(125, 133, a, '#79d0d746', .6); }
    line(-158, 0, 158, 0, '#92edf115', .8); line(0, -158, 0, 158, '#92edf115', .8);
    ctx.save(); ctx.rotate(clock * .018);
    for (let j = 0; j < 64; j++) {
      const a = j * Math.PI / 32 - .03;
      if ((j > 18 && j < 24) || (j > 43 && j < 47)) continue;
      sector(230, 194, a + .003, a + .087, j % 8 === 0 ? '#8cdee36b' : `rgba(86,176,197,${.31 + .09 * Math.sin(j * .23)})`); radial(196, 228, a, '#c8ffff27', .6);
    }
    arc(232, .1, 2.1, '#a5f6f456'); arc(232, 2.7, 5.95, '#8ee7ed4f'); ctx.restore();
    arc(273, .04, 2.26, '#8be4e6a0', 3.6, 5); arc(273, 2.45, 4.17, '#a3f4f4ad', 4.2, 7); arc(273, 4.43, 6.18, '#80e1e49c', 4.4, 6);
    arc(277, 3.6, 4.65, '#b5fdff2c', .7); arc(266, 0, tau, '#5cbac13a', .8);
    ctx.save(); ctx.rotate(-clock * .026);
    for (let j = 0; j < 100; j++) radial(j % 5 ? 243 : 235, 260, j * Math.PI / 50, j % 5 ? '#8bdde77d' : '#bbfbffa3', j % 5 ? .8 : 1.5);
    for (let j = 0; j < 6; j++) { const a = j * Math.PI / 3 + .2; sector(276, 264, a, a + .14, '#a4e9e9a8'); for (let k = 0; k < 5; k++) radial(267, 274, a + .02 + k * .024, '#05202d', 2); }
    ctx.restore(); ctx.save(); ctx.rotate(clock * .035);
    for (let j = 0; j < 184; j++) radial(182, j % 6 ? 188 : 192, j * Math.PI / 92, j % 6 ? '#a4edf66a' : '#c4fcffad', .7);
    ctx.restore(); arc(179, 0, tau, '#91e4e633', 1.1); arc(172, 0, tau, '#78d3dc35', 2.3);
    ctx.save(); ctx.rotate(-clock * .046);
    for (const [a, b] of [[.06, 1.44], [1.65, 3.1], [3.35, 4.74], [5, 6.1]]) { arc(165, a, b, `rgba(152,239,240,${Math.min(1, .65 * p)})`, 5.8, 9 * p); arc(163, a + .02, b - .03, '#d3ffff8c', .8, 2); }
    for (const a of [.04, 1.48, 1.64, 3.14, 3.32, 4.78, 4.98, 6.13]) radial(159, 172, a, '#92e6ee80', 4);
    ctx.restore();
    const markerStart = mode === 'execute' ? clock * .34 : 2.8 + Math.sin(clock * .13) * .06;
    arc(191, markerStart, markerStart + .7, '#93e2e2b0', 2.8, 4); arc(187, markerStart + .7, markerStart + .91, '#c3ffff66', 1.2, 2);
    for (let j = 0; j < 5; j++) { const a = -1.95 + j * .18; ctx.beginPath(); ctx.arc(Math.cos(a) * 183, Math.sin(a) * 183, 2.4, 0, tau); ctx.fillStyle = '#9ce4e5a0'; ctx.fill(); }
    ctx.save(); ctx.rotate(clock * .012); arc(81, .2, 2.43, '#79bfc432', 1.5); arc(81, 2.9, 5.9, '#79bfc42e'); for (let j = 0; j < 60; j++) radial(65, 69, j * Math.PI / 30, '#a7e5e72b', .6); ctx.restore(); ctx.restore();
    const strip = ctx.createLinearGradient(-159, 0, 159, 0); strip.addColorStop(0, '#04151b00'); strip.addColorStop(.17, '#04151bf5'); strip.addColorStop(.83, '#04151bf5'); strip.addColorStop(1, '#04151b00'); ctx.fillStyle = strip; ctx.fillRect(-159, -26, 318, 54);
    ctx.save(); ctx.shadowColor = '#a4f5f7'; ctx.shadowBlur = 9 * p; label('J.A.R.V.I.S.', 0, 13, 36, '#effbff', 2.7); ctx.restore();
    label('PERSONAL INTELLIGENCE', 0, 39, 7.8, '#80c5cf', 1.8);
    for (let j = 0; j < 41; j++) { const x = (j - 20) * 3.6, amp = 1.3 + Math.min(1, (levels.wave[j] || 0) * 8) * 26; line(x, 87 - amp / 2, x, 87 + amp / 2, energy > .12 ? '#a4f5f7' : '#72bdc35b', 1.5); }
    for (const [x, y, s] of [[-250, 125, 1], [246, -114, -1]]) { line(x, y, x + 18 * s, y, '#72c6ce6a'); line(x + 18 * s, y, x + 36 * s, y - 19, '#72c6ce6a'); ctx.strokeStyle = '#71b7c34a'; ctx.lineWidth = .7; ctx.strokeRect(x + 36 * s - 3, y - 22, 6, 6); }
    ctx.restore();
  }
  const observer = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nextWidth = Math.round(rect.width * backingDpi), nextHeight = Math.round(rect.height * backingDpi);
    if (w === rect.width && h === rect.height && canvas.width === nextWidth && canvas.height === nextHeight) return;
    w = rect.width; h = rect.height; canvas.width = nextWidth; canvas.height = nextHeight; draw();
  });
  observer.observe(canvas);
  function animate(ms: number) {
    const state = sample();
    const interval = 1000 / (state.mode === 'idle' || state.mode === 'approval' || reduced.matches ? 15 : 30);
    if (!last || ms - last >= interval) {
      const dt = last ? Math.min((ms - last) / 1000, .1) : 0; last = ms;
      if (!document.hidden && w > 0 && h > 0) {
        if (!reduced.matches) clock += dt;
        const started = performance.now(); draw();
        slowFrames = performance.now() - started > 20 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (slowFrames >= 3 && backingDpi > 1) { backingDpi = 1; canvas.width = Math.round(w); canvas.height = Math.round(h); slowFrames = 0; }
      }
    }
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);
  return () => { observer.disconnect(); cancelAnimationFrame(frame); };
}
