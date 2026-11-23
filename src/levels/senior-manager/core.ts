import { NAMES } from '../line-manager';
import { PERSONALITIES } from '../../personalities';
import { nextRandom, teamSummary, type Cause, type NewPerson, type SimState, type TeamAggregate, type Want } from '../../sim';
import type { SeniorState } from './types';

export const WANTS: readonly Want[] = ['growth', 'recognition', 'stability', 'autonomy'];

export const random = (s: SeniorState): number => nextRandom(s);
export const randomInt = (s: SeniorState, min: number, max: number) => min + Math.floor(random(s) * (max - min + 1));
export const pick = <T>(s: SeniorState, items: readonly T[]): T => items[Math.floor(random(s) * items.length)]!;

export const rule = (ruleId: string): Cause => ({ kind: 'rule', ruleId });

/** A team's health, computed for a detailed team and stored for an aggregate one. */
export const summarizeTeam = (sim: SimState, teamId: string): TeamAggregate => teamSummary(sim, teamId);

/** The id of the person leading a team, if a person does and has started leading it. */
export function leadOf(level: { arriving: Record<string, number> }, sim: SimState, teamId: string): string | null {
  const starts = level.arriving[teamId];
  return starts !== undefined && starts > sim.week ? null : managerOf(sim, teamId);
}

/** The id of the person leading a team, if a person does. */
export function managerOf(sim: SimState, teamId: string): string | null {
  const leader = sim.teams[teamId]?.leader;
  return leader?.kind === 'person' && sim.people[leader.id]?.status === 'active' ? leader.id : null;
}

/** An unused name from the list; once all are taken, a listed name with the lowest number from 2 that makes it unused. */
export function unusedName(level: SeniorState, list: readonly string[], taken: readonly string[]): string {
  for (let n = 1; ; n++) {
    const free = list.map((name) => (n === 1 ? name : `${name} ${n}`)).filter((name) => !taken.includes(name));
    if (free.length > 0) return pick(level, free);
  }
}

/** The next id with the prefix that nothing in `used` has. */
export function nextId(level: SeniorState, key: keyof SeniorState['counters'], prefix: string, used: Record<string, unknown>): string {
  do level.counters[key] += 1;
  while (used[`${prefix}${level.counters[key]}`]);
  return `${prefix}${level.counters[key]}`;
}

/** A new manager with a personality and management skill, whose name nobody in the simulation has. */
// @spec SENIOR-ORG-001
export function generateManager(level: SeniorState, sim: SimState, overrides: Partial<NewPerson> = {}): NewPerson {
  return {
    id: nextId(level, 'person', 'm', sim.people),
    name: unusedName(level, NAMES.people, Object.values(sim.people).map((p) => p.name)),
    role: 'manager',
    skill: randomInt(level, 25, 75),
    motivation: randomInt(level, 40, 80),
    stress: randomInt(level, 15, 50),
    trust: randomInt(level, 40, 70),
    want: pick(level, WANTS),
    personality: pick(level, PERSONALITIES),
    ...overrides,
  };
}
