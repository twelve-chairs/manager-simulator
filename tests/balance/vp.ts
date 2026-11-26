import { directorLevel } from '../../src/levels/director';
import { lineManagerLevel } from '../../src/levels/line-manager';
import { seniorManagerLevel } from '../../src/levels/senior-manager';
import { vpLevel, type VpState, type VpView } from '../../src/levels/vp';
import type { Dependencies, Run } from '../../src/loop';
import type { CareerLevel } from '../../src/loop/types';
import { conductReview } from '../../src/review';
import type { Situation } from '../../src/situations';
import { playQuarterRun, type QuarterLevelPlay, type QuarterRunResult, type QuarterSeen, type QuarterStrategy } from './upper';

/** The VP's harness tuning: the whole level, six reviews, and the checks' thresholds. */
export const VP_BALANCE_TUNING = {
  quarters: 12,
  scoreMargin: 0.3,
  minSoundPromotionShare: 0.3,
  maxNaivePromotionShare: 0.2,
  maxSoundBurnoutShare: 0.1,
  maxSoundManagedOutShare: 0.1,
} as const;

export const VP_DEPS: Dependencies = { levels: [lineManagerLevel, seniorManagerLevel, directorLevel, vpLevel], review: conductReview };

export type VpSeen = QuarterSeen<VpView>;

/** The current moment as the scene shows it: the level's own, from its view, or a presented situation. */
export interface VpMomentSeen {
  id: string;
  source: 'level' | 'situation';
  situationId?: string;
  title: string;
  text: string;
  choices: { id: string; label: string }[];
  kind?: VpView['moments'][number]['kind'];
  divisionId?: string;
  personId?: string;
  otherId?: string;
}

export type VpStrategy = QuarterStrategy<VpView, VpMomentSeen>;

function momentOf(run: Run, view: VpView, id: string): VpMomentSeen {
  const entry = run.week.find((m) => m.id === id)!;
  if (entry.source === 'situation') {
    const p = run.presented.find((x) => x.id === id)!;
    return structuredClone({ id, source: 'situation', situationId: p.situationId, title: entry.title, text: p.text, choices: p.choices });
  }
  const m = view.moments.find((x) => x.id === id)!;
  return structuredClone({ id, source: 'level', title: m.title, text: m.text, choices: m.choices, kind: m.kind, ...(m.divisionId && { divisionId: m.divisionId }), ...(m.personId && { personId: m.personId }), ...(m.otherId && { otherId: m.otherId }) });
}

const VP_PLAY: QuarterLevelPlay<VpView, VpMomentSeen> = {
  deps: VP_DEPS,
  handovers: [seniorManagerLevel, directorLevel, vpLevel] as CareerLevel<unknown>[],
  quarters: VP_BALANCE_TUNING.quarters,
  view: (run) => vpLevel.view(run.level as VpState, run.sim) as VpView,
  momentOf,
  regretted: (run) => (run.level as VpState).regretted.reduce((n, r) => n + r.count, 0),
};

/** Plays the VP level from a seed: a line manager run handed straight up three times to outside hires, then up to 12 quarters. */
// @spec BAL-VP-001, BAL-VP-002, BAL-VP-003
export const playVpRun = (strategy: VpStrategy, seed: number, content: Situation[]): QuarterRunResult => playQuarterRun(VP_PLAY, strategy, seed, content);
