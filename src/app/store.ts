import { create } from 'zustand';
import type { ArticleGraph, Card, Highlight, InputMode, LayoutMode, NoteCard, Overlay, Pos, Rect, Size } from './types';
import { uid } from './types';
import { tidyTree, resolveOverlaps, nudgeFree } from './layout';
import * as db from './db';
import { toast } from './toast';
import { boardApi } from './boardApi';

export const SOFT_LIMIT = 6;
const DEFAULT_SIZE: Size = { w: 280, h: 150 };
const emptyOverlay = (articleId: string): Overlay => ({ articleId, positions: {}, expanded: [], hiddenEdges: [], userEdges: [], manual: false, updatedAt: 0 });

export interface SelectOpts { open?: boolean; focus?: boolean }

interface State {
  article: ArticleGraph | null;
  overlay: Overlay;
  highlights: Highlight[];
  notes: NoteCard[];
  measured: Record<string, Size>;
  loaded: boolean;
  laidOut: boolean;
  input: InputMode | null;
  readerW: number;
  sidebarPref: boolean;
  mode: LayoutMode;
  selected: string | null;
  readerOpen: boolean;
  sidebarOpen: boolean;
  tab: 'toc' | 'notes';
  mtab: 'board' | 'read' | 'notes';
  simFold: boolean;
  lastToggled: string | null;
  revealId: string | null;
  animTick: number;
  fitTick: number;
  focusReq: { id: string; n: number } | null;
  pulseId: string | null;
  warned: boolean;
  pendingHash: string | null;

  init: (article: ArticleGraph) => Promise<void>;
  sizeOf: (id: string) => Size;
  rects: () => Record<string, Rect>;
  setMeasured: (m: Record<string, Size>) => void;
  maybeLayout: () => void;
  afterSizeChange: (id: string) => void;
  relayout: (anchorId: string | null, animate: boolean) => void;
  pushApart: (anchorId: string) => void;
  toggleExpand: (id: string) => void;
  collapseAll: () => void;
  collapseOffscreen: () => void;
  setPosition: (id: string, pos: Pos) => void;
  hideEdge: (id: string) => void;
  unhideEdge: (id: string) => void;
  addUserEdge: (from: string, to: string) => void;
  removeUserEdge: (id: string) => void;
  edgeAction: (id: string, kind: 'h' | 'user' | 'note') => void;
  resetBoard: () => void;
  tidy: () => void;
  addHighlight: (h: Pick<Highlight, 'cardId' | 'exact' | 'prefix' | 'suffix' | 'start' | 'end'>) => Highlight;
  updateHighlight: (id: string, patch: Partial<Highlight>) => void;
  deleteHighlight: (id: string) => void;
  addNote: (highlightId: string, pos?: Pos) => string | null;
  removeNote: (id: string, silent?: boolean) => void;
  select: (id: string, opts?: SelectOpts) => void;
  focus: (id: string) => void;
  setReaderOpen: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  setTab: (t: 'toc' | 'notes') => void;
  setMtab: (t: 'board' | 'read' | 'notes') => void;
  setSimFold: (v: boolean) => void;
  setMode: (m: LayoutMode) => void;
  setInput: (m: InputMode) => void;
  setReaderW: (w: number) => void;
  requestFit: () => void;
  clearReveal: () => void;
  importData: (data: { highlights?: Highlight[]; notes?: NoteCard[] }) => number;
}

function buildRects(cards: Card[], notes: NoteCard[], positions: Record<string, Pos>, sizeOf: (id: string) => Size): Record<string, Rect> {
  const out: Record<string, Rect> = {};
  for (const c of cards) { const p = positions[c.id] || { x: 0, y: 0 }, s = sizeOf(c.id); out[c.id] = { x: p.x, y: p.y, w: s.w, h: s.h }; }
  for (const n of notes) { const p = positions[n.id]; if (!p) continue; const s = sizeOf(n.id) ?? { w: 260, h: 130 }; out[n.id] = { x: p.x, y: p.y, w: s.w, h: s.h }; }
  return out;
}

