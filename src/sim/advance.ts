import {
  cloneState,
  chanceOver,
  changePerson,
  changeTeam,
  depart,
  isBehind,
  isOverdue,
  loseHeads,
  outputFactor,
  random,
  record,
  sortedIds,
  summarize,
  troubles,
  type Ctx,
} from './core.ts';
import { TUNING } from './tuning.ts';
import type { Cause, OperationResult, Person, SimState, Team } from './types.ts';

const rule = (ruleId: string): Cause => ({ kind: 'rule', ruleId });

const teams = (s: SimState) => sortedIds(s.teams).map((id) => s.teams[id]!);
const projects = (s: SimState) => sortedIds(s.projects).map((id) => s.projects[id]!);
const activePeople = (s: SimState) => sortedIds(s.people).map((id) => s.people[id]!).filter((p) => p.status === 'active');

function projectWork(ctx: Ctx, weeks: number) {
  const cause = rule('rule.projectWork');
  for (const p of projects(ctx.s)) {
    if (p.status !== 'active') continue;
    const team = ctx.s.teams[p.teamId];
    if (!team) continue;
    const t = summarize(ctx.s, team);
    const perWeek =
      t.headcount *
      TUNING.workPerPersonPerWeek *
      outputFactor(t.skill, t.motivation, t.stress) *
      (1 - p.techDebt / 200);
    const before = p.progress;
    p.progress = Math.min(p.scope, before + Math.round(perWeek * weeks));
    record(ctx, cause, { kind: 'project', id: p.id }, 'progress', before, p.progress);
    if (p.progress >= p.scope) {
      record(ctx, cause, { kind: 'project', id: p.id }, 'status', p.status, 'completed');
      p.status = 'completed';
    }
  }
}

function setbacks(ctx: Ctx, weeks: number) {
  const cause = rule('rule.setbacks');
  for (const p of projects(ctx.s)) {
    if (p.status !== 'active') continue;
    const weekly = ((p.risk * 0.6 + p.techDebt * 0.4) / 100) * TUNING.setbackChancePerWeek;
    if (random(ctx) >= chanceOver(weekly, weeks)) continue;
    const before = p.progress;
    p.progress = Math.max(0, before - Math.round(p.scope * TUNING.setbackProgressLoss));
    record(ctx, cause, { kind: 'project', id: p.id }, 'progress', before, p.progress);
    const team = ctx.s.teams[p.teamId];
    if (team) changeTeam(ctx, team, 'stress', TUNING.setbackStress, cause);
  }
}

function stress(ctx: Ctx, weeks: number) {
  const cause = rule('rule.stress');
  for (const team of teams(ctx.s)) {
    const n = troubles(ctx.s, team);
    const amount = n > 0 ? n * TUNING.troubleStressPerWeek * weeks : -TUNING.stressRecoveryPerWeek * weeks;
    changeTeam(ctx, team, 'stress', amount, cause);
  }
}

function wantDrift(ctx: Ctx, weeks: number) {
  const cause = rule('rule.wantDrift');
  for (const p of activePeople(ctx.s)) {
    // Split the step into weeks within the drift threshold and weeks past it.
    const endWeek = ctx.s.week + weeks;
    const pastThreshold = Math.min(weeks, Math.max(0, endWeek - p.wantServedWeek - TUNING.wantDriftThresholdWeeks));
    const amount = (weeks - pastThreshold) * TUNING.wantRecoveryPerWeek - pastThreshold * TUNING.wantDriftPerWeek;
    if (amount !== 0) changePerson(ctx, p, 'motivation', amount, cause);
  }
}

