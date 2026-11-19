import { describe, expect, it } from 'vitest';
import { aggregateTeam, applyEffects, type Cause, type Effect, type SimState } from '../../src/sim';
import { ACTION, RULE, SITUATION, expectOk, expectRejected, fresh, patch, person, rated } from './fixtures';

const motivation = (id: string, amount: number, cause: Cause = RULE, extra: Partial<Effect> = {}): Effect =>
  ({ type: 'value', target: { kind: 'person', id }, field: 'motivation', amount, cause, ...extra }) as Effect;

const newHire = { id: 'n1', name: 'New hire', role: 'engineer' as const, skill: 40, motivation: 70, stress: 10, trust: 50, want: 'growth' as const };

function expectRejectedUnchanged(state: SimState, effects: Effect[], index: number) {
  const snapshot = structuredClone(state);
  expectRejected(applyEffects(state, effects), index);
  expect(state).toEqual(snapshot);
}

describe('batch validation', () => {
  // @spec SIM-EFFECT-001
  it('rejects a batch containing an effect without a cause', () => {
    const noCause = { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'motivation', amount: 5 } as unknown as Effect;
    expectRejectedUnchanged(fresh(), [motivation('e2', 5), noCause], 1);
  });

  // @spec SIM-EFFECT-002
  it('validates each effect against the state left by the effects before it', () => {
    const r = expectOk(
      applyEffects(fresh(), [
        { type: 'remove', personId: 'm1', reason: 'fired', cause: ACTION },
        { type: 'setLeader', teamId: 't2', leader: { kind: 'person', id: 'e4' }, cause: ACTION },
      ]),
    );
    expect(r.state.teams.t2!.leader).toEqual({ kind: 'person', id: 'e4' });
  });

  // @spec SIM-EFFECT-002
  it('commits nothing when a later effect in the batch is invalid', () => {
    expectRejectedUnchanged(fresh(), [motivation('e1', 10), motivation('nobody', 10)], 1);
  });

  // @spec SIM-EFFECT-003
  it('rejects a batch targeting something that does not exist', () => {
    expectRejectedUnchanged(fresh(), [motivation('nobody', 5)], 0);
    expectRejectedUnchanged(fresh(), [{ type: 'cancelProject', projectId: 'nope', cause: ACTION }], 0);
    expectRejectedUnchanged(fresh(), [{ type: 'move', personId: 'e1', teamId: 'nope', cause: ACTION }], 0);
  });

  // @spec SIM-EFFECT-004
  it('rejects a batch targeting a departed person', () => {
    const s = expectOk(applyEffects(fresh(), [{ type: 'remove', personId: 'e1', reason: 'quit', cause: ACTION }])).state;
    expectRejectedUnchanged(s, [motivation('e1', 5)], 0);
  });

  // @spec SIM-EFFECT-005
  it('rejects a batch targeting an aggregated person', () => {
    const s = aggregateTeam(fresh(), 't1', ACTION).state;
    expectRejectedUnchanged(s, [motivation('e1', 5)], 0);
  });

  // @spec SIM-EFFECT-006
  it('rejects a history note on anything other than a person', () => {
    expectRejectedUnchanged(
      fresh(),
      [{ type: 'value', target: { kind: 'project', id: 'p1' }, field: 'risk', amount: 5, cause: ACTION, historyNote: 'x' }],
      0,
    );
  });

  // @spec SIM-EFFECT-022
  it('rejects setting a leader on a team that already has one', () => {
    expectRejectedUnchanged(fresh(), [{ type: 'setLeader', teamId: 't2', leader: { kind: 'person', id: 'e4' }, cause: ACTION }], 0);
  });

  // @spec SIM-EFFECT-023
  it('rejects making someone leader who already leads a team', () => {
    const s = patch(fresh(), (st) => {
      st.teams.t1!.leader = null;
    });
    expectRejectedUnchanged(s, [{ type: 'setLeader', teamId: 't1', leader: { kind: 'person', id: 'm1' }, cause: ACTION }], 0);
  });
});

