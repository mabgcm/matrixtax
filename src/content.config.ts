import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(10).max(120),
      /** Optional shorter title for <title>/og:title when `title` is long. */
      seoTitle: z.string().max(70).optional(),
      description: z.string().min(50).max(200),
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      lang: z.enum(['en', 'tr']).default('en'),
      heroImage: image(),
      heroAlt: z.string().min(5),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    }),
});

const services = defineCollection({
  loader: glob({ base: './src/content/services', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    /** Short label used in navigation, chips and form options. */
    shortTitle: z.string(),
    summary: z.string().max(220),
    description: z.string().min(50).max(200),
    icon: z.enum(['receipt', 'calculator', 'building', 'shield']),
    order: z.number().int(),
    highlights: z.array(z.string()).min(3).max(6),
  }),
});

export const collections = { blog, services };
