import { describe, expect, it } from 'vitest';
import { assessSenior, beginMonth, chooseSenior, endMonth, seniorView, takeOver, type SeniorState } from '../../../src/levels/senior-manager';
import type { SimState } from '../../../src/sim';
import { EVERYDAY_ISSUES } from '../../../src/levels/senior-manager/moments';
import { promotedLine, senior } from './fixtures';

const edit = (sim: SimState, change: (s: SimState) => void) => {
  const copy = structuredClone(sim);
  change(copy);
  return copy;
};
const KINDS = ['growManager', 'zeroRegretted', 'shipProject', 'unstrainTeam'];

describe('the period’s goals', () => {
  // @spec SENIOR-GOAL-001
  it('sets two or three goals from the group’s state as the period begins, and new ones each period', () => {
    const { level } = senior(1);
    expect(level.goals.length).toBeGreaterThanOrEqual(2);
    expect(level.goals.length).toBeLessThanOrEqual(3);
    for (const g of level.goals) expect(KINDS).toContain(g.kind);
    expect(level.goals.map((g) => g.kind)).toContain('zeroRegretted');
    // a strained team at the start of a period gets a goal to bring it out of the strained band
    const line = promotedLine(2);
    const r = takeOver(line.level, line.sim, 'hire');
    if (!r.ok) throw new Error(r.error);
    const strained = r.level.teamIds[1]!;
    const next = edit(r.sim, (s) => {
      s.week = r.level.startWeek + 24;
      s.teams[strained]!.aggregate!.stress = 80;
    });
    const later = endMonth(r.level, next);
    if (!later.ok) throw new Error(later.error);
    expect(later.level.goals.some((g) => g.kind === 'unstrainTeam' && g.teamId === strained)).toBe(true);
    expect(later.level.goals.map((g) => g.id)).not.toEqual(r.level.goals.map((g) => g.id));
  });

  // @spec SENIOR-GOAL-002
  it('shows each goal with its progress', () => {
    const { level, sim } = senior(3);
    const view = seniorView(level, sim);
    expect(view.goals.map((g) => g.id)).toEqual(level.goals.map((g) => g.id));
    for (const g of view.goals) {
      expect(g.text.length).toBeGreaterThan(0);
      expect(g.progress.length).toBeGreaterThan(0);
    }
  });

  // @spec SENIOR-GOAL-003
  it('scores each goal at the review as achieved or missed', () => {
    const { level, sim } = senior(4);
    const at = edit(sim, (s) => (s.week = level.startWeek + 24));
    const goals = assessSenior(level, at).measures.filter((m) => m.id.startsWith('goal:'));
    expect(goals.map((m) => m.id)).toEqual(level.goals.map((g) => `goal:${g.id}`));
    for (const m of goals) expect([0, 1]).toContain(m.value);
  });
});

