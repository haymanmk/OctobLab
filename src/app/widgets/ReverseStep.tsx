import { useEffect, useId, useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import { readColors } from './colors';
import { onThemeChange } from '../theme';
import { likelihood, prior, reverse, windowOf, type Reverse } from './reverseStep';

/* One reverse step of a 1-D diffusion model.
   Top: the two factors of Bayes' rule and their product, over the whole axis.
   Bottom: the product (the true reverse distribution) zoomed in, against the normal curve that fits it best. */
const X0 = -3, X1 = 3;

function draw(canvas: HTMLCanvasElement, root: HTMLElement, zt: number, beta: number, noise: number, r: Reverse) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1); const Wd = canvas.clientWidth || 300, Hd = canvas.clientHeight || 300;
  if (canvas.width !== Math.round(Wd * dpr) || canvas.height !== Math.round(Hd * dpr)) { canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(Hd * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, Wd, Hd);
  const C = readColors(root); const font = getComputedStyle(root).fontFamily; const left = 12, right = Wd - 12, mid = Hd / 2;
  ctx.font = '11px ' + font;

  /** A curve is scaled to its own peak unless `peak` gives a scale shared with other curves. */
  type Series = { f: (x: number) => number; c: string; w: number; dash?: number[]; fill?: boolean; peak?: number };
  const panel = (y0: number, y1: number, lo: number, hi: number, series: Series[], title: string, legend: { t: string; c: string }[], band?: [number, number]) => {
    const py0 = y0 + 20, py1 = y1 - 18, n = Math.max(2, Math.round((right - left) * 2));
    const X = (x: number) => left + (x - lo) / (hi - lo) * (right - left);
    if (band) { ctx.fillStyle = C.line; ctx.globalAlpha = 0.55; ctx.fillRect(X(Math.max(lo, band[0])), py0, X(Math.min(hi, band[1])) - X(Math.max(lo, band[0])), py1 - py0); ctx.globalAlpha = 1; }
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(left, py1 + 0.5); ctx.lineTo(right, py1 + 0.5); ctx.stroke();
    // axis ticks: about six round numbers
    const raw = (hi - lo) / 6, mag = 10 ** Math.floor(Math.log10(raw)), stepv = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw)!;
    ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let v = Math.ceil(lo / stepv) * stepv; v <= hi + 1e-9; v += stepv) {
      const x = X(v); if (x < left + 14 || x > right - 14) continue;
      ctx.beginPath(); ctx.moveTo(x, py1); ctx.lineTo(x, py1 + 4); ctx.stroke();
      ctx.fillText((Math.abs(v) < 1e-9 ? 0 : v).toFixed(Math.max(0, -Math.floor(Math.log10(stepv)))), x, py1 + 5);
    }
    let lx = right; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right';
    for (let i = legend.length - 1; i >= 0; i--) { ctx.fillStyle = legend[i].c; ctx.fillText(legend[i].t, lx, y0 + 12); lx -= ctx.measureText(legend[i].t).width + 12; }
    // the title gives way to the legend on a narrow screen
    if (ctx.measureText(title).width < lx - left) { ctx.fillStyle = C.muted; ctx.textAlign = 'left'; ctx.fillText(title, left, y0 + 12); }
    for (const s of series) {
      const ys = new Float64Array(n); let peak = 1e-300;
      for (let k = 0; k < n; k++) { ys[k] = s.f(lo + (hi - lo) * k / (n - 1)); peak = Math.max(peak, ys[k]); }
      const scale = s.peak ?? peak;
      ctx.beginPath();
      for (let k = 0; k < n; k++) { const x = left + (right - left) * k / (n - 1), y = py1 - ys[k] / scale * (py1 - py0); if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      if (s.fill) { ctx.lineTo(right, py1); ctx.lineTo(left, py1); ctx.closePath(); ctx.fillStyle = s.c; ctx.globalAlpha = 0.14; ctx.fill(); ctx.globalAlpha = 1; }
      else { ctx.strokeStyle = s.c; ctx.lineWidth = s.w; ctx.setLineDash(s.dash ?? []); ctx.stroke(); ctx.setLineDash([]); }
    }
  };

  const [lo, hi] = r.view, g0 = r.z[0], g1 = r.z[r.z.length - 1];
  const product = (x: number) => prior(x, noise) * likelihood(x, zt, beta);
  panel(0, mid, X0, X1, [
    { f: x => prior(x, noise), c: C.muted, w: 1, fill: true }, { f: x => prior(x, noise), c: C.muted, w: 1.3 },
    { f: x => likelihood(x, zt, beta), c: C.ok, w: 1.5 }, { f: product, c: C.accent, w: 1.8 },
  ], 'curves scaled to equal height', [{ t: 'common values', c: C.muted }, { t: 'window', c: C.ok }, { t: 'product', c: C.accent }], [lo, hi]);

  // The lower panel shares one vertical scale, so the two curves can be compared directly.
  const at = (arr: Float64Array) => (x: number) => { const u = (x - g0) / (g1 - g0) * (arr.length - 1), i = Math.min(arr.length - 2, Math.max(0, Math.floor(u))); return arr[i] + (arr[i + 1] - arr[i]) * (u - i); };
  let top = 0; for (let i = 0; i < r.post.length; i++) top = Math.max(top, r.post[i], r.fit[i]);
  panel(mid, Hd, lo, hi, [{ f: at(r.post), c: C.accent, w: 1.8, peak: top }, { f: at(r.fit), c: C.fg, w: 1.3, dash: [5, 4], peak: top }],
    'zoom on the shaded part', [{ t: 'true reverse step', c: C.accent }, { t: 'best normal curve', c: C.fg }]);
}

