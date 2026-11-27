import { describe, expect, it } from 'vitest';
import { band, LINE_TUNING, lineManagerLevel } from '../../../src/levels/line-manager';
import { seniorManagerLevel } from '../../../src/levels/senior-manager';
import { directorLevel } from '../../../src/levels/director';
import { knownRatings, leaderOf, sustained } from '../../../src/levels/org';
import {
  VP_LEVEL,
  VP_TUNING as T,
  afterAdvanceVp,
  headsLostLastQuarter,
  assessVp,
  beginQuarter,
  chooseVp,
  endQuarter,
  makeCut,
  plannedHeads,
  quitLastQuarter,
  reviewDue,
  spreadYear,
  vpLevel,
  vpScorecard,
  type VpMoment,
  type VpState,
} from '../../../src/levels/vp';
import { apply as applyCommand, newRun, type Dependencies, type Run } from '../../../src/loop';
import { conductReview } from '../../../src/review';
import { TUNING as SIM, applyEffects, attritionRiskOf, type SimState } from '../../../src/sim';
import { CONTENT } from '../../loop/fixtures';
import { realContent } from '../../balance/harness';
import { vp } from './fixtures';

const RULE = { kind: 'rule', ruleId: 'test' } as const;
const ok = <X>(r: ({ ok: true } & X) | { ok: false; error: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};
const at = (sim: SimState, week: number): SimState => ({ ...structuredClone(sim), week });
const set = (sim: SimState, effects: Parameters<typeof applyEffects>[1]) => {
  const r = applyEffects(sim, effects);
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};
const divisions = (level: VpState, sim: SimState) => level.divisionIds.map((g) => sim.teams[g]!.aggregate!);
const leads = (level: VpState, sim: SimState) => level.divisionIds.map((g) => leaderOf(sim, g)!);
/** A level with one open moment of a kind, offering the given choices. */
const withMoment = (level: VpState, m: Partial<VpMoment> & Pick<VpMoment, 'kind'>, choices: string[]): VpState => ({
  ...level,
  moments: [{ id: 'm1', week: 1, day: 0, time: 'morning', title: m.kind, text: '', status: 'open', choices: choices.map((id) => ({ id, label: id })), ...m }],
});

describe('a quarter’s moments', () => {
  // @spec VP-MOMENT-001, VP-MOMENT-002
  it('opens the first quarter with annual planning and the company priority, and always closes with the all-hands', () => {
    const { level, sim } = vp(3);
    const begun = beginQuarter(level, sim);
    const kinds = begun.moments.map((m) => m.kind);
    expect(kinds[0]).toBe('planning');
    expect(kinds).toContain('priority');
    expect(kinds.at(-1)).toBe('allHands');
    expect(begun.moments.length).toBeLessThanOrEqual(T.momentCap);
    expect(begun.moments[0]).toMatchObject({ week: 0 });
    expect(begun.moments.at(-1)).toMatchObject({ week: 12, day: 4 });
    const slots = begun.moments.map((m) => m.week * 15 + m.day * 3 + (m.time === 'afternoon' ? 1 : 0));
    expect([...slots].sort((a, b) => a - b)).toEqual(slots);
    // The second quarter opens neither a year nor a half.
    const second = beginQuarter(level, at(sim, sim.week + 13)).moments.map((m) => m.kind);
    expect(second).not.toContain('planning');
    expect(second).not.toContain('priority');
  });

  // @spec VP-MOMENT-003
  it('applies a choice at once and closes the moment, and refuses a closed moment or an unoffered choice', () => {
    const { level, sim } = vp(3);
    const begun = beginQuarter(level, sim);
    const hands = begun.moments.at(-1)!;
    const r = ok(chooseVp(begun, sim, hands.id, 'short'));
    expect(r.level.moments.at(-1)!.status).toBe('answered');
    expect(chooseVp(r.level, r.sim, hands.id, 'short').ok).toBe(false);
    expect(chooseVp(begun, sim, hands.id, 'shout').ok).toBe(false);
    expect(chooseVp(begun, sim, 'nope', 'short').ok).toBe(false);
  });

  // @spec VP-MOMENT-004
  it('answers moments left waiting as waiting means: the plan asked for, the priority spread, the cut across, the all-hands short', () => {
    const { level, sim } = vp(3);
    const begun = beginQuarter(level, sim);
    const r = ok(endQuarter(begun, sim));
    expect(r.level.moments.every((m) => m.status === 'waited')).toBe(true);
    expect(r.level.year).toMatchObject({ given: plannedHeads(begun, sim) + T.planning.functionFirst, askedMore: false });
    expect(r.level.priority).toMatchObject({ spreadSlow: expect.any(Number) });
    expect(r.level.priority!.spreadSlow).toBeGreaterThan(0);
    expect(r.level.told).toBeNull();
  });
});

describe('VP situations', () => {
  // @spec VP-MOMENT-008
  it('brings each VP situation back no sooner than two years on', () => {
    for (const s of realContent().filter((x) => x.levels.includes('vp'))) expect(s.once === true || (s.cooldownWeeks ?? 0) >= 104, s.id).toBe(true);
  });

  // @spec VP-MOMENT-005
  it('has VP situations, and none that lowers a division’s headcount', () => {
    const situations = realContent().filter((x) => x.levels.includes('vp'));
    expect(situations.length).toBeGreaterThan(0);
    for (const s of situations) {
      for (const c of s.choices) for (const o of c.outcomes) for (const e of o.effects as { type: string; field?: string; amount?: number }[]) expect(e.type === 'value' && e.field === 'headcount' && (e.amount ?? 0) < 0, s.id).toBe(false);
    }
  });
});

describe('annual planning', () => {
  const planning = (seed: number) => {
    const { level, sim } = vp(seed);
    const begun = beginQuarter(level, sim);
    return { level: begun, sim, m: begun.moments.find((m) => m.kind === 'planning')! };
  };

  // @spec VP-BUDGET-001, VP-BUDGET-002
  it('shows the planned heads, more with the CEO’s trust and reputation, and asking for them gives that, more with the function first', () => {
    const { level, sim, m } = planning(4);
    expect(m.planned).toBe(plannedHeads(level, sim));
    expect(m.choices.map((c) => c.id)).toEqual(['plan', 'more', 'give']);
    const trusted = set(sim, [{ type: 'value', target: { kind: 'person', id: level.ceoId }, field: 'trust', amount: 30, cause: RULE }]);
    expect(plannedHeads(level, trusted)).toBeGreaterThan(plannedHeads(level, sim));
    expect(ok(chooseVp(level, sim, m.id, 'plan')).level.year!.given).toBe(m.planned! + T.planning.functionFirst);
    const company = { ...level, habits: { ...level.habits, firstTeam: 'leadership' as const } };
    expect(ok(chooseVp(company, sim, m.id, 'plan')).level.year!.given).toBe(m.planned);
  });

  // @spec VP-BUDGET-003
  it('gives more heads for asking more only when the CEO trusts the player, costs every peer’s trust, and remembers the ask', () => {
    const { level, sim, m } = planning(4);
    const low = set(sim, [{ type: 'value', target: { kind: 'person', id: level.ceoId }, field: 'trust', amount: -100, cause: RULE }]);
    const high = set(sim, [{ type: 'value', target: { kind: 'person', id: level.ceoId }, field: 'trust', amount: 100, cause: RULE }]);
    const withLow = { ...level, moments: level.moments.map((x) => (x.id === m.id ? { ...x, planned: 8 } : x)) };
    expect(ok(chooseVp(withLow, low, m.id, 'more')).level.year!.given).toBe(8);
    const r = ok(chooseVp(withLow, high, m.id, 'more'));
    expect(r.level.year).toMatchObject({ given: 8 + T.planning.more, askedMore: true });
    for (const peer of level.peerIds) expect(r.sim.people[peer]!.trust).toBe(Math.max(0, high.people[peer]!.trust - T.planning.morePeerTrust));
  });

  // @spec VP-BUDGET-003
  it('costs the CEO’s trust and reputation at the year’s end when the player asked for more and a priority that year failed', () => {
    const { level, sim } = vp(4);
    const year = { quarter: 1, given: 10, arrived: 10, due: [], askedMore: true };
    const failed = { ...level, year, priorityResults: [{ week: sim.week + 13, projectId: 'pp1', landed: false }] };
    const end = at(sim, sim.week + 3 * 13);
    const r = ok(endQuarter(failed, end));
    const ceo = r.sim.people[level.ceoId]!;
    expect(ceo.history.at(-1)?.note).toBe('Remembered you asked for more than you delivered');
    const fine = ok(endQuarter({ ...failed, priorityResults: [{ week: sim.week + 13, projectId: 'pp1', landed: true }] }, end));
    expect(fine.sim.people[level.ceoId]!.history.some((h) => h.note === 'Remembered you asked for more than you delivered')).toBe(false);
    expect(r.sim.player.reputation).toBeLessThan(fine.sim.player.reputation);
  });

  // @spec VP-BUDGET-004
  it('gives fewer heads for giving to a peer, and earns that peer’s and the CEO’s trust', () => {
    const { level, sim, m } = planning(4);
    const r = ok(chooseVp(level, sim, m.id, 'give'));
    expect(r.level.year!.given).toBe(Math.max(0, m.planned! - T.planning.give));
    expect(r.sim.people[m.personId!]!.trust).toBeGreaterThan(sim.people[m.personId!]!.trust);
    expect(r.sim.people[level.ceoId]!.trust).toBeGreaterThanOrEqual(sim.people[level.ceoId]!.trust);
  });

  // @spec VP-BUDGET-005, VP-DRIFT-005
  it('spreads the year’s heads over four quarters, earliest first, and adds each quarter’s to the most stressed division', () => {
    expect(spreadYear(10)).toEqual([3, 3, 2, 2]);
    expect(spreadYear(3)).toEqual([1, 1, 1, 0]);
    const { level, sim } = vp(4);
    const stressed = level.divisionIds[2]!;
    const hot = set(sim, [{ type: 'value', target: { kind: 'team', id: stressed }, field: 'stress', amount: 100, cause: RULE }]);
    const planned = { ...level, year: { quarter: 1, given: 10, arrived: 0, due: spreadYear(10), askedMore: false } };
    const r = ok(endQuarter(planned, hot));
    expect(r.level.year).toMatchObject({ arrived: 3, due: [3, 2, 2] });
    expect(r.sim.teams[stressed]!.aggregate!.headcount).toBe(hot.teams[stressed]!.aggregate!.headcount + 3);
  });
});

describe('the company priority', () => {
  const priority = (seed: number) => {
    const { level, sim } = vp(seed);
    const begun = beginQuarter(level, sim);
    return { level: begun, sim, m: begun.moments.find((x) => x.kind === 'priority')! };
  };

  // @spec VP-PRIO-001, VP-PRIO-002
  it('offers one division by name, spreading it, or pushing back; one division takes the stress, spreading slows it', () => {
    const { level, sim, m } = priority(5);
    expect(m.choices.map((c) => c.id)).toEqual([...level.divisionIds.map((g) => `one:${g}`), 'spread', 'push']);
    const g = level.divisionIds[1]!;
    const one = ok(chooseVp(level, sim, m.id, `one:${g}`));
    const p = one.sim.projects[one.level.priority!.projectId]!;
    expect(p).toMatchObject({ teamId: g, status: 'active' });
    expect(p.deadlineWeek - sim.week).toBeLessThanOrEqual(T.quartersPerHalf * T.weeksPerQuarter);
    expect(one.level.priority).toMatchObject({ divisionId: g, spreadSlow: 0 });
    expect(one.sim.teams[g]!.aggregate!.stress).toBe(Math.min(100, sim.teams[g]!.aggregate!.stress + T.priority.oneStress));
    const spread = ok(chooseVp(level, sim, m.id, 'spread'));
    expect(spread.level.priority!.spreadSlow).toBeGreaterThan(0);
  });

  // @spec VP-PRIO-002
  it('spreads the priority onto the calmest division even when no division has a director', () => {
    const { level, sim, m } = priority(5);
    const leaderless = set(sim, leads(level, sim).map((id) => ({ type: 'remove' as const, personId: id, reason: 'quit' as const, cause: RULE })));
    const r = ok(chooseVp(level, leaderless, m.id, 'spread'));
    const calm = [...level.divisionIds].sort((x, y) => leaderless.teams[x]!.aggregate!.stress - leaderless.teams[y]!.aggregate!.stress)[0];
    expect(r.sim.projects[r.level.priority!.projectId]!.teamId).toBe(calm);
  });

  // @spec VP-PRIO-003
  it('lets the player push back at no cost while a division is strained, and at a cost to the CEO’s trust otherwise', () => {
    const { level, sim, m } = priority(5);
    const calm = set(sim, level.divisionIds.map((g) => ({ type: 'value' as const, target: { kind: 'team' as const, id: g }, field: 'stress', amount: -100, cause: RULE })));
    const pushed = ok(chooseVp(level, calm, m.id, 'push'));
    expect(pushed.level.priority).toBeNull();
    expect(pushed.sim.people[level.ceoId]!.trust).toBe(Math.max(0, calm.people[level.ceoId]!.trust - T.priority.pushTrust));
    const strained = set(calm, [{ type: 'value', target: { kind: 'team', id: level.divisionIds[0]! }, field: 'stress', amount: 90, cause: RULE }]);
    expect(ok(chooseVp(level, strained, m.id, 'push')).sim.people[level.ceoId]!.trust).toBe(strained.people[level.ceoId]!.trust);
  });

  // @spec VP-PRIO-004
  it('lands a priority completed by its deadline and fails one overdue, moving reputation and the CEO’s trust by its stake', () => {
    const { level, sim, m } = priority(5);
    const started = ok(chooseVp(level, sim, m.id, `one:${level.divisionIds[0]}`));
    const pid = started.level.priority!.projectId;
    const stake = started.level.priority!.stake;
    // Completed as the simulation's advance completes it: progress at scope, the status set.
    const done = structuredClone(started.sim);
    done.projects[pid] = { ...done.projects[pid]!, progress: done.projects[pid]!.scope, status: 'completed' };
    const landed = ok(endQuarter({ ...started.level, completions: { [pid]: sim.week + 5 } }, done));
    expect(landed.level.priorityResults).toEqual([{ week: done.week, projectId: pid, landed: true }]);
    expect(landed.level.priority).toBeNull();
    const late = at(started.sim, started.sim.projects[pid]!.deadlineWeek + 1);
    const failed = ok(endQuarter(started.level, late));
    expect(failed.level.priorityResults.at(-1)).toMatchObject({ projectId: pid, landed: false });
    expect(failed.sim.projects[pid]!.status).toBe('cancelled');
    expect(failed.sim.people[level.ceoId]!.trust).toBeLessThan(landed.sim.people[level.ceoId]!.trust);
    expect(stake).toBeGreaterThanOrEqual(T.priority.stake[0]);
  });
});

describe('the leadership team and the directors', () => {
  // @spec VP-LT-001, VP-LT-002
  it('settles a dispute for the company, the function, or by a trade that works with a trusting peer', () => {
    const { level, sim } = vp(6);
    const peer = level.peerIds[0]!;
    const l = withMoment(level, { kind: 'dispute', personId: peer }, ['company', 'function', 'trade']);
    const company = ok(chooseVp(l, sim, 'm1', 'company'));
    expect(company.sim.people[level.ceoId]!.trust).toBeGreaterThan(sim.people[level.ceoId]!.trust);
    expect(company.sim.people[peer]!.trust).toBeLessThanOrEqual(sim.people[peer]!.trust);
    const fn = ok(chooseVp(l, sim, 'm1', 'function'));
    for (const d of leads(level, sim)) expect(fn.sim.people[d]!.trust).toBeGreaterThanOrEqual(sim.people[d]!.trust);
    for (const p of level.peerIds) expect(fn.sim.people[p]!.trust).toBeLessThanOrEqual(sim.people[p]!.trust);
    const trusting = set(sim, [{ type: 'value', target: { kind: 'person', id: peer }, field: 'trust', amount: 100, cause: RULE }]);
    const wary = set(sim, [{ type: 'value', target: { kind: 'person', id: peer }, field: 'trust', amount: -100, cause: RULE }]);
    expect(ok(chooseVp(l, wary, 'm1', 'trade')).sim.people[peer]!.trust).toBe(0);
    expect(ok(chooseVp(l, trusting, 'm1', 'trade')).sim.people[peer]!.trust).toBe(100);
    expect(ok(chooseVp(l, sim, 'm1', 'trade')).sim.player.stress).toBeGreaterThan(sim.player.stress);
  });

  // @spec VP-LT-003
  it('says who each answer to a dispute wins over and costs, and whose trust it cost', () => {
    const { level, sim } = vp(6);
    const peer = level.peerIds[0]!;
    const who = sim.people[peer]!.name;
    const drafted = (() => {
      for (let seed = 0; seed < 60; seed++) {
        const begun = beginQuarter({ ...level, rngState: seed + 1, lastDispute: -1 }, sim);
        const d = begun.moments.find((m) => m.kind === 'dispute');
        if (d) return d;
      }
      throw new Error('no dispute drawn');
    })();
    const named = sim.people[drafted.personId!]!.name;
    expect(drafted.choices.find((c) => c.id === 'company')!.label).toContain(`${named} loses the point`);
    expect(drafted.choices.find((c) => c.id === 'trade')!.label).toContain(`only if ${named} trusts you`);
    const l = withMoment(level, { kind: 'dispute', personId: peer }, ['company', 'function', 'trade']);
    expect(ok(chooseVp(l, sim, 'm1', 'company')).reaction).toContain(`${who} loses the point, and trusts you a little less`);
    expect(ok(chooseVp(l, sim, 'm1', 'function')).reaction).toMatch(/peers hear it too, and trust you less/);
    const wary = set(sim, [{ type: 'value', target: { kind: 'person', id: peer }, field: 'trust', amount: -100, cause: RULE }]);
    expect(ok(chooseVp(l, wary, 'm1', 'trade')).reaction).toBe(`${who} doesn't trust you enough to trade, and hears it as a no.`);
  });

  // @spec VP-ODDS-001
  it('grows both directors when they settle it together, costs the loser’s trust when decided, and slows both when left', () => {
    const { level, sim } = vp(6);
    const [a, b] = leads(level, sim);
    const capable = set(sim, [a!, b!].map((id) => ({ type: 'value' as const, target: { kind: 'person' as const, id }, field: 'skill', amount: 60 - sim.people[id]!.skill, cause: RULE })));
    const l = withMoment(level, { kind: 'odds', personId: a!, otherId: b! }, ['together', 'decide', 'leave']);
    const together = ok(chooseVp(l, capable, 'm1', 'together'));
    expect(together.sim.people[a!]!.skill).toBe(60 + T.odds.growth);
    expect(ok(chooseVp(l, capable, 'm1', 'decide')).sim.people[b!]!.trust).toBeLessThan(capable.people[b!]!.trust);
    const advanced = set(capable, Object.values(capable.projects).filter((p) => p.status === 'active').map((p) => ({ type: 'value' as const, target: { kind: 'project' as const, id: p.id }, field: 'progress', amount: 200, cause: RULE })));
    const left = ok(chooseVp(l, advanced, 'm1', 'leave'));
    const theirs = Object.values(advanced.projects).filter((p) => p.status === 'active' && [level.divisionIds[0], level.divisionIds[1]].includes(p.teamId));
    for (const p of theirs) expect(left.sim.projects[p.id]!.progress).toBeLessThan(p.progress);
  });

  // @spec VP-VIS-001, VP-VIS-003
  it('reveals the want of each person a moment was about once it is answered', () => {
    const { level, sim } = vp(6);
    const [a, b] = leads(level, sim);
    const r = ok(chooseVp(withMoment(level, { kind: 'odds', personId: a!, otherId: b! }, ['leave']), sim, 'm1', 'leave'));
    expect(r.level.learnedWants).toMatchObject({ [a!]: true, [b!]: true });
  });
});

describe('cuts', () => {
  const total = (level: VpState, sim: SimState) => divisions(level, sim).reduce((n, a) => n + a.headcount, 0);

  // @spec VP-CUT-001
  it('asks for one cut at most, only from the second year, naming a share of the function’s heads', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { level, sim } = vp(seed);
      expect(beginQuarter(level, sim).moments.some((m) => m.kind === 'cuts')).toBe(false);
      let l: VpState = level;
      let asked = 0;
      for (let q = 4; q < 12; q++) {
        const begun = beginQuarter(l, at(sim, sim.week + q * 13));
        const cut = begun.moments.find((m) => m.kind === 'cuts');
        if (cut) {
          asked++;
          expect(cut.heads).toBeGreaterThanOrEqual(Math.round(total(level, sim) * T.cuts.share[0]) - 1);
          expect(cut.heads).toBeLessThanOrEqual(Math.round(total(level, sim) * T.cuts.share[1]) + 1);
        }
        l = { ...begun, moments: [] };
      }
      expect(asked).toBeLessThanOrEqual(1);
    }
  });

  // @spec VP-CUT-002, VP-CUT-005
  it('cuts once from the largest division, cancelling its projects furthest from done, and does not count the heads as attrition', () => {
    const { level, sim } = vp(7);
    const s = structuredClone(level);
    const largest = [...level.divisionIds].sort((x, y) => sim.teams[y]!.aggregate!.headcount - sim.teams[x]!.aggregate!.headcount)[0]!;
    const after = makeCut(s, sim, 6, 'once', []);
    expect(after.teams[largest]!.aggregate!.headcount).toBe(sim.teams[largest]!.aggregate!.headcount - 6);
    expect(Object.values(after.projects).some((p) => p.teamId === largest && p.status === 'cancelled')).toBe(true);
    for (const a of divisions(level, after)) expect(a.motivation).toBeLessThan(100);
    expect(s.cutHeads).toEqual([{ week: sim.week, count: 6, divisions: { [largest]: 6 } }]);
    expect(afterAdvanceVp(s, after).level.regretted).toEqual([]);
  });

  // @spec VP-CUT-003
  it('cuts across every division by share, lowering every division’s motivation more and slowing every project', () => {
    const { level, sim } = vp(7);
    const s = structuredClone(level);
    const advanced = set(sim, Object.values(sim.projects).filter((p) => p.status === 'active').map((p) => ({ type: 'value' as const, target: { kind: 'project' as const, id: p.id }, field: 'progress', amount: 300, cause: RULE })));
    const after = makeCut(s, advanced, 9, 'across', []);
    expect(total(level, advanced) - total(level, after)).toBe(9);
    for (const g of level.divisionIds) expect(after.teams[g]!.aggregate!.motivation).toBe(Math.max(0, advanced.teams[g]!.aggregate!.motivation - T.cuts.acrossMotivation));
    for (const p of Object.values(advanced.projects).filter((x) => x.status === 'active' && level.divisionIds.includes(x.teamId))) expect(after.projects[p.id]!.progress).toBeLessThan(p.progress);
  });

  // @spec VP-CUT-004
  it('cuts in waves: a third now, the rest in two waves at the next two quarter ends', () => {
    const { level, sim } = vp(7);
    const s = structuredClone(level);
    const after = makeCut(s, sim, 9, 'waves', []);
    expect(total(level, sim) - total(level, after)).toBe(3);
    expect(s.cut.waves).toEqual([3, 3]);
    const r = ok(endQuarter(s, after));
    expect(r.level.cut.waves).toEqual([3]);
    expect(total(level, after) - total(level, r.sim)).toBe(3);
  });
});

