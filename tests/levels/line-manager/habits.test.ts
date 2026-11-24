import { describe, expect, it } from 'vitest';
import { LINE_TUNING, setHabit } from '../../../src/levels/line-manager';
import { beginWeek } from '../../../src/levels/line-manager';
import { begin, end, engineers, expectRefused, habit, nextWeek, patch, projects, quietRun, run, withItem } from './fixtures';

const actionCauses = (log: { cause: { kind: string; actionId?: string } }[]) =>
  new Set(log.filter((x) => x.cause.kind === 'action').map((x) => x.cause.actionId));

describe('habits', () => {
  // @spec LINE-HABIT-001
  it('starts every run with the default habits', () => {
    expect(run(1).level.habits).toEqual({ nightPages: 'rotation', oneOnOnes: 'fortnightly', approvals: 'me', ceremonies: 'full', growth: 'nobody' });
  });

  // @spec LINE-HABIT-002
  it('applies a change to this week’s habit effects and later weeks’ moments, not moments already made', () => {
    let { level, sim } = quietRun(1);
    const [a] = engineers(sim) as [string];
    level = withItem(level, { kind: 'onCall', subject: { kind: 'project', id: projects(sim)[0]! }, size: 8, difficulty: 90, lastWeek: 0 }).level;
    level = begin(level, sim);
    const onCall = level.moments.find((m) => m.kind === 'onCall');
    expect(onCall).toBeDefined();
    level = habit(level, sim, 'nightPages', 'me');
    expect(level.moments.find((m) => m.kind === 'onCall')).toEqual(onCall);
    level = habit(level, sim, 'growth', a);
    const ended = end(level, sim);
    expect(ended.sim.people[a]!.skill).toBeGreaterThan(sim.people[a]!.skill);
  });

  // @spec LINE-HABIT-003
  it('rejects unknown habits, unknown options and engineers not on the team', () => {
    const { level, sim } = run(1);
    const before = structuredClone(level);
    for (const [id, value] of [['coffee', 'yes'], ['nightPages', 'never'], ['growth', 'nobody-here'], ['approvals', 'e999']] as const) {
      const result = setHabit(level, sim, id as never, value);
      expectRefused(result, level, sim, before, sim);
    }
    const gone = patch(sim, (s) => (s.people[engineers(sim)[0]!]!.status = 'departed'));
    expect(setHabit(level, gone, 'growth', engineers(sim)[0]!).ok).toBe(false);
  });

  // @spec LINE-HABIT-004
  it('falls back when a habit’s engineer leaves, and says so in the recap', () => {
    let { level, sim } = quietRun(1);
    const [a, b] = engineers(sim) as [string, string];
    level = habit(habit(level, sim, 'approvals', a), sim, 'growth', b);
    const gone = patch(sim, (s) => {
      s.people[a]!.status = 'departed';
      s.people[b]!.status = 'departed';
    });
    const ended = end(level, gone);
    expect(ended.level.habits.approvals).toBe('me');
    expect(ended.level.habits.growth).toBe('nobody');
    expect(ended.recap.habitChanges.length).toBe(2);
  });

  // @spec LINE-HABIT-004
  it('falls back as soon as a week begins, and reports it once', () => {
    let { level, sim } = run(1);
    const [a] = engineers(sim) as [string];
    level = habit(level, sim, 'approvals', a);
    const gone = patch(sim, (s) => (s.people[a]!.status = 'departed'));
    const begun = beginWeek(level, gone);
    expect(begun.habits.approvals).toBe('me');
    const ended = end(begun, gone);
    expect(ended.recap.habitChanges).toHaveLength(1);
    expect(end(ended.level, gone).recap.habitChanges).toEqual([]);
  });

  // @spec LINE-HABIT-005
  it('applies the week’s habit effects as one batch caused by each habit', () => {
    let { level, sim } = quietRun(1);
    level = habit(level, sim, 'growth', engineers(sim)[0]!);
    const ended = end(level, sim);
    const causes = actionCauses(ended.log);
    expect(causes.has('line-manager.habit.ceremonies')).toBe(true);
    expect(causes.has('line-manager.habit.growth')).toBe(true);
    expect(causes.has('line-manager.habit.one-on-ones')).toBe(true);
  });
});

