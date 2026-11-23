import { defineConfig, devices } from '@playwright/test';

/**
 * The AI playtester: Claude plays the game as a newcomer (docs/intent/playtest, The AI Playtester). It calls the
 * Claude API and costs money, so it runs only on request (`npm run playtest:ai`), never in CI or the playtest suite.
 * Against the local production build by default; set PLAYTEST_URL to play a deployed copy instead.
 */
const PORT = 4320;
const remote = process.env.PLAYTEST_URL;

export default defineConfig({
  testDir: 'playtest/ai',
  testMatch: '**/*.aiplay.ts',
  workers: 1,
  reporter: [['list']],
  use: { baseURL: remote ?? `http://localhost:${PORT}/` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(remote
    ? {}
    : {
        webServer: {
          command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
          url: `http://localhost:${PORT}`,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
