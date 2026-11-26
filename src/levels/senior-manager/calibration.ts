import { PERFORMANCE_LEVELS, RATINGS, applyEffects, type ChangeLogEntry, type Effect, type Rating, type SimState } from '../../sim';
import { leadOf } from './core';
import { remember } from './review';
import { SENIOR_TUNING } from './tuning';
import type { CalibrationEntry, RatingCounts, SeniorMoment, SeniorState } from './types';

const T = SENIOR_TUNING;
type Result<X> = ({ ok: true } & X) | { ok: false; error: string };

const empty = (): RatingCounts => ({ unrated: 0, below: 0, partial: 0, meets: 0, exceeds: 0, outstanding: 0 });
const heads = (c: RatingCounts) => RATINGS.reduce((n, r) => n + c[r], 0);
/** The average rating, in steps from below (0) to outstanding (4). */
export const meanStep = (c: RatingCounts) => {
  const n = heads(c);
  return n ? RATINGS.reduce((sum, r, i) => sum + i * c[r], 0) / n : 0;
};

/** The ratings a team's delivery corresponds to: most heads at the rating its health and skill earn, some a rating either side. */
// @spec SENIOR-CAL-001
export function deliveredRatings(sim: SimState, teamId: string): RatingCounts {
  const a = sim.teams[teamId]!.aggregate!;
  const score = a.skill * 0.5 + a.motivation * 0.3 + (100 - a.stress) * 0.2;
  const base = T.deliveryThresholds.filter((x) => score >= x).length;
  const spread = Math.floor(a.headcount * T.deliverySpread);
  const counts = empty();
  counts[RATINGS[Math.max(0, base - 1)]!] += spread;
  counts[RATINGS[Math.min(4, base + 1)]!] += spread;
  counts[RATINGS[base]!] += a.headcount - 2 * spread;
  return counts;
}

/** A manager's proposal: their team's delivery, every head raised by their leniency. */
function propose(delivered: RatingCounts, leniency: number): RatingCounts {
  const counts = empty();
  RATINGS.forEach((r, i) => (counts[RATINGS[Math.min(4, i + leniency)]!] += delivered[r]));
  return counts;
}

/** The calibration moment's entries, one per team in the group. */
export function calibrationEntries(level: SeniorState, sim: SimState): CalibrationEntry[] {
  return level.teamIds.map((teamId) => {
    const managerId = leadOf(level, sim, teamId);
    const delivered = deliveredRatings(sim, teamId);
    return { teamId, managerId, delivered, proposed: propose(delivered, managerId ? (level.leniency[managerId] ?? 0) : 0), final: null };
  });
}

/** Re-rate effects that turn a team's ratings now into the settled ones. */
function reRates(sim: SimState, teamId: string, target: RatingCounts): Effect[] {
  const now = { ...sim.teams[teamId]!.aggregate!.ratings };
  const effects: Effect[] = [];
  for (const from of PERFORMANCE_LEVELS) {
    for (const to of RATINGS) {
      if (from === to) continue;
      const surplus = now[from] - (from === 'unrated' ? 0 : target[from]);
      const deficit = target[to] - now[to];
      const count = Math.min(surplus, deficit);
      if (count <= 0) continue;
      effects.push({ type: 'reRate', teamId, from, to, count, cause: { kind: 'action', actionId: 'senior.calibration' } });
      now[from] -= count;
      now[to] += count;
    }
  }
  return effects;
}

const TOP: Rating[] = ['exceeds', 'outstanding'];
const topOf = (c: RatingCounts) => TOP.reduce((n, r) => n + c[r], 0);

/** The most top ratings the group may hold: its curve's share of the heads across its teams, rounded down. */
// @spec SENIOR-CAL-001
export function curveOf(level: SeniorState, sim: SimState): number {
  const heads = level.teamIds.reduce((n, id) => n + (sim.teams[id]?.aggregate?.headcount ?? 0), 0);
  return Math.floor(T.curveShare * heads);
}