describe('night pages', () => {
  const page = (level: ReturnType<typeof quietRun>['level'], sim: ReturnType<typeof quietRun>['sim']) =>
    withItem(level, { kind: 'onCall', subject: { kind: 'project', id: projects(sim)[0]! }, size: 8, difficulty: 30, lastWeek: sim.week }).level;

  // @spec LINE-HABIT-010
  it('has the player take every page themselves, at a stress cost, with no moment', () => {
    const { level, sim } = quietRun(1);
    const mine = habit(level, sim, 'nightPages', 'me');
    const paged = begin(page(mine, sim), sim);
    expect(paged.moments.filter((m) => m.kind === 'onCall')).toEqual([]);
    const withPage = end(paged, sim);
    const withoutPage = end(begin(mine, sim), sim);
    expect(withPage.sim.player.stress).toBeGreaterThan(withoutPage.sim.player.stress);
    expect(withPage.recap.expired).toEqual([]);
  });

  // @spec LINE-HABIT-010
  it('has the player take any page that had no moment, whatever the habit is by the week’s end', () => {
    const { level, sim } = quietRun(1);
    // arrived while the player was taking pages, then the habit changed
    const paged = begin(page(habit(level, sim, 'nightPages', 'me'), sim), sim);
    const switched = end(habit(paged, sim, 'nightPages', 'rotation'), sim);
    const unpaged = end(habit(begin(habit(level, sim, 'nightPages', 'me'), sim), sim, 'nightPages', 'rotation'), sim);
    expect(switched.recap.expired).toEqual([]);
    expect(switched.sim.player.stress).toBeGreaterThan(unpaged.sim.player.stress);
    // nobody to put on call
    const empty = patch(sim, (s) => engineers(sim).forEach((id) => (s.people[id]!.status = 'departed')));
    const alone = end(begin(page(level, empty), empty), empty);
    expect(alone.recap.expired).toEqual([]);
    expect(alone.sim.player.stress).toBeGreaterThan(end(begin(level, empty), empty).sim.player.stress);
  });

  // @spec LINE-HABIT-011
  it('rotates pages beyond the engineer on call through the team by week, or gives them to the most skilled', () => {
    const q = quietRun(1);
    const level = q.level;
    // Everyone below the page's difficulty, so every page is a moment.
    const sim = patch(q.sim, (s) => engineers(q.sim).forEach((id) => (s.people[id]!.skill = 30)));
    const page = (l: typeof level, s: typeof sim) =>
      withItem(l, { kind: 'onCall', subject: { kind: 'project', id: projects(s)[0]! }, size: 8, difficulty: 90, lastWeek: s.week }).level;
    const people = engineers(sim);
    const onCallIn = (week: number) => {
      const s = patch(sim, (st) => (st.week = week));
      const l = begin(page(level, s), s);
      return l.moments.filter((m) => m.kind === 'onCall').map((m) => m.personId);
    };
    expect(onCallIn(0)).toEqual([people[0]]);
    expect(onCallIn(1)).toEqual([people[1]]);
    expect(onCallIn(people.length)).toEqual([people[0]]);
    // two pages in one week both go to that week's engineer
    const two = begin(page(page(level, sim), sim), sim);
    expect(two.moments.filter((m) => m.kind === 'onCall').map((m) => m.personId)).toEqual([people[0], people[0]]);

    const skilled = patch(sim, (s) => (s.people[people[3]!]!.skill = 70));
    const seniors = begin(page(habit(level, skilled, 'nightPages', 'seniors'), skilled), skilled);
    expect(seniors.moments.filter((m) => m.kind === 'onCall').map((m) => m.personId)).toEqual([people[3]]);
  });

  // @spec LINE-HABIT-011, LINE-HABIT-017
  it('lets the engineer on call handle a page their skill reaches, with no moment, as if left to them', () => {
    const q = quietRun(1);
    const [first] = engineers(q.sim);
    const sim = patch(q.sim, (s) => (s.people[first!]!.skill = 70));
    const routine = withItem(q.level, { kind: 'onCall', subject: { kind: 'project', id: projects(sim)[0]! }, size: 8, difficulty: 65, lastWeek: sim.week }).level;
    const begun = begin(routine, sim);
    expect(begun.moments.filter((m) => m.kind === 'onCall')).toEqual([]);
    const ended = end(begun, sim);
    const quiet = end(begin(q.level, sim), sim);
    const who = ended.sim.people[first!]!;
    expect(who.stress - quiet.sim.people[first!]!.stress).toBe(LINE_TUNING.work.delegateStress);
    expect(who.history.filter((h) => h.week === sim.week).map((h) => h.note)).toContain('Handled a night page alone');
    expect(ended.sim.player.stress).toBe(quiet.sim.player.stress);
    expect(ended.sim.player.reputation).toBe(quiet.sim.player.reputation);
    expect(ended.recap.expired).toEqual([]);
    expect(ended.level.items.filter((i) => i.kind === 'onCall')).toEqual([]);
    expect(ended.recap.habits).toContain(`${who.name} handled 1 night page on their own.`);
  });
});

describe('1:1s', () => {
  // @spec LINE-HABIT-012, LINE-VIS-003
  it('holds 1:1s by cadence, building trust, learning wants and costing the player', () => {
    const { level, sim } = quietRun(1);
    const people = engineers(sim);
    const held = (cadence: string, week: number) => {
      const s = patch(sim, (st) => (st.week = week));
      const l = habit(level, s, 'oneOnOnes', cadence);
      const ended = end(l, s);
      const met = people.filter((id) => ended.sim.people[id]!.trust > s.people[id]!.trust);
      return { met, ended, stress: ended.sim.player.stress };
    };
    expect(held('weekly', 0).met).toEqual(people);
    expect(held('fortnightly', 0).met).toEqual(people.filter((_, i) => i % 2 === 0));
    expect(held('fortnightly', 1).met).toEqual(people.filter((_, i) => i % 2 === 1));
    expect(held('whenNeeded', 0).met).toEqual([]);
    expect(held('weekly', 0).stress).toBeGreaterThan(held('fortnightly', 0).stress);
    expect(held('fortnightly', 0).stress).toBeGreaterThan(held('whenNeeded', 0).stress);
    const weekly = held('weekly', 0).ended;
    expect(weekly.level.learnedWants[people[0]!]).toEqual({ want: sim.people[people[0]!]!.want, week: 0 });
    expect(weekly.sim.people[people[0]!]!.history.some((h) => h.cause.kind === 'action' && h.cause.actionId === 'line-manager.habit.one-on-ones')).toBe(true);
  });
});

