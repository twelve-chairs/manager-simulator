import { describe, expect, it } from 'vitest';
import { SENIOR_TUNING, assessSenior, beginMonth, calibrateTeam, chooseSenior, deliveredRatings, endMonth, seniorScorecard, type SeniorState } from '../../../src/levels/senior-manager';
import { RATINGS, type SimState } from '../../../src/sim';
import { senior } from './fixtures';

const T = SENIOR_TUNING;
const leader = (sim: SimState, teamId: string) => (sim.teams[teamId]!.leader as { id: string }).id;
const edit = (sim: SimState, change: (s: SimState) => void) => {
  const copy = structuredClone(sim);
  change(copy);
  return copy;
};
/** The level and simulation in the last month before the first review, with its calibration moment open. */
function calibrationMonth(seed = 1, leniency?: number) {
  const { level, sim } = senior(seed);
  const l0: SeniorState = leniency === undefined ? level : { ...level, leniency: Object.fromEntries(Object.keys(level.leniency).map((m) => [m, leniency])) };
  const s = edit(sim, (x) => (x.week = level.startWeek + 20));
  const l = beginMonth(l0, s);
  const moment = l.moments.find((m) => m.kind === 'calibration')!;
  return { level: l, sim: s, moment };
}
const step = (r: string) => RATINGS.indexOf(r as (typeof RATINGS)[number]);
const mean = (counts: Record<string, number>) => {
  const heads = RATINGS.reduce((n, r) => n + (counts[r] ?? 0), 0);
  return heads ? RATINGS.reduce((n, r) => n + step(r) * (counts[r] ?? 0), 0) / heads : 0;
};

describe('calibration', () => {
  // @spec SENIOR-CAL-001
  it('comes in the last month before a review, showing each team’s proposal, its delivery raised by the manager’s leniency', () => {
    const { level, sim } = senior(1);
    expect(beginMonth(level, edit(sim, (x) => (x.week = level.startWeek + 16))).moments.map((m) => m.kind)).not.toContain('calibration');
    const { moment, sim: s } = calibrationMonth(1);
    expect(moment.calibration!.map((c) => c.teamId)).toEqual(level.teamIds);
    for (const c of moment.calibration!) {
      expect(c.delivered).toEqual(deliveredRatings(s, c.teamId));
      const lenient = level.leniency[leader(s, c.teamId)]!;
      const heads = RATINGS.reduce((n, r) => n + c.proposed[r], 0);
      expect(heads).toBe(s.teams[c.teamId]!.aggregate!.headcount);
      expect(mean(c.proposed)).toBeGreaterThanOrEqual(mean(c.delivered));
      if (lenient === 0) expect(c.proposed).toEqual(c.delivered);
    }
  });

  // @spec SENIOR-CAL-002, SENIOR-CAL-004
  it('applies a team’s calibrated ratings, pleasing a manager whose proposal stands and costing trust per head marked down', () => {
    const { level, sim, moment } = calibrationMonth(2, 1);
    const c = moment.calibration![1]!;
    const m = leader(sim, c.teamId);
    const accepted = calibrateTeam(level, sim, moment.id, c.teamId, []);
    if (!accepted.ok) throw new Error(accepted.error);
    expect(accepted.sim.teams[c.teamId]!.aggregate!.ratings).toEqual({ ...c.proposed, unrated: 0 });
    expect(accepted.sim.people[m]!.motivation).toBe(Math.min(100, sim.people[m]!.motivation + T.calAcceptMotivation));
    // mark one head down from the proposal toward the evidence
    const top = [...RATINGS].reverse().find((r) => c.proposed[r] > 0 && step(r) > 0)!;
    const down = RATINGS[step(top) - 1]!;
    const marked = calibrateTeam(level, sim, moment.id, c.teamId, [{ from: top, to: down, count: 1 }]);
    if (!marked.ok) throw new Error(marked.error);
    expect(marked.sim.teams[c.teamId]!.aggregate!.ratings[down]).toBe((c.proposed[down] ?? 0) + 1);
    expect(marked.sim.people[m]!.trust).toBe(sim.people[m]!.trust - T.calTrustPerHead);
    // ratings above what the team delivered cost the team motivation; ratings that match it don't
    const gap = Math.abs(mean(c.proposed) - mean(c.delivered));
    expect(accepted.sim.teams[c.teamId]!.aggregate!.motivation).toBe(sim.teams[c.teamId]!.aggregate!.motivation - Math.round(gap * T.calUnfairMotivation));
    // once every team is calibrated, the moment is answered
    let l = level;
    let s = sim;
    for (const team of moment.calibration!) {
      const r = calibrateTeam(l, s, moment.id, team.teamId, []);
      if (!r.ok) throw new Error(r.error);
      l = r.level;
      s = r.sim;
    }
    expect(l.moments.find((x) => x.id === moment.id)!.status).toBe('answered');
    // accepting every proposal at once does the same
    const all = chooseSenior(level, sim, moment.id, 'acceptAll');
    if (!all.ok) throw new Error(all.error);
    for (const team of moment.calibration!) expect(all.sim.teams[team.teamId]!.aggregate!.ratings).toEqual({ ...team.proposed, unrated: 0 });
  });

  // @spec SENIOR-CAL-003
  it('rejects moving more heads than a rating holds, a rating off the scale, or a jump of more than one rating', () => {
    const { level, sim, moment } = calibrationMonth(3);
    const c = moment.calibration![0]!;
    const empty = RATINGS.find((r) => c.proposed[r] === 0 && step(r) > 0)!;
    for (const moves of [
      [{ from: empty, to: RATINGS[step(empty) - 1]!, count: 1 }],
      [{ from: 'meets', to: 'brilliant', count: 1 }],
      [{ from: 'outstanding', to: 'below', count: 1 }],
    ]) {
      expect(calibrateTeam(level, sim, moment.id, c.teamId, moves as never).ok, JSON.stringify(moves)).toBe(false);
    }
    expect(calibrateTeam(level, sim, 'nope', c.teamId, []).ok).toBe(false);
    expect(calibrateTeam(level, sim, moment.id, 'nope', []).ok).toBe(false);
  });

  // @spec SENIOR-CAL-005
  it('lets every proposal stand when the month ends with calibration unanswered', () => {
    const { level, sim, moment } = calibrationMonth(4);
    const r = endMonth(level, sim);
    if (!r.ok) throw new Error(r.error);
    for (const c of moment.calibration!) expect(r.sim.teams[c.teamId]!.aggregate!.ratings).toEqual({ ...c.proposed, unrated: 0 });
  });

  // @spec SENIOR-END-003
  it('scores calibration quality by how closely the ratings matched what each team delivered', () => {
    const fair = calibrationMonth(5, 0);
    const lenient = calibrationMonth(5, 2);
    const quality = (x: typeof fair) => {
      const r = chooseSenior(x.level, x.sim, x.moment.id, 'acceptAll');
      if (!r.ok) throw new Error(r.error);
      const at = edit(r.sim, (s) => (s.week = x.level.startWeek + 24));
      return { card: seniorScorecard(r.level, at), assessment: assessSenior(r.level, at) };
    };
    expect(quality(fair).card.calibration).toBe(1);
    expect(quality(lenient).card.calibration).toBeLessThan(1);
    expect(quality(fair).assessment.measures.map((m) => m.id)).toContain('calibrationQuality');
  });
});

