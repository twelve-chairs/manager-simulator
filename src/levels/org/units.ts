import { band, NAMES } from '../line-manager';
import { deliveredRatings, meanStep } from '../senior-manager';
import {
  addTeam,
  applyEffects,
  attritionRiskOf,
  closeTeam,
  moveHeads,
  planOf,
  PERFORMANCE_LEVELS,
  RATINGS,
  type Cause,
  type ChangeLogEntry,
  type Effect,
  type NewPerson,
  type NewProject,
  type SimState,
} from '../../sim';
import { leaderOf, nextId, projectNames, randomInt, rule, teamNames, unusedName, type Rng } from './core';

/** Steps a level builds itself; a refusal is a bug in the level, not the player's doing. */
export function must<T extends { ok: boolean }>(result: T, what: string): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`${what}: ${JSON.stringify((result as { error?: unknown }).error)}`);
  return result as Extract<T, { ok: true }>;
}

/** Applies effects the level built, adding what changed to the log; a refusal is a bug in the level. */
export function applyLogged(sim: SimState, effects: Effect[], log: ChangeLogEntry[], what: string): SimState {
  if (!effects.length) return sim;
  const r = applyEffects(sim, effects);
  if (!r.ok) throw new Error(`${what}: ${r.error.message}`);
  log.push(...r.log);
  return r.state;
}

const value = (kind: 'person' | 'team', id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind, id }, field, amount, cause: rule(ruleId) });

/**
 * Folds the units into one under its new leader: the unit is the one `choice` leads, or the first with a hire leading it,
 * whose old leader becomes one of its heads; every other unit's heads, leader and active projects move into it, and the
 * emptied unit is closed.
 */
export function foldUnits(start: SimState, unitIds: string[], choice: string, hire: (sim: SimState) => NewPerson, cause: Cause): { sim: SimState; unitId: string } {
  const apply = (sim: SimState, effects: Effect[]) => must(applyEffects(sim, effects), 'handover: effects').state;
  const units = unitIds.filter((t) => start.teams[t]);
  const unitId = choice === 'hire' ? units[0]! : units.find((t) => leaderOf(start, t) === choice)!;
  let sim = start;
  if (choice === 'hire') {
    const old = leaderOf(sim, unitId);
    if (old) sim = apply(sim, [{ type: 'move', personId: old, teamId: unitId, cause }]);
    sim = apply(sim, [{ type: 'hire', teamId: unitId, person: hire(sim), cause }]);
  }
  for (const t of units.filter((x) => x !== unitId)) {
    for (const l of PERFORMANCE_LEVELS) {
      const n = sim.teams[t]!.aggregate!.ratings[l];
      if (n > 0) sim = must(moveHeads(sim, { from: t, to: unitId, level: l, count: n }, cause), `handover: moving heads from ${t}`).state;
    }
    const manager = leaderOf(sim, t);
    if (manager) sim = apply(sim, [{ type: 'move', personId: manager, teamId: unitId, cause }]);
    const projects = Object.values(sim.projects).filter((p) => p.teamId === t && p.status === 'active');
    if (projects.length) sim = apply(sim, projects.map((p): Effect => ({ type: 'reassignProject', projectId: p.id, teamId: unitId, cause })));
    sim = must(closeTeam(sim, t, cause), `handover: closing ${t}`).state;
  }
  return { sim, unitId };
}

export interface UnitShape {
  size: readonly [number, number];
  skill: readonly [number, number];
  motivation: readonly [number, number];
  stress: readonly [number, number];
  /** A project's weeks to its deadline, and its scope per week of that, so a healthy unit lands it near the deadline. */
  projectDeadline: readonly [number, number];
  projectScopePerWeek: readonly [number, number];
}

type Counters = Rng & { counters: { team: number; project: number } };

