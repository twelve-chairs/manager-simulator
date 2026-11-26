import { generateLeader, generateOutsider as outsider, quarterOf as quarterFrom, setHabit, type NewPersonOverrides } from '../org';
import type { SimState } from '../../sim';
import { VP_TUNING as T } from './tuning';
import type { VpHabits, VpState } from './types';

/** The quarter of the level a week falls in, from 1. */
export const quarterOf = (level: Pick<VpState, 'startWeek'>, sim: SimState) => quarterFrom(level.startWeek, sim, T.weeksPerQuarter);

/** A new director, whose name nobody in the simulation has. */
// @spec VP-ORG-001
export const generateDirector = (level: VpState, sim: SimState, overrides: NewPersonOverrides = {}) => generateLeader(level, sim, 'dr', T.directorSkill, overrides);

/** The CEO or a peer VP: a person outside the function. */
// @spec VP-ORG-002
export const generateOutsider = (level: VpState, sim: SimState, role: 'executive' | 'peer') =>
  outsider(level, sim, role, { trust: T.outsiderTrust, motivation: T.outsiderMotivation, stress: T.outsiderStress });

// @spec VP-HABIT-001
export const DEFAULT_VP_HABITS: VpHabits = { firstTeam: 'function', directors: 'stepBack' };

const OPTIONS: { [K in keyof VpHabits]: readonly VpHabits[K][] } = {
  firstTeam: ['function', 'leadership'],
  directors: ['stepBack', 'review'],
};

/** Changes a standing habit; it applies from this quarter's end. */
// @spec VP-HABIT-002, VP-HABIT-003
export const setVpHabit = (level: VpState, _sim: SimState, command: unknown) => setHabit(level, OPTIONS, command);
