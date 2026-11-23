import { expect, test, type Browser } from '@playwright/test';
import { attachSummary, play, startSeeded, watch, type PlaySummary, type Strategy } from './harness';
import { formatScorecard, scoreRun, scorecard } from './metrics';
import { DEPS, playRun, realContent } from '../tests/balance/harness';
import { sound } from '../tests/balance/strategies';

/**
 * The success-metric playtests (docs/intent/playtest): scripted players measure a proxy for each of the HLD's
 * success metrics, as a player would see it, and fail only on the proxies that are solid.
 */
const SEEDS = [101, 102, 103, 104, 105, 106, 107, 108];
const PLAYERS: { name: string; strategy: Strategy }[] = [
  { name: 'first-timer', strategy: 'mixed' },
  { name: 'sound', strategy: 'sound' },
];

/** Plays a seed to the end of its run in a page of its own, so a player's runs can play side by side. */
async function playSeed(browser: Browser, baseURL: string | undefined, strategy: Strategy, seed: number, maxWeeks?: number) {
  const context = await browser.newContext({ ...(baseURL && { baseURL }) });
  const page = await context.newPage();
  const problems = watch(page);
  await startSeeded(page, seed);
  const summary = await play(page, { strategy, seed, ...(maxWeeks && { maxWeeks }) });
  await context.close();
  return { summary, problems };
}

for (const player of PLAYERS) {
  // @spec PLAY-RUN-001, PLAY-RUN-002, PLAY-RUN-003, PLAY-CARD-001, PLAY-CARD-002, PLAY-CHOICE-001
  test(`the ${player.name} player's scorecard for the success metrics`, async ({ browser, baseURL }, testInfo) => {
    const played = await Promise.all(SEEDS.map((seed) => playSeed(browser, baseURL, player.strategy, seed)));
    const runs: { seed: number; summary: PlaySummary }[] = played.map((p, i) => ({ seed: SEEDS[i]!, summary: p.summary }));
    for (const { seed, summary } of runs) await attachSummary(testInfo, `${player.name}-${seed}`, summary);
    const card = scorecard(player.name, runs.map(({ seed, summary }) => scoreRun(seed, summary.events)));
    await testInfo.attach(`${player.name}-scorecard`, { body: JSON.stringify(card, null, 2), contentType: 'application/json' });
    console.log(formatScorecard(card));

    expect(played.flatMap((p) => p.problems), 'no errors and nothing fetched from elsewhere').toEqual([]);
    for (const { seed, summary } of runs) expect(summary.ending, `seed ${seed} reached an ending`).toBeTruthy();
    for (const check of card.checks) expect(check.failures, check.id).toEqual([]);
  });
}

// @spec PLAY-RUN-007, PLAY-RUN-008
test('the sound player gets the balance harness’s sound practice ratings at the line manager on every seed', async ({ browser, baseURL }) => {
  const content = realContent();
  const played = await Promise.all(SEEDS.map((seed) => playSeed(browser, baseURL, 'sound', seed)));
  const differ = SEEDS.flatMap((seed, i) => {
    const harness = playRun(sound, seed, content, DEPS).ratings;
    const page = played[i]!.summary.reviews.slice(0, harness.length).map((r) => r.rating);
    return page.join() === harness.join() ? [] : [`seed ${seed}: the page got ${page.join(', ') || 'none'}, the harness ${harness.join(', ')}`];
  });
  expect(differ).toEqual([]);
});

// @spec PLAY-CLOCK-001
test('counts no words inside a closed disclosure but its summary', async ({ page }) => {
  await startSeeded(page, SEEDS[0]!);
  // One week: the run stops on its first recap, the last screen it read.
  const summary = await play(page, { strategy: 'sound', seed: SEEDS[0]!, maxWeeks: 1 });
  const reads = summary.events.filter((e) => e.kind === 'read');
  const counts = await page.evaluate(() => {
    // Word by word in each text node, so words in neighbouring elements are not run together.
    const words = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n = 0;
      for (let t = walker.nextNode(); t; t = walker.nextNode()) n += (t.textContent ?? '').split(/\s+/).filter(Boolean).length;
      return n;
    };
    const scene = document.querySelector('[data-scene=recap]')!;
    const whole = scene.querySelector('details[data-part=recap-whole-week]') as HTMLDetailsElement;
    return { open: whole.open, all: words(scene), hidden: words(whole) - words(whole.querySelector('summary')!) };
  });
  expect(counts.open).toBe(false);
  expect(counts.hidden).toBeGreaterThan(0);
  expect(reads.at(-1)).toEqual({ kind: 'read', words: counts.all - counts.hidden });
});

// @spec PLAY-RUN-004
test('the same player and seed record the same events', async ({ browser, baseURL }) => {
  const [a, b] = await Promise.all([playSeed(browser, baseURL, 'mixed', SEEDS[0]!, 26), playSeed(browser, baseURL, 'mixed', SEEDS[0]!, 26)]);
  expect(a.summary.events.length).toBeGreaterThan(0);
  expect(b.summary.events).toEqual(a.summary.events);
});
