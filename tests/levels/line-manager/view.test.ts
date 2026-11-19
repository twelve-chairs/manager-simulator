import { describe, expect, it } from 'vitest';
import { band, view } from '../../../src/levels/line-manager';
import { commit, engineers, nextWeek, only, patch, projects, run, withDemand } from './fixtures';

describe('the player view', () => {
  // @spec LINE-VIS-001
  it('shows each active engineer with name, role, tenure and performance level', () => {
    let { level, sim } = run(2);
    ({ level, sim } = nextWeek(level, sim));
    const v = view(level, sim);
    expect(v.people.map((p) => p.id)).toEqual(engineers(sim));
    for (const p of v.people) {
      const s = sim.people[p.id]!;
      expect(p).toMatchObject({ name: s.name, role: s.role, tenureWeeks: sim.week - s.joinedWeek, performance: s.performance });
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
    const start = only(level, sim);
    expect(view(start, sim).people.every((p) => p.want === 'unknown')).toBe(true);
    const after = commit(only(start, sim, { action: 'line-manager.one-on-one', target: { kind: 'person', id: first }, cadence: 'once' }), sim);
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
  it('shows the player reputation and stress only as bands', () => {
    const { level, sim } = run(2);
    expect(view(level, sim).player).toEqual({ reputation: band(sim.player.reputation), stress: band(sim.player.stress) });
  });

  // @spec LINE-VIS-007
  it('shows the calendar, vacancies and inbox', () => {
    const { level, sim } = run(2);
    const project = projects(sim)[0]!;
    const { level: withOne, id } = withDemand(level, { type: 'designReview', subject: { kind: 'project', id: project }, hours: 3, lastWeek: 2, difficulty: 70 });
    const v = view(withOne, sim);
    expect(v.calendar).toEqual(withOne.calendar);
    expect(v.vacancies).toEqual([]);
    expect(v.inbox).toEqual([{ id, type: 'designReview', subject: { kind: 'project', id: project }, hours: 3, lastWeek: 2, difficulty: band(70) }]);
  });

  // @spec LINE-VIS-008, LINE-VIS-009
  it('bands every value on one scale over 0 to 100', () => {
    const bands = Array.from({ length: 101 }, (_, v) => band(v));
    expect(bands[0]).toBe(0);
    for (let v = 1; v <= 100; v++) expect(bands[v]!).toBeGreaterThanOrEqual(bands[v - 1]!);
    expect(new Set(bands).size).toBeGreaterThan(2);
    // a demand's difficulty band compares directly with a person's skill band
    const { level, sim } = run(2);
    const e = engineers(sim)[0]!;
    const { level: l } = withDemand(level, { type: 'approval', subject: { kind: 'project', id: projects(sim)[0]! }, difficulty: sim.people[e]!.skill });
    expect(view(l, sim).inbox[0]!.difficulty).toBe(view(l, sim).people.find((p) => p.id === e)!.skill);
  });
});
