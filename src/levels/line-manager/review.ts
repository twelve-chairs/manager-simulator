import { RATINGS, behindScheduleProjects, overdueProjects, type SimState } from '../../sim';
import { reconcileVacancies, teamEngineers, teamProjects } from './core';
import { LEVEL } from './start';
import { LINE_TUNING } from './tuning';
import type { LineState, Scorecard } from './types';

/** Records completions, keeps vacancies in step and tracks burnout, after the simulation advances. */
// @spec LINE-END-005, LINE-END-006, LINE-HIRE-002
export function afterAdvance(level: LineState, sim: SimState): { level: LineState; burnedOut: boolean } {
  const s = structuredClone(level);
  const playedWeek = sim.week - LEVEL.weeksPerStep;
  for (const id of Object.keys(sim.projects).sort()) {
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
// @spec LINE-END-001, LINE-END-002, LINE-END-003, LINE-END-004
export function scorecard(level: LineState, sim: SimState): Scorecard {
  const week = sim.week;
  const period = LEVEL.reviewEveryWeeks;

  const completedOnTime = Object.entries(level.completions).filter(([id, when]) => {
    const p = sim.projects[id];
    return p && before(when, week, period) && when <= p.deadlineWeek;
  }).length;
  const active = teamProjects(level, sim);
  const troubled = new Set([...overdueProjects(sim), ...behindScheduleProjects(sim)].map((p) => p.id));
  const onScheduleShare = active.length ? active.filter((id) => !troubled.has(id)).length / active.length : 1;

  const quits = Object.values(sim.people).filter(
    (p) => p.teamId === level.teamId && p.status === 'departed' && p.departure?.reason === 'quit' && before(p.departure.week, week, period),
  );
  const meets = RATINGS.indexOf('meets');
  const quitsRatedMeetsOrAbove = quits.filter((p) => p.performance !== 'unrated' && RATINGS.indexOf(p.performance) >= meets).length;

  const engineers = teamEngineers(level, sim).map((id) => sim.people[id]!);
  const hadOneOnOne = engineers.filter((p) =>
    p.history.some((h) => h.cause.kind === 'action' && h.cause.actionId === 'line-manager.one-on-one' && before(h.week, week, LINE_TUNING.recentOneOnOneWeeks)),
  ).length;

  return {
    delivery: { completedOnTime, onScheduleShare },
    retention: { quits: quits.length, quitsRatedMeetsOrAbove },
    teamHealth: {
      motivation: average(engineers.map((p) => p.motivation)),
      stress: average(engineers.map((p) => p.stress)),
      oneOnOneShare: engineers.length ? hadOneOnOne / engineers.length : 0,
    },
    promotionPossible: week >= 4 * period,
  };
}
