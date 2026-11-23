import { band } from '../line-manager';
import { behindScheduleProjects, overdueProjects, type HistoryEntry, type Rating, type SimState } from '../../sim';
import { leadOf } from './core';
import { goalStatus } from './goals';
import { SENIOR_TUNING } from './tuning';
import type { SeniorState } from './types';

export interface ManagerView {
  id: string;
  name: string;
  personality: string | null;
  teamId: string;
  performance: Rating | 'unrated';
  motivation: number;
  stress: number;
  /** Management skill, as a band. */
  skill: number;
  want: string;
  memory: string[];
}

export interface TeamView {
  id: string;
  name: string;
  managerId: string | null;
  headcount: number;
  motivation: number;
  stress: number;
  attritionRisk: number;
  /** Whether these bands are what the player saw for themselves, rather than what the manager reported. */
  truth: boolean;
  projects: { id: string; name: string; progress: number; scope: number; deadlineWeek: number; schedule: 'onSchedule' | 'behind' | 'overdue' }[];
}

export interface SeniorView {
  managers: ManagerView[];
  teams: TeamView[];
  goals: { id: string; text: string; progress: string }[];
}

/** What a manager remembers: their latest notes, newest first. */
const memoryOf = (history: HistoryEntry[]) =>
  history
    .filter((h) => h.note)
    .map((h) => h.note!)
    .reverse()
    .slice(0, 3);

const better = { up: (b: number) => Math.min(4, b + 1), down: (b: number) => Math.max(0, b - 1) };

/** The player's view: managers as people, teams as their managers report them unless the player has seen for themselves. */
// @spec SENIOR-VIS-001, SENIOR-VIS-002, SENIOR-VIS-003, SENIOR-VIS-004, SENIOR-VIS-005, SENIOR-VIS-006, SENIOR-ORG-002
export function seniorView(level: SeniorState, sim: SimState): SeniorView {
  const overdue = new Set(overdueProjects(sim).map((p) => p.id));
  const behind = new Set(behindScheduleProjects(sim).map((p) => p.id));
  const managers: ManagerView[] = [];
  const teams: TeamView[] = [];
  for (const teamId of level.teamIds) {
    const team = sim.teams[teamId]!;
    const a = team.aggregate!;
    const m = leadOf(level, sim, teamId);
    const person = m ? sim.people[m]! : null;
    if (person) {
      managers.push({
        id: person.id,
        name: person.name,
        personality: person.personality ?? null,
        teamId,
        performance: person.performance,
        motivation: band(person.motivation),
        stress: band(person.stress),
        skill: band(person.skill),
        want: level.learnedWants[person.id] ? person.want : 'unknown',
        memory: memoryOf(person.history),
      });
    }
    const truth = (m !== null && level.habits.oversight[m] === 'close') || level.listenedTo.includes(teamId);
    // A struggling or distrustful manager tells the player their team is doing a little better than it is.
    const rosy = !truth && person !== null && (band(person.skill) < 2 || person.trust < SENIOR_TUNING.candidTrust);
    teams.push({
      id: teamId,
      name: team.name,
      managerId: m,
      headcount: a.headcount,
      motivation: rosy ? better.up(band(a.motivation)) : band(a.motivation),
      stress: rosy ? better.down(band(a.stress)) : band(a.stress),
      attritionRisk: rosy ? better.down(band(a.attritionRisk)) : band(a.attritionRisk),
      truth,
      projects: Object.values(sim.projects)
        .filter((p) => p.teamId === teamId && p.status === 'active')
        .sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
        .map((p) => ({ id: p.id, name: p.name, progress: p.progress, scope: p.scope, deadlineWeek: p.deadlineWeek, schedule: overdue.has(p.id) ? 'overdue' : behind.has(p.id) ? 'behind' : 'onSchedule' })),
    });
  }
  // @spec SENIOR-GOAL-002
  const goals = level.goals.map((g) => ({ id: g.id, ...goalStatus(g, level, sim) })).map(({ id, text, progress }) => ({ id, text, progress }));
  return { managers, teams, goals };
}
