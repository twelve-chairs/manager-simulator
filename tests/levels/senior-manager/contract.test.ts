import { describe, expect, it } from 'vitest';
import { SENIOR_LEVEL, beginMonth, handoverChoices, seniorManagerLevel } from '../../../src/levels/senior-manager';
import type { SimState } from '../../../src/sim';
import { promotedLine, senior } from './fixtures';

const edit = (sim: SimState, change: (s: SimState) => void) => {
  const copy = structuredClone(sim);
  change(copy);
  return copy;
};

describe('the senior manager level as the turn loop sees it', () => {
  // @spec SENIOR-CONTRACT-001
  it('provides the contract: four-week steps, moments by day of the month, handover, and calibration answered whole', () => {
    expect(seniorManagerLevel.params).toEqual(SENIOR_LEVEL);
    const line = promotedLine(1);
    expect(seniorManagerLevel.handoverChoices!(line.level, line.sim)).toEqual(handoverChoices(line.level, line.sim));
    const taken = seniorManagerLevel.takeOver!(line.level, line.sim, 'hire');
    expect(taken.ok).toBe(true);
    expect(seniorManagerLevel.takeOver!(line.level, line.sim, 'nobody').ok).toBe(false);

    const { level, sim } = senior(2);
    const busy = edit(sim, (s) => {
      for (const t of level.teamIds) s.teams[t]!.aggregate!.stress = 80;
    });
    const begun = seniorManagerLevel.beginWeek(level, busy);
    const refs = seniorManagerLevel.moments(begun, busy);
    expect(refs.map((r) => r.id)).toEqual(begun.moments.map((m) => m.id));
    for (const [i, r] of refs.entries()) {
      const m = begun.moments[i]!;
      expect(r).toMatchObject({ day: m.week * 5 + m.day, time: m.time, open: true, title: m.title });
    }

    // the calibration moment: accept every proposal, or settle each team's moves in one answer
    const month = edit(sim, (s) => (s.week = level.startWeek + 20));
    const cal = beginMonth(level, month);
    const moment = cal.moments.find((m) => m.kind === 'calibration')!;
    const entry = moment.calibration![0]!;
    const top = (['outstanding', 'exceeds', 'meets', 'partial'] as const).find((r) => entry.proposed[r] > 0)!;
    const lower = { outstanding: 'exceeds', exceeds: 'meets', meets: 'partial', partial: 'below' }[top];
    const settled = seniorManagerLevel.choose(cal, month, moment.id, `settle:${JSON.stringify({ [entry.teamId]: [{ from: top, to: lower, count: 1 }] })}`);
    if (!settled.ok) throw new Error(settled.error);
    expect(settled.sim.teams[entry.teamId]!.aggregate!.ratings[lower as 'meets']).toBe(entry.proposed[lower as 'meets'] + 1);
    for (const other of moment.calibration!.slice(1)) expect(settled.sim.teams[other.teamId]!.aggregate!.ratings).toEqual({ ...other.proposed, unrated: 0 });
    for (const bad of ['settle:{', 'settle:[1]', `settle:${JSON.stringify({ nope: [] })}`, 'settle:{"t1":"x"}']) {
      expect(seniorManagerLevel.choose(cal, month, moment.id, bad).ok, bad).toBe(false);
    }
  });
});

describe('moments an earlier choice made impossible', () => {
  // @spec SENIOR-CONTRACT-001
  it('reports a moment no longer open once nothing is left for it, so the loop records it as passed', () => {
    const { level, sim } = senior(3);
    const t = level.teamIds[1]!;
    const rated = edit(sim, (s) => {
      const r = s.teams[t]!.aggregate!.ratings;
      r.unrated -= 1;
      r.exceeds += 1;
    });
    const begun = seniorManagerLevel.beginWeek(level, rated);
    const approval = begun.moments.find((m) => m.kind === 'approval')!;
    expect(seniorManagerLevel.moments(begun, rated).find((r) => r.id === approval.id)!.open).toBe(true);
    // calibration moved the head the manager wanted to promote: there is no one left to approve
    const moved = edit(rated, (s) => {
      const r = s.teams[t]!.aggregate!.ratings;
      r.exceeds -= 1;
      r.meets += 1;
    });
    expect(seniorManagerLevel.moments(begun, moved).find((r) => r.id === approval.id)!.open).toBe(false);
  });
});
