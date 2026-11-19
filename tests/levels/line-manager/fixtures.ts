import { expect } from 'vitest';
import {
  afterAdvance,
  commitWeek,
  editCalendar,
  startRun,
  type CalendarEntry,
  type Decision,
  type Demand,
  type LineState,
  type NewEntry,
} from '../../../src/levels/line-manager';
import { advance, type SimState } from '../../../src/sim';

export { patch } from '../../sim/fixtures';

export const run = (seed = 1) => startRun(seed);

/** The team the player leads. */
export function teamOf(sim: SimState): string {
  const id = Object.keys(sim.teams).find((t) => sim.teams[t]!.leader?.kind === 'player');
  if (!id) throw new Error('the player leads no team');
  return id;
}

/** Ids of the active engineers on the player's team, in id order. */
export const engineers = (sim: SimState): string[] =>
  Object.keys(sim.people)
    .filter((id) => sim.people[id]!.status === 'active' && sim.people[id]!.teamId === teamOf(sim))
    .sort();

/** Ids of the team's active projects, in id order. */
export const projects = (sim: SimState): string[] =>
  Object.keys(sim.projects)
    .filter((id) => sim.projects[id]!.status === 'active' && sim.projects[id]!.teamId === teamOf(sim))
    .sort();

export function edit(level: LineState, sim: SimState, change: { add?: NewEntry[]; remove?: string[] }): LineState {
  const result = editCalendar(level, sim, change);
  if (!result.ok) throw new Error(`expected the edit to apply, got: ${result.error}`);
  return result.level;
}

/** Replaces the whole calendar with the given entries. */
export const only = (level: LineState, sim: SimState, ...add: NewEntry[]) =>
  edit(level, sim, { remove: level.calendar.map((e: CalendarEntry) => e.id), add });

export function commit(level: LineState, sim: SimState, decisions: Record<string, Decision> = {}) {
  const result = commitWeek(level, sim, decisions);
  if (!result.ok) throw new Error(`expected the week to commit, got: ${result.error}`);
  return result;
}

/** Advances the simulation one week and runs the level's after-advance step. */
export function nextWeek(level: LineState, sim: SimState) {
  const advanced = advance(sim, 1).state;
  const after = afterAdvance(level, advanced);
  return { level: after.level, sim: advanced, burnedOut: after.burnedOut };
}

/** Adds a demand to the inbox directly; the inbox is plain data. */
export function withDemand(level: LineState, demand: Partial<Demand> & Pick<Demand, 'type' | 'subject'>): { level: LineState; id: string } {
  const id = demand.id ?? `test-demand-${level.inbox.length + 1}`;
  const full: Demand = { id, hours: 1, difficulty: 50, arrivedWeek: 0, lastWeek: 0, ...demand };
  return { level: { ...level, inbox: [...level.inbox, full] }, id };
}

/** Commits a week with an empty calendar and again with only the given entries, so the difference is the entries' effect. */
export function effectOf(level: LineState, sim: SimState, ...entries: NewEntry[]) {
  const without = commit(only(level, sim), sim).sim;
  const withEntries = commit(only(level, sim, ...entries), sim);
  return { without, with: withEntries.sim, log: withEntries.log };
}

export function expectRejected(result: { ok: boolean }, level: unknown, sim: unknown, levelBefore: unknown, simBefore: unknown) {
  expect(result.ok).toBe(false);
  expect(level).toEqual(levelBefore);
  expect(sim).toEqual(simBefore);
}

export const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** Sets every simulated value to the middle of its range, so a change in either direction shows. */
export const centered = (sim: SimState): SimState => {
  const s = structuredClone(sim);
  for (const p of Object.values(s.people)) Object.assign(p, { skill: 50, motivation: 50, stress: 50, trust: 50 });
  for (const p of Object.values(s.projects)) Object.assign(p, { risk: 50, techDebt: 50 });
  Object.assign(s.player, { reputation: 50, stress: 50 });
  return s;
};

/** A started run with centered values. */
export function centeredRun(seed = 1) {
  const { level, sim } = run(seed);
  return { level, sim: centered(sim) };
}
