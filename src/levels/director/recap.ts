import type { SimState } from '../../sim';
import { moved } from '../org';
import { goalStatus } from './goals';
import type { DirectorState, QuarterStart } from './types';
import { directorView } from './view';

/** What the player can see as a quarter begins. */
export function snapshotQuarter(level: DirectorState, sim: SimState): QuarterStart {
  const view = directorView(level, sim);
  return {
    week: sim.week,
    seniorManagers: Object.fromEntries(view.seniorManagers.map((m) => [m.id, { motivation: m.motivation, stress: m.stress, skill: m.skill }])),
    headcount: Object.fromEntries(view.groups.map((g) => [g.id, g.headcount])),
    trust: Object.fromEntries(view.upward.map((u) => [u.id, u.trust])),
    surveyQuarter: level.survey.quarter,
    moved: [],
  };
}

export interface DirectorRecap {
  changes: {
    seniorManagers: { id: string; name: string; changes: string[]; notes: string[] }[];
    survey: { quarter: number; groups: { id: string; name: string; motivation: number; stress: number }[] } | null;
    heads: { groupId: string; name: string; change: number }[];
    /** Heads a split or merge moved between groups, by name. */
    moved: { from: string; to: string; count: number; kind: 'split' | 'merge' }[];
    bets: string[];
    upward: { id: string; name: string; change: string }[];
  };
  routine: { habits: string[]; goals: { text: string; progress: string }[] };
}

const TIME = { organization: 'Your time went to your organization.', balanced: 'Your time was split between your organization and the room above.', upward: 'Your time went to your executive and peers.' } as const;

/** The quarter's recap: what changed since it began, then the routine. */
// @spec DIR-RECAP-001
export function quarterRecap(level: DirectorState, sim: SimState, start: QuarterStart): DirectorRecap {
  const view = directorView(level, sim);
  const seniorManagers = view.seniorManagers.flatMap((m) => {
    const was = start.seniorManagers[m.id];
    const changes = was ? [...moved(was.motivation, m.motivation, 'more motivated', 'less motivated'), ...moved(was.stress, m.stress, 'more stressed', 'less stressed'), ...moved(was.skill, m.skill, 'a better leader', 'a weaker leader')] : ['started leading their group'];
    const notes = sim.people[m.id]!.history.filter((h) => h.note && h.week >= start.week).map((h) => h.note!);
    return changes.length || notes.length ? [{ id: m.id, name: m.name, changes, notes }] : [];
  });
  const survey = level.survey.quarter !== start.surveyQuarter ? { quarter: level.survey.quarter, groups: view.groups.map((g) => ({ id: g.id, name: g.name, motivation: g.motivation, stress: g.stress })) } : null;
  // Heads moved by a split or merge are reported as moved, not as leaving one group and joining another.
  // @spec DIR-RECAP-002
  const moves = start.moved ?? [];
  const net = (g: string) => moves.reduce((n, m) => n + (m.to === g ? m.count : 0) - (m.from === g ? m.count : 0), 0);
  const heads = view.groups.flatMap((g) => {
    const was = start.headcount[g.id];
    const change = was === undefined ? 0 : g.headcount - was - net(g.id);
    return change !== 0 ? [{ groupId: g.id, name: g.name, change }] : [];
  });
  const reorganized = moves.map((m) => ({ from: m.fromName, to: m.toName, count: m.count, kind: m.kind }));
  const bets = [
    ...level.betResults.filter((r) => r.week >= start.week).map((r) => `${sim.projects[r.projectId]?.name ?? 'A bet'} ${r.landed ? 'landed' : 'failed'}`),
    ...view.bets.filter((b) => b.schedule !== 'onSchedule').map((b) => `${b.name} is ${b.schedule === 'overdue' ? 'overdue' : 'behind'}`),
  ];
  const upward = view.upward.flatMap((u) => {
    const was = start.trust[u.id];
    if (was === undefined || was === u.trust) return [];
    return [{ id: u.id, name: u.name, change: u.trust > was ? 'trusts you more' : 'trusts you less' }];
  });
  const h = level.habits;
  const habits = [
    TIME[h.time],
    `Staff meetings: ${h.staffMeeting}.`,
    ...(level.visited ? [`Your listening tour visited ${sim.teams[level.visited.groupId]?.name ?? 'a group'}.`] : []),
  ];
  return { changes: { seniorManagers, survey, heads, moved: reorganized, bets, upward }, routine: { habits, goals: level.goals.map((g) => goalStatus(g, level, sim)).map(({ text, progress }) => ({ text, progress })) } };
}

