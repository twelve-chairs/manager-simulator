import { describe, expect, it } from 'vitest';
import { ACTIONS, LINE_TUNING, arriveDemands, commitWeek, lineManagerLevel, view, type LinePlan } from '../../../src/levels/line-manager';
import { centeredRun, engineers, only, projects, run, teamOf, withDemand } from './fixtures';

const L = lineManagerLevel;

describe('the turn loop contract', () => {
  // @spec LINE-CONTRACT-001
  it('begins weeks with arrivals, edits the calendar at once and commits the plan’s decisions', () => {
    const start = L.start(4);
    expect(start).toEqual(run(4));
    expect(L.params).toEqual({ id: 'line-manager', weeksPerStep: 1, situationLimit: 2, reviewEveryWeeks: 13 });
    const { sim } = start;
    expect(L.beginWeek(start.level, sim)).toEqual(arriveDemands(start.level, sim));

    const e = engineers(sim)[0]!;
    const edited = L.updatePlan(start.level, sim, L.emptyPlan(), {
      kind: 'calendar',
      add: [{ action: 'line-manager.recognition', target: { kind: 'person', id: e }, cadence: 'once' }],
    });
    if (!edited.ok) throw new Error(edited.error);
    expect(edited.level.calendar).toHaveLength(start.level.calendar.length + 1);
    expect(edited.plan).toEqual(L.emptyPlan());

    const { level, id } = withDemand(edited.level, { type: 'approval', subject: { kind: 'project', id: projects(sim)[0]! }, lastWeek: 3 });
    const decided = L.updatePlan(level, sim, edited.plan, { kind: 'decide', demandId: id, decision: { kind: 'handle' } });
    if (!decided.ok) throw new Error(decided.error);
    expect(decided.level).toEqual(level);
    expect(decided.plan).toEqual({ decisions: { [id]: { kind: 'handle' } } });

    const viaContract = L.commit(level, sim, decided.plan);
    expect(viaContract).toEqual(commitWeek(level, sim, { [id]: { kind: 'handle' } }));
  });

  // @spec LINE-CONTRACT-002
  it('checks a decision when it enters the plan', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const base = only(level, sim);
    const expense = withDemand(base, { type: 'expense', subject: { kind: 'person', id: e }, lastWeek: 2 });
    const intake = withDemand(expense.level, { type: 'workIntake', subject: { kind: 'team', id: teamOf(sim) }, lastWeek: 2 });
    const plan: LinePlan = { decisions: {} };
    const bad = [
      { demandId: 'missing', decision: { kind: 'handle' as const } },
      { demandId: expense.id, decision: { kind: 'accept' as const } },
      { demandId: intake.id, decision: { kind: 'handle' as const } },
      { demandId: intake.id, decision: { kind: 'delegate' as const, to: e } },
      { demandId: expense.id, decision: { kind: 'delegate' as const, to: e } },
      { demandId: expense.id, decision: { kind: 'delegate' as const, to: 'nobody' } },
    ];
    for (const b of bad) {
      const result = L.updatePlan(intake.level, sim, plan, { kind: 'decide', ...b });
      expect(result.ok).toBe(false);
    }
    expect(plan).toEqual({ decisions: {} });
    expect(L.updatePlan(intake.level, sim, plan, { kind: 'decide', demandId: intake.id, decision: { kind: 'accept' } }).ok).toBe(true);

    // commands can come back from a saved run: malformed ones are rejected, never thrown
    const malformed = [null, 42, { kind: 'bogus' }, { kind: 'decide', demandId: expense.id, decision: null }, { kind: 'decide', demandId: expense.id, decision: { kind: 'delegate' } }];
    for (const command of malformed) expect(L.updatePlan(intake.level, sim, plan, command as never).ok).toBe(false);
  });

  // @spec LINE-CONTRACT-004
  it('rejects calendar commands of the wrong shape, as a saved run could hold', () => {
    const { level, sim } = run(1);
    const before = structuredClone(level);
    for (const command of [
      { kind: 'calendar', add: 5 },
      { kind: 'calendar', add: 'line-manager.coaching' },
      { kind: 'calendar', add: [null] },
      { kind: 'calendar', add: [7] },
      { kind: 'calendar', remove: 'c1' },
      { kind: 'calendar', remove: [{}] },
      { kind: 'calendar', remove: [3] },
    ]) {
      let result: ReturnType<typeof L.updatePlan> | undefined;
      expect(() => (result = L.updatePlan(level, sim, L.emptyPlan(), command as never))).not.toThrow();
      expect(result!.ok).toBe(false);
    }
    expect(level).toEqual(before);
  });

  // @spec LINE-CONTRACT-003
  it('clears a decision, leaving the demand undecided', () => {
    const { level, sim } = centeredRun(1);
    const { level: l, id } = withDemand(only(level, sim), { type: 'approval', subject: { kind: 'project', id: projects(sim)[0]! }, lastWeek: 2 });
    const decided = L.updatePlan(l, sim, L.emptyPlan(), { kind: 'decide', demandId: id, decision: { kind: 'handle' } });
    if (!decided.ok) throw new Error(decided.error);
    const cleared = L.updatePlan(l, sim, decided.plan, { kind: 'clear', demandId: id });
    if (!cleared.ok) throw new Error(cleared.error);
    expect(cleared.plan).toEqual(L.emptyPlan());
  });
});

describe('planned hours', () => {
  // @spec LINE-VIS-010
  it('shows this week’s planned hours and overtime from the calendar and the plan', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const coaching = { action: 'line-manager.coaching' as const, target: { kind: 'person' as const, id: e } };
    let l = only(level, sim, { ...coaching, cadence: 'weekly' }, { ...coaching, cadence: 'biweekly', startWeek: 1 });
    const demand = withDemand(l, { type: 'designReview', subject: { kind: 'project', id: projects(sim)[0]! }, hours: 3, lastWeek: 2 });
    l = demand.level;
    const plan: LinePlan = { decisions: { [demand.id]: { kind: 'handle' } } };
    const v = view(l, sim, plan);
    expect(v.plannedHours).toBe(ACTIONS['line-manager.coaching'].hours + 3);
    expect(v.overtime).toBe(0);
    expect(view(l, sim).plannedHours).toBe(ACTIONS['line-manager.coaching'].hours);

    const many = Math.ceil(LINE_TUNING.weeklyHours / ACTIONS['line-manager.coaching'].hours) + 1;
    const busy = only(level, sim, ...Array.from({ length: many }, () => ({ ...coaching, cadence: 'once' as const })));
    const hours = many * ACTIONS['line-manager.coaching'].hours;
    expect(view(busy, sim).overtime).toBe(hours - LINE_TUNING.weeklyHours);

    // the preview is exactly what the week charges, even after someone leaves and a vacancy opens mid-week
    const gone = { ...sim, people: { ...sim.people, [e]: { ...sim.people[e]!, status: 'departed' as const } } };
    const committed = commitWeek(l, gone, plan.decisions);
    if (!committed.ok) throw new Error(committed.error);
    expect(view(l, gone, plan).plannedHours).toBe(committed.report.hours);
  });
});
