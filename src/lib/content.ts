import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

const WORDS_PER_MINUTE = 200;

/** Published posts, newest first. Drafts are visible only in development. */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function readingMinutes(markdown: string | undefined): number {
  const words = (markdown ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

const ui = {
  en: { minRead: (n: number) => `${n} min read`, language: 'English' },
  tr: { minRead: (n: number) => `${n} dk okuma`, language: 'Türkçe' },
} as const;

export const postUi = (lang: 'en' | 'tr') => ui[lang];

export function formatDate(date: Date, lang: 'en' | 'tr'): string {
  return new Intl.DateTimeFormat(lang === 'tr' ? 'tr-TR' : 'en-CA', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}
