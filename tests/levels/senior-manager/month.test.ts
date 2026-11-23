import { describe, expect, it } from 'vitest';
import { SENIOR_TUNING, afterAdvanceSenior, endMonth, setSeniorHabit, type SeniorState } from '../../../src/levels/senior-manager';
import type { SimState } from '../../../src/sim';
import { senior } from './fixtures';

const T = SENIOR_TUNING;
const managerOf = (sim: SimState, teamId: string) => (sim.teams[teamId]!.leader as { id: string }).id;
const managers = (level: SeniorState, sim: SimState) => level.teamIds.map((t) => managerOf(sim, t));
const edit = (sim: SimState, change: (s: SimState) => void) => {
  const copy = structuredClone(sim);
  change(copy);
  return copy;
};
/** Ends a month and returns the level and simulation after it, failing the test on an error. */
function month(level: SeniorState, sim: SimState) {
  const r = endMonth(level, sim);
  if (!r.ok) throw new Error(r.error);
  return r;
}
const withHabits = (level: SeniorState, habits: Partial<SeniorState['habits']>): SeniorState => ({ ...level, habits: { ...level.habits, ...habits } });
const allOversight = (level: SeniorState, sim: SimState, value: 'handsOff' | 'coaching' | 'close') => Object.fromEntries(managers(level, sim).map((m) => [m, value]));

describe('changing habits', () => {
  // @spec SENIOR-HABIT-002
  it('applies a changed habit from the month’s end', () => {
    const { level, sim } = senior(1);
    const m = managers(level, sim)[1]!;
    const changed = setSeniorHabit(level, sim, { habit: 'oversight', managerId: m, value: 'close' });
    if (!changed.ok) throw new Error(changed.error);
    expect(changed.level.habits.oversight[m]).toBe('close');
    const coached = month(level, sim).sim.player.stress;
    const closer = month(changed.level, sim).sim.player.stress;
    expect(closer - coached).toBe(T.closeEnergy - T.coachingEnergy);
    for (const [habit, value] of [['oneOnOnes', 'weekly'], ['backfill', 'fast'], ['skipLevel', 'monthly']] as const) {
      const r = setSeniorHabit(level, sim, { habit, value });
      expect(r.ok && r.level.habits[habit]).toBe(value);
    }
  });

  // @spec SENIOR-HABIT-003
  it('rejects an unknown habit or option, or a manager not in the group, changing nothing', () => {
    const { level, sim } = senior(2);
    const before = structuredClone(level);
    for (const command of [{ habit: 'nightPages', value: 'you' }, { habit: 'oneOnOnes', value: 'daily' }, { habit: 'oversight', managerId: 'e1', value: 'close' }, { habit: 'oversight', managerId: managers(level, sim)[0], value: 'micro' }, null, 'close']) {
      expect(setSeniorHabit(level, sim, command as never).ok, JSON.stringify(command)).toBe(false);
    }
    expect(level).toEqual(before);
  });
});

