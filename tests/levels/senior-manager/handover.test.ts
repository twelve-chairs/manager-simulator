import { describe, expect, it } from 'vitest';
import { band } from '../../../src/levels/line-manager';
import { DEFAULT_SENIOR_HABITS, SENIOR_TUNING, handoverChoices, takeOver } from '../../../src/levels/senior-manager';
import { summarizeTeam } from '../../../src/levels/senior-manager/core';
import { engineersOf, promotedLine, senior } from './fixtures';

describe('the handover', () => {
  // @spec SENIOR-HAND-001
  it('offers each of the team’s engineers, with skill, trust and want, or an outside hire', () => {
    const line = promotedLine(3);
    const choices = handoverChoices(line.level, line.sim);
    expect(choices.map((c) => c.id)).toEqual([...engineersOf(line), 'hire']);
    for (const c of choices.slice(0, -1)) {
      const p = line.sim.people[c.id]!;
      expect(c).toEqual({ id: p.id, name: p.name, skill: p.skill, trust: p.trust, want: p.want });
    }
    expect(choices.at(-1)).toEqual({ id: 'hire', name: 'An outside hire' });
  });

  // @spec SENIOR-HAND-002
  it('makes a chosen engineer the team’s manager, developing if they trust you and want growth, learning otherwise, a head short', () => {
    const line = promotedLine(3);
    const [first, second] = engineersOf(line);
    const grows = promotedLine(3, (s) => Object.assign(s.people[first!]!, { trust: 70, want: 'growth', skill: 90 }));
    const r = takeOver(grows.level, grows.sim, first!);
    if (!r.ok) throw new Error(r.error);
    const lead = r.sim.people[first!]!;
    expect(lead.role).toBe('manager');
    expect(r.sim.teams[line.level.teamId]!.leader).toEqual({ kind: 'person', id: first });
    expect(band(lead.skill)).toBe(1); // developing: a strong engineer is not thereby a good manager
    expect(r.sim.teams[line.level.teamId]!.aggregate!.headcount).toBe(engineersOf(line).length - 1);
    expect(r.level.backfills).toEqual([{ teamId: line.level.teamId, since: r.level.startWeek, months: 0 }]);
    const other = promotedLine(3, (s) => Object.assign(s.people[second!]!, { trust: 70, want: 'stability' }));
    const r2 = takeOver(other.level, other.sim, second!);
    if (!r2.ok) throw new Error(r2.error);
    expect(band(r2.sim.people[second!]!.skill)).toBe(0); // learning
  });

  // @spec SENIOR-HAND-003
  it('brings in an outside hire as a capable manager with trust 50, and the team is stressed while it adjusts', () => {
    const line = promotedLine(4);
    const before = summarizeTeam(line.sim, line.level.teamId);
    const r = takeOver(line.level, line.sim, 'hire');
    if (!r.ok) throw new Error(r.error);
    const team = r.sim.teams[line.level.teamId]!;
    const lead = r.sim.people[(team.leader as { id: string }).id]!;
    expect(lead).toMatchObject({ role: 'manager', trust: 50, status: 'active' });
    expect(band(lead.skill)).toBe(2);
    expect(team.aggregate!.headcount).toBe(engineersOf(line).length);
    expect(team.aggregate!.stress).toBe(Math.min(100, before.stress + SENIOR_TUNING.hireStress));
    expect(r.level.backfills).toEqual([]);
  });

  // @spec SENIOR-HAND-004
  it('names every project at the handover unlike any other', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const names = Object.values(senior(seed).sim.projects).map((p) => p.name);
      expect(new Set(names).size, `seed ${seed}: ${names.join(', ')}`).toBe(names.length);
    }
  });

  // @spec SENIOR-HAND-004
  it('folds the old team into an aggregate under its manager, keeping its projects, and adds two more teams', () => {
    const line = promotedLine(5);
    const projects = Object.values(line.sim.projects).filter((p) => p.teamId === line.level.teamId).map((p) => p.id);
    const { level, sim } = senior(5);
    expect(sim.teams[line.level.teamId]!.form).toBe('aggregate');
    expect(Object.values(sim.projects).filter((p) => p.teamId === line.level.teamId).map((p) => p.id)).toEqual(projects);
    expect(level.teamIds).toHaveLength(3);
    expect(level.teamIds[0]).toBe(line.level.teamId);
    for (const id of level.teamIds.slice(1)) {
      const team = sim.teams[id]!;
      expect(team.form).toBe('aggregate');
      expect(team.aggregate!.headcount).toBeGreaterThanOrEqual(1);
      expect(sim.people[(team.leader as { id: string }).id]!.role).toBe('manager');
      const active = Object.values(sim.projects).filter((p) => p.teamId === id && p.status === 'active');
      expect(active.length).toBeGreaterThanOrEqual(1);
      expect(active.length).toBeLessThanOrEqual(2);
    }
  });

  // @spec SENIOR-HAND-005
  it('keeps the player’s energy, reputation and ratings, and the old engineers’ histories', () => {
    const line = promotedLine(6);
    const { sim } = senior(6);
    expect(sim.player).toEqual(line.sim.player);
    for (const id of engineersOf(line)) {
      expect(sim.people[id]!.status).toBe('aggregated');
      expect(sim.people[id]!.history).toEqual(line.sim.people[id]!.history);
    }
  });

  // @spec SENIOR-HAND-006
  it('rejects a choice that is neither an engineer on the team nor an outside hire, changing nothing', () => {
    const line = promotedLine(7);
    const before = structuredClone(line.sim);
    for (const choice of ['nobody', 'e999', '']) expect(takeOver(line.level, line.sim, choice).ok).toBe(false);
    expect(line.sim).toEqual(before);
  });
});

