import { lineManagerLevel } from '../../src/levels/line-manager';
import { seniorManagerLevel, type SeniorState, type SeniorView } from '../../src/levels/senior-manager';
import { apply, newRun, type Command, type Dependencies, type Run } from '../../src/loop';
import { conductReview } from '../../src/review';
import type { Rating } from '../../src/sim';
import type { Situation } from '../../src/situations';
import { commandFor, endingOf, type RunResult } from './harness';

/** The senior manager's harness tuning: the whole level, six reviews, and the checks' thresholds. */
export const SENIOR_BALANCE_TUNING = {
  months: 36,
  scoreMargin: 0.3,
  minSoundPromotionShare: 0.3,
  maxNaivePromotionShare: 0.2,
  maxSoundBurnoutShare: 0.1,
  maxSoundManagedOutShare: 0.1,
} as const;

export const SENIOR_DEPS: Dependencies = { levels: [lineManagerLevel, seniorManagerLevel], review: conductReview };

/** Everything a senior strategy may see: what the player sees, and nothing else. */
export interface SeniorSeen {
  month: number;
  view: SeniorView;
  reviews: { month: number; rating: Rating; outcome: string }[];
}

/** The current moment as the scene shows it: the level's own, from its view, or a presented situation. */
export interface SeniorMoment {
  id: string;
  source: 'level' | 'situation';
  /** For a situation: which one it is, so sound practice can look up its better choice. */
  situationId?: string;
  title: string;
  text: string;
  choices: { id: string; label: string }[];
  kind?: SeniorView['moments'][number]['kind'];
  calibration?: SeniorView['moments'][number]['calibration'];
  teamId?: string;
}

export interface SeniorStrategy {
  name: string;
  naive: boolean;
  /** Habit changes at the start of a month, as plan commands. */
  habits?(seen: SeniorSeen): Command[];
  /** A choice for the current moment (for calibration, `acceptAll` or `settle:` with moves), or `wait`. */
  choose(seen: SeniorSeen, moment: SeniorMoment): string;
}

export type SeniorRunResult = RunResult & { months: number };

/** Plays the senior manager level from a seed: a line manager run handed straight to an outside hire, then up to 36 months. */
// @spec BAL-SENIOR-001, BAL-SENIOR-002, BAL-SENIOR-003
export function playSeniorRun(strategy: SeniorStrategy, seed: number, content: Situation[], deps: Dependencies = SENIOR_DEPS): SeniorRunResult {
  // The same handover for every strategy: the line manager's team goes to an outside hire at once.
  const line = newRun(seed, content, deps);
  let run: Run = { ...line, phase: 'handover', handoverChoices: seniorManagerLevel.handoverChoices!(line.level, line.sim) };
  const reviews: SeniorSeen['reviews'] = [];
  const month = () => Math.round((run.sim.week - run.levelStartWeek) / 4) + 1;
  const step = (command: Command) => {
    const result = apply(run, command, content, deps);
    if (!result.ok) throw new Error(`${strategy.name}, seed ${seed}, month ${month()}: ${command.kind} refused: ${result.error}`);
    run = result.run;
  };
  step({ kind: 'handover', choice: 'hire' });
  while (run.phase !== 'ended') {
    if (run.phase === 'review') {
      reviews.push({ month: month() - 1, rating: run.review!.rating, outcome: run.review!.outcome });
      step({ kind: 'acknowledge' });
      continue;
    }
    if (run.phase !== 'week' || month() > SENIOR_BALANCE_TUNING.months) break;
    // A copy, so a strategy cannot reach the run through what it is shown.
    const see = (): SeniorSeen => structuredClone({ month: month(), view: seniorManagerLevel.view(run.level as SeniorState, run.sim) as SeniorView, reviews });
    for (const command of strategy.habits?.(see()) ?? []) step(command);
    for (let current = run.week.find((m) => m.status === 'open'); current; current = run.week.find((m) => m.status === 'open')) {
      const seen = see();
      const choice = strategy.choose(seen, momentOf(run, seen.view, current.id));
      step(commandFor(choice, current.id));
    }
    step({ kind: 'endWeek' });
  }
  const level = run.level as SeniorState;
  return {
    strategy: strategy.name,
    seed,
    weeks: run.sim.week,
    months: Math.min(SENIOR_BALANCE_TUNING.months, Math.round((run.sim.week - run.levelStartWeek) / 4)),
    ending: endingOf(run),
    ratings: reviews.map((r) => r.rating),
    regrettedQuits: (level.regretted ?? []).reduce((n, r) => n + r.count, 0),
  };
}

function momentOf(run: Run, view: SeniorView, id: string): SeniorMoment {
  const entry = run.week.find((m) => m.id === id)!;
  if (entry.source === 'situation') {
    const p = run.presented.find((x) => x.id === id)!;
    return structuredClone({ id, source: 'situation', situationId: p.situationId, title: entry.title, text: p.text, choices: p.choices });
  }
  const m = view.moments.find((x) => x.id === id)!;
  return structuredClone({ id, source: 'level', title: m.title, text: m.text, choices: m.choices, kind: m.kind, ...(m.calibration && { calibration: m.calibration }), ...(m.teamId && { teamId: m.teamId }) });
}
