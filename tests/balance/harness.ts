/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { lineManagerLevel, type LevelMoment, type View } from '../../src/levels/line-manager';
import { apply, newRun, type Command, type Dependencies, type Run } from '../../src/loop';
import { conductReview } from '../../src/review';
import { RATINGS, type Rating } from '../../src/sim';
import type { Situation } from '../../src/situations';
import { compileSituations } from '../../scripts/compile-situations';

/** Provisional thresholds for the balance checks, set from measurement. Loosening one needs its own justification. */
export const BALANCE_TUNING = {
  weeks: 78,
  reviewSlots: 6,
  scoreMargin: 0.3,
  minSoundPromotionShare: 0.3,
  // Always delegating is half of good practice in this game, so Delegator earns some promotions: about 10-15% of runs,
  // against sound practice's 38-40%, while scoring 0.7 below it. A limit near that share would fail on how content
  // reshuffles the situation draws rather than on how the game plays.
  maxNaivePromotionShare: 0.2,
  maxSoundBurnoutShare: 0.1,
} as const;

export const DEPS: Dependencies = { levels: [lineManagerLevel], review: conductReview };

/** The real situation content, compiled exactly as the build compiles it. */
export function realContent(): Situation[] {
  const dir = join(import.meta.dirname, '../../content/situations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => ({ path: f, text: readFileSync(join(dir, f), 'utf8') }));
  const result = compileSituations(files);
  if (!result.ok) throw new Error(result.errors.map((e) => `${e.path}: ${e.message}`).join('\n'));
  return result.bundle;
}

/** Everything a strategy may see: what the player sees, and nothing else. */
export interface Seen {
  week: number;
  view: View;
  reviews: { week: number; rating: Rating; outcome: string }[];
}

/** The current moment, as the player sees it in the scene. */
export interface Moment {
  id: string;
  source: 'level' | 'situation';
  day: number;
  time: string;
  title: string;
  text: string;
  choices: { id: string; label: string }[];
  /** For a situation: which one it is, so sound practice can look up its better choice. */
  situationId?: string;
  /** For a level moment: its kind, its difficulty band where it has one, and the engineer on call for a page. */
  kind?: LevelMoment['kind'];
  difficulty?: number;
  personId?: string;
  /** For a check-in: the project it is about. */
  projectId?: string;
}

export interface Strategy {
  name: string;
  naive: boolean;
  /** Habit changes at the start of a week, as plan commands. */
  habits?(seen: Seen): Command[];
  /** A choice for the current moment, or `wait`. */
  choose(seen: Seen, moment: Moment): string;
}

export interface RunResult {
  strategy: string;
  seed: number;
  weeks: number;
  ending: 'promoted' | 'burnout' | 'managedOut' | null;
  ratings: Rating[];
  regrettedQuits: number;
}

/** Plays one seeded run with a strategy, through the real turn loop, content, level and review. */
// @spec BAL-PLAY-001, BAL-PLAY-002, BAL-PLAY-003, BAL-PLAY-004, BAL-PLAY-005, BAL-MEASURE-001
export function playRun(strategy: Strategy, seed: number, content: Situation[], deps: Dependencies = DEPS): RunResult {
  let run: Run = newRun(seed, content, deps);
  const reviews: Seen['reviews'] = [];
  const step = (command: Command) => {
    const result = apply(run, command, content, deps);
    if (!result.ok) throw new Error(`${strategy.name}, seed ${seed}, week ${run.sim.week}: ${command.kind} refused: ${result.error}`);
    run = result.run;
  };
  while (run.phase !== 'ended') {
    if (run.phase === 'review') {
      reviews.push({ week: run.sim.week, rating: run.review!.rating, outcome: run.review!.outcome });
      step({ kind: 'acknowledge' });
      continue;
    }
    if (run.sim.week >= BALANCE_TUNING.weeks) break;
    const level = deps.levels.find((l) => l.params.id === run.levelId)!;
    // A copy, so a strategy cannot reach the run through what it is shown.
    const see = (): Seen => structuredClone({ week: run.sim.week, view: level.view(run.level, run.sim) as View, reviews });
    for (const command of strategy.habits?.(see()) ?? []) step(command);
    for (let current = run.week.find((m) => m.status === 'open'); current; current = run.week.find((m) => m.status === 'open')) {
      const seen = see();
      const choice = strategy.choose(seen, momentOf(run, seen.view, current.id));
      step(choice === 'wait' ? { kind: 'wait' } : { kind: 'answer', momentId: current.id, choiceId: choice });
    }
    step({ kind: 'endWeek' });
  }
  const meets = RATINGS.indexOf('meets');
  const regrettedQuits = Object.values(run.sim.people).filter(
    (p) => p.status === 'departed' && p.departure?.reason === 'quit' && p.performance !== 'unrated' && RATINGS.indexOf(p.performance) >= meets,
  ).length;
  const ending = run.ending === 'completed' ? 'promoted' : run.ending === 'burnout' ? 'burnout' : run.ending === 'managedOut' ? 'managedOut' : null;
  return { strategy: strategy.name, seed, weeks: run.sim.week, ending, ratings: reviews.map((r) => r.rating), regrettedQuits };
}

/** The current moment as the scene shows it: the level's view of its own moments, or the presented situation. */
function momentOf(run: Run, view: View, id: string): Moment {
  const entry = run.week.find((m) => m.id === id)!;
  const base = { id, source: entry.source, day: entry.day, time: entry.time, title: entry.title };
  if (entry.source === 'situation') {
    const p = run.presented.find((x) => x.id === id)!;
    return structuredClone({ ...base, text: p.text, choices: p.choices, situationId: p.situationId });
  }
  const m = view.moments.find((x) => x.id === id)!;
  return structuredClone({
    ...base,
    text: m.text,
    choices: m.choices,
    kind: m.kind,
    ...(m.difficulty !== undefined && { difficulty: m.difficulty }),
    ...(m.personId !== undefined && { personId: m.personId }),
    ...(m.kind === 'checkIn' && { projectId: m.ref }),
  });
}

/** A run's score over its six review slots: missed slots count 0 after failing, the last rating after a promotion. */
// @spec BAL-MEASURE-002
export function runScore(result: Pick<RunResult, 'ending' | 'ratings'>): number {
  const scores = result.ratings.map((r) => RATINGS.indexOf(r));
  const fill = result.ending === 'promoted' ? (scores.at(-1) ?? 0) : 0;
  while (scores.length < BALANCE_TUNING.reviewSlots) scores.push(fill);
  return scores.slice(0, BALANCE_TUNING.reviewSlots).reduce((a, b) => a + b, 0) / BALANCE_TUNING.reviewSlots;
}

export interface Summary {
  strategy: string;
  naive: boolean;
  runs: number;
  score: number;
  promoted: number;
  burnout: number;
  managedOut: number;
  regrettedQuits: number;
}

// @spec BAL-MEASURE-002
export function summarize(strategy: Strategy, results: RunResult[]): Summary {
  const share = (ending: RunResult['ending']) => results.filter((r) => r.ending === ending).length / results.length;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    strategy: strategy.name,
    naive: strategy.naive,
    runs: results.length,
    score: mean(results.map(runScore)),
    promoted: share('promoted'),
    burnout: share('burnout'),
    managedOut: share('managedOut'),
    regrettedQuits: mean(results.map((r) => r.regrettedQuits)),
  };
}

export const table = (rows: Summary[]) =>
  [
    'strategy        score  promoted  burnout  managedOut  regrettedQuits',
    ...rows.map((s) =>
      [s.strategy.padEnd(15), s.score.toFixed(2).padStart(5), pct(s.promoted).padStart(9), pct(s.burnout).padStart(8), pct(s.managedOut).padStart(11), s.regrettedQuits.toFixed(2).padStart(15)].join(' '),
    ),
  ].join('\n');

const pct = (x: number) => `${Math.round(x * 100)}%`;
