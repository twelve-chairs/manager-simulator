import { directorLevel, type DirectorState, type DirectorView } from '../../src/levels/director';
import { lineManagerLevel } from '../../src/levels/line-manager';
import { seniorManagerLevel } from '../../src/levels/senior-manager';
import { apply, newRun, type Command, type Dependencies, type Run } from '../../src/loop';
import { conductReview } from '../../src/review';
import type { Rating } from '../../src/sim';
import type { Situation } from '../../src/situations';
import type { RunResult } from './harness';

/** The director's harness tuning: the whole level, six reviews, and the checks' thresholds. */
export const DIRECTOR_BALANCE_TUNING = {
  quarters: 12,
  scoreMargin: 0.3,
  minSoundPromotionShare: 0.3,
  maxNaivePromotionShare: 0.2,
  maxSoundBurnoutShare: 0.1,
  maxSoundManagedOutShare: 0.1,
} as const;

export const DIRECTOR_DEPS: Dependencies = { levels: [lineManagerLevel, seniorManagerLevel, directorLevel], review: conductReview };

/** Everything a director strategy may see: what the player sees, and nothing else. */
export interface DirectorSeen {
  quarter: number;
  view: DirectorView;
  reviews: { quarter: number; rating: Rating; outcome: string }[];
}

/** The current moment as the scene shows it: the level's own, from its view, or a presented situation. */
export interface DirectorMomentSeen {
  id: string;
  source: 'level' | 'situation';
  /** For a situation: which one it is, so sound practice can look up its better choice. */
  situationId?: string;
  title: string;
  text: string;
  choices: { id: string; label: string }[];
  kind?: DirectorView['moments'][number]['kind'];
  offers?: DirectorView['moments'][number]['offers'];
  heads?: number;
  groupId?: string;
  personId?: string;
}

export interface DirectorStrategy {
  name: string;
  naive: boolean;
  /** Habit changes at the start of a quarter, as plan commands. */
  habits?(seen: DirectorSeen): Command[];
  /** A choice for the current moment (`place:` or `fund:` with JSON where the moment takes one), or `wait`. */
  choose(seen: DirectorSeen, moment: DirectorMomentSeen): string;
}

export type DirectorRunResult = RunResult & { quarters: number };

/** Plays the director level from a seed: a line manager run handed straight up twice to outside hires, then up to 12 quarters. */
// @spec BAL-DIR-001, BAL-DIR-002, BAL-DIR-003
export function playDirectorRun(strategy: DirectorStrategy, seed: number, content: Situation[], deps: Dependencies = DIRECTOR_DEPS): DirectorRunResult {
  const reviews: DirectorSeen['reviews'] = [];
  let run: Run = newRun(seed, content, deps);
  const quarter = () => Math.round((run.sim.week - run.levelStartWeek) / 13) + 1;
  const step = (command: Command) => {
    const result = apply(run, command, content, deps);
    if (!result.ok) throw new Error(`${strategy.name}, seed ${seed}, quarter ${quarter()}: ${command.kind} refused: ${result.error}`);
    run = result.run;
  };
  // The same start for every strategy: both promotions handed at once to outside hires.
  run = { ...run, phase: 'handover', handoverChoices: seniorManagerLevel.handoverChoices!(run.level, run.sim) };
  step({ kind: 'handover', choice: 'hire' });
  run = { ...run, phase: 'handover', handoverChoices: directorLevel.handoverChoices!(run.level, run.sim) };
  step({ kind: 'handover', choice: 'hire' });
  while (run.phase !== 'ended') {
    if (run.phase === 'review') {
      reviews.push({ quarter: quarter() - 1, rating: run.review!.rating, outcome: run.review!.outcome });
      step({ kind: 'acknowledge' });
      continue;
    }
    if (run.phase !== 'week' || quarter() > DIRECTOR_BALANCE_TUNING.quarters) break;
    // A copy, so a strategy cannot reach the run through what it is shown.
    const see = (): DirectorSeen => structuredClone({ quarter: quarter(), view: directorLevel.view(run.level as DirectorState, run.sim) as DirectorView, reviews });
    for (const command of strategy.habits?.(see()) ?? []) step(command);
    for (let current = run.week.find((m) => m.status === 'open'); current; current = run.week.find((m) => m.status === 'open')) {
      const seen = see();
      const choice = strategy.choose(seen, momentOf(run, seen.view, current.id));
      step(choice === 'wait' ? { kind: 'wait' } : { kind: 'answer', momentId: current.id, choiceId: choice });
    }
    step({ kind: 'endWeek' });
  }
  const level = run.level as DirectorState;
  const ending = run.ending === 'completed' ? 'promoted' : run.ending === 'burnout' ? 'burnout' : run.ending === 'managedOut' ? 'managedOut' : null;
  return {
    strategy: strategy.name,
    seed,
    weeks: run.sim.week,
    quarters: Math.min(DIRECTOR_BALANCE_TUNING.quarters, Math.round((run.sim.week - run.levelStartWeek) / 13)),
    ending,
    ratings: reviews.map((r) => r.rating),
    regrettedQuits: (level.regretted ?? []).reduce((n, r) => n + r.count, 0),
  };
}

function momentOf(run: Run, view: DirectorView, id: string): DirectorMomentSeen {
  const entry = run.week.find((m) => m.id === id)!;
  if (entry.source === 'situation') {
    const p = run.presented.find((x) => x.id === id)!;
    return structuredClone({ id, source: 'situation', situationId: p.situationId, title: entry.title, text: p.text, choices: p.choices });
  }
  const m = view.moments.find((x) => x.id === id)!;
  return structuredClone({
    id,
    source: 'level',
    title: m.title,
    text: m.text,
    choices: m.choices,
    kind: m.kind,
    ...(m.offers && { offers: m.offers }),
    ...(m.heads !== undefined && { heads: m.heads }),
    ...(m.groupId && { groupId: m.groupId }),
    ...(m.personId && { personId: m.personId }),
  });
}