describe('routine approvals', () => {
  // @spec LINE-HABIT-013, LINE-WORK-001
  it('has the player sign routine items, a little stress each, with no moments', () => {
    let { level, sim } = quietRun(1);
    const p = { kind: 'project' as const, id: projects(sim)[0]! };
    level = withItem(withItem(level, { kind: 'approval', subject: p, lastWeek: 1 }).level, { kind: 'expense', subject: { kind: 'person', id: engineers(sim)[0]! }, lastWeek: 1 }).level;
    level = begin(level, sim);
    expect(level.moments.filter((m) => m.kind === 'work')).toEqual([]);
    const ended = end(level, sim);
    expect(ended.level.items).toEqual([]);
    const without = end(begin(quietRun(1).level, sim), sim);
    expect(ended.sim.player.stress).toBeGreaterThan(without.sim.player.stress);
  });

  // @spec LINE-HABIT-014
  it('has a named engineer sign what they can, serving autonomy, and leaves the rest to expire', () => {
    let { level, sim } = quietRun(1);
    const [a] = engineers(sim) as [string];
    const s = patch(sim, (st) => (st.people[a]!.want = 'autonomy'));
    const p = { kind: 'project' as const, id: projects(sim)[0]! };
    level = habit(level, s, 'approvals', a);
    level = withItem(level, { kind: 'approval', subject: p, difficulty: 30, lastWeek: 0, id: 'easy' }).level;
    level = withItem(level, { kind: 'approval', subject: p, difficulty: 90, lastWeek: 0, id: 'hard' }).level;
    const ended = end(begin(level, s), s);
    expect(ended.sim.people[a]!.stress).toBeGreaterThan(s.people[a]!.stress);
    expect(ended.sim.people[a]!.wantServedWeek).toBe(s.week);
    expect(ended.recap.expired.map((e) => e.itemId)).toEqual(['hard']);
  });

  // @spec LINE-HABIT-014
  it('never lets the signer approve their own expense: it comes to the player', () => {
    let { level, sim } = quietRun(1);
    const [a] = engineers(sim) as [string];
    level = habit(level, sim, 'approvals', a);
    level = withItem(level, { kind: 'expense', subject: { kind: 'person', id: a }, difficulty: 10, lastWeek: 0, id: 'own' }).level;
    const ended = end(begin(level, sim), sim);
    const without = end(begin(habit(quietRun(1).level, sim, 'approvals', a), sim), sim);
    expect(ended.level.items).toEqual([]);
    expect(ended.recap.expired).toEqual([]);
    expect(ended.sim.people[a]!.stress).toBe(without.sim.people[a]!.stress);
  });
});

describe('ceremonies and growth focus', () => {
  // @spec LINE-HABIT-015
  it('keeps risk steady and serves stability when full, lets risk creep when light', () => {
    const { level, sim } = quietRun(1);
    const stable = patch(sim, (s) => engineers(sim).forEach((id) => (s.people[id]!.want = 'stability')));
    const full = end(level, stable);
    const light = end(habit(level, stable, 'ceremonies', 'light'), stable);
    for (const id of engineers(sim)) {
      expect(full.sim.people[id]!.motivation).toBeGreaterThan(light.sim.people[id]!.motivation);
      expect(full.sim.people[id]!.wantServedWeek).toBe(sim.week);
    }
    for (const id of projects(sim)) expect(light.sim.projects[id]!.risk).toBeGreaterThan(full.sim.projects[id]!.risk);
    expect(full.sim.player.stress).toBeGreaterThan(light.sim.player.stress);
  });

  // @spec LINE-HABIT-016
  it('coaches the growth focus each week, serving growth and costing the player', () => {
    const { level, sim } = quietRun(1);
    const [a] = engineers(sim) as [string];
    const s = patch(sim, (st) => (st.people[a]!.want = 'growth'));
    const focused = end(habit(level, s, 'growth', a), s);
    const plain = end(level, s);
    expect(focused.sim.people[a]!.skill).toBeGreaterThan(plain.sim.people[a]!.skill);
    expect(focused.sim.people[a]!.wantServedWeek).toBe(s.week);
    expect(focused.sim.player.stress).toBeGreaterThan(plain.sim.player.stress);
    expect(focused.sim.people[a]!.history.some((h) => h.cause.kind === 'action' && h.cause.actionId === 'line-manager.habit.growth')).toBe(true);
    expect(nextWeek(habit(level, s, 'growth', a), s).recap.habits.length).toBeGreaterThan(0);
  });
});
