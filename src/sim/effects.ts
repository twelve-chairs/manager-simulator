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

/** Returns why an effect cannot apply to the state, or undefined when it can. */
function invalidReason(s: SimState, e: Effect): string | undefined {
  if (!validCause(e.cause)) return 'effect has no valid cause';
  const activePerson = (id: string): string | undefined => {
    const p = s.people[id];
    if (!p) return `person ${id} does not exist`;
    if (p.status !== 'active') return `person ${id} is ${p.status}`;
    return undefined;
  };
  const team = (id: string) => (s.teams[id] ? undefined : `team ${id} does not exist`);
  const project = (id: string) => (s.projects[id] ? undefined : `project ${id} does not exist`);

  switch (e.type) {
    case 'value': {
      if (e.historyNote !== undefined && e.target.kind !== 'person') return 'history notes can only target a person';
      if (!Number.isFinite(e.amount)) return 'amount is not a finite number';
      switch (e.target.kind) {
        case 'person':
          return activePerson(e.target.id) ?? (has(PERSON_FIELDS, e.field) ? undefined : `unknown person field ${e.field}`);
        case 'team': {
          const t = s.teams[e.target.id];
          if (!t) return `team ${e.target.id} does not exist`;
          const fields = t.form === 'aggregate' ? AGGREGATE_TEAM_FIELDS : DETAILED_TEAM_FIELDS;
          return has(fields, e.field) ? undefined : `unknown ${t.form} team field ${e.field}`;
        }
        case 'project':
          return project(e.target.id) ?? (has(PROJECT_FIELDS, e.field) ? undefined : `unknown project field ${e.field}`);
        case 'player':
          return has(PLAYER_FIELDS, e.field) ? undefined : `unknown player field ${e.field}`;
      }
      return 'unknown target';
    }
    case 'rate': {
      if (!has(RATINGS, e.rating)) return `unknown rating ${String(e.rating)}`;
      if (e.target.kind === 'player') return e.historyNote !== undefined ? 'history notes can only target a person' : undefined;
      return activePerson(e.target.id);
    }
    case 'reRate': {
      const t = s.teams[e.teamId];
      if (!t) return `team ${e.teamId} does not exist`;
      if (t.form !== 'aggregate' || !t.aggregate) return `team ${e.teamId} is not aggregate`;
      if (!has(PERFORMANCE_LEVELS, e.from)) return `unknown performance level ${String(e.from)}`;
      if (!has(RATINGS, e.to)) return `unknown rating ${String(e.to)}`;
      if (!Number.isInteger(e.count) || e.count < 1) return 'count must be a whole number of at least one';
      if (t.aggregate.ratings[e.from] < e.count) return `team ${e.teamId} has fewer than ${e.count} heads at ${e.from}`;
      return undefined;
    }
    case 'hire':
      return team(e.teamId) ?? (s.people[e.person.id] ? `person ${e.person.id} already exists` : undefined);
    case 'remove':
      return activePerson(e.personId);
    case 'move':
      return activePerson(e.personId) ?? team(e.teamId);
    case 'setLeader': {
      const t = s.teams[e.teamId];
      if (!t) return `team ${e.teamId} does not exist`;
      // A person may replace the player as a team's leader, as when a promoted player hands their team on (SIM-EFFECT-022).
      if (t.leader !== null && !(t.leader.kind === 'player' && e.leader.kind === 'person')) return `team ${e.teamId} already has a leader`;
      if (e.leader.kind === 'person') {
        const reason = activePerson(e.leader.id);
        if (reason) return reason;
        const led = leadsTeam(s, e.leader.id);
        if (led) return `person ${e.leader.id} already leads team ${led.id}`;
      }
      return undefined;
    }
    case 'startProject':
      return team(e.project.teamId) ?? (s.projects[e.project.id] ? `project ${e.project.id} already exists` : undefined);
    case 'reassignProject':
      return project(e.projectId) ?? team(e.teamId);
    case 'cancelProject':
      return project(e.projectId);
  }
}

