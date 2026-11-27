import { describe, expect, it } from 'vitest';
import { SENIOR_TUNING, assessSenior, beginMonth, calibrateTeam, chooseSenior, deliveredRatings, endMonth, seniorManagerLevel, seniorScorecard, type SeniorState } from '../../../src/levels/senior-manager';
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
/** Every team's aggregate health set so that its delivery lands at one rating band: middling (mostly meets) or strong (mostly outstanding). */
const health = (sim: SimState, teamIds: string[], kind: 'middling' | 'strong') =>
  edit(sim, (s) => {
    for (const id of teamIds) Object.assign(s.teams[id]!.aggregate!, kind === 'middling' ? { skill: 50, motivation: 55, stress: 45 } : { skill: 95, motivation: 95, stress: 5 });
  });
/** The calibration month with every team's delivery at one band, and the moment rebuilt from it. */
function calibrationAt(kind: 'middling' | 'strong', seed = 1, leniency = 0) {
  const { level, sim } = senior(seed);
  const l0: SeniorState = { ...level, leniency: Object.fromEntries(Object.keys(level.leniency).map((m) => [m, leniency])) };
  const s = health(edit(sim, (x) => (x.week = level.startWeek + 20)), level.teamIds, kind);
  const l = beginMonth(l0, s);
  return { level: l, sim: s, moment: l.moments.find((m) => m.kind === 'calibration')! };
}
const TOP = ['exceeds', 'outstanding'] as const;
const groupTop = (sim: SimState, teamIds: string[]) => teamIds.reduce((n, id) => n + TOP.reduce((k, r) => k + sim.teams[id]!.aggregate!.ratings[r], 0), 0);
const groupHeads = (sim: SimState, teamIds: string[]) => teamIds.reduce((n, id) => n + sim.teams[id]!.aggregate!.headcount, 0);
const ok = <X,>(r: ({ ok: true } & X) | { ok: false; error: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

const step = (r: string) => RATINGS.indexOf(r as (typeof RATINGS)[number]);
const mean = (counts: Record<string, number>) => {
  const heads = RATINGS.reduce((n, r) => n + (counts[r] ?? 0), 0);
  return heads ? RATINGS.reduce((n, r) => n + step(r) * (counts[r] ?? 0), 0) / heads : 0;
};

describe('what a team delivered', () => {
  // @spec SENIOR-CAL-010
  it('climbs steadily with the team’s score: a point better never moves more than a few heads', () => {
    const { level, sim } = senior(1);
    const t = level.teamIds[0]!;
    const at = (score: number) => deliveredRatings(edit(sim, (s) => Object.assign(s.teams[t]!.aggregate!, { headcount: 10, skill: score, motivation: score, stress: 100 - score })), t);
    const tops = (c: Record<string, number>) => c.exceeds! + c.outstanding!;
    let before = at(0);
    for (let score = 1; score <= 100; score++) {
      const now = at(score);
      expect(RATINGS.reduce((n, r) => n + now[r], 0)).toBe(10);
      expect(mean(now)).toBeGreaterThanOrEqual(mean(before));
      expect(Math.abs(tops(now) - tops(before)), `score ${score}`).toBeLessThanOrEqual(2);
      before = now;
    }
    // between two thresholds, the share at the higher rating follows the climb
    const [, meets, exceeds] = T.deliveryThresholds;
    const halfway = at((meets + exceeds) / 2);
    expect(halfway.meets).toBe(halfway.exceeds - Math.floor(10 * T.deliverySpread));
  });
});

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
    // and the group's curve: the most top ratings it may hold
    expect(moment.curve).toBe(Math.floor(T.curveShare * groupHeads(s, level.teamIds)));
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
    // once every team is calibrated within the curve, the moment is answered
    const within = calibrationAt('middling', 2);
    let l = within.level;
    let s = within.sim;
    for (const team of within.moment.calibration!) {
      const r = calibrateTeam(l, s, within.moment.id, team.teamId, []);
      if (!r.ok) throw new Error(r.error);
      l = r.level;
      s = r.sim;
    }
    expect(groupTop(s, within.level.teamIds)).toBeLessThanOrEqual(within.moment.curve!);
    expect(l.moments.find((x) => x.id === within.moment.id)!.status).toBe('answered');
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
  it('lets every proposal stand when the month ends with calibration unanswered, and the room trims what is over the curve', () => {
    const within = calibrationAt('middling', 4);
    const r = ok(endMonth(within.level, within.sim));
    for (const c of within.moment.calibration!) expect(r.sim.teams[c.teamId]!.aggregate!.ratings).toEqual({ ...c.proposed, unrated: 0 });
    const over = calibrationAt('strong', 4);
    expect(over.moment.calibration!.reduce((n, c) => n + TOP.reduce((k, t) => k + c.proposed[t], 0), 0)).toBeGreaterThan(over.moment.curve!);
    const trimmed = ok(endMonth(over.level, over.sim));
    expect(groupTop(trimmed.sim, over.level.teamIds)).toBe(over.moment.curve);
  });

  // @spec SENIOR-CAL-006
  it('keeps calibration open when the settled teams hold more top ratings than the curve, offering to argue or let the room trim', () => {
    const { level, sim, moment } = calibrationAt('strong', 6);
    const r = ok(chooseSenior(level, sim, moment.id, 'acceptAll'));
    const open = r.level.moments.find((m) => m.id === moment.id)!;
    expect(open.status).toBe('open');
    expect(open.choices.map((c) => c.id)).toEqual(['argue', 'trim']);
    expect(open.overCurve).toEqual({ held: groupTop(r.sim, level.teamIds), room: moment.curve });
    // settled as the player chose, until the room has its say
    for (const c of moment.calibration!) expect(r.sim.teams[c.teamId]!.aggregate!.ratings).toEqual({ ...c.proposed, unrated: 0 });
    // within the curve there is nothing to argue
    const within = calibrationAt('middling', 6);
    const fine = ok(chooseSenior(within.level, within.sim, within.moment.id, 'acceptAll'));
    expect(fine.level.moments.find((m) => m.id === within.moment.id)!.status).toBe('answered');
    expect(chooseSenior(fine.level, fine.sim, within.moment.id, 'argue').ok).toBe(false);
  });

  // @spec SENIOR-CAL-007
  it('lets an exception stand on a high reputation, and has the room trim on a low one, at a cost to reputation either way', () => {
    // the threshold is where the good band begins, so the scene can say it in words
    expect(T.curveExceptionReputation).toBe(60);
    for (const [reputation, stands] of [[T.curveExceptionReputation, true], [T.curveExceptionReputation - 1, false]] as const) {
      const { level, sim, moment } = calibrationAt('strong', 7);
      const settled = ok(chooseSenior(level, edit(sim, (s) => (s.player.reputation = reputation)), moment.id, 'acceptAll'));
      const held = groupTop(settled.sim, level.teamIds);
      const argued = ok(chooseSenior(settled.level, settled.sim, moment.id, 'argue'));
      expect(argued.sim.player.reputation).toBe(reputation - T.curveExceptionCost);
      expect(argued.level.moments.find((m) => m.id === moment.id)!.status).toBe('answered');
      expect(groupTop(argued.sim, level.teamIds), `reputation ${reputation}`).toBe(stands ? held : moment.curve);
    }
  });

  // @spec SENIOR-CAL-007, SENIOR-CAL-009
  it('remembers an argument at the last calibration: the next exception takes an excellent reputation, and says so', () => {
    const settle = (lastArgued: number, reputation: number) => {
      const { level, sim, moment } = calibrationAt('strong', 7);
      const l = { ...level, lastArgued };
      const settled = ok(chooseSenior(l, edit(sim, (s) => (s.player.reputation = reputation)), moment.id, 'acceptAll'));
      return { settled, moment, level, label: settled.level.moments.find((m) => m.id === moment.id)!.choices.find((c) => c.id === 'argue')!.label };
    };
    const recently = (sim: SimState) => sim.week - T.curveMemoryWeeks + 1;
    const { sim } = calibrationAt('strong', 7);
    // argued at the last calibration: good is not enough, excellent is
    const good = settle(recently(sim), 70);
    expect(good.label).toMatch(/you argued at the last calibration/i);
    expect(good.label).toMatch(/excellent/);
    const trimmed = ok(chooseSenior(good.settled.level, good.settled.sim, good.moment.id, 'argue'));
    expect(groupTop(trimmed.sim, good.level.teamIds)).toBe(good.moment.curve);
    // and arguing again costs twice the reputation
    expect(trimmed.sim.player.reputation).toBe(70 - 2 * T.curveExceptionCost);
    const excellent = settle(recently(sim), T.curveExceptionAgainReputation);
    const held = groupTop(excellent.settled.sim, excellent.level.teamIds);
    expect(groupTop(ok(chooseSenior(excellent.settled.level, excellent.settled.sim, excellent.moment.id, 'argue')).sim, excellent.level.teamIds)).toBe(held);
    // long enough ago, or never: good holds, and the label says nothing of it
    const long = settle(sim.week - T.curveMemoryWeeks - 1, 70);
    expect(long.label).not.toMatch(/argued at the last/i);
    const fresh = ok(chooseSenior(long.settled.level, long.settled.sim, long.moment.id, 'argue'));
    expect(groupTop(fresh.sim, long.level.teamIds)).toBe(groupTop(long.settled.sim, long.level.teamIds));
    expect(fresh.sim.player.reputation).toBe(70 - T.curveExceptionCost);
    // arguing is remembered for the next one
    expect(ok(chooseSenior(long.settled.level, long.settled.sim, long.moment.id, 'argue')).level.lastArgued).toBe(sim.week);
    expect(T.curveExceptionAgainReputation).toBe(80);
  });

  // @spec SENIOR-CAL-008
  it('trims to the curve from the team furthest above its delivery, exceeds before outstanding, costing its manager trust', () => {
    const { level, sim } = senior(8);
    const [lenientTeam] = level.teamIds;
    const lenientManager = leader(sim, lenientTeam!);
    const l0: SeniorState = { ...level, leniency: Object.fromEntries(Object.keys(level.leniency).map((m) => [m, m === lenientManager ? 2 : 0])) };
    // middling teams: mostly meets, a few exceeds; the lenient manager raises every head two ratings
    const s0 = health(edit(sim, (x) => (x.week = level.startWeek + 20)), level.teamIds, 'middling');
    const l = beginMonth(l0, s0);
    const moment = l.moments.find((m) => m.kind === 'calibration')!;
    const settled = ok(chooseSenior(l, s0, moment.id, 'acceptAll'));
    const over = settled.level.moments.find((m) => m.id === moment.id)!.overCurve;
    expect(over, 'the lenient proposal goes over the curve').toBeDefined();
    const before = structuredClone(settled.sim.teams[lenientTeam!]!.aggregate!.ratings);
    const trimmed = ok(chooseSenior(settled.level, settled.sim, moment.id, 'trim'));
    const after = trimmed.sim.teams[lenientTeam!]!.aggregate!.ratings;
    const cut = over!.held - over!.room;
    expect(groupTop(trimmed.sim, level.teamIds)).toBe(over!.room);
    // all from the lenient team, the furthest above what it delivered: exceeds first, to meets
    expect(after.exceeds).toBe(Math.max(0, before.exceeds - cut));
    expect(after.outstanding).toBe(before.outstanding - Math.max(0, cut - before.exceeds));
    expect(after.meets).toBe(before.meets + cut);
    for (const id of level.teamIds.slice(1)) expect(trimmed.sim.teams[id]!.aggregate!.ratings).toEqual(settled.sim.teams[id]!.aggregate!.ratings);
    expect(trimmed.sim.people[lenientManager]!.trust).toBe(settled.sim.people[lenientManager]!.trust - cut * T.calTrustPerHead);
    expect(trimmed.reaction).toContain(sim.teams[lenientTeam!]!.name);
  });

  // @spec SENIOR-END-003
  it('scores calibration quality by how closely the ratings matched what each team delivered, beyond what the curve forced', () => {
    const fair = calibrationMonth(5, 0);
    const lenient = calibrationMonth(5, 2);
    const quality = (x: typeof fair) => {
      const accepted = ok(chooseSenior(x.level, x.sim, x.moment.id, 'acceptAll'));
      // over the curve, the room trims (SENIOR-CAL-006)
      const r = accepted.level.moments.find((m) => m.id === x.moment.id)!.overCurve ? ok(chooseSenior(accepted.level, accepted.sim, x.moment.id, 'trim')) : accepted;
      const at = edit(r.sim, (s) => (s.week = x.level.startWeek + 24));
      return { card: seniorScorecard(r.level, at), assessment: assessSenior(r.level, at) };
    };
    expect(quality(fair).card.calibration).toBe(1);
    expect(quality(lenient).card.calibration).toBeLessThan(1);
    expect(quality(fair).assessment.measures.map((m) => m.id)).toContain('calibrationQuality');
    // a strong group settled on the evidence and trimmed to the curve lost nothing it could have kept
    const strong = calibrationAt('strong', 5);
    const settled = ok(chooseSenior(strong.level, strong.sim, strong.moment.id, 'acceptAll'));
    const trimmed = ok(chooseSenior(settled.level, settled.sim, strong.moment.id, 'trim'));
    expect(seniorScorecard(trimmed.level, edit(trimmed.sim, (s) => (s.week = strong.level.startWeek + 24))).calibration).toBe(1);
    // marking a team down when the curve forced nothing costs quality
    const middling = calibrationAt('middling', 5);
    const c = middling.moment.calibration![0]!;
    const harsh = ok(seniorManagerLevel.choose(middling.level, middling.sim, middling.moment.id, `settle:${JSON.stringify({ [c.teamId]: [{ from: 'meets', to: 'partial', count: c.proposed.meets }] })}`));
    expect(seniorScorecard(harsh.level, edit(harsh.sim, (s) => (s.week = middling.level.startWeek + 24))).calibration).toBeLessThan(1);
  });
});

