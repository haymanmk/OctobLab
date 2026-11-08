import Dexie, { type Table } from 'dexie';
import type { Overlay, Highlight, NoteCard } from './types';

class OctobDB extends Dexie {
  overlays!: Table<Overlay, string>;
  highlights!: Table<Highlight, string>;
  notes!: Table<NoteCard, string>;
  constructor() {
    super('octoblab');
    this.version(1).stores({ overlays: 'articleId', highlights: 'id, articleId, cardId', notes: 'id, articleId, highlightId' });
  }
}

let db: OctobDB | null = null;
function get(): OctobDB | null {
  if (db) return db;
  try { if (typeof indexedDB === 'undefined') return null; db = new OctobDB(); return db; } catch { return null; }
}

export async function loadArticleState(articleId: string): Promise<{ overlay: Overlay | undefined; highlights: Highlight[]; notes: NoteCard[] }> {
  const d = get(); if (!d) return { overlay: undefined, highlights: [], notes: [] };
  try {
    const [overlay, highlights, notes] = await Promise.all([
      d.overlays.get(articleId),
      d.highlights.where('articleId').equals(articleId).toArray(),
      d.notes.where('articleId').equals(articleId).toArray(),
    ]);
    return { overlay, highlights: highlights.filter(h => !h.deleted), notes: notes.filter(n => !n.deleted) };
  } catch { return { overlay: undefined, highlights: [], notes: [] }; }
}
export async function saveOverlay(o: Overlay) { try { await get()?.overlays.put(o); } catch {} }
export async function saveHighlights(list: Highlight[]) { try { if (list.length) await get()?.highlights.bulkPut(list); } catch {} }
export async function saveNotes(list: NoteCard[]) { try { if (list.length) await get()?.notes.bulkPut(list); } catch {} }
export async function countHighlights(): Promise<number> { try { return (await get()?.highlights.filter(h => !h.deleted).count()) ?? 0; } catch { return 0; } }

export { readPref, writePref } from './prefs';
