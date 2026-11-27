import { test as base, expect } from '@playwright/test';

export const CONSENT_KEY = 'mts.consent.v1';
export const THIRD_PARTY = /connect\.facebook\.net|facebook\.com|challenges\.cloudflare\.com/;

export const PAGES = [
  '/',
  '/services',
  '/services/personal-and-corporate-tax',
  '/services/accounting-bookkeeping-payroll',
  '/services/business-registration-consulting',
  '/services/tax-problem-resolution',
  '/blog',
  '/blog/yeni-mali-yil-oncesi-muhasebe-ve-vergi-hazirliklari-rehberi',
  '/blog/rav-link-inc-seo-basari-hikayesi',
  '/contact',
  '/privacy',
  '/thank-you',
  '/contact/error',
] as const;

/**
 * Default fixture: third-party requests are blocked and the visitor has
 * already declined advertising cookies, so tests are hermetic and the
 * consent banner does not cover the page.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(THIRD_PARTY, (route) => route.abort());
    await context.addInitScript((key) => localStorage.setItem(key, 'denied'), CONSENT_KEY);
    await use(context);
  },
});

export { expect };
