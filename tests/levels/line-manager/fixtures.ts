import { compareCodeUnits } from '../../../src/sim';
import { expect } from 'vitest';
import {
  afterAdvance,
  chooseMoment,
  endWeek,
  openMoments,
  setHabit,
  startRun,
  type HabitId,
  type LevelMoment,
  type LineState,
  type WorkItem,
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
    .sort(compareCodeUnits);

/** Ids of the team's active projects, in id order. */
export const projects = (sim: SimState): string[] =>
  Object.keys(sim.projects)
    .filter((id) => sim.projects[id]!.status === 'active' && sim.projects[id]!.teamId === teamOf(sim))
    .sort(compareCodeUnits);

/** Sets every simulated value to the middle of its range, so a change in either direction shows. */
export const centered = (sim: SimState): SimState => {
  const s = structuredClone(sim);
  for (const p of Object.values(s.people)) Object.assign(p, { skill: 50, motivation: 50, stress: 50, trust: 50 });
  for (const p of Object.values(s.projects)) Object.assign(p, { risk: 50, techDebt: 50 });
  Object.assign(s.player, { reputation: 50, stress: 50 });
  return s;
};

/** A started run with centered values and no open work, so tests add exactly the work they need. */
export function quietRun(seed = 1): { level: LineState; sim: SimState } {
  const { level, sim } = run(seed);
  return { level: { ...level, items: [], moments: [] }, sim: centered(sim) };
}

export function habit(level: LineState, sim: SimState, id: HabitId, value: string): LineState {
  const result = setHabit(level, sim, id, value);
  if (!result.ok) throw new Error(`expected the habit change to apply, got: ${result.error}`);
  return result.level;
}

/** Makes the week's moments for the work the test set up, with no new arrivals; `beginWeek` itself is tested in the arrival tests. */
export function begin(level: LineState, sim: SimState): LineState {
  return openMoments(level, sim);
}

export function choose(level: LineState, sim: SimState, momentId: string, choiceId: string) {
  const result = chooseMoment(level, sim, momentId, choiceId);
  if (!result.ok) throw new Error(`expected the choice to apply, got: ${result.error}`);
  return result;
}

export function end(level: LineState, sim: SimState) {
  const result = endWeek(level, sim);
  if (!result.ok) throw new Error(`expected the week to end, got: ${result.error}`);
  return result;
}

/** Ends the week, advances the simulation one week and runs the level's after-advance step. */
export function nextWeek(level: LineState, sim: SimState) {
  const ended = end(level, sim);
  const advanced = advance(ended.sim, 1);
  const after = afterAdvance(ended.level, advanced.state, advanced.log);
  return { level: after.level, sim: advanced.state, burnedOut: after.burnedOut, recap: ended.recap };
}

/** Adds a work item directly; the level's open items are plain data. */
export function withItem(level: LineState, item: Partial<WorkItem> & Pick<WorkItem, 'kind' | 'subject'>): { level: LineState; id: string } {
  const id = item.id ?? `test-item-${level.items.length + 1}`;
  const full: WorkItem = { id, size: 2, difficulty: 50, arrivedWeek: 0, lastWeek: 2, ...item };
  return { level: { ...level, items: [...level.items, full] }, id };
}

/** The open moment about a work item, vacancy or escalation. */
export function momentFor(level: LineState, ref: string): LevelMoment {
  const m = level.moments.find((x) => x.ref === ref && x.status === 'open');
  if (!m) throw new Error(`no open moment for ${ref}`);
  return m;
}

export function expectRefused(result: { ok: boolean }, level: unknown, sim: unknown, levelBefore: unknown, simBefore: unknown) {
  expect(result.ok).toBe(false);
  expect(level).toEqual(levelBefore);
  expect(sim).toEqual(simBefore);
}

export const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