describe('the all-hands', () => {
  const hands = (seed: number) => {
    const { level, sim } = vp(seed);
    const begun = beginQuarter(level, sim);
    return { level: begun, sim, m: begun.moments.at(-1)! };
  };

  // @spec VP-HANDS-001, VP-HANDS-002, VP-HANDS-004
  it('steadies the function when the truth is told in a hard quarter, does nothing when kept short', () => {
    const { level, sim, m } = hands(8);
    expect(m.choices.map((c) => c.id)).toEqual(['truth', 'celebrate', 'short']);
    const g = level.divisionIds[0]!;
    const hard = set(sim, [{ type: 'value', target: { kind: 'team', id: g }, field: 'stress', amount: 100, cause: RULE }]);
    const truth = ok(chooseVp(level, hard, m.id, 'truth'));
    expect(truth.sim.teams[level.divisionIds[1]!]!.aggregate!.motivation).toBe(Math.min(100, hard.teams[level.divisionIds[1]!]!.aggregate!.motivation + T.allHands.truthMotivation));
    expect(truth.level.told).toEqual({ what: 'truth', quarter: 1 });
    const short = ok(chooseVp(level, hard, m.id, 'short'));
    expect(divisions(level, short.sim)).toEqual(divisions(level, hard));
  });

  // @spec VP-HANDS-003
  it('lifts the function with a celebration, and costs more when hard news lands later that year', () => {
    const { level, sim, m } = hands(8);
    const celebrated = ok(chooseVp(level, sim, m.id, 'celebrate'));
    expect(celebrated.level.told).toEqual({ what: 'celebration', quarter: 1 });
    const next = at(celebrated.sim, sim.week + 13);
    const g = level.divisionIds[0]!;
    const hard = set(next, [{ type: 'value', target: { kind: 'team', id: g }, field: 'stress', amount: 100, cause: RULE }]);
    const quiet = ok(endQuarter({ ...celebrated.level, moments: [], quarterStart: null }, next));
    const found = ok(endQuarter({ ...celebrated.level, moments: [], quarterStart: null }, hard));
    expect(found.level.told).toEqual({ what: 'truth', quarter: 2 });
    expect(quiet.level.told).toEqual({ what: 'celebration', quarter: 1 });
    const other = level.divisionIds[1]!;
    expect(found.sim.teams[other]!.aggregate!.motivation).toBeLessThan(quiet.sim.teams[other]!.aggregate!.motivation);
  });
});

