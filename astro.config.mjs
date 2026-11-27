// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

const SITE_URL = 'https://www.matrixtaxsolutions.ca';

/** Pages that must never appear in the sitemap. */
const NOT_INDEXED = ['/thank-you', '/contact/error', '/404'];

/**
 * Permanent redirects for URLs of the legacy HTML template so that existing
 * links and search results keep working. Template-only pages that never had
 * real content (shop, pricing, team, projects) are intentionally left to 404.
 */
const legacyRedirects = Object.fromEntries(
  Object.entries({
    '/index.html': '/',
    '/index-2.html': '/',
    '/index-3.html': '/',
    '/about.html': '/#about',
    '/services.html': '/services',
    '/services-detail.html': '/services',
    '/contact.html': '/contact',
    '/mail.php': '/contact',
    '/blog.html': '/blog',
    '/blog-details.html': '/blog',
    '/yeni-mali-yil-oncesi-muhasebe-ve-vergi-hazirliklari-rehberi.html':
      '/blog/yeni-mali-yil-oncesi-muhasebe-ve-vergi-hazirliklari-rehberi',
    '/rav-link-inc-seo-basari-hikayesi.html': '/blog/rav-link-inc-seo-basari-hikayesi',
  }).map(([from, to]) => [from, { status: /** @type {const} */ (301), destination: to }]),
);

/**
 * Astro applies the CSP in `astro dev` too, but the Vite dev server injects
 * CSS as inline <style> tags, which a strict policy blocks. Enforce the CSP
 * for builds only; production behaviour is covered by the e2e tests.
 * @type {import('astro').AstroIntegration}
 */
const cspInBuildOnly = {
  name: 'csp-in-build-only',
  hooks: {
    'astro:config:setup': ({ command, updateConfig }) => {
      if (command === 'dev') updateConfig({ security: { csp: false } });
    },
  },
};

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'never',
  output: 'static',

  adapter: vercel({
    // Cookieless, privacy-friendly analytics served from the same origin.
    webAnalytics: { enabled: true },
    // Emit the CSP below as a real HTTP header (enables frame-ancestors, etc.).
    staticHeaders: true,
    maxDuration: 10,
  }),

  integrations: [
    cspInBuildOnly,
    sitemap({
      filter: (page) => !NOT_INDEXED.some((path) => new URL(page).pathname.startsWith(path)),
    }),
  ],

  redirects: legacyRedirects,

  // The floating dev toolbar overlaps the mobile quick-contact bar during review.
  devToolbar: { enabled: false },

  markdown: {
    // No code blocks on this site; Shiki's inline styles would also conflict with the CSP.
    syntaxHighlight: false,
  },

  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },

  image: {
    responsiveStyles: true,
  },

  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: ['400 700'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Manrope',
      cssVariable: '--font-manrope',
      weights: ['500 800'],
      styles: ['normal'],
      subsets: ['latin', 'latin-ext'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
  ],

  env: {
    schema: {
      RESEND_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTACT_TO_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      CONTACT_FROM_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
      TURNSTILE_SECRET_KEY: envField.string({
        context: 'server',
        access: 'secret',
        optional: true,
      }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        optional: true,
      }),
      // Not a secret (it is visible in page source). Set to an empty string to disable.
      PUBLIC_META_PIXEL_ID: envField.string({
        context: 'client',
        access: 'public',
        default: '1523587012050536',
      }),
    },
  },

  security: {
    checkOrigin: true,
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'self'",
        "img-src 'self' data: https://www.facebook.com",
        "font-src 'self'",
        "connect-src 'self' https://www.facebook.com https://connect.facebook.net https://challenges.cloudflare.com",
        'frame-src https://challenges.cloudflare.com',
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "manifest-src 'self'",
        'upgrade-insecure-requests',
      ],
      scriptDirective: {
        resources: ["'self'", 'https://connect.facebook.net', 'https://challenges.cloudflare.com'],
      },
      styleDirective: {
        resources: ["'self'"],
      },
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
