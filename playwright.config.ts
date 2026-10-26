import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://localhost:4321/mann-ki-baat/' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // The fixture build must exist first (`npm run build:fixtures`); validate:site does that.
  webServer: {
    command: 'npx astro preview --port 4321 --ignore-lock',
    url: 'http://localhost:4321/mann-ki-baat/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
