import { NAMES } from '../line-manager';
import { PERSONALITIES } from '../../personalities';
import { nextRandom, type Cause, type NewPerson, type SimState, type Want } from '../../sim';
import { DIRECTOR_TUNING as T } from './tuning';
import type { DirectorState } from './types';

export const WANTS: readonly Want[] = ['growth', 'recognition', 'stability', 'autonomy'];

type Rng = Pick<DirectorState, 'rngState'>;
export const random = (s: Rng): number => nextRandom(s);
export const randomInt = (s: Rng, [min, max]: readonly [number, number]) => min + Math.floor(random(s) * (max - min + 1));
export const pick = <T>(s: Rng, items: readonly T[]): T => items[Math.floor(random(s) * items.length)]!;

export const rule = (ruleId: string): Cause => ({ kind: 'rule', ruleId });

/** The quarter of the level a week falls in, from 1. */
export const quarterOf = (level: Pick<DirectorState, 'startWeek'>, sim: SimState) => Math.floor((sim.week - level.startWeek) / T.weeksPerQuarter) + 1;

/** The id of the person leading a group, if an active person does. */
export function leaderOf(sim: SimState, teamId: string): string | null {
  const leader = sim.teams[teamId]?.leader;
  return leader?.kind === 'person' && sim.people[leader.id]?.status === 'active' ? leader.id : null;
}

/** An unused name from the list; once all are taken, a listed name with the lowest number from 2 that makes it unused. */
export function unusedName(level: Rng, list: readonly string[], taken: readonly string[]): string {
  for (let n = 1; ; n++) {
    const free = list.map((name) => (n === 1 ? name : `${name} ${n}`)).filter((name) => !taken.includes(name));
    if (free.length > 0) return pick(level, free);
  }
}

/** The next id with the prefix that nothing in `used` has. */
export function nextId(level: DirectorState, key: keyof DirectorState['counters'], prefix: string, used: Record<string, unknown>): string {
  do level.counters[key] += 1;
  while (used[`${prefix}${level.counters[key]}`]);
  return `${prefix}${level.counters[key]}`;
}

const takenNames = (sim: SimState) => Object.values(sim.people).map((p) => p.name);

/** A new senior manager, whose name nobody in the simulation has. */
// @spec DIR-ORG-001
export function generateSeniorManager(level: DirectorState, sim: SimState, overrides: Partial<NewPerson> = {}): NewPerson {
  return {
    id: nextId(level, 'person', 'sm', sim.people),
    name: unusedName(level, NAMES.people, takenNames(sim)),
    role: 'manager',
    skill: randomInt(level, T.seniorSkill),
    motivation: randomInt(level, [40, 80]),
    stress: randomInt(level, [15, 50]),
    trust: randomInt(level, [40, 70]),
    want: pick(level, WANTS),
    personality: pick(level, PERSONALITIES),
    ...overrides,
  };
}

/** The executive or a peer: a person outside the organization. */
// @spec DIR-ORG-002
export function generateOutsider(level: DirectorState, sim: SimState, role: 'executive' | 'peer') {
  return {
    id: nextId(level, 'person', 'x', sim.people),
    name: unusedName(level, NAMES.people, takenNames(sim)),
    role,
    personality: pick(level, PERSONALITIES),
    want: pick(level, WANTS),
    trust: randomInt(level, T.outsiderTrust),
    motivation: randomInt(level, T.outsiderMotivation),
    stress: randomInt(level, T.outsiderStress),
  };
}
