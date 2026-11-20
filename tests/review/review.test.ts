import { describe, expect, it } from 'vitest';
import { lineManagerLevel } from '../../src/levels/line-manager';
import { REVIEW_TUNING, conductReview, verdictOf, type Assessment, type Measure } from '../../src/review';
import { applyEffects, planOf, type Rating, type SimState } from '../../src/sim';
import type { DebriefRecord } from '../../src/situations';
import { fresh, patch } from '../sim/fixtures';

const measure = (value: number, overrides: Partial<Measure> = {}): Measure => ({ id: 'm', value, target: 50, tolerance: 10, better: 'higher', ...overrides });

/** A sim whose player reputation sits exactly on the review's target, so the reputation measure is at target. */
const neutral = (sim: SimState = fresh()) => patch(sim, (s) => (s.player.reputation = REVIEW_TUNING.reputation.target));

/** Gives the player earlier ratings, oldest first. */
function rated(sim: SimState, ratings: Rating[]): SimState {
  let s = sim;
  for (const rating of ratings) {
    const r = applyEffects(s, [{ type: 'rate', target: { kind: 'player' }, rating, cause: { kind: 'rule', ruleId: 'review.quarterly' } }]);
    if (!r.ok) throw new Error(r.error.message);
    s = r.state;
  }
  return s;
}

const assessment = (values: ('above' | 'at' | 'below')[], promotionPossible = false): Assessment => ({
  measures: values.map((v, i) => measure(v === 'above' ? 70 : v === 'at' ? 50 : 30, { id: `m${i}` })),
  promotionPossible,
});

const review = (sim: SimState, a: Assessment, debriefs: DebriefRecord[] = []) => conductReview({ levelId: 'line-manager', sim, assessment: a, debriefs });

describe('measures', () => {
  // @spec REVIEW-MEASURE-001
  it('gives verdicts by tolerance, edges included, and direction', () => {
    expect(verdictOf(measure(50))).toBe('at');
    expect(verdictOf(measure(60))).toBe('at');
    expect(verdictOf(measure(40))).toBe('at');
    expect(verdictOf(measure(61))).toBe('above');
    expect(verdictOf(measure(39))).toBe('below');
    expect(verdictOf(measure(61, { better: 'lower' }))).toBe('below');
    expect(verdictOf(measure(39, { better: 'lower' }))).toBe('above');
    expect(verdictOf(measure(1, { target: 0, tolerance: 0, better: 'lower' }))).toBe('below');
    expect(verdictOf(measure(0, { target: 0, tolerance: 0, better: 'lower' }))).toBe('at');
  });

  // @spec REVIEW-MEASURE-002
  it('adds the player reputation as a measure', () => {
    const sim = patch(fresh(), (s) => (s.player.reputation = 80));
    const result = review(sim, assessment(['at']));
    expect(result.measures.map((m) => m.id)).toEqual(['m0', 'reputation']);
    expect(result.measures[1]).toMatchObject({ value: 80, target: REVIEW_TUNING.reputation.target, tolerance: REVIEW_TUNING.reputation.tolerance, better: 'higher', verdict: 'above' });
  });
});

