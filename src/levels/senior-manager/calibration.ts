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

/** Records how far the settled ratings strayed from what the teams delivered, once every team is calibrated. */
function finish(level: SeniorState, moment: SeniorMoment, week: number) {
  const entries = moment.calibration!;
  if (entries.some((e) => !e.final)) return;
  moment.status = 'answered';
  const gap = entries.reduce((sum, e) => sum + Math.abs(meanStep(e.final!) - meanStep(e.delivered)), 0) / Math.max(1, entries.length);
  level.calibrations.push({ week, gap });
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
