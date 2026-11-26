import { band } from '../line-manager';
import { applyLogged, arrivals, attritionEffects, calibrateUnits, driftEffects, knownRatings, leaderOf, randomInt, rateLeaders, rule, surveyUnits, sustained, type Lead } from '../org';
import type { ChangeLogEntry, Effect, SimState } from '../../sim';
import { generateDirector, quarterOf } from './core';
import { cutEffects, hardNews, waitMoments } from './moments';
import { quarterRecap, snapshotQuarter, type VpRecap } from './recap';
import { periodEndsThisQuarter } from './review';
import { VP_TUNING as T } from './tuning';
import type { VpState } from './types';

type Result<X> = ({ ok: true } & X) | { ok: false; error: string };

const value = (kind: 'person' | 'team' | 'project', id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind, id }, field, amount, cause: rule(ruleId) });
const player = (field: 'stress' | 'reputation', amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'player' }, field, amount, cause: rule(ruleId) });
const apply = (sim: SimState, effects: Effect[], log: ChangeLogEntry[]) => applyLogged(sim, effects, log, 'end of quarter');
const active = (sim: SimState, ids: string[]) => ids.filter((id) => sim.people[id]?.status === 'active');
const year = (quarter: number) => Math.floor((quarter - 1) / T.quartersPerYear);

/** The year's heads due this quarter join the division with the highest stress, with a quarter's onboarding stress. */
// @spec VP-DRIFT-005
function headsArrive(s: VpState, sim: SimState): Effect[] {
  const n = s.year?.due.shift() ?? 0;
  const g = s.divisionIds.filter((x) => sim.teams[x]).sort((x, y) => sim.teams[y]!.aggregate!.stress - sim.teams[x]!.aggregate!.stress || (x < y ? -1 : 1))[0];
  if (!n || !g || !s.year) return [];
  s.year.arrived += n;
  return [value('team', g, 'headcount', n, 'vp.headcount'), value('team', g, 'stress', n * T.planning.onboardingStress, 'vp.headcount')];
}

/** The next wave of a cut made in waves. */
// @spec VP-CUT-004
function cutWave(s: VpState, sim: SimState): Effect[] {
  const heads = s.cut.waves.shift();
  if (!heads) return [];
  const effects = cutEffects(s, sim, heads, T.cuts.waveMotivation, T.cuts.waveRisk);
  const divisions: Record<string, number> = {};
  for (const e of effects) if (e.type === 'value' && e.target.kind === 'team' && e.field === 'headcount') divisions[e.target.id] = -e.amount;
  s.cutHeads.push({ week: sim.week, count: heads, divisions });
  return effects;
}

/** The priority slowed when spread, and sped when the player reviews their directors' plans closely. */
function priorityProgress(s: VpState, sim: SimState): Effect[] {
  const p = s.priority ? sim.projects[s.priority.projectId] : undefined;
  if (!s.priority || p?.status !== 'active') return [];
  const speed = s.habits.directors === 'review' ? T.directors.prioritySpeed : 0;
  const change = speed - s.priority.spreadSlow;
  return change ? [value('project', p.id, 'progress', Math.max(-p.progress, change), 'vp.priority')] : [];
}

/** The company priority lands by its deadline, or fails when overdue, cancelled or leaderless two quarter ends running. */
// @spec VP-PRIO-004
function settlePriority(s: VpState, sim: SimState): Effect[] {
  const pr = s.priority;
  if (!pr) return [];
  const p = sim.projects[pr.projectId];
  const landed = p?.status === 'completed' && (s.completions[pr.projectId] ?? sim.week) <= p.deadlineWeek;
  const failed = !p || p.status === 'cancelled' || (p.status === 'completed' && !landed) || (p.status === 'active' && sim.week > p.deadlineWeek) || (s.leaderlessEnds[pr.divisionId] ?? 0) >= 2;
  if (!landed && !failed) return [];
  s.priorityResults.push({ week: sim.week, projectId: pr.projectId, landed });
  s.priority = null;
  const sign = landed ? 1 : -1;
  const effects = [player('reputation', sign * pr.stake, 'vp.priority'), value('person', s.ceoId, 'trust', sign * pr.stake, 'vp.priority')];
  if (failed && p?.status === 'active') effects.push({ type: 'cancelProject', projectId: p.id, cause: rule('vp.priority') });
  return effects;
}

