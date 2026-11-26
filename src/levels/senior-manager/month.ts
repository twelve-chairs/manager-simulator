import { NAMES, band } from '../line-manager';
import { applyEffects, attritionRiskOf, type ChangeLogEntry, type Effect, type SimState } from '../../sim';
import { leadOf, managerOf, nextId, randomInt, rule, unusedName } from './core';
import { periodEndsThisMonth, periodSnapshot, remember } from './review';
import { acceptRemaining, deliveredRatings, meanStep, settleCurve } from './calibration';
import { setGoals } from './goals';
import { monthRecap, snapshotMonth } from './recap';
import { RATINGS, planOf } from '../../sim';
import { SENIOR_TUNING } from './tuning';
import type { Oversight, SeniorHabits, SeniorState } from './types';

const T = SENIOR_TUNING;
const OVERSIGHT: readonly Oversight[] = ['handsOff', 'coaching', 'close'];
const OPTIONS = { oneOnOnes: ['weekly', 'fortnightly', 'monthly'], backfill: ['fast', 'holdTheBar'], skipLevel: ['none', 'monthly'], newWork: ['ask', 'assign'] } as const;
const ONE_ON_ONES_A_MONTH = { weekly: 4, fortnightly: 2, monthly: 1 } as const;

export type SeniorHabitCommand =
  | { habit: 'oversight'; managerId: string; value: Oversight }
  | { habit: 'oneOnOnes'; value: SeniorHabits['oneOnOnes'] }
  | { habit: 'backfill'; value: SeniorHabits['backfill'] }
  | { habit: 'skipLevel'; value: SeniorHabits['skipLevel'] }
  | { habit: 'newWork'; value: SeniorHabits['newWork'] };

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Changes a standing habit; it applies from this month's end. */
// @spec SENIOR-HABIT-002, SENIOR-HABIT-003
export function setSeniorHabit(level: SeniorState, sim: SimState, command: unknown): Result<{ level: SeniorState }> {
  if (typeof command !== 'object' || command === null) return { ok: false, error: 'a habit change must be an object' };
  const c = command as { habit?: unknown; managerId?: unknown; value?: unknown };
  const s = structuredClone(level);
  if (c.habit === 'oversight') {
    const managers = s.teamIds.flatMap((t) => managerOf(sim, t) ?? []);
    if (typeof c.managerId !== 'string' || !managers.includes(c.managerId)) return { ok: false, error: `${String(c.managerId)} is not one of your managers` };
    if (!OVERSIGHT.includes(c.value as Oversight)) return { ok: false, error: `unknown oversight ${String(c.value)}` };
    s.habits.oversight[c.managerId] = c.value as Oversight;
    return { ok: true, level: s };
  }
  if (c.habit === 'oneOnOnes' || c.habit === 'backfill' || c.habit === 'skipLevel' || c.habit === 'newWork') {
    if (!(OPTIONS[c.habit] as readonly unknown[]).includes(c.value)) return { ok: false, error: `unknown option ${String(c.value)} for ${c.habit}` };
    (s.habits as unknown as Record<string, unknown>)[c.habit] = c.value;
    return { ok: true, level: s };
  }
  return { ok: false, error: `unknown habit ${String(c.habit)}` };
}

const person = (id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'person', id }, field, amount, cause: rule(ruleId) });
const team = (id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'team', id }, field, amount, cause: rule(ruleId) });
const player = (amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'player' }, field: 'stress', amount, cause: rule(ruleId) });

function apply(sim: SimState, effects: Effect[], log: ChangeLogEntry[]): SimState {
  if (!effects.length) return sim;
  const r = applyEffects(sim, effects);
  if (!r.ok) throw new Error(`end of month: ${r.error.message}`);
  log.push(...r.log);
  return r.state;
}