/** Counts a person's weeks of low motivation and high stress, then rolls whether they quit this step. */
function mayQuit(ctx: Ctx, p: Person, weeks: number, cause: Cause) {
  const target = { kind: 'person', id: p.id } as const;
  const low = p.motivation < TUNING.lowMotivationLine ? p.lowMotivationWeeks + weeks : 0;
  record(ctx, cause, target, 'lowMotivationWeeks', p.lowMotivationWeeks, low);
  p.lowMotivationWeeks = low;
  const high = p.stress > TUNING.highStressLine ? p.highStressWeeks + weeks : 0;
  record(ctx, cause, target, 'highStressWeeks', p.highStressWeeks, high);
  p.highStressWeeks = high;

  // A restless person quits once their notice has run; anyone else may become restless, never quit outright, so every
  // quit has at least one step in which the career level can show it coming (SIM-ADV-011, SIM-ADV-016).
  if (p.restlessSince !== null) {
    if (ctx.s.week - p.restlessSince >= TUNING.restlessNoticeWeeks) depart(ctx, p, 'quit', cause);
    return;
  }
  const weekly =
    (TUNING.baseQuitChancePerWeek +
      (low / 52) * TUNING.lowMotivationQuitChancePerYear +
      (high / 52) * TUNING.highStressQuitChancePerYear) *
    (1.5 - p.trust / 100);
  if (random(ctx) < chanceOver(weekly, weeks)) {
    record(ctx, cause, target, 'restlessSince', null, ctx.s.week);
    p.restlessSince = ctx.s.week;
  }
}

/** An aggregate team loses heads one roll at a time, each at its attrition risk. */
function aggregateAttrition(ctx: Ctx, team: Team, weeks: number, cause: Cause) {
  const agg = team.form === 'aggregate' ? team.aggregate : undefined;
  if (!agg) return;
  const perHead = chanceOver((agg.attritionRisk / 100) * TUNING.aggregateAttritionPerWeek, weeks);
  let lost = 0;
  for (let i = 0; i < agg.headcount; i++) if (random(ctx) < perHead) lost++;
  if (lost > 0) loseHeads(ctx, team, lost, cause);
}

function departure(ctx: Ctx, weeks: number) {
  const cause = rule('rule.departure');
  // People outside the organization never quit (SIM-OUT-003).
  for (const p of activePeople(ctx.s)) if (p.teamId !== null) mayQuit(ctx, p, weeks, cause);
  for (const team of teams(ctx.s)) aggregateAttrition(ctx, team, weeks, cause);
}

function playerStanding(ctx: Ctx, weeks: number) {
  const cause = rule('rule.playerStanding');
  const s = ctx.s;
  const active = projects(s).filter((p) => p.status === 'active');
  const inTrouble = active.filter((p) => isOverdue(s, p) || isBehind(s, p)).length;
  const onTrack = active.length - inTrouble;
  const repDelta = (onTrack - inTrouble) * TUNING.reputationPerProjectPerWeek * weeks;
  // A team led by another person is theirs to carry; only teams the player leads, or with no leader, land on the player.
  // @spec SIM-ADV-014
  const troubledTeams = teams(s).filter((t) => (t.leader === null || t.leader.kind === 'player') && troubles(s, t) > 0).length;
  const stressDelta =
    troubledTeams > 0
      ? troubledTeams * TUNING.playerStressPerTroubledTeamPerWeek * weeks
      : -TUNING.playerStressRecoveryPerWeek * weeks;

  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  const rep = clamp(s.player.reputation + repDelta);
  record(ctx, cause, { kind: 'player' }, 'reputation', s.player.reputation, rep);
  s.player.reputation = rep;
  const st = clamp(s.player.stress + stressDelta);
  record(ctx, cause, { kind: 'player' }, 'stress', s.player.stress, st);
  s.player.stress = st;
}

function gameTime(ctx: Ctx, weeks: number) {
  const before = ctx.s.week;
  ctx.s.week += weeks;
  record(ctx, rule('rule.gameTime'), { kind: 'clock' }, 'week', before, ctx.s.week);
}

// @spec SIM-ADV-001, SIM-ADV-002, SIM-ADV-003, SIM-ADV-004, SIM-ADV-005, SIM-ADV-006, SIM-ADV-007, SIM-ADV-008
// @spec SIM-ADV-009, SIM-ADV-010, SIM-ADV-011, SIM-ADV-012, SIM-ADV-013, SIM-ADV-014, SIM-ADV-015, SIM-ADV-016
// @spec SIM-TIME-002, SIM-TIME-003, SIM-LOG-002, SIM-STATE-007
export function advance(state: SimState, weeks: number): OperationResult {
  const ctx: Ctx = { s: cloneState(state), log: [] };
  projectWork(ctx, weeks);
  setbacks(ctx, weeks);
  stress(ctx, weeks);
  wantDrift(ctx, weeks);
  departure(ctx, weeks);
  playerStanding(ctx, weeks);
  gameTime(ctx, weeks);
  return { state: ctx.s, log: ctx.log };
}
