import { band } from '../line-manager';
import { deliveredRatings, meanStep } from '../senior-manager';
import { applyEffects, attritionRiskOf, planOf, PERFORMANCE_LEVELS, RATINGS, type ChangeLogEntry, type Effect, type SimState } from '../../sim';
import { leaderOf, quarterOf, rule } from './core';
import { periodEndsThisQuarter } from './review';
import { takeSurvey } from './survey';
import { DIRECTOR_TUNING as T } from './tuning';
import type { DirectorHabits, DirectorState } from './types';

type Result<X> = ({ ok: true } & X) | { ok: false; error: string };

const OPTIONS: { [K in keyof DirectorHabits]: readonly DirectorHabits[K][] } = {
  time: ['organization', 'balanced', 'upward'],
  staffMeeting: ['weekly', 'fortnightly'],
  listeningTour: ['none', 'quarterly'],
};

/** Changes a standing habit; it applies from this quarter's end. */
// @spec DIR-HABIT-002, DIR-HABIT-003
export function setDirectorHabit(level: DirectorState, _sim: SimState, command: unknown): Result<{ level: DirectorState }> {
  if (typeof command !== 'object' || command === null) return { ok: false, error: 'a habit change must be an object' };
  const c = command as { habit?: unknown; value?: unknown };
  if (typeof c.habit !== 'string' || !Object.hasOwn(OPTIONS, c.habit)) return { ok: false, error: `unknown habit ${String(c.habit)}` };
  const habit = c.habit as keyof DirectorHabits;
  if (!(OPTIONS[habit] as readonly unknown[]).includes(c.value)) return { ok: false, error: `unknown option ${String(c.value)} for ${habit}` };
  const s = structuredClone(level);
  (s.habits as unknown as Record<string, unknown>)[habit] = c.value;
  return { ok: true, level: s };
}

const value = (kind: 'person' | 'team', id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind, id }, field, amount, cause: rule(ruleId) });
const energy = (amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'player' }, field: 'stress', amount, cause: rule(ruleId) });

function apply(sim: SimState, effects: Effect[], log: ChangeLogEntry[]): SimState {
  if (!effects.length) return sim;
  const r = applyEffects(sim, effects);
  if (!r.ok) throw new Error(`end of quarter: ${r.error.message}`);
  log.push(...r.log);
  return r.state;
}

/** Whether a quarter with these habits gives a senior manager what they want from the job. */
function served(want: string, habits: DirectorHabits, groupStress: number): boolean {
  switch (want) {
    case 'growth':
      return habits.time !== 'upward';
    case 'autonomy':
      return habits.time !== 'organization';
    case 'recognition':
      return habits.staffMeeting === 'weekly';
    default:
      return band(groupStress) < 3;
  }
}

/** Re-rate effects that turn a group's ratings now into the target ones. */
function reRates(sim: SimState, groupId: string, target: Record<(typeof PERFORMANCE_LEVELS)[number], number>): Effect[] {
  const now = { ...sim.teams[groupId]!.aggregate!.ratings };
  const effects: Effect[] = [];
  for (const from of PERFORMANCE_LEVELS) {
    for (const to of RATINGS) {
      if (from === to) continue;
      const count = Math.min(now[from] - (from === 'unrated' ? 0 : target[from]), target[to] - now[to]);
      if (count <= 0) continue;
      effects.push({ type: 'reRate', teamId: groupId, from, to, count, cause: rule('director.calibration') });
      now[from] -= count;
      now[to] += count;
    }
  }
  return effects;
}

/**
 * Ends the quarter: the habits act, the listening tour visits, each group and senior manager drift, and at a period's
 * end the survey is taken, the groups are calibrated and the senior managers rated.
 */
