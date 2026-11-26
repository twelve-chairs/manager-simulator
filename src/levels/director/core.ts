import { generateLeader, generateOutsider as outsider, quarterOf as quarterFrom, type NewPersonOverrides } from '../org';
import type { SimState } from '../../sim';
import { DIRECTOR_TUNING as T } from './tuning';
import type { DirectorState } from './types';

export { WANTS, leaderOf, nextId, pick, random, randomInt, rule, unusedName } from '../org';

/** The quarter of the level a week falls in, from 1. */
export const quarterOf = (level: Pick<DirectorState, 'startWeek'>, sim: SimState) => quarterFrom(level.startWeek, sim, T.weeksPerQuarter);

/** A new senior manager, whose name nobody in the simulation has. */
// @spec DIR-ORG-001
export const generateSeniorManager = (level: DirectorState, sim: SimState, overrides: NewPersonOverrides = {}) => generateLeader(level, sim, 'sm', T.seniorSkill, overrides);

/** The executive or a peer: a person outside the organization. */
// @spec DIR-ORG-002
export const generateOutsider = (level: DirectorState, sim: SimState, role: 'executive' | 'peer') =>
  outsider(level, sim, role, { trust: T.outsiderTrust, motivation: T.outsiderMotivation, stress: T.outsiderStress });
