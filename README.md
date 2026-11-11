# OctobLab

Working notes on robot control and physical AI, read as a whiteboard of cards instead of a scroll.

Each article is a Markdown file. At build time its headings become a tree of cards: the H1 is the root, every H2 a child, and a section can split further with `<!-- split: h3 -->`. Readers expand cards in place, rearrange and connect them, highlight text in the side reader, and drop highlights onto the board as note cards. Everything a reader changes stays in their browser. The same cards are also published as a plain page for search engines and feed readers.

Live at <https://haymanmk.github.io/OctobLab/>.

## Writing

Posts live in `src/content/posts/*.md` with this frontmatter:

```yaml
title: Nonlinear Disturbance Observer for Robot Control
description: One sentence shown on the home page and in the feed.
date: 2026-11-08
tags: [control]
split: h2        # default depth that becomes a card
```

Inside the body:

- `<!-- split: h3 -->` under a heading turns that section's H3s into cards of their own.
- `<!-- summary: … -->` sets the text a collapsed card shows. Without it, the first paragraph is used.
- A fenced block with the language `widget` places an interactive widget. On GitHub it renders as code.

  ````markdown
  ```widget
  name: ndob-sim
  gain: 30
  ```
  ````

- Inline math uses `$…$`. Display math is centred on its own line and needs the `$$` fences on their own lines:

  ```markdown
  $$
  \dot{\hat d} = L\,(d - \hat d)
  $$
  ```

  A single-line `$$…$$` is treated as inline math by the Markdown parser. KaTeX renders both at build time. Code blocks are highlighted with Shiki in both themes.

Widgets are React components registered in `src/app/widgets/registry.ts`. They receive their fence config as `props` and an `active` flag that is false while they are off screen, so simulations pause.

## Running

```bash
npm install
npm run dev          # http://localhost:4321/OctobLab/
npm run build        # static site in dist/
npm test             # Playwright end-to-end suite against the built site
node scripts/check-ndob-design.mjs   # prints the numbers quoted in the NDOB design article
```

Pushing to `main` builds, runs the test suite, and deploys to GitHub Pages.

## Layout of the code

- `src/lib/cards.ts` – Markdown → card graph (the build step).
- `src/app/` – the reading app: board (`@xyflow/react`), reader, sidebar, store (zustand) and persistence (Dexie over IndexedDB).
- `src/pages/posts/[slug]/` – the board page and the plain reading page for each post.
- `src/pages/articles/` – the list of all posts, and one page per tag.
- `tests/` – end-to-end tests for desktop, phone and tablet input.
