import { compareCodeUnits } from '../../sim';
import { RATINGS, behindScheduleProjects, overdueProjects, type ChangeLogEntry, type HistoryEntry, type Person, type SimState } from '../../sim';
import { band, reconcileVacancies, teamEngineers, teamProjects } from './core';
import { LEVEL } from './start';
import { goalStatus } from './goals';
import { watchAfterAdvance } from './watch';
import { HABIT_CAUSE, LINE_TUNING } from './tuning';
import type { Assessment, Measure } from '../../review';
import type { LevelProgressCause, LineState, ProgressCause, ProjectMove, Scorecard } from './types';

const LEVEL_CAUSES: LevelProgressCause[] = ['payDown', 'rollBack', 'approvals'];
/** The simulation's rules that move progress while it advances (simulation core, SIM-ADV-001). */
const ADVANCE_CAUSES: Record<string, ProgressCause> = { 'rule.setbacks': 'setback', 'rule.projectWork': 'work' };

/**
 * How each of the team's active projects moved in the week just played: the level's own choices as it counted them,
 * the setback and work rules from the advance's log, and what remains of the change before the advance, which only
 * the week's situations can have made.
 */
function projectMoves(level: LineState, sim: SimState, log: ChangeLogEntry[], playedWeek: number): ProjectMove[] {
  const start = level.weekStart.week === playedWeek ? level.weekStart : { projects: {} as Record<string, number>, causes: {} as LineState['weekStart']['causes'] };
  const moves: ProjectMove[] = [];
  for (const id of Object.keys(sim.projects).sort(compareCodeUnits)) {
    const p = sim.projects[id]!;
    if (p.teamId !== level.teamId || p.status !== 'active') continue;
    const advanced: Partial<Record<ProgressCause, number>> = {};
    for (const e of log) {
      const cause = e.cause.kind === 'rule' ? ADVANCE_CAUSES[e.cause.ruleId] : undefined;
      if (cause && e.target.kind === 'project' && e.target.id === id && e.field === 'progress') advanced[cause] = (advanced[cause] ?? 0) + (Number(e.after) - Number(e.before));
    }
    const from = start.projects[id] ?? 0;
    const counted = start.causes[id] ?? {};
    const beforeAdvance = p.progress - (advanced.setback ?? 0) - (advanced.work ?? 0);
    const situations = beforeAdvance - from - LEVEL_CAUSES.reduce((n, c) => n + (counted[c] ?? 0), 0);
    const amounts: [ProgressCause, number][] = [...LEVEL_CAUSES.map((c): [ProgressCause, number] => [c, counted[c] ?? 0]), ['situations', situations], ['setback', advanced.setback ?? 0], ['work', advanced.work ?? 0]];
    const causes = amounts.filter(([, amount]) => amount !== 0).map(([cause, amount]) => ({ cause, amount }));
    if (causes.length) moves.push({ projectId: id, name: p.name, start: from, end: p.progress, scope: p.scope, causes });
  }
  return moves;
}

/** How the team's projects moved in the week just played, and what moved them. */
// @spec LINE-RECAP-005
export function movedLastWeek(level: LineState, sim: SimState): ProjectMove[] {
  return level.projectMoves.week === sim.week - LEVEL.weeksPerStep ? level.projectMoves.moves : [];
}

/** Records completions and how projects moved, keeps vacancies in step and tracks burnout, after the simulation advances. */
// @spec LINE-END-005, LINE-END-006, LINE-HIRE-002, LINE-RECAP-005, LINE-RECAP-007
export function afterAdvance(level: LineState, sim: SimState, log: ChangeLogEntry[] = []): { level: LineState; burnedOut: boolean } {
  const s = structuredClone(level);
  const playedWeek = sim.week - LEVEL.weeksPerStep;
  s.projectMoves = { week: playedWeek, moves: projectMoves(s, sim, log, playedWeek) };
  for (const id of Object.keys(sim.projects).sort(compareCodeUnits)) {
    const p = sim.projects[id]!;
    if (p.teamId === s.teamId && p.status === 'completed' && !Object.hasOwn(s.completions, id)) s.completions[id] = playedWeek;
  }
  reconcileVacancies(s, sim);
  s.burnoutWeeks = sim.player.stress >= LINE_TUNING.burnoutThreshold ? s.burnoutWeeks + 1 : 0;
  const burnedOut = s.burnoutWeeks >= LINE_TUNING.burnoutWeeks;
  watchAfterAdvance(s, sim, burnedOut);
  return { level: s, burnedOut };
}

/** Someone who quit, with what the departure rule weighs, in terms the player could read on their card, and the last thing between you. */
export interface Quit {
  personId: string;
  name: string;
  lowMotivationWeeks: number;
  highStressWeeks: number;
  lowTrust: boolean;
  lastMemory?: string;
}

