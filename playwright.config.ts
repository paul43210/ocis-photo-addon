import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E test configuration for oCIS Photo Addon
 *
 * Tests run against the production instance at cloud.faure.ca
 * Credentials are read from environment variables or .env.local
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run tests sequentially to avoid auth conflicts
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  timeout: 60000, // 60 seconds per test

  use: {
    baseURL: process.env.OCIS_URL || 'https://cloud.faure.ca',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Global setup for authentication
  globalSetup: './tests/e2e/global-setup.ts',
})
