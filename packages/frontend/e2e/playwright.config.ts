import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    storageState: './e2e/.auth/storage-state.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testDir: '.', testMatch: /global-setup\.ts/, teardown: 'teardown', use: { storageState: { cookies: [], origins: [] } } },
    { name: 'teardown', testDir: '.', testMatch: /global-teardown\.ts/, use: { storageState: { cookies: [], origins: [] } } },
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
      dependencies: ['setup'],
    },
  ],
});
