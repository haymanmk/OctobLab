import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import { readColors } from './colors';
import { onThemeChange } from '../theme';
import { normal, prior } from './reverseStep';
import { chain, frameSteps, photoFrames, type Chain } from './diffusionChain';
import puppy from './puppy.jpg';

/* The two formulas of the setup, run on 1-D data and on a photo.
   Upper plot: examples walk forward from the data (left) to noise (right).
   Lower plot: fresh noise (right) walks backwards through the decoder to generated samples (left).
   The margins show the distribution at each end: bars are the particles, the outline is the exact curve.
   Above and below, a photo goes through the same two chains, every colour value of every pixel being one such line.
   Each photo frame sits over the step it belongs to. */
const Z = 3.2, BINS = 64, PHASE_MS = 3200, PX = 96;
const puppySrc = typeof puppy === 'string' ? puppy : (puppy as { src: string }).src;

/** Horizontal layout for a canvas `Wd` wide: margins for the distributions, and as many photo frames as fit. */
function layout(Wd: number) {
  const m = Math.min(70, Math.max(38, Wd * 0.13)), left = 6 + m, right = Wd - 6 - m;
  const n = Math.min(7, Math.max(3, Math.floor((right - left) / 70) + 1)), size = Math.min(76, Math.floor((right - left) / (n - 1) - 6));
  return { m, left, right, n, size };
}

interface Photo { fwd: HTMLCanvasElement[]; rev: HTMLCanvasElement[] }
/** Colour values in −1…1, three per pixel → a small canvas. Values outside the range are clipped, as on any screen. */
function toCanvas(v: Float32Array): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = cv.height = PX;
  const ctx = cv.getContext('2d')!, img = ctx.createImageData(PX, PX);
  for (let i = 0, j = 0; i < v.length; i += 3, j += 4) { img.data[j] = (v[i] + 1) * 127.5; img.data[j + 1] = (v[i + 1] + 1) * 127.5; img.data[j + 2] = (v[i + 2] + 1) * 127.5; img.data[j + 3] = 255; }
  ctx.putImageData(img, 0, 0); return cv;
}

function histogram(v: Float32Array): Float64Array {
  const h = new Float64Array(BINS), w = 2 * Z / BINS;
  for (let i = 0; i < v.length; i++) { const b = Math.floor((v[i] + Z) / w); if (b >= 0 && b < BINS) h[b] += 1 / (v.length * w); }
  return h;
}

