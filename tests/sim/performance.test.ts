import { describe, expect, it } from 'vitest';
import {
  advance,
  aggregateTeam,
  applyEffects,
  contribution,
  correspondingRating,
  create,
  planOf,
  teamSummary,
  type Cause,
  type Effect,
  type PerformanceLevel,
  type Rating,
  type SimState,
} from '../../src/sim';
import { ACTION, SITUATION, expectOk, expectRejected, fresh, org, patch, person, rated, ratedOrg, seeds } from './fixtures';

const rate = (id: string, rating: Rating, cause: Cause = SITUATION, extra: Partial<Effect> = {}): Effect =>
  ({ type: 'rate', target: { kind: 'person', id }, rating, cause, ...extra }) as Effect;

const ratePlayer = (rating: Rating, cause: Cause = SITUATION, extra: Partial<Effect> = {}): Effect =>
  ({ type: 'rate', target: { kind: 'player' }, rating, cause, ...extra }) as Effect;

const reRate = (teamId: string, from: PerformanceLevel, to: Rating, count: number): Effect =>
  ({ type: 'reRate', teamId, from, to, count, cause: ACTION }) as Effect;

/** Applies each batch in turn, failing the test if any is rejected. */
function applyAll(state: SimState, ...batches: Effect[][]) {
  return batches.reduce((s, batch) => expectOk(applyEffects(s, batch)).state, state);
}

function expectRejectedUnchanged(state: SimState, effects: Effect[], index: number) {
  const snapshot = structuredClone(state);
  expectRejected(applyEffects(state, effects), index);
  expect(state).toEqual(snapshot);
}

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);

