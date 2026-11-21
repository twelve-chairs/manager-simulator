import { describe, expect, it } from 'vitest';
import { band, view } from '../../../src/levels/line-manager';
import { begin, end, engineers, habit, nextWeek, patch, projects, quietRun, run, withItem } from './fixtures';

describe('the player view', () => {
  // @spec LINE-VIS-014
  it('sums up the career: projects shipped on time, who joined and who left', () => {
    const { level, sim } = run(2);
    const [p1, p2] = projects(sim) as [string, string];
    const [stayer, quitter, fired] = engineers(sim) as [string, string, string];
    const later = patch(sim, (s) => {
      s.week = 40;
      s.projects[p1]!.deadlineWeek = 30;
      s.projects[p2]!.deadlineWeek = 20;
      s.people[stayer]!.joinedWeek = 12;
      Object.assign(s.people[quitter]!, { status: 'departed', departure: { week: 20, reason: 'quit' } });
      Object.assign(s.people[fired]!, { status: 'departed', departure: { week: 30, reason: 'fired' } });
    });
    const v = view({ ...level, completions: { [p1]: 25, [p2]: 25 } }, later);
    expect(v.career.shippedOnTime).toBe(1);
    expect(v.career.joined).toEqual([{ id: stayer, name: later.people[stayer]!.name }]);
    expect(v.career.left).toEqual([
      { id: quitter, name: later.people[quitter]!.name, reason: 'quit' },
      { id: fired, name: later.people[fired]!.name, reason: 'fired' },
    ]);
  });

  // @spec LINE-VIS-001
  it('shows each active engineer with name, role, tenure, personality and performance level', () => {
    let { level, sim } = run(2);
    ({ level, sim } = nextWeek(level, sim));
    const v = view(level, sim);
    expect(v.people.map((p) => p.id)).toEqual(engineers(sim));
    for (const p of v.people) {
      const s = sim.people[p.id]!;
      expect(p).toMatchObject({ name: s.name, role: s.role, tenureWeeks: sim.week - s.joinedWeek, performance: s.performance, personality: s.personality });
    }
    const gone = patch(sim, (s) => (s.people[engineers(sim)[0]!]!.status = 'departed'));
    expect(view(level, gone).people).toHaveLength(4);
  });

  // @spec LINE-VIS-002
  it('shows motivation, stress and skill only as bands', () => {
    const { level, sim } = run(2);
    for (const p of view(level, sim).people) {
      const s = sim.people[p.id]!;
      expect(p.motivation).toBe(band(s.motivation));
      expect(p.stress).toBe(band(s.stress));
      expect(p.skill).toBe(band(s.skill));
    }
  });

  // @spec LINE-VIS-003
  it('reveals a want only after a 1:1', () => {
    const { level, sim } = run(2);
    const [first, second] = engineers(sim) as [string, string];
    expect(view(level, sim).people.every((p) => p.want === 'unknown')).toBe(true);
    // fortnightly 1:1s in week 0 meet the engineers at even positions: the first, not the second
    const after = end(level, sim);
    const v = view(after.level, after.sim);
    expect(v.people.find((p) => p.id === first)!.want).toBe(sim.people[first]!.want);
    expect(v.people.find((p) => p.id === second)!.want).toBe('unknown');
  });

  // @spec LINE-VIS-004
  it('never shows trust', () => {
    const { level, sim } = run(2);
    expect(JSON.stringify(view(level, sim))).not.toMatch(/trust/i);
  });

  // @spec LINE-VIS-005
  it('shows projects with progress, deadline and schedule exactly, and risk and tech debt as bands', () => {
    const { level, sim } = run(2);
    const [a, b] = projects(sim) as [string, string];
    const s = patch(sim, (st) => {
      st.week = 10;
      Object.assign(st.projects[a]!, { progress: st.projects[a]!.scope, deadlineWeek: 20 });
      Object.assign(st.projects[b]!, { progress: 0, deadlineWeek: 8 });
    });
    const v = view(level, s).projects;
    const pa = v.find((p) => p.id === a)!;
    expect(pa).toMatchObject({ progress: s.projects[a]!.progress, deadlineWeek: 20, schedule: 'onSchedule', risk: band(s.projects[a]!.risk), techDebt: band(s.projects[a]!.techDebt) });
    expect(v.find((p) => p.id === b)!.schedule).toBe('overdue');
    const behind = patch(s, (st) => Object.assign(st.projects[b]!, { deadlineWeek: 12 }));
    expect(view(level, behind).projects.find((p) => p.id === b)!.schedule).toBe('behind');
  });

  // @spec LINE-VIS-006
  it('shows the player’s energy and reputation only as bands', () => {
    const { level, sim } = run(2);
    expect(view(level, sim).player).toEqual({ energy: band(100 - sim.player.stress), reputation: band(sim.player.reputation) });
  });

  // @spec LINE-VIS-011
  it('shows what each engineer remembers: their three latest notes, newest first', () => {
    const { level, sim } = run(2);
    const [a] = engineers(sim) as [string];
    const s = patch(sim, (st) => {
      const h = st.people[a]!.history;
      h.push({ week: 1, cause: { kind: 'rule', ruleId: 'x' }, note: 'one' });
      h.push({ week: 2, cause: { kind: 'rule', ruleId: 'x' } });
      h.push({ week: 3, cause: { kind: 'rule', ruleId: 'x' }, note: 'two' });
      h.push({ week: 4, cause: { kind: 'rule', ruleId: 'x' }, note: 'three' });
      h.push({ week: 5, cause: { kind: 'rule', ruleId: 'x' }, note: 'four' });
    });
    expect(view(level, s).people.find((p) => p.id === a)!.memory).toEqual(['four', 'three', 'two']);
  });

  // @spec LINE-VIS-012
  it('shows habits, vacancies with interview counts, and the goals', () => {
    const { level, sim } = run(2);
    const l = { ...habit(level, sim, 'ceremonies', 'light'), vacancies: [{ id: 'v1', interviews: 1 }] };
    const v = view(begin(l, sim), sim);
    expect(v.habits).toEqual(l.habits);
    expect(v.vacancies).toEqual([{ id: 'v1', interviews: 1 }]);
    expect(v.goals.length).toBeGreaterThan(0);
  });

  // @spec LINE-VIS-013
  it('drops choices that name an engineer who has left', () => {
    const q = quietRun(2);
    const { level: l, id } = withItem(q.level, { kind: 'designReview', subject: { kind: 'project', id: projects(q.sim)[0]! }, difficulty: 50 });
    const begun = begin(l, q.sim);
    const give = begun.moments.find((m) => m.ref === id)!.choices.find((c) => c.id.startsWith('give:'))!;
    const gone = patch(q.sim, (s) => (s.people[give.id.slice('give:'.length)]!.status = 'departed'));
    const shown = view(begun, gone).moments.find((m) => m.ref === id)!.choices.map((c) => c.id);
    expect(shown).not.toContain(give.id);
    expect(shown).toContain('self');
  });

  // @spec LINE-VIS-009
  it('bands every value on one scale over 0 to 100', () => {
    const bands = Array.from({ length: 101 }, (_, v) => band(v));
    expect(bands[0]).toBe(0);
    for (let v = 1; v <= 100; v++) expect(bands[v]!).toBeGreaterThanOrEqual(bands[v - 1]!);
    expect(new Set(bands).size).toBeGreaterThan(2);
    // a work moment's difficulty band compares directly with a person's skill band
    const q = quietRun(2);
    const e = engineers(q.sim)[0]!;
    const { level: l, id } = withItem(q.level, { kind: 'designReview', subject: { kind: 'project', id: projects(q.sim)[0]! }, difficulty: q.sim.people[e]!.skill });
    const v = view(begin(l, q.sim), q.sim);
    expect(v.moments.find((m) => m.ref === id)!.difficulty).toBe(v.people.find((p) => p.id === e)!.skill);
  });
});
