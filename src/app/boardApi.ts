import type { Pos } from './types';
/** The board registers itself here so the reader and the notes list can drop onto it without a React dependency. */
export interface BoardApi {
  screenToFlow(x: number, y: number): Pos;
  rect(): DOMRect | null;
  el(): HTMLElement | null;
  visible(): boolean;
  focus(id: string): void;
  fit(): void;
  isOnScreen(id: string): boolean;
}
let api: BoardApi | null = null;
export const setBoardApi = (a: BoardApi | null) => { api = a; };
export const boardApi = () => api;
export function overBoard(x: number, y: number): boolean {
  const r = api?.visible() ? api.rect() : null;
  return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}
