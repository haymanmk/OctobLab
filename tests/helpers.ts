import { expect, type Page } from '@playwright/test';

export const BOARD = 'posts/ndob/';
export const CARD_COUNT = 10;

export async function openBoard(page: Page, hash = '', { keepHelp = false } = {}) {
  await page.goto(BOARD + hash);
  await expect(page.getByTestId('board')).toBeVisible();
  await expect(page.locator('.react-flow__node-card')).toHaveCount(CARD_COUNT);
  await expect(page.locator('.react-flow__node-card').first()).toBeVisible();
  if (!keepHelp) { const close = page.getByRole('button', { name: 'Close help' }); if (await close.count()) await close.click(); }
  await page.waitForTimeout(400);
}

export interface R { id: string; x: number; y: number; w: number; h: number }
export const nodeRects = (page: Page): Promise<R[]> => page.evaluate(() =>
  [...document.querySelectorAll<HTMLElement>('.react-flow__node')].map(el => {
    const m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform);
    return { id: el.getAttribute('data-id') || '', x: m ? +m[1] : 0, y: m ? +m[2] : 0, w: el.offsetWidth, h: el.offsetHeight };
  }));
export async function overlaps(page: Page, filter: (id: string) => boolean = () => true): Promise<string[]> {
  const R = (await nodeRects(page)).filter(r => filter(r.id)); const out: string[] = [];
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const A = R[i], B = R[j];
    if (Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x) > 0 && Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y) > 0) out.push(A.id + '/' + B.id);
  }
  return out;
}
export const card = (id: string) => `.react-flow__node-card[data-id="${id}"]`;
export const isCardId = (id: string) => !/^[a-z0-9]{12}$/.test(id);

/** Programmatic text selection inside the reader, followed by the pointerup the app listens for. */
export async function selectInReader(page: Page, from: number, to: number, pointerType = 'mouse') {
  return page.evaluate(([a, b, pt]) => {
    const content = document.querySelector('#__none, .reader .content')!;
    const pEl = [...content.querySelectorAll('p')].find(p => p.firstChild && p.firstChild.nodeType === 3 && p.firstChild.nodeValue!.length > 60)!;
    const len = pEl.firstChild!.nodeValue!.length; const start = Math.min(a, len - 10), end = Math.min(b, len);
    const r = document.createRange(); r.setStart(pEl.firstChild!, start); r.setEnd(pEl.firstChild!, end);
    const sel = getSelection()!; sel.removeAllRanges(); sel.addRange(r);
    const rb = r.getBoundingClientRect();
    document.querySelector('.reader-body')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: pt as string, clientX: rb.left + 5, clientY: rb.top + 5 }));
    return { x: rb.left + 5, y: rb.top + 5 };
  }, [from, to, pointerType] as const);
}
export const highlightCount = (page: Page) => page.evaluate(() => (CSS as unknown as { highlights: Map<string, { size: number }> }).highlights.get('hl')?.size ?? 0);
export const highlightCenter = (page: Page) => page.evaluate(() => { const H = (CSS as unknown as { highlights: Map<string, Iterable<Range>> }).highlights.get('hl'); const r = H ? [...H][0] : null; if (!r) return null; const b = r.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
/** A point on the edge that is not covered by a card, so a click reaches the edge. */
export const edgeMidpoint = (page: Page, selector: string) => page.evaluate(sel => {
  const g = document.querySelector<SVGGElement>(sel); const p = g?.querySelector<SVGPathElement>('.react-flow__edge-path'); if (!g || !p) return null;
  const m = p.getScreenCTM()!, len = p.getTotalLength();
  for (const f of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.15, 0.85]) {
    const pt = p.getPointAtLength(len * f); const x = pt.x * m.a + pt.y * m.c + m.e, y = pt.x * m.b + pt.y * m.d + m.f;
    const e = document.elementFromPoint(x, y); if (e && g.contains(e)) return { x, y };
  }
  const pt = p.getPointAtLength(len / 2); return { x: pt.x * m.a + pt.y * m.c + m.e, y: pt.x * m.b + pt.y * m.d + m.f };
}, selector);
export const bgPoint = (page: Page) => page.evaluate(() => {
  const pane = document.querySelector('.react-flow__pane')!.getBoundingClientRect();
  for (let y = pane.bottom - 80; y > pane.top + 80; y -= 24) for (let x = pane.left + 20; x < pane.right - 20; x += 24) {
    const e = document.elementFromPoint(x, y); if (e && (e.classList.contains('react-flow__pane') || e.closest('.react-flow__background'))) return { x, y };
  }
  return { x: pane.left + 40, y: pane.bottom - 40 };
});
