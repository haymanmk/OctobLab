import { useEffect, useId, useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import { readColors } from './colors';
import { onThemeChange } from '../theme';
import { CYCLE, TICK, design, eig, freshArm, gauss, inertia, phase, tick, type Arm, type Vec } from './gearedArm';

/* Two copies of the same arm run side by side: A subtracts the observer's estimate from the torque, B does not.
   The history holds one full cycle at 250 Hz. */
const N = 2000, SAMPLE = CYCLE / N, Q2DOT_MAX = 1.5;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

interface Hist { d: Float32Array; dh: Float32Array; eA: Float32Array; eB: Float32Array }
interface Dwell { sumA: Vec; sumB: Vec; n: number; lastA: Vec | null; lastB: Vec | null }
interface Sim { t: number; sampleT: number; A: Arm; B: Arm; i: number; count: number; h: [Hist, Hist]; dwell: Float32Array; dw: Dwell }
const hist = (): Hist => ({ d: new Float32Array(N), dh: new Float32Array(N), eA: new Float32Array(N), eB: new Float32Array(N) });
const fresh = (): Sim => ({ t: 0, sampleT: 0, A: freshArm(), B: freshArm(), i: 0, count: 0, h: [hist(), hist()], dwell: new Float32Array(N), dw: { sumA: [0, 0], sumB: [0, 0], n: 0, lastA: null, lastB: null } });

interface Params { beta: number; ratio: number; cog: number; sigma: number }

function step(s: Sim, p: Params) {
  const y = design(p.beta, Q2DOT_MAX).y;
  const common = { y, gravityRatio: p.ratio, cogAmp: p.cog };
  tick(s.A, s.t, { ...common, useDob: true }, [p.sigma * gauss(), p.sigma * gauss()]);
  tick(s.B, s.t, { ...common, useDob: false }, [p.sigma * gauss(), p.sigma * gauss()]);
  // Holding error: mean |error| over the second half of each hold, after the settling transient.
  const ph = phase(s.t), ph2 = phase(s.t + 0.75), late = ph.dwell && !ph2.dwell, dw = s.dw;
  if (late) { for (let j = 0; j < 2; j++) { dw.sumA[j] += Math.abs(s.A.err[j]); dw.sumB[j] += Math.abs(s.B.err[j]); } dw.n++; }
  else if (dw.n) { dw.lastA = [dw.sumA[0] / dw.n, dw.sumA[1] / dw.n]; dw.lastB = [dw.sumB[0] / dw.n, dw.sumB[1] / dw.n]; dw.sumA = [0, 0]; dw.sumB = [0, 0]; dw.n = 0; }
  s.t += TICK;
  if (s.t >= s.sampleT) {
    for (let j = 0; j < 2; j++) { const h = s.h[j]; h.d[s.i] = s.A.d[j]; h.dh[s.i] = s.A.dhat[j]; h.eA[s.i] = s.A.err[j] * 1e3; h.eB[s.i] = s.B.err[j] * 1e3; }
    s.dwell[s.i] = ph.dwell ? 1 : 0; s.i = (s.i + 1) % N; s.count = Math.min(N, s.count + 1); s.sampleT += SAMPLE;
  }
}

const HEIGHT = 300;
function draw(canvas: HTMLCanvasElement, s: Sim, root: HTMLElement, joint: number) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1), Wd = canvas.clientWidth || 300;
  if (canvas.width !== Math.round(Wd * dpr) || canvas.height !== Math.round(HEIGHT * dpr)) { canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(HEIGHT * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, Wd, HEIGHT);
  const C = readColors(root), font = getComputedStyle(root).fontFamily, left = 46, right = Wd - 10, mid = HEIGHT / 2;
  const cnt = s.count, start = (s.i - cnt + N) % N, X = (k: number) => right - (cnt - 1 - k) * (right - left) / (N - 1);
  const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2));
  const nice = (v: number) => { const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
  const span = (arrs: Float32Array[], floor: number) => { let m = floor; for (const a of arrs) for (let k = 0; k < cnt; k++) m = Math.max(m, Math.abs(a[(start + k) % N])); return nice(m * 1.1); };

  const panel = (y0: number, y1: number, m: number, series: { arr: Float32Array; c: string; w: number }[], title: string, legend: { t: string; c: string }[]) => {
    const py0 = y0 + 18, py1 = y1 - 6, Y = (v: number) => py1 - (clamp(v, -m, m) + m) / (2 * m) * (py1 - py0);
    // Shade the holds, so the eye finds the part of the cycle where the arm should be standing still.
    ctx.fillStyle = C.line; ctx.globalAlpha = 0.45;
    let run = -1;
    for (let k = 0; k <= cnt; k++) {
      const on = k < cnt && s.dwell[(start + k) % N] > 0;
      if (on && run < 0) run = k;
      if (!on && run >= 0) { ctx.fillRect(X(run), py0, X(k - 1) - X(run), py1 - py0); run = -1; }
    }
    ctx.globalAlpha = 1;
    ctx.font = '11px ' + font; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(left, Y(0)); ctx.lineTo(right, Y(0)); ctx.moveTo(left, py0); ctx.lineTo(left, py1); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmt(m), left - 5, py0 + 4); ctx.fillText(fmt(-m), left - 5, py1 - 4); ctx.fillText('0', left - 5, Y(0));
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(title, left, y0 + 12);
    let lx = right; ctx.textAlign = 'right';
    for (let i = legend.length - 1; i >= 0; i--) { ctx.fillStyle = legend[i].c; ctx.fillText(legend[i].t, lx, y0 + 12); lx -= ctx.measureText(legend[i].t).width + 14; }
    for (const { arr, c, w } of series) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      for (let k = 0; k < cnt; k++) { const v = arr[(start + k) % N]; if (k === 0) ctx.moveTo(X(k), Y(v)); else ctx.lineTo(X(k), Y(v)); }
      ctx.stroke();
    }
  };
  const h = s.h[joint];
  panel(0, mid, span([h.d, h.dh], 1), [{ arr: h.d, c: C.muted, w: 1.1 }, { arr: h.dh, c: C.accent, w: 1.6 }], `joint ${joint + 1} disturbance  N·m`, [{ t: 'true', c: C.muted }, { t: 'estimate', c: C.accent }]);
  panel(mid, HEIGHT, span([h.eA, h.eB], 0.5), [{ arr: h.eB, c: C.muted, w: 1.2 }, { arr: h.eA, c: C.accent, w: 1.6 }], 'position error  mrad', [{ t: 'no observer', c: C.muted }, { t: 'with', c: C.accent }]);
}

