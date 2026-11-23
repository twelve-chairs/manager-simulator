import type { SimState } from '../../sim';
import { quarterOf } from './core';
import type { DirectorState, Survey } from './types';

/** The engagement survey: each group's motivation, stress and attrition risk as they are now. */
// @spec DIR-DRIFT-003
export function takeSurvey(level: DirectorState, sim: SimState): Survey {
  const groups: Survey['groups'] = {};
  for (const g of level.groupIds) {
    const a = sim.teams[g]?.aggregate;
    if (a) groups[g] = { motivation: a.motivation, stress: a.stress, attritionRisk: a.attritionRisk };
  }
  return { quarter: quarterOf(level, sim), groups };
}
