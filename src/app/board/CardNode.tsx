import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { Card } from '../types';
import { useStore } from '../store';
import { CardHtml } from '../widgets/CardHtml';
import { Poster } from '../widgets/Poster';
import { IconCollapse, IconExpand } from './icons';

export interface CardData extends Record<string, unknown> { card: Card; expanded: boolean; isSelected: boolean; pulse: boolean }
export type CardNodeType = Node<CardData, 'card'>;

export function CardNode({ id, data }: NodeProps<CardNodeType>) {
  const { card, expanded, isSelected, pulse } = data;
  const kids = useStore(s => s.article?.cards.filter(c => c.parentId === id).length ?? 0);
  return (
    <article className={`card l${card.level}${expanded ? ' expanded' : ''}${isSelected ? ' selected' : ''}${pulse ? ' pulse' : ''}`} data-id={id} data-testid={`card-${id}`}>
      <Handle type="target" position={Position.Left} className="port-in" isConnectableStart={false} />
      <div className="card-head">
        <span className="lvl">H{card.level}</span>
        <h3>{card.title}</h3>
        <button type="button" className="tog nodrag" title={expanded ? 'Collapse' : 'Expand in place'} aria-label={expanded ? 'Collapse' : 'Expand in place'} aria-expanded={expanded}
          onClick={e => { e.stopPropagation(); useStore.getState().toggleExpand(id); }}>{expanded ? <IconCollapse /> : <IconExpand />}</button>
      </div>
      <div className={'card-body' + (expanded ? ' nowheel nodrag' : '')}>
        {expanded ? <CardHtml html={card.html} /> : <><p className="sum">{card.summary}</p>{card.widgets.length > 0 && <Poster />}</>}
      </div>
      <div className="card-foot">
        <button type="button" className="read nodrag" onClick={e => { e.stopPropagation(); useStore.getState().select(id, { open: true }); }}>Read</button>
        <span className="kids">{kids ? `${kids} sub-card${kids > 1 ? 's' : ''}` : ''}</span>
      </div>
      <Handle type="source" position={Position.Right} className="port" title="Drag to another card to connect" />
    </article>
  );
}
