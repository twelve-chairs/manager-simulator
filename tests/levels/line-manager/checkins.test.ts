import { describe, expect, it } from 'vitest';
import { LINE_TUNING, lineManagerLevel as L, view, type LineState } from '../../../src/levels/line-manager';
import type { SimState } from '../../../src/sim';
import { begin, choose, end, patch, projects, quietRun, withItem } from './fixtures';

const C = () => LINE_TUNING.checkIn;

/** A quiet run whose first project is at high risk, so it is due a check-in. */
function risky(week = 0) {
  const q = quietRun(1);
  const p = projects(q.sim)[0]!;
  const sim = patch(q.sim, (s) => {
    s.week = week;
    s.projects[p]!.risk = 90;
  });
  return { level: q.level, sim, p };
}
const checkIns = (moments: { kind: string; ref: string }[]) => moments.filter((m) => m.kind === 'checkIn').map((m) => m.ref);

describe('project check-ins', () => {
  // @spec LINE-CHECK-001
  it('brings a check-in for a project at high risk, behind or overdue, once per cooldown', () => {
    const { level, sim, p } = risky();
    expect(checkIns(begin(level, sim).moments)).toEqual([p]);
    // a calm project on schedule brings none
    const q = quietRun(1);
    expect(checkIns(begin(q.level, q.sim).moments)).toEqual([]);
    // behind schedule: no progress at week 10 of a project due at week 20
    const behind = patch(q.sim, (s) => {
      s.week = 10;
      Object.assign(s.projects[p]!, { progress: 0, deadlineWeek: 20 });
    });
    expect(checkIns(begin(q.level, behind).moments)).toContain(p);
    const overdue = patch(behind, (s) => (s.projects[p]!.deadlineWeek = 8));
    expect(checkIns(begin(q.level, overdue).moments)).toContain(p);
    // not again until the cooldown has passed
    const first = begin(level, sim);
    const at = (week: number) => patch(sim, (s) => (s.week = week));
    // (by then the other project, with no progress, is behind and due one of its own)
    const forP = (week: number) => checkIns(begin(first, at(week)).moments).filter((x) => x === p);
    expect(forP(C().cooldownWeeks - 1)).toEqual([]);
    expect(forP(C().cooldownWeeks)).toEqual([p]);
  });

  // @spec LINE-CHECK-002
  it('records the check-in and offers re-plan, cut scope, move the deadline and push on', () => {
    const { level, sim, p } = risky(3);
    const begun = begin(level, sim);
    const m = begun.moments.find((x) => x.kind === 'checkIn')!;
    expect(m.choices.map((c) => c.id)).toEqual(['replan', 'cutScope', 'moveDeadline', 'pushOn']);
    expect(begun.checkIns[p]).toBe(3);
    // waiting does not reset the cooldown
    const waited = end(begun, sim).level;
    expect(checkIns(begin(waited, patch(sim, (s) => (s.week = 4))).moments)).toEqual([]);
  });

  /** Answers the check-in for the risky project. */
  function answer(choiceId: string, setup: (s: SimState) => void = () => {}) {
    const r = risky();
    const sim = patch(r.sim, setup);
    const begun = begin(r.level, sim);
    const m = begun.moments.find((x) => x.kind === 'checkIn')!;
    return { before: sim, after: choose(begun, sim, m.id, choiceId), p: r.p };
  }

  // @spec LINE-CHECK-003
  it('re-plans: the player’s stress rises and the project’s risk falls', () => {
    const { before, after, p } = answer('replan');
    expect(after.sim.player.stress).toBe(before.player.stress + C().replanStress);
    expect(after.sim.projects[p]!.risk).toBe(before.projects[p]!.risk - C().replanRisk);
    expect(after.reaction.length).toBeGreaterThan(0);
  });

  // @spec LINE-CHECK-004
  it('cuts scope by a share of the remaining work, at least 1 and never below progress, for a little reputation', () => {
    const { before, after, p } = answer('cutScope', (s) => Object.assign(s.projects[projects(s)[0]!]!, { scope: 100, progress: 40 }));
    expect(after.sim.projects[p]!.scope).toBe(100 - Math.max(1, Math.round(C().scopeShare * 60)));
    expect(after.sim.player.reputation).toBe(before.player.reputation + C().scopeReputation);
    // scope is kept in whole points: with one point left, cutting scope cuts that point and no more
    const nearly = answer('cutScope', (s) => Object.assign(s.projects[projects(s)[0]!]!, { scope: 100, progress: 99 }));
    expect(nearly.after.sim.projects[p]!.scope).toBe(99);
  });

  // @spec LINE-CHECK-005
  it('moves the deadline out, for more reputation than cutting scope', () => {
    const { before, after, p } = answer('moveDeadline');
    expect(after.sim.projects[p]!.deadlineWeek).toBe(before.projects[p]!.deadlineWeek + C().deadlineWeeks);
    const cut = answer('cutScope').after.sim.player.reputation;
    expect(after.sim.player.reputation).toBeLessThan(cut);
  });

  // @spec LINE-CHECK-006
  it('changes nothing when the player pushes on', () => {
    const { before, after } = answer('pushOn');
    expect(after.sim).toEqual(before);
  });
});