/** At the year's last quarter end, asking for more than the plan needed costs if a priority of that year failed. */
// @spec VP-BUDGET-003
function askedMoreFound(s: VpState, sim: SimState): Effect[] {
  const q = quarterOf(s, sim);
  if (!s.year?.askedMore || q % T.quartersPerYear !== 0) return [];
  const from = s.startWeek + (s.year.quarter - 1) * T.weeksPerQuarter;
  if (!s.priorityResults.some((r) => r.week >= from && !r.landed)) return [];
  const p = T.planning;
  return [
    { type: 'value', target: { kind: 'person', id: s.ceoId }, field: 'trust', amount: -p.missedTrust, cause: rule('vp.planning'), historyNote: 'Remembered you asked for more than you delivered' },
    player('reputation', -p.missedReputation, 'vp.planning'),
  ];
}

/** A celebration found out: hard news in a later quarter of the same year lowers every division's motivation. */
// @spec VP-HANDS-003
function celebrationFound(s: VpState, sim: SimState, since: number): Effect[] {
  const q = quarterOf(s, sim);
  const told = s.told;
  if (told?.what !== 'celebration' || told.quarter >= q || year(told.quarter) !== year(q) || !hardNews(s, sim, since)) return [];
  s.told = { what: 'truth', quarter: q };
  return s.divisionIds.filter((g) => sim.teams[g]).map((g) => value('team', g, 'motivation', -T.allHands.caughtMotivation, 'vp.allHands'));
}

/** Which team the player puts first, and how closely they review their directors. */
// @spec VP-HABIT-004, VP-HABIT-005
function habitEffects(s: VpState, sim: SimState, leads: Lead[]): Effect[] {
  const f = T.firstTeam;
  const d = T.directors;
  const directors = leads.flatMap((l) => (l.id ? [l.id] : []));
  const effects: Effect[] =
    s.habits.firstTeam === 'function'
      ? [...directors.map((id) => value('person', id, 'trust', f.functionDirectorTrust, 'vp.firstTeam')), ...active(sim, s.peerIds).map((id) => value('person', id, 'trust', -f.functionPeerTrust, 'vp.firstTeam'))]
      : [...active(sim, [s.ceoId, ...s.peerIds]).map((id) => value('person', id, 'trust', f.leadershipTrust, 'vp.firstTeam')), ...directors.map((id) => value('person', id, 'trust', -f.leadershipDirectorTrust, 'vp.firstTeam'))];
  if (s.habits.directors === 'stepBack') {
    for (const id of directors) if (band(sim.people[id]!.skill) >= 1) effects.push(value('person', id, 'skill', d.growth, 'vp.directors'));
    return effects;
  }
  // Close review lifts a struggling director's division toward what a capable one would sustain.
  const capable = sustained(40, T.drift);
  for (const { unitId, id } of leads) {
    const a = sim.teams[unitId]!.aggregate!;
    if (id && band(sim.people[id]!.skill) < 2) effects.push(value('team', unitId, 'motivation', Math.max(0, Math.round((capable.motivation - a.motivation) * d.steadyShare)), 'vp.directors'), value('team', unitId, 'stress', Math.min(0, Math.round((capable.stress - a.stress) * d.steadyShare)), 'vp.directors'));
  }
  effects.push(...directors.map((id) => value('person', id, 'trust', -d.trust, 'vp.directors')), player('stress', d.energy, 'vp.directors'));
  return effects;
}

