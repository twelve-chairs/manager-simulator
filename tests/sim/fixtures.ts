import { expect } from 'vitest';
import {
  create,
  type ApplyEffectsResult,
  type Cause,
  type ChangeLogEntry,
  type NewPerson,
  type Rating,
  type SimState,
  type StartingOrganization,
} from '../../src/sim';

export const ACTION: Cause = { kind: 'action', actionId: 'test.action' };
export const SITUATION: Cause = { kind: 'situation', situationId: 'test.situation', choiceId: 'a' };
export const RULE: Cause = { kind: 'rule', ruleId: 'test.rule' };

const engineer = (id: string, teamId: string, overrides: Partial<NewPerson> = {}) => ({
  id,
  name: id,
  role: 'engineer' as const,
  skill: 50,
  motivation: 50,
  stress: 30,
  trust: 60,
  want: 'growth' as const,
  teamId,
  ...overrides,
});

/**
 * Two teams: t1 led by the player (e1–e3, project p1), and t2 led by manager m1 (e4–e5, no projects).
 */
export function org(): StartingOrganization {
  return {
    player: { reputation: 50, stress: 30 },
    teams: [
      { id: 't1', name: 'Payments', leader: { kind: 'player' }, form: 'detailed' },
      { id: 't2', name: 'Search', leader: { kind: 'person', id: 'm1' }, form: 'detailed' },
    ],
    people: [
      engineer('e1', 't1', { want: 'growth' }),
      engineer('e2', 't1', { want: 'stability' }),
      engineer('e3', 't1', { want: 'recognition' }),
      { ...engineer('m1', 't2', { want: 'autonomy' }), role: 'manager' },
      engineer('e4', 't2'),
      engineer('e5', 't2'),
    ],
    projects: [
      { id: 'p1', name: 'Checkout rewrite', teamId: 't1', scope: 100, risk: 0, techDebt: 0, deadlineWeek: 26 },
    ],
  };
}

export const fresh = (seed = 1): SimState => create(seed, org());

/** The fixture with starting ratings: e1 exceeds, e2 meets, e3 outstanding, m1 meets, e4 below, e5 partial. */
export function ratedOrg(): StartingOrganization {
  const ratings: Record<string, Rating> = { e1: 'exceeds', e2: 'meets', e3: 'outstanding', m1: 'meets', e4: 'below', e5: 'partial' };
  const o = org();
  return { ...o, people: o.people.map((p) => ({ ...p, performance: ratings[p.id] })) };
}

export const rated = (seed = 1): SimState => create(seed, ratedOrg());

/** Returns a modified deep copy of a state; the simulation state is plain data. */
export function patch(state: SimState, change: (s: SimState) => void): SimState {
  const copy = structuredClone(state);
  change(copy);
  return copy;
}

export function expectOk(result: ApplyEffectsResult) {
  if (!result.ok) throw new Error(`expected batch to apply, got: ${result.error.message}`);
  return result;
}

export function expectRejected(result: ApplyEffectsResult, index: number) {
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.index).toBe(index);
}

export const person = (s: SimState, id: string) => {
  const p = s.people[id];
  if (!p) throw new Error(`no person ${id}`);
  return p;
};

export const entriesFor = (log: ChangeLogEntry[], targetId: string, field: string) =>
  log.filter((e) => 'id' in e.target && e.target.id === targetId && e.field === field);

export const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
