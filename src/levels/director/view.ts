import { band } from '../line-manager';
import { behindScheduleProjects, overdueProjects, type HistoryEntry, type Rating, type SimState } from '../../sim';
import { leaderOf, quarterOf } from './core';
import type { DirectorState } from './types';

type Schedule = 'onSchedule' | 'behind' | 'overdue';

export interface SeniorManagerView {
  id: string;
  name: string;
  personality: string | null;
  groupId: string;
  performance: Rating | 'unrated';
  motivation: number;
  stress: number;
  /** Management skill, as a band. */
  skill: number;
  want: string;
  memory: string[];
}

export interface GroupView {
  id: string;
  name: string;
  seniorManagerId: string | null;
  headcount: number;
  motivation: number;
  stress: number;
  attritionRisk: number;
  /** Where the mood comes from: the last engagement survey, or the listening tour this quarter. */
  seen: 'survey' | 'tour';
  /** The quarter of the level it was measured in. */
  quarter: number;
  projects: { id: string; name: string; progress: number; scope: number; deadlineWeek: number; schedule: Schedule }[];
}

export interface OutsiderView {
  id: string;
  name: string;
  personality: string | null;
  role: 'executive' | 'peer';
  trust: number;
  want: string;
  memory: string[];
}

export interface BetView {
  projectId: string;
  name: string;
  groupId: string;
  progress: number;
  scope: number;
  deadlineWeek: number;
  schedule: Schedule;
  landing: number;
  failing: number;
}

export interface DirectorView {
  seniorManagers: SeniorManagerView[];
  groups: GroupView[];
  upward: OutsiderView[];
  bets: BetView[];
  habits: DirectorState['habits'];
}

/** What someone remembers: their latest notes, newest first. */
const memoryOf = (history: HistoryEntry[]) =>
  history
    .filter((h) => h.note)
    .map((h) => h.note!)
    .reverse()
    .slice(0, 3);

/** The player's view: senior managers as people, groups as last surveyed, and the room above. */
// @spec DIR-VIS-001, DIR-VIS-002, DIR-VIS-003, DIR-VIS-004, DIR-VIS-006, DIR-ORG-003
export function directorView(level: DirectorState, sim: SimState): DirectorView {
  const overdue = new Set(overdueProjects(sim).map((p) => p.id));
  const behind = new Set(behindScheduleProjects(sim).map((p) => p.id));
  const schedule = (id: string): Schedule => (overdue.has(id) ? 'overdue' : behind.has(id) ? 'behind' : 'onSchedule');
  const want = (id: string) => (level.learnedWants[id] ? sim.people[id]!.want : 'unknown');
  const quarter = quarterOf(level, sim);
  const seniorManagers: SeniorManagerView[] = [];
  const groups: GroupView[] = [];
  for (const g of level.groupIds) {
    const team = sim.teams[g];
    if (!team?.aggregate) continue;
    const lead = leaderOf(sim, g);
    if (lead) {
      const p = sim.people[lead]!;
      seniorManagers.push({ id: p.id, name: p.name, personality: p.personality ?? null, groupId: g, performance: p.performance, motivation: band(p.motivation), stress: band(p.stress), skill: band(p.skill), want: want(p.id), memory: memoryOf(p.history) });
    }
    const toured = level.visited?.groupId === g && level.visited.quarter === quarter;
    const mood = toured ? team.aggregate : (level.survey.groups[g] ?? team.aggregate);
    groups.push({
      id: g,
      name: team.name,
      seniorManagerId: lead,
      headcount: team.aggregate.headcount,
      motivation: band(mood.motivation),
      stress: band(mood.stress),
      attritionRisk: band(mood.attritionRisk),
      seen: toured ? 'tour' : 'survey',
      quarter: toured ? quarter : level.survey.quarter,
      projects: Object.values(sim.projects)
        .filter((p) => p.teamId === g && p.status === 'active')
        .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
        .map((p) => ({ id: p.id, name: p.name, progress: p.progress, scope: p.scope, deadlineWeek: p.deadlineWeek, schedule: schedule(p.id) })),
    });
  }
  const upward = [level.executiveId, ...level.peerIds]
    .map((id) => sim.people[id])
    .filter((p) => p !== undefined && p.status === 'active')
    .map((p) => ({ id: p!.id, name: p!.name, personality: p!.personality ?? null, role: p!.role as 'executive' | 'peer', trust: band(p!.trust), want: want(p!.id), memory: memoryOf(p!.history) }));
  const bets = level.bets.flatMap((b): BetView[] => {
    const p = sim.projects[b.projectId];
    return p ? [{ projectId: p.id, name: p.name, groupId: b.groupId, progress: p.progress, scope: p.scope, deadlineWeek: p.deadlineWeek, schedule: schedule(p.id), landing: b.landing, failing: b.failing }] : [];
  });
  return { seniorManagers, groups, upward, bets, habits: level.habits };
}