/** The people who quit in the turn that began at `played`, among those `mine` picks; `memory` is what each remembers, oldest first. */
export function quitsIn(sim: SimState, played: number, mine: (p: Person) => boolean, memory: (history: HistoryEntry[]) => HistoryEntry[]): Quit[] {
  return Object.values(sim.people)
    .filter((p) => p.departure?.reason === 'quit' && p.departure.week === played && mine(p))
    .sort((a, b) => compareCodeUnits(a.id, b.id))
    .map((p) => {
      const last = memory(p.history).at(-1)?.note;
      return { personId: p.id, name: p.name, lowMotivationWeeks: p.lowMotivationWeeks, highStressWeeks: p.highStressWeeks, lowTrust: band(p.trust) <= 1, ...(last && { lastMemory: last }) };
    });
}

const habitCauses = new Set<string>(Object.values(HABIT_CAUSE));

/** The team's engineers who quit in the week just played, with what led to it and their last memory that is not a habit's routine. */
// @spec LINE-RECAP-004
export function quitLastWeek(level: LineState, sim: SimState): Quit[] {
  return quitsIn(sim, sim.week - LEVEL.weeksPerStep, (p) => p.teamId === level.teamId, (h) => h.filter((e) => e.note && !(e.cause.kind === 'action' && habitCauses.has(e.cause.actionId))));
}

/** The team's projects completed in the week just played, and how many weeks after their deadlines. */
// @spec LINE-RECAP-003
export function shippedLastWeek(level: LineState, sim: SimState): { projectId: string; name: string; weeksLate: number }[] {
  const played = sim.week - LEVEL.weeksPerStep;
  return Object.entries(level.completions)
    .filter(([id, when]) => when === played && sim.projects[id])
    .map(([id, when]) => ({ projectId: id, name: sim.projects[id]!.name, weeksLate: Math.max(0, when - sim.projects[id]!.deadlineWeek) }))
    .sort((a, b) => compareCodeUnits(a.projectId, b.projectId));
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

/** A team overwhelmed for most of the quarter caps the rating at partial; one still stretched at its end, at meets. */
function teamCeiling(overwhelmedWeeks: number, stress: number) {
  if (overwhelmedWeeks > LINE_TUNING.overloadedWeeks) return { ceiling: { rating: 'partial' as const, reason: OVERLOADED_TEAM } };
  return band(stress) >= LINE_TUNING.stretchedTeamBand ? { ceiling: { rating: 'meets' as const, reason: STRETCHED_TEAM } } : {};
}

/** The measures a review scores, with the level's targets, whether promotion is possible yet, whether this is the last review, and any ceiling. */
// @spec LINE-END-004, LINE-END-007, LINE-END-008, LINE-END-009, LINE-END-011, LINE-GOAL-003
export function assess(level: LineState, sim: SimState): Assessment {
  const card = scorecard(level, sim);
  const t = LINE_TUNING.review;
  const measure = (id: Exclude<keyof typeof t, 'goal'>, value: number, better: Measure['better']): Measure => ({ id, value, ...t[id], better });
  // A team between projects has no on-schedule share to reward or punish, unless it spent most of the quarter with none.
  const onScheduleMeasure = (share: number | null, idleWeeks: number): Measure[] => {
    if (share !== null) return [measure('onScheduleShare', share, 'higher')];
    return idleWeeks > LINE_TUNING.idleQuarterWeeks ? [measure('onScheduleShare', 0, 'higher')] : [];
  };
  // A goal about an engineer who has left no longer counts.
  const goals = level.goals
    .map((g) => ({ g, status: goalStatus(g, level, sim) }))
    .filter((x) => !x.status.dropped)
    .map(({ g, status }): Measure => ({ id: `goal:${g.id}`, value: status.achieved ? 1 : 0, ...t.goal, better: 'higher' }));
  return {
    measures: [
      measure('completedOnTime', card.delivery.completedOnTime, 'higher'),
      ...onScheduleMeasure(card.delivery.onScheduleShare, level.idleWeeks),
      measure('regrettedQuits', card.retention.quitsRatedMeetsOrAbove, 'lower'),
      measure('motivation', card.teamHealth.motivation, 'higher'),
      measure('stress', card.teamHealth.stress, 'lower'),
      measure('oneOnOneShare', card.teamHealth.oneOnOneShare, 'higher'),
      ...goals,
    ],
    promotionPossible: card.promotionPossible,
    lastReview: sim.week >= LINE_TUNING.lastReview * LINE_TUNING.reviewEveryWeeks,
    // @spec LINE-END-004
    reviewsUntilPromotion: Math.max(0, LINE_TUNING.promotionFromReview - Math.floor(sim.week / LINE_TUNING.reviewEveryWeeks)),
    reviewsLeft: Math.max(0, LINE_TUNING.lastReview - Math.floor(sim.week / LINE_TUNING.reviewEveryWeeks)),
    ...teamCeiling(level.overwhelmedWeeks, card.teamHealth.stress),
  };
}