/** Whether a month with these habits gives a manager what they want from the job. */
function served(want: string, oversight: Oversight, habits: SeniorHabits, teamStress: number): boolean {
  switch (want) {
    case 'growth':
      return oversight === 'coaching';
    case 'autonomy':
      return oversight === 'handsOff';
    case 'recognition':
      return habits.oneOnOnes !== 'monthly';
    default:
      return band(teamStress) < 3;
  }
}

type Lead = { teamId: string; id: string | null };

/** Calibration left unanswered: every manager's proposal stands, and the room trims what goes over the curve. */
// @spec SENIOR-CAL-005
function settleCalibration(level: SeniorState, sim0: SimState, log: ChangeLogEntry[]): Result<{ level: SeniorState; sim: SimState }> {
  const calibration = level.moments.find((x) => x.kind === 'calibration' && x.status === 'open');
  if (!calibration) return { ok: true, level, sim: sim0 };
  const r = acceptRemaining(level, sim0, calibration.id);
  if (!r.ok) return r;
  log.push(...r.log);
  if (!r.level.moments.find((x) => x.id === calibration.id)?.overCurve) return { ok: true, level: r.level, sim: r.sim };
  const t = settleCurve(r.level, r.sim, calibration.id, 'trim');
  if (!t.ok) return t;
  log.push(...t.log);
  return { ok: true, level: t.level, sim: t.sim };
}

/** Oversight and 1:1s, for each manager. */
function oversightEffects(s: SeniorState, sim: SimState, managers: Lead[]): Effect[] {
  const effects: Effect[] = [];
  for (const { id } of managers) {
    if (!id) continue;
    const oversight = s.habits.oversight[id] ?? 'coaching';
    if (oversight === 'coaching') effects.push(player(T.coachingEnergy, 'senior.oversight'), person(id, 'skill', T.coachingGrowth, 'senior.oversight'));
    if (oversight === 'close') {
      effects.push(player(T.closeEnergy, 'senior.oversight'));
      const months = (s.closeMonths[id] ?? 0) + 1;
      s.closeMonths[id] = months;
      if (sim.people[id]!.want === 'autonomy') effects.push(person(id, 'motivation', -T.closeAutonomyMotivation, 'senior.oversight'));
      if (months >= T.closeTrustMonths) effects.push(person(id, 'trust', -T.closeTrust, 'senior.oversight'));
    } else s.closeMonths[id] = 0;
    const n = ONE_ON_ONES_A_MONTH[s.habits.oneOnOnes];
    effects.push(person(id, 'trust', n * T.oneOnOneTrust, 'senior.oneOnOnes'), player(n * T.oneOnOneEnergy, 'senior.oneOnOnes'));
    s.learnedWants[id] = true;
  }
  return effects;
}

/** Skip-level listening, one team a month in turn; a manager who doesn't trust the player resents it. */
function skipLevelEffects(s: SeniorState, sim: SimState, trustBefore: Record<string, number>): Effect[] {
  s.listenedTo = [];
  s.surfaced = [];
  if (s.habits.skipLevel !== 'monthly' || !s.teamIds.length) return [];
  const t = s.teamIds[s.skipRotation % s.teamIds.length]!;
  s.skipRotation += 1;
  s.listenedTo = [t];
  s.surfaced = [{ teamId: t, week: sim.week }];
  const effects = [player(T.skipLevelEnergy, 'senior.skipLevel')];
  const m = leadOf(s, sim, t);
  if (m && trustBefore[m]! < T.skipLevelTrustBelow) effects.push(person(m, 'trust', -T.skipLevelTrust, 'senior.skipLevel'));
  return effects;
}

