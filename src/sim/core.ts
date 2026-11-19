import type { Cause, ChangeLogEntry, Person, Project, SimState, Team, TeamAggregate, ValueTarget, WantTags } from './types';
import { TUNING } from './tuning';

/** A working copy of the state plus the change log for the operation in progress. */
export interface Ctx {
  s: SimState;
  log: ChangeLogEntry[];
}

export const sortedIds = (record: Record<string, unknown>) => Object.keys(record).sort();

export const clamp100 = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** mulberry32: a small, fast, seedable generator whose whole state is one 32-bit integer. */
export function random(ctx: Ctx): number {
  const a = (ctx.s.rngState + 0x6d2b79f5) >>> 0;
  ctx.s.rngState = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Chance of at least one event over `weeks`, given a weekly chance. */
export const chanceOver = (weekly: number, weeks: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, weekly)), weeks);

export function record(ctx: Ctx, cause: Cause, target: ChangeLogEntry['target'], field: string, before: unknown, after: unknown) {
  if (before !== after) ctx.log.push({ cause, target, field, before, after });
}

/** Active members of a detailed team; a team's leader is not one of its members. */
export function members(s: SimState, teamId: string): Person[] {
  const team = s.teams[teamId];
  const leaderId = team?.leader?.kind === 'person' ? team.leader.id : undefined;
  return sortedIds(s.people)
    .map((id) => s.people[id]!)
    .filter((p) => p.teamId === teamId && p.status === 'active' && p.id !== leaderId);
}

export function attritionRiskOf(motivation: number, stress: number) {
  return clamp100((100 - motivation) / 2 + stress / 4);
}

export function summarize(s: SimState, team: Team): TeamAggregate {
  if (team.form === 'aggregate' && team.aggregate) return { ...team.aggregate };
  const ms = members(s, team.id);
  const mean = (f: (p: Person) => number) => (ms.length ? Math.round(ms.reduce((a, p) => a + f(p), 0) / ms.length) : 0);
  const motivation = mean((p) => p.motivation);
  const stress = mean((p) => p.stress);
  return { headcount: ms.length, skill: mean((p) => p.skill), motivation, stress, attritionRisk: attritionRiskOf(motivation, stress) };
}

export const isOverdue = (s: SimState, p: Project) => p.status === 'active' && s.week > p.deadlineWeek;

export function isBehind(s: SimState, p: Project) {
  if (p.status !== 'active' || isOverdue(s, p)) return false;
  const span = p.deadlineWeek - p.startWeek;
  const timeShare = span > 0 ? (s.week - p.startWeek) / span : 1;
  return p.progress / p.scope < timeShare;
}

/** Number of troubles a team has: one for any overdue or behind-schedule project, one for having no leader. */
export function troubles(s: SimState, team: Team): number {
  const projectTrouble = sortedIds(s.projects).some((id) => {
    const p = s.projects[id]!;
    return p.teamId === team.id && (isOverdue(s, p) || isBehind(s, p));
  });
  return (projectTrouble ? 1 : 0) + (team.leader === null ? 1 : 0);
}

export function leadsTeam(s: SimState, personId: string): Team | undefined {
  return sortedIds(s.teams)
    .map((id) => s.teams[id]!)
    .find((t) => t.leader?.kind === 'person' && t.leader.id === personId);
}

/** Changes a person's value, applying want-tag and trust scaling to motivation, and recording want service and history. */
export function changePerson(
  ctx: Ctx,
  person: Person,
  field: 'skill' | 'motivation' | 'stress' | 'trust',
  amount: number,
  cause: Cause,
  wantTags?: WantTags,
  historyNote?: string,
) {
  const target: ValueTarget = { kind: 'person', id: person.id };
  let delta = amount;
  if (field === 'motivation') {
    if (delta > 0 && wantTags?.serves?.includes(person.want)) delta *= TUNING.wantTagMultiplier;
    if (delta < 0 && wantTags?.against?.includes(person.want)) delta *= TUNING.wantTagMultiplier;
    if (delta > 0 && (cause.kind === 'action' || cause.kind === 'situation')) delta *= 0.5 + person.trust / 200;
  }
  const before = person[field];
  person[field] = clamp100(before + delta);
  record(ctx, cause, target, field, before, person[field]);

  if (wantTags?.serves?.includes(person.want)) {
    const was = person.wantServedWeek;
    person.wantServedWeek = ctx.s.week;
    record(ctx, cause, target, 'wantServedWeek', was, person.wantServedWeek);
  }
  if (historyNote !== undefined) {
    const entry = { week: ctx.s.week, cause, note: historyNote };
    person.history.push(entry);
    record(ctx, cause, target, 'history', undefined, entry);
  }
}

/** Changes a team's skill, motivation or stress: on each active member if detailed, on the summary if aggregate. */
export function changeTeam(ctx: Ctx, team: Team, field: 'skill' | 'motivation' | 'stress', amount: number, cause: Cause, wantTags?: WantTags) {
  if (team.form === 'aggregate' && team.aggregate) {
    const before = team.aggregate[field];
    team.aggregate[field] = clamp100(before + amount);
    record(ctx, cause, { kind: 'team', id: team.id }, field, before, team.aggregate[field]);
    return;
  }
  for (const p of members(ctx.s, team.id)) changePerson(ctx, p, field, amount, cause, wantTags);
}

/** Marks a person departed, leaving any team they lead leaderless. */
export function depart(ctx: Ctx, person: Person, reason: 'quit' | 'fired' | 'transferred', cause: Cause) {
  const target: ValueTarget = { kind: 'person', id: person.id };
  const led = leadsTeam(ctx.s, person.id);
  record(ctx, cause, target, 'status', person.status, 'departed');
  person.status = 'departed';
  person.departure = { week: ctx.s.week, reason };
  if (led) {
    record(ctx, cause, { kind: 'team', id: led.id }, 'leader', led.leader, null);
    led.leader = null;
  }
}
