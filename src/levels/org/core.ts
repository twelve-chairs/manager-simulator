import { NAMES } from '../line-manager';
import { PERSONALITIES } from '../../personalities';
import { nextRandom, type Cause, type HistoryEntry, type NewPerson, type SimState, type Want } from '../../sim';

/**
 * Mechanics the levels that run an organization of aggregate units share: the director's groups and the VP's
 * divisions. Each unit is one aggregate team in the simulation core, led by a person with the role `manager`.
 */

export const WANTS: readonly Want[] = ['growth', 'recognition', 'stability', 'autonomy'];

/** A level's own generator, apart from the simulation's and the situation engine's. */
export type Rng = { rngState: number };
export const random = (s: Rng): number => nextRandom(s);
export const randomInt = (s: Rng, [min, max]: readonly [number, number]) => min + Math.floor(random(s) * (max - min + 1));
export const pick = <T>(s: Rng, items: readonly T[]): T => items[Math.floor(random(s) * items.length)]!;

export const rule = (ruleId: string): Cause => ({ kind: 'rule', ruleId });

/** The quarter of a level a week falls in, from 1. */
export const quarterOf = (startWeek: number, sim: SimState, weeksPerQuarter: number) => Math.floor((sim.week - startWeek) / weeksPerQuarter) + 1;

/** The id of the person leading a unit, if an active person does. */
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
export function nextId<K extends string>(level: { counters: Record<K, number> }, key: K, prefix: string, used: Record<string, unknown>): string {
  do level.counters[key] += 1;
  while (used[`${prefix}${level.counters[key]}`]);
  return `${prefix}${level.counters[key]}`;
}

export const takenNames = (sim: SimState) => Object.values(sim.people).map((p) => p.name);
export const teamNames = (sim: SimState) => Object.values(sim.teams).map((t) => t.name);
export const projectNames = (sim: SimState) => Object.values(sim.projects).map((p) => p.name);

type Ids = Rng & { counters: { person: number } };
export type NewPersonOverrides = Partial<NewPerson>;

/** A new leader for a unit, whose name nobody in the simulation has, with management skill drawn from `skill`. */
export function generateLeader(level: Ids, sim: SimState, prefix: string, skill: readonly [number, number], overrides: NewPersonOverrides = {}): NewPerson {
  return {
    id: nextId(level, 'person', prefix, sim.people),
    name: unusedName(level, NAMES.people, takenNames(sim)),
    role: 'manager',
    skill: randomInt(level, skill),
    motivation: randomInt(level, [40, 80]),
    stress: randomInt(level, [15, 50]),
    trust: randomInt(level, [40, 70]),
    want: pick(level, WANTS),
    personality: pick(level, PERSONALITIES),
    ...overrides,
  };
}

export interface OutsiderRanges {
  trust: readonly [number, number];
  motivation: readonly [number, number];
  stress: readonly [number, number];
}

/** A person outside the organization: the level's executive, or one of its peers. */
export function generateOutsider(level: Ids, sim: SimState, role: 'executive' | 'peer', ranges: OutsiderRanges) {
  return {
    id: nextId(level, 'person', 'x', sim.people),
    name: unusedName(level, NAMES.people, takenNames(sim)),
    role,
    personality: pick(level, PERSONALITIES),
    want: pick(level, WANTS),
    trust: randomInt(level, ranges.trust),
    motivation: randomInt(level, ranges.motivation),
    stress: randomInt(level, ranges.stress),
  };
}

/** What someone remembers: their latest notes, newest first. */
export const memoryOf = (history: HistoryEntry[]) =>
  history
    .filter((h) => h.note)
    .map((h) => h.note!)
    .reverse()
    .slice(0, 3);

/** A change in words, or none when it did not move. */
export const moved = (was: number, now: number, up: string, down: string): string[] => {
  if (now > was) return [up];
  return now < was ? [down] : [];
};
