import { describe, expect, it } from 'vitest';
import { addOutsider, addTeam, advance, applyEffects, attritionRiskOf, closeTeam, moveHeads, type NewOutsider, type SimState } from '../../src/sim';
import { ACTION, fresh, patch } from './fixtures';

const ratings = (o: Partial<Record<'unrated' | 'below' | 'partial' | 'meets' | 'exceeds' | 'outstanding', number>>) => ({ unrated: 0, below: 0, partial: 0, meets: 0, exceeds: 0, outstanding: 0, ...o });

/** fresh() plus two aggregate teams: t8 (4 heads, 2 meets, 2 exceeds) and t9 (5 heads, all meets), neither led. */
function withGroups(): SimState {
  let s = fresh();
  for (const [id, a] of [
    ['t8', { headcount: 4, skill: 40, motivation: 30, stress: 70, ratings: ratings({ meets: 2, exceeds: 2 }) }],
    ['t9', { headcount: 5, skill: 61, motivation: 65, stress: 20, ratings: ratings({ meets: 5 }) }],
  ] as const) {
    const r = addTeam(s, { team: { id, name: id, aggregate: a } }, ACTION);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

const ok = <T extends { ok: boolean }>(r: T) => {
  if (!r.ok) throw new Error((r as unknown as { error: string }).error);
  return r as Extract<T, { ok: true }>;
};

describe('moving heads between aggregate teams', () => {
  // @spec SIM-TEAM-010, SIM-TEAM-014
  it('moves heads at a rating, averages the receiver by headcount, leaves the giver’s values and records no departure', () => {
    const before = withGroups();
    const r = ok(moveHeads(before, { from: 't8', to: 't9', level: 'exceeds', count: 2 }, ACTION));
    const t8 = r.state.teams.t8!.aggregate!;
    const t9 = r.state.teams.t9!.aggregate!;
    expect(t8).toMatchObject({ headcount: 2, skill: 40, motivation: 30, stress: 70, ratings: ratings({ meets: 2 }) });
    expect(t9).toMatchObject({ headcount: 7, ratings: ratings({ meets: 5, exceeds: 2 }) });
    // (5 × 61 + 2 × 40) / 7 = 55; (5 × 65 + 2 × 30) / 7 = 55; (5 × 20 + 2 × 70) / 7 ≈ 34
    expect([t9.skill, t9.motivation, t9.stress]).toEqual([55, 55, 34]);
    expect(t9.attritionRisk).toBe(attritionRiskOf(55, 34));
    expect(Object.values(r.state.people).filter((p) => p.status === 'departed')).toEqual([]);
    expect(r.log.length).toBeGreaterThan(0);
    expect(r.log.every((c) => c.cause === ACTION || JSON.stringify(c.cause) === JSON.stringify(ACTION))).toBe(true);
    // the input is left as it was
    expect(before.teams.t9!.aggregate!.headcount).toBe(5);
  });

  // @spec SIM-TEAM-011
  it('rejects a missing or detailed team, the same team twice, a count below 1, or more heads than the rating holds', () => {
    const s = withGroups();
    for (const move of [
      { from: 'nope', to: 't9', level: 'meets', count: 1 },
      { from: 't8', to: 'nope', level: 'meets', count: 1 },
      { from: 't1', to: 't9', level: 'unrated', count: 1 },
      { from: 't8', to: 't1', level: 'meets', count: 1 },
      { from: 't8', to: 't8', level: 'meets', count: 1 },
      { from: 't8', to: 't9', level: 'meets', count: 0 },
      { from: 't8', to: 't9', level: 'meets', count: 3 },
      { from: 't8', to: 't9', level: 'below', count: 1 },
    ] as const) {
      const r = moveHeads(s, move, ACTION);
      expect(r.ok, JSON.stringify(move)).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/\w/);
    }
  });
});

describe('closing a team', () => {
  /** t8 emptied into t9. */
  const emptied = () => {
    let s = withGroups();
    s = ok(moveHeads(s, { from: 't8', to: 't9', level: 'meets', count: 2 }, ACTION)).state;
    return ok(moveHeads(s, { from: 't8', to: 't9', level: 'exceeds', count: 2 }, ACTION)).state;
  };

  // @spec SIM-TEAM-012, SIM-TEAM-014
  it('removes an empty, leaderless aggregate team with no active project, keeping its finished projects as they were', () => {
    const s = patch(emptied(), (x) => {
      x.projects.done = { id: 'done', name: 'Shipped', scope: 10, progress: 10, risk: 10, techDebt: 0, startWeek: 0, deadlineWeek: 8, teamId: 't8', status: 'completed' };
    });
    const r = ok(closeTeam(s, 't8', ACTION));
    expect(r.state.teams.t8).toBeUndefined();
    expect(r.state.projects.done!.teamId).toBe('t8');
    expect(r.log.length).toBeGreaterThan(0);
    // the simulation carries on with a finished project whose team is gone
    expect(() => advance(advance(r.state, 4).state, 13)).not.toThrow();
  });

  // @spec SIM-TEAM-013
  it('rejects a missing or detailed team, or one with heads, a leader or an active project', () => {
    const led = ok(addTeam(emptied(), { team: { id: 't7', name: 't7', aggregate: { headcount: 1, skill: 50, motivation: 50, stress: 30 } }, manager: { id: 'm7', name: 'm7', role: 'manager', skill: 50, motivation: 50, stress: 30, trust: 50, want: 'growth' } }, ACTION)).state;
    const busy = patch(emptied(), (x) => {
      x.projects.open = { id: 'open', name: 'Open', scope: 10, progress: 2, risk: 10, techDebt: 0, startWeek: 0, deadlineWeek: 20, teamId: 't8', status: 'active' };
    });
    for (const [state, id] of [[emptied(), 'nope'], [emptied(), 't1'], [withGroups(), 't8'], [busy, 't8']] as const) {
      expect(closeTeam(state, id, ACTION).ok, id).toBe(false);
    }
    // a team with a leader and no heads: move its one head out first
    const leaderOnly = ok(moveHeads(led, { from: 't7', to: 't9', level: 'unrated', count: 1 }, ACTION)).state;
    expect(closeTeam(leaderOnly, 't7', ACTION).ok).toBe(false);
  });
});

describe('people outside the organization', () => {
  const boss = (over: Partial<NewOutsider> = {}): NewOutsider => ({ id: 'x1', name: 'Morgan Hale', role: 'executive', personality: 'blunt', want: 'recognition', trust: 50, motivation: 60, stress: 40, ...over });

  // @spec SIM-OUT-001
  it('adds an active, unrated person with no team, joined this week', () => {
    const s = patch(fresh(), (x) => (x.week = 30));
    const r = ok(addOutsider(s, boss(), ACTION));
    expect(r.state.people.x1).toMatchObject({ role: 'executive', status: 'active', performance: 'unrated', joinedWeek: 30, teamId: null, trust: 50, want: 'recognition', personality: 'blunt' });
    expect(Object.values(r.state.teams).some((t) => t.leader?.kind === 'person' && t.leader.id === 'x1')).toBe(false);
    expect(s.people.x1).toBeUndefined();
  });

  // @spec SIM-OUT-002
  it('rejects a used id, another role, or a value out of range', () => {
    for (const bad of [boss({ id: 'e1' }), boss({ role: 'manager' as never }), boss({ trust: 101 }), boss({ stress: -1 }), boss({ motivation: 200 })]) {
      expect(addOutsider(fresh(), bad, ACTION).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(addOutsider(fresh(), boss({ role: 'peer' }), ACTION).ok).toBe(true);
  });

  // @spec SIM-OUT-003
  it('drifts their motivation and nothing else: they never quit, and the rest of the run plays exactly as without them', () => {
    const base = patch(fresh(), (x) => (x.week = 60));
    const unhappy = boss({ trust: 0, motivation: 5, stress: 100 });
    let withThem = ok(addOutsider(base, unhappy, ACTION)).state;
    withThem = patch(withThem, (x) => {
      x.people.x1!.wantServedWeek = 0;
      x.people.x1!.lowMotivationWeeks = 500;
      x.people.x1!.highStressWeeks = 500;
    });
    let without = base;
    for (let i = 0; i < 20; i++) {
      withThem = advance(withThem, 4).state;
      without = advance(without, 4).state;
    }
    expect(withThem.people.x1!.status).toBe('active');
    expect(withThem.people.x1!.motivation).toBeLessThan(5 + 1);
    const { x1: _x1, ...others } = withThem.people;
    expect({ ...withThem, people: others }).toEqual(without);
  });

  // @spec SIM-OUT-004
  it('rejects making them lead a team or join one', () => {
    const s = ok(addOutsider(withGroups(), boss(), ACTION)).state;
    expect(applyEffects(s, [{ type: 'setLeader', teamId: 't9', leader: { kind: 'person', id: 'x1' }, cause: ACTION }]).ok).toBe(false);
    expect(applyEffects(s, [{ type: 'move', personId: 'x1', teamId: 't9', cause: ACTION }]).ok).toBe(false);
    expect(applyEffects(s, [{ type: 'move', personId: 'x1', teamId: 't1', cause: ACTION }]).ok).toBe(false);
    // other effects reach them as anyone
    expect(applyEffects(s, [{ type: 'value', target: { kind: 'person', id: 'x1' }, field: 'trust', amount: 5, cause: ACTION }]).ok).toBe(true);
  });
});
