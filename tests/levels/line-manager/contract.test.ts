import { describe, expect, it } from 'vitest';
import { LEVEL, assess, beginWeek, chooseMoment, endWeek, lineManagerLevel as L, setHabit, startRun, view } from '../../../src/levels/line-manager';
import { begin, engineers, patch, projects, quietRun, run, withItem } from './fixtures';

describe('the turn loop contract', () => {
  // @spec LINE-CONTRACT-005
  it('provides the level’s own operations', () => {
    const { level, sim } = run(4);
    expect(L.params).toEqual(LEVEL);
    expect(L.start(4)).toEqual(startRun(4));
    const begun = L.beginWeek(level, sim);
    expect(begun).toEqual(beginWeek(level, sim));
    const open = begun.moments.find((m) => m.status === 'open')!;
    expect(L.choose(begun, sim, open.id, open.choices[0]!.id)).toEqual(chooseMoment(begun, sim, open.id, open.choices[0]!.id));
    expect(L.endWeek(begun, sim)).toEqual(endWeek(begun, sim));
    expect(L.assess(begun, sim)).toEqual(assess(begun, sim));
    expect(L.assess(begun, sim).measures.some((m) => m.id.startsWith('goal:'))).toBe(true);
    expect(L.view(begun, sim)).toEqual(view(begun, sim));
  });

  // @spec LINE-CONTRACT-005
  it('lists the week’s moments with their day, time and whether they are open', () => {
    const { level, sim } = run(4);
    const begun = L.beginWeek(level, sim);
    expect(L.moments(begun, sim)).toEqual(begun.moments.filter((m) => m.week === sim.week).map((m) => ({ id: m.id, day: m.day, time: m.time, open: m.status === 'open', title: view(begun, sim).moments.find((x) => x.id === m.id)!.title })));
    const open = begun.moments.find((m) => m.status === 'open')!;
    const answered = L.choose(begun, sim, open.id, open.choices[0]!.id);
    if (!answered.ok) throw new Error(answered.error);
    expect(L.moments(answered.level, answered.sim).find((m) => m.id === open.id)!.open).toBe(false);
  });

  // @spec LINE-CONTRACT-005
  it('reports a moment closed once it can no longer be answered', () => {
    const q = quietRun(1);
    const p = { kind: 'project' as const, id: projects(q.sim)[0]! };
    let l = { ...q.level, vacancies: [{ id: 'v1', interviews: 0 }] };
    l = withItem(l, { kind: 'onCall', subject: p, size: 8, difficulty: 90, lastWeek: q.sim.week, id: 'page' }).level;
    l = withItem(l, { kind: 'designReview', subject: p, lastWeek: q.sim.week + 2, id: 'review' }).level;
    l = begin(l, q.sim);
    const openIn = (level: typeof l, sim: typeof q.sim) => Object.fromEntries(L.moments(level, sim).map((m) => [level.moments.find((x) => x.id === m.id)!.ref, m.open]));
    expect(openIn(l, q.sim)).toEqual({ page: true, v1: true, review: true });
    // the engineer on call leaves, the project is cancelled, the vacancy is filled
    const onCall = l.moments.find((m) => m.ref === 'page')!.personId!;
    const gone = patch(q.sim, (s) => (s.people[onCall]!.status = 'departed'));
    expect(openIn(l, gone).page).toBe(false);
    const cancelled = patch(q.sim, (s) => (s.projects[p.id]!.status = 'cancelled'));
    expect(openIn(l, cancelled)).toMatchObject({ page: false, review: false });
    expect(openIn({ ...l, vacancies: [] }, q.sim).v1).toBe(false);
  });

  // @spec LINE-CONTRACT-005
  it('takes habit changes as planning commands, checking their shape', () => {
    const { level, sim } = run(4);
    const [a] = engineers(sim) as [string];
    const planned = L.plan(level, sim, { kind: 'habit', habit: 'growth', value: a });
    const direct = setHabit(level, sim, 'growth', a);
    expect(planned).toEqual(direct);
    for (const bad of [null, 'habit', 42, [], {}, { kind: 'habit' }, { kind: 'habit', habit: 5, value: 'x' }, { kind: 'habit', habit: 'growth', value: { id: a } }, { kind: 'calendar', add: [] }]) {
      let result: { ok: boolean } | undefined;
      expect(() => (result = L.plan(level, sim, bad))).not.toThrow();
      expect(result!.ok).toBe(false);
    }
  });
});
