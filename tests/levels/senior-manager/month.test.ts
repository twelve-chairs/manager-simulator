import { describe, expect, it } from 'vitest';
import { SENIOR_TUNING, afterAdvanceSenior, endMonth, headsLostLastMonth, quitLastMonth, setSeniorHabit, shippedLastMonth, type SeniorState } from '../../../src/levels/senior-manager';
import { remember } from '../../../src/levels/senior-manager/review';
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
  it('backfills a head lost to attrition even when the player answers a moment before the month ends', () => {
    const { level, sim } = senior(6);
    const teamId = level.teamIds[1]!;
    const before = sim.teams[teamId]!.aggregate!.headcount;
    // the simulation advances and a head leaves
    const left = edit(sim, (s) => {
      const a = s.teams[teamId]!.aggregate!;
      a.headcount -= 1;
      a.ratings.unrated -= 1;
    });
    let l = afterAdvanceSenior(withHabits(level, { backfill: 'fast' }), left).level;
    // answering a moment remembers the teams as they are now; the loss must not be forgotten
    remember(l, left);
    // fast backfill: the head is replaced by the end of the month
    expect(month(l, left).sim.teams[teamId]!.aggregate!.headcount).toBe(before);
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
      Object.assign(s.teams[teamId]!.aggregate!, { motivation: 50, stress: 40 });
    });
    const coaching = withHabits(level, { oneOnOnes: 'monthly' });
    const strong = month(coaching, setup(85)).sim.teams[teamId]!.aggregate!;
    const weak = month(coaching, setup(15)).sim.teams[teamId]!.aggregate!;
    expect(strong.motivation).toBeGreaterThan(50);
    expect(strong.stress).toBeLessThan(40);
    expect(weak.motivation).toBeLessThan(50);
    expect(weak.stress).toBeGreaterThan(40);
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

  // @spec SENIOR-DRIFT-003
  it('counts a month that serves a manager’s want as serving it, so the simulation’s want drift does not wear them down', () => {
    const { level, sim } = senior(10);
    const [m] = managers(level, sim);
    const later = edit(sim, (s) => {
      Object.assign(s.people[m!]!, { want: 'growth' });
      s.week += 20;
    });
    expect(month(level, later).sim.people[m!]!.wantServedWeek).toBe(later.week);
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

describe('managers who quit', () => {
  // @spec SENIOR-RECAP-003
  it('reports each manager who quit in the month just played, with what led to it and the last thing between you', () => {
    const { level, sim } = senior(1);
    const [m, other] = managers(level, sim);
    const end = sim.week + 4;
    const after = edit(sim, (s) => {
      s.week = end;
      Object.assign(s.people[m!]!, { status: 'departed', departure: { week: end - 4, reason: 'quit' }, lowMotivationWeeks: 0, highStressWeeks: 8, trust: 70 });
      s.people[m!]!.history.push({ week: end - 6, cause: { kind: 'rule', ruleId: 'x' }, note: 'Agreed to give managing another year' });
      Object.assign(s.people[other!]!, { status: 'departed', departure: { week: end - 8, reason: 'quit' } });
    });
    expect(quitLastMonth(level, after)).toEqual([
      { personId: m, name: sim.people[m!]!.name, lowMotivationWeeks: 0, highStressWeeks: 8, lowTrust: false, lastMemory: 'Agreed to give managing another year' },
    ]);
  });
});

describe('engineers who left a team', () => {
  // @spec SENIOR-RECAP-004
  it('reports each team that lost heads in the month just played, and how many were rated meets or better', () => {
    const { level, sim } = senior(1);
    const [t1, t2] = level.teamIds as [string, string];
    remember(level, sim);
    const ratings = sim.teams[t1]!.aggregate!.ratings;
    const keep = ratings.meets > 0 ? 'meets' : ratings.exceeds > 0 ? 'exceeds' : 'outstanding';
    const after = edit(sim, (s) => {
      s.week += 4;
      const a = s.teams[t1]!.aggregate!;
      a.headcount -= 2;
      a.ratings[keep] -= 1;
      a.ratings.partial += 0;
    });
    const advanced = afterAdvanceSenior(level, after).level;
    expect(headsLostLastMonth(advanced, after)).toEqual([{ teamId: t1, name: sim.teams[t1]!.name, count: 2, regretted: 1 }]);
    expect(headsLostLastMonth(advanced, after).some((x) => x.teamId === t2)).toBe(false);
    // a month later, nothing new
    expect(headsLostLastMonth(advanced, edit(after, (s) => (s.week += 4)))).toEqual([]);
  });
});

describe('shipped projects', () => {
  // @spec SENIOR-RECAP-002
  it('reports the projects of the player’s teams completed in the month just played, with their team, and how late', () => {
    const { level, sim } = senior(2);
    const mine = Object.values(sim.projects).filter((p) => level.teamIds.includes(p.teamId) && p.status === 'active');
    const [a, b] = mine;
    const end = sim.week + 4;
    const done = edit(sim, (s) => {
      s.week = end;
      Object.assign(s.projects[a!.id]!, { status: 'completed', deadlineWeek: end - 1 });
      Object.assign(s.projects[b!.id]!, { status: 'completed', deadlineWeek: end - 4 - 2 });
    });
    const after = afterAdvanceSenior(level, done).level;
    const shipped = shippedLastMonth(after, done);
    expect(shipped).toHaveLength(2);
    expect(shipped).toEqual(expect.arrayContaining([
      { projectId: a!.id, name: a!.name, team: sim.teams[a!.teamId]!.name, weeksLate: 0 },
      { projectId: b!.id, name: b!.name, team: sim.teams[b!.teamId]!.name, weeksLate: 2 },
    ]));
    const later = edit(done, (s) => (s.week = end + 4));
    expect(shippedLastMonth(afterAdvanceSenior(after, later).level, later)).toEqual([]);
  });
});