describe('the month’s recap', () => {
  // @spec SENIOR-RECAP-007
  it('lists frictions raised lately and left unsettled, saying when one sits above the manager', () => {
    const { level, sim } = senior(5);
    const [t0, t1] = level.teamIds as [string, string];
    const aboveKey = `everyday:${EVERYDAY_ISSUES.findIndex((x) => x.above)}`;
    const ownKey = `everyday:${EVERYDAY_ISSUES.findIndex((x) => !x.above)}`;
    const issues = {
      [t0]: { [aboveKey]: { week: sim.week - 4, settled: false, answer: 'coach' as const } },
      [t1]: { [ownKey]: { week: sim.week - 8, settled: true, answer: 'stepIn' as const } },
    };
    const r = endMonth(beginMonth({ ...level, issues }, sim), sim);
    if (!r.ok) throw new Error(r.error);
    const open = (r.recap as { changes: { stillOpen: { teamId: string; text: string; above: string | null }[] } }).changes.stillOpen;
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({ teamId: t0, text: EVERYDAY_ISSUES[Number(aboveKey.slice(9))]!.text });
    expect(open[0]!.above).toBeTruthy();
  });

  // @spec SENIOR-RECAP-006
  it('says how the standing habits’ energy compares with what a quiet month gives back, and puts it among what changed when it is more', () => {
    const { level, sim } = senior(5);
    const recapOf = (l: SeniorState) => {
      const r = endMonth(beginMonth(l, sim), sim);
      if (!r.ok) throw new Error(r.error);
      return r.recap as { changes: { energy?: string }; routine: { habits: string[] } };
    };
    const light = recapOf({ ...level, habits: { ...level.habits, oneOnOnes: 'monthly', skipLevel: 'none', oversight: Object.fromEntries(Object.keys(level.habits.oversight).map((m) => [m, 'handsOff'])) } });
    expect(light.routine.habits.some((l) => /less energy than a quiet month gives back: 1:1s\./.test(l))).toBe(true);
    expect(light.changes.energy).toBeUndefined();
    const heavy = recapOf({ ...level, habits: { ...level.habits, oneOnOnes: 'weekly', skipLevel: 'monthly', oversight: Object.fromEntries(Object.keys(level.habits.oversight).map((m) => [m, 'close'])) } });
    const line = heavy.routine.habits.find((l) => /standing habits took/.test(l))!;
    expect(line).toMatch(/more energy than a quiet month gives back: (1:1s|oversight), (1:1s|oversight) and skip-levels, the most first\./);
    expect(heavy.changes.energy).toBe(line);
  });

  // @spec SENIOR-RECAP-001
  it('reports a project behind when the month began that is on schedule again', () => {
    const { level, sim } = senior(5);
    const t = level.teamIds[0]!;
    const p = Object.values(sim.projects).find((x) => x.teamId === t && x.status === 'active')!;
    // behind as the month begins: nothing done, well into its time
    const behind = edit(sim, (s) => {
      s.week = s.projects[p.id]!.startWeek + Math.floor((s.projects[p.id]!.deadlineWeek - s.projects[p.id]!.startWeek) / 2);
      s.projects[p.id]!.progress = 0;
    });
    const begun = beginMonth(level, behind);
    // caught up by the month's end
    const caught = edit(behind, (s) => (s.projects[p.id]!.progress = s.projects[p.id]!.scope - 1));
    const r = endMonth(begun, caught);
    if (!r.ok) throw new Error(r.error);
    const recap = r.recap as { changes: { recovered: { name: string; team: string }[] } };
    expect(recap.changes.recovered).toContainEqual({ name: p.name, team: sim.teams[t]!.name });
    // a project on schedule all month is not reported
    const steady = endMonth(beginMonth(level, sim), sim);
    if (!steady.ok) throw new Error(steady.error);
    expect((steady.recap as { changes: { recovered: unknown[] } }).changes.recovered.some((x) => (x as { name: string }).name === p.name)).toBe(false);
  });

  // @spec SENIOR-RECAP-001
  it('tells what changed with the managers and teams, and the routine of habits and goals', () => {
    const { level, sim } = senior(5);
    const t = level.teamIds[1]!;
    const s = edit(sim, (x) => {
      for (const id of level.teamIds) Object.assign(x.teams[id]!.aggregate!, { stress: 30, motivation: 60 });
      x.teams[t]!.aggregate!.stress = 75;
    });
    const l: SeniorState = beginMonth(level, s);
    const escalation = l.moments.find((m) => m.kind === 'escalation' && m.teamId === t)!;
    const answered = chooseSenior(l, s, escalation.id, 'stepIn');
    if (!answered.ok) throw new Error(answered.error);
    const r = endMonth(answered.level, answered.sim);
    if (!r.ok) throw new Error(r.error);
    const recap = r.recap as { changes: { teams: { id: string; changes: string[] }[]; managers: unknown[]; heads: unknown[]; slipped: unknown[] }; routine: { habits: string[]; goals: { text: string; progress: string }[] } };
    expect(recap.changes.teams.find((x) => x.id === t)!.changes.join(' ')).toMatch(/stress/i);
    expect(Array.isArray(recap.changes.managers)).toBe(true);
    expect(Array.isArray(recap.changes.heads)).toBe(true);
    expect(Array.isArray(recap.changes.slipped)).toBe(true);
    expect(recap.routine.habits.length).toBeGreaterThan(0);
    expect(recap.routine.goals.map((g) => g.text)).toEqual(r.level.goals.map((g) => seniorView(r.level, r.sim).goals.find((x) => x.id === g.id)!.text));
  });
});
