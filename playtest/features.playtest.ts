import { expect, test } from '@playwright/test';
import { attachSummary, firstSeedThatReaches, play, startSeeded, watch } from './harness';

/**
 * Features a run reaches only sometimes. Each scenario tries a fixed list of seeds in order until one reaches the
 * scene it is about, so a failure always replays the same way.
 */

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

// @spec UI-WEEK-012, UI-WEEK-013, UI-WEEK-014, LINE-END-013, LINE-VIS-015
test('warns before burnout, and a player who eases off at the first warning gets back from the edge', async ({ page }, testInfo) => {
  const problems = watch(page);
  const escaped: number[] = [];
  for (const seed of [1, 2, 3, 4, 5]) {
    await startSeeded(page, seed);
    const summary = await play(page, { strategy: 'heavyThenEase', seed, maxWeeks: 30 });
    await attachSummary(testInfo, `heavy-then-ease-${seed}`, summary);
    expect(summary.violations).toEqual([]);
    expect(summary.seen.edgeWarnings.length, `seed ${seed} saw a warning before the run ended`).toBeGreaterThan(0);
    if (summary.ending === null) escaped.push(seed);
  }
  // Easing off at the first warning should work almost always; a team in trouble can still tip a run over.
  expect(escaped.length, `seeds that got back from the edge: ${escaped.join(', ')}`).toBeGreaterThanOrEqual(4);
  expect(problems).toEqual([]);
});

// @spec LINE-END-009, LINE-END-010, LINE-END-011, REVIEW-RATE-004
test('caps the rating at partial after a quarter mostly overwhelmed, and says why', async ({ page }, testInfo) => {
  const { seed, summary } = await firstSeedThatReaches(page, SEEDS, { strategy: 'delegate' }, (s) => s.reviews.some((r) => r.ceiling !== null));
  await attachSummary(testInfo, `delegate-${seed}`, summary);
  const capped = summary.reviews.filter((r) => r.ceiling !== null);
  for (const r of capped) {
    expect(["Your team spent most of the quarter overwhelmed.", "Your manager won't call it a strong quarter with the team this stretched."]).toContain(r.ceiling);
    if (r.ceiling === 'Your team spent most of the quarter overwhelmed.') expect(['partial', 'below']).toContain(r.rating);
    else expect(['meets', 'partial', 'below']).toContain(r.rating);
  }
  expect(summary.violations).toEqual([]);
});

// @spec LINE-INBOX-002, LINE-INBOX-013, UI-LINE-008
test('assigns an idle team a project, and says so in the recap', async ({ page }, testInfo) => {
  const { seed, summary } = await firstSeedThatReaches(page, SEEDS, { strategy: 'decline', maxWeeks: 80 }, (s) => s.seen.assigned.length > 0);
  await attachSummary(testInfo, `decline-${seed}`, summary);
  for (const line of summary.seen.assigned) expect(line).toMatch(/^Your manager assigned .+ to the team\.$/);
  expect(summary.violations).toEqual([]);
});

// @spec LINE-EVAL-003, LINE-EVAL-004, LINE-EVAL-005, LINE-MOMENT-002
test('holds a third low rating for a final evaluation, and one more quarter keeps the engineer', async ({ page }, testInfo) => {
  const problems = watch(page);
  const { seed, summary } = await firstSeedThatReaches(page, SEEDS, { strategy: 'delegate', until: 'finalEvaluation' }, (s) => s.stoppedAt === 'finalEvaluation');
  await attachSummary(testInfo, `final-evaluation-${seed}`, summary);
  const final = summary.seen.finalEvaluations[0]!;
  const name = final.title.replace('Final evaluation: ', '');
  expect(summary.seen.held).toContain(`${name}'s final evaluation waits for you on Monday.`);
  await expect(page.locator('[data-scene] [data-field=when]')).toHaveText('Monday afternoon');
  expect(final.choices).toEqual([expect.stringMatching(new RegExp(`^Rate ${name} .+ on what they delivered, and let them go$`)), `Give ${name} one more quarter`]);
  await page.locator('[data-scene] [data-choice=oneMoreQuarter]').click();
  await expect(page.locator('[data-part=reaction]')).toHaveText(`You give ${name} one more quarter. They know what it means.`);
  await page.locator('[data-action=continue]').click();
  await expect(page.locator('[data-panel=team] [data-person] [data-field=name]', { hasText: name })).toHaveCount(1);
  expect(problems).toEqual([]);
});

// @spec LINE-EVAL-006
test('warns that an honest evaluation of someone on a plan lets them go', async ({ page }, testInfo) => {
  const { seed, summary } = await firstSeedThatReaches(page, SEEDS, { strategy: 'delegate', until: 'letGoWarning' }, (s) => s.stoppedAt === 'letGoWarning');
  await attachSummary(testInfo, `let-go-warning-${seed}`, summary);
  const choices = await page.locator('[data-scene] [data-choice]').allTextContents();
  expect(choices.some((c) => c.endsWith(', and let them go'))).toBe(true);
  expect(choices.some((c) => /^Rate .+ on their project work$/.test(c))).toBe(false);
});

// @spec REVIEW-OUT-004, LINE-END-008, LOOP-REV-004, UI-END-001
test('ends a steady run at the eighth review, two years in', async ({ page }, testInfo) => {
  const { seed, summary } = await firstSeedThatReaches(page, Array.from({ length: 20 }, (_, i) => 61 + i), { strategy: 'mixed' }, (s) => s.ending?.startsWith('You stayed a line manager') ?? false);
  await attachSummary(testInfo, `stayed-${seed}`, summary);
  expect(summary.reviews).toHaveLength(8);
  expect(summary.career[0]).toBe('Weeks played: 104');
});

// @spec UI-REVIEW-001, SIT-CONTENT-026
test('teaches the lesson for each situation the player let wait', async ({ page }, testInfo) => {
  await startSeeded(page, 51);
  const summary = await play(page, { strategy: 'waiter', seed: 51, maxWeeks: 39 });
  await attachSummary(testInfo, 'waiter-51', summary);
  expect(summary.seen.waitedLessons).toBeGreaterThan(0);
  expect(summary.seen.waitedWithoutLesson).toEqual([]);
});
