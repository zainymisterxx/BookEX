import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/live-site-audit.spec.ts', '**/live-site-audit-deep.spec.ts'],
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'https://bookex.farya.pk',
    trace: 'off',
    screenshot: 'off',
    actionTimeout: 20000,
    navigationTimeout: 30000,
    channel: 'chrome',
  },
  projects: [
    {
      name: 'live-chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
})
