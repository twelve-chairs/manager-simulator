import { describe, expect, it } from 'vitest';
import { DIRECTOR_TUNING as T, foldGroup, handoverChoices, takeOver } from '../../../src/levels/director';
import { PERFORMANCE_LEVELS } from '../../../src/sim';
import { director, promotedSenior } from './fixtures';

const leaderOf = (sim: { teams: Record<string, { leader: { kind: string; id?: string } | null } | undefined> }, id: string) => {
  const l = sim.teams[id]?.leader;
  return l?.kind === 'person' ? l.id! : null;
};

describe('the handover to director', () => {
  // @spec DIR-HAND-001
  it('offers each manager leading one of the player’s teams, with their skill, trust and want, or an outside hire', () => {
    const s = promotedSenior(3);
    const choices = handoverChoices(s.level, s.sim);
    const managers = s.level.teamIds.map((t) => leaderOf(s.sim, t)).filter((x): x is string => x !== null);
    expect(choices.map((c) => c.id)).toEqual([...managers, 'hire']);
    for (const c of choices.slice(0, -1)) {
      const p = s.sim.people[c.id]!;
      expect(c).toEqual({ id: p.id, name: p.name, skill: p.skill, trust: p.trust, want: p.want });
    }
  });

  // @spec DIR-HAND-002
  it('makes a chosen manager the group’s senior manager, as they were, with the group formed around their team', () => {
    const s = promotedSenior(3);
    const chosen = handoverChoices(s.level, s.sim)[1]!.id;
    const theirTeam = s.level.teamIds.find((t) => leaderOf(s.sim, t) === chosen)!;
    const r = takeOver(s.level, s.sim, chosen);
    if (!r.ok) throw new Error(r.error);
    expect(r.level.groupIds[0]).toBe(theirTeam);
    expect(leaderOf(r.sim, theirTeam)).toBe(chosen);
    const before = s.sim.people[chosen]!;
    expect(r.sim.people[chosen]).toMatchObject({ status: 'active', role: 'manager', skill: before.skill, trust: before.trust, want: before.want });
  });

  // @spec DIR-HAND-003
  it('hires a capable senior manager with neutral trust, and raises the group’s stress', () => {
    const s = promotedSenior(3);
    const r = takeOver(s.level, s.sim, 'hire');
    if (!r.ok) throw new Error(r.error);
    const group = r.level.groupIds[0]!;
    const lead = r.sim.people[leaderOf(r.sim, group)!]!;
    expect(s.sim.people[lead.id]).toBeUndefined();
    expect(lead.skill).toBeGreaterThanOrEqual(40);
    expect(lead.skill).toBeLessThan(60);
    expect(lead.trust).toBe(50);
    const folded = foldGroup(s.level, s.sim, 'hire', r.level);
    expect(r.sim.teams[group]!.aggregate!.stress).toBe(Math.min(100, folded.sim.teams[group]!.aggregate!.stress + T.hireStress));
  });

  // @spec DIR-HAND-004
  it('folds every team into one group: heads at their ratings, managers as heads, projects reassigned, the rest closed', () => {
    for (const choice of ['hire', 'pick']) {
      const s = promotedSenior(5);
      const pick = choice === 'hire' ? 'hire' : handoverChoices(s.level, s.sim)[0]!.id;
      const r = takeOver(s.level, s.sim, pick);
      if (!r.ok) throw new Error(r.error);
      const group = r.level.groupIds[0]!;
      const old = s.level.teamIds;
      for (const t of old.filter((x) => x !== group)) expect(r.sim.teams[t], t).toBeUndefined();
      const oldManagers = old.map((t) => leaderOf(s.sim, t)).filter((x): x is string => x !== null && x !== pick);
      const heads = old.reduce((n, t) => n + s.sim.teams[t]!.aggregate!.headcount, 0) + oldManagers.length;
      const a = r.sim.teams[group]!.aggregate!;
      expect(a.headcount, choice).toBe(heads);
      expect(PERFORMANCE_LEVELS.reduce((n, l) => n + a.ratings[l], 0)).toBe(a.headcount);
      for (const m of oldManagers) expect(r.sim.people[m]).toMatchObject({ status: 'aggregated', teamId: group });
      const active = Object.values(s.sim.projects).filter((p) => old.includes(p.teamId) && p.status === 'active');
      for (const p of active) expect(r.sim.projects[p.id]!.teamId).toBe(group);
    }
  });

  // @spec DIR-HAND-005, DIR-ORG-001, DIR-ORG-002
  it('adds two groups with senior managers and group-sized projects, and the executive and two peers outside', () => {
    const { level, sim } = director(7);
    expect(level.groupIds).toHaveLength(3);
    for (const g of level.groupIds.slice(1)) {
      const a = sim.teams[g]!.aggregate!;
      expect(a.headcount).toBeGreaterThanOrEqual(T.groupSize[0]);
      expect(a.headcount).toBeLessThanOrEqual(T.groupSize[1]);
      const lead = sim.people[leaderOf(sim, g)!]!;
      expect(lead).toMatchObject({ role: 'manager', status: 'active' });
      expect(lead.personality).toBeTruthy();
      const projects = Object.values(sim.projects).filter((p) => p.teamId === g);
      expect(projects).toHaveLength(2);
      for (const p of projects) {
        const weeks = p.deadlineWeek - sim.week;
        expect(weeks).toBeGreaterThanOrEqual(T.groupProjectDeadline[0]);
        expect(p.scope).toBeGreaterThanOrEqual(weeks * T.groupProjectScopePerWeek[0]);
        expect(p.scope).toBeLessThanOrEqual(weeks * T.groupProjectScopePerWeek[1]);
      }
    }
    for (const id of level.groupIds) {
      const lead = leaderOf(sim, id)!;
      expect(level.leniency[lead]).toBeGreaterThanOrEqual(0);
      expect(level.leniency[lead]).toBeLessThanOrEqual(2);
    }
    expect(sim.people[level.executiveId]).toMatchObject({ role: 'executive', teamId: null, status: 'active' });
    expect(level.peerIds).toHaveLength(2);
    for (const id of [level.executiveId, ...level.peerIds]) {
      const p = sim.people[id]!;
      expect(p.teamId).toBeNull();
      expect(p.personality).toBeTruthy();
      expect(p.trust).toBeGreaterThanOrEqual(0);
    }
    for (const id of level.peerIds) expect(sim.people[id]!.role).toBe('peer');
  });

  // @spec DIR-HAND-006
  it('keeps the player’s standing and every folded person with their history', () => {
    const s = promotedSenior(2);
    const r = takeOver(s.level, s.sim, 'hire');
    if (!r.ok) throw new Error(r.error);
    expect(r.sim.player.reputation).toBe(s.sim.player.reputation);
    expect(r.sim.player.stress).toBe(s.sim.player.stress);
    expect(r.sim.player.ratingHistory).toEqual(s.sim.player.ratingHistory);
    for (const p of Object.values(s.sim.people)) {
      if (p.status === 'departed') continue;
      expect(r.sim.people[p.id], p.id).toBeDefined();
      expect(r.sim.people[p.id]!.history.slice(0, p.history.length)).toEqual(p.history);
    }
  });

  // @spec DIR-HAND-007
  it('rejects a choice that is neither one of the managers nor an outside hire, changing nothing', () => {
    const s = promotedSenior(2);
    const before = structuredClone(s);
    for (const bad of ['', 'nobody', 'x1', Object.keys(s.sim.people).find((id) => s.sim.people[id]!.role === 'engineer') ?? 'e1']) {
      const r = takeOver(s.level, s.sim, bad);
      expect(r.ok, bad).toBe(false);
    }
    expect(s).toEqual(before);
  });

  // @spec DIR-STATE-001
  it('keeps plain, serializable state, the same for the same run and choice', () => {
    const a = director(4);
    expect(JSON.parse(JSON.stringify(a.level))).toEqual(a.level);
    expect(director(4)).toEqual(a);
  });
});
