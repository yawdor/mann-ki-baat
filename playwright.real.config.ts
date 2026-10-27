import { defineConfig } from '@playwright/test';

// Checks the real built site (`npx astro build` into dist/) in the deploy job: axe and no
// horizontal scroll on every built page. tests/e2e-real skips itself when there are no episodes.
export default defineConfig({
  testDir: 'tests/e2e-real',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4322/mann-ki-baat/' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx astro preview --port 4322 --ignore-lock',
    url: 'http://localhost:4322/mann-ki-baat/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
