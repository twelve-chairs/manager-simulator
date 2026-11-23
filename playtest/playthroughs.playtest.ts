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
  stayed: 'You stayed a line manager. Two years went by without the promotion.',
  burnoutSenior: 'You burned out. Four months at the edge was too long.',
  stayedSenior: 'You stayed a senior manager. Three years went by without the promotion.',
  burnoutDirector: 'You burned out. Two quarters at the edge was too long.',
  stayedDirector: 'You stayed a director. Three years went by without the promotion.',
  completed: 'You were promoted past the top of the ladder the game has so far. You won.',
};

for (const { strategy, seed } of RUNS) {
  // @spec UI-SHELL-002, UI-WEEK-001, UI-WEEK-002, UI-WEEK-003, UI-WEEK-004, UI-WEEK-007, UI-WEEK-011, UI-TEXT-001
  // @spec UI-LINE-001, UI-LINE-008, LINE-VIS-011, UI-REVIEW-001, UI-LINE-009, UI-END-001, UI-END-002, LOOP-WEEK-008
  // @spec UI-WEEK-016, UI-HAND-001, UI-HAND-002, UI-SENIOR-001, UI-SENIOR-002, UI-SENIOR-005, UI-SENIOR-008, LOOP-REV-005, LOOP-HAND-001
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
      expect(last?.week).toBe('Week 104 review');
      expect(last?.outcome).toMatch(/last review as a line manager/);
    }
    if (summary.ending === ENDINGS.stayedSenior) {
      expect(last?.week).toBe('Month 36 review');
      expect(last?.outcome).toMatch(/last review as a senior manager/);
    }
    // A run that reached the senior manager was handed over, and one that wasn't ended at the line manager.
    const atSenior = [ENDINGS.burnoutSenior, ENDINGS.stayedSenior, ENDINGS.completed].includes(summary.ending!) || summary.seen.handover !== null;
    expect(summary.seen.handover !== null).toBe(atSenior);
    if (summary.ending === ENDINGS.completed) expect(summary.reviews.slice(-2).every((r) => ['exceeds', 'outstanding'].includes(r.rating))).toBe(true);
    if (summary.ending === ENDINGS.managedOut) expect(summary.reviews.slice(-3).every((r) => ['partial', 'below'].includes(r.rating))).toBe(true);
    if (summary.ending === ENDINGS.stayedDirector) {
      expect(last?.week).toBe('Quarter 12 review');
      expect(last?.outcome).toMatch(/last review as a director/);
    }
    // A run that reached the director was handed over twice.
    const atDirector = [ENDINGS.burnoutDirector, ENDINGS.stayedDirector].includes(summary.ending!) || summary.seen.directorHandover !== null;
    expect(summary.seen.directorHandover !== null).toBe(atDirector);
    if (atDirector) expect(summary.seen.handover).not.toBeNull();
    // Two years at most at the line manager, then three at the senior manager, then three at the director.
    expect(summary.weeks).toBeLessThanOrEqual(atDirector ? 104 + 144 + 156 : atSenior ? 104 + 144 : 104);
  });
}
