import {
  attritionRiskOf,
  byId,
  clamp100,
  emptyRatings,
  gainHeads,
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
  NewPerson,
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
  PerformanceLevel,
  Want,
} from './types';

export * from './types';
export { TUNING } from './tuning';
export { attritionRiskOf, byId, compareCodeUnits, nextRandom, scheduleOf, type Schedule } from './core';
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

const keyedById = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries([...items].sort(byId).map((x) => [x.id, x]));

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
    restlessSince: null,
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
    people: keyedById(people),
    teams: keyedById(teams),
    projects: keyedById(projects),
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

/** A team to add to a running simulation: always in aggregate form. */
export interface NewAggregateTeam {
  id: string;
  name: string;
  aggregate: { headcount: number; skill: number; motivation: number; stress: number; ratings?: Record<PerformanceLevel, number> };
}

export type AddTeamResult = ({ ok: true } & OperationResult) | { ok: false; error: string };

/** Adds an aggregate team, and optionally a new manager to lead it, as a higher level does when it takes over a run. */
// @spec SIM-TEAM-006, SIM-TEAM-007
export function addTeam(state: SimState, input: { team: NewAggregateTeam; manager?: NewPerson }, cause: Cause): AddTeamResult {
  const { team, manager } = input;
  const a = team.aggregate;
  if (state.teams[team.id]) return { ok: false, error: `team ${team.id} already exists` };
  if (manager && state.people[manager.id]) return { ok: false, error: `person ${manager.id} already exists` };
  if (!Number.isInteger(a.headcount) || a.headcount < 0) return { ok: false, error: `team ${team.id} needs a whole headcount of at least 0` };
  for (const field of ['skill', 'motivation', 'stress'] as const) {
    if (!(a[field] >= 0 && a[field] <= 100)) return { ok: false, error: `team ${team.id}: ${field} must be from 0 to 100` };
  }
  const ratings = a.ratings ? { ...a.ratings } : { ...emptyRatings(), unrated: a.headcount };
  if (PERFORMANCE_LEVELS.reduce((n, l) => n + ratings[l], 0) !== a.headcount) return { ok: false, error: `team ${team.id}: rating counts must sum to its headcount` };

  const ctx: Ctx = { s: structuredClone(state), log: [] };
  ctx.s.teams[team.id] = {
    id: team.id,
    name: team.name,
    leader: manager ? { kind: 'person', id: manager.id } : null,
    form: 'aggregate',
    aggregate: { headcount: a.headcount, skill: a.skill, motivation: a.motivation, stress: a.stress, attritionRisk: attritionRiskOf(a.motivation, a.stress), ratings },
  };
  record(ctx, cause, { kind: 'team', id: team.id }, 'form', undefined, 'aggregate');
  if (manager) {
    ctx.s.people[manager.id] = {
      ...manager,
      role: 'manager',
      teamId: team.id,
      performance: 'unrated',
      joinedWeek: ctx.s.week,
      wantServedWeek: ctx.s.week,
      lowMotivationWeeks: 0,
      highStressWeeks: 0,
      restlessSince: null,
      status: 'active',
      history: [],
    };
    record(ctx, cause, { kind: 'person', id: manager.id }, 'status', undefined, 'active');
    record(ctx, cause, { kind: 'team', id: team.id }, 'leader', null, { kind: 'person', id: manager.id });
  }
  return { ok: true, state: ctx.s, log: ctx.log };
}

/** A person to add outside the organization: the player's own manager or a peer. */
export interface NewOutsider {
  id: string;
  name: string;
  role: 'executive' | 'peer';
  personality?: string;
  want: Want;
  trust: number;
  motivation: number;
  stress: number;
}

export type OperationOutcome = ({ ok: true } & OperationResult) | { ok: false; error: string };

