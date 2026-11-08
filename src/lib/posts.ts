import { getCollection, type CollectionEntry } from 'astro:content';
import { buildArticle, type ArticleGraph } from './cards';

export type Post = CollectionEntry<'posts'>;
export const BASE = import.meta.env.BASE_URL.replace(/\/?$/, '/');

export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('posts', (e: Post) => !e.data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

const cache = new Map<string, Promise<ArticleGraph>>();
/** The card graph for a post, built once per build. */
export function articleOf(entry: Post): Promise<ArticleGraph> {
  let p = cache.get(entry.id);
  if (!p) {
    p = buildArticle(entry.id, entry.body ?? '', { title: entry.data.title, description: entry.data.description, date: entry.data.date.toISOString().slice(0, 10), tags: entry.data.tags, split: entry.data.split });
    cache.set(entry.id, p);
  }
  return p;
}