// @spec DIR-HABIT-004, DIR-HABIT-005, DIR-HABIT-006, DIR-DRIFT-001, DIR-DRIFT-002, DIR-DRIFT-003, DIR-DRIFT-004, DIR-PLAN-001, DIR-PLAN-002
export function endQuarter(level: DirectorState, sim0: SimState): Result<{ level: DirectorState; sim: SimState; log: ChangeLogEntry[] }> {
  const s = structuredClone(level);
  const log: ChangeLogEntry[] = [];
  let sim = sim0;
  const effects: Effect[] = [];
  const leads = s.groupIds.map((g) => ({ groupId: g, id: leaderOf(sim, g) }));
  const above = [s.executiveId, ...s.peerIds].filter((id) => sim.people[id]?.status === 'active');

  // Where the time goes.
  const t = T.time;
  if (s.habits.time === 'upward') {
    for (const id of above) effects.push(value('person', id, 'trust', t.aboveTrust, 'director.time'));
    for (const g of s.groupIds) effects.push(value('team', g, 'motivation', -t.groupMotivation, 'director.time'));
  } else if (s.habits.time === 'organization') {
    for (const id of above) effects.push(value('person', id, 'trust', -t.aboveTrust, 'director.time'));
    for (const g of s.groupIds) effects.push(value('team', g, 'motivation', t.groupMotivation, 'director.time'));
    for (const { id } of leads) if (id) effects.push(value('person', id, 'trust', t.seniorTrust, 'director.time'));
  }

  // Staff meetings.
  const meeting = T.staffMeeting[s.habits.staffMeeting];
  effects.push(energy(meeting.energy, 'director.staffMeeting'));
  for (const { id } of leads) {
    if (!id) continue;
    effects.push(value('person', id, 'trust', meeting.trust, 'director.staffMeeting'));
    s.learnedWants[id] = true;
  }

  // The listening tour.
  s.surfaced = [];
  if (s.habits.listeningTour === 'quarterly' && s.groupIds.length) {
    const g = s.groupIds[s.tourRotation % s.groupIds.length]!;
    s.tourRotation += 1;
    s.visited = { groupId: g, quarter: quarterOf(s, sim) + 1 };
    s.surfaced = [{ groupId: g, week: sim.week }];
    effects.push(energy(T.tourEnergy, 'director.listeningTour'));
  }

  // Groups drift toward what their senior managers sustain; senior managers toward their wants and their groups.
  for (const { groupId, id } of leads) {
    const a = sim.teams[groupId]!.aggregate!;
    const skill = id ? sim.people[id]!.skill : T.leaderlessSkill;
    const motivation = T.sustains.motivationBase + skill * T.sustains.motivationPerSkill;
    const stress = T.sustains.stressBase - skill * T.sustains.stressPerSkill;
    effects.push(value('team', groupId, 'motivation', Math.round((motivation - a.motivation) * T.driftShare), 'director.drift'), value('team', groupId, 'stress', Math.round((stress - a.stress) * T.driftShare), 'director.drift'));
    if (id) {
      const m = sim.people[id]!;
      effects.push(
        value('person', id, 'motivation', served(m.want, s.habits, a.stress) ? T.wantServed : T.wantUnserved, 'director.drift'),
        value('person', id, 'stress', Math.round((a.stress - m.stress) * T.seniorStressShare), 'director.drift'),
      );
    }
  }
  sim = apply(sim, effects, log);
  sim = apply(sim, s.groupIds.map((g) => {
    const a = sim.teams[g]!.aggregate!;
    return value('team', g, 'attritionRisk', attritionRiskOf(a.motivation, a.stress) - a.attritionRisk, 'director.drift');
  }), log);

  if (periodEndsThisQuarter(s, sim)) {
    // Each senior manager calibrates their group: its delivery, raised by their leniency.
    const gaps: number[] = [];
    for (const g of s.groupIds) {
      const delivered = deliveredRatings(sim, g);
      const lead = leaderOf(sim, g);
      const lenient = lead ? (s.leniency[lead] ?? 0) : 0;
      const target = { unrated: 0, below: 0, partial: 0, meets: 0, exceeds: 0, outstanding: 0 };
      RATINGS.forEach((r, i) => (target[RATINGS[Math.min(4, i + lenient)]!] += delivered[r]));
      sim = apply(sim, reRates(sim, g, target), log);
      gaps.push(Math.abs(meanStep(sim.teams[g]!.aggregate!.ratings) - meanStep(delivered)));
    }
    s.calibrations.push({ week: sim.week, gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0 });

    // Each senior manager is rated on how their group delivered and fared under them.
    const ratings: Effect[] = [];
    for (const g of s.groupIds) {
      const id = leaderOf(sim, g);
      if (!id) continue;
      const a = sim.teams[g]!.aggregate!;
      const step = Math.round(meanStep(deliveredRatings(sim, g))) - (band(a.stress) >= 3 || band(a.motivation) <= 1 ? 1 : 0);
      const rating = RATINGS[Math.max(0, Math.min(4, step))]!;
      if ((rating === 'below' || rating === 'partial') && planOf(sim, { kind: 'person', id }) === 'pip') {
        if (!s.heldEvaluations.includes(id)) s.heldEvaluations.push(id);
      } else ratings.push({ type: 'rate', target: { kind: 'person', id }, rating, cause: rule('director.seniorRating') });
    }
    sim = apply(sim, ratings, log);
    // The engagement survey, in the last quarter before the review.
    s.survey = takeSurvey(s, sim);
  }
  return { ok: true, level: s, sim, log };
}
