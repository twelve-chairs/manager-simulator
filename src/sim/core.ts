import {
  PERFORMANCE_LEVELS,
  type Cause,
  type ChangeLogEntry,
  type HistoryEntry,
  type PerformanceLevel,
  type Person,
  type Plan,
  type Project,
  type Rating,
  type SimState,
  type Team,
  type TeamAggregate,
  type ValueTarget,
  type WantTags,
} from './types';
import { TUNING } from './tuning';

/** A working copy of the state plus the change log for the operation in progress. */
export interface Ctx {
  s: SimState;
  log: ChangeLogEntry[];
}

/**
 * Orders strings by their UTF-16 code units: the same order on every machine and in every locale. Ids are sorted this
 * way wherever order matters, because a locale-aware comparison could order them differently for different players and
 * so break the rule that a run is reproducible from its seed.
 */
export const compareCodeUnits = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const sortedIds = (record: Record<string, unknown>) => Object.keys(record).sort(compareCodeUnits);

const copyEach = <T>(record: Record<string, T>, copy: (x: T) => T): Record<string, T> =>
  Object.fromEntries(Object.entries(record).map(([id, x]) => [id, copy(x)]));

/**
 * A copy of the state for one operation to change. History and rating entries are only ever appended or replaced
 * whole, never edited, so the lists are copied and their entries shared; everything else is copied in full. Deep-copying
 * every entry on every operation was most of a long run's time.
 */
// @spec SIM-STATE-002
export function cloneState(s: SimState): SimState {
  return {
    week: s.week,
    rngState: s.rngState,
    player: { ...s.player, ratingHistory: [...s.player.ratingHistory] },
    people: copyEach(s.people, (p) => ({ ...p, history: [...p.history], ...(p.departure && { departure: { ...p.departure } }) })),
    teams: structuredClone(s.teams),
    projects: copyEach(s.projects, (p) => ({ ...p })),
  };
}

export const clamp100 = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/** mulberry32: a small, fast, seedable generator whose whole state is one 32-bit integer, advanced in place. */
export function nextRandom(holder: { rngState: number }): number {
  const a = (holder.rngState + 0x6d2b79f5) >>> 0;
  holder.rngState = a;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const random = (ctx: Ctx): number => nextRandom(ctx.s);

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
  const ratings = emptyRatings();
  for (const p of ms) ratings[p.performance] += 1;
  return { headcount: ms.length, skill: mean((p) => p.skill), motivation, stress, attritionRisk: attritionRiskOf(motivation, stress), ratings };
}

export const emptyRatings = (): Record<PerformanceLevel, number> =>
  Object.fromEntries(PERFORMANCE_LEVELS.map((l) => [l, 0])) as Record<PerformanceLevel, number>;

/** Output factor shared by project work and contribution: 1 for an average, unstressed engineer. */
export const outputFactor = (skill: number, motivation: number, stress: number) =>
  (skill / 50) * (0.5 + motivation / 100) * (1 - stress / 200);

/**
 * Removes `n` heads from an aggregate team, each from a performance level drawn at random,
 * weighted by its count and by how likely people at that level are to leave.
 */
export function loseHeads(ctx: Ctx, team: Team, n: number, cause: Cause) {
  const agg = team.aggregate!;
  const headcountBefore = agg.headcount;
  const ratingsBefore = { ...agg.ratings };
  for (let i = 0; i < n && agg.headcount > 0; i++) {
    const weights = PERFORMANCE_LEVELS.map((l) => agg.ratings[l] * TUNING.lossWeightByLevel[l]);
    let pick = random(ctx) * weights.reduce((a, b) => a + b, 0);
    let level: PerformanceLevel = 'unrated';
    for (const [j, l] of PERFORMANCE_LEVELS.entries()) {
      if (weights[j] === 0) continue;
      level = l;
      pick -= weights[j]!;
      if (pick < 0) break;
    }
    agg.ratings[level] -= 1;
    agg.headcount -= 1;
  }
  record(ctx, cause, { kind: 'team', id: team.id }, 'headcount', headcountBefore, agg.headcount);
  if (headcountBefore !== agg.headcount) {
    ctx.log.push({ cause, target: { kind: 'team', id: team.id }, field: 'ratings', before: ratingsBefore, after: { ...agg.ratings } });
  }
}

/** Adds heads to an aggregate team at the given performance level. */
export function gainHeads(ctx: Ctx, team: Team, n: number, level: PerformanceLevel, cause: Cause) {
  const agg = team.aggregate!;
  const before = { ...agg.ratings };
  record(ctx, cause, { kind: 'team', id: team.id }, 'headcount', agg.headcount, agg.headcount + n);
  agg.headcount += n;
  agg.ratings[level] += n;
  ctx.log.push({ cause, target: { kind: 'team', id: team.id }, field: 'ratings', before, after: { ...agg.ratings } });
}

const isLow = (r: Rating) => r === 'below' || r === 'partial';

/** The plan someone is on, from their ratings, oldest first. */
export function planFrom(ratings: Rating[]): Plan {
  let run = 0;
  for (let i = ratings.length - 1; i >= 0 && isLow(ratings[i]!); i--) run++;
  return run === 0 ? 'none' : run === 1 ? 'coaching' : run === 2 ? 'pip' : 'failedPip';
}

export const personRatings = (p: Person): Rating[] => p.history.flatMap((h) => (h.rating ? [h.rating] : []));

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
    const entry: HistoryEntry = { week: ctx.s.week, cause, note: historyNote };
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
