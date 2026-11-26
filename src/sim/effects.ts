import { changePerson, changeTeam, clamp100, cloneState, depart, gainHeads, leadsTeam, loseHeads, personRatings, planFrom, record, type Ctx } from './core';
import {
  PERFORMANCE_LEVELS,
  RATINGS,
  type ApplyEffectsResult,
  type Cause,
  type Effect,
  type HistoryEntry,
  type Person,
  type SimState,
} from './types';

export const PERSON_FIELDS = ['skill', 'motivation', 'stress', 'trust'] as const;
export const DETAILED_TEAM_FIELDS = ['skill', 'motivation', 'stress'] as const;
export const AGGREGATE_TEAM_FIELDS = ['headcount', 'skill', 'motivation', 'stress', 'attritionRisk'] as const;
export const PROJECT_FIELDS = ['scope', 'progress', 'risk', 'techDebt', 'deadlineWeek'] as const;
export const PLAYER_FIELDS = ['reputation', 'stress'] as const;

const has = <T extends string>(list: readonly T[], x: string): x is T => (list as readonly string[]).includes(x);

function validCause(cause: Cause | undefined): boolean {
  if (!cause || typeof cause !== 'object') return false;
  switch (cause.kind) {
    case 'action':
      return typeof cause.actionId === 'string';
    case 'situation':
      return typeof cause.situationId === 'string' && typeof cause.choiceId === 'string';
    case 'rule':
      return typeof cause.ruleId === 'string';
    default:
      return false;
  }
}

type Of<K extends Effect['type']> = Extract<Effect, { type: K }>;

function activePerson(s: SimState, id: string): string | undefined {
  const p = s.people[id];
  if (!p) return `person ${id} does not exist`;
  if (p.status !== 'active') return `person ${id} is ${p.status}`;
  return undefined;
}
const missingTeam = (s: SimState, id: string) => (s.teams[id] ? undefined : `team ${id} does not exist`);
// @spec SIM-OUT-004
const outside = (s: SimState, id: string) => (s.people[id]?.teamId === null ? `person ${id} is outside the organization` : undefined);
const missingProject = (s: SimState, id: string) => (s.projects[id] ? undefined : `project ${id} does not exist`);

function invalidTeamField(s: SimState, id: string, field: string): string | undefined {
  const t = s.teams[id];
  if (!t) return `team ${id} does not exist`;
  const fields = t.form === 'aggregate' ? AGGREGATE_TEAM_FIELDS : DETAILED_TEAM_FIELDS;
  return has(fields, field) ? undefined : `unknown ${t.form} team field ${field}`;
}

function invalidValue(s: SimState, e: Of<'value'>): string | undefined {
  if (e.historyNote !== undefined && e.target.kind !== 'person') return 'history notes can only target a person';
  if (!Number.isFinite(e.amount)) return 'amount is not a finite number';
  switch (e.target.kind) {
    case 'person':
      return activePerson(s, e.target.id) ?? (has(PERSON_FIELDS, e.field) ? undefined : `unknown person field ${e.field}`);
    case 'team':
      return invalidTeamField(s, e.target.id, e.field);
    case 'project':
      return missingProject(s, e.target.id) ?? (has(PROJECT_FIELDS, e.field) ? undefined : `unknown project field ${e.field}`);
    case 'player':
      return has(PLAYER_FIELDS, e.field) ? undefined : `unknown player field ${e.field}`;
  }
  return 'unknown target';
}

function invalidReRate(s: SimState, e: Of<'reRate'>): string | undefined {
  const t = s.teams[e.teamId];
  if (!t) return `team ${e.teamId} does not exist`;
  if (t.form !== 'aggregate' || !t.aggregate) return `team ${e.teamId} is not aggregate`;
  if (!has(PERFORMANCE_LEVELS, e.from)) return `unknown performance level ${String(e.from)}`;
  if (!has(RATINGS, e.to)) return `unknown rating ${String(e.to)}`;
  if (!Number.isInteger(e.count) || e.count < 1) return 'count must be a whole number of at least one';
  if (t.aggregate.ratings[e.from] < e.count) return `team ${e.teamId} has fewer than ${e.count} heads at ${e.from}`;
  return undefined;
}

