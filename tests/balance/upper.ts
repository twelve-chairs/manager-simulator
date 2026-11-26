import type { CareerLevel } from '../../src/loop/types';
import { apply, newRun, type Command, type Dependencies, type Run } from '../../src/loop';
import type { Rating } from '../../src/sim';
import type { Situation } from '../../src/situations';
import { commandFor, endingOf, type RunResult } from './harness';

/** Everything a strategy at a quarterly level may see: what the player sees, and nothing else. */
export interface QuarterSeen<V> {
  quarter: number;
  view: V;
  reviews: { quarter: number; rating: Rating; outcome: string }[];
}

export interface QuarterStrategy<V, M> {
  name: string;
  naive: boolean;
  /** Habit changes at the start of a quarter, as plan commands. */
  habits?(seen: QuarterSeen<V>): Command[];
  /** A choice for the current moment, or `wait`. */
  choose(seen: QuarterSeen<V>, moment: M): string;
}

export type QuarterRunResult = RunResult & { quarters: number };

export interface QuarterLevelPlay<V, M> {
  deps: Dependencies;
  /** The levels the run is handed up to, in order, each at once to an outside hire. */
  handovers: CareerLevel<unknown>[];
  quarters: number;
  view: (run: Run) => V;
  momentOf: (run: Run, view: V, id: string) => M;
  /** Heads rated meets or above the level counted as lost. */
  regretted: (run: Run) => number;
}

/**
 * Plays a quarterly level from a seed: a line manager run handed straight up to outside hires at each promotion, then
 * up to the given number of quarters, the strategy seeing only the view and acting only through commands.
 */
export function playQuarterRun<V, M>(play: QuarterLevelPlay<V, M>, strategy: QuarterStrategy<V, M>, seed: number, content: Situation[]): QuarterRunResult {
  const { deps } = play;
  const reviews: QuarterSeen<V>['reviews'] = [];
  let run: Run = newRun(seed, content, deps);
  const quarter = () => Math.round((run.sim.week - run.levelStartWeek) / 13) + 1;
  const step = (command: Command) => {
    const result = apply(run, command, content, deps);
    if (!result.ok) throw new Error(`${strategy.name}, seed ${seed}, quarter ${quarter()}: ${command.kind} refused: ${result.error}`);
    run = result.run;
  };
  // The same start for every strategy: every promotion handed at once to an outside hire.
  for (const level of play.handovers) {
    run = { ...run, phase: 'handover', handoverChoices: level.handoverChoices!(run.level, run.sim) };
    step({ kind: 'handover', choice: 'hire' });
  }
  while (run.phase !== 'ended') {
    if (run.phase === 'review') {
      reviews.push({ quarter: quarter() - 1, rating: run.review!.rating, outcome: run.review!.outcome });
      step({ kind: 'acknowledge' });
      continue;
    }
    if (run.phase !== 'week' || quarter() > play.quarters) break;
    // A copy, so a strategy cannot reach the run through what it is shown.
    const see = (): QuarterSeen<V> => structuredClone({ quarter: quarter(), view: play.view(run), reviews });
    for (const command of strategy.habits?.(see()) ?? []) step(command);
    for (let current = run.week.find((m) => m.status === 'open'); current; current = run.week.find((m) => m.status === 'open')) {
      const seen = see();
      step(commandFor(strategy.choose(seen, play.momentOf(run, seen.view, current.id)), current.id));
    }
    step({ kind: 'endWeek' });
  }
  return {
    strategy: strategy.name,
    seed,
    weeks: run.sim.week,
    quarters: Math.min(play.quarters, Math.round((run.sim.week - run.levelStartWeek) / 13)),
    ending: endingOf(run),
    ratings: reviews.map((r) => r.rating),
    regrettedQuits: play.regretted(run),
  };
}