describe('the organization', () => {
  // @spec SENIOR-ORG-001
  it('generates managers with a name, personality, want, skill, motivation, stress and trust, and a leniency of 0 to 2', () => {
    const { level, sim } = senior(8);
    for (const id of level.teamIds.slice(1)) {
      const m = sim.people[(sim.teams[id]!.leader as { id: string }).id]!;
      expect(m.name).toBeTruthy();
      expect(m.personality).toBeTruthy();
      expect(m.want).toBeTruthy();
      for (const v of [m.skill, m.motivation, m.stress, m.trust]) expect(v).toBeGreaterThanOrEqual(0);
    }
    for (const teamId of level.teamIds) {
      const managerId = (sim.teams[teamId]!.leader as { id: string }).id;
      expect([0, 1, 2]).toContain(level.leniency[managerId]);
    }
    const names = level.teamIds.map((t) => sim.people[(sim.teams[t]!.leader as { id: string }).id]!.name);
    expect(new Set(names).size).toBe(3);
  });

  // @spec SENIOR-HABIT-001
  it('starts every manager on coaching oversight, 1:1s fortnightly, holding the bar on backfills and no skip-levels', () => {
    const { level, sim } = senior(9);
    const managers = level.teamIds.map((t) => (sim.teams[t]!.leader as { id: string }).id);
    expect(level.habits).toEqual({ ...DEFAULT_SENIOR_HABITS, oversight: Object.fromEntries(managers.map((m) => [m, 'coaching'])) });
    expect(DEFAULT_SENIOR_HABITS).toMatchObject({ oneOnOnes: 'fortnightly', backfill: 'holdTheBar', skipLevel: 'none' });
  });
});

describe('the level state', () => {
  // @spec SENIOR-STATE-001
  it('is plain data, the same for the same seed and choice', () => {
    const a = senior(10);
    expect(JSON.parse(JSON.stringify(a.level))).toEqual(a.level);
    expect(senior(10)).toEqual(a);
    expect(senior(11)).not.toEqual(a);
  });
});