function invalidSetLeader(s: SimState, e: Of<'setLeader'>): string | undefined {
  const t = s.teams[e.teamId];
  if (!t) return `team ${e.teamId} does not exist`;
  // A person may replace the player as a team's leader, as when a promoted player hands their team on (SIM-EFFECT-022).
  if (t.leader !== null && !(t.leader.kind === 'player' && e.leader.kind === 'person')) return `team ${e.teamId} already has a leader`;
  if (e.leader.kind !== 'person') return undefined;
  const reason = activePerson(s, e.leader.id) ?? outside(s, e.leader.id);
  if (reason) return reason;
  const led = leadsTeam(s, e.leader.id);
  return led ? `person ${e.leader.id} already leads team ${led.id}` : undefined;
}

/** Returns why an effect cannot apply to the state, or undefined when it can. */
function invalidReason(s: SimState, e: Effect): string | undefined {
  if (!validCause(e.cause)) return 'effect has no valid cause';
  switch (e.type) {
    case 'value':
      return invalidValue(s, e);
    case 'rate':
      if (!has(RATINGS, e.rating)) return `unknown rating ${String(e.rating)}`;
      if (e.target.kind === 'player') return e.historyNote !== undefined ? 'history notes can only target a person' : undefined;
      return activePerson(s, e.target.id);
    case 'reRate':
      return invalidReRate(s, e);
    case 'hire':
      return missingTeam(s, e.teamId) ?? (s.people[e.person.id] ? `person ${e.person.id} already exists` : undefined);
    case 'remove':
      return activePerson(s, e.personId);
    case 'move':
      return activePerson(s, e.personId) ?? outside(s, e.personId) ?? missingTeam(s, e.teamId);
    case 'setLeader':
      return invalidSetLeader(s, e);
    case 'startProject':
      return missingTeam(s, e.project.teamId) ?? (s.projects[e.project.id] ? `project ${e.project.id} already exists` : undefined);
    case 'reassignProject':
      return missingProject(s, e.projectId) ?? missingTeam(s, e.teamId);
    case 'cancelProject':
      return missingProject(s, e.projectId);
  }
}

/** The player's rating history gains the rating, or its latest entry is revised. */
function ratePlayer(ctx: Ctx, e: Of<'rate'>) {
  const list = ctx.s.player.ratingHistory;
  const latest = list.length - 1;
  const entry = { week: e.revision && latest >= 0 ? list[latest]!.week : ctx.s.week, cause: e.cause, rating: e.rating };
  const before = e.revision && latest >= 0 ? list[latest] : undefined;
  if (before) list[latest] = entry;
  else list.push(entry);
  record(ctx, e.cause, e.target, 'ratingHistory', before, entry);
}

/** A person's history gains the rating, or its latest rated entry is revised. */
function ratePerson(ctx: Ctx, e: Of<'rate'>, id: string) {
  const history = ctx.s.people[id]!.history;
  let latest = -1;
  for (let i = history.length - 1; i >= 0 && latest < 0; i--) if (history[i]!.rating) latest = i;
  const replacing = e.revision && latest >= 0;
  const entry: HistoryEntry = { week: replacing ? history[latest]!.week : ctx.s.week, cause: e.cause, rating: e.rating };
  if (e.historyNote !== undefined) entry.note = e.historyNote;
  const before = replacing ? history[latest] : undefined;
  if (replacing) history[latest] = entry;
  else history.push(entry);
  record(ctx, e.cause, e.target, 'history', before, entry);
}

/** Gives a person or the player a rating, either as a new rating or as a revision of their latest one. */
function rate(ctx: Ctx, e: Of<'rate'>) {
  const s = ctx.s;
  const holder = e.target.kind === 'player' ? s.player : s.people[e.target.id]!;
  record(ctx, e.cause, e.target, 'performance', holder.performance, e.rating);
  holder.performance = e.rating;
  if (e.target.kind === 'player') ratePlayer(ctx, e);
  else ratePerson(ctx, e, e.target.id);
}