describe('value effects', () => {
  // @spec SIM-EFFECT-007
  it('applies effects in order, clamping each one', () => {
    const upThenDown = expectOk(applyEffects(fresh(), [motivation('e1', 80), motivation('e1', -50)])).state;
    expect(person(upThenDown, 'e1').motivation).toBe(50); // 50 → 100 (clamped) → 50
    const downThenUp = expectOk(applyEffects(fresh(), [motivation('e1', -80), motivation('e1', 50)])).state;
    expect(person(downThenUp, 'e1').motivation).toBe(50); // 50 → 0 (clamped) → 50
  });

  // @spec SIM-EFFECT-008
  it('amplifies a motivation increase that serves the person’s want', () => {
    const plain = person(expectOk(applyEffects(fresh(), [motivation('e1', 10)])).state, 'e1').motivation;
    const tagged = person(
      expectOk(applyEffects(fresh(), [motivation('e1', 10, RULE, { wantTags: { serves: ['growth'] } })])).state,
      'e1',
    ).motivation;
    expect(tagged).toBeGreaterThan(plain);
  });

  // @spec SIM-EFFECT-009
  it('amplifies a motivation decrease that works against the person’s want', () => {
    const plain = person(expectOk(applyEffects(fresh(), [motivation('e2', -10)])).state, 'e2').motivation;
    const tagged = person(
      expectOk(applyEffects(fresh(), [motivation('e2', -10, RULE, { wantTags: { against: ['stability'] } })])).state,
      'e2',
    ).motivation;
    expect(tagged).toBeLessThan(plain);
  });

  // @spec SIM-EFFECT-010
  it('weakens the player’s motivation boosts on people with low trust', () => {
    const withTrust = (trust: number) =>
      patch(fresh(), (s) => {
        s.people.e1!.trust = trust;
      });
    for (const cause of [ACTION, SITUATION]) {
      const high = person(expectOk(applyEffects(withTrust(90), [motivation('e1', 20, cause)])).state, 'e1').motivation;
      const low = person(expectOk(applyEffects(withTrust(10), [motivation('e1', 20, cause)])).state, 'e1').motivation;
      expect(low).toBeLessThan(high);
    }
  });

  // @spec SIM-EFFECT-019
  it('marks a want as served by a tagged effect on any field', () => {
    const s = patch(fresh(), (st) => {
      st.week = 12;
    });
    const r = expectOk(
      applyEffects(s, [
        { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'stress', amount: 15, cause: SITUATION, wantTags: { serves: ['growth'] } },
      ]),
    );
    expect(person(r.state, 'e1').wantServedWeek).toBe(12);
  });

  // @spec SIM-EFFECT-024
  it('ignores want tags on effects aimed at anything other than a person', () => {
    const r = expectOk(
      applyEffects(fresh(), [
        { type: 'value', target: { kind: 'project', id: 'p1' }, field: 'risk', amount: 10, cause: ACTION, wantTags: { serves: ['growth'] } },
      ]),
    );
    expect(r.state.projects.p1!.risk).toBe(10);
  });
});

