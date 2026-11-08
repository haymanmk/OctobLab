export type { ArticleGraph, Card, WidgetRef } from '../lib/cards';

export interface Pos { x: number; y: number }
export interface Size { w: number; h: number }
export interface Rect extends Pos, Size {}

export interface UserEdge { id: string; from: string; to: string }

/** Everything a reader changes about the board, per article. The article itself is never touched. */
export interface Overlay {
  articleId: string;
  positions: Record<string, Pos>;
  expanded: string[];
  hiddenEdges: string[];
  userEdges: UserEdge[];
  manual: boolean;
  updatedAt: number;
}

export interface Highlight {
  id: string;
  articleId: string;
  cardId: string;
  exact: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
  note: string;
  cardHash: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface NoteCard {
  id: string;
  articleId: string;
  highlightId: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export type InputMode = 'mouse' | 'touch';
export type LayoutMode = 'desk' | 'phone' | 'square' | 'fold';
export type Theme = 'light' | 'dark';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
