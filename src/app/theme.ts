import type { Theme } from './types';
import { readPref, writePref } from './prefs';

export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return getComputedStyle(document.documentElement).getPropertyValue('--scheme').trim() === 'dark' ? 'dark' : 'light';
}
export function applyTheme(t: Theme | null) {
  if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  writePref('theme', t);
}
export function toggleTheme(): Theme { const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark'; applyTheme(next); return next; }
export function storedTheme(): Theme | null { return readPref<Theme | null>('theme', null); }
/** Fires when the effective theme may have changed: the toggle, or the OS setting. */
export function onThemeChange(cb: () => void): () => void {
  const mo = new MutationObserver(cb); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', cb);
  return () => { mo.disconnect(); mq.removeEventListener('change', cb); };
}
