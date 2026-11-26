import { LINE_TUNING, quitsIn, type Quit } from '../line-manager';
import { knownRatings, regrettedSince } from '../org';
import type { SimState } from '../../sim';
import type { Assessment, Measure } from '../../review';
import { goalStatus } from './goals';
import { VP_TUNING as T } from './tuning';
import type { VpState } from './types';

const WEEKS = T.weeksPerQuarter;
const PERIOD = T.reviewEveryQuarters * WEEKS;

/** Level parameters the turn loop reads. */
// @spec VP-END-001
export const VP_LEVEL = { id: 'vp', weeksPerStep: WEEKS, situationLimit: 3, reviewEveryWeeks: PERIOD } as const;

/** Quarters played since the level began. */
export const quartersPlayed = (level: VpState, sim: SimState) => (sim.week - level.startWeek) / WEEKS;

/** Whether a review is due now: every two quarters, counted from the level's start. */
// @spec VP-END-002
export function reviewDue(level: VpState, sim: SimState): boolean {
  const weeks = sim.week - level.startWeek;
  return weeks > 0 && weeks % PERIOD === 0;
}

/** Whether the quarter beginning now is the last of a review period. */
export const periodEndsThisQuarter = (level: VpState, sim: SimState) => (sim.week - level.startWeek + WEEKS) % PERIOD === 0;

/** Tracks burnout, completed projects and regretted attrition after the simulation advances a quarter. */
// @spec VP-END-006
export function afterAdvanceVp(level: VpState, sim: SimState): { level: VpState; burnedOut: boolean } {
  const s = structuredClone(level);
  s.burnoutQuarters = sim.player.stress >= LINE_TUNING.burnoutThreshold ? s.burnoutQuarters + 1 : 0;
  for (const p of Object.values(sim.projects)) if (p.status === 'completed' && s.divisionIds.includes(p.teamId) && s.completions[p.id] === undefined) s.completions[p.id] = sim.week - WEEKS;
  const regretted = regrettedSince(s.knownRatings, s.divisionIds, sim);
  if (regretted > 0) s.regretted.push({ week: sim.week - WEEKS, count: regretted });
  s.knownRatings = knownRatings(s.divisionIds, sim);
  return { level: s, burnedOut: s.burnoutQuarters >= T.burnoutQuarters };
}

/** The directors of the function's divisions who quit in the quarter just played, with what led to it and their last memory. */
// @spec VP-RECAP-002
export function quitLastQuarter(level: VpState, sim: SimState): Quit[] {
  return quitsIn(sim, sim.week - WEEKS, (p) => p.role === 'manager' && p.teamId !== null && level.divisionIds.includes(p.teamId), (h) => h.filter((e) => e.note));
}

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const inPeriod = (when: number, week: number) => when >= week - PERIOD && when < week;

export interface VpScorecard {
  business: { prioritiesLanded: number | null; projectsOnTime: number };
  health: { regretted: number; motivation: number; stress: number };
  confidence: { ceo: number; peers: number };
}

/** The measures the review reads, over the review period before the current week. */
// @spec VP-END-003
export function vpScorecard(level: VpState, sim: SimState): VpScorecard {
  const week = sim.week;
  const resolved = level.priorityResults.filter((r) => inPeriod(r.week, week));
  const onTime = Object.entries(level.completions).filter(([id, when]) => inPeriod(when, week) && when <= (sim.projects[id]?.deadlineWeek ?? -1)).length;
  const surveyed = Object.values(level.survey.divisions);
  const peers = level.peerIds.map((id) => sim.people[id]).filter((p) => p?.status === 'active').map((p) => p!.trust);
  return {
    business: { prioritiesLanded: resolved.length ? resolved.filter((r) => r.landed).length / resolved.length : null, projectsOnTime: onTime },
    health: { regretted: level.regretted.filter((r) => inPeriod(r.week, week)).reduce((n, r) => n + r.count, 0), motivation: average(surveyed.map((g) => g.motivation)), stress: average(surveyed.map((g) => g.stress)) },
    confidence: { ceo: sim.people[level.ceoId]?.trust ?? 0, peers: average(peers) },
  };
}

/** The measures a review scores, whether promotion is possible yet, and whether this is the level's last review. */
// @spec VP-END-003, VP-END-004, VP-END-005, VP-GOAL-003
export function assessVp(level: VpState, sim: SimState): Assessment {
  const card = vpScorecard(level, sim);
  const t = T.review_targets;
  const measure = (id: Exclude<keyof typeof t, 'goal'>, value: number, better: Measure['better']): Measure => ({ id, value, ...t[id], better });
  const quarter = quartersPlayed(level, sim);
  return {
    measures: [
      ...(card.business.prioritiesLanded !== null ? [measure('prioritiesLanded', card.business.prioritiesLanded, 'higher')] : []),
      measure('projectsOnTime', card.business.projectsOnTime, 'higher'),
      measure('regrettedAttrition', card.health.regretted, 'lower'),
      measure('motivation', card.health.motivation, 'higher'),
      measure('stress', card.health.stress, 'lower'),
      measure('ceoConfidence', card.confidence.ceo, 'higher'),
      measure('peerConfidence', card.confidence.peers, 'higher'),
      ...level.goals.map((g): Measure => ({ id: `goal:${g.id}`, value: goalStatus(g, level, sim).achieved ? 1 : 0, ...t.goal, better: 'higher' })),
    ],
    promotionPossible: quarter >= T.promotionFromQuarter,
    lastReview: quarter >= T.lastReviewQuarter,
    reviewsUntilPromotion: Math.max(0, Math.ceil((T.promotionFromQuarter - quarter) / T.reviewEveryQuarters)),
    reviewsLeft: Math.max(0, Math.ceil((T.lastReviewQuarter - quarter) / T.reviewEveryQuarters)),
  };
}