describe('the rating', () => {
  // @spec REVIEW-RATE-001
  it('scores the average of +1, 0 and -1 over all measures', () => {
    expect(review(neutral(), assessment(['above', 'above', 'below'])).score).toBeCloseTo(1 / 4);
    expect(review(neutral(), assessment(['at', 'at', 'at'])).score).toBe(0);
  });

  // @spec REVIEW-RATE-002
  it('maps the score to the highest rating whose threshold it reaches, with 0 as meets', () => {
    const t = REVIEW_TUNING.thresholds;
    expect(t.outstanding).toBeGreaterThan(t.exceeds);
    expect(t.exceeds).toBeGreaterThan(0);
    expect(t.meets).toBeLessThanOrEqual(0);
    expect(t.partial).toBeLessThan(t.meets);
    expect(review(neutral(), assessment(['at', 'at', 'at'])).rating).toBe('meets');
    expect(review(neutral(), assessment(Array(9).fill('above'))).rating).toBe('outstanding');
    expect(review(neutral(), assessment(Array(9).fill('below'))).rating).toBe('below');
  });

  // @spec REVIEW-RATE-002, LINE-END-007
  it('lets a line manager reach exceeds without every measure above target', () => {
    const { level, sim } = lineManagerLevel.start(1);
    const strong = patch(sim, (s) => {
      s.player.reputation = 95;
      for (const p of Object.values(s.people)) Object.assign(p, { motivation: 90, stress: 10 });
    });
    const l = { ...level, completions: { pr1: 1 } };
    const week13 = patch(strong, (s) => {
      s.week = 13;
      Object.values(s.projects).forEach((p) => (p.progress = p.scope - 1));
      Object.values(s.people).forEach((p) => p.history.push({ week: 12, cause: { kind: 'action', actionId: 'line-manager.habit.one-on-ones' }, note: '1:1' }));
    });
    const a = lineManagerLevel.assess(l, week13);
    const result = review(week13, a);
    const quits = result.measures.find((m) => m.id === 'regrettedQuits')!;
    expect(quits.verdict).toBe('at');
    expect(['exceeds', 'outstanding']).toContain(result.rating);
  });

  // @spec REVIEW-RATE-003, REVIEW-RESULT-002
  it('rates the player through the simulation with the review as cause, leaving the input alone', () => {
    const sim = neutral();
    const before = structuredClone(sim);
    const result = review(sim, assessment(['above', 'above']));
    expect(sim).toEqual(before);
    expect(result.sim.player.performance).toBe(result.rating);
    expect(result.sim.player.ratingHistory.at(-1)).toMatchObject({ rating: result.rating, cause: { kind: 'rule', ruleId: 'review.quarterly' } });
    expect(review(sim, assessment(['above', 'above']))).toEqual(result);
  });
});

describe('the outcome', () => {
  // @spec REVIEW-OUT-001
  it('manages out a player whose rating fails their improvement plan', () => {
    const onPip = rated(neutral(), ['partial', 'partial']);
    const result = review(onPip, assessment(['below', 'below', 'below']));
    expect(planOf(result.sim, { kind: 'player' })).toBe('failedPip');
    expect(result.outcome).toBe('managedOut');
  });

  // @spec REVIEW-OUT-002
  it('promotes on two strong reviews in a row once promotion is possible', () => {
    const strong = assessment(Array(6).fill('above'), true);
    expect(review(rated(neutral(), ['exceeds']), strong).outcome).toBe('promote');
    expect(review(rated(neutral(), ['outstanding']), strong).outcome).toBe('promote');
    expect(review(rated(neutral(), ['meets']), strong).outcome).toBe('continue');
    expect(review(rated(neutral(), ['exceeds']), { ...strong, promotionPossible: false }).outcome).toBe('continue');
  });

  // @spec REVIEW-OUT-003
  it('continues otherwise, including a strong first review', () => {
    expect(review(neutral(), assessment(Array(6).fill('above'), true)).outcome).toBe('continue');
    expect(review(rated(neutral(), ['meets']), assessment(['at', 'at'])).outcome).toBe('continue');
    expect(review(rated(neutral(), ['partial']), assessment(['below', 'below'])).outcome).toBe('continue');
  });
});

describe('the result', () => {
  // @spec REVIEW-RESULT-001
  it('returns the rating, outcome, score, scored measures and the debriefs given', () => {
    const debriefs: DebriefRecord[] = [{ week: 3, situationId: 's', bindings: {}, status: 'ignored' }];
    const result = review(neutral(), assessment(['above', 'below']), debriefs);
    expect(Object.keys(result).sort()).toEqual(['debriefs', 'measures', 'outcome', 'rating', 'score', 'sim']);
    expect(result.measures.map((m) => m.verdict)).toEqual(['above', 'below', 'at']);
    expect(result.debriefs).toEqual(debriefs);
  });
});
