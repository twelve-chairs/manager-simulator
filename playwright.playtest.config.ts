import { defineConfig, devices } from '@playwright/test';

/**
 * Playtests: whole runs of the game played by scripted players, with checks on every screen, plus scenarios for the
 * features a run only sometimes reaches. Slower than the end-to-end suite, so they run on request (`npm run playtest`)
 * and weekly in CI, not on every commit. Against the local production build by default; set PLAYTEST_URL to play a
 * deployed copy instead, such as the live site.
 */
const PORT = 4319;
const remote = process.env.PLAYTEST_URL;

export default defineConfig({
  testDir: 'playtest',
  testMatch: '**/*.playtest.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A whole run takes up to a few minutes in a real browser.
  timeout: 10 * 60_000,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: { baseURL: remote ?? `http://localhost:${PORT}/`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(remote
    ? {}
    : {
        webServer: {
          command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
          url: `http://localhost:${PORT}`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