describe('the quarter’s end', () => {
  // @spec VP-HABIT-004
  it('with the function first, raises directors’ trust and lowers the peers’; with the leadership team first, the reverse', () => {
    const { level, sim } = vp(9);
    const fn = ok(endQuarter(level, sim));
    for (const p of level.peerIds) expect(fn.sim.people[p]!.trust).toBe(Math.max(0, sim.people[p]!.trust - T.firstTeam.functionPeerTrust));
    const lt = ok(endQuarter({ ...level, habits: { ...level.habits, firstTeam: 'leadership' } }, sim));
    for (const p of [level.ceoId, ...level.peerIds]) expect(lt.sim.people[p]!.trust).toBe(Math.min(100, sim.people[p]!.trust + T.firstTeam.leadershipTrust));
  });

  // @spec VP-HABIT-005
  it('grows capable directors when given room, and with close review costs their trust and the player’s energy', () => {
    const { level, sim } = vp(9);
    const d = leads(level, sim);
    const capable = set(sim, d.map((id) => ({ type: 'value' as const, target: { kind: 'person' as const, id }, field: 'skill', amount: 60 - sim.people[id]!.skill, cause: RULE })));
    const room = ok(endQuarter(level, capable));
    for (const id of d) expect(room.sim.people[id]!.skill).toBe(60 + T.directors.growth);
    const review = ok(endQuarter({ ...level, habits: { ...level.habits, directors: 'review' } }, capable));
    expect(review.sim.player.stress).toBeGreaterThan(room.sim.player.stress);
    for (const id of d) expect(review.sim.people[id]!.skill).toBe(60);
  });

  // @spec VP-DRIFT-001, VP-DRIFT-002
  it('moves each division a share of the way toward what its director sustains, sets its attrition risk, and moves each director toward their division', () => {
    const { level, sim } = vp(9);
    const r = ok(endQuarter(level, sim));
    const clamp = (x: number) => Math.max(0, Math.min(100, x));
    for (const g of level.divisionIds) {
      const was = sim.teams[g]!.aggregate!;
      const target = sustained(sim.people[leaderOf(sim, g)!]!.skill, T.drift);
      const now = r.sim.teams[g]!.aggregate!;
      expect(now.motivation).toBe(clamp(was.motivation + Math.round((target.motivation - was.motivation) * T.drift.driftShare)));
      expect(now.stress).toBe(clamp(was.stress + Math.round((target.stress - was.stress) * T.drift.driftShare)));
      expect(now.attritionRisk).toBe(attritionRiskOf(now.motivation, now.stress));
      const lead = leaderOf(sim, g)!;
      const m = sim.people[lead]!;
      expect(r.sim.people[lead]!.stress).toBe(clamp(m.stress + Math.round((was.stress - m.stress) * T.drift.leaderStressShare)));
    }
  });

  // @spec VP-DRIFT-002
  it('serves a director who wants recognition with the function first, or with an all-hands that spoke about the work', () => {
    const { level, sim } = vp(9);
    const lead = leads(level, sim)[0]!;
    const wants = structuredClone(sim);
    wants.people[lead]!.want = 'recognition';
    const company = { ...level, habits: { ...level.habits, firstTeam: 'leadership' as const } };
    const motivation = (l: VpState) => ok(endQuarter(l, wants)).sim.people[lead]!.motivation;
    const was = wants.people[lead]!.motivation;
    // A served want's lift is multiplied by the simulation's want-tag multiplier.
    const served = Math.min(100, Math.round(was + T.drift.wantServed * SIM.wantTagMultiplier));
    expect(motivation(company)).toBe(Math.max(0, was + T.drift.wantUnserved));
    expect(motivation({ ...company, told: { what: 'truth', quarter: 1 } })).toBe(served);
    expect(motivation({ ...company, told: { what: 'short', quarter: 1 } })).toBe(Math.max(0, was + T.drift.wantUnserved));
    expect(motivation(level)).toBe(served);
  });

  // @spec VP-DRIFT-003, VP-DRIFT-004, VP-PLAN-001
  it('at the end of a review period, calibrates the divisions, rates the directors and takes the survey', () => {
    const { level, sim } = vp(9);
    const second = at(sim, sim.week + 13);
    const r = ok(endQuarter(level, second));
    expect(r.level.calibrations).toHaveLength(1);
    expect(r.level.survey.quarter).toBe(2);
    for (const id of leads(level, sim)) expect(r.sim.people[id]!.performance).not.toBe('unrated');
    expect(ok(endQuarter(level, sim)).level.calibrations).toHaveLength(0);
  });

  // @spec VP-PLAN-002, VP-PLAN-003
  it('holds a director on a plan for a final evaluation, and offers a new director for a leaderless division', () => {
    const { level, sim } = vp(9);
    const lead = leads(level, sim)[1]!;
    const held = { ...level, heldEvaluations: [lead] };
    const m = beginQuarter(held, sim).moments[0]!;
    expect(m).toMatchObject({ kind: 'finalEvaluation', personId: lead });
    const letGo = ok(chooseVp(beginQuarter(held, sim), sim, m.id, 'letGo'));
    expect(letGo.sim.people[lead]!.status).not.toBe('active');
    expect(letGo.level.letGo).toEqual([lead]);
    const next = beginQuarter(letGo.level, at(letGo.sim, sim.week + 13));
    const replace = next.moments.find((x) => x.kind === 'newDirector')!;
    expect(replace.divisionId).toBe(level.divisionIds[1]);
    const promoted = ok(chooseVp(next, at(letGo.sim, sim.week + 13), replace.id, 'promote'));
    expect(leaderOf(promoted.sim, level.divisionIds[1]!)).not.toBeNull();
  });
});

