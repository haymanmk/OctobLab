/**
 * Markdown → card graph.
 *
 * One Markdown file becomes one ArticleGraph: the H1 (or the frontmatter title) is the root card,
 * every H2 is a child card, and a section that contains `<!-- split: h3 -->` also turns its H3s into
 * cards. Headings below the split depth stay inside the card body. A fenced block with the language `widget` becomes an interactive widget
 * slot; on GitHub it simply renders as code.
 *
 * What a collapsed card shows is the author's choice, in this order:
 *   1. the parts of the body wrapped in `<!-- preview -->` … `<!-- /preview -->` (they also stay in the body);
 *   2. the Markdown inside `<!-- summary: … -->`;
 *   3. otherwise the opening of the first paragraph, as plain text.
 * The first two are rendered like the body, so math, emphasis, code, lists and tables all work.
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';
import { toString as mdToString } from 'mdast-util-to-string';
import GithubSlugger from 'github-slugger';
import YAML from 'yaml';
import type { Root, RootContent, Heading, Html, Code } from 'mdast';

export interface WidgetRef { name: string; props: Record<string, unknown> }
export interface Card {
  id: string;
  parentId: string | null;
  level: number;
  title: string;
  html: string;
  plain: string;
  /** Plain text of what a collapsed card shows. */
  summary: string;
  /** The same, rendered. This is what the board displays. */
  summaryHtml: string;
  hash: string;
  widgets: WidgetRef[];
}
export interface ArticleGraph {
  id: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  version: string;
  cards: Card[];
}
export interface ArticleMeta { title: string; description: string; date: string; tags?: string[]; split?: 'h2' | 'h3' | 'h4' }

interface Section { level: number; title: string; nodes: RootContent[]; children: Section[]; splitTo: number; summary: string | null; preview: RootContent[]; inPreview: boolean }

const SPLIT_RE = /^<!--\s*split:\s*h([2-6])\s*-->$/i;
const SUMMARY_RE = /^<!--\s*summary:\s*([\s\S]*?)\s*-->$/i;
const PREVIEW_RE = /^<!--\s*(\/)?\s*preview\s*-->$/i;

export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function parseMarkdown(md: string): Root {
  return unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(md) as Root;
}

/** Build a heading tree. Directive comments are consumed and attached to the section they sit in. */
function sectionize(root: Root, fallbackTitle: string): Section {
  const top: Section = { level: 0, title: fallbackTitle, nodes: [], children: [], splitTo: 0, summary: null, preview: [], inPreview: false };
  const stack: Section[] = [top];
  for (const node of root.children) {
    if (node.type === 'heading') {
      const h = node as Heading;
      const sec: Section = { level: h.depth, title: mdToString(h), nodes: [], children: [], splitTo: 0, summary: null, preview: [], inPreview: false };
      while (stack.length > 1 && stack[stack.length - 1].level >= h.depth) stack.pop();
      stack[stack.length - 1].children.push(sec);
      stack.push(sec);
      continue;
    }
    const cur = stack[stack.length - 1];
    if (node.type === 'html') {
      const v = (node as Html).value.trim();
      const sp = SPLIT_RE.exec(v); if (sp) { cur.splitTo = Math.max(cur.splitTo, +sp[1]); continue; }
      const su = SUMMARY_RE.exec(v); if (su) { cur.summary = su[1].trim(); continue; }
      const pv = PREVIEW_RE.exec(v); if (pv) { cur.inPreview = !pv[1]; continue; }
    }
    cur.nodes.push(node);
    if (cur.inPreview) cur.preview.push(node);
  }
  return top;
}

/** Turn ```widget fences into slot HTML and collect the refs. */
function extractWidgets(nodes: RootContent[]): { nodes: RootContent[]; widgets: WidgetRef[] } {
  const widgets: WidgetRef[] = [];
  const out = nodes.map(n => {
    if (n.type === 'code' && (n as Code).lang === 'widget') {
      let cfg: Record<string, unknown> = {};
      try { cfg = (YAML.parse((n as Code).value) as Record<string, unknown>) || {}; } catch { cfg = {}; }
      const { name, ...props } = cfg as { name?: string } & Record<string, unknown>;
      const ref: WidgetRef = { name: String(name || 'unknown'), props };
      widgets.push(ref);
      const attrs = JSON.stringify(props).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      const html: Html = { type: 'html', value: `<div class="widget-slot" data-widget="${ref.name}" data-props="${attrs}"></div>` };
      return html;
    }
    return n;
  });
  return { nodes: out, widgets };
}

