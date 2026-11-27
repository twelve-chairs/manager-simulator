import { describe, expect, it } from 'vitest';
import { STAY_OFFERS, STAY_WANT_WORDS, leaderOf } from '../../src/levels/org';
import { beginMonth, chooseSenior, type SeniorState } from '../../src/levels/senior-manager';
import { leadOf } from '../../src/levels/senior-manager/core';
import { beginQuarter as beginDirectorQuarter, chooseDirector, type DirectorState } from '../../src/levels/director';
import { beginQuarter as beginVpQuarter, chooseVp, type VpState } from '../../src/levels/vp';
import type { SimState } from '../../src/sim';
import { senior } from './senior-manager/fixtures';
import { director } from './director/fixtures';
import { vp } from './vp/fixtures';

type Moment = { id: string; kind: string; title: string; text: string; week: number; choices: { id: string; label: string }[] };
type Chosen = { ok: true; sim: SimState; reaction: string } | { ok: false; error: string };

/** The simulation with this person restless since this week, and their motivation low enough to rise. */
const restless = (sim: SimState, id: string): SimState => {
  const copy = structuredClone(sim);
  Object.assign(copy.people[id]!, { restlessSince: copy.week, motivation: 40 });
  return copy;
};

/** Checks the conversation a level made about a restless leader, and both answers to it. */
function checkStay(opts: {
  sim: SimState;
  id: string;
  moments: Moment[];
  learned: boolean;
  choose: (momentId: string, choiceId: string, at?: SimState) => Chosen;
}) {
  const { sim, id, moments, learned, choose } = opts;
  const p = sim.people[id]!;
  const stay = moments.find((m) => m.kind === 'stay')!;
  expect(stay, 'a stay conversation').toBeDefined();
  expect(stay.title).toContain(p.name);
  expect(stay.text).toContain(STAY_WANT_WORDS[p.want]);
  expect(stay.choices).toEqual([
    { id: 'keep', label: STAY_OFFERS[p.want] },
    { id: 'release', label: expect.stringMatching(/^Wish them well/) },
  ]);
  expect(learned, 'their want is known').toBe(true);

  const kept = choose(stay.id, 'keep');
  if (!kept.ok) throw new Error(kept.error);
  const after = kept.sim.people[id]!;
  expect(after.restlessSince).toBeNull();
  expect(after.wantServedWeek).toBe(sim.week);
  expect(after.motivation).toBeGreaterThan(p.motivation);
  expect(after.trust).toBeGreaterThan(p.trust);
  expect(kept.sim.player.stress).toBeGreaterThan(sim.player.stress);

  const released = choose(stay.id, 'release');
  if (!released.ok) throw new Error(released.error);
  expect(released.sim).toEqual(sim);

  // someone already gone by the time the player answers is past keeping
  const gone = structuredClone(sim);
  gone.people[id]!.status = 'departed';
  for (const choice of ['keep', 'release']) {
    const r = choose(stay.id, choice, gone);
    if (!r.ok) throw new Error(r.error);
    expect(r.sim).toEqual(gone);
  }
}

describe('stay conversations', () => {
  // @spec SENIOR-MOMENT-018, SENIOR-MOMENT-019
  it('at the senior manager, opens the month with a restless manager’s want, early, and settles them only when the player gives it', () => {
    const { level, sim: sim0 } = senior(3);
    const teamId = level.teamIds.find((t) => leadOf(level, sim0, t))!;
    const id = leadOf(level, sim0, teamId)!;
    expect(beginMonth(level, sim0).moments.some((m) => m.kind === 'stay')).toBe(false);
    const sim = restless(sim0, id);
    const begun: SeniorState = beginMonth(level, sim);
    const kinds = begun.moments.map((m) => m.kind);
    const at = kinds.indexOf('stay');
    expect(kinds.slice(0, at).every((k) => ['finalEvaluation', 'replaceManager', 'calibration'].includes(k))).toBe(true);
    expect(begun.moments[at]!.teamId).toBe(teamId);
    checkStay({ sim, id, moments: begun.moments, learned: begun.learnedWants[id] === true, choose: (m, c, at = sim) => chooseSenior(begun, at, m, c) });
  });

  // @spec DIR-MOMENT-008, DIR-MOMENT-009
  it('at the director, raises it in the quarter’s first week, before headcount planning', () => {
    const { level, sim: sim0 } = director(3);
    const id = level.groupIds.map((g) => leaderOf(sim0, g)).find((x) => x !== null)!;
    expect(beginDirectorQuarter(level, sim0).moments.some((m) => m.kind === 'stay')).toBe(false);
    const sim = restless(sim0, id);
    const begun: DirectorState = beginDirectorQuarter(level, sim);
    const kinds = begun.moments.map((m) => m.kind);
    expect(kinds.indexOf('stay')).toBeLessThan(kinds.indexOf('headcount'));
    expect(begun.moments.find((m) => m.kind === 'stay')!.week).toBe(0);
    checkStay({ sim, id, moments: begun.moments, learned: begun.learnedWants[id] === true, choose: (m, c, at = sim) => chooseDirector(begun, at, m, c) });
  });

  // @spec VP-MOMENT-006, VP-MOMENT-007
  it('at the VP, raises it in the quarter’s first week, before annual planning', () => {
    const { level, sim: sim0 } = vp(3);
    const id = level.divisionIds.map((g) => leaderOf(sim0, g)).find((x) => x !== null)!;
    expect(beginVpQuarter(level, sim0).moments.some((m) => m.kind === 'stay')).toBe(false);
    const sim = restless(sim0, id);
    const begun: VpState = beginVpQuarter(level, sim);
    const kinds = begun.moments.map((m) => m.kind);
    expect(kinds).toContain('planning');
    expect(kinds.indexOf('stay')).toBeLessThan(kinds.indexOf('planning'));
    expect(begun.moments.find((m) => m.kind === 'stay')!.week).toBe(0);
    checkStay({ sim, id, moments: begun.moments, learned: begun.learnedWants[id] === true, choose: (m, c, at = sim) => chooseVp(begun, at, m, c) });
  });
});
