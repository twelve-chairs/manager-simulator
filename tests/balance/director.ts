import { directorLevel, type DirectorState, type DirectorView } from '../../src/levels/director';
import { lineManagerLevel } from '../../src/levels/line-manager';
import { seniorManagerLevel } from '../../src/levels/senior-manager';
import type { Dependencies, Run } from '../../src/loop';
import type { CareerLevel } from '../../src/loop/types';
import { conductReview } from '../../src/review';
import type { Situation } from '../../src/situations';
import { playQuarterRun, type QuarterLevelPlay, type QuarterRunResult, type QuarterSeen, type QuarterStrategy } from './upper';

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
export type DirectorSeen = QuarterSeen<DirectorView>;

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
  offers?: NonNullable<DirectorView['moments'][number]['offers']>;
  heads?: number;
  groupId?: string;
  personId?: string;
}

/** A choice for the current moment is `place:` or `fund:` with JSON where the moment takes one, or `wait`. */
export type DirectorStrategy = QuarterStrategy<DirectorView, DirectorMomentSeen>;

export type DirectorRunResult = QuarterRunResult;

const DIRECTOR_PLAY: QuarterLevelPlay<DirectorView, DirectorMomentSeen> = {
  deps: DIRECTOR_DEPS,
  handovers: [seniorManagerLevel, directorLevel] as CareerLevel<unknown>[],
  quarters: DIRECTOR_BALANCE_TUNING.quarters,
  view: (run) => directorLevel.view(run.level as DirectorState, run.sim) as DirectorView,
  momentOf: (run, view, id) => momentOf(run, view, id),
  regretted: (run) => ((run.level as DirectorState).regretted ?? []).reduce((n, r) => n + r.count, 0),
};

/** Plays the director level from a seed: a line manager run handed straight up twice to outside hires, then up to 12 quarters. */
// @spec BAL-DIR-001, BAL-DIR-002, BAL-DIR-003
export function playDirectorRun(strategy: DirectorStrategy, seed: number, content: Situation[], deps: Dependencies = DIRECTOR_DEPS): DirectorRunResult {
  return playQuarterRun({ ...DIRECTOR_PLAY, deps }, strategy, seed, content);
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
