import { changePerson, changeTeam, clamp100, depart, leadsTeam, record, type Ctx } from './core';
import type { ApplyEffectsResult, Cause, Effect, Person, SimState } from './types';

const PERSON_FIELDS = ['skill', 'motivation', 'stress', 'trust'] as const;
const DETAILED_TEAM_FIELDS = ['skill', 'motivation', 'stress'] as const;
const AGGREGATE_TEAM_FIELDS = ['headcount', 'skill', 'motivation', 'stress', 'attritionRisk'] as const;
const PROJECT_FIELDS = ['scope', 'progress', 'risk', 'techDebt', 'deadlineWeek'] as const;
const PLAYER_FIELDS = ['reputation', 'stress'] as const;

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
    case 'hire':
      return team(e.teamId) ?? (s.people[e.person.id] ? `person ${e.person.id} already exists` : undefined);
    case 'remove':
      return activePerson(e.personId);
    case 'move':
      return activePerson(e.personId) ?? team(e.teamId);
    case 'setLeader': {
      const t = s.teams[e.teamId];
      if (!t) return `team ${e.teamId} does not exist`;
      if (t.leader !== null) return `team ${e.teamId} already has a leader`;
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

function raiseHeadcount(ctx: Ctx, teamId: string, cause: Cause) {
  const agg = ctx.s.teams[teamId]!.aggregate!;
  record(ctx, cause, { kind: 'team', id: teamId }, 'headcount', agg.headcount, agg.headcount + 1);
  agg.headcount += 1;
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
          const agg = team.aggregate!;
          const after = Math.max(0, Math.round(agg.headcount + e.amount));
          record(ctx, e.cause, t, 'headcount', agg.headcount, after);
          agg.headcount = after;
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
    case 'hire': {
      const team = s.teams[e.teamId]!;
      if (team.form === 'aggregate') return raiseHeadcount(ctx, team.id, e.cause);
      const p: Person = {
        ...e.person,
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
        raiseHeadcount(ctx, e.teamId, e.cause);
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
export function applyEffects(state: SimState, effects: Effect[]): ApplyEffectsResult {
  const ctx: Ctx = { s: structuredClone(state), log: [] };
  for (const [index, effect] of effects.entries()) {
    const message = invalidReason(ctx.s, effect);
    if (message) return { ok: false, error: { index, effect, message } };
    apply(ctx, effect);
  }
  return { ok: true, state: ctx.s, log: ctx.log };
}
