import { LINE_TUNING } from '../line-manager';
import type { SimState } from '../../sim';
import type { Assessment } from '../../review';
import { DIRECTOR_TUNING as T } from './tuning';
import type { DirectorState } from './types';

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
// @spec DIR-END-006
export function afterAdvanceDirector(level: DirectorState, sim: SimState): { level: DirectorState; burnedOut: boolean } {
  const s = structuredClone(level);
  s.burnoutQuarters = sim.player.stress >= LINE_TUNING.burnoutThreshold ? s.burnoutQuarters + 1 : 0;
  return { level: s, burnedOut: s.burnoutQuarters >= T.burnoutQuarters };
}

/** Whether promotion is possible yet and whether this is the level's last review; the measures come with the scorecard. */
// @spec DIR-END-004, DIR-END-005
export function assessDirector(level: DirectorState, sim: SimState): Assessment {
  const quarter = quartersPlayed(level, sim);
  return { measures: [], promotionPossible: quarter >= T.promotionFromQuarter, lastReview: quarter >= T.lastReviewQuarter };
}