/** Adds a generated unit with its leader and two projects sized for it. */
export function addUnit(level: Counters, start: SimState, ids: { unit: string; project: string }, leader: NewPerson, shape: UnitShape, cause: Cause): { sim: SimState; unitId: string } {
  const id = nextId(level, 'team', ids.unit, start.teams);
  let sim = must(
    addTeam(start, {
      team: {
        id,
        name: unusedName(level, NAMES.teams, teamNames(start)),
        aggregate: { headcount: randomInt(level, shape.size), skill: randomInt(level, shape.skill), motivation: randomInt(level, shape.motivation), stress: randomInt(level, shape.stress) },
      },
      manager: leader,
    }, cause),
    'handover: adding a unit',
  ).state;
  for (let j = 0; j < 2; j++) {
    const projectId = nextId(level, 'project', ids.project, sim.projects);
    const projectName = unusedName(level, NAMES.projects, projectNames(sim));
    const weeks = randomInt(level, shape.projectDeadline);
    const project: NewProject = { id: projectId, name: projectName, teamId: id, scope: weeks * randomInt(level, shape.projectScopePerWeek), deadlineWeek: sim.week + weeks, risk: randomInt(level, [10, 70]), techDebt: randomInt(level, [10, 50]) };
    sim = must(applyEffects(sim, [{ type: 'startProject', project, cause }]), 'handover: effects').state;
  }
  return { sim, unitId: id };
}

/** A unit's mood as the engagement survey measured it: raw values, shown as bands. */
export interface SurveyEntry {
  motivation: number;
  stress: number;
  attritionRisk: number;
}

/** The engagement survey: each unit's motivation, stress and attrition risk as they are now. */
export function surveyUnits(unitIds: string[], sim: SimState): Record<string, SurveyEntry> {
  const units: Record<string, SurveyEntry> = {};
  for (const g of unitIds) {
    const a = sim.teams[g]?.aggregate;
    if (a) units[g] = { motivation: a.motivation, stress: a.stress, attritionRisk: a.attritionRisk };
  }
  return units;
}

export type Lead = { unitId: string; id: string | null };

export interface DriftTuning {
  driftShare: number;
  sustains: { motivationBase: number; motivationPerSkill: number; stressBase: number; stressPerSkill: number };
  leaderlessSkill: number;
  wantServed: number;
  wantUnserved: number;
  leaderStressShare: number;
}

/** The motivation and stress a leader with this management skill sustains in their unit. */
export function sustained(skill: number, t: DriftTuning) {
  return { motivation: t.sustains.motivationBase + skill * t.sustains.motivationPerSkill, stress: t.sustains.stressBase - skill * t.sustains.stressPerSkill };
}

/** Units drift toward what their leaders sustain; leaders toward their wants and their units. */
export function driftEffects(sim: SimState, leads: Lead[], t: DriftTuning, served: (want: string, unitStress: number) => boolean, ruleId: string): Effect[] {
  const effects: Effect[] = [];
  for (const { unitId, id } of leads) {
    const a = sim.teams[unitId]!.aggregate!;
    const target = sustained(id ? sim.people[id]!.skill : t.leaderlessSkill, t);
    effects.push(value('team', unitId, 'motivation', Math.round((target.motivation - a.motivation) * t.driftShare), ruleId), value('team', unitId, 'stress', Math.round((target.stress - a.stress) * t.driftShare), ruleId));
    if (!id) continue;
    const m = sim.people[id]!;
    effects.push(
      // A quarter that serves their want is tagged as serving it, so the simulation counts the want as served.
      served(m.want, a.stress)
        ? { type: 'value', target: { kind: 'person', id }, field: 'motivation', amount: t.wantServed, cause: rule(ruleId), wantTags: { serves: [m.want] } }
        : value('person', id, 'motivation', t.wantUnserved, ruleId),
      value('person', id, 'stress', Math.round((a.stress - m.stress) * t.leaderStressShare), ruleId),
    );
  }
  return effects;
}

/** Each unit's attrition risk, set from its motivation and stress as they are now. */
export const attritionEffects = (sim: SimState, unitIds: string[], ruleId: string): Effect[] =>
  unitIds.map((g) => {
    const a = sim.teams[g]!.aggregate!;
    return value('team', g, 'attritionRisk', attritionRiskOf(a.motivation, a.stress) - a.attritionRisk, ruleId);
  });

