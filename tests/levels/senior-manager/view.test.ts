import { describe, expect, it } from 'vitest';
import { band } from '../../../src/levels/line-manager';
import { seniorView } from '../../../src/levels/senior-manager';
import { applyEffects, type SimState } from '../../../src/sim';
import { engineersOf, promotedLine, senior } from './fixtures';

const managerOf = (sim: SimState, teamId: string) => (sim.teams[teamId]!.leader as { id: string }).id;
const setTeam = (sim: SimState, teamId: string, values: { motivation?: number; stress?: number }) => {
  const copy = structuredClone(sim);
  Object.assign(copy.teams[teamId]!.aggregate!, values);
  return copy;
};
const setPerson = (sim: SimState, id: string, values: object) => {
  const copy = structuredClone(sim);
  Object.assign(copy.people[id]!, values);
  return copy;
};

describe('the senior manager’s view', () => {
  // @spec SENIOR-VIS-001
  it('shows each manager with name, personality, team, rating, memory, bands, and their want only after a 1:1', () => {
    const { level, sim } = senior(1);
    const view = seniorView(level, sim);
    expect(view.managers.map((m) => m.teamId)).toEqual(level.teamIds);
    for (const m of view.managers) {
      const p = sim.people[m.id]!;
      expect(m).toMatchObject({ name: p.name, personality: p.personality, performance: p.performance, motivation: band(p.motivation), stress: band(p.stress), skill: band(p.skill), want: 'unknown' });
      expect(Array.isArray(m.memory)).toBe(true);
    }
    const id = view.managers[0]!.id;
    const learned = seniorView({ ...level, learnedWants: { [id]: true } }, sim);
    expect(learned.managers[0]!.want).toBe(sim.people[id]!.want);
  });

  // @spec SENIOR-VIS-002
  it('shows each team under its manager with headcount, health bands and its projects', () => {
    const { level, sim } = senior(2);
    const truthful = level.teamIds.reduce((s, t) => setPerson(s, managerOf(s, t), { skill: 70, trust: 70 }), sim);
    const view = seniorView(level, truthful);
    for (const t of view.teams) {
      const a = truthful.teams[t.id]!.aggregate!;
      expect(t).toMatchObject({ managerId: managerOf(truthful, t.id), headcount: a.headcount, motivation: band(a.motivation), stress: band(a.stress), attritionRisk: band(a.attritionRisk) });
      const projects = Object.values(truthful.projects).filter((p) => p.teamId === t.id && p.status === 'active');
      expect(t.projects.map((p) => p.id)).toEqual(projects.map((p) => p.id));
      for (const p of t.projects) expect(p).toMatchObject({ progress: expect.any(Number), scope: expect.any(Number), deadlineWeek: expect.any(Number), schedule: expect.stringMatching(/^(onSchedule|behind|overdue)$/) });
    }
  });

  // @spec SENIOR-VIS-003
  it('reports a team one band healthier while its manager is below capable or distrustful, a best band staying put', () => {
    const { level, sim } = senior(3);
    const teamId = level.teamIds[1]!;
    const m = managerOf(sim, teamId);
    const shown = (s: SimState) => seniorView(level, s).teams.find((t) => t.id === teamId)!;
    const base = setTeam(setPerson(sim, m, { skill: 70, trust: 70 }), teamId, { motivation: 30, stress: 70 });
    expect(shown(base)).toMatchObject({ motivation: 1, stress: 3, truth: false });
    expect(shown(setPerson(base, m, { trust: 30 }))).toMatchObject({ motivation: 2, stress: 2 });
    expect(shown(setPerson(base, m, { skill: 30 }))).toMatchObject({ motivation: 2, stress: 2 });
    const healthy = setTeam(setPerson(base, m, { trust: 30 }), teamId, { motivation: 95, stress: 5 });
    expect(shown(healthy)).toMatchObject({ motivation: 4, stress: 0 });
  });

  // @spec SENIOR-VIS-004
  it('shows the truth under close oversight, or in a month a skip-level listened to the team, and says so', () => {
    const { level, sim } = senior(4);
    const teamId = level.teamIds[2]!;
    const m = managerOf(sim, teamId);
    const lying = setTeam(setPerson(sim, m, { trust: 20 }), teamId, { stress: 70 });
    const shown = (l: typeof level) => seniorView(l, lying).teams.find((t) => t.id === teamId)!;
    expect(shown(level)).toMatchObject({ stress: 2, truth: false });
    expect(shown({ ...level, habits: { ...level.habits, oversight: { ...level.habits.oversight, [m]: 'close' } } })).toMatchObject({ stress: 3, truth: true });
    expect(shown({ ...level, listenedTo: [teamId] })).toMatchObject({ stress: 3, truth: true });
  });

  // @spec SENIOR-VIS-005, SENIOR-VIS-006
  it('never shows a manager’s leniency, or any engineer of an aggregate team', () => {
    const line = promotedLine(5);
    const { level, sim } = senior(5);
    const text = JSON.stringify(seniorView(level, sim));
    expect(text).not.toMatch(/lenien/i);
    for (const id of engineersOf(line)) expect(text).not.toContain(`"${id}"`);
  });
});

describe('the group', () => {
  // @spec SENIOR-ORG-002
  it('shows a team whose manager has left as leaderless', () => {
    const { level, sim } = senior(6);
    const teamId = level.teamIds[1]!;
    const result = applyEffects(sim, [{ type: 'remove', personId: managerOf(sim, teamId), reason: 'quit', cause: { kind: 'rule', ruleId: 'test' } }]);
    if (!result.ok) throw new Error(result.error.message);
    const view = seniorView(level, result.state);
    expect(view.teams.find((t) => t.id === teamId)!.managerId).toBeNull();
    expect(view.managers.map((m) => m.teamId)).not.toContain(teamId);
  });
});