describe('structural effects', () => {
  // @spec SIM-EFFECT-011
  it('hires an active person into a detailed team', () => {
    const s = patch(fresh(), (st) => {
      st.week = 5;
    });
    const hired = person(expectOk(applyEffects(s, [{ type: 'hire', teamId: 't1', person: newHire, cause: ACTION }])).state, 'n1');
    expect(hired).toMatchObject({ status: 'active', teamId: 't1', joinedWeek: 5 });
  });

  // @spec SIM-EFFECT-018
  it('raises headcount instead of adding a person when hiring into an aggregate team', () => {
    const s = aggregateTeam(fresh(), 't1', ACTION).state;
    const before = s.teams.t1!.aggregate!.headcount;
    const r = expectOk(applyEffects(s, [{ type: 'hire', teamId: 't1', person: newHire, cause: ACTION }]));
    expect(r.state.teams.t1!.aggregate!.headcount).toBe(before + 1);
    expect(r.state.teams.t1!.aggregate!.ratings.unrated).toBe(s.teams.t1!.aggregate!.ratings.unrated + 1);
    expect(r.state.people.n1).toBeUndefined();
  });

  // @spec SIM-EFFECT-012
  it('marks a removed person departed and keeps them', () => {
    const s = patch(fresh(), (st) => {
      st.week = 9;
    });
    const r = expectOk(applyEffects(s, [{ type: 'remove', personId: 'e2', reason: 'fired', cause: ACTION }]));
    expect(person(r.state, 'e2')).toMatchObject({ status: 'departed', departure: { week: 9, reason: 'fired' } });
  });

  // @spec SIM-EFFECT-013
  it('moves a person into a detailed team', () => {
    const r = expectOk(applyEffects(fresh(), [{ type: 'move', personId: 'e1', teamId: 't2', cause: ACTION }]));
    expect(person(r.state, 'e1').teamId).toBe('t2');
  });

  // @spec SIM-EFFECT-020
  it('aggregates a person moved into an aggregate team', () => {
    const s = aggregateTeam(rated(), 't2', ACTION).state;
    const before = s.teams.t2!.aggregate!.headcount;
    const r = expectOk(applyEffects(s, [{ type: 'move', personId: 'e1', teamId: 't2', cause: ACTION }]));
    expect(person(r.state, 'e1').status).toBe('aggregated');
    expect(r.state.teams.t2!.aggregate!.headcount).toBe(before + 1);
    expect(r.state.teams.t2!.aggregate!.ratings.exceeds).toBe(s.teams.t2!.aggregate!.ratings.exceeds + 1);
  });

  // @spec SIM-EFFECT-021
  it('leaves a moved leader’s former team leaderless', () => {
    const r = expectOk(applyEffects(fresh(), [{ type: 'move', personId: 'm1', teamId: 't1', cause: ACTION }]));
    expect(r.state.teams.t2!.leader).toBeNull();
  });

  // @spec SIM-EFFECT-014
  it('sets the leader of a leaderless team', () => {
    const s = patch(fresh(), (st) => {
      st.teams.t1!.leader = null;
    });
    const r = expectOk(applyEffects(s, [{ type: 'setLeader', teamId: 't1', leader: { kind: 'person', id: 'e1' }, cause: ACTION }]));
    expect(r.state.teams.t1!.leader).toEqual({ kind: 'person', id: 'e1' });
    const p = expectOk(applyEffects(s, [{ type: 'setLeader', teamId: 't1', leader: { kind: 'player' }, cause: ACTION }]));
    expect(p.state.teams.t1!.leader).toEqual({ kind: 'player' });
  });

  // @spec SIM-EFFECT-015
  it('starts a project with zero progress at the current week', () => {
    const s = patch(fresh(), (st) => {
      st.week = 3;
    });
    const r = expectOk(
      applyEffects(s, [
        { type: 'startProject', project: { id: 'p2', name: 'Search v2', teamId: 't2', scope: 80, risk: 20, techDebt: 10, deadlineWeek: 30 }, cause: ACTION },
      ]),
    );
    expect(r.state.projects.p2).toMatchObject({ status: 'active', progress: 0, startWeek: 3, teamId: 't2' });
  });

  // @spec SIM-EFFECT-016
  it('reassigns a project to another team', () => {
    const r = expectOk(applyEffects(fresh(), [{ type: 'reassignProject', projectId: 'p1', teamId: 't2', cause: ACTION }]));
    expect(r.state.projects.p1!.teamId).toBe('t2');
  });

  // @spec SIM-EFFECT-017
  it('cancels a project', () => {
    const r = expectOk(applyEffects(fresh(), [{ type: 'cancelProject', projectId: 'p1', cause: ACTION }]));
    expect(r.state.projects.p1!.status).toBe('cancelled');
  });
});