/** The choices once calibration is settled over the curve. */
export const CURVE_CHOICES = [
  { id: 'argue', label: 'Argue for an exception: it spends your reputation, and holds only with a good or excellent reputation' },
  { id: 'trim', label: 'Let the room trim to the curve' },
];

/** The same, after an argument at the last calibration, which the room remembers. */
// @spec SENIOR-CAL-009
export const CURVE_CHOICES_AGAIN = [
  { id: 'argue', label: 'Argue for an exception again: you argued at the last calibration, so the room will hold it only for an excellent reputation' },
  { id: 'trim', label: 'Let the room trim to the curve' },
];

/** Whether the player argued for an exception recently enough that the room remembers it. */
const arguedRecently = (level: SeniorState, week: number) => week - level.lastArgued < T.curveMemoryWeeks;

/**
 * The order the room trims in, applied to `entries`' counts as `pick` reads them: one top-rated head at a time to meets,
 * an exceeds before an outstanding, from the team furthest above what it delivered, then the one with the most top
 * ratings, ties broken by team id. Returns the rating steps it took.
 */
function trimTo(entries: { teamId: string; delivered: RatingCounts; counts: RatingCounts }[], room: number): number {
  let steps = 0;
  while (entries.reduce((n, e) => n + topOf(e.counts), 0) > room) {
    const e = entries
      .filter((x) => topOf(x.counts) > 0)
      .sort((a, b) => meanStep(b.counts) - meanStep(b.delivered) - (meanStep(a.counts) - meanStep(a.delivered)) || topOf(b.counts) - topOf(a.counts) || (a.teamId < b.teamId ? -1 : 1))[0]!;
    const from: Rating = e.counts.exceeds > 0 ? 'exceeds' : 'outstanding';
    e.counts[from] -= 1;
    e.counts.meets += 1;
    steps += RATINGS.indexOf(from) - RATINGS.indexOf('meets');
  }
  return steps;
}

/**
 * Records how far the settled ratings strayed from what the teams delivered, in rating steps per head of the group,
 * leaving out steps down no more than trimming the delivered ratings to the curve would take.
 */
// @spec SENIOR-END-003
function record(level: SeniorState, moment: SeniorMoment, week: number) {
  const entries = moment.calibration!;
  let over = 0;
  let under = 0;
  let heads = 0;
  for (const e of entries) {
    const n = RATINGS.reduce((k, r) => k + e.final![r], 0);
    // In whole rating steps, so a settlement on the evidence scores exactly.
    const d = RATINGS.reduce((k, r, i) => k + i * (e.final![r] - e.delivered[r]), 0);
    if (d > 0) over += d;
    else under -= d;
    heads += n;
  }
  const forced = trimTo(entries.map((e) => ({ teamId: e.teamId, delivered: e.delivered, counts: { ...e.delivered } })), moment.curve ?? Infinity);
  level.calibrations.push({ week, gap: heads ? (over + Math.max(0, under - forced)) / heads : 0 });
}

/** Once every team is calibrated: answered within the curve, or held open over it for the room. */
// @spec SENIOR-CAL-006
function finish(level: SeniorState, moment: SeniorMoment, week: number) {
  const entries = moment.calibration!;
  if (entries.some((e) => !e.final)) return;
  const held = entries.reduce((n, e) => n + topOf(e.final!), 0);
  if (moment.curve !== undefined && held > moment.curve) {
    moment.overCurve = { held, room: moment.curve };
    moment.choices = arguedRecently(level, week) ? CURVE_CHOICES_AGAIN : CURVE_CHOICES;
    return;
  }
  moment.status = 'answered';
  record(level, moment, week);
}

