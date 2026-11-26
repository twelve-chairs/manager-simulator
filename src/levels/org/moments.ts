import type { ChangeLogEntry, Effect, NewPerson, SimState } from '../../sim';
import { randomInt, rule, type Rng } from './core';
import { applyLogged } from './units';

/** Where in the quarter a moment falls: week of the quarter 0 to 12, day 0 (Monday) to 4, and time. */
export interface Slot {
  week: number;
  day: number;
  time: 'morning' | 'afternoon';
}

/**
 * Places a quarter's moments: the first ones fill its first week, the rest spread through it, and the closing one is
 * the last afternoon of the last week.
 */
export function placeMoments<D>(first: D[], rest: D[], closing: D): (D & Slot)[] {
  return [
    ...first.map((d, i): D & Slot => ({ ...d, week: Math.floor(i / 5), day: i % 5, time: 'morning' })),
    ...rest.map((d, i): D & Slot => ({ ...d, week: 1 + Math.floor((i * 11) / Math.max(1, rest.length)), day: i % 5, time: i % 2 ? 'afternoon' : 'morning' })),
    { ...closing, week: 12, day: 4, time: 'afternoon' },
  ];
}

/** What arriving leaders read and write in the level's state. */
export type Arrivals = Rng & { arriving: Record<string, number>; leniency: Record<string, number>; joined: string[] };

/** Leaders hired from outside arrive at units still without one; each gets a leniency from the level's generator. */
export function arrivals(s: Arrivals, sim: SimState, hire: (sim: SimState) => NewPerson, ruleId: string): Effect[] {
  const effects: Effect[] = [];
  for (const [g, since] of Object.entries(s.arriving)) {
    if (since > sim.week) continue;
    delete s.arriving[g];
    const leader = sim.teams[g]?.leader;
    if (!sim.teams[g] || (leader?.kind === 'person' && sim.people[leader.id]?.status === 'active')) continue;
    const person = hire(sim);
    s.leniency[person.id] = randomInt(s, [0, 2]);
    s.joined.push(person.id);
    effects.push({ type: 'hire', teamId: g, person, cause: rule(ruleId) });
  }
  return effects;
}

type Handled = { ok: true; sim: SimState; reaction: string };

/** A final evaluation: let the leader go, leaving their unit leaderless, or give them one more period. */
export function finalEvaluation(
  s: { heldEvaluations: string[]; letGo: string[] },
  sim0: SimState,
  lead: string,
  choiceId: string,
  words: { oneMore: string; letGo: string },
  actionId: string,
  log: ChangeLogEntry[],
): Handled {
  s.heldEvaluations = s.heldEvaluations.filter((id) => id !== lead);
  if (choiceId !== 'letGo') return { ok: true, sim: sim0, reaction: words.oneMore };
  const sim = applyLogged(sim0, [{ type: 'remove', personId: lead, reason: 'fired', cause: { kind: 'action', actionId } }], log, 'final evaluation');
  s.letGo.push(lead);
  return { ok: true, sim, reaction: words.letGo };
}

/**
 * A new leader for a unit without one: promote from inside, at a cost to the unit's skill, or hire from outside,
 * which leaves it leaderless one more quarter.
 */
export function newLeader(
  s: Rng & { arriving: Record<string, number>; leniency: Record<string, number>; joined: string[] },
  sim0: SimState,
  unitId: string,
  choiceId: string,
  promote: (sim: SimState) => NewPerson,
  promoteSkill: number,
  actionId: string,
  log: ChangeLogEntry[],
): Handled & { promoted: NewPerson | null } {
  if (choiceId !== 'promote') {
    s.arriving[unitId] = sim0.week;
    return { ok: true, sim: sim0, reaction: '', promoted: null };
  }
  const promoted = promote(sim0);
  const cause = { kind: 'action', actionId } as const;
  const sim = applyLogged(sim0, [{ type: 'hire', teamId: unitId, person: promoted, cause }, { type: 'value', target: { kind: 'team', id: unitId }, field: 'skill', amount: -promoteSkill, cause }], log, 'new leader');
  s.leniency[promoted.id] = randomInt(s, [0, 2]);
  s.joined.push(promoted.id);
  return { ok: true, sim, reaction: '', promoted };
}