describe('the habits at the month’s end', () => {
  // @spec SENIOR-HABIT-004
  it('costs energy for coaching and more for close oversight, and coaching grows a manager', () => {
    const { level, sim } = senior(3);
    const quiet = withHabits(level, { oneOnOnes: 'monthly', oversight: allOversight(level, sim, 'handsOff') });
    const base = month(quiet, sim).sim.player.stress;
    const coached = withHabits(quiet, { oversight: { ...quiet.habits.oversight, [managers(level, sim)[0]!]: 'coaching' } });
    const close = withHabits(quiet, { oversight: { ...quiet.habits.oversight, [managers(level, sim)[0]!]: 'close' } });
    expect(month(coached, sim).sim.player.stress - base).toBe(T.coachingEnergy);
    expect(month(close, sim).sim.player.stress - base).toBe(T.closeEnergy);
    const m = managers(level, sim)[0]!;
    expect(month(coached, sim).sim.people[m]!.skill - month(quiet, sim).sim.people[m]!.skill).toBe(T.coachingGrowth);
  });

  // @spec SENIOR-HABIT-005
  it('costs a manager who wants autonomy motivation under close oversight, and anyone trust after three close months', () => {
    const { level, sim } = senior(4);
    const [m] = managers(level, sim);
    const wantsAutonomy = edit(sim, (s) => Object.assign(s.people[m!]!, { want: 'autonomy' }));
    const close = withHabits(level, { oversight: { ...level.habits.oversight, [m!]: 'close' } });
    const coaching = month(level, wantsAutonomy).sim.people[m!]!;
    const closed = month(close, wantsAutonomy).sim.people[m!]!;
    expect(coaching.motivation - closed.motivation).toBeGreaterThanOrEqual(T.closeAutonomyMotivation);
    let l = close;
    let s = edit(sim, (x) => (x.people[m!]!.trust = 40));
    const trust: number[] = [s.people[m!]!.trust];
    for (let i = 0; i < 3; i++) {
      const r = month(l, s);
      l = r.level;
      s = r.sim;
      trust.push(s.people[m!]!.trust);
    }
    // The 1:1s add the same trust every month; only the third month under close oversight takes some away.
    const gains = [trust[1]! - trust[0]!, trust[2]! - trust[1]!, trust[3]! - trust[2]!];
    expect(gains[0]).toBe(gains[1]);
    expect(gains[1]! - gains[2]!).toBe(T.closeTrust);
    expect(l.closeMonths[m!]).toBe(3);
  });

  // @spec SENIOR-HABIT-006
  it('holds 1:1s with each manager at the cadence, building trust, revealing wants, costing energy', () => {
    const { level, sim } = senior(5);
    const off = withHabits(level, { oversight: allOversight(level, sim, 'handsOff') });
    const counts = { weekly: 4, fortnightly: 2, monthly: 1 } as const;
    const stress = Object.fromEntries((['weekly', 'fortnightly', 'monthly'] as const).map((c) => [c, month(withHabits(off, { oneOnOnes: c }), sim).sim.player.stress]));
    expect(stress.weekly! - stress.monthly!).toBe((counts.weekly - counts.monthly) * T.oneOnOneEnergy * 3);
    const r = month(withHabits(off, { oneOnOnes: 'fortnightly' }), sim);
    for (const m of managers(level, sim)) {
      expect(r.level.learnedWants[m]).toBe(true);
      expect(r.sim.people[m]!.trust).toBe(Math.min(100, sim.people[m]!.trust + counts.fortnightly * T.oneOnOneTrust));
    }
  });

  // @spec SENIOR-HABIT-007
  it('backfills a lost head after a month at lower skill fast, or two at the team’s skill holding the bar, stressed while it is missing', () => {
    const { level, sim } = senior(6);
    const teamId = level.teamIds[1]!;
    const lost = edit(sim, (s) => {
      const a = s.teams[teamId]!.aggregate!;
      a.headcount -= 1;
      a.ratings.unrated -= 1;
    });
    const start = sim.teams[teamId]!.aggregate!;
    for (const [policy, months] of [['fast', 1], ['holdTheBar', 2]] as const) {
      let l = withHabits(level, { backfill: policy, oversight: allOversight(level, sim, 'handsOff') });
      let s = lost;
      for (let i = 1; i <= months; i++) {
        const r = month(l, s);
        l = r.level;
        s = r.sim;
        const a = s.teams[teamId]!.aggregate!;
        if (i < months) expect(a.headcount).toBe(start.headcount - 1);
      }
      expect(s.teams[teamId]!.aggregate!.headcount).toBe(start.headcount);
      expect(l.backfills.filter((b) => b.teamId === teamId)).toEqual([]);
      if (policy === 'fast') expect(s.teams[teamId]!.aggregate!.skill).toBeLessThan(start.skill);
    }
    // the gap itself stresses the team
    const gap = month(withHabits(level, { oversight: allOversight(level, sim, 'handsOff') }), lost).sim.teams[teamId]!.aggregate!.stress;
    const whole = month(withHabits(level, { oversight: allOversight(level, sim, 'handsOff') }), sim).sim.teams[teamId]!.aggregate!.stress;
    expect(gap).toBeGreaterThan(whole);
  });

  // @spec SENIOR-HABIT-008
  it('listens to the next team each month under skip-levels, showing its truth and surfacing a problem, at a cost', () => {
    const { level, sim } = senior(7);
    const off = withHabits(level, { oversight: allOversight(level, sim, 'handsOff'), oneOnOnes: 'monthly' });
    const listening = withHabits(off, { skipLevel: 'monthly' });
    const distrust = edit(sim, (s) => {
      for (const t of level.teamIds) s.people[managerOf(s, t)]!.trust = 30;
    });
    let l = listening;
    let s = distrust;
    const heard: string[] = [];
    for (let i = 0; i < 4; i++) {
      const listened = managerOf(s, level.teamIds[i % 3]!);
      const before = s.people[listened]!.trust;
      const r = month(l, s);
      heard.push(...r.level.listenedTo);
      expect(r.level.surfaced.map((x) => x.teamId)).toEqual(r.level.listenedTo);
      // a distrustful manager takes the listening as distrust
      if (before < 50) expect(r.sim.people[listened]!.trust).toBe(before + T.oneOnOneTrust - T.skipLevelTrust);
      l = r.level;
      s = r.sim;
    }
    expect(heard).toEqual([level.teamIds[0], level.teamIds[1], level.teamIds[2], level.teamIds[0]]);
    expect(month(listening, sim).sim.player.stress - month(off, sim).sim.player.stress).toBe(T.skipLevelEnergy);
    expect(month(off, sim).level.listenedTo).toEqual([]);
  });
});

