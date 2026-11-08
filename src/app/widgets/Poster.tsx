import { useEffect, useRef } from 'react';
import { readColors } from './colors';
import { onThemeChange } from '../theme';

/** Static stand-in drawn on a collapsed card; the live widget mounts only when the card is expanded or read. */
export function Poster() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const paint = () => {
      const ctx = c.getContext('2d'); if (!ctx) return; const W = c.width, H = c.height; const C = readColors(c);
      ctx.clearRect(0, 0, W, H); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 1; i < 6; i++) { ctx.moveTo(W * i / 6, 10); ctx.lineTo(W * i / 6, H - 10); } ctx.moveTo(20, H * .6); ctx.lineTo(W - 10, H * .6); ctx.stroke();
      const sq = (t: number) => (Math.floor(t * 1.5) & 1 ? 1 : 0) * 0.5 + 0.15 * Math.sin(t * 9);
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.muted; ctx.beginPath();
      for (let x = 20; x < W - 10; x++) { const t = x / W * 4; const y = H * .6 - sq(t) * H * .55; x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
      ctx.strokeStyle = C.accent; ctx.beginPath(); let f = 0;
      for (let x = 20; x < W - 10; x++) { const t = x / W * 4; f += (sq(t) - f) * 0.06; const y = H * .6 - f * H * .55; x === 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke();
    };
    paint(); return onThemeChange(paint);
  }, []);
  return <div className="poster"><canvas ref={ref} width={536} height={150} /><span className="tag">interactive · expand to run</span></div>;
}