function applyTeamValue(ctx: Ctx, e: Of<'value'>, id: string) {
  const team = ctx.s.teams[id]!;
  if (team.form === 'aggregate' && e.field === 'headcount') {
    const change = Math.round(e.amount);
    if (change > 0) gainHeads(ctx, team, change, 'unrated', e.cause);
    else if (change < 0) loseHeads(ctx, team, -change, e.cause);
  } else if (team.form === 'aggregate' && e.field === 'attritionRisk') {
    const agg = team.aggregate!;
    const after = clamp100(agg.attritionRisk + e.amount);
    record(ctx, e.cause, e.target, 'attritionRisk', agg.attritionRisk, after);
    agg.attritionRisk = after;
  } else {
    // Want tags only apply to people, so they are not passed on to a team's members.
    changeTeam(ctx, team, e.field as (typeof DETAILED_TEAM_FIELDS)[number], e.amount, e.cause);
  }
}

function applyValue(ctx: Ctx, e: Of<'value'>) {
  const s = ctx.s;
  const t = e.target;
  if (t.kind === 'person') return changePerson(ctx, s.people[t.id]!, e.field as (typeof PERSON_FIELDS)[number], e.amount, e.cause, e.wantTags, e.historyNote);
  if (t.kind === 'team') return applyTeamValue(ctx, e, t.id);
  if (t.kind === 'project') {
    const p = s.projects[t.id]!;
    const field = e.field as (typeof PROJECT_FIELDS)[number];
    const before = p[field];
    const raw = Math.round(before + e.amount);
    p[field] = field === 'risk' || field === 'techDebt' ? clamp100(raw) : Math.max(0, raw);
    record(ctx, e.cause, t, field, before, p[field]);
    return;
  }
  const field = e.field as (typeof PLAYER_FIELDS)[number];
  const before = s.player[field];
  s.player[field] = clamp100(before + e.amount);
  record(ctx, e.cause, t, field, before, s.player[field]);
}

function applyReRate(ctx: Ctx, e: Of<'reRate'>) {
  if (e.from === e.to) return;
  const team = ctx.s.teams[e.teamId]!;
  const ratings = team.aggregate!.ratings;
  const before = { ...ratings };
  ratings[e.from] -= e.count;
  ratings[e.to] += e.count;
  ctx.log.push({ cause: e.cause, target: { kind: 'team', id: team.id }, field: 'ratings', before, after: { ...ratings } });
}

function applyHire(ctx: Ctx, e: Of<'hire'>) {
  const s = ctx.s;
  const team = s.teams[e.teamId]!;
  // A manager hired to lead a leaderless aggregate team joins as a person who leads it (SIM-TEAM-009); anyone else is a head.
  const leads = team.form === 'aggregate' && team.leader === null && e.person.role === 'manager';
  if (team.form === 'aggregate' && !leads) return gainHeads(ctx, team, 1, 'unrated', e.cause);
  const p: Person = {
    ...e.person,
    performance: 'unrated',
    joinedWeek: s.week,
    wantServedWeek: s.week,
    lowMotivationWeeks: 0,
    highStressWeeks: 0,
    restlessSince: null,
    teamId: team.id,
    status: 'active',
    history: [],
  };
  s.people[p.id] = p;
  record(ctx, e.cause, { kind: 'person', id: p.id }, 'status', undefined, 'active');
  // @spec SIM-TEAM-009
  if (leads) {
    record(ctx, e.cause, { kind: 'team', id: team.id }, 'leader', null, { kind: 'person', id: p.id });
    team.leader = { kind: 'person', id: p.id };
  }
}

function applyMove(ctx: Ctx, e: Of<'move'>) {
  const s = ctx.s;
  const p = s.people[e.personId]!;
  const led = leadsTeam(s, p.id);
  if (led) {
    record(ctx, e.cause, { kind: 'team', id: led.id }, 'leader', led.leader, null);
    led.leader = null;
  }
  record(ctx, e.cause, { kind: 'person', id: p.id }, 'teamId', p.teamId, e.teamId);
  p.teamId = e.teamId;
  if (s.teams[e.teamId]!.form === 'aggregate') {
    record(ctx, e.cause, { kind: 'person', id: p.id }, 'status', p.status, 'aggregated');
    p.status = 'aggregated';
    gainHeads(ctx, s.teams[e.teamId]!, 1, p.performance, e.cause);
  }
}

