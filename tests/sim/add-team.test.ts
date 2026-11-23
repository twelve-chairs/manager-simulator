import { describe, expect, it } from 'vitest';
import { addTeam, applyEffects, type NewPerson } from '../../src/sim';
import { ACTION, expectOk, fresh, patch } from './fixtures';

const manager = (id = 'm9'): NewPerson => ({ id, name: 'Nadia Fontaine', role: 'manager', skill: 45, motivation: 60, stress: 30, trust: 50, want: 'autonomy', personality: 'steady' });
const team = (id = 't9') => ({ id, name: 'Ledger', aggregate: { headcount: 5, skill: 55, motivation: 60, stress: 35 } });

describe('adding a team', () => {
  // @spec SIM-TEAM-006
  it('adds an aggregate team with its summary, unrated heads, computed attrition risk, no projects, and its manager', () => {
    const before = patch(fresh(), (s) => (s.week = 12));
    const result = addTeam(before, { team: team(), manager: manager() }, ACTION);
    if (!result.ok) throw new Error(result.error);
    const t9 = result.state.teams.t9!;
    expect(t9).toMatchObject({ id: 't9', name: 'Ledger', form: 'aggregate', leader: { kind: 'person', id: 'm9' } });
    expect(t9.aggregate).toMatchObject({ headcount: 5, skill: 55, motivation: 60, stress: 35 });
    expect(t9.aggregate!.ratings).toEqual({ unrated: 5, below: 0, partial: 0, meets: 0, exceeds: 0, outstanding: 0 });
    expect(t9.aggregate!.attritionRisk).toBeGreaterThanOrEqual(0);
    expect(Object.values(result.state.projects).filter((p) => p.teamId === 't9')).toEqual([]);
    expect(result.state.people.m9).toMatchObject({ role: 'manager', status: 'active', teamId: 't9', joinedWeek: 12 });
    expect(result.log.length).toBeGreaterThan(0);
    // the input is left as it was
    expect(before.teams.t9).toBeUndefined();
    // rating counts, when given, are kept; a team may come without a manager
    const ratings = { unrated: 1, below: 0, partial: 1, meets: 2, exceeds: 1, outstanding: 0 };
    const rated = addTeam(before, { team: { ...team('t8'), aggregate: { ...team().aggregate, ratings } } }, ACTION);
    if (!rated.ok) throw new Error(rated.error);
    expect(rated.state.teams.t8!.aggregate!.ratings).toEqual(ratings);
    expect(rated.state.teams.t8!.leader).toBeNull();
  });

  // @spec SIM-TEAM-007
  it('rejects a used id, a headcount below 1, a value out of range, or rating counts that miss the headcount', () => {
    const state = fresh();
    const bad = [
      { team: team('t1') },
      { team: team(), manager: manager('e1') },
      { team: { ...team(), aggregate: { ...team().aggregate, headcount: 0 } } },
      { team: { ...team(), aggregate: { ...team().aggregate, stress: 101 } } },
      { team: { ...team(), aggregate: { ...team().aggregate, skill: -1 } } },
      { team: { ...team(), aggregate: { ...team().aggregate, ratings: { unrated: 2, below: 0, partial: 0, meets: 0, exceeds: 0, outstanding: 0 } } } },
    ];
    for (const input of bad) {
      const result = addTeam(state, input, ACTION);
      expect(result.ok, JSON.stringify(input)).toBe(false);
    }
    expect(state).toEqual(fresh());
  });
});

describe('leaders', () => {
  // @spec SIM-TEAM-008
  it('makes a person set as a team’s leader a manager', () => {
    const removed = expectOk(applyEffects(fresh(), [{ type: 'remove', personId: 'm1', reason: 'transferred', cause: ACTION }])).state;
    const { state } = expectOk(applyEffects(removed, [{ type: 'setLeader', teamId: 't2', leader: { kind: 'person', id: 'e4' }, cause: ACTION }]));
    expect(state.people.e4!.role).toBe('manager');
    expect(state.teams.t2!.leader).toEqual({ kind: 'person', id: 'e4' });
  });
});

describe('hiring a manager into an aggregate team', () => {
  // @spec SIM-TEAM-009
  it('adds a hired manager as the leader of a leaderless aggregate team, its headcount unchanged', () => {
    const added = addTeam(patch(fresh(), (s) => (s.week = 20)), { team: team() }, ACTION);
    if (!added.ok) throw new Error(added.error);
    const { state } = expectOk(applyEffects(added.state, [{ type: 'hire', teamId: 't9', person: manager('m7'), cause: ACTION }]));
    expect(state.teams.t9!.leader).toEqual({ kind: 'person', id: 'm7' });
    expect(state.teams.t9!.aggregate!.headcount).toBe(5);
    expect(state.people.m7).toMatchObject({ role: 'manager', status: 'active', teamId: 't9', performance: 'unrated', joinedWeek: 20 });
    // an engineer hired into the same team, or a manager into a team that already has a leader, is a head
    const led = expectOk(applyEffects(state, [{ type: 'hire', teamId: 't9', person: manager('m8'), cause: ACTION }])).state;
    expect(led.teams.t9!.aggregate!.headcount).toBe(6);
    expect(led.people.m8).toBeUndefined();
  });
});
