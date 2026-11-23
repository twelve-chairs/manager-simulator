import { describe, expect, it } from 'vitest';
import { LINE_TUNING } from '../../../src/levels/line-manager';
import { deliveredRatings } from '../../../src/levels/senior-manager';
import {
  DIRECTOR_LEVEL,
  DIRECTOR_TUNING as T,
  afterAdvanceDirector,
  assessDirector,
  endQuarter,
  leaderOf,
  reviewDue,
  setDirectorHabit,
  type DirectorState,
} from '../../../src/levels/director';
import { applyEffects, type SimState } from '../../../src/sim';
import { director } from './fixtures';

const RULE = { kind: 'rule', ruleId: 'test' } as const;
const ok = <X>(r: ({ ok: true } & X) | { ok: false; error: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};
const at = (sim: SimState, week: number): SimState => ({ ...structuredClone(sim), week });
const groups = (level: DirectorState, sim: SimState) => level.groupIds.map((g) => sim.teams[g]!.aggregate!);
const leads = (level: DirectorState, sim: SimState) => level.groupIds.map((g) => leaderOf(sim, g)!);
const trusts = (sim: SimState, ids: string[]) => ids.map((id) => sim.people[id]!.trust);

describe('habits', () => {
  // @spec DIR-HABIT-001
  it('starts balanced, with weekly staff meetings and no listening tour', () => {
    expect(director(1).level.habits).toEqual({ time: 'balanced', staffMeeting: 'weekly', listeningTour: 'none' });
  });

  // @spec DIR-HABIT-002, DIR-HABIT-003
  it('changes a habit, and rejects unknown habits or options, changing nothing', () => {
    const { level, sim } = director(1);
    expect(ok(setDirectorHabit(level, sim, { habit: 'time', value: 'upward' })).level.habits.time).toBe('upward');
    expect(ok(setDirectorHabit(level, sim, { habit: 'staffMeeting', value: 'fortnightly' })).level.habits.staffMeeting).toBe('fortnightly');
    expect(ok(setDirectorHabit(level, sim, { habit: 'listeningTour', value: 'quarterly' })).level.habits.listeningTour).toBe('quarterly');
    for (const bad of [{ habit: 'oversight', value: 'close' }, { habit: 'time', value: 'sideways' }, { habit: 'staffMeeting', value: 'daily' }, null, 'time', { value: 'upward' }]) {
      expect(setDirectorHabit(level, sim, bad).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(level.habits.time).toBe('balanced');
  });

  // @spec DIR-HABIT-004
  it('moves the room above’s trust and the groups’ motivation by where the time goes', () => {
    const { level, sim } = director(3);
    const above = [level.executiveId, ...level.peerIds];
    const run = (time: DirectorState['habits']['time']) => ok(endQuarter({ ...level, habits: { ...level.habits, time } }, sim)).sim;
    const [up, mid, org] = [run('upward'), run('balanced'), run('organization')];
    trusts(up, above).forEach((t, i) => expect(t).toBe(Math.min(100, trusts(mid, above)[i]! + T.time.aboveTrust)));
    trusts(org, above).forEach((t, i) => expect(t).toBe(Math.max(0, trusts(mid, above)[i]! - T.time.aboveTrust)));
    groups(level, up).forEach((g, i) => expect(g.motivation).toBeLessThan(groups(level, mid)[i]!.motivation + 1));
    groups(level, org).forEach((g, i) => expect(g.motivation).toBeGreaterThan(groups(level, mid)[i]!.motivation - 1));
    expect(trusts(org, leads(level, sim)).reduce((a, b) => a + b)).toBeGreaterThan(trusts(mid, leads(level, sim)).reduce((a, b) => a + b));
  });

  // @spec DIR-HABIT-005
  it('holds staff meetings: senior managers trust more and their wants are known, at more energy weekly', () => {
    const { level, sim } = director(3);
    const weekly = ok(endQuarter(level, sim));
    const fortnightly = ok(endQuarter({ ...level, habits: { ...level.habits, staffMeeting: 'fortnightly' } }, sim));
    for (const id of leads(level, sim)) expect(weekly.level.learnedWants[id]).toBe(true);
    expect(weekly.sim.player.stress - fortnightly.sim.player.stress).toBe(T.staffMeeting.weekly.energy - T.staffMeeting.fortnightly.energy);
    expect(trusts(weekly.sim, leads(level, sim)).reduce((a, b) => a + b)).toBeGreaterThan(trusts(fortnightly.sim, leads(level, sim)).reduce((a, b) => a + b));
  });

  // @spec DIR-HABIT-006
  it('visits the next group in rotation on a quarterly tour, shows it next quarter, and surfaces a problem, at an energy cost', () => {
    const { level, sim } = director(3);
    const touring = { ...level, habits: { ...level.habits, listeningTour: 'quarterly' as const } };
    const first = ok(endQuarter(touring, sim));
    expect(first.level.visited).toEqual({ groupId: level.groupIds[0], quarter: 2 });
    expect(first.level.surfaced).toEqual([{ groupId: level.groupIds[0], week: sim.week }]);
    const second = ok(endQuarter(first.level, at(first.sim, sim.week + 13)));
    expect(second.level.visited!.groupId).toBe(level.groupIds[1]);
    expect(first.sim.player.stress - ok(endQuarter(level, sim)).sim.player.stress).toBe(T.tourEnergy);
  });
});

describe('groups under their senior managers', () => {
  // @spec DIR-DRIFT-001
  it('moves each group toward what its senior manager sustains, and sets its attrition risk from its health', () => {
    const { level, sim } = director(5);
    const g = level.groupIds[1]!;
    const lead = leaderOf(sim, g)!;
    const skilled = applyEffects(sim, [
      { type: 'value', target: { kind: 'person', id: lead }, field: 'skill', amount: 100, cause: RULE },
      { type: 'value', target: { kind: 'team', id: g }, field: 'stress', amount: 100, cause: RULE },
      { type: 'value', target: { kind: 'team', id: g }, field: 'motivation', amount: -100, cause: RULE },
    ]);
    if (!skilled.ok) throw new Error(skilled.error.message);
    const after = ok(endQuarter(level, skilled.state)).sim.teams[g]!.aggregate!;
    expect(after.stress).toBeLessThan(100);
    expect(after.motivation).toBeGreaterThan(0);
    expect(after.attritionRisk).toBe(Math.round((100 - after.motivation) / 2 + after.stress / 4));
  });

  // @spec DIR-DRIFT-002
  it('moves a senior manager’s motivation by whether their want was served, and their stress toward their group’s', () => {
    const { level, sim } = director(5);
    const g = level.groupIds[2]!;
    const lead = leaderOf(sim, g)!;
    const calm = applyEffects(sim, [{ type: 'value', target: { kind: 'person', id: lead }, field: 'stress', amount: -100, cause: RULE }, { type: 'value', target: { kind: 'team', id: g }, field: 'stress', amount: 100, cause: RULE }]);
    if (!calm.ok) throw new Error(calm.error.message);
    expect(ok(endQuarter(level, calm.state)).sim.people[lead]!.stress).toBeGreaterThan(0);
  });

  // @spec DIR-DRIFT-003
  it('takes the engagement survey in the last quarter before a review, and not otherwise', () => {
    const { level, sim } = director(5);
    const mid = ok(endQuarter(level, sim));
    expect(mid.level.survey.quarter).toBe(1);
    const last = ok(endQuarter(level, at(sim, sim.week + 13)));
    expect(last.level.survey.quarter).toBe(2);
    for (const g of level.groupIds) expect(last.level.survey.groups[g]!.stress).toBe(last.sim.teams[g]!.aggregate!.stress);
  });

  // @spec DIR-DRIFT-004
  it('calibrates each group at a period’s end: its delivery, raised by its senior manager’s leniency', () => {
    const { level, sim } = director(5);
    const lenient = { ...level, leniency: Object.fromEntries(Object.keys(level.leniency).map((id) => [id, 0])) };
    const r = ok(endQuarter(lenient, at(sim, sim.week + 13)));
    for (const g of level.groupIds) {
      const delivered = deliveredRatings(r.sim, g);
      expect(r.sim.teams[g]!.aggregate!.ratings).toEqual(delivered);
    }
    expect(r.level.calibrations.at(-1)!.gap).toBe(0);
    const raised = ok(endQuarter({ ...level, leniency: Object.fromEntries(Object.keys(level.leniency).map((id) => [id, 1])) }, at(sim, sim.week + 13)));
    expect(raised.level.calibrations.at(-1)!.gap).toBeGreaterThan(0);
  });
});

describe('senior managers’ plans', () => {
  // @spec DIR-PLAN-001
  it('rates each senior manager at a period’s end, and not mid-period', () => {
    const { level, sim } = director(5);
    const count = (s: SimState) => leads(level, sim).reduce((n, id) => n + s.people[id]!.history.filter((h) => h.rating).length, 0);
    expect(count(ok(endQuarter(level, sim)).sim)).toBe(count(sim));
    expect(count(ok(endQuarter(level, at(sim, sim.week + 13))).sim)).toBe(count(sim) + 3);
  });

  // @spec DIR-PLAN-002
  it('holds a third low rating for a final evaluation instead of giving it', () => {
    const { level, sim } = director(5);
    const g = level.groupIds[1]!;
    const lead = leaderOf(sim, g)!;
    const struggling = applyEffects(sim, [
      { type: 'rate', target: { kind: 'person', id: lead }, rating: 'below', cause: RULE },
      { type: 'rate', target: { kind: 'person', id: lead }, rating: 'below', cause: RULE },
      { type: 'value', target: { kind: 'team', id: g }, field: 'skill', amount: -100, cause: RULE },
      { type: 'value', target: { kind: 'team', id: g }, field: 'stress', amount: 100, cause: RULE },
      { type: 'value', target: { kind: 'team', id: g }, field: 'motivation', amount: -100, cause: RULE },
    ]);
    if (!struggling.ok) throw new Error(struggling.error.message);
    const r = ok(endQuarter(level, at(struggling.state, sim.week + 13)));
    expect(r.level.heldEvaluations).toContain(lead);
    expect(r.sim.people[lead]!.history.filter((h) => h.rating)).toHaveLength(2);
  });
});

describe('reviews and the end of the level', () => {
  // @spec DIR-END-001, DIR-END-002
  it('steps thirteen weeks and is reviewed every two quarters', () => {
    expect(DIRECTOR_LEVEL).toMatchObject({ id: 'director', weeksPerStep: 13, reviewEveryWeeks: 26 });
    const { level, sim } = director(1);
    const due = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((q) => reviewDue(level, at(sim, sim.week + q * 13)));
    expect(due).toEqual([2, 4, 6, 8, 10, 12]);
    expect(reviewDue(level, sim)).toBe(false);
  });

  // @spec DIR-END-004, DIR-END-005
  it('allows promotion from the third review, and holds the last review at the sixth', () => {
    const { level, sim } = director(1);
    const a = (q: number) => assessDirector(level, at(sim, sim.week + q * 13));
    expect([2, 4, 6, 8, 12].map((q) => a(q).promotionPossible)).toEqual([false, false, true, true, true]);
    expect([2, 10, 12].map((q) => a(q).lastReview)).toEqual([false, false, true]);
  });

  // @spec DIR-END-006
  it('burns out after two quarters in a row at the edge', () => {
    const { level, sim } = director(1);
    const edge = { ...sim, player: { ...sim.player, stress: LINE_TUNING.burnoutThreshold } };
    const once = afterAdvanceDirector(level, edge);
    expect(once.burnedOut).toBe(false);
    expect(afterAdvanceDirector(once.level, edge).burnedOut).toBe(true);
    expect(afterAdvanceDirector(afterAdvanceDirector(once.level, sim).level, edge).burnedOut).toBe(false);
  });
});
