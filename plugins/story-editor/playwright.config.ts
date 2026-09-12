import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  outputDir: '../../test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    locale: 'en-US',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
