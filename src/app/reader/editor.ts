import { create } from 'zustand';
import type { Highlight } from '../types';
interface EditorState { hl: Highlight | null; rect: DOMRect | null; open: (hl: Highlight, rect: DOMRect) => void; close: () => void }
export const useEditor = create<EditorState>(set => ({ hl: null, rect: null, open: (hl, rect) => set({ hl, rect }), close: () => set({ hl: null, rect: null }) }));