/** Lost heads: noticed, kept stressing the team while missing, and backfilled when the policy's months are up. */
function backfillEffects(s: SeniorState, sim: SimState): Effect[] {
  for (const t of s.teamIds) {
    const a = sim.teams[t]!.aggregate!;
    for (let lost = (s.knownHeadcount[t] ?? a.headcount) - a.headcount; lost > 0; lost--) s.backfills.push({ teamId: t, since: sim.week, months: 0 });
  }
  const due = T.backfillMonths[s.habits.backfill];
  const effects: Effect[] = [];
  const stillMissing = [];
  for (const b of s.backfills) {
    b.months += 1;
    effects.push(team(b.teamId, 'stress', T.backfillGapStress, 'senior.backfill'));
    if (b.months < due || !sim.teams[b.teamId]) {
      stillMissing.push(b);
      continue;
    }
    s.counters.hire += 1;
    effects.push({
      type: 'hire',
      teamId: b.teamId,
      person: { id: nextId(s, 'hire', 'h', sim.people), name: 'New hire', role: 'engineer', skill: 50, motivation: 60, stress: 30, trust: 50, want: 'growth' },
      cause: rule('senior.backfill'),
    });
    if (s.habits.backfill === 'fast') effects.push(team(b.teamId, 'skill', -T.fastBackfillSkill, 'senior.backfill'));
  }
  s.backfills = stillMissing;
  return effects;
}

/** Teams drift toward what their managers sustain; managers toward their wants and their teams. */
function driftEffects(s: SeniorState, sim: SimState, managers: Lead[]): Effect[] {
  const effects: Effect[] = [];
  for (const { teamId, id } of managers) {
    const a = sim.teams[teamId]!.aggregate!;
    const skill = id ? sim.people[id]!.skill : T.leaderlessSkill;
    const oversight = id ? (s.habits.oversight[id] ?? 'coaching') : 'handsOff';
    const share = T.driftShare * (oversight === 'handsOff' && band(skill) < 2 ? T.handsOffDrift : 1);
    const motivation = T.sustains.motivationBase + skill * T.sustains.motivationPerSkill;
    const stress = T.sustains.stressBase - skill * T.sustains.stressPerSkill;
    effects.push(team(teamId, 'motivation', Math.round((motivation - a.motivation) * share), 'senior.drift'), team(teamId, 'stress', Math.round((stress - a.stress) * share), 'senior.drift'));
    if (!id) continue;
    const m = sim.people[id]!;
    effects.push(
      // A month that serves their want is tagged as serving it, so the simulation counts the want as served.
      served(m.want, oversight, s.habits, a.stress)
        ? { type: 'value', target: { kind: 'person', id }, field: 'motivation', amount: T.wantServed, cause: rule('senior.drift'), wantTags: { serves: [m.want] } }
        : person(id, 'motivation', T.wantUnserved, 'senior.drift'),
      person(id, 'stress', Math.round((a.stress - m.stress) * T.managerStressShare), 'senior.drift'),
    );
  }
  return effects;
}

/** Each manager rated on how their team delivered and fared under them; a third low rating on a plan waits for the player's final evaluation. */
function managerRatings(s: SeniorState, sim: SimState): Effect[] {
  const ratings: Effect[] = [];
  for (const t of s.teamIds) {
    const id = leadOf(s, sim, t);
    if (!id) continue;
    const a = sim.teams[t]!.aggregate!;
    const step = Math.round(meanStep(deliveredRatings(sim, t))) - (band(a.stress) >= 3 || band(a.motivation) <= 1 ? 1 : 0);
    const rating = RATINGS[Math.max(0, Math.min(4, step))]!;
    if ((rating === 'below' || rating === 'partial') && planOf(sim, { kind: 'person', id }) === 'pip') {
      if (!s.heldEvaluations.includes(id)) s.heldEvaluations.push(id);
    } else ratings.push({ type: 'rate', target: { kind: 'person', id }, rating, cause: rule('senior.managerRating') });
  }
  return ratings;
}