describe('what a check-in and a night page say', () => {
  const textOf = (level: LineState, sim: SimState, kind: string) => view(level, sim).moments.find((m) => m.kind === kind)!.text;

  // @spec LINE-CHECK-007
  it('names the one reason a project is due a check-in: overdue, then behind, then high risk', () => {
    const { level, sim, p } = risky();
    expect(textOf(begin(level, sim), sim, 'checkIn')).toContain('high risk');
    const behind = patch(sim, (s) => {
      s.week = 10;
      Object.assign(s.projects[p]!, { progress: 0, deadlineWeek: 20 });
    });
    expect(textOf(begin(level, behind), behind, 'checkIn')).toContain('behind schedule');
    const overdue = patch(behind, (s) => (s.projects[p]!.deadlineWeek = 8));
    const text = textOf(begin(level, overdue), overdue, 'checkIn');
    expect(text).toContain('overdue');
    expect(text).not.toContain('behind');
    expect(text).not.toContain('or at risk');
  });

  // @spec LINE-MOMENT-005
  it('says a change from the project took production down, and who is on call', () => {
    const q = quietRun(1);
    const p = projects(q.sim)[0]!;
    const l = withItem(q.level, { kind: 'onCall', subject: { kind: 'project', id: p }, size: 8, difficulty: 30, lastWeek: q.sim.week }).level;
    const begun = begin(l, q.sim);
    const m = begun.moments.find((x) => x.kind === 'onCall')!;
    const text = textOf(begun, q.sim, 'onCall');
    expect(text).toContain(`A change from ${q.sim.projects[p]!.name} has taken production down`);
    expect(text).toContain(q.sim.people[m.personId!]!.name);
    expect(text).not.toContain(`${q.sim.projects[p]!.name} is down`);
  });
});

describe('check-ins among the week’s moments', () => {
  // @spec LINE-MOMENT-001, LINE-MOMENT-002
  it('comes after pages and before interviews and work, on Monday morning', () => {
    const { level, sim, p } = risky();
    let l = { ...level, vacancies: [{ id: 'v1', interviews: 0 }] };
    l = withItem(l, { kind: 'onCall', subject: { kind: 'project', id: p }, size: 8, difficulty: 30, lastWeek: sim.week }).level;
    for (let i = 0; i < 6; i++) l = withItem(l, { kind: 'designReview', subject: { kind: 'project', id: p }, lastWeek: sim.week + 2 + i, id: `w${i}` }).level;
    const moments = begin(l, sim).moments;
    expect(moments.map((m) => m.kind)).toEqual(['onCall', 'checkIn', 'interview', 'work', 'work'].slice(0, LINE_TUNING.levelMomentCap));
    expect(moments.find((m) => m.kind === 'checkIn')).toMatchObject({ day: 0, time: 'morning' });
  });

  // @spec LINE-MOMENT-004
  it('changes nothing when a check-in is left unanswered', () => {
    const { level, sim, p } = risky();
    const begun = begin(level, sim);
    const ended = end(begun, sim);
    const plain = end({ ...begun, moments: begun.moments.filter((m) => m.kind !== 'checkIn') }, sim);
    expect(ended.level.moments.find((m) => m.kind === 'checkIn')!.status).toBe('waited');
    expect(ended.sim.projects[p]).toEqual(plain.sim.projects[p]);
    expect(ended.sim.player).toEqual(plain.sim.player);
  });

  // @spec LINE-CONTRACT-005
  it('reports a check-in closed once its project is no longer active', () => {
    const { level, sim, p } = risky();
    const begun = begin(level, sim);
    const id = begun.moments.find((m) => m.kind === 'checkIn')!.id;
    expect(L.moments(begun, sim).find((m) => m.id === id)!.open).toBe(true);
    const done = patch(sim, (s) => (s.projects[p]!.status = 'completed'));
    expect(L.moments(begun, done).find((m) => m.id === id)!.open).toBe(false);
  });
});
