import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, Panel, applyNodeChanges, useReactFlow, type Edge, type NodeChange, type Connection, type FinalConnectionState } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore, defaultInput, SOFT_LIMIT } from '../store';
import { setBoardApi } from '../boardApi';
import { CardNode, type CardNodeType, type CardData } from './CardNode';
import { NoteNode, type NoteNodeType } from './NoteNode';
import type { Size } from '../types';
import { clamp } from '../types';

type AnyNode = CardNodeType | NoteNodeType;
const nodeTypes = { card: CardNode, note: NoteNode };
/* keep the toolbar strip and the controls clear when fitting */
const FIT = { padding: { top: '68px', left: '20px', right: '20px', bottom: '56px' }, maxZoom: 1.1 } as const;

export default function Board() {
  return <ReactFlowProvider><BoardInner /></ReactFlowProvider>;
}

function BoardInner() {
  const rf = useReactFlow<AnyNode, Edge>();
  const wrap = useRef<HTMLDivElement>(null);
  const article = useStore(s => s.article)!;
  const positions = useStore(s => s.overlay.positions);
  const expanded = useStore(s => s.overlay.expanded);
  const hiddenEdges = useStore(s => s.overlay.hiddenEdges);
  const userEdges = useStore(s => s.overlay.userEdges);
  const notes = useStore(s => s.notes);
  const highlights = useStore(s => s.highlights);
  const selected = useStore(s => s.selected);
  const inputPref = useStore(s => s.input);
  const input = inputPref ?? defaultInput();
  const laidOut = useStore(s => s.laidOut);
  const animTick = useStore(s => s.animTick);
  const fitTick = useStore(s => s.fitTick);
  const revealId = useStore(s => s.revealId);
  const focusReq = useStore(s => s.focusReq);
  const pulseId = useStore(s => s.pulseId);
  const measured = useStore(s => s.measured);
  const [nodes, setNodes] = useState<AnyNode[]>([]);
  const [anim, setAnim] = useState(false);

  /* nodes are derived from the store; React Flow's own measurements and selection are carried over */
  useEffect(() => {
    setNodes(prev => {
      const prevById = new Map(prev.map(n => [n.id, n]));
      const touch = input === 'touch';
      const cards = article.cards.map(c => {
        const ex = expanded.includes(c.id); const p = prevById.get(c.id);
        const n: CardNodeType = { id: c.id, type: 'card', position: positions[c.id] ?? p?.position ?? { x: 0, y: 0 }, data: { card: c, expanded: ex, isSelected: selected === c.id, pulse: pulseId === c.id }, dragHandle: touch || ex ? '.card-head' : undefined, measured: p?.measured, selected: p?.selected, style: { visibility: laidOut ? 'visible' : 'hidden' } };
        return n;
      });
      const ns = notes.flatMap(nt => {
        const hl = highlights.find(h => h.id === nt.highlightId); if (!hl) return [];
        const p = prevById.get(nt.id); const src = article.cards.find(c => c.id === hl.cardId);
        const n: NoteNodeType = { id: nt.id, type: 'note', position: positions[nt.id] ?? p?.position ?? { x: 0, y: 0 }, data: { note: nt, highlight: hl, sourceTitle: src?.title ?? '', pulse: pulseId === nt.id }, dragHandle: touch ? '.card-head' : undefined, measured: p?.measured, selected: p?.selected, zIndex: 5, style: { visibility: laidOut ? 'visible' : 'hidden' } };
        return [n];
      });
      return [...cards, ...ns];
    });
  }, [article, positions, expanded, notes, highlights, selected, input, pulseId, laidOut]);

  const onNodesChange = useCallback((changes: NodeChange<AnyNode>[]) => {
    setNodes(ns => applyNodeChanges(changes, ns));
    const dims: Record<string, Size> = {};
    for (const c of changes) if (c.type === 'dimensions' && c.dimensions) dims[c.id] = { w: c.dimensions.width, h: c.dimensions.height };
    if (Object.keys(dims).length) useStore.getState().setMeasured(dims);
  }, []);

  const edges = useMemo<Edge[]>(() => {
    const ids = new Set([...article.cards.map(c => c.id), ...notes.map(n => n.id)]);
    const list: Edge[] = [];
    for (const c of article.cards) if (c.parentId) { const id = `h:${c.parentId}>${c.id}`; if (!hiddenEdges.includes(id)) list.push({ id, source: c.parentId, target: c.id, className: 'edge-h', markerEnd: 'url(#arrow-h)', interactionWidth: 16, data: { kind: 'h' } }); }
    for (const e of userEdges) if (ids.has(e.from) && ids.has(e.to)) list.push({ id: e.id, source: e.from, target: e.to, className: 'edge-user', markerEnd: 'url(#arrow-user)', interactionWidth: 16, data: { kind: 'user' } });
    for (const n of notes) { const hl = highlights.find(h => h.id === n.highlightId); if (hl) list.push({ id: `n:${n.id}`, source: hl.cardId, target: n.id, className: 'edge-note', markerEnd: 'url(#arrow-note)', interactionWidth: 16, data: { kind: 'note' } }); }
    return list;
  }, [article, hiddenEdges, userEdges, notes, highlights]);

  useEffect(() => { if (!animTick) return; setAnim(true); const t = setTimeout(() => setAnim(false), 380); return () => clearTimeout(t); }, [animTick]);
  useEffect(() => { if (!laidOut) return; const t = setTimeout(() => rf.fitView({ ...FIT, duration: fitTick > 1 ? 300 : 0 }), 80); return () => clearTimeout(t); }, [fitTick, laidOut, rf]);
  useEffect(() => {
    if (!revealId || !laidOut) return;
    const t = setTimeout(() => {
      const n = rf.getNode(revealId), el = wrap.current; useStore.getState().clearReveal();
      if (!n || !el || !n.measured?.width) return;
      const vp = rf.getViewport(); const r = el.getBoundingClientRect();
      const left = n.position.x * vp.zoom + vp.x, top = n.position.y * vp.zoom + vp.y, right = left + n.measured.width * vp.zoom, bottom = top + (n.measured.height ?? 0) * vp.zoom;
      const pad = 24, topPad = 64; let dx = 0, dy = 0;
      if (right > r.width - pad) dx = r.width - pad - right; if (left + dx < pad) dx = pad - left;
      if (bottom > r.height - pad) dy = r.height - pad - bottom; if (top + dy < topPad) dy = topPad - top;
      if (dx || dy) rf.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 300 });
    }, 160);
    return () => clearTimeout(t);
  }, [revealId, positions, measured, laidOut, rf]);
  useEffect(() => {
    if (!focusReq) return;
    const n = rf.getNode(focusReq.id); if (!n) return;
    const w = Math.min(n.measured?.width ?? 280, 400), h = Math.min(n.measured?.height ?? 150, 240);
    rf.setCenter(n.position.x + w / 2, n.position.y + h / 2, { zoom: clamp(rf.getZoom(), 0.8, 1.2), duration: 350 });
  }, [focusReq, rf]);
  useEffect(() => {
    setBoardApi({
      screenToFlow: (x, y) => rf.screenToFlowPosition({ x, y }),
      rect: () => wrap.current?.getBoundingClientRect() ?? null,
      el: () => wrap.current,
      visible: () => !!wrap.current && wrap.current.offsetParent !== null,
      focus: id => useStore.getState().focus(id),
      fit: () => rf.fitView({ ...FIT, duration: 300 }),
      isOnScreen: id => { const n = rf.getNode(id), el = wrap.current; if (!n || !el) return false; const vp = rf.getViewport(); const l = n.position.x * vp.zoom + vp.x, t = n.position.y * vp.zoom + vp.y; const r = l + (n.measured?.width ?? 280) * vp.zoom, b = t + (n.measured?.height ?? 150) * vp.zoom; return r > 0 && l < el.clientWidth && b > 0 && t < el.clientHeight; },
    });
    return () => setBoardApi(null);
  }, [rf]);

  const onNodeClick = useCallback((e: React.MouseEvent, node: AnyNode) => {
    const t = e.target as Element; if (t.closest('button, input, a, textarea, select')) return;
    if (node.type === 'card') { if ((node.data as CardData).expanded && t.closest('.card-body')) return; useStore.getState().select(node.id, { open: true }); }
  }, []);
  const onNodeDragStop = useCallback((_e: unknown, node: AnyNode) => useStore.getState().setPosition(node.id, node.position), []);
  const onConnect = useCallback((c: Connection) => { if (c.source && c.target) useStore.getState().addUserEdge(c.source, c.target); }, []);
  /* dropping the connection anywhere on a card counts, not only on its small target handle */
  const onConnectEnd = useCallback((e: MouseEvent | TouchEvent, st: FinalConnectionState) => {
    if (st.isValid || !st.fromNode) return;
    const pt = 'changedTouches' in e ? e.changedTouches[0] : e; if (!pt) return;
    const to = document.elementFromPoint(pt.clientX, pt.clientY)?.closest('.react-flow__node')?.getAttribute('data-id');
    if (to && to !== st.fromNode.id) useStore.getState().addUserEdge(st.fromNode.id, to);
  }, []);
  const onEdgeClick = useCallback((_e: unknown, edge: Edge) => useStore.getState().edgeAction(edge.id, (edge.data as { kind: 'h' | 'user' | 'note' }).kind), []);

  const setInput = useStore(s => s.setInput);
  const nExp = expanded.length;
  return (
    <div ref={wrap} className={'board' + (anim ? ' animate' : '')} data-testid="board">
      <svg className="edge-markers" width="0" height="0" aria-hidden="true"><defs>
        <marker id="arrow-h" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style={{ fill: 'var(--edge)' }} /></marker>
        <marker id="arrow-user" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style={{ fill: 'var(--edge-user)' }} /></marker>
        <marker id="arrow-note" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style={{ fill: 'var(--edge-note)' }} /></marker>
      </defs></svg>
      <ReactFlow<AnyNode, Edge>
        nodes={nodes} edges={edges} nodeTypes={nodeTypes}
        onNodesChange={onNodesChange} onNodeClick={onNodeClick} onNodeDragStop={onNodeDragStop} onConnect={onConnect} onConnectEnd={onConnectEnd} onEdgeClick={onEdgeClick}
        minZoom={0.2} maxZoom={2.5} nodeDragThreshold={3} zoomOnDoubleClick={false} selectionOnDrag={false} panOnDrag zoomOnPinch
        zoomOnScroll={input === 'mouse'} panOnScroll={input === 'touch'} connectionRadius={60} elevateNodesOnSelect
        deleteKeyCode={null} multiSelectionKeyCode={null} selectionKeyCode={null}
        proOptions={{ hideAttribution: false }}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
        <Panel position="top-left" className="toolbar">
          <button type="button" onClick={() => rf.fitView({ ...FIT, duration: 300 })} title="Fit all cards in view">Fit</button>
          <button type="button" onClick={() => useStore.getState().tidy()} title="Re-run the tree layout with the current card sizes">Tidy</button>
          <button type="button" onClick={() => useStore.getState().collapseAll()} title="Collapse every expanded card">Collapse all</button>
          <button type="button" onClick={() => useStore.getState().resetBoard()} title="Restore the author's layout and connections">Reset board</button>
          <div className="seg" role="group" aria-label="Input mode">
            <button type="button" aria-pressed={input === 'mouse'} onClick={() => setInput('mouse')}>Mouse</button>
            <button type="button" aria-pressed={input === 'touch'} onClick={() => setInput('touch')}>Touch</button>
          </div>
          <span className={'chip' + (nExp > SOFT_LIMIT ? ' over' : '')} data-testid="chip">{nExp} expanded</span>
        </Panel>
        <Panel position="bottom-left" className="boardhint">
          {input === 'mouse' ? 'scroll to zoom · drag the background to pan · drag a card to move it · drag a card’s dot to another card to connect · click an arrow to hide it'
            : 'pinch or ctrl + scroll to zoom · drag the background to pan · drag a card’s title to move it · drag a card’s dot to another card to connect · tap an arrow to hide it'}
        </Panel>
      </ReactFlow>
    </div>
  );
}