/** Whether a quarter with these habits gives a director what they want from the job. */
function served(want: string, s: VpState, unitStress: number, quarter: number): boolean {
  switch (want) {
    case 'growth':
    case 'autonomy':
      return s.habits.directors === 'stepBack';
    case 'recognition':
      // An all-hands that speaks about the function's work recognizes it, whichever team the player puts first.
      return s.habits.firstTeam === 'function' || (s.told !== null && s.told.what !== 'short' && s.told.quarter === quarter);
    default:
      return band(unitStress) < 3;
  }
}

/**
 * What the quarter's end settles before the habits act: moments left waiting, directors arriving, the year's heads, a
 * cut's next wave, the priority moving, landing or failing, an ask for more found out, and a celebration found out.
 */
// @spec VP-MOMENT-004, VP-PLAN-003
function settleQuarter(s: VpState, sim0: SimState, log: ChangeLogEntry[]): SimState {
  const since = s.quarterStart?.week ?? sim0.week;
  // In this order, applied in these batches: waiting and arrivals draw on the level's generator, and each batch sees the one before.
  let sim = waitMoments(s, sim0, log);
  sim = apply(sim, arrivals(s, sim, (now) => generateDirector(s, now, { skill: randomInt(s, [40, 59]), trust: 50 }), 'vp.newDirector'), log);
  sim = apply(sim, [...headsArrive(s, sim), ...cutWave(s, sim), ...priorityProgress(s, sim)], log);
  for (const g of s.divisionIds) s.leaderlessEnds[g] = sim.teams[g] && !leaderOf(sim, g) ? (s.leaderlessEnds[g] ?? 0) + 1 : 0;
  sim = apply(sim, settlePriority(s, sim), log);
  return apply(sim, [...askedMoreFound(s, sim), ...celebrationFound(s, sim, since)], log);
}

/**
 * Ends the quarter: the habits act, each division and director drift, and at a period's end the divisions are
 * calibrated, the directors rated and the survey taken.
 */
// @spec VP-RECAP-001, VP-DRIFT-001, VP-DRIFT-002, VP-DRIFT-003, VP-DRIFT-004, VP-PLAN-001, VP-PLAN-002
export function endQuarter(level: VpState, sim0: SimState): Result<{ level: VpState; sim: SimState; log: ChangeLogEntry[]; recap: VpRecap }> {
  const s = structuredClone(level);
  const start = s.quarterStart ?? snapshotQuarter(s, sim0);
  const log: ChangeLogEntry[] = [];
  let sim = settleQuarter(s, sim0, log);
  const divisions = s.divisionIds.filter((g) => sim.teams[g]);
  const leads = divisions.map((g) => ({ unitId: g, id: leaderOf(sim, g) }));
  sim = apply(sim, [...habitEffects(s, sim, leads), ...driftEffects(sim, leads, T.drift, (want, stress) => served(want, s, stress, quarterOf(s, sim)), 'vp.drift')], log);
  sim = apply(sim, attritionEffects(sim, divisions, 'vp.drift'), log);
  if (periodEndsThisQuarter(s, sim)) {
    const calibrated = calibrateUnits(sim, divisions, s.leniency, T.calibrationMotivation, 'vp.calibration', log);
    sim = calibrated.sim;
    s.calibrations.push({ week: sim.week, gap: calibrated.gap });
    sim = apply(sim, rateLeaders(sim, divisions, s.heldEvaluations, 'vp.directorRating'), log);
    s.survey = { quarter: quarterOf(s, sim), divisions: surveyUnits(divisions, sim) };
  }
  // Heads cut and arriving are not attrition: remember the divisions as they are now.
  s.knownRatings = knownRatings(s.divisionIds, sim);
  const recap = quarterRecap(s, sim, start);
  s.quarterStart = null;
  return { ok: true, level: s, sim, log, recap };
}
