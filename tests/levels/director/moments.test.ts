import { describe, expect, it } from 'vitest';
import {
  DIRECTOR_TUNING as T,
  afterAdvanceDirector,
  beginQuarter,
  chooseDirector,
  endQuarter,
  headcountGiven,
  leaderOf,
  type DirectorMoment,
  type DirectorState,
} from '../../../src/levels/director';
import { applyEffects, PERFORMANCE_LEVELS, type Effect, type SimState } from '../../../src/sim';
import { realContent } from '../../balance/harness';
import { director } from './fixtures';

const RULE = { kind: 'rule', ruleId: 'test' } as const;
type R<X> = ({ ok: true } & X) | { ok: false; error: string };
const ok = <X>(r: R<X>) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};
type NoCause = Effect extends infer E ? (E extends unknown ? Omit<E, 'cause'> : never) : never;
const fx = (sim: SimState, effects: NoCause[]) => {
  const r = applyEffects(sim, effects.map((e): Effect => ({ ...e, cause: RULE })));
  if (!r.ok) throw new Error(r.error.message);
  return r.state;
};
const at = (sim: SimState, week: number): SimState => ({ ...structuredClone(sim), week });
const begun = (seed = 2) => {
  const d = director(seed);
  return { level: beginQuarter(d.level, d.sim), sim: d.sim };
};
const find = (level: DirectorState, kind: DirectorMoment['kind']) => level.moments.find((m) => m.kind === kind)!;
const choose = (level: DirectorState, sim: SimState, kind: DirectorMoment['kind'], choice: string) => ok(chooseDirector(level, sim, find(level, kind).id, choice));
const trust = (sim: SimState, id: string) => sim.people[id]!.trust;

