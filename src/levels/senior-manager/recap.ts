import { TUNING as SIM_TUNING, behindScheduleProjects, overdueProjects, scheduleOf, type SimState } from '../../sim';
import { leadOf } from './core';
import { SENIOR_TUNING as T } from './tuning';
import { goalStatus } from './goals';
import type { MonthStart, SeniorState } from './types';
import { seniorView } from './view';

const schedules = (level: SeniorState, sim: SimState) => {
  const overdue = new Set(overdueProjects(sim).map((p) => p.id));
  const behind = new Set(behindScheduleProjects(sim).map((p) => p.id));
  return Object.fromEntries(
    Object.values(sim.projects)
      .filter((p) => level.teamIds.includes(p.teamId) && p.status === 'active')
      .map((p) => [p.id, scheduleOf(p.id, overdue, behind)]),
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
    /** New projects the player's manager gave to teams with room. */
    assigned: { teamId: string; name: string; project: string }[];
    /** What came of last month's approvals. */
    followUps: string[];
    /** Projects behind or overdue when the month began that are on schedule again, with their team. */
    recovered: { name: string; team: string }[];
    /** When the standing habits took more energy than a quiet month gives back: the habits' energy line. */
    energy?: string;
  };
  routine: { habits: string[]; goals: { text: string; progress: string }[] };
}

const moved = (was: number, now: number, up: string, down: string): string[] => {
  if (now > was) return [up];
  return now < was ? [down] : [];
};

/** The energy the standing habits take in a month, by habit: oversight, 1:1s and skip-level listening. */
export function habitEnergy(s: SeniorState, sim: SimState): { habit: 'oversight' | 'oneOnOnes' | 'skipLevel'; energy: number }[] {
  const managers = s.teamIds.map((t) => leadOf(s, sim, t)).filter((id): id is string => id !== null);
  const oversight = managers.reduce((n, id) => n + ({ coaching: T.coachingEnergy, close: T.closeEnergy, handsOff: 0 } as const)[s.habits.oversight[id] ?? 'coaching'], 0);
  const oneOnOnes = managers.length * T.oneOnOnesAMonth[s.habits.oneOnOnes] * T.oneOnOneEnergy;
  const skipLevel = s.habits.skipLevel === 'monthly' && s.teamIds.length ? T.skipLevelEnergy : 0;
  return [
    { habit: 'oversight' as const, energy: oversight },
    { habit: 'oneOnOnes' as const, energy: oneOnOnes },
    { habit: 'skipLevel' as const, energy: skipLevel },
  ].filter((x) => x.energy > 0).sort((a, b) => b.energy - a.energy);
}

const HABIT_WORDS = { oversight: 'oversight', oneOnOnes: '1:1s', skipLevel: 'skip-levels' } as const;
const listed = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** What the standing habits took in energy this month, against what a month with no team in trouble gives back. */
function habitEnergyLine(level: SeniorState, sim: SimState): { line: string; over: boolean } | null {
  const costs = habitEnergy(level, sim);
  if (!costs.length) return null;
  const total = costs.reduce((n, c) => n + c.energy, 0);
  const back = SIM_TUNING.playerStressRecoveryPerWeek * T.weeksPerMonth;
  const margin = T.habitEnergyMargin;
  const compare = total > back + margin ? 'more energy than a quiet month gives back' : total < back - margin ? 'less energy than a quiet month gives back' : 'about as much energy as a quiet month gives back';
  const line = `Your standing habits took ${compare}: ${listed(costs.map((c) => HABIT_WORDS[c.habit]))}${costs.length > 1 ? ', the most first' : ''}.`;
  return { line, over: total > back + margin };
}

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
  // @spec SENIOR-RECAP-001
  const recovered = Object.entries(now)
    .filter(([id, schedule]) => schedule === 'onSchedule' && start.projects[id] !== undefined && start.projects[id] !== 'onSchedule')
    .map(([id]) => ({ name: sim.projects[id]!.name, team: sim.teams[sim.projects[id]!.teamId]?.name ?? '' }));
  const h = level.habits;
  const oversight = Object.values(h.oversight);
  const count = (o: string) => oversight.filter((x) => x === o).length;
  // @spec SENIOR-RECAP-006
  const energy = habitEnergyLine(level, sim);
  const habits = [
    `You coached ${count('coaching')}, kept ${count('close')} close and left ${count('handsOff')} hands-off.`,
    ...(energy ? [energy.line] : []),
    `1:1s with your managers: ${h.oneOnOnes}.`,
    ...(level.listenedTo.length ? [`You held a skip-level with ${level.listenedTo.map((t) => sim.teams[t]!.name).join(', ')}.`] : []),
    ...(level.backfills.length ? [`${level.backfills.length} ${level.backfills.length === 1 ? 'role is' : 'roles are'} waiting to be filled.`] : []),
  ];
  const followUps = (level.followUps ?? []).filter((f) => f.week === start.week).map((f) => f.text);
  return { changes: { managers, teams, heads, slipped, assigned: [], followUps, recovered, ...(energy?.over && { energy: energy.line }) }, routine: { habits, goals: level.goals.map((g) => goalStatus(g, level, sim)).map(({ text, progress }) => ({ text, progress })) } };
}