describe('the recap', () => {
  // @spec VP-RECAP-001, VP-CUT-005
  it('tells what changed, with heads cut apart from heads who left or joined, and the routine', () => {
    const { level, sim } = vp(12);
    const begun = beginQuarter(level, sim);
    const s = structuredClone(begun);
    const after = makeCut(s, sim, 6, 'across', []);
    const r = ok(endQuarter(s, after));
    expect(r.recap.changes.cut).toBe(6);
    // Heads cut are not reported as having left.
    expect(r.recap.changes.heads.every((h) => h.change >= 0)).toBe(true);
    expect(r.recap.routine.habits[0]).toBe('You put your function first.');
    expect(r.recap.routine.goals).toHaveLength(begun.goals.length);
    expect(r.recap.changes.leadership.every((u) => ['trusts you more', 'trusts you less'].includes(u.change))).toBe(true);
  });
});

describe('directors who quit', () => {
  // @spec VP-RECAP-002
  it('reports each director who quit in the quarter just played, with what led to it and the last thing between you', () => {
    const { level, sim } = vp(3);
    const lead = leaderOf(sim, level.divisionIds[0]!)!;
    const end = sim.week + T.weeksPerQuarter;
    const after = { ...structuredClone(sim), week: end };
    Object.assign(after.people[lead]!, { status: 'departed', departure: { week: sim.week, reason: 'quit' }, lowMotivationWeeks: 6, highStressWeeks: 0, trust: 70 });
    after.people[lead]!.history.push({ week: sim.week - 2, cause: { kind: 'rule', ruleId: 'x' }, note: 'Wanted a bigger remit' });
    expect(quitLastQuarter(level, after)).toEqual([{ personId: lead, name: sim.people[lead]!.name, lowMotivationWeeks: 6, highStressWeeks: 0, lowTrust: false, lastMemory: 'Wanted a bigger remit' }]);
    expect(quitLastQuarter(level, { ...after, week: end + T.weeksPerQuarter })).toEqual([]);
  });

  // @spec VP-RECAP-003
  it('reports each division that lost heads in the quarter just played, and how many were rated meets or better', () => {
    const { level: l0, sim } = vp(3);
    const level = { ...structuredClone(l0), knownRatings: knownRatings(l0.divisionIds, sim) };
    const [d1, d2] = level.divisionIds as [string, string];
    const after = structuredClone(sim);
    after.week = after.week + T.weeksPerQuarter;
    const a = after.teams[d1]!.aggregate!;
    const keep = a.ratings.meets > 0 ? 'meets' : a.ratings.exceeds > 0 ? 'exceeds' : 'outstanding';
    const other = a.ratings.unrated > 0 ? 'unrated' : a.ratings.partial > 0 ? 'partial' : 'below';
    a.headcount = a.headcount - 2;
    a.ratings[keep] = a.ratings[keep] - 1;
    a.ratings[other] = a.ratings[other] - 1;
    const advanced = afterAdvanceVp(level, after).level;
    expect(headsLostLastQuarter(advanced, after)).toEqual([{ divisionId: d1, name: sim.teams[d1]!.name, count: 2, regretted: 1 }]);
    expect(headsLostLastQuarter(advanced, after).some((x) => x.divisionId === d2)).toBe(false);
    expect(headsLostLastQuarter(advanced, { ...after, week: after.week + T.weeksPerQuarter })).toEqual([]);
  });
});

