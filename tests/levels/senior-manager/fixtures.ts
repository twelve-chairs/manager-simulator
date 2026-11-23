import { startRun, type LineState } from '../../../src/levels/line-manager';
import { takeOver, type SeniorState } from '../../../src/levels/senior-manager';
import type { SimState } from '../../../src/sim';

/** A line manager run at its start, standing in for one just promoted; `change` adjusts its people before the handover. */
export function promotedLine(seed = 1, change: (sim: SimState) => void = () => {}): { level: LineState; sim: SimState } {
  const { level, sim } = startRun(seed);
  const copy = structuredClone(sim);
  change(copy);
  return { level, sim: copy };
}

/** The line manager team's engineers, in id order. */
export const engineersOf = (line: { level: LineState; sim: SimState }) =>
  Object.values(line.sim.people)
    .filter((p) => p.teamId === line.level.teamId && p.status === 'active' && p.role === 'engineer')
    .map((p) => p.id)
    .sort();

/** A senior manager level just taken over from a line run, its old team led by an outside hire unless told otherwise. */
export function senior(seed = 1, choice = 'hire'): { level: SeniorState; sim: SimState } {
  const line = promotedLine(seed);
  const result = takeOver(line.level, line.sim, choice);
  if (!result.ok) throw new Error(result.error);
  return { level: result.level, sim: result.sim };
}
