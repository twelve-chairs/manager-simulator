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

const assessment = (values: ('above' | 'at' | 'below')[], promotionPossible = false, more: Partial<Assessment> = {}): Assessment => ({
  measures: values.map((v, i) => measure(v === 'above' ? 70 : v === 'at' ? 50 : 30, { id: `m${i}` })),
  promotionPossible,
  reviewsUntilPromotion: promotionPossible ? 0 : 1,
  reviewsLeft: 4,
  ...more,
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

describe('a ceiling and the last review', () => {
  const STRETCHED = 'the team is stretched';
  const capped = (a: Assessment): Assessment => ({ ...a, ceiling: { rating: 'meets', reason: STRETCHED } });

  // @spec REVIEW-RATE-004
  it('caps the rating at the level’s ceiling, and says why only when it lowered the rating', () => {
    const strong = review(neutral(), capped(assessment(Array(6).fill('above'))));
    expect(strong.rating).toBe('meets');
    expect(strong.ceilingReason).toBe(STRETCHED);
    const weak = review(neutral(), capped(assessment(['below', 'below', 'below'])));
    expect(weak.rating).not.toBe('meets');
    expect(weak.ceilingReason).toBeUndefined();
    // a capped rating counts as the rating, so it breaks a run of strong reviews
    expect(review(rated(neutral(), ['exceeds']), capped(assessment(Array(6).fill('above'), true))).outcome).toBe('continue');
  });

  // @spec REVIEW-OUT-004, REVIEW-OUT-003
  it('ends with stayed at the level’s last review, unless the player is promoted or managed out', () => {
    const last = (a: Assessment): Assessment => ({ ...a, lastReview: true });
    expect(review(rated(neutral(), ['meets']), last(assessment(['at', 'at']))).outcome).toBe('stayed');
    expect(review(rated(neutral(), ['exceeds']), last(assessment(Array(6).fill('above'), true))).outcome).toBe('promote');
    expect(review(rated(neutral(), ['partial', 'partial']), last(assessment(['below', 'below', 'below']))).outcome).toBe('managedOut');
    expect(review(rated(neutral(), ['meets']), assessment(['at', 'at'])).outcome).toBe('continue');
  });
});

describe('the result', () => {
  // @spec REVIEW-RESULT-001
  it('returns the rating, outcome, standing, score, scored measures and the debriefs given', () => {
    const debriefs: DebriefRecord[] = [{ week: 3, situationId: 's', bindings: {}, status: 'ignored' }];
    const result = review(neutral(), assessment(['above', 'below']), debriefs);
    expect(Object.keys(result).sort()).toEqual(['debriefs', 'measures', 'outcome', 'rating', 'score', 'sim', 'standing']);
    expect(result.measures.map((m) => m.verdict)).toEqual(['above', 'below', 'at']);
    expect(result.debriefs).toEqual(debriefs);
  });
});

describe('standing', () => {
  // the reputation measure sits at target in every case, so a list of n verdicts makes n + 1 measures
  const EXCEEDS: ('above' | 'at' | 'below')[] = ['above', 'above', 'at']; // 2 of 4: score 0.5
  const PARTIAL: ('above' | 'at' | 'below')[] = ['below', 'at']; // -1 of 3: score -0.33

  // @spec REVIEW-STAND-001
  it('says when one measure a step better or worse would have changed the rating', () => {
    const near = review(neutral(), assessment(EXCEEDS));
    expect(near.rating).toBe('exceeds');
    expect(near.standing).toMatchObject({ marginUp: 'outstanding', marginDown: 'meets' });
    const steady = review(neutral(), assessment(['above', 'at', 'at', 'at', 'at', 'at', 'at', 'at', 'at']));
    expect(steady.rating).toBe('meets');
    expect(steady.standing.marginUp).toBeUndefined();
    expect(steady.standing.marginDown).toBeUndefined();
    const top = review(patch(fresh(), (s) => (s.player.reputation = 90)), assessment(['above']));
    expect(top.rating).toBe('outstanding');
    expect(top.standing).toMatchObject({ marginDown: 'exceeds' });
    expect(top.standing.marginUp).toBeUndefined();
    const bottom = review(patch(fresh(), (s) => (s.player.reputation = 0)), assessment(['below']));
    expect(bottom.rating).toBe('below');
    expect(bottom.standing.marginDown).toBeUndefined();
    // a ceiling, not the tally, held the rating: no margin up, and a step worse still lands on the ceiling
    const capped = review(neutral(), assessment(EXCEEDS, false, { ceiling: { rating: 'partial', reason: 'Too stretched.' } }));
    expect(capped.rating).toBe('partial');
    expect(capped.standing.marginUp).toBeUndefined();
    expect(capped.standing.marginDown).toBeUndefined();
  });

  // @spec REVIEW-STAND-002
  it('says what the next reviews can do toward promotion', () => {
    const toward = (sim: SimState, a: Assessment) => review(sim, a).standing.promotion;
    expect(toward(rated(neutral(), ['exceeds']), assessment(EXCEEDS, true))).toEqual({ kind: 'promoted' });
    expect(toward(neutral(), assessment(['at'], false, { lastReview: true, reviewsLeft: 0 }))).toEqual({ kind: 'ended' });
    expect(toward(rated(neutral(), ['partial', 'partial']), assessment(PARTIAL))).toEqual({ kind: 'ended' });
    expect(toward(neutral(), assessment(EXCEEDS, false, { reviewsUntilPromotion: 2 }))).toEqual({ kind: 'notOpenYet', reviews: 2 });
    expect(toward(neutral(), assessment(['at'], true, { reviewsLeft: 1 }))).toEqual({ kind: 'outOfTime' });
    expect(toward(neutral(), assessment(EXCEEDS, false, { reviewsUntilPromotion: 1 }))).toEqual({ kind: 'oneMore' });
    expect(toward(neutral(), assessment(EXCEEDS, true, { reviewsLeft: 1 }))).toEqual({ kind: 'oneMore' });
    expect(toward(neutral(), assessment(['at'], true))).toEqual({ kind: 'twoInARow' });
  });

  // @spec REVIEW-STAND-004
  it('names the measures below target as what held back a rating below exceeds, while promotion is in reach or the level ends', () => {
    const held = (sim: SimState, a: Assessment) => review(sim, a).standing.heldBack;
    // promotion possible now, or at the next review
    expect(held(neutral(), assessment(['at', 'below', 'above', 'below'], true))).toEqual(['m1', 'm3']);
    expect(held(neutral(), assessment(['at', 'below', 'above', 'below'], false, { reviewsUntilPromotion: 1 }))).toEqual(['m1', 'm3']);
    // nothing below target: said as none
    expect(held(neutral(), assessment(['at', 'at'], true))).toEqual([]);
    // the level's last review, ended without a promotion
    expect(held(neutral(), assessment(['at', 'below'], false, { lastReview: true, reviewsLeft: 0 }))).toEqual(['m1']);
    // not while promotion is further off, nor at exceeds, nor when the run ends managed out
    expect(held(neutral(), assessment(['at', 'below'], false, { reviewsUntilPromotion: 2 }))).toBeUndefined();
    expect(held(neutral(), assessment(EXCEEDS, true))).toBeUndefined();
    expect(held(rated(neutral(), ['partial', 'partial']), assessment(PARTIAL, true))).toBeUndefined();
  });

  // @spec REVIEW-STAND-003
  it('reports the plan a low rating leaves the player on', () => {
    expect(review(neutral(), assessment(PARTIAL)).standing.plan).toBe('coaching');
    expect(review(rated(neutral(), ['partial']), assessment(PARTIAL)).standing.plan).toBe('pip');
    expect(review(rated(neutral(), ['partial']), assessment(['at'])).standing.plan).toBeUndefined();
  });
});
