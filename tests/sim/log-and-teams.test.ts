import { describe, expect, it } from 'vitest';
import { advance, aggregateTeam, applyEffects } from '../../src/sim';
import { ACTION, RULE, SITUATION, entriesFor, expectOk, fresh, patch, person } from './fixtures';

describe('change log and history', () => {
  // @spec SIM-LOG-001
  it('returns a log entry per change with cause, target and before/after values', () => {
    const r = expectOk(
      applyEffects(fresh(), [{ type: 'value', target: { kind: 'person', id: 'e1' }, field: 'stress', amount: 10, cause: SITUATION }]),
    );
    expect(entriesFor(r.log, 'e1', 'stress')).toEqual([
      { cause: SITUATION, target: { kind: 'person', id: 'e1' }, field: 'stress', before: 30, after: 40 },
    ]);
  });

  // @spec SIM-LOG-002
  it('attributes every change made during an advance to a rule', () => {
    const { log } = advance(fresh(), 4);
    expect(log.length).toBeGreaterThan(0);
    for (const entry of log) expect(entry.cause.kind).toBe('rule');
  });

  // @spec SIM-LOG-003
  it('does not store change logs in the state', () => {
    const { state } = advance(fresh(), 4);
    expect(Object.keys(state).sort()).toEqual(['people', 'player', 'projects', 'rngState', 'teams', 'week']);
  });

  // @spec SIM-LOG-004
  it('appends a history entry for an effect with a history note', () => {
    const s = patch(fresh(), (st) => {
      st.week = 7;
    });
    const r = expectOk(
      applyEffects(s, [
        { type: 'value', target: { kind: 'person', id: 'e3' }, field: 'motivation', amount: -15, cause: SITUATION, historyNote: 'Passed over for promotion' },
      ]),
    );
    expect(person(r.state, 'e3').history).toEqual([{ week: 7, cause: SITUATION, note: 'Passed over for promotion' }]);
  });
});

describe('teams', () => {
  // @spec SIM-TEAM-001
  it('summarizes a team’s active members when converting it to aggregate form', () => {
    const { state } = aggregateTeam(fresh(), 't1', ACTION);
    const t1 = state.teams.t1!;
    expect(t1.form).toBe('aggregate');
    expect(t1.aggregate).toMatchObject({ headcount: 3, skill: 50, motivation: 50, stress: 30 });
    expect(t1.aggregate!.attritionRisk).toBeGreaterThanOrEqual(0);
  });

  // @spec SIM-TEAM-004
  it('marks members aggregated and keeps the leader active', () => {
    const { state } = aggregateTeam(fresh(), 't2', ACTION);
    expect(person(state, 'e4').status).toBe('aggregated');
    expect(person(state, 'e5').status).toBe('aggregated');
    expect(person(state, 'm1').status).toBe('active');
    expect(state.teams.t2!.aggregate!.headcount).toBe(2);
  });

  // @spec SIM-TEAM-002
  it('never turns an aggregate team back into individuals', () => {
    let s = aggregateTeam(fresh(), 't1', ACTION).state;
    s = aggregateTeam(s, 't1', ACTION).state;
    s = advance(s, 13).state;
    expect(s.teams.t1!.form).toBe('aggregate');
    for (const id of ['e1', 'e2', 'e3']) expect(person(s, id).status).toBe('aggregated');
  });

  // @spec SIM-TEAM-003
  it('makes a team leaderless when its leader departs', () => {
    const r = expectOk(applyEffects(fresh(), [{ type: 'remove', personId: 'm1', reason: 'quit', cause: ACTION }]));
    expect(r.state.teams.t2!.leader).toBeNull();
  });

  // @spec SIM-TEAM-005
  it('applies a change to a detailed team to each of its active members', () => {
    const r = expectOk(
      applyEffects(fresh(), [{ type: 'value', target: { kind: 'team', id: 't1' }, field: 'stress', amount: 10, cause: RULE }]),
    );
    for (const id of ['e1', 'e2', 'e3']) {
      expect(person(r.state, id).stress).toBe(40);
      expect(entriesFor(r.log, id, 'stress')).toHaveLength(1);
    }
    expect(person(r.state, 'e4').stress).toBe(30);
  });
});