describe('goals, the scorecard and reviews', () => {
  // @spec VP-GOAL-001, VP-GOAL-002, VP-GOAL-003
  it('sets two or three goals each period, shows their progress, and scores each as a measure', () => {
    const { level, sim } = vp(10);
    const begun = beginQuarter(level, sim);
    expect(begun.goals.length).toBeGreaterThanOrEqual(2);
    expect(begun.goals.length).toBeLessThanOrEqual(3);
    expect(begun.goals.map((g) => g.kind)).toContain('fewRegretted');
    const view = vpLevel.view(begun, sim) as { goals: { text: string; progress: string }[] };
    expect(view.goals).toHaveLength(begun.goals.length);
    const measures = assessVp(begun, sim).measures.map((m) => m.id);
    for (const g of begun.goals) expect(measures).toContain(`goal:${g.id}`);
  });

  // @spec VP-END-001, VP-END-002, VP-END-003
  it('steps thirteen weeks, reviews every two quarters, and scores priorities, the function’s health and the leadership team’s confidence', () => {
    const { level, sim } = vp(10);
    expect(VP_LEVEL.weeksPerStep).toBe(13);
    expect(reviewDue(level, sim)).toBe(false);
    expect(reviewDue(level, at(sim, sim.week + 13))).toBe(false);
    expect(reviewDue(level, at(sim, sim.week + 26))).toBe(true);
    const card = vpScorecard(level, sim);
    expect(card.business.prioritiesLanded).toBeNull();
    expect(card.confidence.ceo).toBe(sim.people[level.ceoId]!.trust);
    const ids = assessVp(level, sim).measures.map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(['projectsOnTime', 'regrettedAttrition', 'motivation', 'stress', 'ceoConfidence', 'peerConfidence']));
    const landed = { ...level, priorityResults: [{ week: sim.week + 1, projectId: 'pp1', landed: true }] };
    expect(vpScorecard(landed, at(sim, sim.week + 26)).business.prioritiesLanded).toBe(1);
  });

  // @spec VP-END-004, VP-END-005
  it('opens promotion from the third review and has its last review at quarter twelve', () => {
    const { level, sim } = vp(10);
    const atQuarter = (q: number) => assessVp(level, at(sim, sim.week + q * 13));
    expect(atQuarter(4)).toMatchObject({ promotionPossible: false, lastReview: false, reviewsUntilPromotion: 1 });
    expect(atQuarter(6)).toMatchObject({ promotionPossible: true, lastReview: false, reviewsLeft: 3 });
    expect(atQuarter(12)).toMatchObject({ promotionPossible: true, lastReview: true, reviewsLeft: 0 });
  });

  // @spec VP-END-006
  it('reports burnout after two quarters in a row at the edge', () => {
    const { level, sim } = vp(10);
    const edge = set(sim, [{ type: 'value', target: { kind: 'player' }, field: 'stress', amount: LINE_TUNING.burnoutThreshold + 5 - sim.player.stress, cause: RULE }]);
    const once = afterAdvanceVp(level, edge);
    expect(once.burnedOut).toBe(false);
    expect(afterAdvanceVp(once.level, edge).burnedOut).toBe(true);
    expect(band(100 - edge.player.stress)).toBeLessThanOrEqual(1);
  });
});

