// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Served from GitHub Pages at https://haymanmk.github.io/OctobLab/
export default defineConfig({
  site: 'https://haymanmk.github.io',
  base: '/OctobLab',
  trailingSlash: 'always',
  integrations: [react(), sitemap()],
  build: { format: 'directory' },
  // ```widget fences are configuration, not code; keep Astro's own Markdown pass quiet about them
  markdown: { shikiConfig: { langAlias: { widget: 'yaml' } } },
});