describe('a quarter’s moments', () => {
  // @spec DIR-MOMENT-001, DIR-MOMENT-002
  it('opens with headcount, offers bets in a period’s first quarter, closes with the quarterly review, in order through the quarter', () => {
    const { level } = begun();
    const kinds = level.moments.map((m) => m.kind);
    expect(kinds[0]).toBe('headcount');
    expect(kinds).toContain('bets');
    expect(kinds.at(-1)).toBe('review');
    expect(level.moments.length).toBeLessThanOrEqual(T.momentCap);
    expect(level.moments[0]!.week).toBe(0);
    expect(level.moments.at(-1)!.week).toBe(12);
    const slots = level.moments.map((m) => m.week * 5 + m.day);
    expect([...slots].sort((a, b) => a - b)).toEqual(slots);
    // no bets in a period's second quarter
    const d = director(2);
    expect(beginQuarter(d.level, at(d.sim, d.sim.week + 13)).moments.map((m) => m.kind)).not.toContain('bets');
  });

  // @spec DIR-MOMENT-001, DIR-PLAN-003
  it('puts final evaluations first, then a new senior manager for a group that has none', () => {
    const d = director(2);
    const [held, gone] = [leaderOf(d.sim, d.level.groupIds[1]!)!, leaderOf(d.sim, d.level.groupIds[2]!)!];
    const sim = fx(d.sim, [{ type: 'remove', personId: gone, reason: 'quit' }]);
    const level = beginQuarter({ ...d.level, heldEvaluations: [held] }, sim);
    expect(level.moments.slice(0, 3).map((m) => m.kind)).toEqual(['finalEvaluation', 'newSenior', 'headcount']);
  });

  // @spec DIR-MOMENT-003
  it('brings a group in trouble: coaching grows a developing senior manager, deciding fixes more at a cost, replacing leaves it leaderless', () => {
    const d = director(4);
    const g = d.level.groupIds[1]!;
    const lead = leaderOf(d.sim, g)!;
    const sim = fx(d.sim, [{ type: 'value', target: { kind: 'team', id: g }, field: 'stress', amount: 100 }, { type: 'value', target: { kind: 'person', id: lead }, field: 'skill', amount: 30 - d.sim.people[lead]!.skill }]);
    const level = beginQuarter(d.level, sim);
    const trouble = level.moments.find((m) => m.kind === 'trouble' && m.groupId === g)!;
    expect(trouble.choices.map((c) => c.id)).toEqual(['coach', 'decide', 'replace']);
    const coached = ok(chooseDirector(level, sim, trouble.id, 'coach')).sim;
    expect(coached.teams[g]!.aggregate!.stress).toBe(100 - T.trouble.coachFix);
    expect(coached.people[lead]!.skill).toBe(30 + T.trouble.coachGrowth);
    const decided = ok(chooseDirector(level, sim, trouble.id, 'decide')).sim;
    expect(decided.teams[g]!.aggregate!.stress).toBe(100 - T.trouble.decideFix);
    expect(decided.people[lead]!.skill).toBe(30);
    expect(decided.people[lead]!.trust).toBe(sim.people[lead]!.trust - T.trouble.decideTrust);
    expect(decided.player.stress).toBe(sim.player.stress + T.trouble.decideEnergy);
    const replaced = ok(chooseDirector(level, sim, trouble.id, 'replace')).sim;
    expect(replaced.people[lead]!.status).toBe('departed');
    expect(leaderOf(replaced, g)).toBeNull();
  });

  // @spec DIR-MOMENT-004
  it('offers to merge a group too small for a senior manager into the smallest other group, closing it', () => {
    const d = director(4);
    const small = d.level.groupIds[2]!;
    const a = d.sim.teams[small]!.aggregate!;
    const sim = fx(d.sim, [{ type: 'value', target: { kind: 'team', id: small }, field: 'headcount', amount: T.org.min - 1 - a.headcount }]);
    const level = beginQuarter(d.level, sim);
    const org = level.moments.find((m) => m.kind === 'orgDesign')!;
    expect(org.groupId).toBe(small);
    expect(org.choices.map((c) => c.id)).toContain('merge');
    const into = d.level.groupIds.filter((g) => g !== small).sort((x, y) => sim.teams[x]!.aggregate!.headcount - sim.teams[y]!.aggregate!.headcount)[0]!;
    const before = sim.teams[into]!.aggregate!.headcount;
    const r = ok(chooseDirector(level, sim, org.id, 'merge'));
    expect(r.sim.teams[small]).toBeUndefined();
    expect(r.level.groupIds).not.toContain(small);
    expect(r.sim.teams[into]!.aggregate!.headcount).toBe(before + sim.teams[small]!.aggregate!.headcount + 1);
    for (const p of Object.values(sim.projects).filter((x) => x.teamId === small && x.status === 'active')) expect(r.sim.projects[p.id]!.teamId).toBe(into);
  });

  // @spec DIR-MOMENT-004
  it('offers to split a group too large for one senior manager, promoting or hiring for the new group, half its heads and projects moving', () => {
    const d = director(4);
    const big = d.level.groupIds[1]!;
    const a = d.sim.teams[big]!.aggregate!;
    const sim = fx(d.sim, [{ type: 'value', target: { kind: 'team', id: big }, field: 'headcount', amount: T.org.max + 2 - a.headcount }]);
    const level = beginQuarter(d.level, sim);
    const org = level.moments.find((m) => m.kind === 'orgDesign' && m.groupId === big)!;
    expect(org.choices.map((c) => c.id)).toEqual(['splitPromote', 'splitHire', 'leave']);
    const heads = sim.teams[big]!.aggregate!.headcount;
    const promoted = ok(chooseDirector(level, sim, org.id, 'splitPromote'));
    const added = promoted.level.groupIds.find((g) => !level.groupIds.includes(g))!;
    expect(promoted.level.groupIds).toHaveLength(level.groupIds.length + 1);
    const [left, right] = [promoted.sim.teams[big]!.aggregate!, promoted.sim.teams[added]!.aggregate!];
    expect(left.headcount + right.headcount).toBe(heads);
    expect(Math.abs(left.headcount - right.headcount)).toBeLessThanOrEqual(PERFORMANCE_LEVELS.length);
    expect(leaderOf(promoted.sim, added)).not.toBeNull();
    const projects = (sim2: SimState, g: string) => Object.values(sim2.projects).filter((p) => p.teamId === g && p.status === 'active').length;
    expect(projects(promoted.sim, big) + projects(promoted.sim, added)).toBe(projects(sim, big));
    const hired = ok(chooseDirector(level, sim, org.id, 'splitHire'));
    const hiredGroup = hired.level.groupIds.find((g) => !level.groupIds.includes(g))!;
    expect(leaderOf(hired.sim, hiredGroup)).toBeNull();
    expect(leaderOf(ok(endQuarter(hired.level, hired.sim)).sim, hiredGroup)).not.toBeNull();
  });

  // @spec DIR-MOMENT-005
  it('rejects a moment that is not open or a choice it does not offer, changing nothing', () => {
    const { level, sim } = begun();
    const id = find(level, 'review').id;
    expect(chooseDirector(level, sim, 'nope', 'straight').ok).toBe(false);
    expect(chooseDirector(level, sim, id, 'shrug').ok).toBe(false);
    const done = ok(chooseDirector(level, sim, id, 'straight'));
    expect(chooseDirector(done.level, done.sim, id, 'straight').ok).toBe(false);
  });

  // @spec DIR-MOMENT-006, DIR-HEAD-003
  it('lets an unanswered quarter wait: headcount held back, no bet funded, the review told straight', () => {
    const { level, sim } = begun();
    const given = find(level, 'headcount').heads!;
    const r = ok(endQuarter(level, sim));
    expect(r.level.moments.every((m) => m.status !== 'open')).toBe(true);
    expect(r.level.bets).toEqual([]);
    const spread = ok(chooseDirector(level, sim, find(level, 'headcount').id, 'spread'));
    const told = ok(chooseDirector(spread.level, spread.sim, find(level, 'review').id, 'straight'));
    const answered = ok(endQuarter(told.level, told.sim));
    expect(trust(answered.sim, level.executiveId) - trust(r.sim, level.executiveId)).toBe(given * T.head.heldTrust);
  });

  // @spec DIR-MOMENT-007
  it('has no director situation that lowers a group’s headcount', () => {
    for (const s of realContent().filter((x) => x.levels.includes('director'))) {
      for (const c of s.choices) for (const o of c.outcomes) for (const e of o.effects as { type: string; field?: string; amount?: number }[]) expect(e.type === 'value' && e.field === 'headcount' && (e.amount ?? 0) < 0, s.id).toBe(false);
    }
  });
});