export default function ReverseStep({ props }: WidgetProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  const [logBeta, setLogBeta] = useState(Math.log10(Number(props.beta) || 0.2));
  const [zt, setZt] = useState(props.zt === undefined ? -0.5 : Number(props.zt));
  const [noise, setNoise] = useState(props.noise === undefined ? 0.1 : Number(props.noise));
  const beta = 10 ** logBeta, r = reverse(zt, beta, noise), win = windowOf(zt, beta);
  const latest = useRef({ zt, beta, noise, r }); latest.current = { zt, beta, noise, r };
  const redraw = () => { const l = latest.current; if (canvas.current && root.current) draw(canvas.current, root.current, l.zt, l.beta, l.noise, l.r); };

  useEffect(redraw);
  useEffect(() => {
    const ro = new ResizeObserver(redraw); ro.observe(root.current!);
    const off = onThemeChange(redraw);
    return () => { ro.disconnect(); off(); };
  }, []);

  const pct = 100 * r.mismatch;
  return (
    <div ref={root} className="widget">
      <div className="wtitle">
        <span>one reverse step · 1-D data with three clusters</span>
        <span className="wb"><button type="button" onClick={() => { setLogBeta(Math.log10(0.2)); setZt(-0.5); setNoise(0.1); }}>Reset</button></span>
      </div>
      <canvas ref={canvas} className="tall" aria-label="Top: the distribution of the previous value, the window set by the step size, and their product. Bottom: the product compared with the best-fitting normal curve." />
      <div className="ctrls">
        <label htmlFor={id + 'b'}><span>Step size β <b>{beta.toPrecision(2)}</b></span><input id={id + 'b'} type="range" min={-3} max={-0.3} step={0.01} value={logBeta} onChange={e => setLogBeta(+e.target.value)} /></label>
        <label htmlFor={id + 'z'}><span>Observed value zₜ <b>{zt.toFixed(2)}</b></span><input id={id + 'z'} type="range" min={-2.5} max={2.5} step={0.05} value={zt} onChange={e => setZt(+e.target.value)} /></label>
        <label htmlFor={id + 'n'}><span>Noise already added <b>{noise.toFixed(2)}</b></span><input id={id + 'n'} type="range" min={0} max={0.95} step={0.01} value={noise} onChange={e => setNoise(+e.target.value)} /></label>
      </div>
      <dl className="readout">
        <div><dt>Mismatch with the best normal curve</dt><dd><b>{pct < 0.05 ? 'under 0.1' : pct.toFixed(1)} %</b></dd></div>
        <div><dt>Window width √(β/(1−β))</dt><dd><b>{win.sd.toFixed(3)}</b></dd></div>
        <div><dt>Spread of the true reverse step</dt><dd><b>{r.sd.toFixed(3)}</b></dd></div>
        <div><dt>Mean: true / predicted by the ramp rule</dt><dd><b>{r.mean.toFixed(3)}</b> / {Math.abs(r.predMean) > 99 ? 'far off' : r.predMean.toFixed(3)}</dd></div>
      </dl>
    </div>
  );
}
