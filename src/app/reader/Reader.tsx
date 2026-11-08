import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Highlight as Hl } from '../types';
import { useStore } from '../store';
import { CardHtml } from '../widgets/CardHtml';
import { anchorHighlight, caretAt, offsetsToRange, plainText, rangeToOffsets, textNodes } from '../anchoring';
import { startGhostDrag, ghostSuppressed } from './ghost';
import { useEditor } from './editor';
import { toast } from '../toast';
import { boardApi } from '../boardApi';
import { clamp } from '../types';
import { IconClose, IconLocate } from '../board/icons';

interface PopAction { label: string; fn: () => void; drag?: () => Hl | null; dragLabel?: string }
interface Anchored { hl: Hl; r: Range; start: number; end: number }
type HLRegistry = { set(name: string, h: unknown): void; delete(name: string): void } | undefined;
const registry = (): HLRegistry => (typeof CSS !== 'undefined' ? (CSS as unknown as { highlights?: HLRegistry }).highlights : undefined);
const HighlightCtor = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;

export function Reader() {
  const article = useStore(s => s.article)!;
  const selected = useStore(s => s.selected);
  const highlights = useStore(s => s.highlights);
  const notes = useStore(s => s.notes);
  const mode = useStore(s => s.mode);
  const card = selected ? article.cards.find(c => c.id === selected) ?? null : null;
  const bodyRef = useRef<HTMLDivElement>(null), contentRef = useRef<HTMLDivElement>(null), popRef = useRef<HTMLDivElement>(null);
  const anchored = useRef<Anchored[]>([]);
  const [pop, setPop] = useState<{ rect: DOMRect; actions: PopAction[] } | null>(null);
  const openEditor = useEditor(s => s.open);

  /* paint highlights with the CSS Custom Highlight API; the DOM is never rewritten */
  useLayoutEffect(() => {
    const content = contentRef.current; anchored.current = [];
    const reg = registry();
    if (!content || !card) { reg?.delete('hl'); return; }
    const txt = plainText(content); const ranges: Range[] = [];
    for (const hl of highlights.filter(h => h.cardId === card.id)) {
      const a = anchorHighlight(txt, hl); if (!a) continue;
      const r = offsetsToRange(content, a.start, a.end); if (r) { ranges.push(r); anchored.current.push({ hl, r, start: a.start, end: a.end }); }
    }
    if (reg && HighlightCtor) reg.set('hl', new HighlightCtor(...ranges));
  }, [card?.id, card?.html, highlights]);
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; setPop(null); }, [card?.id]);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (pop && popRef.current && !popRef.current.contains(e.target as Node)) setPop(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null); };
    document.addEventListener('pointerdown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [pop]);

  const highlightAt = useCallback((x: number, y: number): Anchored | null => {
    const content = contentRef.current; if (!content || !anchored.current.length) return null;
    const c = caretAt(x, y); if (!c || c.node.nodeType !== 3 || !content.contains(c.node)) return null;
    let off = 0; for (const n of textNodes(content)) { if (n === c.node) { off += c.offset; break; } off += n.nodeValue!.length; }
    return anchored.current.find(h => off >= h.start && off <= h.end) ?? null;
  }, []);

  const highlightFromOffsets = useCallback((start: number, end: number): Hl | null => {
    const content = contentRef.current; const s = useStore.getState(); if (!content || !card) return null;
    const txt = plainText(content), exact = txt.slice(start, end); if (!exact.trim()) return null;
    const existing = s.highlights.find(h => h.cardId === card.id && h.exact === exact && Math.abs(h.start - start) < 3);
    return existing ?? s.addHighlight({ cardId: card.id, exact, prefix: txt.slice(Math.max(0, start - 32), start), suffix: txt.slice(end, end + 32), start, end });
  }, [card]);

  const createHighlight = useCallback((range: Range, rect: DOMRect, withNote: boolean, silent = false): Hl | null => {
    const content = contentRef.current; if (!content) return null;
    const o = rangeToOffsets(content, range); if (!o) return null;
    const hl = highlightFromOffsets(o.start, o.end); if (!hl) return null;
    setTimeout(() => { const sel = document.getSelection(); if (sel && !sel.isCollapsed) sel.removeAllRanges(); }, 0);
    setPop(null);
    if (silent) return hl;
    if (withNote) openEditor(hl, rect);
    else toast('Highlighted. Drag the yellow text onto the board to make a note card, or use Add to board.', [{ label: 'Add to board', fn: () => { const id = useStore.getState().addNote(hl.id); if (id) { if (useStore.getState().mode === 'phone') useStore.getState().setMtab('board'); setTimeout(() => boardApi()?.focus(id), 60); } } }]);
    return hl;
  }, [highlightFromOffsets, openEditor]);

  const addToBoard = useCallback((hl: Hl) => { const s = useStore.getState(); const id = s.addNote(hl.id); if (id) { if (s.mode === 'phone') s.setMtab('board'); setTimeout(() => boardApi()?.focus(id), 60); } }, []);

  const highlightMenu = useCallback((hl: Hl, rect: DOMRect) => {
    const onBoard = useStore.getState().notes.some(n => n.highlightId === hl.id);
    setPop({ rect, actions: [
      { label: hl.note ? 'Edit note' : 'Add note', fn: () => openEditor(hl, rect) },
      { label: onBoard ? '⠿ Move on board' : '⠿ Drag to board', fn: () => addToBoard(hl), drag: () => hl, dragLabel: hl.exact },
      { label: 'Remove', fn: () => { useStore.getState().deleteHighlight(hl.id); toast('Highlight removed.'); } },
    ] });
  }, [openEditor, addToBoard]);

  const checkSelection = useCallback((e: { clientX: number; clientY: number; pointerType: string } | null) => {
    const sel = document.getSelection(); const content = contentRef.current; if (!content || !sel || !sel.rangeCount) return;
    if (sel.isCollapsed) { setPop(null); if (e && e.pointerType === 'touch') { const hit = highlightAt(e.clientX, e.clientY); if (hit) highlightMenu(hit.hl, hit.r.getBoundingClientRect()); } return; }
    const range = sel.getRangeAt(0); if (!content.contains(range.commonAncestorContainer)) return;
    if (sel.toString().trim().length < 2) return;
    const rect = range.getBoundingClientRect(); const label = sel.toString();
    setPop({ rect, actions: [
      { label: 'Highlight', fn: () => createHighlight(range, rect, false) },
      { label: 'Highlight + note', fn: () => createHighlight(range, rect, true) },
      { label: '⠿ Drag to board', fn: () => { const hl = createHighlight(range, rect, false, true); if (hl) addToBoard(hl); }, drag: () => createHighlight(range, rect, false, true), dragLabel: label },
    ] });
  }, [createHighlight, highlightAt, highlightMenu, addToBoard]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    const hit = highlightAt(e.clientX, e.clientY); if (!hit) return;
    e.preventDefault();
    startGhostDrag(e, { label: hit.hl.exact, getHighlight: () => hit.hl, onTap: () => highlightMenu(hit.hl, hit.r.getBoundingClientRect()), onStart: () => setPop(null) });
  };
  const onPointerUp = (e: React.PointerEvent) => { const ev = { clientX: e.clientX, clientY: e.clientY, pointerType: e.pointerType }; setTimeout(() => checkSelection(ev), 10); };

  // popover placement
  useLayoutEffect(() => {
    const el = popRef.current; if (!pop || !el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = clamp(pop.rect.left + pop.rect.width / 2 - w / 2, 8, window.innerWidth - w - 8) + 'px';
    el.style.top = (pop.rect.top - h - 8 > 8 ? pop.rect.top - h - 8 : pop.rect.bottom + 8) + 'px';
  }, [pop]);

  const idx = card ? article.cards.indexOf(card) : -1;
  const prev = idx > 0 ? article.cards[idx - 1] : null, next = idx >= 0 && idx < article.cards.length - 1 ? article.cards[idx + 1] : null;
  const chain: typeof article.cards = []; { let cur = card; while (cur) { chain.unshift(cur); cur = cur.parentId ? article.cards.find(c => c.id === cur!.parentId) ?? null : null; } }
  const select = (id: string) => useStore.getState().select(id, { open: true, focus: true });
  const close = () => { const s = useStore.getState(); if (s.mode === 'phone') s.setMtab('board'); else if (s.mode === 'desk') s.setReaderOpen(false); };
  const locate = () => { if (!card) return; const s = useStore.getState(); if (s.mode === 'phone') s.setMtab('board'); setTimeout(() => s.focus(card.id), 30); };

  return (
    <aside className="reader" aria-label="Reader" data-testid="reader">
      <div className="reader-head">
        <div className="crumbs" data-testid="crumbs">
          {chain.length ? chain.map((n, i) => (
            <span key={n.id}>{i > 0 && <span className="sep">›</span>}{i === chain.length - 1 ? <span>{n.level === 1 ? 'root' : n.title}</span> : <button type="button" onClick={() => select(n.id)}>{n.level === 1 ? 'root' : n.title}</button>}</span>
          )) : 'Reader'}
        </div>
        <button type="button" className="iconbtn" onClick={locate} title="Show this card on the board" aria-label="Show on board"><IconLocate /></button>
        {mode !== 'fold' && mode !== 'square' && <button type="button" className="iconbtn" onClick={close} title="Close reader" aria-label="Close reader"><IconClose /></button>}
      </div>
      <div ref={bodyRef} className="reader-body" onPointerDown={onPointerDown} onPointerUp={onPointerUp} onScroll={() => setPop(null)}>
        {card ? (
          <>
            <div className="rlvl">H{card.level} · card {idx + 1} of {article.cards.length}</div>
            <h2 className="rt" data-testid="reader-title">{card.title}</h2>
            <div ref={contentRef} className="content"><CardHtml html={card.html} /></div>
          </>
        ) : (
          <div className="reader-empty"><b>Nothing open yet</b>Click a card on the board, or an entry in Contents. Select text here to highlight it. Drag a highlight onto the board and it becomes a note card linked to this card.</div>
        )}
      </div>
      <div className="reader-foot">
        <button type="button" disabled={!prev} onClick={() => prev && select(prev.id)} data-testid="prev"><span className="k">Previous</span><span className="t">{prev?.title ?? '—'}</span></button>
        <button type="button" disabled={!next} onClick={() => next && select(next.id)} data-testid="next"><span className="k">Next</span><span className="t">{next?.title ?? '—'}</span></button>
      </div>
      {pop && (
        <div ref={popRef} className="pop" role="menu" data-testid="pop">
          {pop.actions.map(a => (
            <button key={a.label} type="button" className={a.drag ? 'dragme' : ''} title={a.drag ? 'Drag onto the board, or click to place it near its source' : undefined}
              onPointerDown={a.drag ? e => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); const g = a.drag!; startGhostDrag(e, { label: a.dragLabel || '', getHighlight: g, onStart: () => setPop(null) }); } : undefined}
              onClick={() => { if (ghostSuppressed()) return; setPop(null); a.fn(); }}>{a.label}</button>
          ))}
        </div>
      )}
      {notes.length === 0 && highlights.length === 0 && null}
    </aside>
  );
}