/** Re-rate effects that turn a unit's ratings now into the target ones. */
export function reRates(sim: SimState, unitId: string, target: Record<(typeof PERFORMANCE_LEVELS)[number], number>, ruleId: string): Effect[] {
  const now = { ...sim.teams[unitId]!.aggregate!.ratings };
  const effects: Effect[] = [];
  for (const from of PERFORMANCE_LEVELS) {
    for (const to of RATINGS) {
      if (from === to) continue;
      const count = Math.min(now[from] - (from === 'unrated' ? 0 : target[from]), target[to] - now[to]);
      if (count <= 0) continue;
      effects.push({ type: 'reRate', teamId: unitId, from, to, count, cause: rule(ruleId) });
      now[from] -= count;
      now[to] += count;
    }
  }
  return effects;
}

/**
 * Each leader calibrates their unit: its delivery, raised by their leniency; ratings above delivery cost the unit
 * motivation, since its people notice. Returns the units' average gap between ratings and delivery, in rating steps.
 */
export function calibrateUnits(sim0: SimState, unitIds: string[], leniency: Record<string, number>, motivationPerStep: number, ruleId: string, log: ChangeLogEntry[]): { sim: SimState; gap: number } {
  let sim = sim0;
  const gaps: number[] = [];
  for (const g of unitIds) {
    const delivered = deliveredRatings(sim, g);
    const lead = leaderOf(sim, g);
    const lenient = lead ? (leniency[lead] ?? 0) : 0;
    const target = { unrated: 0, below: 0, partial: 0, meets: 0, exceeds: 0, outstanding: 0 };
    RATINGS.forEach((r, i) => (target[RATINGS[Math.min(4, i + lenient)]!] += delivered[r]));
    sim = applyLogged(sim, reRates(sim, g, target, ruleId), log, 'calibration');
    const gap = meanStep(sim.teams[g]!.aggregate!.ratings) - meanStep(delivered);
    gaps.push(Math.abs(gap));
    if (gap > 0) sim = applyLogged(sim, [value('team', g, 'motivation', -Math.round(gap * motivationPerStep), ruleId)], log, 'calibration');
  }
  return { sim, gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0 };
}

/** Each leader is rated on how their unit delivered and fared under them; one on a plan rated low is held for a final evaluation. */
export function rateLeaders(sim: SimState, unitIds: string[], heldEvaluations: string[], ruleId: string): Effect[] {
  const ratings: Effect[] = [];
  for (const g of unitIds) {
    const id = leaderOf(sim, g);
    if (!id) continue;
    const a = sim.teams[g]!.aggregate!;
    const step = Math.round(meanStep(deliveredRatings(sim, g))) - (band(a.stress) >= 3 || band(a.motivation) <= 1 ? 1 : 0);
    const rating = RATINGS[Math.max(0, Math.min(4, step))]!;
    if ((rating === 'below' || rating === 'partial') && planOf(sim, { kind: 'person', id }) === 'pip') {
      if (!heldEvaluations.includes(id)) heldEvaluations.push(id);
    } else ratings.push({ type: 'rate', target: { kind: 'person', id }, rating, cause: rule(ruleId) });
  }
  return ratings;
}

export type RatingCounts = Record<'unrated' | 'below' | 'partial' | 'meets' | 'exceeds' | 'outstanding', number>;
const REGRETTED: (keyof RatingCounts)[] = ['meets', 'exceeds', 'outstanding'];

/** Each unit's rating counts as they are now, so later losses can be counted. */
export function knownRatings(unitIds: string[], sim: SimState): Record<string, RatingCounts> {
  const known: Record<string, RatingCounts> = {};
  for (const g of unitIds) {
    const a = sim.teams[g]?.aggregate;
    if (a) known[g] = { ...a.ratings };
  }
  return known;
}

/** Heads at meets or above lost since the counts were taken: only attrition changes them while the simulation advances. */
export function regrettedSince(known: Record<string, RatingCounts>, unitIds: string[], sim: SimState): number {
  let regretted = 0;
  for (const g of unitIds) {
    const was = known[g];
    const now = sim.teams[g]?.aggregate?.ratings;
    if (was && now) for (const r of REGRETTED) regretted += Math.max(0, was[r] - now[r]);
  }
  return regretted;
}
