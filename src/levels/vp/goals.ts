import { band } from '../line-manager';
import type { SimState } from '../../sim';
import { quarterOf } from './core';
import { VP_TUNING as T } from './tuning';
import type { VpGoal, VpState } from './types';

/** Sets the review period's goals from the function's state: few regretted losses, and up to two more where they fit. */
// @spec VP-GOAL-001
export function setGoals(level: VpState, sim: SimState) {
  const goals: Omit<VpGoal, 'id' | 'week'>[] = [{ kind: 'fewRegretted' }];
  const strained = level.divisionIds.filter((g) => sim.teams[g] && band(sim.teams[g].aggregate!.stress) >= 3).sort((a, b) => sim.teams[b]!.aggregate!.stress - sim.teams[a]!.aggregate!.stress)[0];
  if (strained) goals.push({ kind: 'unstrainDivision', divisionId: strained });
  // Each period begins with a half, whose company priority is set this quarter: the goal names whichever it is.
  goals.push({ kind: 'landPriority' });
  const peer = level.peerIds.filter((id) => sim.people[id]?.status === 'active').sort((a, b) => sim.people[a]!.trust - sim.people[b]!.trust || (a < b ? -1 : 1))[0];
  if (peer) goals.push({ kind: 'peerTrust', personId: peer });
  level.goals = goals.slice(0, 3).map((g) => ({ ...g, id: `vg${++level.counters.goal}`, week: sim.week }));
  level.periodStart = sim.week;
}

type GoalStatus = { text: string; progress: string; achieved: boolean };

function regrettedStatus(goal: VpGoal, level: VpState): GoalStatus {
  const left = level.regretted.filter((r) => r.week >= goal.week).reduce((n, r) => n + r.count, 0);
  const people = left === 1 ? 'person' : 'people';
  return { text: `Lose no more than ${T.goalRegrettedMost} of the people you would want to keep`, progress: left ? `${left} ${people} you'd have kept left` : 'Nobody you would keep has left', achieved: left <= T.goalRegrettedMost };
}

function unstrainStatus(goal: VpGoal, level: VpState, sim: SimState): GoalStatus {
  const text = `Bring ${sim.teams[goal.divisionId!]?.name ?? 'the division'} out of the strained band by the next survey`;
  const since = level.survey.quarter > quarterOf(level, { ...sim, week: goal.week }) ? level.survey.divisions[goal.divisionId!] : undefined;
  if (since === undefined) return { text, progress: 'Waiting for the survey', achieved: false };
  const out = band(since.stress) < 3;
  return { text, progress: out ? 'Out of it' : 'Still strained', achieved: out };
}

function priorityStatus(goal: VpGoal, level: VpState, sim: SimState): GoalStatus {
  const result = level.priorityResults.find((r) => r.week >= goal.week);
  const running = level.priority && level.priority.week >= goal.week ? sim.projects[level.priority.projectId] : undefined;
  const text = 'Land the half’s company priority';
  if (result?.landed) return { text, progress: 'Landed', achieved: true };
  if (running?.status === 'active') return { text, progress: `${running.progress} / ${running.scope} done`, achieved: false };
  return { text, progress: result ? 'Not landed' : 'Not set yet', achieved: false };
}

function peerStatus(goal: VpGoal, sim: SimState): GoalStatus {
  const p = sim.people[goal.personId!];
  const kept = p?.status === 'active' && band(p.trust) >= 3;
  return { text: `Keep ${p?.name ?? 'your peer'} on side`, progress: kept ? 'Trusting' : 'Not trusting', achieved: kept };
}

/** A goal in words, its progress, and whether it has been achieved. */
// @spec VP-GOAL-002
export function goalStatus(goal: VpGoal, level: VpState, sim: SimState): GoalStatus {
  switch (goal.kind) {
    case 'fewRegretted':
      return regrettedStatus(goal, level);
    case 'unstrainDivision':
      return unstrainStatus(goal, level, sim);
    case 'landPriority':
      return priorityStatus(goal, level, sim);
    case 'peerTrust':
      return peerStatus(goal, sim);
  }
}

/** The goals as the view shows them. */
export const goalViews = (level: VpState, sim: SimState) =>
  level.goals.map((g) => {
    const { text, progress } = goalStatus(g, level, sim);
    return { id: g.id, text, progress };
  });
