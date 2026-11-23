import { band } from '../line-manager';
import type { SimState } from '../../sim';
import { quarterOf } from './core';
import type { DirectorGoal, DirectorState } from './types';

/** Sets the review period's goals from the organization's state: zero regretted attrition, and up to two more where they fit. */
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

/** A goal in words, its progress, and whether it has been achieved. */
export function goalStatus(goal: DirectorGoal, level: DirectorState, sim: SimState): { text: string; progress: string; achieved: boolean } {
  switch (goal.kind) {
    case 'zeroRegretted': {
      const left = level.regretted.filter((r) => r.week >= goal.week).reduce((n, r) => n + r.count, 0);
      return { text: 'Keep everyone you would want to keep', progress: left ? `${left} ${left === 1 ? 'person' : 'people'} you'd have kept left` : 'Nobody you would keep has left', achieved: left === 0 };
    }
    case 'unstrainGroup': {
      const name = sim.teams[goal.groupId!]?.name ?? 'The group';
      const since = level.survey.quarter > quarterOf(level, { ...sim, week: goal.week }) ? level.survey.groups[goal.groupId!] : undefined;
      const out = since !== undefined && band(since.stress) < 3;
      return { text: `Bring ${name} out of the strained band by the next survey`, progress: since === undefined ? 'Waiting for the survey' : out ? 'Out of it' : 'Still strained', achieved: out };
    }
    case 'landBet': {
      const p = sim.projects[goal.projectId!];
      const landed = level.betResults.some((r) => r.projectId === goal.projectId && r.landed);
      return { text: `Land ${p?.name ?? 'the bet'}`, progress: landed ? 'Landed' : p?.status === 'active' ? `${p.progress} / ${p.scope} done` : 'Not landed', achieved: landed };
    }
    case 'peerTrust': {
      const p = sim.people[goal.personId!];
      const kept = p?.status === 'active' && band(p.trust) >= 3;
      return { text: `Keep ${p?.name ?? 'your peer'} on side`, progress: kept ? 'Trusting' : 'Not trusting', achieved: kept };
    }
  }
}