describe('performance level', () => {
  // @spec SIM-PERF-001
  it('starts people and the player with their starting rating, or unrated', () => {
    const unrated = fresh();
    expect(person(unrated, 'e1').performance).toBe('unrated');
    expect(person(unrated, 'e1').history).toEqual([]);
    expect(unrated.player.performance).toBe('unrated');
    expect(unrated.player.ratingHistory).toEqual([]);

    const start: Cause = { kind: 'rule', ruleId: 'rule.startingOrganization' };
    const s = create(1, { ...ratedOrg(), player: { reputation: 50, stress: 30, performance: 'meets' } });
    expect(person(s, 'e4').performance).toBe('below');
    expect(person(s, 'e4').history).toEqual([{ week: 0, cause: start, rating: 'below' }]);
    expect(s.player.performance).toBe('meets');
    expect(s.player.ratingHistory).toEqual([{ week: 0, cause: start, rating: 'meets' }]);
  });

  // @spec SIM-PERF-001, SIM-PERF-007
  it('counts a starting low rating toward a plan', () => {
    const s = applyAll(rated(), [rate('e4', 'partial')]);
    expect(planOf(s, { kind: 'person', id: 'e4' })).toBe('pip');
  });

  // @spec SIM-PERF-002
  it('starts a hire into a detailed team unrated', () => {
    const hire = { id: 'n1', name: 'New hire', role: 'engineer' as const, skill: 40, motivation: 70, stress: 10, trust: 50, want: 'growth' as const };
    const s = applyAll(rated(), [{ type: 'hire', teamId: 't1', person: hire, cause: ACTION }]);
    expect(person(s, 'n1').performance).toBe('unrated');
  });

  // @spec SIM-PERF-003
  it('rejects a rate effect whose rating is not one of the five', () => {
    expectRejectedUnchanged(fresh(), [rate('e1', 'meets'), rate('e2', 'unrated' as Rating)], 1);
    expectRejectedUnchanged(fresh(), [rate('e1', 'great' as Rating)], 0);
  });

  // @spec SIM-PERF-004
  it('sets a person’s rating and records it in their history', () => {
    const s = patch(fresh(), (st) => {
      st.week = 12;
    });
    const r = expectOk(applyEffects(s, [rate('e3', 'partial', SITUATION, { historyNote: 'Rated below what they delivered' })]));
    expect(person(r.state, 'e3').performance).toBe('partial');
    expect(person(r.state, 'e3').history).toEqual([
      { week: 12, cause: SITUATION, rating: 'partial', note: 'Rated below what they delivered' },
    ]);
    expect(person(applyAll(s, [rate('e2', 'meets')]), 'e2').history).toEqual([{ week: 12, cause: SITUATION, rating: 'meets' }]);
  });

  // @spec SIM-PERF-005
  it('sets the player’s rating and records it in their rating history', () => {
    const s = patch(fresh(), (st) => {
      st.week = 26;
    });
    const after = applyAll(s, [ratePlayer('exceeds', ACTION)]);
    expect(after.player.performance).toBe('exceeds');
    expect(after.player.ratingHistory).toEqual([{ week: 26, cause: ACTION, rating: 'exceeds' }]);
  });

  // @spec SIM-PERF-006
  it('changes ratings only through rate effects', () => {
    let s = rated();
    s = applyAll(s, [
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'skill', amount: -40, cause: ACTION },
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'motivation', amount: -40, cause: ACTION },
    ]);
    s = advance(s, 13).state;
    expect(person(s, 'e1').performance).toBe('exceeds');
    expect(s.player.performance).toBe('unrated');
  });

  // @spec SIM-PERF-007
  it('derives the plan from consecutive low ratings ending with the latest', () => {
    const e1 = { kind: 'person', id: 'e1' } as const;
    let s = fresh();
    expect(planOf(s, e1)).toBe('none');
    s = applyAll(s, [rate('e1', 'below')]);
    expect(planOf(s, e1)).toBe('coaching');
    s = applyAll(s, [rate('e1', 'meets')]);
    expect(planOf(s, e1)).toBe('none');
    s = applyAll(s, [rate('e1', 'partial')], [rate('e1', 'below')]);
    expect(planOf(s, e1)).toBe('pip');
  });

  // @spec SIM-PERF-008
  it('fires a person on their third consecutive low rating, after the rest of the batch', () => {
    const s = applyAll(fresh(), [rate('m1', 'below')], [rate('m1', 'partial')]);
    const r = expectOk(
      applyEffects(s, [
        rate('m1', 'below', SITUATION),
        { type: 'value', target: { kind: 'person', id: 'm1' }, field: 'motivation', amount: -10, cause: SITUATION },
      ]),
    );
    const m1 = person(r.state, 'm1');
    expect(m1.status).toBe('departed');
    expect(m1.departure).toEqual({ week: 0, reason: 'fired' });
    expect(m1.motivation).toBe(40);
    expect(r.state.teams.t2!.leader).toBeNull();
    const m1Entries = r.log.filter((e) => 'id' in e.target && e.target.id === 'm1');
    expect(m1Entries.map((e) => e.field)).toEqual(['performance', 'history', 'motivation', 'status']);
    expect(m1Entries.at(-1)!.cause).toEqual(SITUATION);
  });

  // @spec SIM-PERF-009
  it('reports the player’s failed PIP without changing their standing', () => {
    const s = applyAll(fresh(), [ratePlayer('partial')], [ratePlayer('below')]);
    const r = expectOk(applyEffects(s, [ratePlayer('partial')]));
    expect(planOf(r.state, { kind: 'player' })).toBe('failedPip');
    expect(r.state.player.reputation).toBe(s.player.reputation);
    expect(r.state.player.stress).toBe(s.player.stress);
    expect(r.log.map((e) => e.field)).toEqual(['performance', 'ratingHistory']);
  });

  // @spec SIM-PERF-018
  it('replaces the latest rating when a rate effect is a revision', () => {
    const e1 = { kind: 'person', id: 'e1' } as const;
    let s = patch(fresh(), (st) => {
      st.week = 13;
    });
    s = applyAll(s, [rate('e1', 'partial', SITUATION)]);
    s = patch(s, (st) => {
      st.week = 15;
    });
    s = applyAll(s, [rate('e1', 'below', ACTION, { revision: true })]);
    expect(person(s, 'e1').performance).toBe('below');
    expect(person(s, 'e1').history).toEqual([{ week: 13, cause: ACTION, rating: 'below' }]);
    expect(planOf(s, e1)).toBe('coaching');

    const p = applyAll(fresh(), [ratePlayer('meets', ACTION, { revision: true })]);
    expect(p.player.ratingHistory).toEqual([{ week: 0, cause: ACTION, rating: 'meets' }]);
  });

  // @spec SIM-PERF-019
  it('reports no plan for departed or aggregated people', () => {
    let s = applyAll(fresh(), [rate('e4', 'below')], [rate('e5', 'below')]);
    s = applyAll(s, [{ type: 'remove', personId: 'e4', reason: 'quit', cause: ACTION }]);
    s = aggregateTeam(s, 't2', ACTION).state;
    expect(planOf(s, { kind: 'person', id: 'e4' })).toBe('none');
    expect(planOf(s, { kind: 'person', id: 'e5' })).toBe('none');
  });
});

