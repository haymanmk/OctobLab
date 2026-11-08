import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    /** Default heading depth that becomes a card. A section can go deeper with <!-- split: h3 -->. */
    split: z.enum(['h2', 'h3', 'h4']).default('h2'),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
