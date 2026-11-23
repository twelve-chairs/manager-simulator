import { LINE_TUNING, band } from '../line-manager';
import { behindScheduleProjects, overdueProjects, type SimState } from '../../sim';
import type { Assessment, Measure } from '../../review';
import { managerOf } from './core';
import { goalStatus } from './goals';
import { SENIOR_TUNING } from './tuning';
import type { RatingCounts, SeniorState } from './types';

const T = SENIOR_TUNING;
const WEEKS = T.weeksPerMonth;
const PERIOD = T.reviewEveryMonths * WEEKS;

/** Level parameters the turn loop reads. */
// @spec SENIOR-END-001
export const SENIOR_LEVEL = { id: 'senior-manager', weeksPerStep: WEEKS, situationLimit: 2, reviewEveryWeeks: PERIOD } as const;

/** Months since the level began. */
export const monthOf = (level: SeniorState, sim: SimState) => (sim.week - level.startWeek) / WEEKS;

/** Whether a review is due now: every six months, counted from the level's start. */
// @spec SENIOR-END-002
export function reviewDue(level: SeniorState, sim: SimState): boolean {
  const weeks = sim.week - level.startWeek;
  return weeks > 0 && weeks % PERIOD === 0;
}

/** Whether the month beginning now is the last of a review period. */
export function periodEndsThisMonth(level: SeniorState, sim: SimState): boolean {
  return (sim.week - level.startWeek + WEEKS) % PERIOD === 0;
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const REGRETTED: (keyof RatingCounts)[] = ['meets', 'exceeds', 'outstanding'];

/** The managers leading the group's teams now. */
const managersOf = (level: SeniorState, sim: SimState) => level.teamIds.flatMap((t) => managerOf(sim, t) ?? []);

/** The managers' average skill and each team's health bands, as a review period starts. */
export function periodSnapshot(level: SeniorState, sim: SimState): SeniorState['periodStart'] {
  return {
    week: sim.week,
    skill: average(managersOf(level, sim).map((m) => sim.people[m]!.skill)),
    health: Object.fromEntries(level.teamIds.map((t) => [t, { motivation: band(sim.teams[t]!.aggregate!.motivation), stress: band(sim.teams[t]!.aggregate!.stress) }])),
  };
}

/** Records each team's headcount and rating counts as they are now, so later losses can be noticed and counted. */
export function remember(level: SeniorState, sim: SimState) {
  for (const t of level.teamIds) {
    const a = sim.teams[t]!.aggregate!;
    level.knownHeadcount[t] = a.headcount;
    level.knownRatings[t] = { ...a.ratings };
  }
}

/** Records completions and heads lost to attrition, and tracks burnout, after the simulation advances a month. */
// @spec SENIOR-END-006
export function afterAdvanceSenior(level: SeniorState, sim: SimState): { level: SeniorState; burnedOut: boolean } {
  const s = structuredClone(level);
  const played = sim.week - WEEKS;
  for (const p of Object.values(sim.projects)) {
    if (s.teamIds.includes(p.teamId) && p.status === 'completed' && !Object.hasOwn(s.completions, p.id)) s.completions[p.id] = played;
  }
  // Only attrition changes rating counts while the simulation advances, so a fall in the counts at meets or above is regretted.
  let regretted = 0;
  for (const t of s.teamIds) {
    const was = s.knownRatings[t];
    const now = sim.teams[t]?.aggregate?.ratings;
    if (was && now) for (const r of REGRETTED) regretted += Math.max(0, was[r] - now[r]);
  }
  if (regretted > 0) s.regretted.push({ week: played, count: regretted });
  for (const t of s.teamIds) {
    const ratings = sim.teams[t]?.aggregate?.ratings;
    if (ratings) s.knownRatings[t] = { ...ratings };
  }
  s.burnoutMonths = sim.player.stress >= LINE_TUNING.burnoutThreshold ? s.burnoutMonths + 1 : 0;
  return { level: s, burnedOut: s.burnoutMonths >= LINE_TUNING.burnoutWeeks };
}

const inPeriod = (when: number, week: number) => when >= week - PERIOD && when < week;

export interface SeniorScorecard {
  delivery: { completedOnTime: number; onScheduleShare: number | null };
  retention: { regretted: number };
  health: { motivation: number; stress: number };
  growth: { skillChange: number; healthHeld: number };
  /** How closely the period's ratings matched what each team delivered, from 0 to 1; null when there was no calibration. */
  calibration: number | null;
}

/** The measures the review reads, over the review period before the current week. */
// @spec SENIOR-END-003
export function seniorScorecard(level: SeniorState, sim: SimState): SeniorScorecard {
  const week = sim.week;
  const completedOnTime = Object.entries(level.completions).filter(([id, when]) => inPeriod(when, week) && when <= (sim.projects[id]?.deadlineWeek ?? -1)).length;
  const active = Object.values(sim.projects).filter((p) => level.teamIds.includes(p.teamId) && p.status === 'active');
  const troubled = new Set([...overdueProjects(sim), ...behindScheduleProjects(sim)].map((p) => p.id));
  const teams = level.teamIds.map((t) => sim.teams[t]!.aggregate!);
  const held = level.teamIds.filter((t) => {
    const start = level.periodStart.health[t];
    const a = sim.teams[t]!.aggregate!;
    return !start || (band(a.motivation) >= start.motivation && band(a.stress) <= start.stress);
  }).length;
  return {
    delivery: { completedOnTime, onScheduleShare: active.length ? active.filter((p) => !troubled.has(p.id)).length / active.length : null },
    retention: { regretted: level.regretted.filter((r) => inPeriod(r.week, week)).reduce((n, r) => n + r.count, 0) },
    health: { motivation: average(teams.map((a) => a.motivation)), stress: average(teams.map((a) => a.stress)) },
    growth: {
      skillChange: average(managersOf(level, sim).map((m) => sim.people[m]!.skill)) - level.periodStart.skill,
      healthHeld: level.teamIds.length ? held / level.teamIds.length : 1,
    },
    calibration: (() => {
      const last = level.calibrations.filter((c) => inPeriod(c.week, week)).at(-1);
      return last ? Math.max(0, 1 - last.gap) : null;
    })(),
  };
}

/** The measures a review scores, whether promotion is possible yet, and whether this is the level's last review. */
// @spec SENIOR-END-003, SENIOR-END-004, SENIOR-END-005
export function assessSenior(level: SeniorState, sim: SimState): Assessment {
  const card = seniorScorecard(level, sim);
  const t = T.review;
  const measure = (id: Exclude<keyof typeof t, 'goal'>, value: number, better: Measure['better']): Measure => ({ id, value, ...t[id], better });
  const month = monthOf(level, sim);
  return {
    measures: [
      measure('completedOnTime', card.delivery.completedOnTime, 'higher'),
      ...(card.delivery.onScheduleShare !== null ? [measure('onScheduleShare', card.delivery.onScheduleShare, 'higher')] : []),
      measure('regrettedAttrition', card.retention.regretted, 'lower'),
      measure('motivation', card.health.motivation, 'higher'),
      measure('stress', card.health.stress, 'lower'),
      measure('managerGrowth', card.growth.skillChange, 'higher'),
      measure('healthHeld', card.growth.healthHeld, 'higher'),
      ...(card.calibration !== null ? [measure('calibrationQuality', card.calibration, 'higher')] : []),
      // @spec SENIOR-GOAL-003
      ...level.goals.map((g): Measure => ({ id: `goal:${g.id}`, value: goalStatus(g, level, sim).achieved ? 1 : 0, ...t.goal, better: 'higher' })),
    ],
    promotionPossible: month >= T.promotionFromMonth,
    lastReview: month >= T.lastReviewMonth,
  };
}
