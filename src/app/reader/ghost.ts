import type { Highlight } from '../types';
import { boardApi, overBoard } from '../boardApi';
import { useStore } from '../store';

let suppress = false;
export const ghostSuppressed = () => suppress;

/** Carry a highlight to the board with any pointer type. A press without movement is a tap. */
export function startGhostDrag(e: { clientX: number; clientY: number; pointerId: number }, opts: { label: string; getHighlight: () => Highlight | null; onTap?: () => void; onStart?: () => void }) {
  const sx = e.clientX, sy = e.clientY, pid = e.pointerId; let started = false, ghost: HTMLDivElement | null = null;
  const boardEl = () => boardApi()?.el() ?? null;
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return;
    if (!started) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      started = true; opts.onStart?.();
      ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.textContent = opts.label.slice(0, 90); document.body.append(ghost);
      boardEl()?.classList.add('drop-target');
    }
    ghost!.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 10}px)`;
    boardEl()?.classList.toggle('drop-hot', overBoard(ev.clientX, ev.clientY));
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== pid) return;
    document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
    ghost?.remove(); boardEl()?.classList.remove('drop-target', 'drop-hot');
    if (!started) { if (ev.type === 'pointerup') opts.onTap?.(); return; }
    suppress = true; setTimeout(() => { suppress = false; }, 60);
    if (ev.type !== 'pointerup' || !overBoard(ev.clientX, ev.clientY)) return;
    const hl = opts.getHighlight(); const api = boardApi(); if (!hl || !api) return;
    const pt = api.screenToFlow(ev.clientX, ev.clientY);
    const id = useStore.getState().addNote(hl.id, { x: pt.x - 130, y: pt.y - 20 });
    if (id) setTimeout(() => api.focus(id), 60);
  };
  document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
}
