import type { MouseEvent } from 'react';
import { useStore } from './store';
import { toast } from './toast';

/** The part of a URL hash after '#', decoded; malformed escapes are left as written. */
export function decodeHash(hash: string): string {
  const raw = hash.replace(/^#/, '');
  try { return decodeURIComponent(raw); } catch { return raw; }
}

/** On the board, heading ids are kept as data-anchor (see CardHtml), so two renderings of one card never share an id. */
export function findAnchor(root: Element, anchor: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>('[data-anchor]')) if (el.dataset.anchor === anchor) return el;
  return null;
}

/** Scroll `el` to the top of its scrolling container and flash it. Works inside a zoomed board card too. */
export function scrollToAnchor(scroller: HTMLElement, el: HTMLElement) {
  const box = scroller.getBoundingClientRect();
  const zoom = scroller.offsetHeight ? box.height / scroller.offsetHeight : 1;
  scroller.scrollTop += (el.getBoundingClientRect().top - box.top) / (zoom || 1) - 12;
  el.classList.remove('anchor-flash'); void el.offsetWidth; el.classList.add('anchor-flash');
}

/**
 * Click handler for rendered article text. A link to `#heading` scrolls there when the heading is in the same
 * text, and otherwise opens the card that holds it. Links to other pages are left to the browser.
 */
export function onContentLinkClick(e: MouseEvent<HTMLElement>, scroller: HTMLElement | null) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest('a[href]'); if (!a) return;
  const href = a.getAttribute('href') || ''; if (!href.startsWith('#')) return;
  e.preventDefault();
  const anchor = decodeHash(href); if (!anchor) return;
  const here = scroller ? findAnchor(scroller, anchor) : null;
  if (here && scroller) { scrollToAnchor(scroller, here); return; }
  if (!useStore.getState().goToAnchor(anchor, { push: true })) toast('That link points to a heading this article does not have.');
}