async function renderNodes(nodes: RootContent[]): Promise<string> {
  const root: Root = { type: 'root', children: nodes };
  const file = await unified()
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeKatex, { output: 'htmlAndMathml' })
    .use(rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false })
    .use(rehypeStringify)
    .run(root);
  return unified().use(rehypeStringify).stringify(file as never) as string;
}

function plainOf(nodes: RootContent[]): string {
  return nodes.filter(n => !isWidget(n)).map(n => mdToString(n)).join('\n').replace(/\s+/g, ' ').trim();
}

const isWidget = (n: RootContent) => n.type === 'code' && (n as Code).lang === 'widget';
const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** What a collapsed card shows: the author's preview blocks, else the author's summary, else the first paragraph cut short. */
async function summaryOf(sec: Section, plain: string): Promise<{ text: string; html: string }> {
  const chosen = sec.preview.filter(n => !isWidget(n));
  const nodes = chosen.length ? chosen : sec.summary ? parseMarkdown(sec.summary).children : null;
  if (nodes) return { text: nodes.map(n => mdToString(n)).join(' ').replace(/\s+/g, ' ').trim(), html: await renderNodes(nodes) };
  const p = sec.nodes.find(n => n.type === 'paragraph');
  let text = (p ? mdToString(p) : plain).replace(/\s+/g, ' ').trim();
  if (text.length > 170) { const cut = text.slice(0, 170), sp = cut.lastIndexOf(' '); text = (sp > 100 ? cut.slice(0, sp) : cut) + '…'; }
  return { text, html: `<p>${escapeHtml(text)}</p>` };
}

export async function buildArticle(id: string, markdown: string, meta: ArticleMeta): Promise<ArticleGraph> {
  const defaultDepth = meta.split ? +meta.split.slice(1) : 2;
  const tree = sectionize(parseMarkdown(markdown), meta.title);
  const slugger = new GithubSlugger();
  const cards: Card[] = [];

  // Root: an opening H1 becomes the root card; otherwise the preamble is the root.
  let rootSec: Section;
  let rest: Section[];
  if (tree.children.length && tree.children[0].level === 1 && tree.nodes.length === 0) {
    rootSec = tree.children[0]; rest = [...rootSec.children, ...tree.children.slice(1)];
  } else {
    rootSec = { level: 1, title: meta.title, nodes: tree.nodes, children: tree.children, splitTo: tree.splitTo, summary: tree.summary, preview: tree.preview, inPreview: false }; rest = tree.children;
  }
  if (!rootSec.summary && tree.summary) rootSec.summary = tree.summary;
  if (!rootSec.splitTo && tree.splitTo) rootSec.splitTo = tree.splitTo;

  // Walk: a section becomes a card when its level is within the default depth or its parent card asked to split deeper.
  async function emit(sec: Section, parentId: string | null, allowDepth: number): Promise<void> {
    const isCard = parentId === null || sec.level <= allowDepth;
    if (!isCard) return; // folded into the parent body by collect()
    const id = parentId === null ? 'root' : slugger.slug(sec.title);
    const childDepth = Math.max(allowDepth, sec.splitTo);
    const inline: RootContent[] = [...sec.nodes];
    const cardKids: Section[] = [];
    for (const child of sec.children) {
      if (child.level <= childDepth) cardKids.push(child);
      else inline.push(...collect(child));
    }
    const { nodes, widgets } = extractWidgets(inline);
    const plain = plainOf(inline), sum = await summaryOf(sec, plain);
    cards.push({ id, parentId, level: sec.level, title: sec.title, html: await renderNodes(nodes), plain, summary: sum.text, summaryHtml: sum.html, hash: fnv1a(plain), widgets });
    for (const k of cardKids) await emit(k, id, childDepth);
  }
  function collect(sec: Section): RootContent[] {
    const heading: Heading = { type: 'heading', depth: Math.min(6, sec.level) as 1 | 2 | 3 | 4 | 5 | 6, children: [{ type: 'text', value: sec.title }] };
    return [heading, ...sec.nodes, ...sec.children.flatMap(collect)];
  }
  const rootForEmit: Section = { ...rootSec, children: rest };
  await emit(rootForEmit, null, defaultDepth);

  const version = fnv1a(cards.map(c => c.hash).join('|'));
  return { id, title: meta.title, description: meta.description, date: meta.date, tags: meta.tags || [], version, cards };
}
