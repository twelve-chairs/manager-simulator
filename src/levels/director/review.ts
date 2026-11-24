import { LINE_TUNING, quitsIn, type Quit } from '../line-manager';
import type { SimState } from '../../sim';
import type { Assessment, Measure } from '../../review';
import { goalStatus } from './goals';
import { DIRECTOR_TUNING as T } from './tuning';
import type { DirectorState, RatingCounts } from './types';

const WEEKS = T.weeksPerQuarter;
const PERIOD = T.reviewEveryQuarters * WEEKS;

/** Level parameters the turn loop reads. */
// @spec DIR-END-001
export const DIRECTOR_LEVEL = { id: 'director', weeksPerStep: WEEKS, situationLimit: 3, reviewEveryWeeks: PERIOD } as const;

/** Quarters played since the level began. */
export const quartersPlayed = (level: DirectorState, sim: SimState) => (sim.week - level.startWeek) / WEEKS;

/** Whether a review is due now: every two quarters, counted from the level's start. */
// @spec DIR-END-002
export function reviewDue(level: DirectorState, sim: SimState): boolean {
  const weeks = sim.week - level.startWeek;
  return weeks > 0 && weeks % PERIOD === 0;
}

/** Whether the quarter beginning now is the last of a review period. */
export function periodEndsThisQuarter(level: DirectorState, sim: SimState): boolean {
  return (sim.week - level.startWeek + WEEKS) % PERIOD === 0;
}

/** Tracks burnout after the simulation advances a quarter. */
// @spec DIR-END-006, DIR-BET-003
export function afterAdvanceDirector(level: DirectorState, sim: SimState): { level: DirectorState; burnedOut: boolean } {
  const s = structuredClone(level);
  s.burnoutQuarters = sim.player.stress >= LINE_TUNING.burnoutThreshold ? s.burnoutQuarters + 1 : 0;
  // Projects completed this quarter, by when, so on-time work and bets landed by their deadline count.
  for (const p of Object.values(sim.projects)) if (p.status === 'completed' && s.groupIds.includes(p.teamId) && s.completions[p.id] === undefined) s.completions[p.id] = sim.week - WEEKS;
  // Only attrition changes rating counts while the simulation advances, so a fall at meets or above is regretted.
  let regretted = 0;
  for (const g of s.groupIds) {
    const was = s.knownRatings[g];
    const now = sim.teams[g]?.aggregate?.ratings;
    if (was && now) for (const r of REGRETTED) regretted += Math.max(0, was[r] - now[r]);
  }
  if (regretted > 0) s.regretted.push({ week: sim.week - WEEKS, count: regretted });
  remember(s, sim);
  return { level: s, burnedOut: s.burnoutQuarters >= T.burnoutQuarters };
}

const REGRETTED: (keyof RatingCounts)[] = ['meets', 'exceeds', 'outstanding'];

/** The senior managers of the player's groups who quit in the quarter just played, with what led to it and their last memory. */
// @spec DIR-RECAP-003
export function quitLastQuarter(level: DirectorState, sim: SimState): Quit[] {
  return quitsIn(sim, sim.week - WEEKS, (p) => p.role === 'manager' && p.teamId !== null && level.groupIds.includes(p.teamId), (h) => h.filter((e) => e.note));
}

/** Records each group's rating counts as they are now, so later losses can be counted. */
export function remember(level: DirectorState, sim: SimState) {
  level.knownRatings = {};
  for (const g of level.groupIds) {
    const a = sim.teams[g]?.aggregate;
    if (a) level.knownRatings[g] = { ...a.ratings };
  }
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const inPeriod = (when: number, week: number) => when >= week - PERIOD && when < week;

export interface DirectorScorecard {
  strategic: { betsLanded: number | null; projectsOnTime: number };
  retention: { regretted: number };
  health: { motivation: number; stress: number };
  /** The executive's trust in the player. */
  confidence: number;
}

/** The measures the review reads, over the review period before the current week. */
// @spec DIR-END-003
export function directorScorecard(level: DirectorState, sim: SimState): DirectorScorecard {
  const week = sim.week;
  const funded = level.funded.filter((f) => inPeriod(f.week, week)).length;
  const landed = level.betResults.filter((r) => r.landed && inPeriod(r.week, week)).length;
  const onTime = Object.entries(level.completions).filter(([id, when]) => inPeriod(when, week) && when <= (sim.projects[id]?.deadlineWeek ?? -1)).length;
  const surveyed = Object.values(level.survey.groups);
  return {
    strategic: { betsLanded: funded ? landed / funded : null, projectsOnTime: onTime },
    retention: { regretted: level.regretted.filter((r) => inPeriod(r.week, week)).reduce((n, r) => n + r.count, 0) },
    health: { motivation: average(surveyed.map((g) => g.motivation)), stress: average(surveyed.map((g) => g.stress)) },
    confidence: sim.people[level.executiveId]?.trust ?? 0,
  };
}

/** The measures a review scores, whether promotion is possible yet, and whether this is the level's last review. */
// @spec DIR-END-003, DIR-END-004, DIR-END-005, DIR-GOAL-003
export function assessDirector(level: DirectorState, sim: SimState): Assessment {
  const card = directorScorecard(level, sim);
  const t = T.review_targets;
  const measure = (id: Exclude<keyof typeof t, 'goal'>, value: number, better: Measure['better']): Measure => ({ id, value, ...t[id], better });
  const quarter = quartersPlayed(level, sim);
  return {
    measures: [
      ...(card.strategic.betsLanded !== null ? [measure('betsLanded', card.strategic.betsLanded, 'higher')] : []),
      measure('projectsOnTime', card.strategic.projectsOnTime, 'higher'),
      measure('regrettedAttrition', card.retention.regretted, 'lower'),
      measure('motivation', card.health.motivation, 'higher'),
      measure('stress', card.health.stress, 'lower'),
      measure('executiveConfidence', card.confidence, 'higher'),
      ...level.goals.map((g): Measure => ({ id: `goal:${g.id}`, value: goalStatus(g, level, sim).achieved ? 1 : 0, ...t.goal, better: 'higher' })),
    ],
    promotionPossible: quarter >= T.promotionFromQuarter,
    lastReview: quarter >= T.lastReviewQuarter,
    // @spec DIR-END-004
    reviewsUntilPromotion: Math.max(0, Math.ceil((T.promotionFromQuarter - quarter) / T.reviewEveryQuarters)),
    reviewsLeft: Math.max(0, Math.ceil((T.lastReviewQuarter - quarter) / T.reviewEveryQuarters)),
  };
}