describe('teams under their managers', () => {
  // @spec SENIOR-DRIFT-001
  it('moves a team toward what its manager sustains, faster hands-off under a struggling manager', () => {
    const { level, sim } = senior(8);
    const teamId = level.teamIds[2]!;
    const m = managerOf(sim, teamId);
    const setup = (skill: number) => edit(sim, (s) => {
      s.people[m]!.skill = skill;
      Object.assign(s.teams[teamId]!.aggregate!, { motivation: 50, stress: 50 });
    });
    const coaching = withHabits(level, { oneOnOnes: 'monthly' });
    const strong = month(coaching, setup(85)).sim.teams[teamId]!.aggregate!;
    const weak = month(coaching, setup(15)).sim.teams[teamId]!.aggregate!;
    expect(strong.motivation).toBeGreaterThan(50);
    expect(strong.stress).toBeLessThan(50);
    expect(weak.motivation).toBeLessThan(50);
    expect(weak.stress).toBeGreaterThan(50);
    const handsOff = month(withHabits(coaching, { oversight: { ...coaching.habits.oversight, [m]: 'handsOff' } }), setup(15)).sim.teams[teamId]!.aggregate!;
    expect(handsOff.motivation).toBeLessThan(weak.motivation);
  });

  // @spec SENIOR-DRIFT-002
  it('sets each team’s attrition risk from its motivation and stress', () => {
    const { level, sim } = senior(9);
    const r = month(level, sim);
    for (const t of level.teamIds) {
      const a = r.sim.teams[t]!.aggregate!;
      const happier = month(level, edit(sim, (s) => Object.assign(s.teams[t]!.aggregate!, { motivation: 90, stress: 10 }))).sim.teams[t]!.aggregate!;
      expect(happier.attritionRisk).toBeLessThan(a.attritionRisk + 1);
    }
  });

  // @spec SENIOR-DRIFT-003
  it('raises a manager’s motivation when the month serves their want, and moves their stress toward their team’s', () => {
    const { level, sim } = senior(10);
    const [m] = managers(level, sim);
    const team = level.teamIds[0]!;
    const growth = edit(sim, (s) => Object.assign(s.people[m!]!, { want: 'growth', stress: 20 }));
    const served = month(withHabits(level, { oneOnOnes: 'monthly' }), growth).sim.people[m!]!;
    const unserved = month(withHabits(level, { oneOnOnes: 'monthly', oversight: { ...level.habits.oversight, [m!]: 'handsOff' } }), growth).sim.people[m!]!;
    expect(served.motivation).toBeGreaterThan(unserved.motivation);
    const stressed = edit(growth, (s) => (s.teams[team]!.aggregate!.stress = 90));
    expect(month(level, stressed).sim.people[m!]!.stress).toBeGreaterThan(month(level, growth).sim.people[m!]!.stress);
  });
});

describe('burnout', () => {
  // @spec SENIOR-END-006
  it('burns the player out after four months in a row ending at the edge', () => {
    const { level, sim } = senior(11);
    const edge = edit(sim, (s) => (s.player.stress = 95));
    let l = level;
    const out: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = afterAdvanceSenior(l, edge);
      l = r.level;
      out.push(r.burnedOut);
    }
    expect(out).toEqual([false, false, false, true]);
    expect(afterAdvanceSenior({ ...l, burnoutMonths: 2 }, edit(sim, (s) => (s.player.stress = 40))).level.burnoutMonths).toBe(0);
  });
});
