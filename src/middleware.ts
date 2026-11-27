import { defineMiddleware } from 'astro:middleware';

/**
 * Every image is optimised at build time and served from /_astro, so Astro's
 * on-demand image endpoint (/_image) is unused in production. Left open, it
 * would let anyone make the serverless function resize and re-encode images
 * on request: CPU time that is billed. Close it in production; the dev server
 * still uses it.
 */
export const onRequest = defineMiddleware((context, next) => {
  if (import.meta.env.PROD && context.url.pathname === '/_image') {
    return new Response('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' },
    });
  }
  return next();
});