/** Under the habit, new work for idle teams with room, unless the player had it as a moment this month. */
// @spec SENIOR-MOMENT-013
function assignNewWork(s: SeniorState, sim0: SimState, log: ChangeLogEntry[]): { sim: SimState; assigned: { teamId: string; name: string; project: string }[] } {
  let sim = sim0;
  const assigned: { teamId: string; name: string; project: string }[] = [];
  if (s.habits.newWork !== 'assign' || s.moments.some((x) => x.kind === 'newWork')) return { sim, assigned };
  for (const t of s.teamIds) {
    const idle = !Object.values(sim.projects).some((p) => p.teamId === t && p.status === 'active');
    if (!idle || band(sim.teams[t]!.aggregate!.stress) >= T.strainedBand) continue;
    const project = { id: nextId(s, 'project', 'pr', sim.projects), name: unusedName(s, NAMES.projects, Object.values(sim.projects).map((p) => p.name)), teamId: t, scope: randomInt(s, 80, 140), risk: randomInt(s, 10, 40), techDebt: randomInt(s, 10, 40), deadlineWeek: sim.week + randomInt(s, 20, 32) };
    sim = apply(sim, [{ type: 'startProject', project, cause: rule('senior.assigned') }], log);
    assigned.push({ teamId: t, name: sim.teams[t]!.name, project: project.name });
  }
  return { sim, assigned };
}

/**
 * Ends the month: the habits act, lost heads are backfilled, skip-level listening is held, and each team and its manager
 * move toward what the manager can sustain.
 */
// @spec SENIOR-HABIT-004, SENIOR-HABIT-005, SENIOR-HABIT-006, SENIOR-HABIT-007, SENIOR-HABIT-008, SENIOR-DRIFT-001, SENIOR-DRIFT-002, SENIOR-DRIFT-003, SENIOR-MOMENT-011
// @spec SENIOR-CAL-005, SENIOR-PLAN-001, SENIOR-PLAN-002, SENIOR-GOAL-001, SENIOR-RECAP-001
export function endMonth(level: SeniorState, sim0: SimState): Result<{ level: SeniorState; sim: SimState; log: ChangeLogEntry[]; recap: unknown }> {
  const begun = structuredClone(level);
  const log: ChangeLogEntry[] = [];
  const start = begun.monthStart ?? snapshotMonth(begun, sim0);
  // A new review period starts with this month: remember where it started from, and set its goals.
  if (sim0.week > begun.periodStart.week && (sim0.week - begun.startWeek) % (T.reviewEveryMonths * T.weeksPerMonth) === 0) {
    begun.periodStart = periodSnapshot(begun, sim0);
    setGoals(begun, sim0);
  }
  const settled = settleCalibration(begun, sim0, log);
  if (!settled.ok) return settled;
  const s = settled.level;
  let sim = settled.sim;
  // A final evaluation left unanswered gives the manager one more period.
  for (const x of s.moments) if (x.kind === 'finalEvaluation' && x.status === 'open') s.heldEvaluations = s.heldEvaluations.filter((id) => id !== x.managerId);
  // Moments left unanswered are let wait.
  s.moments = s.moments.map((x) => (x.status === 'open' ? { ...x, status: 'waited' as const } : x));
  const managers = s.teamIds.map((t) => ({ teamId: t, id: leadOf(s, sim, t) }));
  const trustBefore = Object.fromEntries(managers.flatMap((m) => (m.id ? [[m.id, sim.people[m.id]!.trust]] : [])));
  // In this order: backfills draw ids from the level's counters, and the effects apply as one batch.
  sim = apply(sim, [...oversightEffects(s, sim, managers), ...skipLevelEffects(s, sim, trustBefore), ...backfillEffects(s, sim), ...driftEffects(s, sim, managers)], log);
  // Attrition risk follows the team's health.
  sim = apply(
    sim,
    s.teamIds.map((t) => {
      const a = sim.teams[t]!.aggregate!;
      return team(t, 'attritionRisk', attritionRiskOf(a.motivation, a.stress) - a.attritionRisk, 'senior.drift');
    }),
    log,
  );
  if (periodEndsThisMonth(s, sim)) sim = apply(sim, managerRatings(s, sim), log);
  const work = assignNewWork(s, sim, log);
  sim = work.sim;
  remember(s, sim);
  const recap = monthRecap(s, sim, start);
  recap.changes.assigned = work.assigned;
  s.monthStart = null;
  return { ok: true, level: s, sim, log, recap };
}