describe('the turn loop contract', () => {
  const deps: Dependencies = { levels: [lineManagerLevel, seniorManagerLevel, directorLevel, vpLevel], review: conductReview };

  /** A run handed straight up three times to outside hires, at the start of the VP level. */
  function atVp(seed: number): Run {
    let run: Run = newRun(seed, CONTENT, deps);
    for (const level of [seniorManagerLevel, directorLevel, vpLevel]) {
      run = { ...run, phase: 'handover', handoverChoices: level.handoverChoices!(run.level, run.sim) };
      const r = applyCommand(run, { kind: 'handover', choice: 'hire' }, CONTENT, deps);
      if (!r.ok) throw new Error(r.error);
      run = r.run;
    }
    return run;
  }

  // @spec VP-CONTRACT-001, VP-END-007, VP-STATE-001
  it('takes over a director run, steps thirteen weeks, and plays twelve quarters without error, the same every time', () => {
    const play = (seed: number) => {
      let run = atVp(seed);
      expect(run.levelId).toBe('vp');
      for (let step = 0; step < 400 && run.phase !== 'ended'; step++) {
        const command = run.phase === 'review' ? { kind: 'acknowledge' as const } : run.week.find((m) => m.status === 'open') ? { kind: 'wait' as const } : { kind: 'endWeek' as const };
        const r = applyCommand(run, command, CONTENT, deps);
        if (!r.ok) throw new Error(`${command.kind}: ${r.error}`);
        run = r.run;
      }
      return run;
    };
    for (const seed of [1, 2, 3]) {
      const run = play(seed);
      expect(run.phase).toBe('ended');
      expect(['stayed', 'burnout', 'managedOut', 'completed']).toContain(run.ending);
      expect(JSON.parse(JSON.stringify(run.level))).toEqual(run.level);
      expect(play(seed)).toEqual(run);
    }
    const begun = atVp(4);
    const days = vpLevel.moments(begun.level as VpState, begun.sim).map((m) => m.day);
    expect(days.at(-1)).toBe(12 * 5 + 4);
  });

  // @spec VP-CONTRACT-001
  it('closes a moment that can no longer be answered', () => {
    const { level, sim } = vp(11);
    const [a, b] = leads(level, sim);
    const l = withMoment(level, { kind: 'odds', personId: a!, otherId: b! }, ['leave']);
    expect(vpLevel.moments(l, sim)[0]!.open).toBe(true);
    const gone = set(sim, [{ type: 'remove', personId: b!, reason: 'quit', cause: RULE }]);
    expect(vpLevel.moments(l, gone)[0]!.open).toBe(false);
  });
});
