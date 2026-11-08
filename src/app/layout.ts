import type { Card, Pos, Rect, Size } from './types';

const GX = 80, GY = 24, MARGIN = 20;

/** Left-to-right tidy tree: columns by level, siblings stacked, parents centred on their children. */
export function tidyTree(cards: Card[], size: (id: string) => Size): Record<string, Pos> {
  const children = (id: string) => cards.filter(c => c.parentId === id);
  const cols: number[] = []; const colX: number[] = [];
  cards.forEach(c => { cols[c.level - 1] = Math.max(cols[c.level - 1] || 0, size(c.id).w); });
  let x = 0; cols.forEach((w, i) => { colX[i] = x; x += (w || 280) + GX; });
  const sub: Record<string, number> = {};
  const kidsTotal = (kids: Card[]) => kids.reduce((a, k, i) => a + sub[k.id] + (i ? GY : 0), 0);
  const measure = (id: string): number => { const kids = children(id), h = size(id).h; kids.forEach(k => measure(k.id)); sub[id] = kids.length ? Math.max(h, kidsTotal(kids)) : h; return sub[id]; };
  const out: Record<string, Pos> = {};
  const level = (id: string) => cards.find(c => c.id === id)!.level;
  const place = (id: string, top: number) => { const h = size(id).h, kids = children(id), block = sub[id]; out[id] = { x: colX[level(id) - 1] ?? 0, y: top + (block - h) / 2 }; let cy = top + (block - kidsTotal(kids)) / 2; kids.forEach(k => { place(k.id, cy); cy += sub[k.id] + GY; }); };
  let y = 0; cards.filter(c => !c.parentId).forEach(r => { measure(r.id); place(r.id, y); y += sub[r.id] + GY * 2; });
  return out;
}

const overlap = (A: Rect, B: Rect, m = 0) => ({
  ox: Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) + m,
  oy: Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) + m,
});

/** Push every card that overlaps the anchor away from it, cascading. Returns only the cards that moved. */
export function resolveOverlaps(rects: Record<string, Rect>, anchorId: string): Record<string, Pos> {
  const R: Record<string, Rect> = {}; for (const id in rects) R[id] = { ...rects[id] };
  if (!R[anchorId]) return {};
  const moved: Record<string, Pos> = {}; const done = new Set([anchorId]); const queue = [anchorId]; let guard = 0;
  while (queue.length && guard++ < 500) {
    const a = queue.shift()!, A = R[a];
    for (const id in R) {
      if (done.has(id)) continue; const C = R[id];
      const { ox, oy } = overlap(A, C, MARGIN); if (ox <= 0 || oy <= 0) continue;
      const dx = (C.x + C.w / 2) - (A.x + A.w / 2), dy = (C.y + C.h / 2) - (A.y + A.h / 2);
      if (Math.abs(dx) / (A.w + C.w) > Math.abs(dy) / (A.h + C.h)) C.x += (dx >= 0 ? 1 : -1) * ox; else C.y += (dy >= 0 ? 1 : -1) * oy;
      moved[id] = { x: C.x, y: C.y }; done.add(id); queue.push(id);
    }
  }
  return moved;
}

/** Slide one card downwards until it overlaps nothing. */
export function nudgeFree(rects: Record<string, Rect>, id: string): Pos {
  const A = { ...rects[id] };
  for (let i = 0; i < 60; i++) {
    const hit = Object.keys(rects).find(o => { if (o === id) return false; const { ox, oy } = overlap(A, rects[o]); return ox > 0 && oy > 0; });
    if (!hit) break; A.y = rects[hit].y + rects[hit].h + MARGIN;
  }
  return { x: A.x, y: A.y };
}
