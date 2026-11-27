import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { site as siteConfig } from '@/config/site';
import { getPublishedPosts } from '@/lib/content';

export const GET: APIRoute = async ({ site }) => {
  const posts = await getPublishedPosts();
  return rss({
    title: `${siteConfig.name} — Blog`,
    description: 'Guides on tax, accounting and running a small business in Canada.',
    site: site ?? siteConfig.url,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/blog/${post.id}`,
      categories: post.data.tags,
    })),
    customData: '<language>en-ca</language>',
  });
};
