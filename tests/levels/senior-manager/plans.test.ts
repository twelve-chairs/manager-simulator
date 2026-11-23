import { describe, expect, it } from 'vitest';
import { SENIOR_TUNING, beginMonth, chooseSenior, endMonth, seniorView, type SeniorState } from '../../../src/levels/senior-manager';
import { applyEffects, planOf, type SimState } from '../../../src/sim';
import { senior } from './fixtures';

const T = SENIOR_TUNING;
const leader = (sim: SimState, teamId: string) => (sim.teams[teamId]!.leader as { id: string }).id;
const edit = (sim: SimState, change: (s: SimState) => void) => {
  const copy = structuredClone(sim);
  change(copy);
  return copy;
};
function ended(level: SeniorState, sim: SimState) {
  const r = endMonth(level, sim);
  if (!r.ok) throw new Error(r.error);
  return r;
}
/** The last month of the review period that ends `periods` periods into the level. */
const periodEnd = (level: SeniorState, sim: SimState, periods = 1) => edit(sim, (s) => (s.week = level.startWeek + periods * 24 - 4));
const struggling = (sim: SimState, teamId: string) => edit(sim, (s) => Object.assign(s.teams[teamId]!.aggregate!, { skill: 15, motivation: 15, stress: 85 }));
const thriving = (sim: SimState, teamId: string) => edit(sim, (s) => Object.assign(s.teams[teamId]!.aggregate!, { skill: 85, motivation: 85, stress: 15 }));
const lowRatings = (sim: SimState, id: string, n: number) => {
  let s = sim;
  for (let i = 0; i < n; i++) {
    const r = applyEffects(s, [{ type: 'rate', target: { kind: 'person', id }, rating: 'partial', cause: { kind: 'rule', ruleId: 'test' } }]);
    if (!r.ok) throw new Error(r.error.message);
    s = r.state;
  }
  return s;
};

describe('managers’ ratings and plans', () => {
  // @spec SENIOR-PLAN-001
  it('rates each manager at the period’s end on their team’s delivery and health', () => {
    const { level, sim } = senior(1);
    const [a, b] = level.teamIds;
    const s = thriving(struggling(periodEnd(level, sim), a!), b!);
    const r = ended(level, s);
    expect(['below', 'partial']).toContain(r.sim.people[leader(s, a!)]!.performance);
    expect(['meets', 'exceeds', 'outstanding']).toContain(r.sim.people[leader(s, b!)]!.performance);
    // no rating in a month that doesn't end a period
    const mid = ended(level, edit(sim, (x) => (x.week = level.startWeek + 8)));
    for (const t of level.teamIds) expect(mid.sim.people[leader(sim, t)]!.performance).toBe('unrated');
  });

  // @spec SENIOR-PLAN-002
  it('puts a manager low twice on a plan, and holds the third low rating for a final evaluation', () => {
    const { level, sim } = senior(2);
    const t = level.teamIds[1]!;
    const m = leader(sim, t);
    const first = ended(level, struggling(periodEnd(level, sim, 1), t));
    const second = ended(first.level, struggling(periodEnd(level, first.sim, 2), t));
    expect(planOf(second.sim, { kind: 'person', id: m })).toBe('pip');
    const third = ended(second.level, struggling(periodEnd(level, second.sim, 3), t));
    expect(third.sim.people[m]!.status).toBe('active');
    expect(third.level.heldEvaluations).toContain(m);
    const next = beginMonth(third.level, edit(third.sim, (x) => (x.week += 4)));
    expect(next.moments[0]).toMatchObject({ kind: 'finalEvaluation', teamId: t });
    expect(next.moments[0]!.choices.map((c) => c.id)).toEqual(['letGo', 'oneMorePeriod']);
  });

  // @spec SENIOR-PLAN-003
  it('lets a manager go, leaving the team leaderless, and offers next month to promote from the team or hire', () => {
    const { level, sim } = senior(3);
    const t = level.teamIds[2]!;
    const m = leader(sim, t);
    const held = { ...level, heldEvaluations: [m] };
    const onPlan = lowRatings(sim, m, 2);
    const l = beginMonth(held, onPlan);
    const fe = l.moments.find((x) => x.kind === 'finalEvaluation')!;
    const gone = chooseSenior(l, onPlan, fe.id, 'letGo');
    if (!gone.ok) throw new Error(gone.error);
    expect(gone.sim.people[m]!.status).toBe('departed');
    expect(seniorView(gone.level, gone.sim).teams.find((x) => x.id === t)!.managerId).toBeNull();
    const month = ended(gone.level, gone.sim);
    const later = edit(month.sim, (x) => (x.week += 4));
    const nl = beginMonth(month.level, later);
    const replace = nl.moments.find((x) => x.kind === 'replaceManager')!;
    expect(replace).toMatchObject({ teamId: t });
    expect(replace.choices.map((c) => c.id)).toEqual(['promoteFromTeam', 'hire']);
    const promoted = chooseSenior(nl, later, replace.id, 'promoteFromTeam');
    if (!promoted.ok) throw new Error(promoted.error);
    const a = later.teams[t]!.aggregate!;
    expect(promoted.sim.teams[t]!.aggregate!).toMatchObject({ headcount: a.headcount - 1, skill: a.skill - T.restructureSkill });
    expect(seniorView(promoted.level, promoted.sim).teams.find((x) => x.id === t)!.managerId).not.toBeNull();
    const hired = chooseSenior(nl, later, replace.id, 'hire');
    if (!hired.ok) throw new Error(hired.error);
    expect(hired.sim.teams[t]!.aggregate!.headcount).toBe(a.headcount);
    expect(seniorView(hired.level, hired.sim).teams.find((x) => x.id === t)!.managerId).toBeNull();
    // one more period keeps the manager, still on their plan
    const kept = chooseSenior(l, onPlan, fe.id, 'oneMorePeriod');
    if (!kept.ok) throw new Error(kept.error);
    expect(kept.sim.people[m]!.status).toBe('active');
    expect(kept.level.heldEvaluations).not.toContain(m);
  });
});

describe('the order of a month’s moments', () => {
  // @spec SENIOR-MOMENT-001
  it('puts final evaluations, replacements and calibration first, then the rest in their order, up to the cap', () => {
    const ORDER = ['finalEvaluation', 'replaceManager', 'calibration', 'surfaced', 'escalation', 'staffing', 'dispute', 'approval', 'newWork', 'restructuring'];
    const { level, sim } = senior(4);
    const [a, b, c] = level.teamIds;
    const m = leader(sim, a!);
    const s = edit(sim, (x) => {
      x.week = level.startWeek + 20;
      x.teams[b!]!.aggregate!.stress = 85;
      x.teams[c!]!.aggregate!.stress = 10;
    });
    const l = beginMonth({ ...level, heldEvaluations: [m], surfaced: [{ teamId: c!, week: s.week - 4 }] }, s);
    const kinds = l.moments.map((x) => x.kind);
    expect(kinds.slice(0, 3)).toEqual(['finalEvaluation', 'calibration', 'surfaced']);
    const at = kinds.map((k) => ORDER.indexOf(k));
    expect(at).toEqual([...at].sort((x, y) => x - y));
    expect(kinds.length).toBeLessThanOrEqual(T.momentCap);
  });
});
