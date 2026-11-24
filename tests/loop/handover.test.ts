import { describe, expect, it } from 'vitest';
import { lineManagerLevel } from '../../src/levels/line-manager';
import { seniorManagerLevel } from '../../src/levels/senior-manager';
import { apply, newRun, replay, weeksToReview, type Dependencies, type Run } from '../../src/loop';
import { plain } from '../situations/fixtures';
import { CONTENT, endWeeks, step, stubReview } from './fixtures';

const both = (outcome: 'promote' | 'continue' = 'promote'): Dependencies => ({ levels: [lineManagerLevel, seniorManagerLevel], review: stubReview(outcome).review });
/** Content with situations for both levels. */
const SENIOR_CONTENT = [...CONTENT, plain('senior-wide', { levels: ['senior-manager'] }), plain('senior-wide-2', { levels: ['senior-manager'] })];

/** A line manager run promoted at its first review and acknowledged: in the handover phase. */
function promoted(seed = 1): Run {
  const d = both();
  const reviewed = endWeeks(newRun(seed, SENIOR_CONTENT, d), 13, d);
  expect(reviewed.phase).toBe('review');
  return step(reviewed, { kind: 'acknowledge' }, d, SENIOR_CONTENT);
}
/** The promoted run handed over to an outside hire, its reviews from then on answered with `outcome`. */
function handedOver(seed = 1, outcome: 'promote' | 'continue' = 'continue'): Run {
  return step(promoted(seed), { kind: 'handover', choice: 'hire' }, both(outcome), SENIOR_CONTENT);
}

describe('the run', () => {
  // @spec LOOP-RUN-001
  it('starts the first level with a level start week of 0', () => {
    expect(newRun(1, CONTENT, both())).toMatchObject({ levelId: 'line-manager', levelStartWeek: 0, phase: 'week' });
  });
});

describe('promotion below the top level', () => {
  // @spec LOOP-REV-005
  it('puts the run in the handover phase with the next level’s choices', () => {
    const run = promoted(2);
    expect(run.phase).toBe('handover');
    expect(run.levelId).toBe('line-manager');
    const ids = run.handoverChoices!.map((c) => c.id);
    expect(ids.at(-1)).toBe('hire');
    expect(ids.length).toBeGreaterThan(1);
  });

  // @spec LOOP-HAND-001
  it('hands the run to the next level, from the current week, and begins its first turn', () => {
    const before = promoted(3);
    const run = handedOver(3);
    expect(run).toMatchObject({ phase: 'week', levelId: 'senior-manager', levelStartWeek: before.sim.week, handoverChoices: null });
    expect(run.week.length).toBeGreaterThan(0);
    expect(run.commands.at(-1)).toEqual({ kind: 'handover', choice: 'hire' });
    // @spec LOOP-REV-006: a new level's promotion starts over
    expect(before.towardPromotion).not.toBeNull();
    expect(run.towardPromotion).toBeNull();
    // replaying the commands, handover included, gives the same run
    expect(replay(3, SENIOR_CONTENT, both(), run.commands)).toEqual(run);
  });

  // @spec LOOP-HAND-004
  it('keeps the level below’s final state among the run’s earlier levels', () => {
    const before = promoted(10);
    const run = handedOver(10);
    expect(newRun(1, CONTENT, both()).earlierLevels).toEqual([]);
    expect(run.earlierLevels).toEqual([{ levelId: 'line-manager', level: before.level, sim: before.sim, endWeek: before.sim.week }]);
  });

  // @spec LOOP-HAND-002
  it('returns the next level’s error for a choice it rejects, leaving the run unchanged', () => {
    const run = promoted(4);
    const r = apply(run, { kind: 'handover', choice: 'nobody' }, SENIOR_CONTENT, both());
    expect(r.ok).toBe(false);
    expect(r.run).toBe(run);
  });

  // @spec LOOP-HAND-003
  it('allows only the hand over command in the handover phase', () => {
    const run = promoted(5);
    for (const command of [{ kind: 'endWeek' }, { kind: 'acknowledge' }, { kind: 'wait' }] as const) expect(apply(run, command, SENIOR_CONTENT, both()).ok).toBe(false);
    expect(apply(handedOver(5), { kind: 'handover', choice: 'hire' }, SENIOR_CONTENT, both()).ok).toBe(false);
  });
});

describe('a level reached by promotion', () => {
  // @spec LOOP-WEEK-004
  it('is reviewed every cadence counted from its start week', () => {
    const d = both('continue');
    let run = handedOver(6);
    for (let i = 0; i < 5; i++) run = step(run, { kind: 'endWeek' }, d, SENIOR_CONTENT);
    expect(run.phase).toBe('week');
    run = step(run, { kind: 'endWeek' }, d, SENIOR_CONTENT);
    expect(run.phase).toBe('review');
    expect(run.sim.week - run.levelStartWeek).toBe(24);
  });

  // @spec LOOP-WEEK-007
  it('counts the weeks to its next review from its start week', () => {
    const run = handedOver(7);
    expect(weeksToReview(run, both())).toBe(24);
  });

  // @spec LOOP-WEEK-010
  it('spreads a month’s situations over its weeks, day d becoming day d × 4', () => {
    let seen = 0;
    let run = handedOver(8);
    const d = both('continue');
    for (let i = 0; i < 5; i++) {
      for (const m of run.week.filter((x) => x.source === 'situation')) {
        seen++;
        expect(m.day % 4).toBe(0);
        expect(m.day).toBeLessThanOrEqual(16);
      }
      run = step(run, { kind: 'endWeek' }, d, SENIOR_CONTENT);
    }
    expect(seen).toBeGreaterThan(0);
  });

  // @spec LOOP-REV-003
  it('ends the run as completed on promotion past the senior manager, now the top', () => {
    const d = both('promote');
    let run = handedOver(9, 'promote');
    for (let i = 0; i < 6 && run.phase === 'week'; i++) run = step(run, { kind: 'endWeek' }, d, SENIOR_CONTENT);
    run = step(run, { kind: 'acknowledge' }, d, SENIOR_CONTENT);
    expect(run).toMatchObject({ phase: 'ended', ending: 'completed' });
  });
});
