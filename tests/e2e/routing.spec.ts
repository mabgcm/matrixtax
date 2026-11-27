import { expect, test } from './fixtures';

const legacyRedirects: [string, string][] = [
  ['/index.html', '/'],
  ['/about.html', '/#about'],
  ['/services-detail.html', '/services'],
  ['/contact.html', '/contact'],
  ['/blog.html', '/blog'],
  ['/mail.php', '/contact'],
  [
    '/yeni-mali-yil-oncesi-muhasebe-ve-vergi-hazirliklari-rehberi.html',
    '/blog/yeni-mali-yil-oncesi-muhasebe-ve-vergi-hazirliklari-rehberi',
  ],
  ['/rav-link-inc-seo-basari-hikayesi.html', '/blog/rav-link-inc-seo-basari-hikayesi'],
];

for (const [from, to] of legacyRedirects) {
  test(`legacy ${from} redirects permanently to ${to}`, async ({ request }) => {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe(to);
  });
}

test('trailing slashes are normalised', async ({ request }) => {
  const response = await request.get('/services/', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()['location']).toBe('/services');
});

test('unknown pages get the custom 404 page', async ({ page }) => {
  const response = await page.goto('/shop.html');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("We couldn't find that page");
});

test('security headers are sent', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['permissions-policy']).toContain('camera=()');
  const csp = headers['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
});

test('robots.txt, sitemap and RSS feed are published', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(
    'Sitemap: https://www.matrixtaxsolutions.ca/sitemap-index.xml',
  );

  const sitemap = await request.get('/sitemap-0.xml');
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain('https://www.matrixtaxsolutions.ca/services/tax-problem-resolution');
  expect(xml).not.toContain('/thank-you');
  expect(xml).not.toContain('/contact/error');

  const rss = await request.get('/rss.xml');
  expect(rss.status()).toBe(200);
  expect(await rss.text()).toContain('<item>');
});
