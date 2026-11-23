import { band } from '../line-manager';
import type { SimState } from '../../sim';
import { leadOf } from './core';
import type { SeniorGoal, SeniorState } from './types';

const PERIOD = 24;

/** Sets the review period's goals from the group's state: zero regretted attrition, and up to two more where they fit. */
// @spec SENIOR-GOAL-001
export function setGoals(level: SeniorState, sim: SimState) {
  const goals: Omit<SeniorGoal, 'id' | 'week'>[] = [{ kind: 'zeroRegretted' }];
  const strained = [...level.teamIds].filter((t) => band(sim.teams[t]!.aggregate!.stress) >= 3).sort((a, b) => sim.teams[b]!.aggregate!.stress - sim.teams[a]!.aggregate!.stress)[0];
  if (strained) goals.push({ kind: 'unstrainTeam', teamId: strained });
  const due = Object.values(sim.projects)
    .filter((p) => level.teamIds.includes(p.teamId) && p.status === 'active' && p.deadlineWeek > sim.week && p.deadlineWeek <= sim.week + PERIOD)
    .sort((a, b) => a.deadlineWeek - b.deadlineWeek || (a.id < b.id ? -1 : 1))[0];
  if (due) goals.push({ kind: 'shipProject', projectId: due.id, deadlineWeek: due.deadlineWeek });
  const growable = level.teamIds
    .flatMap((t) => leadOf(level, sim, t) ?? [])
    .filter((m) => band(sim.people[m]!.skill) < 4)
    .sort((a, b) => sim.people[a]!.skill - sim.people[b]!.skill)[0];
  if (growable) goals.push({ kind: 'growManager', managerId: growable, targetBand: band(sim.people[growable]!.skill) + 1 });
  level.goals = goals.slice(0, 3).map((g) => {
    level.counters.goal += 1;
    return { ...g, id: `g${level.counters.goal}`, week: sim.week };
  });
}

/** A goal in words, its progress, and whether it has been achieved. */
export function goalStatus(goal: SeniorGoal, level: SeniorState, sim: SimState): { text: string; progress: string; achieved: boolean } {
  switch (goal.kind) {
    case 'zeroRegretted': {
      const left = level.regretted.filter((r) => r.week >= goal.week).reduce((n, r) => n + r.count, 0);
      return { text: 'Keep everyone you would want to keep', progress: left ? `${left} ${left === 1 ? 'person' : 'people'} you'd have kept left` : 'Nobody you would keep has left', achieved: left === 0 };
    }
    case 'unstrainTeam': {
      const a = sim.teams[goal.teamId!]!.aggregate!;
      const out = band(a.stress) < 3;
      return { text: `Bring ${sim.teams[goal.teamId!]!.name} out of the strained band`, progress: out ? 'Out of it' : 'Still strained', achieved: out };
    }
    case 'shipProject': {
      const p = sim.projects[goal.projectId!]!;
      const done = p.status === 'completed' && (level.completions[p.id] ?? Infinity) <= goal.deadlineWeek!;
      return { text: `Ship ${p.name} by week ${goal.deadlineWeek! + 1}`, progress: p.status === 'completed' ? 'Shipped' : `${p.progress} / ${p.scope} done`, achieved: done };
    }
    case 'growManager': {
      const m = sim.people[goal.managerId!]!;
      const now = band(m.skill);
      // Skill shows only as a band, so progress is told in words rather than points.
      const there = m.status === 'active' && now >= goal.targetBand!;
      return { text: `Grow ${m.name} as a manager`, progress: m.status !== 'active' ? `${m.name} has left` : there ? 'There' : 'Not yet', achieved: there };
    }
  }
}