/** What the reaction adds when calibration is settled over the curve: how far over, and the question that remains. */
export function overCurveLine(level: SeniorState, momentId: string): string {
  const over = level.moments.find((m) => m.id === momentId)?.overCurve;
  return over ? ` But the group now holds ${over.held} top ratings, and the curve allows ${over.room}.` : '';
}

const CALIBRATION_CAUSE = { kind: 'action' as const, actionId: 'senior.calibration' };

const topRatings = (n: number) => (n === 1 ? 'a top rating' : `${n} top ratings`);

/**
 * The room's trim of a calibration over the curve: the effects of each trimmed team's new ratings, motivation and its
 * manager's trust, applied to the moment's entries, and the teams that lost top ratings, in words.
 */
function roomTrim(sim: SimState, moment: SeniorMoment): { effects: Effect[]; lost: string[] } {
  const effects: Effect[] = [];
  const lost: string[] = [];
  const entries = moment.calibration!.map((e) => ({ teamId: e.teamId, delivered: e.delivered, counts: { ...e.final! }, was: e }));
  trimTo(entries, moment.curve!);
  for (const e of entries) {
    const cut = topOf(e.was.final!) - topOf(e.counts);
    if (cut === 0) continue;
    const unfair = (c: RatingCounts) => Math.round(Math.abs(meanStep(c) - meanStep(e.delivered)) * T.calUnfairMotivation);
    const before = unfair(e.was.final!);
    const after = unfair(e.counts);
    effects.push(...reRates(sim, e.teamId, e.counts));
    if (after !== before) effects.push({ type: 'value', target: { kind: 'team', id: e.teamId }, field: 'motivation', amount: before - after, cause: CALIBRATION_CAUSE });
    const m = e.was.managerId;
    if (m && sim.people[m]?.status === 'active') effects.push({ type: 'value', target: { kind: 'person', id: m }, field: 'trust', amount: -cut * T.calTrustPerHead, cause: CALIBRATION_CAUSE });
    e.was.final = e.counts;
    lost.push(`${sim.teams[e.teamId]!.name} loses ${topRatings(cut)}`);
  }
  return { effects, lost };
}

/** Arguing for an exception, or letting the room trim, once calibration is settled over the curve. */
// @spec SENIOR-CAL-007, SENIOR-CAL-008
export function settleCurve(level: SeniorState, sim: SimState, momentId: string, choice: 'argue' | 'trim'): Result<{ level: SeniorState; sim: SimState; log: ChangeLogEntry[]; reaction: string }> {
  const found = level.moments.find((m) => m.id === momentId);
  if (found?.kind !== 'calibration' || found.status !== 'open' || !found.overCurve) return { ok: false, error: `moment ${momentId} is not calibration over the curve` };
  const s = structuredClone(level);
  const moment = s.moments.find((m) => m.id === momentId)!;
  const argued = choice === 'argue';
  const effects: Effect[] = argued ? [{ type: 'value', target: { kind: 'player' }, field: 'reputation', amount: -T.curveExceptionCost, cause: CALIBRATION_CAUSE }] : [];
  const needed = arguedRecently(level, sim.week) ? T.curveExceptionAgainReputation : T.curveExceptionReputation;
  const holds = argued && sim.player.reputation >= needed;
  if (argued) s.lastArgued = sim.week;
  let reaction = 'It costs you in the room, but the exception holds: every top rating stands.';
  if (!holds) {
    const trimmed = roomTrim(sim, moment);
    effects.push(...trimmed.effects);
    const heard = argued ? 'The room hears you out and holds the curve. ' : '';
    reaction = `${heard}The room trims to the curve: ${trimmed.lost.join(', ')}.`;
  }
  const r = applyEffects(sim, effects);
  if (!r.ok) return { ok: false, error: r.error.message };
  moment.status = 'answered';
  delete moment.overCurve;
  record(s, moment, sim.week);
  remember(s, r.state);
  return { ok: true, level: s, sim: r.state, log: r.log, reaction };
}

export type CalibrationMove = { from: Rating; to: Rating; count: number };

