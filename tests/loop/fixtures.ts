import { lineManagerLevel } from '../../src/levels/line-manager';
import { apply, type Command, type Dependencies, type Review, type ReviewOutcome, type Run } from '../../src/loop';
import type { Situation } from '../../src/situations';
import { plain, sit } from '../situations/fixtures';

/** Line manager situations: two with no roles and one about any engineer. */
export const CONTENT: Situation[] = [
  plain('org-wide'),
  plain('org-wide-2', { weight: 2 }),
  sit({ id: 'about-someone', roles: [{ name: 'engineer', kind: 'person' }] }),
];

/** A stand-in performance review that records its calls and returns a fixed outcome. */
export function stubReview(outcome: ReviewOutcome = 'continue') {
  const calls: Parameters<Review>[0][] = [];
  const review: Review = (input) => {
    calls.push(structuredClone(input));
    return { sim: { ...input.sim, player: { ...input.sim.player, reputation: 77 } }, rating: 'meets', outcome };
  };
  return { review, calls };
}

export const deps = (review: Review = stubReview().review): Dependencies => ({ levels: [lineManagerLevel], review });

export function step(run: Run, command: Command, d: Dependencies = deps(), content = CONTENT): Run {
  const result = apply(run, command, content, d);
  if (!result.ok) throw new Error(`expected ${command.kind} to apply, got: ${result.error}`);
  return result.run;
}

/** Ends `n` weeks with an empty plan, stopping early if the run leaves the planning phase. */
export function endWeeks(run: Run, n: number, d: Dependencies = deps()): Run {
  let r = run;
  for (let i = 0; i < n && r.phase === 'planning'; i++) r = step(r, { kind: 'endWeek' }, d);
  return r;
}
