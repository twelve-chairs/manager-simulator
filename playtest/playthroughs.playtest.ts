import { expect, test } from '@playwright/test';
import { attachSummary, play, startSeeded, watch, type Strategy } from './harness';

/** Whole runs played to their end by scripted players of different styles, each from a fixed seed. */
const RUNS: { strategy: Strategy; seed: number }[] = [
  { strategy: 'sound', seed: 11 },
  { strategy: 'sound', seed: 12 },
  { strategy: 'delegate', seed: 21 },
  { strategy: 'hero', seed: 31 },
  { strategy: 'decline', seed: 41 },
  { strategy: 'waiter', seed: 51 },
  { strategy: 'mixed', seed: 61 },
  { strategy: 'mixed', seed: 62 },
];

const ENDINGS = {
  burnout: 'You burned out. Four weeks at the edge was too long.',
  managedOut: 'You were managed out after failing your improvement plan.',
  stayed: 'You stayed a line manager. Three years went by without the promotion.',
  completed: 'You were promoted past the top of the ladder the game has so far. You won.',
};

for (const { strategy, seed } of RUNS) {
  // @spec UI-SHELL-002, UI-WEEK-001, UI-WEEK-002, UI-WEEK-003, UI-WEEK-004, UI-WEEK-007, UI-WEEK-011, UI-TEXT-001
  // @spec UI-LINE-001, UI-LINE-008, LINE-VIS-011, UI-REVIEW-001, UI-LINE-009, UI-END-001, UI-END-002, LOOP-WEEK-008
  test(`a ${strategy} player, seed ${seed}, plays a whole run with every screen in order`, async ({ page }, testInfo) => {
    const problems = watch(page);
    await startSeeded(page, seed);
    const summary = await play(page, { strategy, seed });
    await attachSummary(testInfo, `${strategy}-${seed}`, summary);

    expect(summary.violations, 'every screen passes its checks').toEqual([]);
    expect(problems, 'no errors and nothing fetched from elsewhere').toEqual([]);
    expect(Object.values(ENDINGS), 'the run reached one of its endings').toContain(summary.ending);
    expect(summary.seen.waitedWithoutLesson, 'every situation let wait has its lesson').toEqual([]);

    // An ending matches the run that led to it.
    const last = summary.reviews.at(-1);
    if (summary.ending === ENDINGS.stayed) {
      expect(last?.week).toBe('Week 156 review');
      expect(last?.outcome).toMatch(/last review as a line manager/);
    }
    if (summary.ending === ENDINGS.completed) expect(summary.reviews.slice(-2).every((r) => ['exceeds', 'outstanding'].includes(r.rating))).toBe(true);
    if (summary.ending === ENDINGS.managedOut) expect(summary.reviews.slice(-3).every((r) => ['partial', 'below'].includes(r.rating))).toBe(true);
    expect(summary.weeks).toBeLessThanOrEqual(156);
  });
}
