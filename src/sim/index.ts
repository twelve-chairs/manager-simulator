import { isBehind, isOverdue, members, record, sortedIds, summarize, type Ctx } from './core';
import type {
  Cause,
  HistoryEntry,
  OperationResult,
  Person,
  PlayerStanding,
  Project,
  SimState,
  StartingOrganization,
  Team,
  TeamAggregate,
} from './types';

export * from './types';
export { TUNING } from './tuning';
export { applyEffects } from './effects';
export { advance } from './advance';

/** Ids of the advance rules, in the order they apply. Each rule's changes carry its id as the cause. */
export const RULE_ORDER = [
  'rule.projectWork',
  'rule.setbacks',
  'rule.stress',
  'rule.wantDrift',
  'rule.departure',
  'rule.playerStanding',
  'rule.gameTime',
] as const;

const byId = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries([...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((x) => [x.id, x]));

// @spec SIM-STATE-001, SIM-STATE-002, SIM-STATE-003, SIM-STATE-004, SIM-STATE-005, SIM-STATE-006, SIM-TIME-001
export function create(seed: number, org: StartingOrganization): SimState {
  const people: Person[] = org.people.map((p) => ({
    ...p,
    joinedWeek: 0,
    wantServedWeek: 0,
    lowMotivationWeeks: 0,
    highStressWeeks: 0,
    status: 'active',
    history: [],
  }));
  const projects: Project[] = org.projects.map((p) => ({ ...p, progress: 0, startWeek: 0, status: 'active' }));
  return {
    week: 0,
    // Spread nearby seeds apart so seeds 1, 2, 3… start the generator in unrelated places.
    rngState: Math.imul(seed >>> 0, 2654435761) >>> 0,
    player: { ...org.player },
    people: byId(people),
    teams: byId(structuredClone(org.teams)),
    projects: byId(projects),
  };
}

// @spec SIM-TEAM-001, SIM-TEAM-002, SIM-TEAM-004
export function aggregateTeam(state: SimState, teamId: string, cause: Cause): OperationResult {
  const ctx: Ctx = { s: structuredClone(state), log: [] };
  const team = ctx.s.teams[teamId];
  if (!team) throw new Error(`team ${teamId} does not exist`);
  if (team.form === 'aggregate') return { state: ctx.s, log: [] };

  const summary = summarize(ctx.s, team);
  for (const p of members(ctx.s, teamId)) {
    record(ctx, cause, { kind: 'person', id: p.id }, 'status', p.status, 'aggregated');
    p.status = 'aggregated';
  }
  record(ctx, cause, { kind: 'team', id: teamId }, 'form', 'detailed', 'aggregate');
  team.form = 'aggregate';
  team.aggregate = summary;
  return { state: ctx.s, log: ctx.log };
}

// @spec SIM-QUERY-001
export function peopleWhere(state: SimState, predicate: (p: Person) => boolean): Person[] {
  return sortedIds(state.people)
    .map((id) => state.people[id]!)
    .filter(predicate)
    .map((p) => structuredClone(p));
}

export function personHistory(state: SimState, personId: string): HistoryEntry[] {
  return structuredClone(state.people[personId]?.history ?? []);
}

// @spec SIM-QUERY-002
export function teamSummary(state: SimState, teamId: string): TeamAggregate {
  const team = state.teams[teamId];
  if (!team) throw new Error(`team ${teamId} does not exist`);
  return summarize(state, team);
}

const projectList = (state: SimState) => sortedIds(state.projects).map((id) => state.projects[id]!);

// @spec SIM-QUERY-004
export function overdueProjects(state: SimState): Project[] {
  return projectList(state).filter((p) => isOverdue(state, p)).map((p) => ({ ...p }));
}

// @spec SIM-QUERY-005
export function behindScheduleProjects(state: SimState): Project[] {
  return projectList(state).filter((p) => isBehind(state, p)).map((p) => ({ ...p }));
}

export function leaderlessTeams(state: SimState): Team[] {
  return sortedIds(state.teams)
    .map((id) => state.teams[id]!)
    .filter((t) => t.leader === null)
    .map((t) => structuredClone(t));
}

// @spec SIM-QUERY-003
export function playerStanding(state: SimState): PlayerStanding {
  return { reputation: state.player.reputation, stress: state.player.stress };
}
