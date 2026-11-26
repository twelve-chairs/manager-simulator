import { describe, expect, it } from 'vitest';
import { VP_TUNING as T, handoverChoices, takeOver } from '../../../src/levels/vp';
import { foldUnits } from '../../../src/levels/org';
import { PERFORMANCE_LEVELS } from '../../../src/sim';
import { promotedDirector, vp } from './fixtures';

const leaderOf = (sim: { teams: Record<string, { leader: { kind: string; id?: string } | null } | undefined> }, id: string) => {
  const l = sim.teams[id]?.leader;
  return l?.kind === 'person' ? l.id! : null;
};

describe('the handover to VP', () => {
  // @spec VP-HAND-001
  it('offers each senior manager leading one of the player’s groups, with their skill, trust and want, or an outside hire', () => {
    const d = promotedDirector(3);
    const choices = handoverChoices(d.level, d.sim);
    const leads = d.level.groupIds.map((g) => leaderOf(d.sim, g)).filter((x): x is string => x !== null);
    expect(choices.map((c) => c.id)).toEqual([...leads, 'hire']);
    for (const c of choices.slice(0, -1)) {
      const p = d.sim.people[c.id]!;
      expect(c).toEqual({ id: p.id, name: p.name, skill: p.skill, trust: p.trust, want: p.want });
    }
  });

  // @spec VP-HAND-002
  it('makes a chosen senior manager the division’s director, as they were, with the division formed around their group', () => {
    const d = promotedDirector(3);
    const chosen = handoverChoices(d.level, d.sim)[1]!.id;
    const theirGroup = d.level.groupIds.find((g) => leaderOf(d.sim, g) === chosen)!;
    const r = takeOver(d.level, d.sim, chosen);
    if (!r.ok) throw new Error(r.error);
    expect(r.level.divisionIds[0]).toBe(theirGroup);
    expect(leaderOf(r.sim, theirGroup)).toBe(chosen);
    const before = d.sim.people[chosen]!;
    expect(r.sim.people[chosen]).toMatchObject({ status: 'active', role: 'manager', skill: before.skill, trust: before.trust, want: before.want });
  });

  // @spec VP-HAND-003
  it('hires a capable director with neutral trust, and raises the division’s stress', () => {
    const d = promotedDirector(3);
    const r = takeOver(d.level, d.sim, 'hire');
    if (!r.ok) throw new Error(r.error);
    const division = r.level.divisionIds[0]!;
    const lead = r.sim.people[leaderOf(r.sim, division)!]!;
    expect(d.sim.people[lead.id]).toBeUndefined();
    expect(lead.skill).toBeGreaterThanOrEqual(40);
    expect(lead.skill).toBeLessThan(60);
    expect(lead.trust).toBe(50);
    // The same fold without the hire's adjustment, from the same generator state.
    const folded = foldUnits(d.sim, d.level.groupIds, 'hire', () => ({ ...lead, id: 'probe' }), { kind: 'rule', ruleId: 'test' });
    expect(r.sim.teams[division]!.aggregate!.stress).toBe(Math.min(100, folded.sim.teams[division]!.aggregate!.stress + T.hireStress));
  });

  // @spec VP-HAND-004
  it('folds every group into one division: heads at their ratings, senior managers as heads, projects reassigned, the rest closed', () => {
    for (const choice of ['hire', 'pick']) {
      const d = promotedDirector(5);
      const pick = choice === 'hire' ? 'hire' : handoverChoices(d.level, d.sim)[0]!.id;
      const r = takeOver(d.level, d.sim, pick);
      if (!r.ok) throw new Error(r.error);
      const division = r.level.divisionIds[0]!;
      const old = d.level.groupIds;
      for (const g of old.filter((x) => x !== division)) expect(r.sim.teams[g], g).toBeUndefined();
      const oldLeads = old.map((g) => leaderOf(d.sim, g)).filter((x): x is string => x !== null && x !== pick);
      const heads = old.reduce((n, g) => n + d.sim.teams[g]!.aggregate!.headcount, 0) + oldLeads.length;
      const a = r.sim.teams[division]!.aggregate!;
      expect(a.headcount, choice).toBe(heads);
      expect(PERFORMANCE_LEVELS.reduce((n, l) => n + a.ratings[l], 0)).toBe(a.headcount);
      for (const m of oldLeads) expect(r.sim.people[m]).toMatchObject({ status: 'aggregated', teamId: division });
      const active = Object.values(d.sim.projects).filter((p) => old.includes(p.teamId) && p.status === 'active');
      for (const p of active) expect(r.sim.projects[p.id]!.teamId).toBe(division);
    }
  });

  // @spec VP-HAND-005, VP-ORG-001, VP-ORG-002
  it('adds two divisions with directors and division-sized projects, and the CEO and two peers outside', () => {
    const d = promotedDirector(7);
    const { level, sim } = vp(7);
    expect(level.divisionIds).toHaveLength(3);
    for (const g of level.divisionIds.slice(1)) {
      const a = sim.teams[g]!.aggregate!;
      expect(a.headcount).toBeGreaterThanOrEqual(T.division.size[0]);
      expect(a.headcount).toBeLessThanOrEqual(T.division.size[1]);
      const lead = sim.people[leaderOf(sim, g)!]!;
      expect(lead).toMatchObject({ role: 'manager', status: 'active' });
      expect(lead.personality).toBeTruthy();
      const projects = Object.values(sim.projects).filter((p) => p.teamId === g);
      expect(projects).toHaveLength(2);
      for (const p of projects) {
        const weeks = p.deadlineWeek - sim.week;
        expect(weeks).toBeGreaterThanOrEqual(T.division.projectDeadline[0]);
        expect(p.scope).toBeGreaterThanOrEqual(weeks * T.division.projectScopePerWeek[0]);
        expect(p.scope).toBeLessThanOrEqual(weeks * T.division.projectScopePerWeek[1]);
      }
    }
    for (const id of level.divisionIds) {
      const lead = leaderOf(sim, id)!;
      expect(level.leniency[lead]).toBeGreaterThanOrEqual(0);
      expect(level.leniency[lead]).toBeLessThanOrEqual(2);
    }
    expect(sim.people[level.ceoId]).toMatchObject({ role: 'executive', teamId: null, status: 'active' });
    expect(level.peerIds).toHaveLength(2);
    for (const id of [level.ceoId, ...level.peerIds]) {
      const p = sim.people[id]!;
      expect(d.sim.people[id]).toBeUndefined();
      expect(p.teamId).toBeNull();
      expect(p.personality).toBeTruthy();
    }
    for (const id of level.peerIds) expect(sim.people[id]!.role).toBe('peer');
    // The director level's executive and peers stay in the state, out of the function's view.
    for (const id of [d.level.executiveId, ...d.level.peerIds]) expect(sim.people[id]).toBeDefined();
  });

  // @spec VP-HAND-006
  it('keeps the player’s standing and every folded person with their history', () => {
    const d = promotedDirector(2);
    const r = takeOver(d.level, d.sim, 'hire');
    if (!r.ok) throw new Error(r.error);
    expect(r.sim.player.reputation).toBe(d.sim.player.reputation);
    expect(r.sim.player.stress).toBe(d.sim.player.stress);
    expect(r.sim.player.ratingHistory).toEqual(d.sim.player.ratingHistory);
    for (const p of Object.values(d.sim.people)) {
      if (p.status === 'departed') continue;
      expect(r.sim.people[p.id], p.id).toBeDefined();
      expect(r.sim.people[p.id]!.history.slice(0, p.history.length)).toEqual(p.history);
    }
  });

  // @spec VP-HAND-007
  it('rejects a choice that is neither one of the senior managers nor an outside hire, changing nothing', () => {
    const d = promotedDirector(2);
    const before = structuredClone(d);
    for (const bad of ['', 'nobody', d.level.executiveId, d.level.peerIds[0]!]) {
      const r = takeOver(d.level, d.sim, bad);
      expect(r.ok, bad).toBe(false);
    }
    expect(d).toEqual(before);
  });

  // @spec VP-HABIT-001, VP-STATE-001
  it('starts with the function first and directors given room, in plain state that is the same for the same run and choice', () => {
    const a = vp(4);
    expect(a.level.habits).toEqual({ firstTeam: 'function', directors: 'stepBack' });
    expect(JSON.parse(JSON.stringify(a.level))).toEqual(a.level);
    expect(vp(4)).toEqual(a);
  });
});