export const useStore = create<State>((set, get) => ({
  article: null,
  overlay: emptyOverlay(''),
  highlights: [], notes: [], measured: {}, loaded: false, laidOut: false,
  input: null, readerW: 440, sidebarPref: true, mode: 'desk',
  selected: null, readerOpen: true, sidebarOpen: true, tab: 'toc', mtab: 'board', simFold: false,
  lastToggled: null, revealId: null, animTick: 0, fitTick: 0, focusReq: null, pulseId: null, warned: false, pendingHash: null,

  init: async article => {
    set({ article, overlay: emptyOverlay(article.id), highlights: [], notes: [], measured: {}, loaded: false, laidOut: false,
      input: db.readPref<InputMode | null>('input', null), readerW: db.readPref('readerW', 440), sidebarPref: db.readPref('sidebar', true), sidebarOpen: db.readPref('sidebar', true) });
    const st = await db.loadArticleState(article.id);
    const highlights = st.highlights;
    const notes = st.notes.filter(n => highlights.some(h => h.id === n.highlightId));
    set({ overlay: st.overlay ? { ...emptyOverlay(article.id), ...st.overlay } : emptyOverlay(article.id), highlights, notes, loaded: true });
    get().maybeLayout();
  },

  sizeOf: id => get().measured[id] ?? (get().notes.some(n => n.id === id) ? { w: 260, h: 130 } : DEFAULT_SIZE),
  rects: () => { const s = get(); return buildRects(s.article?.cards ?? [], s.notes, s.overlay.positions, s.sizeOf); },

  setMeasured: m => {
    const prev = get().measured; const next = { ...prev }; const changed: string[] = [];
    for (const id in m) { const sz = m[id]; if (!sz.w || !sz.h) continue; const p = prev[id]; next[id] = sz; if (p && (Math.round(p.w) !== Math.round(sz.w) || Math.round(p.h) !== Math.round(sz.h))) changed.push(id); }
    set({ measured: next });
    if (!get().laidOut) { get().maybeLayout(); return; }
    if (changed.length) { const lt = get().lastToggled; get().afterSizeChange(lt && changed.includes(lt) ? lt : changed[0]); }
  },

  maybeLayout: () => {
    const s = get(); if (!s.article || !s.loaded || s.laidOut) return;
    if (!s.article.cards.every(c => s.measured[c.id])) return;
    const havePos = s.article.cards.every(c => s.overlay.positions[c.id]);
    if (!havePos) s.relayout(null, false);
    // notes that lost their position get one below their source card
    const st = get(); const positions = { ...st.overlay.positions }; let touched = false;
    for (const n of st.notes) if (!positions[n.id]) { const hl = st.highlights.find(h => h.id === n.highlightId); const src = hl ? positions[hl.cardId] : null; const sz = st.sizeOf(hl?.cardId ?? ''); positions[n.id] = src ? { x: src.x + 40, y: src.y + sz.h + 36 } : { x: 0, y: 0 }; touched = true; }
    if (touched) set({ overlay: { ...st.overlay, positions } });
    set({ laidOut: true, fitTick: get().fitTick + 1 });
    const ph = get().pendingHash; if (ph) { set({ pendingHash: null }); if (ph === 'notes') { set({ tab: 'notes', sidebarOpen: true, mtab: 'notes' }); } else if (get().article!.cards.some(c => c.id === ph)) setTimeout(() => get().select(ph, { open: true, focus: true }), 120); }
  },

  afterSizeChange: id => { const s = get(); if (!s.article) return; if (s.overlay.manual) s.pushApart(id); else s.relayout(id, true); },

  relayout: (anchorId, animate) => {
    const s = get(); if (!s.article) return;
    const before = anchorId ? s.overlay.positions[anchorId] : undefined;
    const pos = tidyTree(s.article.cards, s.sizeOf);
    if (before && anchorId && pos[anchorId]) { const dx = before.x - pos[anchorId].x, dy = before.y - pos[anchorId].y; if (dx || dy) for (const id in pos) pos[id] = { x: pos[id].x + dx, y: pos[id].y + dy }; }
    const positions = { ...s.overlay.positions, ...pos };
    const rects = buildRects(s.article.cards, s.notes, positions, s.sizeOf);
    const moved = anchorId && rects[anchorId] ? resolveOverlaps(rects, anchorId) : {};
    set({ overlay: { ...s.overlay, positions: { ...positions, ...moved }, updatedAt: Date.now() }, animTick: animate ? s.animTick + 1 : s.animTick });
  },

  pushApart: anchorId => { const s = get(); const moved = resolveOverlaps(s.rects(), anchorId); if (Object.keys(moved).length) set({ overlay: { ...s.overlay, positions: { ...s.overlay.positions, ...moved }, updatedAt: Date.now() }, animTick: s.animTick + 1 }); },

  toggleExpand: id => {
    const s = get(); const on = !s.overlay.expanded.includes(id);
    const expanded = on ? [...s.overlay.expanded, id] : s.overlay.expanded.filter(x => x !== id);
    set({ overlay: { ...s.overlay, expanded, updatedAt: Date.now() }, lastToggled: id, revealId: on ? id : null });
    if (expanded.length > SOFT_LIMIT && !get().warned) { set({ warned: true }); toast(`${expanded.length} cards are expanded. Collapse the ones you are done with to keep the board quick.`, [{ label: 'Collapse off-screen', fn: () => get().collapseOffscreen() }, { label: 'Collapse all', fn: () => get().collapseAll() }], 9000); }
    if (expanded.length <= SOFT_LIMIT) set({ warned: false });
  },
  collapseAll: () => set(s => ({ overlay: { ...s.overlay, expanded: [], updatedAt: Date.now() }, revealId: null, warned: false })),
  collapseOffscreen: () => { const api = boardApi(); const s = get(); if (!api) return; const keep = s.overlay.expanded.filter(id => api.isOnScreen(id)); set({ overlay: { ...s.overlay, expanded: keep, updatedAt: Date.now() }, revealId: null, warned: keep.length > SOFT_LIMIT }); },

  setPosition: (id, pos) => set(s => ({ overlay: { ...s.overlay, positions: { ...s.overlay.positions, [id]: pos }, manual: true, updatedAt: Date.now() } })),

  hideEdge: id => set(s => ({ overlay: { ...s.overlay, hiddenEdges: [...new Set([...s.overlay.hiddenEdges, id])], updatedAt: Date.now() } })),
  unhideEdge: id => set(s => ({ overlay: { ...s.overlay, hiddenEdges: s.overlay.hiddenEdges.filter(x => x !== id), updatedAt: Date.now() } })),
  addUserEdge: (from, to) => {
    const s = get(); if (from === to) return;
    if (s.overlay.userEdges.some(e => e.from === from && e.to === to)) { toast('These cards are already connected.'); return; }
    const hid = `h:${from}>${to}`; if (s.overlay.hiddenEdges.includes(hid)) { s.unhideEdge(hid); return; }
    set({ overlay: { ...s.overlay, userEdges: [...s.overlay.userEdges, { id: uid(), from, to }], updatedAt: Date.now() } });
  },
  removeUserEdge: id => set(s => ({ overlay: { ...s.overlay, userEdges: s.overlay.userEdges.filter(e => e.id !== id), updatedAt: Date.now() } })),
  edgeAction: (id, kind) => {
    const s = get();
    if (kind === 'h') { s.hideEdge(id); toast('Connection hidden. The article itself is unchanged.', [{ label: 'Undo', fn: () => get().unhideEdge(id) }, { label: 'Reset board', fn: () => get().resetBoard() }]); }
    else if (kind === 'user') { s.removeUserEdge(id); toast('Your connection was removed.'); }
    else toast('This link follows the highlight. Remove the note card to remove it.');
  },

  resetBoard: () => {
    const s = get(); if (!s.article) return;
    set({ overlay: { ...s.overlay, positions: {}, hiddenEdges: [], userEdges: [], expanded: [], manual: false, updatedAt: Date.now() }, lastToggled: null, revealId: null, warned: false });
    get().relayout(null, true);
    const st = get(); const positions = { ...st.overlay.positions };
    for (const n of st.notes) { const hl = st.highlights.find(h => h.id === n.highlightId); const src = hl ? positions[hl.cardId] : null; const sz = st.sizeOf(hl?.cardId ?? ''); positions[n.id] = src ? { x: src.x + 40, y: src.y + sz.h + 36 } : { x: 0, y: 0 }; const rects = buildRects(st.article!.cards, st.notes, positions, st.sizeOf); positions[n.id] = nudgeFree(rects, n.id); }
    set({ overlay: { ...get().overlay, positions }, fitTick: get().fitTick + 1 });
    toast("Board reset to the author's structure. Your highlights and notes are kept.");
  },
  tidy: () => { const s = get(); set({ overlay: { ...s.overlay, manual: false } }); get().relayout(s.selected && s.article?.cards.some(c => c.id === s.selected) ? s.selected : null, true); set({ fitTick: get().fitTick + 1 }); },

  addHighlight: h => {
    const s = get(); const card = s.article!.cards.find(c => c.id === h.cardId)!; const now = Date.now();
    const hl: Highlight = { id: uid(), articleId: s.article!.id, cardHash: card.hash, note: '', createdAt: now, updatedAt: now, ...h };
    set({ highlights: [...s.highlights, hl] }); return hl;
  },
  updateHighlight: (id, patch) => set(s => ({ highlights: s.highlights.map(h => h.id === id ? { ...h, ...patch, updatedAt: Date.now() } : h) })),
  deleteHighlight: id => {
    const s = get(); const h = s.highlights.find(x => x.id === id); if (!h) return;
    db.saveHighlights([{ ...h, deleted: true, updatedAt: Date.now() }]);
    s.notes.filter(n => n.highlightId === id).forEach(n => get().removeNote(n.id, true));
    set({ highlights: get().highlights.filter(x => x.id !== id) });
  },
  addNote: (highlightId, pos) => {
    const s = get(); const hl = s.highlights.find(h => h.id === highlightId); if (!hl || !s.article) return null;
    const exists = s.notes.find(n => n.highlightId === highlightId);
    if (exists) {
      if (pos) { const positions = { ...s.overlay.positions, [exists.id]: pos }; const rects = buildRects(s.article.cards, s.notes, positions, s.sizeOf); positions[exists.id] = nudgeFree(rects, exists.id); set({ overlay: { ...s.overlay, positions, updatedAt: Date.now() } }); }
      return exists.id;
    }
    const now = Date.now(); const n: NoteCard = { id: uid(), articleId: s.article.id, highlightId, createdAt: now, updatedAt: now };
    const src = s.overlay.positions[hl.cardId] || { x: 0, y: 0 }; const sz = s.sizeOf(hl.cardId);
    const positions = { ...s.overlay.positions, [n.id]: pos ?? { x: src.x + 40, y: src.y + sz.h + 36 } };
    const notes = [...s.notes, n];
    const rects = buildRects(s.article.cards, notes, positions, s.sizeOf); positions[n.id] = nudgeFree(rects, n.id);
    set({ notes, overlay: { ...s.overlay, positions, updatedAt: Date.now() } });
    return n.id;
  },
  removeNote: (id, silent) => {
    const s = get(); const n = s.notes.find(x => x.id === id); if (!n) return;
    db.saveNotes([{ ...n, deleted: true, updatedAt: Date.now() }]);
    const positions = { ...s.overlay.positions }; delete positions[id];
    set({ notes: s.notes.filter(x => x.id !== id), overlay: { ...s.overlay, positions, userEdges: s.overlay.userEdges.filter(e => e.from !== id && e.to !== id), updatedAt: Date.now() } });
    if (!silent) toast('Note card removed. The highlight is still saved under Notes.');
  },

  select: (id, opts = {}) => {
    const { open = true, focus = false } = opts; const s = get();
    const patch: Partial<State> = { selected: id };
    if (open && s.mode === 'desk') patch.readerOpen = true;
    if (open && s.mode === 'phone') patch.mtab = 'read';
    if (s.mode !== 'desk') patch.sidebarOpen = false;
    set(patch);
    if (focus) get().focus(id);
    try { history.replaceState(null, '', '#' + id); } catch {}
  },
  focus: id => { set(s => ({ focusReq: { id, n: (s.focusReq?.n ?? 0) + 1 }, pulseId: id })); setTimeout(() => { if (get().pulseId === id) set({ pulseId: null }); }, 1200); },
  setReaderOpen: v => set({ readerOpen: v }),
  setSidebarOpen: v => { set({ sidebarOpen: v }); if (get().mode === 'desk') { set({ sidebarPref: v }); db.writePref('sidebar', v); } },
  setTab: t => set({ tab: t }),
  setMtab: t => set({ mtab: t, sidebarOpen: t === 'notes' ? false : get().sidebarOpen }),
  setSimFold: v => set({ simFold: v }),
  setMode: m => { const s = get(); if (s.mode === m) return; set({ mode: m, sidebarOpen: m === 'desk' ? s.sidebarPref : false, readerOpen: m === 'desk' ? s.readerOpen : true }); },
  setInput: m => { set({ input: m }); db.writePref('input', m); },
  setReaderW: w => { set({ readerW: w }); db.writePref('readerW', w); },
  requestFit: () => set(s => ({ fitTick: s.fitTick + 1 })),
  clearReveal: () => set({ revealId: null }),
  importData: data => {
    const s = get(); if (!s.article) return 0; let n = 0;
    const hls = [...s.highlights];
    for (const h of data.highlights ?? []) { if (h.articleId !== s.article.id || h.deleted) continue; const i = hls.findIndex(x => x.id === h.id); if (i < 0) { hls.push(h); n++; } else if ((h.updatedAt ?? 0) > (hls[i].updatedAt ?? 0)) { hls[i] = h; n++; } }
    const notes = [...s.notes];
    for (const nt of data.notes ?? []) { if (nt.articleId !== s.article.id || nt.deleted || !hls.some(h => h.id === nt.highlightId)) continue; if (!notes.some(x => x.id === nt.id)) { notes.push(nt); n++; } }
    set({ highlights: hls, notes });
    get().maybeLayout();
    return n;
  },
}));

export const defaultInput = (): InputMode => (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
export const inputMode = () => useStore.getState().input ?? defaultInput();

/* ---- persistence: write-through with a short debounce; tombstones are written where things are deleted ---- */
let started = false;
export function startPersistence() {
  if (started) return; started = true;
  let t1 = 0, t2 = 0, t3 = 0;
  useStore.subscribe((s, prev) => {
    if (!s.loaded || !s.article) return;
    if (s.overlay !== prev.overlay && s.overlay.updatedAt) { clearTimeout(t1); t1 = window.setTimeout(() => db.saveOverlay(useStore.getState().overlay), 250); }
    if (s.highlights !== prev.highlights) { clearTimeout(t2); t2 = window.setTimeout(() => db.saveHighlights(useStore.getState().highlights), 250); }
    if (s.notes !== prev.notes) { clearTimeout(t3); t3 = window.setTimeout(() => db.saveNotes(useStore.getState().notes), 250); }
  });
  const flush = () => { const s = useStore.getState(); if (!s.loaded) return; db.saveOverlay(s.overlay); db.saveHighlights(s.highlights); db.saveNotes(s.notes); };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
}
