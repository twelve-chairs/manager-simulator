import { takeOver, type VpState } from '../../../src/levels/vp';
import type { SimState } from '../../../src/sim';
import { director } from '../director/fixtures';

/** A director run at its start, standing in for one just promoted. */
export const promotedDirector = (seed = 1) => director(seed);

/** A VP level just taken over from a director run, its division led by an outside hire unless told otherwise. */
export function vp(seed = 1, choice = 'hire'): { level: VpState; sim: SimState } {
  const d = promotedDirector(seed);
  const result = takeOver(d.level, d.sim, choice);
  if (!result.ok) throw new Error(result.error);
  return { level: result.level, sim: result.sim };
}
