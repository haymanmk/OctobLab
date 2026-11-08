import type { Highlight } from './types';

/** Text nodes of the rendered card, skipping KaTeX's MathML twin and widget UI. */
export function textNodes(root: Node): Text[] {
  const out: Text[] = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
      for (let p = n.parentElement; p && p !== root; p = p.parentElement) {
        if (p.classList.contains('katex-mathml') || p.classList.contains('widget') || p.classList.contains('widget-slot')) return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let n: Node | null; while ((n = w.nextNode())) out.push(n as Text);
  return out;
}
export const plainText = (root: Node) => textNodes(root).map(n => n.nodeValue).join('');

export function rangeToOffsets(root: Node, range: Range): { start: number; end: number } | null {
  let off = 0, start = -1, end = -1;
  for (const n of textNodes(root)) {
    const len = n.nodeValue!.length;
    if (range.intersectsNode(n)) { if (start < 0) start = off + (n === range.startContainer ? range.startOffset : 0); end = off + (n === range.endContainer ? range.endOffset : len); }
    off += len;
  }
  return start >= 0 && end > start ? { start, end } : null;
}
export function offsetsToRange(root: Node, start: number, end: number): Range | null {
  let off = 0, s = false; const r = document.createRange();
  for (const n of textNodes(root)) {
    const len = n.nodeValue!.length;
    if (!s && start <= off + len) { r.setStart(n, start - off); s = true; }
    if (s && end <= off + len) { r.setEnd(n, end - off); return r; }
    off += len;
  }
  return null;
}
/** Re-find a highlight: exact position first, then the same quote with the best matching context. */
export function anchorHighlight(txt: string, hl: Highlight): { start: number; end: number } | null {
  if (txt.slice(hl.start, hl.end) === hl.exact) return { start: hl.start, end: hl.end };
  let idx = -1, best: number | null = null, bestScore = -1, from = 0;
  while ((idx = txt.indexOf(hl.exact, from)) >= 0) {
    const pre = txt.slice(Math.max(0, idx - 32), idx), suf = txt.slice(idx + hl.exact.length, idx + hl.exact.length + 32);
    let sc = 0;
    for (let i = 1; i <= Math.min(pre.length, hl.prefix.length); i++) { if (pre[pre.length - i] === hl.prefix[hl.prefix.length - i]) sc++; else break; }
    for (let i = 0; i < Math.min(suf.length, hl.suffix.length); i++) { if (suf[i] === hl.suffix[i]) sc++; else break; }
    if (sc > bestScore) { bestScore = sc; best = idx; }
    from = idx + 1;
  }
  return best == null ? null : { start: best, end: best + hl.exact.length };
}
/** Caret position under a point, as (text node, offset). */
export function caretAt(x: number, y: number): { node: Node; offset: number } | null {
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null; caretRangeFromPoint?: (x: number, y: number) => Range | null };
  if (d.caretPositionFromPoint) { const p = d.caretPositionFromPoint(x, y); return p ? { node: p.offsetNode, offset: p.offset } : null; }
  if (d.caretRangeFromPoint) { const r = d.caretRangeFromPoint(x, y); return r ? { node: r.startContainer, offset: r.startOffset } : null; }
  return null;
}
