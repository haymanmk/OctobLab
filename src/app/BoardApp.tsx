import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { ArticleGraph } from './types';
import { useStore, startPersistence, defaultInput } from './store';
import { useMode } from './useMode';
import { Reader } from './reader/Reader';
import { Sidebar } from './sidebar/Sidebar';
import { NoteEditor } from './reader/NoteEditor';
import { Toasts, toast } from './toast';
import { toggleTheme } from './theme';
import { clamp } from './types';
import { IconBack, IconBoard, IconFold, IconMenu, IconNotes, IconRead, IconReader, IconTheme } from './board/icons';
import '../styles/app.css';

const Board = lazy(() => import('./board/Board'));

export default function BoardApp({ article, base }: { article: ArticleGraph; base: string }) {
  const [ready, setReady] = useState(false);
  const simFold = useStore(s => s.simFold);
  const mode = useMode(simFold);
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const readerOpen = useStore(s => s.readerOpen);
  const mtab = useStore(s => s.mtab);
  const readerW = useStore(s => s.readerW);
  const input = useStore(s => s.input);
  const setMode = useStore(s => s.setMode);
  useEffect(() => { setMode(mode); }, [mode, setMode]);
  useEffect(() => {
    const h = decodeURIComponent(location.hash.slice(1));
    useStore.setState({ pendingHash: h || null });
    useStore.getState().init(article).then(() => setReady(true));
    startPersistence();
  }, [article]);

  // reader resizer (desktop)
  const rz = useRef<{ sx: number; sw: number } | null>(null);
  const onRzDown = (e: React.PointerEvent) => { rz.current = { sx: e.clientX, sw: readerW }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onRzMove = (e: React.PointerEvent) => { if (!rz.current) return; useStore.getState().setReaderW(clamp(rz.current.sw - (e.clientX - rz.current.sx), 320, Math.max(320, window.innerWidth - 560))); };
  const onRzUp = () => { rz.current = null; };

  const readHref = `${base}posts/${article.id}/read/`;
  const cls = ['app', sidebarOpen ? 'sb-open' : '', readerOpen ? '' : 'reader-closed'].join(' ').trim();
  return (
    <div className={cls} data-mode={mode} data-mtab={mtab} data-input={input ?? defaultInput()} style={{ ['--reader-w' as string]: clamp(readerW, 320, 900) + 'px' }} data-testid="app">
      <div className="appbar">
        <a className="iconbtn" href={base} title="Home" aria-label="Home"><IconBack /></a>
        <button type="button" className="iconbtn" onClick={() => useStore.getState().setSidebarOpen(!sidebarOpen)} title="Contents and notes" aria-label="Toggle contents" data-testid="sb-toggle"><IconMenu /></button>
        <div className="title">{article.title}</div>
        <a className="textbtn desk" href={readHref} title="Read the same cards as one page">Read as a page</a>
        <button type="button" className="iconbtn desk" aria-pressed={simFold} onClick={() => { useStore.getState().setSimFold(!simFold); if (!simFold) toast('Previewing a two-screen foldable: board on the left screen, reader on the right, hinge kept clear.', [], 5000); }} title="Preview the two-screen foldable layout" aria-label="Preview foldable layout" data-testid="fold-sim"><IconFold /></button>
        <button type="button" className="iconbtn" onClick={() => toggleTheme()} title="Toggle light or dark theme" aria-label="Toggle theme" data-testid="theme"><IconTheme /></button>
        <button type="button" className="iconbtn desk" onClick={() => useStore.getState().setReaderOpen(!readerOpen)} title="Show or hide the reader" aria-label="Toggle reader" data-testid="rd-toggle"><IconReader /></button>
      </div>
      <div className="frame">
        {ready && <Sidebar />}
        <div className="scrim" onClick={() => useStore.getState().setSidebarOpen(false)} />
        <div className="boardwrap" data-testid="boardwrap">
          {ready ? <Suspense fallback={<div className="board-loading">Laying out the cards…</div>}><Board /></Suspense> : <div className="board-loading">Loading your board…</div>}
        </div>
        <div className="hinge" aria-hidden="true" />
        {ready && (
          <div className="reader-col">
            <div className="resizer" title="Drag to resize" onPointerDown={onRzDown} onPointerMove={onRzMove} onPointerUp={onRzUp} />
            <Reader />
          </div>
        )}
      </div>
      <nav className="mobiletabs" aria-label="Panes">
        {(['board', 'read', 'notes'] as const).map(t => (
          <button key={t} type="button" aria-selected={mtab === t} onClick={() => useStore.getState().setMtab(t)} data-mtab={t}>{t === 'board' ? <IconBoard /> : t === 'read' ? <IconRead /> : <IconNotes />}{t === 'board' ? 'Board' : t === 'read' ? 'Read' : 'Notes'}</button>
        ))}
      </nav>
      <Toasts />
      <NoteEditor />
    </div>
  );
}
