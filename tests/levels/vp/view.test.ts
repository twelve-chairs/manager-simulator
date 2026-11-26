import { describe, expect, it } from 'vitest';
import { band } from '../../../src/levels/line-manager';
import { setVpHabit, vpView } from '../../../src/levels/vp';
import { applyEffects } from '../../../src/sim';
import { vp } from './fixtures';

const RULE = { kind: 'rule', ruleId: 'test' } as const;

describe('what a VP sees', () => {
  // @spec VP-VIS-007
  it('marks the director who is restless, and no one else', () => {
    const { level, sim } = vp(2);
    const id = vpView(level, sim).directors[0]!.id;
    const marked = structuredClone(sim);
    marked.people[id]!.restlessSince = sim.week;
    const v = vpView(level, marked);
    expect(v.directors.map((p) => p.restless)).toEqual(v.directors.map((p) => p.id === id));
  });

  // @spec VP-VIS-001, VP-ORG-003
  it('shows each director as a person, their want only once revealed, and no card for a leaderless division', () => {
    const { level, sim } = vp(2);
    const v = vpView(level, sim);
    expect(v.directors).toHaveLength(3);
    for (const d of v.directors) {
      const p = sim.people[d.id]!;
      expect(d).toMatchObject({ name: p.name, divisionId: expect.any(String), motivation: band(p.motivation), stress: band(p.stress), skill: band(p.skill), want: 'unknown' });
    }
    const known = { ...level, learnedWants: { [v.directors[0]!.id]: true as const } };
    expect(vpView(known, sim).directors[0]!.want).toBe(sim.people[v.directors[0]!.id]!.want);
    const gone = applyEffects(sim, [{ type: 'remove', personId: v.directors[1]!.id, reason: 'quit', cause: RULE }]);
    if (!gone.ok) throw new Error(gone.error.message);
    const after = vpView(level, gone.state);
    expect(after.directors).toHaveLength(2);
    expect(after.divisions.find((g) => g.id === v.directors[1]!.divisionId)!.directorId).toBeNull();
  });

  // @spec VP-VIS-002
  it('shows each division’s headcount and projects as they are, and its mood as last surveyed', () => {
    const { level, sim } = vp(2);
    expect(level.survey.quarter).toBe(1);
    const g = level.divisionIds[1]!;
    const was = sim.teams[g]!.aggregate!;
    const worse = applyEffects(sim, [{ type: 'value', target: { kind: 'team', id: g }, field: 'stress', amount: 60, cause: RULE }, { type: 'value', target: { kind: 'team', id: g }, field: 'headcount', amount: 2, cause: RULE }]);
    if (!worse.ok) throw new Error(worse.error.message);
    const seen = vpView(level, worse.state).divisions.find((x) => x.id === g)!;
    expect(seen).toMatchObject({ headcount: was.headcount + 2, stress: band(was.stress), motivation: band(was.motivation), quarter: 1 });
    expect(seen.projects).toHaveLength(2);
  });

  // @spec VP-VIS-003
  it('shows the CEO and both peers with their trust in the player as a band', () => {
    const { level, sim } = vp(2);
    const v = vpView(level, sim);
    expect(v.leadership.map((u) => u.role)).toEqual(['executive', 'peer', 'peer']);
    for (const u of v.leadership) expect(u).toMatchObject({ trust: band(sim.people[u.id]!.trust), want: 'unknown', name: sim.people[u.id]!.name });
  });

  // @spec VP-VIS-004
  it('shows the year’s headcount and the company priority once set', () => {
    const { level, sim } = vp(2);
    expect(vpView(level, sim).plan).toEqual({ given: null, arrived: 0, priority: null });
    const project = Object.values(sim.projects).find((p) => p.teamId === level.divisionIds[2] && p.status === 'active')!;
    const set = { ...level, year: { quarter: 1, given: 9, arrived: 3, due: [2, 2, 2], askedMore: false }, priority: { projectId: project.id, divisionId: level.divisionIds[2]!, stake: 10, week: sim.week, spreadSlow: 0 } };
    expect(vpView(set, sim).plan).toEqual({
      given: 9,
      arrived: 3,
      priority: { projectId: project.id, name: project.name, divisionId: level.divisionIds[2], progress: project.progress, scope: project.scope, deadlineWeek: project.deadlineWeek, schedule: expect.any(String), stake: 10 },
    });
  });

  // @spec VP-VIS-005
  it('gives the habits, energy and reputation as bands, and the career summary', () => {
    const { level, sim } = vp(2);
    const v = vpView(level, sim);
    expect(v.habits).toEqual(level.habits);
    expect(v.player).toMatchObject({ energy: band(100 - sim.player.stress), reputation: band(sim.player.reputation), edge: { at: expect.any(Boolean), quarters: 0, limit: 2 } });
    expect(v.career).toEqual({ quarters: 0, joined: [], letGo: [] });
  });

  // @spec VP-VIS-006
  it('never shows leniency, nor any group, team or person inside a division', () => {
    const { level, sim } = vp(6);
    const text = JSON.stringify(vpView(level, sim));
    expect(text).not.toMatch(/leniency/i);
    for (const p of Object.values(sim.people).filter((x) => x.status === 'aggregated')) expect(text).not.toContain(p.name);
  });
});

describe('a VP’s habits', () => {
  // @spec VP-HABIT-002, VP-HABIT-003
  it('changes a habit to a known option, and rejects unknown habits and options without changing the state', () => {
    const { level, sim } = vp(2);
    const changed = setVpHabit(level, sim, { habit: 'firstTeam', value: 'leadership' });
    if (!changed.ok) throw new Error(changed.error);
    expect(changed.level.habits.firstTeam).toBe('leadership');
    expect(level.habits.firstTeam).toBe('function');
    const before = structuredClone(level);
    for (const bad of [null, 'x', { habit: 'time', value: 'upward' }, { habit: 'directors', value: 'micromanage' }, { habit: '__proto__', value: 'x' }]) {
      expect(setVpHabit(level, sim, bad).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(level).toEqual(before);
  });
});