/** `p` runs from 0 to 2: the forward chain is revealed over 0…1, the reverse chain over 1…2. */
function draw(canvas: HTMLCanvasElement, root: HTMLElement, c: Chain, p: number, photo: Photo | null) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1); const Wd = canvas.clientWidth || 300, Hd = canvas.clientHeight || 300;
  if (canvas.width !== Math.round(Wd * dpr) || canvas.height !== Math.round(Hd * dpr)) { canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(Hd * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, Wd, Hd);
  const C = readColors(root); ctx.font = '11px ' + getComputedStyle(root).fontFamily;
  const { m, left, right, n: frames, size } = layout(Wd), strip = size + 18, mid = Hd / 2, ts = frameSteps(c.T, frames);
  const X = (t: number) => left + t / c.T * (right - left);
  const stride = Math.max(1, Math.floor(c.T / (right - left)));
  const data = (z: number) => prior(z, 0), noise = (z: number) => normal(z, 0, 1);

  const panel = (y0: number, y1: number, color: string, title: string, alignRight: boolean, paths: Float32Array[], from: number, to: number,
    leftSide: { f: (z: number) => number; bars?: Float64Array; source: boolean }, rightSide: { f: (z: number) => number; bars?: Float64Array; source: boolean }) => {
    const py0 = y0 + 18, py1 = y1 - 4, Y = (z: number) => py1 - (z + Z) / (2 * Z) * (py1 - py0);
    ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = alignRight ? 'right' : 'left'; ctx.fillText(title, alignRight ? right : left, y0 + 12);
    ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.fillText('data', left - 6, y0 + 12); ctx.textAlign = 'left'; ctx.fillText('noise', right + 6, y0 + 12);
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, py0); ctx.lineTo(left, py1); ctx.moveTo(right, py0); ctx.lineTo(right, py1); ctx.stroke();

    // a distribution in the margin, growing away from the plot
    const side = (x0: number, dir: number, s: typeof leftSide, peak: number) => {
      const px = (v: number) => x0 + dir * Math.min(1, v / peak) * (m - 2);
      if (s.bars) { ctx.fillStyle = color; ctx.globalAlpha = 0.6; const bh = (py1 - py0) / BINS; for (let b = 0; b < BINS; b++) { const x = px(s.bars[b]); ctx.fillRect(Math.min(x0, x), py1 - (b + 1) * bh, Math.abs(x - x0), Math.max(1, bh - 0.5)); } ctx.globalAlpha = 1; }
      const n = Math.round(py1 - py0); ctx.beginPath(); ctx.moveTo(x0, py1);
      for (let k = 0; k <= n; k++) ctx.lineTo(px(s.f(-Z + 2 * Z * k / n)), py1 - k);
      ctx.lineTo(x0, py0);
      if (s.source) { ctx.fillStyle = C.muted; ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1.2; ctx.stroke();
    };
    side(left, -1, leftSide, 1.25); side(right, 1, rightSide, 0.5);

    if (to <= from) return;
    ctx.save(); ctx.beginPath(); ctx.rect(left, py0, right - left, py1 - py0); ctx.clip();
    ctx.strokeStyle = color; ctx.lineJoin = 'round';
    for (let i = paths.length - 1; i >= 0; i--) {
      // the first path is drawn last and bold: one example to follow
      ctx.globalAlpha = i === 0 ? 1 : 0.26; ctx.lineWidth = i === 0 ? 1.8 : 1; ctx.beginPath();
      for (let t = from; ; t = Math.min(to, t + stride)) { const x = X(t), y = Y(paths[i][t]); if (t === from) ctx.moveTo(x, y); else ctx.lineTo(x, y); if (t === to) break; }
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.restore();
  };

  const pf = Math.min(1, Math.max(0, p)), pr = Math.min(1, Math.max(0, p - 1)), kf = Math.round(pf * c.T), kr = Math.round(pr * c.T);
  panel(strip, mid, C.ok, 'forward: add noise →', false, c.fwd, 0, kf,
    { f: data, source: true }, { f: noise, bars: pf === 1 ? histogram(c.fwdEnd) : undefined, source: false });
  panel(mid, Hd - strip, C.accent, '← reverse: remove noise', true, c.rev, c.T - kr, c.T,
    { f: data, bars: pr === 1 ? histogram(c.revEnd) : undefined, source: false }, { f: noise, source: true });

  // the photo at evenly spaced steps; a frame appears when its chain reaches that step
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 1;
  const row = (y: number, labelY: number, imgs: HTMLCanvasElement[] | undefined, reached: (t: number) => boolean) => {
    for (let k = 0; k < frames; k++) {
      const x = Math.round(X(ts[k]) - size / 2);
      if (imgs && reached(ts[k])) ctx.drawImage(imgs[k], x, y, size, size);
      ctx.strokeStyle = C.line; ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      ctx.fillStyle = C.muted; ctx.fillText('t = ' + ts[k], x + size / 2, labelY);
    }
  };
  row(1, size + 13, photo?.fwd, t => t <= kf);
  row(Hd - size - 1, Hd - size - 6, photo?.rev, t => t >= c.T - kr);
}

export default function DiffusionChain({ props, active }: WidgetProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  const start = Math.log10(Number(props.beta) || 0.02);
  const [logBeta, setLogBeta] = useState(start);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!still); const [phase, setPhase] = useState(still ? 2 : 0);
  const prog = useRef(still ? 2 : 0);
  const beta = 10 ** logBeta, c = useMemo(() => chain(beta), [beta]);
  // the photo as numbers, once it has loaded, and the frames of its two chains
  const [pixels, setPixels] = useState<Float32Array | null>(null); const [width, setWidth] = useState(0);
  const frames = width ? layout(width).n : 0;
  const photo = useMemo<Photo | null>(() => {
    if (!pixels || !frames) return null;
    const f = photoFrames(pixels, beta, frames); return { fwd: f.fwd.map(toCanvas), rev: f.rev.map(toCanvas) };
  }, [pixels, beta, frames]);
  const latest = useRef({ c, photo }); latest.current = { c, photo };
  const redraw = () => { const l = latest.current; if (canvas.current && root.current) draw(canvas.current, root.current, l.c, prog.current, l.photo); };
  /** Show the finished picture, for example while the slider moves. */
  const finish = () => { prog.current = 2; setPhase(2); setPlaying(false); };

  useEffect(redraw);
  useEffect(() => {
    const ro = new ResizeObserver(() => { setWidth(canvas.current?.clientWidth || 0); redraw(); }); ro.observe(root.current!);
    const off = onThemeChange(redraw);
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = cv.height = PX;
      const ctx = cv.getContext('2d'); if (!ctx) return;
      ctx.drawImage(img, 0, 0, PX, PX);
      const d = ctx.getImageData(0, 0, PX, PX).data, v = new Float32Array(PX * PX * 3);
      for (let i = 0, j = 0; i < v.length; i += 3, j += 4) { v[i] = d[j] / 127.5 - 1; v[i + 1] = d[j + 1] / 127.5 - 1; v[i + 2] = d[j + 2] / 127.5 - 1; }
      setPixels(v);
    };
    img.src = puppySrc;
    return () => { ro.disconnect(); off(); img.onload = null; };
  }, []);
  useEffect(() => {
    if (!active || !playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      prog.current = Math.min(2, prog.current + Math.min(100, now - last) / PHASE_MS); last = now;
      redraw(); setPhase(prog.current < 1 ? 0 : prog.current < 2 ? 1 : 2);
      if (prog.current >= 2) setPlaying(false); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, playing]);

  return (
    <div ref={root} className="widget">
      <div className="wtitle">
        <span>forward and reverse chain · a photo, and 1-D data with three clusters <span className={'st' + (phase === 2 ? ' off' : '')}>· {['adding noise', 'removing noise', 'done'][phase]}</span></span>
        <span className="wb">
          <button type="button" onClick={() => { prog.current = 0; setPhase(0); setPlaying(true); }}>Replay</button>
          <button type="button" onClick={() => { setLogBeta(start); finish(); }}>Reset</button>
        </span>
      </div>
      <canvas ref={canvas} className="photo" data-photo={photo ? 'ready' : 'loading'} aria-label="Top row: a photo of a puppy turning into noise over the forward steps. Bottom row: noise turning back into the photo over the reverse steps. Between them, upper plot: sample paths from the data on the left to noise on the right, one forward step at a time. Lower plot: paths from noise on the right back to generated samples on the left, one reverse step at a time. The margins compare the particles with the exact data and noise distributions." />
      <div className="ctrls">
        <label htmlFor={id + 'b'}><span>Step size β <b>{beta.toPrecision(2)}</b></span><input id={id + 'b'} type="range" min={-2.5} max={-0.5} step={0.01} value={logBeta} onChange={e => { setLogBeta(+e.target.value); finish(); }} /></label>
      </div>
      <dl className="readout">
        <div><dt>Steps until the noise variance reaches 0.99</dt><dd><b>{c.T}</b></dd></div>
        <div><dt>Typical jump per step √β</dt><dd><b>{Math.sqrt(beta).toFixed(3)}</b></dd></div>
      </dl>
    </div>
  );
}
