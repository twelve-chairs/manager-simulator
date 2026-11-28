import { band } from '../line-manager';
import type { SimState } from '../../sim';
import { quarterOf } from './core';
import { DIRECTOR_TUNING as T } from './tuning';
import type { DirectorGoal, DirectorState } from './types';

/** Sets the review period's goals from the organization's state: few regretted losses, and up to two more where they fit. */
// @spec DIR-GOAL-001
export function setGoals(level: DirectorState, sim: SimState) {
  const goals: Omit<DirectorGoal, 'id' | 'week'>[] = [{ kind: 'zeroRegretted' }];
  const strained = level.groupIds.filter((g) => sim.teams[g] && band(sim.teams[g].aggregate!.stress) >= 3).sort((a, b) => sim.teams[b]!.aggregate!.stress - sim.teams[a]!.aggregate!.stress)[0];
  if (strained) goals.push({ kind: 'unstrainGroup', groupId: strained });
  const bet = level.bets.find((b) => sim.projects[b.projectId]?.status === 'active');
  if (bet) goals.push({ kind: 'landBet', projectId: bet.projectId });
  const peer = level.peerIds.filter((id) => sim.people[id]?.status === 'active').sort((a, b) => sim.people[a]!.trust - sim.people[b]!.trust || (a < b ? -1 : 1))[0];
  if (peer) goals.push({ kind: 'peerTrust', personId: peer });
  level.goals = goals.slice(0, 3).map((g) => ({ ...g, id: `dg${++level.counters.goal}`, week: sim.week }));
  level.periodStart = sim.week;
}

type GoalStatus = { text: string; progress: string; achieved: boolean };

function regrettedStatus(goal: DirectorGoal, level: DirectorState): GoalStatus {
  const left = level.regretted.filter((r) => r.week >= goal.week).reduce((n, r) => n + r.count, 0);
  const most = T.goalRegrettedMost;
  const people = left === 1 ? 'person' : 'people';
  // @spec DIR-GOAL-002
  const progress = left ? `${left} ${people} you'd have kept left this period` : 'Nobody you would keep has left this period';
  return { text: `Lose no more than ${most} of the people you would want to keep`, progress, achieved: left <= most };
}

function unstrainStatus(goal: DirectorGoal, level: DirectorState, sim: SimState): GoalStatus {
  const text = `Bring ${sim.teams[goal.groupId!]?.name ?? 'The group'} out of the strained band by the next survey`;
  const since = level.survey.quarter > quarterOf(level, { ...sim, week: goal.week }) ? level.survey.groups[goal.groupId!] : undefined;
  if (since === undefined) return { text, progress: 'Waiting for the survey', achieved: false };
  const out = band(since.stress) < 3;
  return { text, progress: out ? 'Out of it' : 'Still strained', achieved: out };
}

function betStatus(goal: DirectorGoal, level: DirectorState, sim: SimState): GoalStatus {
  const p = sim.projects[goal.projectId!];
  const landed = level.betResults.some((r) => r.projectId === goal.projectId && r.landed);
  const text = `Land ${p?.name ?? 'the bet'}`;
  if (landed) return { text, progress: 'Landed', achieved: true };
  return { text, progress: p?.status === 'active' ? `${p.progress} / ${p.scope} done` : 'Not landed', achieved: false };
}

function peerStatus(goal: DirectorGoal, sim: SimState): GoalStatus {
  const p = sim.people[goal.personId!];
  const kept = p?.status === 'active' && band(p.trust) >= 3;
  return { text: `Keep ${p?.name ?? 'your peer'} on side`, progress: kept ? 'Trusting' : 'Not trusting', achieved: kept };
}

/** A goal in words, its progress, and whether it has been achieved. */
export function goalStatus(goal: DirectorGoal, level: DirectorState, sim: SimState): GoalStatus {
  switch (goal.kind) {
    case 'zeroRegretted':
      return regrettedStatus(goal, level);
    case 'unstrainGroup':
      return unstrainStatus(goal, level, sim);
    case 'landBet':
      return betStatus(goal, level, sim);
    case 'peerTrust':
      return peerStatus(goal, sim);
  }
}
