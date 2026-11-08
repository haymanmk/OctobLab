import { useEffect, useRef, useState } from 'react';
import { useEditor } from './editor';
import { useStore } from '../store';
import { toast } from '../toast';
import { clamp } from '../types';

export function NoteEditor() {
  const { hl, rect, close } = useEditor();
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (hl) setText(hl.note || ''); }, [hl?.id]);
  useEffect(() => {
    if (!hl || !rect || !box.current) return;
    const el = box.current; const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = clamp(rect.left, 8, window.innerWidth - w - 8) + 'px';
    el.style.top = clamp(rect.bottom + 8, 8, window.innerHeight - h - 8) + 'px';
    el.querySelector('textarea')?.focus();
  }, [hl?.id, rect]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, [close]);
  if (!hl) return null;
  const save = () => {
    const s = useStore.getState(); s.updateHighlight(hl.id, { note: text.trim() }); close();
    if (!s.notes.some(n => n.highlightId === hl.id)) toast('Note saved.', [{ label: 'Add to board', fn: () => useStore.getState().addNote(hl.id) }]);
  };
  return (
    <div ref={box} className="noteedit" role="dialog" aria-label="Note">
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Add a note to this highlight" aria-label="Note text" />
      <div className="row"><button type="button" className="btn small" onClick={close}>Cancel</button><button type="button" className="btn small primary" onClick={save}>Save note</button></div>
    </div>
  );
}
