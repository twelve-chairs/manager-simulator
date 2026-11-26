import { moved } from '../org';
import type { SimState } from '../../sim';
import { goalStatus, goalViews } from './goals';
import type { VpQuarterStart, VpState } from './types';
import { vpView } from './view';

/** What the player can see as a quarter begins. */
export function snapshotQuarter(level: VpState, sim: SimState): VpQuarterStart {
  const view = vpView(level, sim);
  return {
    week: sim.week,
    directors: Object.fromEntries(view.directors.map((m) => [m.id, { motivation: m.motivation, stress: m.stress, skill: m.skill }])),
    headcount: Object.fromEntries(view.divisions.map((g) => [g.id, g.headcount])),
    trust: Object.fromEntries(view.leadership.map((u) => [u.id, u.trust])),
    surveyQuarter: level.survey.quarter,
  };
}

export interface VpRecap {
  changes: {
    directors: { id: string; name: string; changes: string[]; notes: string[] }[];
    survey: { quarter: number; divisions: { id: string; name: string; motivation: number; stress: number }[] } | null;
    /** Heads who joined or left, apart from cuts. */
    heads: { divisionId: string; name: string; change: number }[];
    cut: number;
    priority: string[];
    leadership: { id: string; name: string; change: string }[];
  };
  routine: { habits: string[]; goals: { text: string; progress: string }[] };
}

const FIRST_TEAM = { function: 'You put your function first.', leadership: 'You put the leadership team first.' } as const;
const DIRECTORS = { stepBack: 'You set direction and gave your directors room.', review: 'You reviewed your directors’ plans closely.' } as const;

/** The quarter's recap: what changed since it began, then the routine. */
// @spec VP-RECAP-001, VP-CUT-005
export function quarterRecap(level: VpState, sim: SimState, start: VpQuarterStart): VpRecap {
  const view = vpView(level, sim, goalViews(level, sim));
  const directors = view.directors.flatMap((m) => {
    const was = start.directors[m.id];
    const changes = was ? [...moved(was.motivation, m.motivation, 'more motivated', 'less motivated'), ...moved(was.stress, m.stress, 'more stressed', 'less stressed'), ...moved(was.skill, m.skill, 'a better leader', 'a weaker leader')] : ['started leading their division'];
    const notes = sim.people[m.id]!.history.filter((h) => h.note && h.week >= start.week).map((h) => h.note!);
    return changes.length || notes.length ? [{ id: m.id, name: m.name, changes, notes }] : [];
  });
  const survey = level.survey.quarter !== start.surveyQuarter ? { quarter: level.survey.quarter, divisions: view.divisions.map((g) => ({ id: g.id, name: g.name, motivation: g.motivation, stress: g.stress })) } : null;
  const cutThisQuarter = level.cutHeads.filter((c) => c.week >= start.week);
  const cut = cutThisQuarter.reduce((n, c) => n + c.count, 0);
  const cutBy = (g: string) => cutThisQuarter.reduce((n, c) => n + (c.divisions[g] ?? 0), 0);
  const heads = view.divisions.flatMap((g) => {
    const was = start.headcount[g.id];
    const change = was === undefined ? 0 : g.headcount - was + cutBy(g.id);
    return change !== 0 ? [{ divisionId: g.id, name: g.name, change }] : [];
  });
  const priority = [
    ...level.priorityResults.filter((r) => r.week >= start.week).map((r) => `${sim.projects[r.projectId]?.name ?? 'The company priority'} ${r.landed ? 'landed' : 'failed'}`),
    ...(view.plan.priority && view.plan.priority.schedule !== 'onSchedule' ? [`${view.plan.priority.name} is ${view.plan.priority.schedule === 'overdue' ? 'overdue' : 'behind'}`] : []),
  ];
  const leadership = view.leadership.flatMap((u) => {
    const was = start.trust[u.id];
    if (was === undefined || was === u.trust) return [];
    return [{ id: u.id, name: u.name, change: u.trust > was ? 'trusts you more' : 'trusts you less' }];
  });
  const habits = [FIRST_TEAM[level.habits.firstTeam], DIRECTORS[level.habits.directors], ...(level.year ? [`${level.year.arrived} of the year's ${level.year.given} new heads have arrived.`] : [])];
  return { changes: { directors, survey, heads, cut, priority, leadership }, routine: { habits, goals: level.goals.map((g) => goalStatus(g, level, sim)).map(({ text, progress }) => ({ text, progress })) } };
}
