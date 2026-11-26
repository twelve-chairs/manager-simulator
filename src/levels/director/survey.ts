import { surveyUnits } from '../org';
import type { SimState } from '../../sim';
import { quarterOf } from './core';
import type { DirectorState, Survey } from './types';

/** The engagement survey: each group's motivation, stress and attrition risk as they are now. */
// @spec DIR-DRIFT-003
export function takeSurvey(level: DirectorState, sim: SimState): Survey {
  return { quarter: quarterOf(level, sim), groups: surveyUnits(level.groupIds, sim) };
}