describe('contribution', () => {
  const withPerson = (values: { skill?: number; motivation?: number; stress?: number }) =>
    patch(fresh(), (st) => {
      Object.assign(st.people.e1!, values);
    });

  // @spec SIM-PERF-010
  it('rises with skill and motivation and falls with stress', () => {
    const base = contribution(withPerson({}), 'e1')!;
    expect(base).toBeGreaterThanOrEqual(0);
    expect(base).toBeLessThanOrEqual(100);
    expect(contribution(withPerson({ skill: 80 }), 'e1')!).toBeGreaterThan(base);
    expect(contribution(withPerson({ motivation: 80 }), 'e1')!).toBeGreaterThan(base);
    expect(contribution(withPerson({ stress: 80 }), 'e1')!).toBeLessThan(base);
    expect(contribution(withPerson({ skill: 100, motivation: 100, stress: 0 }), 'e1')!).toBeLessThanOrEqual(100);
    expect(contribution(withPerson({ skill: 0, motivation: 0, stress: 100 }), 'e1')!).toBeGreaterThanOrEqual(0);
  });

  // @spec SIM-PERF-011
  it('maps contribution to a rating that never falls as contribution rises', () => {
    const order: Rating[] = ['below', 'partial', 'meets', 'exceeds', 'outstanding'];
    let last = -1;
    for (let skill = 0; skill <= 100; skill += 5) {
      const s = withPerson({ skill, motivation: skill, stress: 100 - skill });
      const r = correspondingRating(s, 'e1')!;
      expect(order).toContain(r);
      expect(order.indexOf(r)).toBeGreaterThanOrEqual(last);
      last = order.indexOf(r);
    }
    expect(last).toBe(order.indexOf('outstanding'));
    expect(correspondingRating(withPerson({ skill: 0, motivation: 0, stress: 100 }), 'e1')).toBe('below');
  });

  // @spec SIM-PERF-011
  it('reports neither contribution nor rating for someone not active, and errors for someone unknown', () => {
    const s = aggregateTeam(applyAll(fresh(), [{ type: 'remove', personId: 'e1', reason: 'quit', cause: ACTION }]), 't2', ACTION).state;
    expect(contribution(s, 'e1')).toBeNull();
    expect(correspondingRating(s, 'e1')).toBeNull();
    expect(contribution(s, 'e4')).toBeNull();
    expect(() => contribution(s, 'nobody')).toThrow();
  });
});

