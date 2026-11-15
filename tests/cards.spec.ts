import { test, expect } from '@playwright/test';
import { buildArticle } from '../src/lib/cards';

/* The Markdown → cards build step, without a browser. */

const META = { title: 'Fixture', description: 'd', date: '2026-01-01' };
const MD = `# Fixture Title

Intro with a [link](#inner-detail).

## First

Text.

### Inner detail

Stays inside the card "First" because nothing asked to split at h3.

## Same name

Twin A.

## Same name

<!-- split: h3 -->

Twin B.

### Split child

Becomes a card of its own.
`;

test('every heading gets its GitHub slug, and anchors say which card holds it', async () => {
  const a = await buildArticle('fixture', MD, META);
  expect(a.cards.map(c => c.id)).toEqual(['root', 'first', 'same-name', 'same-name-1', 'split-child']);
  expect(a.titleAnchor).toBe('fixture-title');
  expect(a.anchors).toEqual({
    root: 'root', 'fixture-title': 'root',
    first: 'first', 'inner-detail': 'first',
    'same-name': 'same-name', 'same-name-1': 'same-name-1',
    'split-child': 'split-child',
  });
});

test('a heading that stays inside a card body keeps its slug as an id, so links can reach it', async () => {
  const a = await buildArticle('fixture', MD, META);
  const first = a.cards.find(c => c.id === 'first')!;
  expect(first.html).toContain('<h3 id="inner-detail">Inner detail</h3>');
  expect(a.cards[0].html).toContain('<a href="#inner-detail">link</a>');
});

test('a link to a heading that does not exist is reported at build time', async () => {
  const warnings: string[] = []; const orig = console.warn; console.warn = (...args: unknown[]) => { warnings.push(args.join(' ')); };
  try {
    await buildArticle('fixture', MD + '\nSee [nowhere](#no-such-heading).\n', META);
    await buildArticle('fixture', MD, META);
  } finally { console.warn = orig; }
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('#no-such-heading');
  expect(warnings[0]).toContain('Split child');
});
