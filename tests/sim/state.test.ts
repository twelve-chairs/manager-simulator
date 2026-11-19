import { describe, expect, it } from 'vitest';
import { advance, aggregateTeam, applyEffects, create } from '../../src/sim';
import { ACTION, RULE, expectOk, fresh, org, patch, person } from './fixtures';

describe('state and determinism', () => {
  // @spec SIM-STATE-001
  it('survives a JSON round trip unchanged', () => {
    const { state } = advance(fresh(), 4);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  // @spec SIM-STATE-002
  it('leaves the input state unchanged on every operation', () => {
    const start = fresh();
    const snapshot = structuredClone(start);
    advance(start, 4);
    applyEffects(start, [
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'motivation', amount: 10, cause: ACTION },
    ]);
    aggregateTeam(start, 't1', ACTION);
    expect(start).toEqual(snapshot);
  });

  // @spec SIM-STATE-003
  it('produces identical states and logs for identical inputs', () => {
    const run = () => {
      let s = fresh(42);
      const logs = [];
      for (let i = 0; i < 10; i++) {
        const r = advance(s, 1);
        s = r.state;
        logs.push(r.log);
      }
      return { s, logs };
    };
    expect(run()).toEqual(run());
  });

  // @spec SIM-STATE-004
  it('draws randomness only from generator state held in the simulation state', () => {
    const risky = patch(fresh(7), (s) => {
      s.projects.p1!.risk = 80;
      s.projects.p1!.techDebt = 80;
    });
    const roundTripped = JSON.parse(JSON.stringify(risky));
    expect(advance(roundTripped, 13)).toEqual(advance(risky, 13));
    expect(fresh(1).rngState).not.toEqual(fresh(2).rngState);
  });

  // @spec SIM-STATE-005
  it('gives the same result regardless of the order the organization was listed in', () => {
    const shuffled = org();
    shuffled.people.reverse();
    shuffled.teams.reverse();
    const a = advance(create(3, org()), 13);
    const b = advance(create(3, shuffled), 13);
    expect(b.log).toEqual(a.log);
    expect(b.state).toEqual(a.state);
  });

  // @spec SIM-STATE-006
  it('clamps bounded values to 0–100', () => {
    const up = expectOk(
      applyEffects(fresh(), [
        { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'motivation', amount: 500, cause: RULE },
      ]),
    );
    expect(person(up.state, 'e1').motivation).toBe(100);
    const down = expectOk(
      applyEffects(fresh(), [
        { type: 'value', target: { kind: 'player' }, field: 'reputation', amount: -500, cause: RULE },
      ]),
    );
    expect(down.state.player.reputation).toBe(0);
  });

  // @spec SIM-STATE-007
  it('treats every team, including those led by managed managers, as under the player', () => {
    const calm = patch(fresh(), (s) => {
      s.projects = {};
    });
    const troubled = patch(calm, (s) => {
      s.teams.t2!.leader = null;
    });
    const calmStress = advance(calm, 4).state.player.stress;
    const troubledStress = advance(troubled, 4).state.player.stress;
    expect(troubledStress).toBeGreaterThan(calmStress);
  });
});
