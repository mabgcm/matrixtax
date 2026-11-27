import AxeBuilder from '@axe-core/playwright';
import { PAGES, expect, test } from './fixtures';

const SITE = 'https://www.matrixtaxsolutions.ca';

for (const path of PAGES) {
  test.describe(path, () => {
    test('renders cleanly under the production CSP', async ({ page, baseURL }) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 400 && response.url().startsWith(baseURL ?? '')) {
          problems.push(`${response.status()} ${response.url()}`);
        }
      });

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(response?.headers()['content-security-policy']).toContain("default-src 'self'");

      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page).toHaveTitle(/Matrix Tax Solutions/);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{50,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        path === '/' ? `${SITE}/` : `${SITE}${path}`,
      );

      // Load lazy images and below-the-fold content, then check the layout.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      });
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(1);

      const brokenImages = await page.evaluate(() =>
        Array.from(document.images)
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src),
      );
      expect(brokenImages).toEqual([]);
      expect(problems).toEqual([]);
    });

    test('has no detectable WCAG 2.1 AA violations', async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const summary = results.violations.map(
        (violation) =>
          `${violation.id} (${violation.impact}): ${violation.nodes
            .slice(0, 3)
            .map((node) => node.target.join(' '))
            .join(' | ')}`,
      );
      expect(summary).toEqual([]);
    });
  });
}

test('blog posts declare their language', async ({ page }) => {
  await page.goto('/blog/yeni-mali-yil-oncesi-muhasebe-ve-vergi-hazirliklari-rehberi');
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(page.locator('header.site-header').locator('xpath=..')).toHaveAttribute(
    'lang',
    'en',
  );

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
});

test('structured data is valid JSON with the business node', async ({ page }) => {
  await page.goto('/');
  const raw = await page.locator('script[type="application/ld+json"]').textContent();
  const data = JSON.parse(raw ?? '{}');
  const types = (data['@graph'] as { '@type': string }[]).map((node) => node['@type']);
  expect(types).toEqual(expect.arrayContaining(['AccountingService', 'WebSite', 'FAQPage']));
});
