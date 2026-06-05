import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/prod-book-flow.spec.ts',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report-prod', open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://bookex.farya.pk',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 45000,
    channel: 'chrome',
  },
  projects: [
    {
      name: 'prod-public',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
})
