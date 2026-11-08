import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts, BASE } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: 'OctobLab',
    description: 'Working notes on robot control and physical AI, read as a whiteboard of cards.',
    site: new URL(BASE, context.site!).toString(),
    items: posts.map(p => ({ title: p.data.title, pubDate: p.data.date, description: p.data.description, link: `${BASE}posts/${p.id}/read/` })),
  });
}