/** Gives a person or the player a rating, either as a new rating or as a revision of their latest one. */
function rate(ctx: Ctx, e: Extract<Effect, { type: 'rate' }>) {
  const s = ctx.s;
  const holder = e.target.kind === 'player' ? s.player : s.people[e.target.id]!;
  record(ctx, e.cause, e.target, 'performance', holder.performance, e.rating);
  holder.performance = e.rating;

  if (e.target.kind === 'player') {
    const list = s.player.ratingHistory;
    const latest = list.length - 1;
    const entry = { week: e.revision && latest >= 0 ? list[latest]!.week : s.week, cause: e.cause, rating: e.rating };
    const before = e.revision && latest >= 0 ? list[latest] : undefined;
    if (before) list[latest] = entry;
    else list.push(entry);
    record(ctx, e.cause, e.target, 'ratingHistory', before, entry);
    return;
  }
  const history = s.people[e.target.id]!.history;
  let latest = -1;
  for (let i = history.length - 1; i >= 0 && latest < 0; i--) if (history[i]!.rating) latest = i;
  const replacing = e.revision && latest >= 0;
  const entry: HistoryEntry = { week: replacing ? history[latest]!.week : s.week, cause: e.cause, rating: e.rating };
  if (e.historyNote !== undefined) entry.note = e.historyNote;
  const before = replacing ? history[latest] : undefined;
  if (replacing) history[latest] = entry;
  else history.push(entry);
  record(ctx, e.cause, e.target, 'history', before, entry);
}

function apply(ctx: Ctx, e: Effect) {
  const s = ctx.s;
  switch (e.type) {
    case 'value': {
      const t = e.target;
      if (t.kind === 'person') {
        changePerson(ctx, s.people[t.id]!, e.field as (typeof PERSON_FIELDS)[number], e.amount, e.cause, e.wantTags, e.historyNote);
      } else if (t.kind === 'team') {
        const team = s.teams[t.id]!;
        if (team.form === 'aggregate' && e.field === 'headcount') {
          const change = Math.round(e.amount);
          if (change > 0) gainHeads(ctx, team, change, 'unrated', e.cause);
          else if (change < 0) loseHeads(ctx, team, -change, e.cause);
        } else if (team.form === 'aggregate' && e.field === 'attritionRisk') {
          const agg = team.aggregate!;
          const after = clamp100(agg.attritionRisk + e.amount);
          record(ctx, e.cause, t, 'attritionRisk', agg.attritionRisk, after);
          agg.attritionRisk = after;
        } else {
          // Want tags only apply to people, so they are not passed on to a team's members.
          changeTeam(ctx, team, e.field as (typeof DETAILED_TEAM_FIELDS)[number], e.amount, e.cause);
        }
      } else if (t.kind === 'project') {
        const p = s.projects[t.id]!;
        const field = e.field as (typeof PROJECT_FIELDS)[number];
        const before = p[field];
        const raw = Math.round(before + e.amount);
        p[field] = field === 'risk' || field === 'techDebt' ? clamp100(raw) : Math.max(0, raw);
        record(ctx, e.cause, t, field, before, p[field]);
      } else {
        const field = e.field as (typeof PLAYER_FIELDS)[number];
        const before = s.player[field];
        s.player[field] = clamp100(before + e.amount);
        record(ctx, e.cause, t, field, before, s.player[field]);
      }
      return;
    }
    case 'rate':
      return rate(ctx, e);
    case 'reRate': {
      if (e.from === e.to) return;
      const team = s.teams[e.teamId]!;
      const ratings = team.aggregate!.ratings;
      const before = { ...ratings };
      ratings[e.from] -= e.count;
      ratings[e.to] += e.count;
      ctx.log.push({ cause: e.cause, target: { kind: 'team', id: team.id }, field: 'ratings', before, after: { ...ratings } });
      return;
    }
    case 'hire': {
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
      return;
    }
    case 'remove':
      return depart(ctx, s.people[e.personId]!, e.reason, e.cause);
    case 'move': {
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
      return;
    }
    case 'setLeader': {
      const team = s.teams[e.teamId]!;
      record(ctx, e.cause, { kind: 'team', id: team.id }, 'leader', team.leader, e.leader);
      team.leader = { ...e.leader };
      if (e.leader.kind === 'person') {
        const p = s.people[e.leader.id]!;
        record(ctx, e.cause, { kind: 'person', id: p.id }, 'teamId', p.teamId, team.id);
        p.teamId = team.id;
        // @spec SIM-TEAM-008
        if (p.role !== 'manager') {
          record(ctx, e.cause, { kind: 'person', id: p.id }, 'role', p.role, 'manager');
          p.role = 'manager';
        }
      }
      return;
    }
    case 'startProject': {
      s.projects[e.project.id] = { ...e.project, progress: 0, startWeek: s.week, status: 'active' };
      record(ctx, e.cause, { kind: 'project', id: e.project.id }, 'status', undefined, 'active');
      return;
    }
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
// @spec SIM-EFFECT-015, SIM-EFFECT-016, SIM-EFFECT-017, SIM-EFFECT-018, SIM-EFFECT-019, SIM-EFFECT-020, SIM-EFFECT-021
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
