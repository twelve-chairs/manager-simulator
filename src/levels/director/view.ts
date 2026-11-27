import { LINE_TUNING, band } from '../line-manager';
import { behindScheduleProjects, byId, overdueProjects, scheduleOf, type Rating, type Schedule, type SimState } from '../../sim';
import { memoryOf } from '../org';
import { leaderOf, quarterOf } from './core';
import { goalStatus } from './goals';
import { DIRECTOR_TUNING as T } from './tuning';
import type { BetOffer, DirectorMoment, DirectorState } from './types';


export interface SeniorManagerView {
  id: string;
  name: string;
  personality: string | null;
  groupId: string;
  performance: Rating | 'unrated';
  /** Whether they are restless: a quit is coming unless their want is served. */
  restless: boolean;
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

export interface DirectorMomentView {
  id: string;
  kind: DirectorMoment['kind'];
  title: string;
  text: string;
  choices: { id: string; label: string }[];
  groupId?: string;
  personId?: string;
  heads?: number;
  offers?: BetOffer[];
}

export interface DirectorView {
  seniorManagers: SeniorManagerView[];
  groups: GroupView[];
  upward: OutsiderView[];
  bets: BetView[];
  habits: DirectorState['habits'];
  moments: DirectorMomentView[];
  goals: { id: string; text: string; progress: string }[];
  player: { energy: number; reputation: number; edge: { at: boolean; quarters: number; limit: number } };
  career: { quarters: number; joined: string[]; letGo: string[] };
}


/** The player's view: senior managers as people, groups as last surveyed, and the room above. */
// @spec DIR-VIS-001, DIR-VIS-002, DIR-VIS-003, DIR-VIS-004, DIR-VIS-006, DIR-VIS-007, DIR-ORG-003
/** A group's mood as the player sees it: as it is now in a quarter the listening tour visited it, else as last surveyed. */
export function seenMood(level: DirectorState, sim: SimState, g: string) {
  const team = sim.teams[g]!.aggregate!;
  const toured = level.visited?.groupId === g && level.visited.quarter === quarterOf(level, sim);
  return { toured, mood: toured ? team : (level.survey.groups[g] ?? team) };
}

/** What the quarterly review presents: the organization's projects and bets on schedule and in trouble, as they stand now. */
// @spec DIR-QBR-001
export function reviewText(level: DirectorState, sim: SimState): string {
  const troubled = new Set([...overdueProjects(sim), ...behindScheduleProjects(sim)].map((p) => p.id));
  const active = Object.values(sim.projects).filter((p) => p.status === 'active' && level.groupIds.includes(p.teamId));
  const inTrouble = active.filter((p) => troubled.has(p.id)).length;
  const onSchedule = active.length - inTrouble;
  return `You present the quarter to your executive: ${onSchedule === 1 ? 'one project' : `${onSchedule} projects`} on schedule and ${inTrouble} in trouble.`;
}

export function directorView(level: DirectorState, sim: SimState): DirectorView {
  const overdue = new Set(overdueProjects(sim).map((p) => p.id));
  const behind = new Set(behindScheduleProjects(sim).map((p) => p.id));
  const schedule = (id: string): Schedule => scheduleOf(id, overdue, behind);
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
      seniorManagers.push({ id: p.id, name: p.name, personality: p.personality ?? null, groupId: g, restless: p.restlessSince !== null, performance: p.performance, motivation: band(p.motivation), stress: band(p.stress), skill: band(p.skill), want: want(p.id), memory: memoryOf(p.history) });
    }
    const { toured, mood } = seenMood(level, sim, g);
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
        .sort(byId)
        .map((p) => ({ id: p.id, name: p.name, progress: p.progress, scope: p.scope, deadlineWeek: p.deadlineWeek, schedule: schedule(p.id) })),
    });
  }
  const upward = [level.executiveId, ...level.peerIds]
    .map((id) => sim.people[id])
    .filter((p) => p?.status === 'active')
    .map((p) => ({ id: p!.id, name: p!.name, personality: p!.personality ?? null, role: p!.role as 'executive' | 'peer', trust: band(p!.trust), want: want(p!.id), memory: memoryOf(p!.history) }));
  const bets = level.bets.flatMap((b): BetView[] => {
    const p = sim.projects[b.projectId];
    return p ? [{ projectId: p.id, name: p.name, groupId: b.groupId, progress: p.progress, scope: p.scope, deadlineWeek: p.deadlineWeek, schedule: schedule(p.id), landing: b.landing, failing: b.failing }] : [];
  });
  // @spec DIR-VIS-005
  const moments: DirectorMomentView[] = level.moments.map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    // The review comes at the quarter's end: what it presents is the quarter as it stands then.
    text: m.kind === 'review' ? reviewText(level, sim) : m.text,
    choices: m.choices,
    ...(m.groupId && { groupId: m.groupId }),
    ...(m.personId && { personId: m.personId }),
    ...(m.heads !== undefined && { heads: m.heads }),
    ...(m.offers && { offers: m.offers }),
  }));
  const named = (ids: string[]) => ids.map((id) => sim.people[id]?.name ?? id);
  return {
    seniorManagers,
    groups,
    upward,
    bets,
    habits: level.habits,
    moments,
    goals: level.goals.map((g) => {
      const { text, progress } = goalStatus(g, level, sim);
      return { id: g.id, text, progress };
    }),
    player: {
      energy: band(100 - sim.player.stress),
      reputation: band(sim.player.reputation),
      edge: { at: sim.player.stress >= LINE_TUNING.burnoutThreshold, quarters: level.burnoutQuarters, limit: T.burnoutQuarters },
    },
    career: { quarters: (sim.week - level.startWeek) / T.weeksPerQuarter, joined: named(level.joined), letGo: named(level.letGo) },
  };
}