describe('headcount', () => {
  // @spec DIR-HEAD-001
  it('gives more heads with more of the executive’s trust and a better reputation', () => {
    const { level, sim } = director(2);
    const low = fx(sim, [{ type: 'value', target: { kind: 'person', id: level.executiveId }, field: 'trust', amount: -100 }, { type: 'value', target: { kind: 'player' }, field: 'reputation', amount: -100 }]);
    const high = fx(sim, [{ type: 'value', target: { kind: 'person', id: level.executiveId }, field: 'trust', amount: 100 }, { type: 'value', target: { kind: 'player' }, field: 'reputation', amount: 100 }]);
    expect(headcountGiven(level, high)).toBeGreaterThan(headcountGiven(level, low));
    expect(find(beginQuarter(level, sim), 'headcount').heads).toBe(headcountGiven(level, sim));
  });

  // @spec DIR-HEAD-002
  it('adds heads placed in a group as unrated, with onboarding stress, speeds a bet, and holds back the rest', () => {
    const { level: l0, sim: s0 } = begun();
    const sim = fx(s0, [{ type: 'value', target: { kind: 'person', id: l0.executiveId }, field: 'trust', amount: 100 }]);
    const level = beginQuarter({ ...l0, moments: [] }, sim);
    const heads = find(level, 'headcount').heads!;
    expect(heads).toBeGreaterThanOrEqual(3);
    const funded = choose(level, sim, 'bets', `fund:${JSON.stringify({ [find(level, 'bets').offers![0]!.id]: level.groupIds[1] })}`);
    const bet = funded.level.bets[0]!;
    const g = level.groupIds[0]!;
    const before = funded.sim.teams[g]!.aggregate!;
    const r = ok(chooseDirector(funded.level, funded.sim, find(level, 'headcount').id, `place:${JSON.stringify({ [g]: 2, [`bet:${bet.projectId}`]: 1 })}`));
    const after = r.sim.teams[g]!.aggregate!;
    expect(after.headcount).toBe(before.headcount + 2);
    expect(after.ratings.unrated).toBe(before.ratings.unrated + 2);
    expect(after.stress).toBe(Math.min(100, before.stress + 2 * T.head.onboardingStress));
    expect(r.sim.projects[bet.projectId]!.progress).toBe(funded.sim.projects[bet.projectId]!.progress + T.head.betSpeed);
    expect(r.sim.teams[bet.groupId]!.aggregate!.headcount).toBe(funded.sim.teams[bet.groupId]!.aggregate!.headcount + 1);
    expect(trust(r.sim, level.executiveId)).toBe(trust(funded.sim, level.executiveId) - (heads - 3) * T.head.heldTrust);
  });

  // @spec DIR-HEAD-004
  it('rejects placing more heads than given, unknown groups or bets, or negative counts', () => {
    const { level, sim } = begun();
    const m = find(level, 'headcount');
    for (const bad of [{ [level.groupIds[0]!]: m.heads! + 1 }, { nope: 1 }, { 'bet:nope': 1 }, { [level.groupIds[0]!]: -1 }, { [level.groupIds[0]!]: 1.5 }]) {
      expect(chooseDirector(level, sim, m.id, `place:${JSON.stringify(bad)}`).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(chooseDirector(level, sim, m.id, 'place:{not json').ok).toBe(false);
  });
});

describe('strategy bets', () => {
  // @spec DIR-BET-001
  it('offers two or three bets, each with scope, deadline, stakes and the peer it touches', () => {
    const offers = find(begun().level, 'bets').offers!;
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(offers.length).toBeLessThanOrEqual(3);
    for (const o of offers) expect(o).toMatchObject({ id: expect.any(String), name: expect.any(String), scope: expect.any(Number), deadlineWeeks: expect.any(Number), landing: expect.any(Number), failing: expect.any(Number) });
  });

  // @spec DIR-BET-002, DIR-BET-005
  it('funds up to two bets on named groups, or none, and rejects more, unknown bets or groups', () => {
    const { level, sim } = begun();
    const m = find(level, 'bets');
    const [a, b, c] = m.offers!;
    const two = ok(chooseDirector(level, sim, m.id, `fund:${JSON.stringify({ [a!.id]: level.groupIds[0], [b!.id]: level.groupIds[1] })}`));
    expect(two.level.bets).toHaveLength(2);
    for (const bet of two.level.bets) expect(two.sim.projects[bet.projectId]).toMatchObject({ teamId: bet.groupId, status: 'active' });
    expect(ok(chooseDirector(level, sim, m.id, 'none')).level.bets).toEqual([]);
    const bad = [{ nope: level.groupIds[0] }, { [a!.id]: 'nope' }, ...(c ? [{ [a!.id]: level.groupIds[0], [b!.id]: level.groupIds[0], [c.id]: level.groupIds[0] }] : [])];
    for (const x of bad) expect(chooseDirector(level, sim, m.id, `fund:${JSON.stringify(x)}`).ok, JSON.stringify(x)).toBe(false);
  });

  const funded = () => {
    const { level, sim } = begun(6);
    const m = find(level, 'bets');
    return ok(chooseDirector(level, sim, m.id, `fund:${JSON.stringify({ [m.offers![0]!.id]: level.groupIds[1] })}`));
  };

  // @spec DIR-BET-003
  it('lands a bet completed by its deadline, and fails one overdue past the grace, cancelling it', () => {
    const raw = funded();
    // nothing else open, so only the bet moves reputation
    const f = { ...raw, level: { ...raw.level, moments: [] } };
    const bet = f.level.bets[0]!;
    const p = f.sim.projects[bet.projectId]!;
    const done = fx(f.sim, [{ type: 'value', target: { kind: 'project', id: p.id }, field: 'progress', amount: p.scope }]);
    const completed = { ...structuredClone(done), projects: { ...done.projects, [p.id]: { ...done.projects[p.id]!, status: 'completed' as const } } };
    const landed = ok(endQuarter(afterAdvanceDirector(f.level, completed).level, completed));
    expect(landed.sim.player.reputation).toBe(Math.min(100, f.sim.player.reputation + bet.landing));
    expect(landed.level.bets).toEqual([]);
    const late = at(f.sim, p.deadlineWeek + T.bets.grace + 1);
    const failed = ok(endQuarter(f.level, late));
    expect(failed.sim.projects[p.id]!.status).toBe('cancelled');
    expect(failed.sim.player.reputation).toBeLessThan(late.player.reputation);
    expect(failed.level.bets).toEqual([]);
  });

  // @spec DIR-BET-004
  it('slows a bet carried by a strained group, and speeds one a trusting peer backs', () => {
    const f = funded();
    const bet = f.level.bets[0]!;
    const progress = (sim: SimState) => ok(endQuarter(f.level, sim)).sim.projects[bet.projectId]!.progress;
    const plain = progress(fx(f.sim, [{ type: 'value', target: { kind: 'team', id: bet.groupId }, field: 'stress', amount: -100 }, ...(bet.peerId ? [{ type: 'value' as const, target: { kind: 'person' as const, id: bet.peerId }, field: 'trust', amount: -100 }] : [])]));
    const strained = fx(f.sim, [{ type: 'value', target: { kind: 'team', id: bet.groupId }, field: 'stress', amount: 100 }, ...(bet.peerId ? [{ type: 'value' as const, target: { kind: 'person' as const, id: bet.peerId }, field: 'trust', amount: -100 }] : [])]);
    expect(progress(strained)).toBeLessThan(plain + 1);
    if (bet.peerId) {
      const backed = fx(f.sim, [{ type: 'value', target: { kind: 'team', id: bet.groupId }, field: 'stress', amount: -100 }, { type: 'value', target: { kind: 'person', id: bet.peerId }, field: 'trust', amount: 100 }]);
      expect(progress(backed)).toBe(plain + T.bets.peerSpeed);
    }
  });
});

describe('the quarterly review', () => {
  /** A begun quarter with one of the groups' projects overdue. */
  const troubled = () => {
    const { level, sim } = begun(8);
    const p = Object.values(sim.projects).find((x) => x.teamId === level.groupIds[1] && x.status === 'active')!;
    return { level, sim: fx(sim, [{ type: 'value', target: { kind: 'project', id: p.id }, field: 'deadlineWeek', amount: sim.week - p.deadlineWeek - 1 }]), project: p.id };
  };

  // @spec DIR-QBR-001
  it('offers to tell it straight, lead with the wins or promise more, and says what the quarter held', () => {
    const { level, sim } = troubled();
    const m = find(beginQuarter({ ...level, moments: [] }, sim), 'review');
    expect(m.choices.map((c) => c.id)).toEqual(['straight', 'wins', 'promise']);
    expect(m.text).toMatch(/in trouble/);
  });

  // @spec DIR-QBR-002
  it('builds the executive’s trust when told straight, at a cost in reputation for each thing in trouble', () => {
    const { level, sim } = troubled();
    const r = choose(level, sim, 'review', 'straight');
    expect(trust(r.sim, level.executiveId)).toBe(trust(sim, level.executiveId) + T.review.straightTrust);
    expect(r.sim.player.reputation).toBeLessThan(sim.player.reputation);
  });

  // @spec DIR-QBR-003
  it('earns reputation for leading with the wins, and costs more than the truth when what was left out is still in trouble', () => {
    const { level, sim, project } = troubled();
    const spun = choose(level, sim, 'review', 'wins');
    expect(spun.sim.player.reputation).toBe(Math.min(100, sim.player.reputation + T.review.winsReputation));
    expect(spun.level.leftOut.map((x) => x.id)).toContain(project);
    const first = ok(endQuarter(spun.level, spun.sim));
    expect(first.level.leftOut.map((x) => x.id)).toContain(project);
    const caught = ok(endQuarter(first.level, at(first.sim, first.sim.week + 13)));
    const honest = ok(endQuarter(ok(endQuarter(choose(level, sim, 'review', 'straight').level, sim)).level, at(sim, sim.week + 13)));
    expect(caught.level.leftOut).toEqual([]);
    expect(trust(caught.sim, level.executiveId)).toBeLessThan(trust(honest.sim, level.executiveId));
  });

  // @spec DIR-QBR-004
  it('raises every funded bet’s stakes when promising more', () => {
    const { level, sim } = begun();
    const m = find(level, 'bets');
    const f = ok(chooseDirector(level, sim, m.id, `fund:${JSON.stringify({ [m.offers![0]!.id]: level.groupIds[0] })}`));
    const promised = choose(f.level, f.sim, 'review', 'promise');
    expect(promised.level.bets[0]!.landing).toBe(Math.round(f.level.bets[0]!.landing * T.bets.promiseFactor));
    expect(promised.sim.player.reputation).toBe(Math.min(100, f.sim.player.reputation + T.review.promiseReputation));
  });
});

describe('peers', () => {
  const asked = (seed = 3) => {
    for (let s = seed; s < seed + 40; s++) {
      const { level, sim } = begun(s);
      const m = level.moments.find((x) => x.kind === 'peerAsk');
      if (m) return { level, sim, m };
    }
    throw new Error('no peer ask in 40 seeds');
  };

  // @spec DIR-PEER-001
  it('lets the player agree, negotiate or refuse a peer’s ask', () => {
    const { level, sim, m } = asked();
    const peer = m.personId!;
    expect(m.choices.map((c) => c.id)).toEqual(['agree', 'negotiate', 'refuse']);
    const agreed = ok(chooseDirector(level, sim, m.id, 'agree')).sim;
    expect(trust(agreed, peer)).toBe(Math.min(100, trust(sim, peer) + T.peer.agreeTrust));
    expect(agreed.teams[m.groupId!]!.aggregate!.stress).toBe(Math.min(100, sim.teams[m.groupId!]!.aggregate!.stress + T.peer.askStress));
    expect(trust(ok(chooseDirector(level, sim, m.id, 'refuse')).sim, peer)).toBe(Math.max(0, trust(sim, peer) - T.peer.refuseTrust));
    const warm = fx(sim, [{ type: 'value', target: { kind: 'person', id: peer }, field: 'trust', amount: 100 }]);
    const cold = fx(sim, [{ type: 'value', target: { kind: 'person', id: peer }, field: 'trust', amount: -100 }]);
    expect(trust(ok(chooseDirector(level, warm, m.id, 'negotiate')).sim, peer)).toBe(100);
    expect(trust(ok(chooseDirector(level, cold, m.id, 'negotiate')).sim, peer)).toBe(0);
  });

  // @spec DIR-PEER-002
  it('has a distrustful peer raise it with the executive, once a period', () => {
    const { level, sim } = director(3);
    const peer = level.peerIds[0]!;
    const cold = fx(sim, [{ type: 'value', target: { kind: 'person', id: peer }, field: 'trust', amount: -100 }]);
    const once = ok(endQuarter(level, cold));
    const plain = ok(endQuarter(level, sim));
    expect(trust(once.sim, level.executiveId)).toBe(trust(plain.sim, level.executiveId) - T.peer.escalateTrust);
    expect(once.sim.people[level.executiveId]!.history.length).toBeGreaterThan(sim.people[level.executiveId]!.history.length);
    // the same period again: no second escalation
    const twice = ok(endQuarter(once.level, once.sim));
    expect(trust(twice.sim, level.executiveId)).toBe(trust(once.sim, level.executiveId));
  });
});

describe('new senior managers', () => {
  // @spec DIR-PLAN-003
  it('lets a senior manager go at a final evaluation, then offers to promote from the group or hire, who arrives a quarter later', () => {
    const d = director(2);
    const g = d.level.groupIds[1]!;
    const held = leaderOf(d.sim, g)!;
    const level = beginQuarter({ ...d.level, heldEvaluations: [held] }, d.sim);
    const gone = choose(level, d.sim, 'finalEvaluation', 'letGo');
    expect(gone.sim.people[held]!.status).toBe('departed');
    expect(gone.level.heldEvaluations).toEqual([]);
    const next = ok(endQuarter(gone.level, gone.sim));
    const later = beginQuarter(next.level, at(next.sim, next.sim.week + 13));
    const m = find(later, 'newSenior');
    expect(m.groupId).toBe(g);
    const promoted = ok(chooseDirector(later, next.sim, m.id, 'promote'));
    expect(leaderOf(promoted.sim, g)).not.toBeNull();
    expect(promoted.sim.teams[g]!.aggregate!.skill).toBe(Math.max(0, next.sim.teams[g]!.aggregate!.skill - T.newSenior.promoteSkill));
    const hired = ok(chooseDirector(later, next.sim, m.id, 'hire'));
    expect(leaderOf(hired.sim, g)).toBeNull();
    expect(beginQuarter(hired.level, hired.sim).moments.some((x) => x.kind === 'newSenior')).toBe(false);
    expect(leaderOf(ok(endQuarter(hired.level, hired.sim)).sim, g)).not.toBeNull();
  });
});
