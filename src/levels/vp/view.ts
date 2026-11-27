import { LINE_TUNING, band } from '../line-manager';
import { leaderOf, memoryOf } from '../org';
import { behindScheduleProjects, byId, overdueProjects, scheduleOf, type Rating, type Schedule, type SimState } from '../../sim';
import { VP_TUNING as T } from './tuning';
import type { VpMoment, VpState } from './types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** What the all-hands tells the function: the company priority's progress and the cuts still to come, as they stand now. */
// @spec VP-HANDS-001
export function allHandsText(s: VpState, sim: SimState): string {
  const pr = s.priority ? sim.projects[s.priority.projectId] : undefined;
  const priority = pr ? ` The company priority, ${pr.name}, is ${Math.round((100 * pr.progress) / pr.scope)}% done.` : '';
  const cuts = s.cut.waves.length ? ` ${plural(s.cut.waves.reduce((a, b) => a + b, 0), 'more head goes', 'more heads go')} in the cuts still to come.` : '';
  return `The whole function gathers for the end of the quarter.${priority}${cuts}`;
}

export interface DirectorCard {
  id: string;
  name: string;
  personality: string | null;
  divisionId: string;
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

export interface DivisionView {
  id: string;
  name: string;
  directorId: string | null;
  headcount: number;
  /** As the last engagement survey measured them. */
  motivation: number;
  stress: number;
  attritionRisk: number;
  /** The quarter of the level the survey was taken in. */
  quarter: number;
  projects: { id: string; name: string; progress: number; scope: number; deadlineWeek: number; schedule: Schedule }[];
}

export interface LeaderView {
  id: string;
  name: string;
  personality: string | null;
  role: 'executive' | 'peer';
  trust: number;
  want: string;
  memory: string[];
}

export interface PlanView {
  /** The year's headcount, once annual planning has set it, and how much of it has arrived. */
  given: number | null;
  arrived: number;
  priority: { projectId: string; name: string; divisionId: string; progress: number; scope: number; deadlineWeek: number; schedule: Schedule; stake: number } | null;
}

export interface VpMomentView {
  id: string;
  kind: VpMoment['kind'];
  title: string;
  text: string;
  choices: { id: string; label: string }[];
  divisionId?: string;
  personId?: string;
  otherId?: string;
  planned?: number;
  heads?: number;
}

export interface VpView {
  directors: DirectorCard[];
  divisions: DivisionView[];
  leadership: LeaderView[];
  plan: PlanView;
  habits: VpState['habits'];
  moments: VpMomentView[];
  goals: { id: string; text: string; progress: string }[];
  player: { energy: number; reputation: number; edge: { at: boolean; quarters: number; limit: number } };
  career: { quarters: number; joined: string[]; letGo: string[] };
}

/** The player's view: directors as people, divisions as last surveyed, the leadership team, and the year's plan. */
// @spec VP-VIS-001, VP-VIS-002, VP-VIS-003, VP-VIS-004, VP-VIS-005, VP-VIS-006, VP-VIS-007, VP-ORG-003
export function vpView(level: VpState, sim: SimState, goals: VpView['goals'] = []): VpView {
  const overdue = new Set(overdueProjects(sim).map((p) => p.id));
  const behind = new Set(behindScheduleProjects(sim).map((p) => p.id));
  const schedule = (id: string): Schedule => scheduleOf(id, overdue, behind);
  const want = (id: string) => (level.learnedWants[id] ? sim.people[id]!.want : 'unknown');
  const directors: DirectorCard[] = [];
  const divisions: DivisionView[] = [];
  for (const g of level.divisionIds) {
    const team = sim.teams[g];
    if (!team?.aggregate) continue;
    const lead = leaderOf(sim, g);
    if (lead) {
      const p = sim.people[lead]!;
      directors.push({ id: p.id, name: p.name, personality: p.personality ?? null, divisionId: g, restless: p.restlessSince !== null, performance: p.performance, motivation: band(p.motivation), stress: band(p.stress), skill: band(p.skill), want: want(p.id), memory: memoryOf(p.history) });
    }
    const mood = level.survey.divisions[g] ?? team.aggregate;
    divisions.push({
      id: g,
      name: team.name,
      directorId: lead,
      headcount: team.aggregate.headcount,
      motivation: band(mood.motivation),
      stress: band(mood.stress),
      attritionRisk: band(mood.attritionRisk),
      quarter: level.survey.quarter,
      projects: Object.values(sim.projects)
        .filter((p) => p.teamId === g && p.status === 'active')
        .sort(byId)
        .map((p) => ({ id: p.id, name: p.name, progress: p.progress, scope: p.scope, deadlineWeek: p.deadlineWeek, schedule: schedule(p.id) })),
    });
  }
  const leadership = [level.ceoId, ...level.peerIds]
    .map((id) => sim.people[id])
    .filter((p) => p?.status === 'active')
    .map((p) => ({ id: p!.id, name: p!.name, personality: p!.personality ?? null, role: p!.role as 'executive' | 'peer', trust: band(p!.trust), want: want(p!.id), memory: memoryOf(p!.history) }));
  const pr = level.priority;
  const project = pr ? sim.projects[pr.projectId] : undefined;
  const priority = pr && project ? { projectId: project.id, name: project.name, divisionId: pr.divisionId, progress: project.progress, scope: project.scope, deadlineWeek: project.deadlineWeek, schedule: schedule(project.id), stake: pr.stake } : null;
  const moments: VpMomentView[] = level.moments.map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    // The all-hands closes the quarter: what it tells the function is the quarter as it stands then.
    text: m.kind === 'allHands' ? allHandsText(level, sim) : m.text,
    choices: m.choices,
    ...(m.divisionId && { divisionId: m.divisionId }),
    ...(m.personId && { personId: m.personId }),
    ...(m.otherId && { otherId: m.otherId }),
    ...(m.planned !== undefined && { planned: m.planned }),
    ...(m.heads !== undefined && { heads: m.heads }),
  }));
  const named = (ids: string[]) => ids.map((id) => sim.people[id]?.name ?? id);
  return {
    directors,
    divisions,
    leadership,
    plan: { given: level.year?.given ?? null, arrived: level.year?.arrived ?? 0, priority },
    habits: level.habits,
    moments,
    goals,
    player: {
      energy: band(100 - sim.player.stress),
      reputation: band(sim.player.reputation),
      edge: { at: sim.player.stress >= LINE_TUNING.burnoutThreshold, quarters: level.burnoutQuarters, limit: T.burnoutQuarters },
    },
    career: { quarters: (sim.week - level.startWeek) / T.weeksPerQuarter, joined: named(level.joined), letGo: named(level.letGo) },
  };
}
