import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the production build served with Vercel's
 * routing and headers (see tests/e2e/vercel-static-server.mjs). Run
 * `npm run build` first. Set BASE_URL to test a deployed preview instead.
 * Set PLAYWRIGHT_CHANNEL=chrome to use a locally installed Chrome.
 */
const PORT = 4322;
const baseURL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const channel = process.env.PLAYWRIGHT_CHANNEL || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'node tests/e2e/vercel-static-server.mjs',
        url: `http://localhost:${PORT}/`,
        env: { PORT: String(PORT) },
        reuseExistingServer: !process.env.CI,
      },
});
