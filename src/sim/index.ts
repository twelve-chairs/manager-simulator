import {
  clamp100,
  emptyRatings,
  isBehind,
  isOverdue,
  members,
  outputFactor,
  personRatings,
  planFrom,
  record,
  sortedIds,
  summarize,
  type Ctx,
} from './core';
import { TUNING } from './tuning';
import { PERFORMANCE_LEVELS, RATINGS } from './types';
import type {
  Cause,
  HistoryEntry,
  OperationResult,
  Person,
  Plan,
  PlayerStanding,
  Project,
  Rating,
  SimState,
  StartingOrganization,
  Team,
  TeamAggregate,
} from './types';

export * from './types';
export { TUNING } from './tuning';
export { compareCodeUnits, nextRandom } from './core';
export {
  applyEffects,
  AGGREGATE_TEAM_FIELDS,
  DETAILED_TEAM_FIELDS,
  PERSON_FIELDS,
  PLAYER_FIELDS,
  PROJECT_FIELDS,
} from './effects';
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

/** The rule recorded as the cause of the ratings a simulation starts with. */
export const STARTING_ORGANIZATION_RULE = 'rule.startingOrganization';
const STARTING_ORGANIZATION: Cause = { kind: 'rule', ruleId: STARTING_ORGANIZATION_RULE };

// @spec SIM-STATE-001, SIM-STATE-002, SIM-STATE-003, SIM-STATE-004, SIM-STATE-005, SIM-STATE-006, SIM-STATE-008, SIM-TIME-001
// @spec SIM-PERF-001, SIM-PERF-020
export function create(seed: number, org: StartingOrganization): SimState {
  const people: Person[] = org.people.map(({ performance, ...p }) => ({
    ...p,
    performance: performance ?? 'unrated',
    joinedWeek: 0,
    wantServedWeek: 0,
    lowMotivationWeeks: 0,
    highStressWeeks: 0,
    status: 'active',
    history: performance ? [{ week: 0, cause: STARTING_ORGANIZATION, rating: performance }] : [],
  }));
  const teams: Team[] = org.teams.map(({ aggregate, ...t }) => {
    if (!aggregate) return structuredClone(t);
    const ratings = aggregate.ratings ? { ...aggregate.ratings } : { ...emptyRatings(), unrated: aggregate.headcount };
    const total = PERFORMANCE_LEVELS.reduce((a, l) => a + ratings[l], 0);
    if (total !== aggregate.headcount) throw new Error(`team ${t.id}: rating counts sum to ${total}, not its headcount ${aggregate.headcount}`);
    return { ...structuredClone(t), aggregate: { ...aggregate, ratings } };
  });
  const projects: Project[] = org.projects.map((p) => ({ ...p, progress: 0, startWeek: 0, status: 'active' }));
  const { performance, ...standing } = org.player;
  return {
    week: 0,
    // Spread nearby seeds apart so seeds 1, 2, 3… start the generator in unrelated places.
    rngState: Math.imul(seed >>> 0, 2654435761) >>> 0,
    player: {
      ...standing,
      performance: performance ?? 'unrated',
      ratingHistory: performance ? [{ week: 0, cause: STARTING_ORGANIZATION, rating: performance }] : [],
    },
    people: byId(people),
    teams: byId(teams),
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

// @spec SIM-QUERY-002, SIM-PERF-017
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
export function playerStanding(state: SimState): Pick<PlayerStanding, 'reputation' | 'stress' | 'performance'> {
  return { reputation: state.player.reputation, stress: state.player.stress, performance: state.player.performance };
}

// @spec SIM-PERF-007, SIM-PERF-009, SIM-PERF-019
export function planOf(state: SimState, who: { kind: 'person'; id: string } | { kind: 'player' }): Plan {
  if (who.kind === 'player') return planFrom(state.player.ratingHistory.map((r) => r.rating));
  const p = state.people[who.id];
  if (!p) throw new Error(`person ${who.id} does not exist`);
  return p.status === 'active' ? planFrom(personRatings(p)) : 'none';
}

const activePerson = (state: SimState, personId: string) => {
  const p = state.people[personId];
  if (!p) throw new Error(`person ${personId} does not exist`);
  return p.status === 'active' ? p : null;
};

/** 50 is what an average engineer delivers unstressed. */
// @spec SIM-PERF-010
export function contribution(state: SimState, personId: string): number | null {
  const p = activePerson(state, personId);
  return p ? clamp100(50 * outputFactor(p.skill, p.motivation, p.stress)) : null;
}

// @spec SIM-PERF-011
export function correspondingRating(state: SimState, personId: string): Rating | null {
  const c = contribution(state, personId);
  if (c === null) return null;
  const bands = TUNING.contributionBands;
  return [...RATINGS].reverse().find((r) => r === 'below' || c >= bands[r]) ?? 'below';
}