const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && v !== undefined && v !== null && v !== '' ? Number(v) : fallback);

export default function NdobDesignSim({ props, active }: WidgetProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>(fresh());
  const [beta, setBeta] = useState(num(props.beta, 20));
  const [ratio, setRatio] = useState(num(props.ratio, 0.9));
  const [cog, setCog] = useState(num(props.cogging, 1));
  const [sigma, setSigma] = useState(num(props.noise, 0.002));
  const [joint, setJoint] = useState(0);
  const [paused, setPaused] = useState(false);
  const [, bump] = useState(0);
  const live = useRef({ beta, ratio, cog, sigma, joint }); live.current = { beta, ratio, cog, sigma, joint };
  const running = active && !paused;
  const redraw = () => { if (canvas.current && root.current) draw(canvas.current, sim.current, root.current, live.current.joint); };

  useEffect(() => {
    if (!running) { redraw(); return; }
    let raf = 0, last = 0, frames = 0;
    const loop = (ts: number) => {
      const dt = last ? clamp((ts - last) / 1000, 0, 0.05) : 0.016; last = ts;
      for (let i = 0, n = Math.round(dt / TICK); i < n; i++) step(sim.current, live.current);
      redraw();
      if (++frames % 20 === 0) bump(x => x + 1);   // refresh the numbers under the plot a few times a second
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  useEffect(() => {
    const ro = new ResizeObserver(redraw); ro.observe(root.current!);
    const off = onThemeChange(redraw);
    return () => { ro.disconnect(); off(); };
  }, []);
  useEffect(redraw, [joint]);

  const D = design(beta, Q2DOT_MAX), ev = eig(inertia(sim.current.A.q[1])), dw = sim.current.dw;
  const mrad = (v: Vec | null) => (v ? (v[joint] * 1e3).toFixed(2) + ' mrad' : '…');
  const status = paused ? '○ paused' : active ? '● live' : '○ off screen, paused';
  return (
    <div ref={root} className="widget">
      <div className="wtitle">
        <span className={'st' + (running ? '' : ' off')}>{status}</span>
        <span>2-joint geared arm · NDOB · 1 kHz</span>
        <span className="wb">
          {[0, 1].map(j => <button key={j} type="button" aria-pressed={joint === j} onClick={() => setJoint(j)}>Joint {j + 1}</button>)}
          <button type="button" onClick={() => setPaused(p => !p)}>{paused ? 'Run' : 'Pause'}</button>
          <button type="button" onClick={() => { sim.current = fresh(); bump(x => x + 1); redraw(); }}>Reset</button>
        </span>
      </div>
      <canvas ref={canvas} className="tall" aria-label="Lumped disturbance and its estimate, and the position error with and without the observer, over the last cycle" />
      <dl className="readout">
        <div><dt>Design</dt><dd>y = ζ/2 + β·σ₂ = {(D.zeta / 2).toFixed(2)} + {beta}·{D.sigma2.toFixed(2)} = <b>{D.y.toFixed(1)}</b></dd></div>
        <div><dt>Error poles now</dt><dd><b>{(D.y / ev.max).toFixed(0)}</b> to <b>{(D.y / ev.min).toFixed(0)}</b> rad/s <span>(guaranteed ≥ {beta})</span></dd></div>
        <div><dt>Holding error, last hold</dt><dd><b>{mrad(dw.lastA)}</b> with · {mrad(dw.lastB)} without</dd></div>
      </dl>
      <div className="ctrls">
        <label htmlFor={id + 'b'}><span>Convergence rate β <b>{beta} rad/s</b></span><input id={id + 'b'} type="range" min={1} max={100} step={1} value={beta} onChange={e => setBeta(+e.target.value)} /></label>
        <label htmlFor={id + 'r'}><span>Gravity compensation ratio <b>{ratio.toFixed(2)}</b></span><input id={id + 'r'} type="range" min={0.7} max={1.3} step={0.01} value={ratio} onChange={e => setRatio(+e.target.value)} /></label>
        <label htmlFor={id + 'c'}><span>Cogging amplitude <b>{cog.toFixed(1)} N·m</b></span><input id={id + 'c'} type="range" min={0} max={4} step={0.1} value={cog} onChange={e => setCog(+e.target.value)} /></label>
        <label htmlFor={id + 'n'}><span>Velocity noise σ <b>{sigma.toFixed(3)} rad/s</b></span><input id={id + 'n'} type="range" min={0} max={0.02} step={0.001} value={sigma} onChange={e => setSigma(+e.target.value)} /></label>
      </div>
    </div>
  );
}
