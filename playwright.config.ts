import { defineConfig, devices } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:9002'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // video disabled — ffmpeg not available in this environment
    actionTimeout: 15000,
    navigationTimeout: 30000,
    channel: 'chrome',
  },
  projects: [
    {
      name: 'setup',
      testMatch: '**/global-setup.ts',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: ['**/global-setup.ts', '**/public.spec.ts', '**/auth.spec.ts'],
    },
    {
      name: 'public',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
      testMatch: ['**/public.spec.ts', '**/auth.spec.ts'],
    },
  ],
  webServer: {
    command: 'npm run dev:next',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120000,
  },
})
