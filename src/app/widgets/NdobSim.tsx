import { useEffect, useId, useRef, useState } from 'react';
import type { WidgetProps } from './registry';
import { readColors } from './colors';
import { onThemeChange } from '../theme';

/* One joint, scalar nonlinear disturbance observer, 1 kHz forward Euler.
   A: with the DOB cancelling d̂.  B: the same controller without it. */
const J = 0.02, B = 0.05, KP = 40, KD = 1.2, SAT = 2, W = 1.5, N = 600;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dist = (t: number, v: number) => 0.35 * ((Math.floor(t / 2) & 1) ? 1 : 0) + 0.1 * Math.sin(7 * t) + 0.08 * Math.tanh(v / 0.02);
function gauss() { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }

interface Sim { t: number; sampleT: number; A: { q: number; v: number; z: number }; B: { q: number; v: number }; i: number; count: number; d: Float32Array; dh: Float32Array; eA: Float32Array; eB: Float32Array }
const fresh = (): Sim => ({ t: 0, sampleT: 0, A: { q: 0, v: 0, z: 0 }, B: { q: 0, v: 0 }, i: 0, count: 0, d: new Float32Array(N), dh: new Float32Array(N), eA: new Float32Array(N), eB: new Float32Array(N) });

function step(s: Sim, h: number, L: number, sigma: number) {
  const t = s.t, qr = 0.5 * Math.sin(W * t), vr = 0.5 * W * Math.cos(W * t), ar = -0.5 * W * W * Math.sin(W * t);
  let d = 0, dh = 0, eA = 0, eB = 0;
  { const a = s.A; d = dist(t, a.v); const vm = a.v + sigma * gauss(); const u = KP * (qr - a.q) + KD * (vr - vm) + J * ar + B * vr; dh = a.z + L * J * vm; const tau = clamp(u - dh, -SAT, SAT); a.z += h * (-L * a.z - L * (tau - B * vm + L * J * vm)); a.v += h * (tau - B * a.v + d) / J; a.q += h * a.v; eA = qr - a.q; }
  { const b = s.B; const d2 = dist(t, b.v); const vm = b.v + sigma * gauss(); const u = KP * (qr - b.q) + KD * (vr - vm) + J * ar + B * vr; const tau = clamp(u, -SAT, SAT); b.v += h * (tau - B * b.v + d2) / J; b.q += h * b.v; eB = qr - b.q; }
  s.t += h;
  if (s.t >= s.sampleT) { s.d[s.i] = d; s.dh[s.i] = dh; s.eA[s.i] = eA; s.eB[s.i] = eB; s.i = (s.i + 1) % N; s.count = Math.min(N, s.count + 1); s.sampleT += 0.01; }
}