function applySetLeader(ctx: Ctx, e: Of<'setLeader'>) {
  const s = ctx.s;
  const team = s.teams[e.teamId]!;
  record(ctx, e.cause, { kind: 'team', id: team.id }, 'leader', team.leader, e.leader);
  team.leader = { ...e.leader };
  if (e.leader.kind !== 'person') return;
  const p = s.people[e.leader.id]!;
  record(ctx, e.cause, { kind: 'person', id: p.id }, 'teamId', p.teamId, team.id);
  p.teamId = team.id;
  // @spec SIM-TEAM-008
  if (p.role !== 'manager') {
    record(ctx, e.cause, { kind: 'person', id: p.id }, 'role', p.role, 'manager');
    p.role = 'manager';
  }
}

function apply(ctx: Ctx, e: Effect) {
  const s = ctx.s;
  switch (e.type) {
    case 'value':
      return applyValue(ctx, e);
    case 'rate':
      return rate(ctx, e);
    case 'reRate':
      return applyReRate(ctx, e);
    case 'hire':
      return applyHire(ctx, e);
    case 'remove':
      return depart(ctx, s.people[e.personId]!, e.reason, e.cause);
    case 'move':
      return applyMove(ctx, e);
    case 'setLeader':
      return applySetLeader(ctx, e);
    case 'startProject':
      s.projects[e.project.id] = { ...e.project, progress: 0, startWeek: s.week, status: 'active' };
      record(ctx, e.cause, { kind: 'project', id: e.project.id }, 'status', undefined, 'active');
      return;
    case 'reassignProject': {
      const p = s.projects[e.projectId]!;
      record(ctx, e.cause, { kind: 'project', id: p.id }, 'teamId', p.teamId, e.teamId);
      p.teamId = e.teamId;
      return;
    }
    case 'cancelProject': {
      const p = s.projects[e.projectId]!;
      record(ctx, e.cause, { kind: 'project', id: p.id }, 'status', p.status, 'cancelled');
      p.status = 'cancelled';
      return;
    }
  }
}

// @spec SIM-EFFECT-001, SIM-EFFECT-002, SIM-EFFECT-003, SIM-EFFECT-004, SIM-EFFECT-005, SIM-EFFECT-006, SIM-EFFECT-007
// @spec SIM-EFFECT-008, SIM-EFFECT-009, SIM-EFFECT-010, SIM-EFFECT-011, SIM-EFFECT-012, SIM-EFFECT-013, SIM-EFFECT-014
// @spec SIM-EFFECT-015, SIM-EFFECT-016, SIM-EFFECT-017, SIM-EFFECT-018, SIM-EFFECT-019, SIM-EFFECT-020, SIM-EFFECT-021, SIM-EFFECT-025
// @spec SIM-EFFECT-022, SIM-EFFECT-023, SIM-EFFECT-024, SIM-LOG-001, SIM-LOG-004, SIM-TEAM-003, SIM-TEAM-005
// @spec SIM-PERF-002, SIM-PERF-003, SIM-PERF-004, SIM-PERF-005, SIM-PERF-006, SIM-PERF-008, SIM-PERF-009, SIM-PERF-012
// @spec SIM-PERF-013, SIM-PERF-014, SIM-PERF-015, SIM-PERF-016, SIM-PERF-018
export function applyEffects(state: SimState, effects: Effect[]): ApplyEffectsResult {
  const ctx: Ctx = { s: cloneState(state), log: [] };
  // People whose PIP a rate effect in this batch failed, with that effect's cause; removed once the batch is applied.
  const failedPips = new Map<string, Cause>();
  for (const [index, effect] of effects.entries()) {
    const message = invalidReason(ctx.s, effect);
    if (message) return { ok: false, error: { index, effect, message } };
    apply(ctx, effect);
    if (effect.type === 'rate' && effect.target.kind === 'person') {
      const p = ctx.s.people[effect.target.id]!;
      if (planFrom(personRatings(p)) === 'failedPip') failedPips.set(p.id, effect.cause);
      else failedPips.delete(p.id);
    }
  }
  for (const [id, cause] of failedPips) {
    const p = ctx.s.people[id]!;
    if (p.status === 'active') depart(ctx, p, 'fired', cause);
  }
  return { ok: true, state: ctx.s, log: ctx.log };
}
