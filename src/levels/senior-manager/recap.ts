import { behindScheduleProjects, overdueProjects, type SimState } from '../../sim';
import { goalStatus } from './goals';
import type { MonthStart, SeniorState } from './types';
import { seniorView } from './view';

const schedules = (level: SeniorState, sim: SimState) => {
  const overdue = new Set(overdueProjects(sim).map((p) => p.id));
  const behind = new Set(behindScheduleProjects(sim).map((p) => p.id));
  return Object.fromEntries(
    Object.values(sim.projects)
      .filter((p) => level.teamIds.includes(p.teamId) && p.status === 'active')
      .map((p) => [p.id, overdue.has(p.id) ? 'overdue' : behind.has(p.id) ? 'behind' : 'onSchedule']),
  );
};

/** What the player can see as a month begins: the managers' and teams' bands as shown, and each project's schedule. */
export function snapshotMonth(level: SeniorState, sim: SimState): MonthStart {
  const view = seniorView(level, sim);
  return {
    week: sim.week,
    managers: Object.fromEntries(view.managers.map((m) => [m.id, { motivation: m.motivation, stress: m.stress, skill: m.skill }])),
    teams: Object.fromEntries(view.teams.map((t) => [t.id, { motivation: t.motivation, stress: t.stress, attritionRisk: t.attritionRisk, headcount: t.headcount }])),
    projects: schedules(level, sim),
  };
}

export interface SeniorRecap {
  changes: {
    managers: { id: string; name: string; changes: string[]; notes: string[] }[];
    teams: { id: string; name: string; changes: string[] }[];
    heads: { teamId: string; name: string; change: number }[];
    slipped: string[];
  };
  routine: { habits: string[]; goals: { text: string; progress: string }[] };
}

const moved = (was: number, now: number, up: string, down: string) => (now > was ? [up] : now < was ? [down] : []);

/** The month's recap: what changed since it began, then the routine. */
// @spec SENIOR-RECAP-001
export function monthRecap(level: SeniorState, sim: SimState, start: MonthStart): SeniorRecap {
  const view = seniorView(level, sim);
  const managers = view.managers.flatMap((m) => {
    const was = start.managers[m.id];
    const changes = was ? [...moved(was.motivation, m.motivation, 'more motivated', 'less motivated'), ...moved(was.stress, m.stress, 'more stressed', 'less stressed'), ...moved(was.skill, m.skill, 'a better manager', 'a weaker manager')] : ['started leading their team'];
    const notes = sim.people[m.id]!.history.filter((h) => h.note && h.week >= start.week).map((h) => h.note!);
    return changes.length || notes.length ? [{ id: m.id, name: m.name, changes, notes }] : [];
  });
  const teams = view.teams.flatMap((t) => {
    const was = start.teams[t.id];
    if (!was) return [{ id: t.id, name: t.name, changes: ['joined your group'] }];
    const changes = [...moved(was.motivation, t.motivation, 'more motivated', 'less motivated'), ...moved(was.stress, t.stress, 'more stressed', 'less stressed'), ...moved(was.attritionRisk, t.attritionRisk, 'more likely to lose people', 'less likely to lose people')];
    return changes.length ? [{ id: t.id, name: t.name, changes }] : [];
  });
  const heads = view.teams.flatMap((t) => {
    const was = start.teams[t.id]?.headcount;
    return was !== undefined && was !== t.headcount ? [{ teamId: t.id, name: t.name, change: t.headcount - was }] : [];
  });
  const now = schedules(level, sim);
  const slipped = Object.entries(now)
    .filter(([id, schedule]) => schedule !== 'onSchedule' && start.projects[id] !== schedule && start.projects[id] !== 'overdue')
    .map(([id, schedule]) => `${sim.projects[id]!.name} is ${schedule === 'overdue' ? 'overdue' : 'behind'}`);
  const h = level.habits;
  const oversight = Object.values(h.oversight);
  const count = (o: string) => oversight.filter((x) => x === o).length;
  const habits = [
    `You coached ${count('coaching')}, kept ${count('close')} close and left ${count('handsOff')} hands-off.`,
    `1:1s with your managers: ${h.oneOnOnes}.`,
    ...(level.listenedTo.length ? [`You held a skip-level with ${level.listenedTo.map((t) => sim.teams[t]!.name).join(', ')}.`] : []),
    ...(level.backfills.length ? [`${level.backfills.length} ${level.backfills.length === 1 ? 'role is' : 'roles are'} waiting to be filled.`] : []),
  ];
  return { changes: { managers, teams, heads, slipped }, routine: { habits, goals: level.goals.map((g) => goalStatus(g, level, sim)).map(({ text, progress }) => ({ text, progress })) } };
}
