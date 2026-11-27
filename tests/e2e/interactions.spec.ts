import { test as base } from '@playwright/test';
import { CONSENT_KEY, THIRD_PARTY, expect, test } from './fixtures';

test.describe('navigation', () => {
  test('mobile menu opens, navigates and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: 'FAQ' }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/\/#faq$/);
  });

  test('mobile quick-contact bar offers call, text and WhatsApp', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'mobile only');
    await page.goto('/');
    const bar = page.getByRole('navigation', { name: 'Quick contact' });
    await expect(bar.getByRole('link', { name: 'Call' })).toHaveAttribute(
      'href',
      'tel:+16476755220',
    );
    await expect(bar.getByRole('link', { name: 'Text' })).toHaveAttribute(
      'href',
      /^sms:\+16476755220/,
    );
    await expect(bar.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
      'href',
      /^https:\/\/wa\.me\/16476755220/,
    );
  });

  test('email links point to the real inboxes', async ({ page }) => {
    await page.goto('/contact');
    const hrefs = await page
      .locator('a[href^="mailto:"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs)
      expect(href).toMatch(/^mailto:(info@matrixtaxsolutions\.ca|rasimoral@hotmail\.com)$/);
  });
});

test.describe('contact form', () => {
  const fillValid = async (page: import('@playwright/test').Page) => {
    await page.getByLabel('Full name').fill('Jane Doe');
    await page.getByLabel('Email').fill('jane@example.com');
    await page.getByLabel('Phone (optional)').fill('(705) 555-0123');
    await page.getByLabel('How can we help?').selectOption('personal-and-corporate-tax');
    await page.getByLabel('Message').fill('I need help filing my personal tax return this year.');
  };

  test('shows accessible inline errors for missing fields', async ({ page }) => {
    await page.goto('/contact');
    await page.getByRole('button', { name: 'Send message' }).click();
    const name = page.getByLabel('Full name');
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toBeFocused();
    await expect(page.getByText('Please enter your name.')).toBeVisible();
    await expect(page.getByText('Please enter your email address.')).toBeVisible();

    await name.fill('Jane Doe');
    await expect(name).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('submits to the API and shows a confirmation', async ({ page }) => {
    let postBody = '';
    await page.route('**/api/contact', async (route) => {
      const request = route.request();
      expect(request.method()).toBe('POST');
      expect(request.headers()['accept']).toContain('application/json');
      postBody = request.postData() ?? '';
      await route.fulfill({ json: { ok: true } });
    });
    await page.goto('/contact');
    await fillValid(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('heading', { name: /your message is on its way/i })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /your message is on its way/i }).locator('..'),
    ).toBeFocused();
    expect(postBody).toContain('jane@example.com');
    expect(postBody).toContain('personal-and-corporate-tax');
    // The honeypot travels empty and the fill-time stamp is set by the script.
    expect(postBody).toMatch(/name="started_at"\r\n\r\n\d{13}/);
  });

  test('displays server-side validation errors', async ({ page }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({
        status: 400,
        json: {
          ok: false,
          code: 'validation',
          message: 'Please check the highlighted fields.',
          errors: { email: 'Please enter a valid email address.' },
        },
      }),
    );
    await page.goto('/contact');
    await fillValid(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('alert')).toHaveText('Please check the highlighted fields.');
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
  });

  test('explains what to do when the network fails', async ({ page }) => {
    await page.route('**/api/contact', (route) => route.abort('failed'));
    await page.goto('/contact');
    await fillValid(page);
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('alert')).toContainText('could not reach our server');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });
});

// Consent tests need a first-time visitor, so they use the base fixture.
base.describe('advertising consent', () => {
  base.beforeEach(async ({ context }) => {
    await context.route(THIRD_PARTY, (route) => route.abort());
  });

  base('the Meta Pixel loads only after the visitor accepts', async ({ page }) => {
    const pixelRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('connect.facebook.net')) pixelRequests.push(request.url());
    });

    await page.goto('/');
    const banner = page.getByRole('region', { name: 'Your privacy' });
    await expect(banner).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(pixelRequests).toEqual([]);

    await banner.getByRole('button', { name: 'Accept' }).click();
    await expect(banner).toBeHidden();
    await expect.poll(() => pixelRequests.length).toBeGreaterThan(0);
    expect(await page.evaluate((key) => localStorage.getItem(key), CONSENT_KEY)).toBe('granted');
  });

  base('declining keeps the pixel off across page views', async ({ page }) => {
    const pixelRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('connect.facebook.net')) pixelRequests.push(request.url());
    });

    await page.goto('/');
    await page
      .getByRole('region', { name: 'Your privacy' })
      .getByRole('button', { name: 'Decline' })
      .click();
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('region', { name: 'Your privacy' })).toBeHidden();
    expect(pixelRequests).toEqual([]);
  });

  base('Global Privacy Control is honoured without asking', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { get: () => true }),
    );
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('region', { name: 'Your privacy' })).toBeHidden();
    expect(await page.evaluate((key) => localStorage.getItem(key), CONSENT_KEY)).toBe('denied');
  });

  base('cookie preferences can be reopened from the footer', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'denied'), CONSENT_KEY);
    await page.goto('/');
    await page.getByRole('button', { name: 'Cookie preferences' }).click();
    await expect(page.getByRole('region', { name: 'Your privacy' })).toBeVisible();
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('content, navigation and the contact form still work', async ({ page, isMobile }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeAttached();

    if (isMobile) {
      // Native popover: opens without any script.
      await page.getByRole('button', { name: 'Open menu' }).click();
      await expect(page.locator('#mobile-menu')).toBeVisible();
    }

    await page.goto('/contact');
    const form = page.locator('form[data-contact-form]');
    await expect(form).toHaveAttribute('action', '/api/contact');
    await expect(form).toHaveAttribute('method', 'post');
    // Native validation stays on when the enhancement script is absent.
    expect(await form.evaluate((element: HTMLFormElement) => element.noValidate)).toBe(false);
  });
});
