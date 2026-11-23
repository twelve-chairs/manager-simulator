import { compareCodeUnits } from '../../sim';
import { RATINGS, behindScheduleProjects, overdueProjects, type SimState } from '../../sim';
import { band, reconcileVacancies, teamEngineers, teamProjects } from './core';
import { LEVEL } from './start';
import { goalStatus } from './goals';
import { HABIT_CAUSE, LINE_TUNING } from './tuning';
import type { Assessment, Measure } from '../../review';
import type { LineState, Scorecard } from './types';

/** Records completions, keeps vacancies in step and tracks burnout, after the simulation advances. */
// @spec LINE-END-005, LINE-END-006, LINE-HIRE-002
export function afterAdvance(level: LineState, sim: SimState): { level: LineState; burnedOut: boolean } {
  const s = structuredClone(level);
  const playedWeek = sim.week - LEVEL.weeksPerStep;
  for (const id of Object.keys(sim.projects).sort(compareCodeUnits)) {
    const p = sim.projects[id]!;
    if (p.teamId === s.teamId && p.status === 'completed' && !Object.hasOwn(s.completions, id)) s.completions[id] = playedWeek;
  }
  reconcileVacancies(s, sim);
  s.burnoutWeeks = sim.player.stress >= LINE_TUNING.burnoutThreshold ? s.burnoutWeeks + 1 : 0;
  return { level: s, burnedOut: s.burnoutWeeks >= LINE_TUNING.burnoutWeeks };
}

/** Whether a week falls in the `weeks` weeks before `week`. */
const before = (when: number, week: number, weeks: number) => when >= week - weeks && when < week;

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The measures the performance review reads, over the review period before the current week. */
// @spec LINE-END-001, LINE-END-002, LINE-END-003
export function scorecard(level: LineState, sim: SimState): Scorecard {
  const week = sim.week;
  const period = LEVEL.reviewEveryWeeks;

  const completedOnTime = Object.entries(level.completions).filter(([id, when]) => {
    const p = sim.projects[id];
    return p && before(when, week, period) && when <= p.deadlineWeek;
  }).length;
  const active = teamProjects(level, sim);
  const troubled = new Set([...overdueProjects(sim), ...behindScheduleProjects(sim)].map((p) => p.id));
  const onScheduleShare = active.length ? active.filter((id) => !troubled.has(id)).length / active.length : null;

  const quits = Object.values(sim.people).filter(
    (p) => p.teamId === level.teamId && p.status === 'departed' && p.departure?.reason === 'quit' && before(p.departure.week, week, period),
  );
  const meets = RATINGS.indexOf('meets');
  const quitsRatedMeetsOrAbove = quits.filter((p) => p.performance !== 'unrated' && RATINGS.indexOf(p.performance) >= meets).length;

  const engineers = teamEngineers(level, sim).map((id) => sim.people[id]!);
  const hadOneOnOne = engineers.filter((p) =>
    p.history.some((h) => h.cause.kind === 'action' && h.cause.actionId === HABIT_CAUSE.oneOnOnes && before(h.week, week, LINE_TUNING.recentOneOnOneWeeks)),
  ).length;

  return {
    delivery: { completedOnTime, onScheduleShare },
    retention: { quits: quits.length, quitsRatedMeetsOrAbove },
    teamHealth: {
      motivation: average(engineers.map((p) => p.motivation)),
      stress: average(engineers.map((p) => p.stress)),
      oneOnOneShare: engineers.length ? hadOneOnOne / engineers.length : 0,
    },
    // @spec LINE-END-004
    promotionPossible: week >= LINE_TUNING.promotionFromReview * period,
  };
}

/** Why a stretched team caps the rating. */
export const STRETCHED_TEAM = "Your manager won't call it a strong quarter with the team this stretched.";
/** Why a team overwhelmed for most of the quarter caps it lower. */
export const OVERLOADED_TEAM = 'Your team spent most of the quarter overwhelmed.';

/** The measures a review scores, with the level's targets, whether promotion is possible yet, whether this is the last review, and any ceiling. */
// @spec LINE-END-004, LINE-END-007, LINE-END-008, LINE-END-009, LINE-END-011, LINE-GOAL-003
export function assess(level: LineState, sim: SimState): Assessment {
  const card = scorecard(level, sim);
  const t = LINE_TUNING.review;
  const measure = (id: Exclude<keyof typeof t, 'goal'>, value: number, better: Measure['better']): Measure => ({ id, value, ...t[id], better });
  // A goal about an engineer who has left no longer counts.
  const goals = level.goals
    .map((g) => ({ g, status: goalStatus(g, level, sim) }))
    .filter((x) => !x.status.dropped)
    .map(({ g, status }): Measure => ({ id: `goal:${g.id}`, value: status.achieved ? 1 : 0, ...t.goal, better: 'higher' }));
  return {
    measures: [
      measure('completedOnTime', card.delivery.completedOnTime, 'higher'),
      // A team between projects has no on-schedule share to reward or punish, unless it spent most of the quarter with none.
      ...(card.delivery.onScheduleShare !== null
        ? [measure('onScheduleShare', card.delivery.onScheduleShare, 'higher')]
        : level.idleWeeks > LINE_TUNING.idleQuarterWeeks
          ? [measure('onScheduleShare', 0, 'higher')]
          : []),
      measure('regrettedQuits', card.retention.quitsRatedMeetsOrAbove, 'lower'),
      measure('motivation', card.teamHealth.motivation, 'higher'),
      measure('stress', card.teamHealth.stress, 'lower'),
      measure('oneOnOneShare', card.teamHealth.oneOnOneShare, 'higher'),
      ...goals,
    ],
    promotionPossible: card.promotionPossible,
    lastReview: sim.week >= LINE_TUNING.lastReview * LINE_TUNING.reviewEveryWeeks,
    ...(level.overwhelmedWeeks > LINE_TUNING.overloadedWeeks
      ? { ceiling: { rating: 'partial' as const, reason: OVERLOADED_TEAM } }
      : band(card.teamHealth.stress) >= LINE_TUNING.stretchedTeamBand
        ? { ceiling: { rating: 'meets' as const, reason: STRETCHED_TEAM } }
        : {}),
  };
}
