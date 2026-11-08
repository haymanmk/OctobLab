import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const BASE = `http://127.0.0.1:${PORT}/OctobLab/`;

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE,
    trace: 'off',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: `npx astro preview --host 127.0.0.1 --port ${PORT}`, url: BASE, reuseExistingServer: !process.env.CI, timeout: 90_000 },
  projects: [
    { name: 'desktop', testMatch: /(desktop|pages)\.spec\.ts/, use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } } },
    { name: 'phone', testMatch: /phone\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    { name: 'tablet', testMatch: /tablet\.spec\.ts/, use: { browserName: 'chromium', viewport: { width: 900, height: 800 }, hasTouch: true } },
  ],
});