/** Adds a person who belongs to no team: the player's boss or a peer, whom situations can bind. */
// @spec SIM-OUT-001, SIM-OUT-002
export function addOutsider(state: SimState, person: NewOutsider, cause: Cause): OperationOutcome {
  if (state.people[person.id]) return { ok: false, error: `person ${person.id} already exists` };
  if (person.role !== 'executive' && person.role !== 'peer') return { ok: false, error: `a person outside the organization is an executive or a peer, not ${String(person.role)}` };
  for (const field of ['trust', 'motivation', 'stress'] as const) {
    if (!(person[field] >= 0 && person[field] <= 100)) return { ok: false, error: `person ${person.id}: ${field} must be from 0 to 100` };
  }
  const ctx: Ctx = { s: structuredClone(state), log: [] };
  ctx.s.people[person.id] = {
    id: person.id,
    name: person.name,
    role: person.role,
    skill: 50,
    motivation: person.motivation,
    stress: person.stress,
    trust: person.trust,
    want: person.want,
    ...(person.personality !== undefined && { personality: person.personality }),
    performance: 'unrated',
    joinedWeek: ctx.s.week,
    wantServedWeek: ctx.s.week,
    lowMotivationWeeks: 0,
    highStressWeeks: 0,
    restlessSince: null,
    teamId: null,
    status: 'active',
    history: [],
  };
  record(ctx, cause, { kind: 'person', id: person.id }, 'status', undefined, 'active');
  return { ok: true, state: ctx.s, log: ctx.log };
}

/** Moves heads at one performance level between aggregate teams: a reorganization, not attrition. */
// @spec SIM-TEAM-010, SIM-TEAM-011, SIM-TEAM-014
export function moveHeads(state: SimState, move: { from: string; to: string; level: PerformanceLevel; count: number }, cause: Cause): OperationOutcome {
  const { from, to, level, count } = move;
  const giver = state.teams[from];
  const receiver = state.teams[to];
  if (!giver) return { ok: false, error: `team ${from} does not exist` };
  if (!receiver) return { ok: false, error: `team ${to} does not exist` };
  if (!giver.aggregate || giver.form !== 'aggregate') return { ok: false, error: `team ${from} is not aggregate` };
  if (!receiver.aggregate || receiver.form !== 'aggregate') return { ok: false, error: `team ${to} is not aggregate` };
  if (from === to) return { ok: false, error: 'heads must move to another team' };
  if (!PERFORMANCE_LEVELS.includes(level)) return { ok: false, error: `unknown performance level ${String(level)}` };
  if (!Number.isInteger(count) || count < 1) return { ok: false, error: 'count must be a whole number of at least one' };
  if (giver.aggregate.ratings[level] < count) return { ok: false, error: `team ${from} has fewer than ${count} heads at ${level}` };

  const ctx: Ctx = { s: structuredClone(state), log: [] };
  const g = ctx.s.teams[from]!.aggregate!;
  const r = ctx.s.teams[to]!.aggregate!;
  const total = r.headcount + count;
  for (const field of ['skill', 'motivation', 'stress'] as const) {
    const after = clamp100((r[field] * r.headcount + g[field] * count) / total);
    record(ctx, cause, { kind: 'team', id: to }, field, r[field], after);
    r[field] = after;
  }
  const risk = attritionRiskOf(r.motivation, r.stress);
  record(ctx, cause, { kind: 'team', id: to }, 'attritionRisk', r.attritionRisk, risk);
  r.attritionRisk = risk;
  const gBefore = { ...g.ratings };
  record(ctx, cause, { kind: 'team', id: from }, 'headcount', g.headcount, g.headcount - count);
  g.headcount -= count;
  g.ratings[level] -= count;
  ctx.log.push({ cause, target: { kind: 'team', id: from }, field: 'ratings', before: gBefore, after: { ...g.ratings } });
  gainHeads(ctx, ctx.s.teams[to]!, count, level, cause);
  return { ok: true, state: ctx.s, log: ctx.log };
}

/** Closes an aggregate team with no heads, no leader and no active project. Its finished projects keep its id. */
// @spec SIM-TEAM-012, SIM-TEAM-013, SIM-TEAM-014
export function closeTeam(state: SimState, teamId: string, cause: Cause): OperationOutcome {
  const team = state.teams[teamId];
  if (!team) return { ok: false, error: `team ${teamId} does not exist` };
  if (team.form !== 'aggregate' || !team.aggregate) return { ok: false, error: `team ${teamId} is not aggregate` };
  if (team.aggregate.headcount > 0) return { ok: false, error: `team ${teamId} still has ${team.aggregate.headcount} heads` };
  if (team.leader !== null) return { ok: false, error: `team ${teamId} still has a leader` };
  if (Object.values(state.projects).some((p) => p.teamId === teamId && p.status === 'active')) return { ok: false, error: `team ${teamId} still has an active project` };
  const ctx: Ctx = { s: structuredClone(state), log: [] };
  delete ctx.s.teams[teamId];
  record(ctx, cause, { kind: 'team', id: teamId }, 'form', 'aggregate', undefined);
  return { ok: true, state: ctx.s, log: ctx.log };
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