function draw(canvas: HTMLCanvasElement, s: Sim, root: HTMLElement) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1); const Wd = canvas.clientWidth || 300, Hd = 240;
  if (canvas.width !== Math.round(Wd * dpr) || canvas.height !== Math.round(Hd * dpr)) { canvas.width = Math.round(Wd * dpr); canvas.height = Math.round(Hd * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, Wd, Hd);
  const C = readColors(root); const font = getComputedStyle(root).fontFamily; const left = 46, right = Wd - 10, mid = Hd / 2;
  const fmt = (v: number) => Math.abs(v) >= 0.1 ? v.toFixed(1) : v.toFixed(3);
  const panel = (y0: number, y1: number, lo: number, hi: number, series: { arr: Float32Array; c: string; w: number }[], title: string, legend: { t: string; c: string }[]) => {
    const py0 = y0 + 16, py1 = y1 - 6; const Y = (v: number) => py1 - (clamp(v, lo, hi) - lo) / (hi - lo) * (py1 - py0);
    ctx.font = '11px ' + font; ctx.strokeStyle = C.line; ctx.lineWidth = 1;
    ctx.beginPath(); for (let k = 0; k <= 6; k++) { const x = left + (right - left) * k / 6; ctx.moveTo(x, py0); ctx.lineTo(x, py1); } ctx.stroke();
    ctx.beginPath(); ctx.moveTo(left, Y(0)); ctx.lineTo(right, Y(0)); ctx.stroke();
    ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmt(hi), left - 5, py0 + 4); ctx.fillText(fmt(lo), left - 5, py1 - 4); ctx.fillText('0', left - 5, Y(0));
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(title, left, y0 + 11);
    let lx = right; ctx.textAlign = 'right';
    for (let i = legend.length - 1; i >= 0; i--) { ctx.fillStyle = legend[i].c; ctx.fillText(legend[i].t, lx, y0 + 11); lx -= ctx.measureText(legend[i].t).width + 14; }
    for (const { arr, c, w } of series) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath();
      const cnt = s.count, start = (s.i - cnt + N) % N;
      for (let k = 0; k < cnt; k++) { const v = arr[(start + k) % N]; const x = right - (cnt - 1 - k) * (right - left) / (N - 1); if (k === 0) ctx.moveTo(x, Y(v)); else ctx.lineTo(x, Y(v)); }
      ctx.stroke();
    }
  };
  panel(0, mid, -0.3, 0.7, [{ arr: s.d, c: C.muted, w: 1.2 }, { arr: s.dh, c: C.accent, w: 1.6 }], 'disturbance  N·m', [{ t: 'd true', c: C.muted }, { t: 'd̂ estimate', c: C.accent }]);
  let m = 0.004; for (let k = 0; k < s.count; k++) m = Math.max(m, Math.abs(s.eA[k]), Math.abs(s.eB[k]));
  m = Math.ceil(m * 1.15 * 1000) / 1000;
  panel(mid, Hd, -m, m, [{ arr: s.eB, c: C.muted, w: 1.2 }, { arr: s.eA, c: C.accent, w: 1.6 }], 'tracking error  rad   ·   last 6 s', [{ t: 'without DOB', c: C.muted }, { t: 'with DOB', c: C.accent }]);
}

export default function NdobSim({ props, active }: WidgetProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null); const canvas = useRef<HTMLCanvasElement>(null);
  const sim = useRef<Sim>(fresh());
  const [L, setL] = useState(Number(props.gain) || 30);
  const [sigma, setSigma] = useState(Number(props.noise) || 0.05);
  const [paused, setPaused] = useState(false);
  const [, bump] = useState(0);
  const params = useRef({ L, sigma }); params.current = { L, sigma };
  const running = active && !paused;

  useEffect(() => {
    const c = canvas.current!, r = root.current!;
    if (!running) { draw(c, sim.current, r); return; }
    let raf = 0, last = 0;
    const tick = (ts: number) => { const dt = last ? clamp((ts - last) / 1000, 0, 0.05) : 0.016; last = ts; const n = Math.round(dt / 0.001); for (let i = 0; i < n; i++) step(sim.current, 0.001, params.current.L, params.current.sigma); draw(c, sim.current, r); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  useEffect(() => {
    const c = canvas.current!, r = root.current!;
    const ro = new ResizeObserver(() => draw(c, sim.current, r)); ro.observe(r);
    const off = onThemeChange(() => draw(c, sim.current, r));
    return () => { ro.disconnect(); off(); };
  }, []);

  const status = paused ? '○ paused' : active ? '● live' : '○ off screen, paused';
  return (
    <div ref={root} className="widget">
      <div className="wtitle">
        <span className={'st' + (running ? '' : ' off')}>{status}</span>
        <span>1-DoF joint · scalar NDOB · 1 kHz</span>
        <span className="wb">
          <button type="button" onClick={() => setPaused(p => !p)}>{paused ? 'Run' : 'Pause'}</button>
          <button type="button" onClick={() => { sim.current = fresh(); bump(x => x + 1); draw(canvas.current!, sim.current, root.current!); }}>Reset</button>
        </span>
      </div>
      <canvas ref={canvas} aria-label="Disturbance estimate and tracking error over the last 6 seconds" />
      <div className="ctrls">
        <label htmlFor={id + 'L'}><span>Observer gain L <b>{L} rad/s</b></span><input id={id + 'L'} type="range" min={2} max={150} step={1} value={L} onChange={e => setL(+e.target.value)} /></label>
        <label htmlFor={id + 'N'}><span>Velocity noise σ <b>{sigma.toFixed(3)} rad/s</b></span><input id={id + 'N'} type="range" min={0} max={0.2} step={0.005} value={sigma} onChange={e => setSigma(+e.target.value)} /></label>
      </div>
    </div>
  );
}
