import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { Highlight, NoteCard } from '../types';
import { useStore } from '../store';
import { IconClose } from './icons';

export interface NoteData extends Record<string, unknown> { note: NoteCard; highlight: Highlight; sourceTitle: string; pulse: boolean }
export type NoteNodeType = Node<NoteData, 'note'>;

export function NoteNode({ id, data }: NodeProps<NoteNodeType>) {
  const { highlight: hl, sourceTitle, pulse } = data;
  const quote = hl.exact.length > 220 ? hl.exact.slice(0, 217) + '…' : hl.exact;
  return (
    <article className={`card note${pulse ? ' pulse' : ''}`} data-id={id} data-testid="note-card">
      <Handle type="target" position={Position.Left} className="port-in" isConnectableStart={false} />
      <div className="card-head">
        <h3>highlight</h3>
        <button type="button" className="tog del nodrag" title="Remove from board" aria-label="Remove from board" onClick={e => { e.stopPropagation(); useStore.getState().removeNote(id); }}><IconClose /></button>
      </div>
      <div className="card-body">
        <blockquote>{quote}</blockquote>
        {hl.note && <div className="nt">{hl.note}</div>}
        <div className="src">from <button type="button" className="nodrag" onClick={e => { e.stopPropagation(); useStore.getState().select(hl.cardId, { open: true, focus: true }); }}>{sourceTitle}</button></div>
      </div>
      <Handle type="source" position={Position.Right} className="port" title="Drag to another card to connect" />
    </article>
  );
}