describe('ratings in aggregate teams', () => {
  const t2 = (s: SimState) => s.teams.t2!.aggregate!;
  const aggregated = () => aggregateTeam(rated(), 't2', ACTION).state;

  // @spec SIM-PERF-012
  it('keeps rating counts summing to headcount through hires, moves, value effects and attrition', () => {
    let s = aggregated();
    expect(sum(t2(s).ratings)).toBe(t2(s).headcount);
    const hire = { id: 'n1', name: 'New hire', role: 'engineer' as const, skill: 40, motivation: 70, stress: 10, trust: 50, want: 'growth' as const };
    s = applyAll(
      s,
      [{ type: 'hire', teamId: 't2', person: hire, cause: ACTION }],
      [{ type: 'move', personId: 'e1', teamId: 't2', cause: ACTION }],
      [{ type: 'value', target: { kind: 'team', id: 't2' }, field: 'headcount', amount: 3, cause: ACTION }],
      [{ type: 'value', target: { kind: 'team', id: 't2' }, field: 'headcount', amount: -2, cause: ACTION }],
    );
    expect(sum(t2(s).ratings)).toBe(t2(s).headcount);
    s = patch(s, (st) => {
      st.teams.t2!.aggregate!.attritionRisk = 100;
    });
    for (let i = 0; i < 10; i++) {
      s = advance(s, 13).state;
      expect(sum(t2(s).ratings)).toBe(t2(s).headcount);
    }
    s = applyAll(s, [{ type: 'value', target: { kind: 'team', id: 't2' }, field: 'headcount', amount: -50, cause: ACTION }]);
    expect(t2(s).headcount).toBe(0);
    expect(sum(t2(s).ratings)).toBe(0);
  });

  // @spec SIM-PERF-013
  it('moves heads between levels with a re-rate effect', () => {
    const s = applyAll(aggregated(), [reRate('t2', 'below', 'meets', 1)]);
    expect(t2(s).ratings).toMatchObject({ below: 0, partial: 1, meets: 1 });
    expect(applyAll(s, [reRate('t2', 'meets', 'meets', 1)]).teams.t2!.aggregate!.ratings).toEqual(t2(s).ratings);
  });

  // @spec SIM-PERF-014
  it('rejects invalid re-rate effects', () => {
    const s = aggregated();
    expectRejectedUnchanged(fresh(), [reRate('t2', 'meets', 'exceeds', 1)], 0);
    expectRejectedUnchanged(s, [reRate('t2', 'below', 'meets', 0)], 0);
    expectRejectedUnchanged(s, [reRate('t2', 'below', 'unrated' as Rating, 1)], 0);
    expectRejectedUnchanged(s, [reRate('t2', 'below', 'meets', 1), reRate('t2', 'below', 'meets', 1)], 1);
  });

  // @spec SIM-PERF-015
  it('counts heads gained through a value effect as unrated', () => {
    const s = applyAll(aggregated(), [{ type: 'value', target: { kind: 'team', id: 't2' }, field: 'headcount', amount: 2, cause: ACTION }]);
    expect(t2(s).ratings.unrated).toBe(2);
  });

  // @spec SIM-PERF-016, SIM-ADV-012
  it('takes lost heads more often from the ends of the scale than from meets', () => {
    let fromEnds = 0;
    let fromMeets = 0;
    for (const seed of seeds(300)) {
      const s = patch(aggregateTeam(fresh(seed), 't2', ACTION).state, (st) => {
        st.projects = {};
        st.teams.t2!.aggregate!.headcount = 3;
        st.teams.t2!.aggregate!.ratings = { unrated: 0, below: 1, partial: 0, meets: 1, exceeds: 0, outstanding: 1 };
      });
      const r = applyAll(s, [{ type: 'value', target: { kind: 'team', id: 't2' }, field: 'headcount', amount: -1, cause: ACTION }]);
      const after = r.teams.t2!.aggregate!.ratings;
      expect(sum(after)).toBe(2);
      if (after.meets === 0) fromMeets++;
      else fromEnds++;
    }
    // With equal weights the ends would hold two thirds of losses; weighting must push them above that.
    expect(fromEnds / (fromEnds + fromMeets)).toBeGreaterThan(0.72);
  });

  // @spec SIM-PERF-016
  it('draws lost heads deterministically for a seed', () => {
    const run = () =>
      advance(
        patch(aggregated(), (st) => {
          st.teams.t2!.aggregate!.attritionRisk = 100;
        }),
        13,
      ).state.teams.t2!.aggregate!.ratings;
    const first = run();
    expect(first).toEqual(run());
    expect(Object.keys(first).sort()).toEqual(['below', 'exceeds', 'meets', 'outstanding', 'partial', 'unrated']);
  });

  // @spec SIM-PERF-017
  it('includes rating counts in a detailed team’s summary', () => {
    expect(teamSummary(rated(), 't2').ratings).toEqual({ unrated: 0, below: 1, partial: 1, meets: 0, exceeds: 0, outstanding: 0 });
  });

  // @spec SIM-PERF-020
  it('fills in or checks rating counts for teams that start in aggregate form', () => {
    const aggregateStart = (ratings?: Record<PerformanceLevel, number>) => {
      const o = org();
      return {
        ...o,
        teams: [
          ...o.teams,
          {
            id: 't3',
            name: 'Platform',
            leader: null,
            form: 'aggregate' as const,
            aggregate: { headcount: 4, skill: 50, motivation: 50, stress: 30, attritionRisk: 20, ...(ratings ? { ratings } : {}) },
          },
        ],
      };
    };
    expect(create(1, aggregateStart()).teams.t3!.aggregate!.ratings).toEqual({
      unrated: 4, below: 0, partial: 0, meets: 0, exceeds: 0, outstanding: 0,
    });
    expect(() => create(1, aggregateStart({ unrated: 1, below: 0, partial: 0, meets: 1, exceeds: 0, outstanding: 0 }))).toThrow();
  });
});
