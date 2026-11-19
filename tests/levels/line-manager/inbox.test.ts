import { describe, expect, it } from 'vitest';
import { DEMAND_TYPES, NAMES, arriveDemands, commitWeek, type Demand, type DemandType } from '../../../src/levels/line-manager';
import type { SimState } from '../../../src/sim';
import { centeredRun, commit, engineers, expectRejected, only, patch, projects, run, seeds, teamOf, withDemand } from './fixtures';

/** Average number of demands of a type arriving in one week, over many seeds, for a state shaped by `shape`. */
function arrivals(type: DemandType, shape: (s: SimState) => void, n = 100): number {
  let total = 0;
  for (const seed of seeds(n)) {
    const { level, sim } = run(seed);
    const shaped = patch(sim, shape);
    total += arriveDemands(level, shaped).inbox.filter((d) => d.type === type).length;
  }
  return total / n;
}

/** A centered run with a single demand in the inbox and an empty calendar. */
function oneDemand(make: (sim: SimState) => Partial<Demand> & Pick<Demand, 'type' | 'subject'>) {
  const { level, sim } = centeredRun(1);
  const { level: l, id } = withDemand(only(level, sim), make(sim));
  return { level: l, sim, id };
}

const projectSubject = (sim: SimState) => ({ kind: 'project' as const, id: projects(sim)[0]! });

