import { useRef } from 'react';
import { useStore } from '../store';
import { startGhostDrag } from '../reader/ghost';
import { useEditor } from '../reader/editor';
import { toast } from '../toast';
import { boardApi } from '../boardApi';

export function Sidebar() {
  const article = useStore(s => s.article)!;
  const selected = useStore(s => s.selected);
  const highlights = useStore(s => s.highlights);
  const notes = useStore(s => s.notes);
  const tab = useStore(s => s.tab);
  const setTab = useStore(s => s.setTab);
  const openEditor = useEditor(s => s.open);
  const file = useRef<HTMLInputElement>(null);
  const select = (id: string) => useStore.getState().select(id, { open: true, focus: true });
  const addToBoard = (hlId: string) => { const s = useStore.getState(); const id = s.addNote(hlId); if (id) { if (s.mode === 'phone') s.setMtab('board'); setTimeout(() => boardApi()?.focus(id), 60); } };
  const exportJson = () => {
    const s = useStore.getState();
    const data = { site: 'octoblab', article: article.id, exportedAt: new Date().toISOString(), highlights: s.highlights, notes: s.notes, overlay: s.overlay };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `octoblab-${article.id}-notes.json`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Exported. Keep the file as a backup, or import it on another device.');
  };
  const importJson = async (f: File | undefined) => {
    if (!f) return;
    try { const data = JSON.parse(await f.text()); const n = useStore.getState().importData(data); toast(n ? `Imported ${n} item${n > 1 ? 's' : ''}.` : 'Nothing new to import for this article.'); }
    catch { toast('That file could not be read as an export.'); }
    if (file.current) file.current.value = '';
  };
  const sorted = highlights.slice().sort((a, b) => b.createdAt - a.createdAt);
  return (
    <aside className="sidebar" aria-label="Contents and notes" data-testid="sidebar">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'toc'} onClick={() => setTab('toc')} data-testid="tab-toc">Contents</button>
        <button type="button" role="tab" aria-selected={tab === 'notes'} onClick={() => setTab('notes')} data-testid="tab-notes">Notes{highlights.length > 0 && <span className="cnt" data-testid="note-count">{highlights.length}</span>}</button>
      </div>
      {tab === 'toc' ? (
        <div className="panel">
          <ul className="toc" data-testid="toc">
            {article.cards.map(c => (
              <li key={c.id}><a href={'#' + c.id} className={'l' + c.level + (selected === c.id ? ' current' : '')} data-id={c.id} onClick={e => { e.preventDefault(); select(c.id); }}><span className="lvl">H{c.level}</span>{c.title}</a></li>
            ))}
          </ul>
          <div className="sidenote">H1 is the root card and each H2 is a child. The author decides where a section splits further.</div>
        </div>
      ) : (
        <div className="panel">
          <div className="notes-list" data-testid="notes-list">
            {sorted.length === 0 && <div className="empty">No highlights yet. Open a card in the reader, select some text, and press Highlight.</div>}
            {sorted.map(hl => {
              const onBoard = notes.some(n => n.highlightId === hl.id);
              const src = article.cards.find(c => c.id === hl.cardId);
              return (
                <div className="note-item" key={hl.id}>
                  <button type="button" className="grip" title="Drag onto the board" aria-label="Drag onto the board"
                    onPointerDown={e => { if (e.pointerType === 'mouse' && e.button !== 0) return; e.preventDefault(); startGhostDrag(e, { label: hl.exact, getHighlight: () => hl, onTap: () => addToBoard(hl.id) }); }}>⠿</button>
                  <blockquote>{hl.exact.length > 160 ? hl.exact.slice(0, 157) + '…' : hl.exact}</blockquote>
                  {hl.note && <div className="n">{hl.note}</div>}
                  <div className="src">in: {src?.title ?? '?'}</div>
                  <div className="acts">
                    <button type="button" onClick={() => select(hl.cardId)}>Open</button>
                    <button type="button" onClick={() => addToBoard(hl.id)}>{onBoard ? 'Show on board' : 'Add to board'}</button>
                    <button type="button" onClick={e => openEditor(hl, (e.currentTarget as HTMLElement).getBoundingClientRect())}>{hl.note ? 'Edit note' : 'Add note'}</button>
                    <button type="button" onClick={() => { useStore.getState().deleteHighlight(hl.id); toast('Highlight removed.'); }}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="notes-foot">
            <button type="button" onClick={exportJson}>Export JSON</button>
            <button type="button" onClick={() => file.current?.click()}>Import JSON</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => importJson(e.target.files?.[0])} />
          </div>
          <div className="sidenote">Drag the ⠿ grip onto the board, or use “Add to board”. Notes are stored in this browser only; export them to keep a copy.</div>
        </div>
      )}
    </aside>
  );
}
