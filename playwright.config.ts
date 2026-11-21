import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests: the production build, served as it is deployed and under its Content-Security-Policy, played in
 * real Chromium. They cover what the unit tests' happy-dom cannot: the policy itself, real loading of assets, focus and
 * the browser's storage.
 */
const PORT = 4318;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