describe('arrivals', () => {
  // @spec LINE-INBOX-001
  it('brings more on-call escalations to riskier projects', () => {
    const calm = arrivals('onCall', (s) => Object.values(s.projects).forEach((p) => Object.assign(p, { risk: 5, techDebt: 5 })));
    const risky = arrivals('onCall', (s) => Object.values(s.projects).forEach((p) => Object.assign(p, { risk: 95, techDebt: 95 })));
    expect(risky).toBeGreaterThan(calm);
  });

  // @spec LINE-INBOX-001
  it('brings project demands only with active projects, and requests only with engineers', () => {
    const none = (s: SimState) => Object.values(s.projects).forEach((p) => (p.status = 'completed'));
    for (const type of ['approval', 'designReview', 'customerRequest', 'onCall'] as const) {
      expect(arrivals(type, none, 30)).toBe(0);
      expect(arrivals(type, () => {}, 100)).toBeGreaterThan(0);
    }
    expect(arrivals('expense', (s) => Object.values(s.people).forEach((p) => (p.status = 'departed')), 30)).toBe(0);
    expect(arrivals('expense', () => {}, 100)).toBeGreaterThan(0);
  });

  // @spec LINE-INBOX-001
  it('draws from the level generator and leaves the simulation untouched', () => {
    const { level, sim } = run(4);
    const before = structuredClone(sim);
    const arrived = arriveDemands(level, sim);
    expect(sim).toEqual(before);
    expect(arrived.rngState).not.toBe(level.rngState);
    expect(arriveDemands(level, sim)).toEqual(arrived);
  });

  // @spec LINE-INBOX-002
  it('brings work intake while the team has fewer than two active projects', () => {
    const { level, sim } = run(1);
    const intake = (l: typeof level, s: SimState) => arriveDemands(l, s).inbox.filter((d) => d.type === 'workIntake');
    expect(intake(level, sim)).toEqual([]);
    const one = patch(sim, (s) => (s.projects[projects(sim)[0]!]!.status = 'completed'));
    expect(intake(level, one)).toMatchObject([{ subject: { kind: 'team', id: teamOf(sim) } }]);
    const already = withDemand(level, { type: 'workIntake', subject: { kind: 'team', id: teamOf(sim) }, lastWeek: 2 }).level;
    expect(intake(already, one)).toHaveLength(1);
  });

  // @spec LINE-INBOX-003
  it('gives demands unique ids, their fields and a last week from the type', () => {
    expect(Object.fromEntries(Object.entries(DEMAND_TYPES).map(([t, d]) => [t, d.expiryWeeks]))).toEqual({
      approval: 1,
      designReview: 2,
      customerRequest: 2,
      onCall: 0,
      expense: 2,
      workIntake: 2,
    });
    const ids: string[] = [];
    for (const seed of seeds(20)) {
      let { level, sim } = run(seed);
      sim = patch(sim, (s) => (s.week = 3));
      level = arriveDemands(arriveDemands(level, sim), sim);
      for (const d of level.inbox) {
        expect(d).toMatchObject({ type: expect.any(String), hours: DEMAND_TYPES[d.type].hours, arrivedWeek: 3, lastWeek: 3 + DEMAND_TYPES[d.type].expiryWeeks });
        expect(d.difficulty).toBeGreaterThanOrEqual(0);
        expect(d.difficulty).toBeLessThanOrEqual(100);
        ids.push(`${seed}:${d.id}`);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('deciding demands', () => {
  // @spec LINE-INBOX-004
  it('handles a demand: charges its hours and removes it without consequence', () => {
    const { level, sim, id } = oneDemand((s) => ({ type: 'customerRequest', subject: projectSubject(s), hours: 2, lastWeek: 0 }));
    const handled = commit(level, sim, { [id]: { kind: 'handle' } });
    expect(handled.report.hours).toBe(2);
    expect(handled.level.inbox).toEqual([]);
    expect(handled.sim.player.reputation).toBe(sim.player.reputation);
  });

  // @spec LINE-INBOX-005, LINE-ACT-012
  it('delegates a demand: no hours, delegate stress up, wants served, recorded in history', () => {
    const { level: l, sim, id } = oneDemand((s) => ({ type: 'approval', subject: projectSubject(s), difficulty: 10 }));
    const e = engineers(sim)[0]!;
    for (const want of ['growth', 'autonomy'] as const) {
      const s = patch(sim, (st) => (st.people[e]!.want = want));
      const c = commit(l, s, { [id]: { kind: 'delegate', to: e } });
      expect(c.report.hours).toBe(0);
      expect(c.level.inbox).toEqual([]);
      expect(c.sim.people[e]!.stress).toBeGreaterThan(s.people[e]!.stress);
      expect(c.sim.people[e]!.wantServedWeek).toBe(s.week);
      expect(c.sim.people[e]!.history.some((h) => h.cause.kind === 'action' && h.cause.actionId === 'line-manager.delegate')).toBe(true);
      expect(c.report.delegations).toEqual([{ demandId: id, to: e, succeeded: true }]);
    }
  });

  // @spec LINE-INBOX-006
  it('applies a reduced consequence and grows the delegate when the demand is too hard', () => {
    const { level: l, sim, id } = oneDemand((s) => ({ type: 'designReview', subject: projectSubject(s), difficulty: 90, lastWeek: 0 }));
    const p = projects(sim)[0]!;
    const e = engineers(sim)[0]!; // centered: skill 50
    const hard = commit(l, sim, { [id]: { kind: 'delegate', to: e } });
    const left = commit(l, sim);
    const easy = commit({ ...l, inbox: l.inbox.map((d) => ({ ...d, difficulty: 40 })) }, sim, { [id]: { kind: 'delegate', to: e } });
    expect(hard.report.delegations[0]!.succeeded).toBe(false);
    expect(hard.sim.projects[p]!.techDebt).toBeGreaterThan(easy.sim.projects[p]!.techDebt);
    expect(hard.sim.projects[p]!.techDebt).toBeLessThan(left.sim.projects[p]!.techDebt);
    expect(hard.sim.people[e]!.skill).toBeGreaterThan(sim.people[e]!.skill);
    expect(easy.report.delegations[0]!.succeeded).toBe(true);
    expect(easy.sim.projects[p]!.techDebt).toBe(sim.projects[p]!.techDebt);
  });

  // @spec LINE-INBOX-007
  it('raises a delegate’s stress once per demand delegated to them', () => {
    const { level, sim } = centeredRun(1);
    const subject = projectSubject(sim);
    let l = only(level, sim);
    const a = withDemand(l, { type: 'approval', subject, difficulty: 10, lastWeek: 3 });
    const b = withDemand(a.level, { type: 'approval', subject, difficulty: 10, lastWeek: 3 });
    l = b.level;
    const e = engineers(sim)[0]!;
    const one = commit(l, sim, { [a.id]: { kind: 'delegate', to: e } }).sim.people[e]!.stress - sim.people[e]!.stress;
    const two = commit(l, sim, { [a.id]: { kind: 'delegate', to: e }, [b.id]: { kind: 'delegate', to: e } }).sim.people[e]!.stress - sim.people[e]!.stress;
    expect(one).toBeGreaterThan(0);
    expect(two).toBe(2 * one);
  });

  // @spec LINE-INBOX-008
  it('rejects delegating to nobody, to the requester, or delegating work intake', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const base = only(level, sim);
    const expense = withDemand(base, { type: 'expense', subject: { kind: 'person', id: e }, lastWeek: 2 });
    const intake = withDemand(base, { type: 'workIntake', subject: { kind: 'team', id: teamOf(sim) }, lastWeek: 2 });
    const approval = withDemand(base, { type: 'approval', subject: projectSubject(sim), lastWeek: 2 });
    const cases = [
      { level: approval.level, decisions: { [approval.id]: { kind: 'delegate' as const, to: 'nobody' } } },
      { level: expense.level, decisions: { [expense.id]: { kind: 'delegate' as const, to: e } } },
      { level: intake.level, decisions: { [intake.id]: { kind: 'delegate' as const, to: e } } },
    ];
    for (const c of cases) {
      const before = structuredClone({ level: c.level, sim });
      expectRejected(commitWeek(c.level, sim, c.decisions), c.level, sim, before.level, before.sim);
    }
  });

  // @spec LINE-INBOX-014
  it('leaves a demand undecided when its delegate is no longer on the team', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const { level: l, id } = withDemand(only(level, sim), { type: 'approval', subject: projectSubject(sim), lastWeek: 2 });
    const gone = patch(sim, (s) => (s.people[e]!.status = 'departed'));
    const c = commit(l, gone, { [id]: { kind: 'delegate', to: e } });
    expect(c.level.inbox.map((d) => d.id)).toEqual([id]);
    expect(c.report.undelegated).toEqual([{ demandId: id, reason: expect.stringMatching(/no longer/) }]);
  });

  // @spec LINE-INBOX-015
  it('gives an undone delegation one more week instead of expiring it', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const { level: l, id } = withDemand(only(level, sim), { type: 'onCall', subject: projectSubject(sim), lastWeek: sim.week });
    const gone = patch(sim, (s) => (s.people[e]!.status = 'departed'));
    const c = commit(l, gone, { [id]: { kind: 'delegate', to: e } });
    expect(c.level.inbox).toMatchObject([{ id, lastWeek: sim.week + 1 }]);
    expect(c.report.expired).toEqual([]);
    expect(c.sim.player.reputation).toBe(gone.player.reputation);
  });

  // @spec LINE-INBOX-016
  it('reports a decision on a demand whose subject is gone as void', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const { level: l, id } = withDemand(only(level, sim), { type: 'expense', subject: { kind: 'person', id: e }, hours: 1, lastWeek: 2 });
    const gone = patch(sim, (s) => (s.people[e]!.status = 'departed'));
    const c = commit(l, gone, { [id]: { kind: 'handle' } });
    expect(c.report.hours).toBe(0);
    expect(c.report.voided).toEqual([{ demandId: id, reason: expect.stringMatching(/no longer/) }]);
    expect(c.level.inbox).toEqual([]);
  });

  // @spec LINE-INBOX-009
  it('expires undecided demands in their last week, applying their consequence', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const p = projects(sim)[0]!;
    const project = { kind: 'project' as const, id: p };
    const expect1 = (type: DemandType, subject: Demand['subject'], check: (before: SimState, after: SimState) => void) => {
      const { level: l, id } = withDemand(only(level, sim), { type, subject, lastWeek: sim.week });
      const c = commit(l, sim);
      expect(c.level.inbox).toEqual([]);
      expect(c.report.expired).toEqual([id]);
      expect(c.log.some((x) => x.cause.kind === 'rule')).toBe(true);
      check(sim, c.sim);
    };
    const withProgress = patch(sim, (s) => (s.projects[p]!.progress = 20));
    const { level: al, id: aid } = withDemand(only(level, withProgress), { type: 'approval', subject: project, lastWeek: 0 });
    expect(commit(al, withProgress).sim.projects[p]!.progress).toBeLessThan(20);
    expect(commit(al, withProgress).report.expired).toEqual([aid]);
    expect1('designReview', project, (b, a) => expect(a.projects[p]!.techDebt).toBeGreaterThan(b.projects[p]!.techDebt));
    expect1('customerRequest', project, (b, a) => expect(a.player.reputation).toBeLessThan(b.player.reputation));
    expect1('onCall', project, (b, a) => {
      expect(a.player.reputation).toBeLessThan(b.player.reputation);
      expect(a.projects[p]!.risk).toBeGreaterThan(b.projects[p]!.risk);
    });
    expect1('expense', { kind: 'person', id: e }, (b, a) => expect(a.people[e]!.motivation).toBeLessThan(b.people[e]!.motivation));
    expect1('workIntake', { kind: 'team', id: teamOf(sim) }, (b, a) => expect(a.player.reputation).toBeLessThan(b.player.reputation));

    const { level: later } = withDemand(only(level, sim), { type: 'designReview', subject: project, lastWeek: sim.week + 1 });
    expect(commit(later, sim).level.inbox).toHaveLength(1);
  });

  // @spec LINE-INBOX-010
  it('removes demands whose subject is gone, without consequence', () => {
    const { level, sim } = centeredRun(1);
    const p = projects(sim)[0]!;
    const e = engineers(sim)[0]!;
    const a = withDemand(only(level, sim), { type: 'customerRequest', subject: { kind: 'project', id: p }, lastWeek: 0 });
    const b = withDemand(a.level, { type: 'expense', subject: { kind: 'person', id: e }, lastWeek: 0 });
    const changed = patch(sim, (s) => {
      s.projects[p]!.status = 'cancelled';
      s.people[e]!.status = 'departed';
    });
    const c = commit(b.level, changed);
    expect(c.level.inbox).toEqual([]);
    expect(c.report.expired).toEqual([]);
    expect(c.sim.player.reputation).toBe(changed.player.reputation);
    expect(arriveDemands(b.level, changed).inbox.some((d) => d.id === a.id || d.id === b.id)).toBe(false);
  });

  // @spec LINE-INBOX-011
  it('starts a new project when work intake is accepted', () => {
    const { level, sim } = centeredRun(1);
    const { level: l, id } = withDemand(only(level, sim), { type: 'workIntake', subject: { kind: 'team', id: teamOf(sim) }, hours: 2, lastWeek: 2 });
    const c = commit(l, sim, { [id]: { kind: 'accept' } });
    expect(c.report.hours).toBe(2);
    const added = projects(c.sim).filter((p) => !projects(sim).includes(p));
    expect(added).toHaveLength(1);
    expect(NAMES.projects).toContain(c.sim.projects[added[0]!]!.name);
    expect(c.level.inbox).toEqual([]);
  });

  // @spec LINE-INBOX-012
  it('costs less reputation to decline work intake than to let it expire', () => {
    const { level, sim } = centeredRun(1);
    const { level: l, id } = withDemand(only(level, sim), { type: 'workIntake', subject: { kind: 'team', id: teamOf(sim) }, lastWeek: 0 });
    const declined = commit(l, sim, { [id]: { kind: 'decline' } });
    const expired = commit(l, sim);
    expect(declined.level.inbox).toEqual([]);
    expect(declined.sim.player.reputation).toBeLessThan(sim.player.reputation);
    expect(declined.sim.player.reputation).toBeGreaterThan(expired.sim.player.reputation);
  });

  // @spec LINE-INBOX-013
  it('rejects decisions for unknown demands or decisions the type does not allow', () => {
    const { level, sim } = centeredRun(1);
    const base = only(level, sim);
    const approval = withDemand(base, { type: 'approval', subject: projectSubject(sim), lastWeek: 2 });
    const intake = withDemand(base, { type: 'workIntake', subject: { kind: 'team', id: teamOf(sim) }, lastWeek: 2 });
    const cases = [
      { level: base, decisions: { missing: { kind: 'handle' as const } } },
      { level: approval.level, decisions: { [approval.id]: { kind: 'accept' as const } } },
      { level: intake.level, decisions: { [intake.id]: { kind: 'handle' as const } } },
    ];
    for (const c of cases) {
      const before = structuredClone({ level: c.level, sim });
      expectRejected(commitWeek(c.level, sim, c.decisions), c.level, sim, before.level, before.sim);
    }
  });
});