/** Settles one team's ratings: its manager's proposal, with heads moved a rating up or down. */
// @spec SENIOR-CAL-002, SENIOR-CAL-003, SENIOR-CAL-004
export function calibrateTeam(level: SeniorState, sim: SimState, momentId: string, teamId: string, moves: CalibrationMove[]): Result<{ level: SeniorState; sim: SimState; log: ChangeLogEntry[]; reaction: string }> {
  const found = level.moments.find((m) => m.id === momentId);
  if (!found || found.kind !== 'calibration' || found.status !== 'open') return { ok: false, error: `moment ${momentId} is not an open calibration` };
  const entry = found.calibration!.find((e) => e.teamId === teamId);
  if (!entry || entry.final) return { ok: false, error: `team ${teamId} has no calibration waiting` };
  if (!Array.isArray(moves)) return { ok: false, error: 'moves must be a list' };
  const final = { ...entry.proposed };
  let down = 0;
  for (const move of moves) {
    const from = RATINGS.indexOf(move?.from);
    const to = RATINGS.indexOf(move?.to);
    if (from < 0 || to < 0) return { ok: false, error: `${String(move?.from)} or ${String(move?.to)} is not a rating` };
    if (Math.abs(from - to) !== 1) return { ok: false, error: 'heads move one rating at a time' };
    if (!Number.isInteger(move.count) || move.count < 1 || move.count > final[move.from]) return { ok: false, error: `there are not ${String(move.count)} heads at ${move.from} to move` };
    final[move.from] -= move.count;
    final[move.to] += move.count;
    if (to < from) down += move.count;
  }

  const s = structuredClone(level);
  const moment = s.moments.find((m) => m.id === momentId)!;
  const settled = moment.calibration!.find((e) => e.teamId === teamId)!;
  settled.final = final;
  const effects: Effect[] = reRates(sim, teamId, final);
  const m = settled.managerId;
  const cause = { kind: 'action' as const, actionId: 'senior.calibration' };
  if (m && sim.people[m]?.status === 'active') {
    if (moves.length === 0) effects.push({ type: 'value', target: { kind: 'person', id: m }, field: 'motivation', amount: T.calAcceptMotivation, cause });
    if (down > 0) effects.push({ type: 'value', target: { kind: 'person', id: m }, field: 'trust', amount: -down * T.calTrustPerHead, cause });
  }
  const unfair = Math.round(Math.abs(meanStep(final) - meanStep(settled.delivered)) * T.calUnfairMotivation);
  if (unfair) effects.push({ type: 'value', target: { kind: 'team', id: teamId }, field: 'motivation', amount: -unfair, cause });
  const r = applyEffects(sim, effects);
  if (!r.ok) return { ok: false, error: r.error.message };
  finish(s, moment, sim.week);
  remember(s, r.state);
  const who = m ? r.state.people[m]!.name : 'The team';
  const reaction = moves.length === 0 ? `${who} is pleased the ratings stand.` : down > 0 ? `${who} argues for their people, then accepts it.` : `${who} takes the higher ratings gladly.`;
  return { ok: true, level: s, sim: r.state, log: r.log, reaction };
}

/** Settles every team still waiting: their managers' proposals stand. */
// @spec SENIOR-CAL-005
export function acceptRemaining(level: SeniorState, sim: SimState, momentId: string): Result<{ level: SeniorState; sim: SimState; log: ChangeLogEntry[] }> {
  let l = level;
  let s = sim;
  const log: ChangeLogEntry[] = [];
  const moment = level.moments.find((m) => m.id === momentId);
  for (const e of moment?.calibration ?? []) {
    if (e.final) continue;
    const r = calibrateTeam(l, s, momentId, e.teamId, []);
    if (!r.ok) return r;
    l = r.level;
    s = r.sim;
    log.push(...r.log);
  }
  return { ok: true, level: l, sim: s, log };
}
