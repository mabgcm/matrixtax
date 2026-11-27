# Matrix Tax Solutions — website

Marketing website for [Matrix Tax Solutions](https://www.matrixtaxsolutions.ca), a tax and
accounting practice in Barrie, Ontario.

- **Fast:** pages are pre-rendered static HTML. Images are served as AVIF/WebP, fonts are
  self-hosted, and pages ship almost no JavaScript.
- **Secure:** a strict, hash-based Content-Security-Policy with no `unsafe-inline`, plus security
  headers. The contact endpoint is hardened (validation, spam traps, rate limiting, CSRF origin
  check).
- **Mobile-first:** a quick-contact bar (call / text / WhatsApp / book), native popover menu and
  touch-sized targets.
- **Searchable:** canonical URLs, Open Graph, `AccountingService` / `BlogPosting` / `FAQPage`
  structured data, sitemap, RSS and 301s from every legacy URL.
- **Private by default:** Vercel Web Analytics is cookie-free. The Meta Pixel loads only after
  consent, and Global Privacy Control is honoured.

## Stack

| Concern         | Choice                                                                               |
| --------------- | ------------------------------------------------------------------------------------ |
| Framework       | [Astro 7](https://astro.build) — static output; one on-demand route (`/api/contact`) |
| Styling         | Tailwind CSS 4 + `@tailwindcss/typography`                                           |
| Hosting         | Vercel (`@astrojs/vercel` adapter)                                                   |
| Content         | Markdown content collections with Zod schemas (`src/content/`)                       |
| Email           | [Resend](https://resend.com) REST API (no SDK)                                       |
| Spam protection | Honeypot, minimum fill time, per-IP rate limit; optional Cloudflare Turnstile        |
| Tests           | Vitest (unit + API handler), Playwright + axe-core (e2e and accessibility)           |
| Icons           | Lucide (`@lucide/astro`), Simple Icons (WhatsApp)                                    |

## Getting started

```bash
nvm use            # Node 24 (see .nvmrc); Node 22.23+ or 24 is required
npm install
cp .env.example .env   # optional; everything works without it locally
npm run dev            # http://localhost:4321
```

Without `RESEND_API_KEY`, form submissions in development are logged to the terminal instead of
being emailed.

### Scripts

| Command                           | What it does                                                        |
| --------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                     | Dev server with hot reload                                          |
| `npm run build`                   | Production build into `.vercel/output`                              |
| `npm run check`                   | TypeScript and Astro diagnostics                                    |
| `npm test`                        | Unit tests (validation, rate limiting, email, API handler, SEO)     |
| `npm run test:e2e`                | Playwright against the production build (run `npm run build` first) |
| `npm run format` / `format:check` | Prettier (Astro + Tailwind class sorting)                           |
| `npm run verify`                  | Format check, type check, unit tests and build                      |

E2E tests use Playwright's Chromium (`npx playwright install chromium`). To use a locally
installed Chrome instead, set `PLAYWRIGHT_CHANNEL=chrome`. To test a deployed preview, set
`BASE_URL=https://…`.

## Project structure

```text
src/
  config/site.ts          Single source of truth: name, phones, emails, address, links
  content/
    services/*.md         One file per service page (/services/<file-name>)
    blog/*.md             Blog posts (/blog/<file-name>)
  content.config.ts       Zod schemas for the collections
  data/faq.ts             FAQ entries (also emitted as FAQPage structured data)
  layouts/BaseLayout.astro
  components/             brand/, layout/, sections/, contact/, seo/, ui/
  lib/                    Pure, unit-tested logic (contact/*, seo.ts, content.ts)
  scripts/                Small client-side modules (analytics/consent, nav, form)
  pages/                  Routes; api/contact.ts is the only server-rendered route
tests/
  unit/                   Vitest
  e2e/                    Playwright; vercel-static-server.mjs replays Vercel's routing/headers
```

## Editing content

**Contact details.** Edit `src/config/site.ts`. Every phone number, email address and link on
the site comes from this file.

**A new blog post.** Add `src/content/blog/my-post-slug.md`:

```md
---
title: Year-end checklist for small businesses
description: A 50–200 character summary used for search results and social previews.
pubDate: 2026-12-01
lang: en # or tr
heroImage: ../../assets/blog/my-image.jpg
heroAlt: Describe the image for screen readers
tags: [bookkeeping, year-end]
---

Your content in Markdown. Use ## for section headings.
```

Put the image in `src/assets/blog/`. It is resized and converted to AVIF/WebP automatically. The
build fails if the frontmatter is invalid, so mistakes never reach production. Set `draft: true`
to hide a post in production.

**Services.** Each file in `src/content/services/` is a page. The frontmatter controls the
cards, the form's service list and the footer.

## Contact form

`POST /api/contact` accepts `multipart/form-data` or `application/x-www-form-urlencoded`.

- **JavaScript clients** (`Accept: application/json`) get JSON: `{ ok, code?, message?, errors? }`.
- **Plain HTML posts** (no JavaScript) are redirected (303) to `/thank-you` or `/contact/error`.
- **Defences:**
  - Astro's origin check (CSRF)
  - 32 KB body limit
  - 5 requests per 10 minutes per IP
  - Honeypot field and minimum fill time; bots receive a fake success
  - Strict server-side validation, with line breaks stripped from header fields
  - HTML-escaped email body
  - Optional Turnstile
- **Delivery:** emails go to `CONTACT_TO_EMAIL` with `Reply-To` set to the visitor. The visitor
  never receives an automatic email, so the form cannot be abused to send spam to third parties.

The in-memory rate limiter protects each warm function instance. For a global limit, add a
Vercel Firewall rate-limit rule for `/api/contact`.

## Security headers

- **CSP:** generated by Astro at build time. It contains SHA-256 hashes of every inline script
  and style, and the Vercel adapter sends it as an HTTP header (`staticHeaders: true`). Allowed
  third parties are only Meta (`connect.facebook.net`, `www.facebook.com`) and Cloudflare
  Turnstile.
- **Other headers:** set in `vercel.json`: `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `X-Frame-Options` and `Cross-Origin-Opener-Policy`.

If you add a third-party script, add its origin to `security.csp` in `astro.config.mjs`. The e2e
suite fails on any CSP violation.

## Deployment checklist (Vercel)

1. **Framework preset:** pinned to Astro in `vercel.json`, so it works even if the project was
   created as a static ("Other") site. The build command (`npm run build`) and output
   (`.vercel/output`) are detected automatically.
2. **Node.js version:** comes from `engines` in `package.json` (Vercel uses Node 24).
3. **Resend:**
   - Create an account.
   - Verify the `matrixtaxsolutions.ca` domain by adding the DNS records Resend gives you.
   - Set these environment variables for Production and Preview:
     - `RESEND_API_KEY`
     - `CONTACT_FROM_EMAIL`, e.g. `Matrix Tax Website <website@matrixtaxsolutions.ca>`
     - `CONTACT_TO_EMAIL` (defaults to `info@matrixtaxsolutions.ca`)
   - Without the key, the production form answers "temporarily unavailable" and shows the phone
     number and email.
4. **Optional, recommended — Cloudflare Turnstile:** set `PUBLIC_TURNSTILE_SITE_KEY` and
   `TURNSTILE_SECRET_KEY`.
5. **Optional — Meta Pixel ID:** `PUBLIC_META_PIXEL_ID` defaults to the existing pixel. Set it
   to an empty string to disable the pixel.
6. **Domain:** make the apex → `www` domain redirect permanent (308) in Vercel → Domains.
7. **Vercel Web Analytics:** keep it enabled for the project.
8. **After deploying:** submit `https://www.matrixtaxsolutions.ca/sitemap-index.xml` in Google
   Search Console.
