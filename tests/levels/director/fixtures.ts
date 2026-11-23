import { takeOver, type DirectorState } from '../../../src/levels/director';
import type { SimState } from '../../../src/sim';
import { senior } from '../senior-manager/fixtures';

/** A senior manager run at its start, standing in for one just promoted. */
export const promotedSenior = (seed = 1) => senior(seed);

/** A director level just taken over from a senior manager run, its group led by an outside hire unless told otherwise. */
export function director(seed = 1, choice = 'hire'): { level: DirectorState; sim: SimState } {
  const s = promotedSenior(seed);
  const result = takeOver(s.level, s.sim, choice);
  if (!result.ok) throw new Error(result.error);
  return { level: result.level, sim: result.sim };
}
