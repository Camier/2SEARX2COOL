import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false, // Electron app tests should run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for Electron app
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:8888',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure'
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'electron',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      }
    }
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run build && npm run preview',
    port: 8888,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  },

  /* Global setup */
  globalSetup: path.join(__dirname, 'test/e2e/global-setup.ts'),
  globalTeardown: path.join(__dirname, 'test/e2e/global-teardown.ts')
});