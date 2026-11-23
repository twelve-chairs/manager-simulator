import { describe, expect, it } from 'vitest';
import { SENIOR_LEVEL, afterAdvanceSenior, assessSenior, reviewDue, seniorScorecard, type SeniorState } from '../../../src/levels/senior-manager';
import type { SimState } from '../../../src/sim';
import { senior } from './fixtures';

const edit = (sim: SimState, change: (s: SimState) => void) => {
  const copy = structuredClone(sim);
  change(copy);
  return copy;
};
/** The simulation moved on to `months` months into the level. */
const at = (level: SeniorState, sim: SimState, months: number) => edit(sim, (s) => (s.week = level.startWeek + months * 4));

describe('the senior manager’s reviews', () => {
  // @spec SENIOR-END-001
  it('advances a month, four weeks, per turn', () => {
    expect(SENIOR_LEVEL).toMatchObject({ id: 'senior-manager', weeksPerStep: 4, reviewEveryWeeks: 24 });
  });

  // @spec SENIOR-END-002
  it('is reviewed every six months of the level, counted from its start', () => {
    const { level, sim } = senior(1);
    const due = Array.from({ length: 37 }, (_, m) => reviewDue(level, at(level, sim, m)));
    expect(due.flatMap((d, m) => (d ? [m] : []))).toEqual([6, 12, 18, 24, 30, 36]);
  });

  // @spec SENIOR-END-003
  it('scores delivery, retention and team health, and the managers’ growth over the period', () => {
    const { level, sim } = senior(2);
    const t = level.teamIds[1]!;
    const project = Object.values(sim.projects).find((p) => p.teamId === t)!;
    // a project completed on time this period, and a head rated meets lost to attrition
    const done = edit(at(level, sim, 3), (s) => {
      s.projects[project.id]!.status = 'completed';
      s.teams[t]!.aggregate!.ratings.unrated -= 1;
      s.teams[t]!.aggregate!.ratings.meets += 1;
    });
    const snap = afterAdvanceSenior(level, done).level;
    const lost = edit(done, (s) => {
      s.teams[t]!.aggregate!.ratings.meets -= 1;
      s.teams[t]!.aggregate!.headcount -= 1;
    });
    const after = afterAdvanceSenior(snap, lost).level;
    // managers grow over the period
    const grown = edit(at(level, lost, 6), (s) => {
      for (const id of level.teamIds) s.people[(s.teams[id]!.leader as { id: string }).id]!.skill += 10;
    });
    const card = seniorScorecard(after, grown);
    expect(card.delivery.completedOnTime).toBe(1);
    expect(card.retention.regretted).toBe(1);
    expect(card.health.motivation).toBeGreaterThan(0);
    expect(card.health.stress).toBeGreaterThan(0);
    expect(card.growth.skillChange).toBeCloseTo(10);
    expect(card.growth.healthHeld).toBeGreaterThanOrEqual(0);
    expect(card.growth.healthHeld).toBeLessThanOrEqual(1);
    const ids = assessSenior(after, grown).measures.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['completedOnTime', 'onScheduleShare', 'regrettedAttrition', 'motivation', 'stress', 'managerGrowth', 'healthHeld']));
  });

  // @spec SENIOR-END-004
  it('allows promotion from the third review, month 18', () => {
    const { level, sim } = senior(3);
    expect(assessSenior(level, at(level, sim, 12)).promotionPossible).toBe(false);
    expect(assessSenior(level, at(level, sim, 17)).promotionPossible).toBe(false);
    expect(assessSenior(level, at(level, sim, 18)).promotionPossible).toBe(true);
    const counts = (month: number) => {
      const a = assessSenior(level, at(level, sim, month));
      return [a.reviewsUntilPromotion, a.reviewsLeft];
    };
    expect([6, 12, 18, 30, 36].map(counts)).toEqual([[2, 5], [1, 4], [0, 3], [0, 1], [0, 0]]);
  });

  // @spec SENIOR-END-005
  it('says the sixth review, month 36, is the level’s last', () => {
    const { level, sim } = senior(4);
    expect(assessSenior(level, at(level, sim, 30)).lastReview).toBe(false);
    expect(assessSenior(level, at(level, sim, 36)).lastReview).toBe(true);
  });
});
