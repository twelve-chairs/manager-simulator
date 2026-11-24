import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { startSeeded } from '../harness';
import { anthropicClient } from './client';
import { AI_TUNING, NO_CREDENTIALS, hasCredentials, renderReport, runOptions } from './core';
import { playAi } from './run';

/**
 * The AI playtester (docs/intent/playtest, The AI Playtester): Claude plays the real page as a newcomer, decision by
 * decision, and answers the human script's questions. Run with `npm run playtest:ai`; options come from AI_PERSONA,
 * AI_SEED, AI_UNTIL (promotion, director or end) and AI_MAX_DECISIONS.
 */
// @spec PLAY-AI-001, PLAY-AI-007, PLAY-AI-008, PLAY-AI-010
test('an AI playtester plays the game as a newcomer and answers the human script', async ({ page }) => {
  if (!hasCredentials(process.env, existsSync(join(homedir(), '.config', 'anthropic')))) throw new Error(NO_CREDENTIALS);
  const options = runOptions(process.env);
  test.setTimeout(6 * 60 * 60_000);
  const client = anthropicClient();
  await page.goto('./');
  const version = ((await page.locator('[data-field=version]').textContent()) ?? '').replace(/^Version /, '');
  await startSeeded(page, options.seed);

  const run = await playAi(page, client, options);

  const info = { version, persona: options.persona, seed: options.seed, model: AI_TUNING.model, reached: run.reached, requests: client.usage.requests, tokens: client.usage.tokens };
  const dir = join(process.cwd(), 'playtest-results', 'ai');
  mkdirSync(dir, { recursive: true });
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${options.persona}-${options.seed}`;
  writeFileSync(join(dir, `${name}.md`), renderReport(info, run.interviews, run.steps));
  writeFileSync(join(dir, `${name}.json`), JSON.stringify({ info, ...run }, null, 2));
  console.log(`AI playtest report: playtest-results/ai/${name}.md (${info.requests} requests, ${info.tokens.input + info.tokens.cacheRead + info.tokens.cacheWrite} input and ${info.tokens.output} output tokens)`);
  if (run.error) throw new Error(`The run stopped on an error after ${run.steps.length} decisions; the report keeps what was played. ${run.error}`);
});
