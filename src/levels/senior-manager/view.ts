import { LINE_TUNING, band } from '../line-manager';
import { behindScheduleProjects, byId, overdueProjects, scheduleOf, type HistoryEntry, type Person, type Rating, type SimState } from '../../sim';
import { leadOf } from './core';
import { goalStatus } from './goals';
import { SENIOR_TUNING } from './tuning';
import type { CalibrationEntry, SeniorMoment, SeniorState } from './types';

export interface ManagerView {
  id: string;
  name: string;
  personality: string | null;
  teamId: string;
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

export interface MomentView {
  id: string;
  kind: SeniorMoment['kind'];
  title: string;
  text: string;
  teamId?: string;
  choices: { id: string; label: string }[];
  /** The managers whose skill the choices depend on. */
  managerIds: string[];
  calibration?: CalibrationEntry[];
  curve?: number;
  overCurve?: { held: number; room: number };
}

export interface SeniorView {
  managers: ManagerView[];
  teams: TeamView[];
  goals: { id: string; text: string; progress: string }[];
  habits: SeniorState['habits'];
  moments: MomentView[];
  player: { energy: number; reputation: number; edge: { at: boolean; months: number; limit: number } };
  career: { months: number; joined: string[]; letGo: string[] };
}

/** What a manager remembers: their latest notes, newest first. */
const memoryOf = (history: HistoryEntry[]) =>
  history
    .filter((h) => h.note)
    .map((h) => h.note!)
    .reverse()
    .slice(0, 3);

const better = { up: (b: number) => Math.min(4, b + 1), down: (b: number) => Math.max(0, b - 1) };

/** A manager as the player knows them: bands, and their want only once the player has learned it. */
function managerView(level: SeniorState, person: Person, teamId: string): ManagerView {
  return {
    id: person.id,
    name: person.name,
    personality: person.personality ?? null,
    teamId,
    restless: person.restlessSince !== null,
    performance: person.performance,
    motivation: band(person.motivation),
    stress: band(person.stress),
    skill: band(person.skill),
    want: level.learnedWants[person.id] ? person.want : 'unknown',
    memory: memoryOf(person.history),
  };
}

/** A team's active projects in id order, each with its schedule. */
function projectsView(sim: SimState, teamId: string, overdue: ReadonlySet<string>, behind: ReadonlySet<string>): TeamView['projects'] {
  return Object.values(sim.projects)
    .filter((p) => p.teamId === teamId && p.status === 'active')
    .sort(byId)
    .map((p) => ({ id: p.id, name: p.name, progress: p.progress, scope: p.scope, deadlineWeek: p.deadlineWeek, schedule: scheduleOf(p.id, overdue, behind) }));
}

/** The player's view: managers as people, teams as their managers report them unless the player has seen for themselves. */
// @spec SENIOR-VIS-001, SENIOR-VIS-002, SENIOR-VIS-003, SENIOR-VIS-004, SENIOR-VIS-005, SENIOR-VIS-006, SENIOR-VIS-008, SENIOR-ORG-002
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
    if (person) managers.push(managerView(level, person, teamId));
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
      projects: projectsView(sim, teamId, overdue, behind),
    });
  }
  // @spec SENIOR-GOAL-002
  const goals = level.goals.map((g) => ({ id: g.id, ...goalStatus(g, level, sim) })).map(({ id, text, progress }) => ({ id, text, progress }));
  // @spec SENIOR-VIS-007
  const leads = (t?: string): string[] => {
    const id = t ? leadOf(level, sim, t) : null;
    return id ? [id] : [];
  };
  /** The managers a moment is about: a calibration's, nobody for a restructuring, or the leads of the teams it names. */
  const managersOf = (m: SeniorMoment): string[] => {
    if (m.kind === 'calibration') return m.calibration!.flatMap((c) => c.managerId ?? []);
    return m.kind === 'restructuring' ? [] : [...leads(m.teamId), ...leads(m.otherTeamId)];
  };
  const moments: MomentView[] = level.moments.map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    text: m.text,
    ...(m.teamId && { teamId: m.teamId }),
    choices: m.choices,
    managerIds: managersOf(m),
    ...(m.calibration && { calibration: m.calibration }),
    ...(m.curve !== undefined && { curve: m.curve }),
    ...(m.overCurve && { overCurve: m.overCurve }),
  }));
  const named = (ids: string[]) => ids.map((id) => sim.people[id]?.name ?? id);
  return {
    managers,
    teams,
    goals,
    habits: level.habits,
    moments,
    player: {
      energy: band(100 - sim.player.stress),
      reputation: band(sim.player.reputation),
      edge: { at: sim.player.stress >= LINE_TUNING.burnoutThreshold, months: level.burnoutMonths, limit: LINE_TUNING.burnoutWeeks },
    },
    career: { months: (sim.week - level.startWeek) / SENIOR_TUNING.weeksPerMonth, joined: named(level.joinedManagers), letGo: named(level.letGoManagers) },
  };
}
