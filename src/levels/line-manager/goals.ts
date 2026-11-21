import { behindScheduleProjects, overdueProjects, type SimState } from '../../sim';
import { isEngineer, nameOf, pick, random, teamEngineers, teamProjects } from './core';
import { LINE_TUNING } from './tuning';
import type { Goal, LineState } from './types';

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The first week of the review period a week falls in. */
export const periodOf = (week: number) => Math.floor(week / LINE_TUNING.reviewEveryWeeks) * LINE_TUNING.reviewEveryWeeks;

/** Sets the goals for the review period the week falls in, once per period. Mutates `s`. */
// @spec LINE-GOAL-001
export function setGoals(s: LineState, sim: SimState) {
  const start = periodOf(sim.week);
  if (s.goalsPeriod === start) return;
  const end = start + LINE_TUNING.reviewEveryWeeks;
  const goal = (g: Omit<Goal, 'id' | 'periodStart'>): Goal => {
    s.counters.goal += 1;
    return { id: `g${s.counters.goal}`, periodStart: start, ...g };
  };

  const projects = teamProjects(s, sim);
  const engineers = teamEngineers(s, sim);
  const atRisk = projects.filter((id) => {
    const p = sim.projects[id]!;
    return p.risk >= LINE_TUNING.atRiskProjectRisk && p.deadlineWeek >= sim.week && p.deadlineWeek < end;
  });

  const candidates: Omit<Goal, 'id' | 'periodStart'>[] = [{ kind: 'keepEveryone' }];
  if (engineers.length) {
    const id = pick(s, engineers);
    candidates.push({ kind: 'growSomeone', personId: id, startValue: sim.people[id]!.skill, target: LINE_TUNING.goals.growSkill });
  }
  if (projects.length) candidates.push({ kind: 'onSchedule' });
  if (average(engineers.map((id) => sim.people[id]!.stress)) > LINE_TUNING.goals.teamStress) candidates.push({ kind: 'lowerStress', target: LINE_TUNING.goals.teamStress });

  // Shuffle with the level's generator, then put a project in danger first: it is the period's most pressing goal.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  if (atRisk.length) {
    const projectId = pick(s, atRisk);
    // The deadline as it stands now: moving it later does not meet the goal.
    candidates.unshift({ kind: 'shipOnTime', projectId, startValue: sim.projects[projectId]!.deadlineWeek });
  }
  const count = random(s) < 0.5 ? 2 : 3;
  s.goals = candidates.slice(0, count).map(goal);
  s.goalsPeriod = start;
}

export interface GoalStatus {
  text: string;
  progress: string;
  achieved: boolean;
  /** A goal about an engineer who has left no longer counts. */
  dropped: boolean;
}

/** What a goal asks for, how it is going, and whether it is met as of now. */
// @spec LINE-GOAL-002
export function goalStatus(goal: Goal, level: LineState, sim: SimState): GoalStatus {
  switch (goal.kind) {
    case 'shipOnTime': {
      const p = sim.projects[goal.projectId!];
      const name = p?.name ?? goal.projectId!;
      const done = level.completions[goal.projectId!];
      const deadline = goal.startValue ?? p?.deadlineWeek ?? 0;
      const achieved = p !== undefined && done !== undefined && done <= deadline;
      const progress = achieved ? 'Shipped on time' : p ? `${Math.round((100 * p.progress) / p.scope)}% done, due week ${deadline + 1}` : 'Gone';
      return { text: `Ship ${name} by its deadline`, progress, achieved, dropped: false };
    }
    case 'onSchedule': {
      const active = teamProjects(level, sim);
      const troubled = new Set([...overdueProjects(sim), ...behindScheduleProjects(sim)].map((p) => p.id));
      const fine = active.filter((id) => !troubled.has(id)).length;
      // @spec LINE-GOAL-004
      // With nothing running, the goal holds only if the team was not idle for most of the quarter.
      const achieved = active.length ? fine === active.length : level.idleWeeks <= LINE_TUNING.idleQuarterWeeks;
      return { text: 'Keep every project on schedule', progress: active.length ? `${fine} of ${active.length} on schedule` : 'No projects running', achieved, dropped: false };
    }
    case 'keepEveryone': {
      const quits = Object.values(sim.people).filter((p) => p.teamId === level.teamId && p.departure?.reason === 'quit' && p.departure.week >= goal.periodStart);
      const progress = quits.length ? `${quits.map((p) => p.name).join(', ')} quit` : 'Nobody has quit';
      return { text: 'Keep everyone on the team', progress, achieved: quits.length === 0, dropped: false };
    }
    case 'growSomeone': {
      const id = goal.personId!;
      const name = nameOf(sim, id);
      if (!isEngineer(level, sim, id)) return { text: `Help ${name} grow`, progress: `${name} left, so this goal no longer counts`, achieved: false, dropped: true };
      const gained = sim.people[id]!.skill - goal.startValue!;
      const target = goal.target!;
      // Skill shows only as a band, so progress is told in words rather than points.
      const progress = gained >= target ? 'There' : gained >= target / 2 ? 'Halfway there' : gained > 0 ? 'Started' : 'Not yet';
      return { text: `Help ${name} grow`, progress, achieved: gained >= target, dropped: false };
    }
    case 'lowerStress': {
      const stress = average(teamEngineers(level, sim).map((id) => sim.people[id]!.stress));
      const achieved = stress <= goal.target!;
      return { text: 'Bring the team’s stress down', progress: achieved ? 'The team is calmer' : 'Still stretched', achieved, dropped: false };
    }
  }
}
