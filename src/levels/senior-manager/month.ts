import { band } from '../line-manager';
import { applyEffects, attritionRiskOf, type ChangeLogEntry, type Effect, type SimState } from '../../sim';
import { leadOf, managerOf, nextId, rule } from './core';
import { periodSnapshot, remember } from './review';
import { SENIOR_TUNING } from './tuning';
import type { Oversight, SeniorHabits, SeniorState } from './types';

const T = SENIOR_TUNING;
const OVERSIGHT: readonly Oversight[] = ['handsOff', 'coaching', 'close'];
const OPTIONS = { oneOnOnes: ['weekly', 'fortnightly', 'monthly'], backfill: ['fast', 'holdTheBar'], skipLevel: ['none', 'monthly'] } as const;
const ONE_ON_ONES_A_MONTH = { weekly: 4, fortnightly: 2, monthly: 1 } as const;

export type SeniorHabitCommand =
  | { habit: 'oversight'; managerId: string; value: Oversight }
  | { habit: 'oneOnOnes'; value: SeniorHabits['oneOnOnes'] }
  | { habit: 'backfill'; value: SeniorHabits['backfill'] }
  | { habit: 'skipLevel'; value: SeniorHabits['skipLevel'] };

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
  if (c.habit === 'oneOnOnes' || c.habit === 'backfill' || c.habit === 'skipLevel') {
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

/**
 * Ends the month: the habits act, lost heads are backfilled, skip-level listening is held, and each team and its manager
 * move toward what the manager can sustain.
 */
// @spec SENIOR-HABIT-004, SENIOR-HABIT-005, SENIOR-HABIT-006, SENIOR-HABIT-007, SENIOR-HABIT-008, SENIOR-DRIFT-001, SENIOR-DRIFT-002, SENIOR-DRIFT-003, SENIOR-MOMENT-011
export function endMonth(level: SeniorState, sim0: SimState): Result<{ level: SeniorState; sim: SimState; log: ChangeLogEntry[]; recap: unknown }> {
  const s = structuredClone(level);
  const log: ChangeLogEntry[] = [];
  let sim = sim0;
  // A new review period starts with this month: remember where it started from.
  if (sim.week > s.periodStart.week && (sim.week - s.startWeek) % (T.reviewEveryMonths * T.weeksPerMonth) === 0) s.periodStart = periodSnapshot(s, sim);

  const effects: Effect[] = [];
  // Moments left unanswered are let wait.
  s.moments = s.moments.map((x) => (x.status === 'open' ? { ...x, status: 'waited' as const } : x));
  const managers = s.teamIds.map((t) => ({ teamId: t, id: leadOf(s, sim, t) }));
  const trustBefore = Object.fromEntries(managers.flatMap((m) => (m.id ? [[m.id, sim.people[m.id]!.trust]] : [])));

  // Oversight and 1:1s.
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

  // Skip-level listening.
  s.listenedTo = [];
  s.surfaced = [];
  if (s.habits.skipLevel === 'monthly' && s.teamIds.length) {
    const t = s.teamIds[s.skipRotation % s.teamIds.length]!;
    s.skipRotation += 1;
    s.listenedTo = [t];
    s.surfaced = [{ teamId: t, week: sim.week }];
    effects.push(player(T.skipLevelEnergy, 'senior.skipLevel'));
    const m = leadOf(s, sim, t);
    if (m && trustBefore[m]! < T.skipLevelTrustBelow) effects.push(person(m, 'trust', -T.skipLevelTrust, 'senior.skipLevel'));
  }

  // Lost heads: noticed, kept stressing the team while missing, and backfilled when the policy's months are up.
  for (const t of s.teamIds) {
    const a = sim.teams[t]!.aggregate!;
    for (let lost = (s.knownHeadcount[t] ?? a.headcount) - a.headcount; lost > 0; lost--) s.backfills.push({ teamId: t, since: sim.week, months: 0 });
  }
  const due = T.backfillMonths[s.habits.backfill];
  const stillMissing = [];
  for (const b of s.backfills) {
    b.months += 1;
    effects.push(team(b.teamId, 'stress', T.backfillGapStress, 'senior.backfill'));
    if (b.months >= due && sim.teams[b.teamId]) {
      s.counters.hire += 1;
      effects.push({
        type: 'hire',
        teamId: b.teamId,
        person: { id: nextId(s, 'hire', 'h', sim.people), name: 'New hire', role: 'engineer', skill: 50, motivation: 60, stress: 30, trust: 50, want: 'growth' },
        cause: rule('senior.backfill'),
      });
      if (s.habits.backfill === 'fast') effects.push(team(b.teamId, 'skill', -T.fastBackfillSkill, 'senior.backfill'));
    } else stillMissing.push(b);
  }
  s.backfills = stillMissing;

  // Teams drift toward what their managers sustain; managers toward their wants and their teams.
  for (const { teamId, id } of managers) {
    const a = sim.teams[teamId]!.aggregate!;
    const skill = id ? sim.people[id]!.skill : T.leaderlessSkill;
    const oversight = id ? (s.habits.oversight[id] ?? 'coaching') : 'handsOff';
    const share = T.driftShare * (oversight === 'handsOff' && band(skill) < 2 ? T.handsOffDrift : 1);
    const motivation = T.sustains.motivationBase + skill * T.sustains.motivationPerSkill;
    const stress = T.sustains.stressBase - skill * T.sustains.stressPerSkill;
    effects.push(team(teamId, 'motivation', Math.round((motivation - a.motivation) * share), 'senior.drift'), team(teamId, 'stress', Math.round((stress - a.stress) * share), 'senior.drift'));
    if (id) {
      const m = sim.people[id]!;
      effects.push(
        person(id, 'motivation', served(m.want, oversight, s.habits, a.stress) ? T.wantServed : T.wantUnserved, 'senior.drift'),
        person(id, 'stress', Math.round((a.stress - m.stress) * T.managerStressShare), 'senior.drift'),
      );
    }
  }
  sim = apply(sim, effects, log);

  // Attrition risk follows the team's health.
  sim = apply(
    sim,
    s.teamIds.map((t) => {
      const a = sim.teams[t]!.aggregate!;
      return team(t, 'attritionRisk', attritionRiskOf(a.motivation, a.stress) - a.attritionRisk, 'senior.drift');
    }),
    log,
  );
  remember(s, sim);
  return { ok: true, level: s, sim, log, recap: {} };
}
