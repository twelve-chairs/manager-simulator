import { describe, expect, it } from 'vitest';
import { band } from '../../../src/levels/line-manager';
import {
  DIRECTOR_TUNING as T,
  assessDirector,
  beginQuarter,
  chooseDirector,
  directorLevel,
  directorScorecard,
  directorView,
  goalStatus,
  leaderOf,
  quitLastQuarter,
  reviewDue,
  type DirectorRecap,
} from '../../../src/levels/director';
import { advance, applyEffects, type SimState } from '../../../src/sim';
import { director, promotedSenior } from './fixtures';

const RULE = { kind: 'rule', ruleId: 'test' } as const;
const ok = <X>(r: ({ ok: true } & X) | { ok: false; error: string }) => {
  if (!r.ok) throw new Error(r.error);
  return r;
};

/** Plays quarters through the level's contract: each moment's first choice, then the quarter's end and the advance. */
function play(seed: number, quarters: number, pick: (kind: string, choices: string[]) => string | null = (_, c) => c[0] ?? null) {
  let { level, sim } = director(seed);
  const recaps: DirectorRecap[] = [];
  for (let q = 0; q < quarters; q++) {
    level = directorLevel.beginWeek(level, sim);
    for (const ref of directorLevel.moments(level, sim)) {
      if (!ref.open) continue;
      const m = level.moments.find((x) => x.id === ref.id)!;
      const choice = pick(m.kind, m.choices.map((c) => c.id));
      if (!choice) continue;
      const r = ok(directorLevel.choose(level, sim, m.id, choice));
      level = r.level;
      sim = r.sim;
    }
    const end = ok(directorLevel.endWeek(level, sim));
    level = end.level;
    recaps.push(end.recap as DirectorRecap);
    const advanced = advance(end.sim, directorLevel.params.weeksPerStep);
    sim = advanced.state;
    const after = directorLevel.afterAdvance(level, sim, advanced.log);
    level = after.level;
    if (after.burnedOut) break;
    if (reviewDue(level, sim)) expect(directorLevel.assess(level, sim).measures.length).toBeGreaterThan(0);
  }
  return { level, sim, recaps };
}

describe('goals', () => {
  // @spec DIR-GOAL-001
  it('sets two or three goals at the start of each review period from the organization’s state', () => {
    const { level } = director(3);
    expect(level.goals.length).toBeGreaterThanOrEqual(2);
    expect(level.goals.length).toBeLessThanOrEqual(3);
    for (const g of level.goals) expect(['landBet', 'zeroRegretted', 'unstrainGroup', 'peerTrust']).toContain(g.kind);
    // the second period begins with the third quarter
    const later = play(3, 3).level;
    expect(later.goals[0]!.id).not.toBe(level.goals[0]!.id);
  });

  // @spec DIR-GOAL-002, DIR-GOAL-003
  it('shows each goal with its progress, and adds each as an achieved-or-missed measure at the review', () => {
    const { level, sim } = director(3);
    const v = directorView(level, sim);
    expect(v.goals.map((g) => g.id)).toEqual(level.goals.map((g) => g.id));
    for (const g of v.goals) expect(g.progress).toBeTruthy();
    const goals = assessDirector(level, { ...sim, week: sim.week + 26 }).measures.filter((m) => m.id.startsWith('goal:'));
    expect(goals).toHaveLength(level.goals.length);
    for (const m of goals) expect([0, 1]).toContain(m.value);
  });

  // @spec DIR-GOAL-001
  it('keeps a peer’s trust goal by their trust band', () => {
    const { level, sim } = director(3);
    const goal = { id: 'x', kind: 'peerTrust' as const, week: sim.week, personId: level.peerIds[0]! };
    const warm = applyEffects(sim, [{ type: 'value', target: { kind: 'person', id: level.peerIds[0]! }, field: 'trust', amount: 100, cause: RULE }]);
    if (!warm.ok) throw new Error(warm.error.message);
    expect(goalStatus(goal, level, warm.state).achieved).toBe(true);
    expect(goalStatus(goal, level, { ...sim, people: { ...sim.people, [level.peerIds[0]!]: { ...sim.people[level.peerIds[0]!]!, trust: 10 } } }).achieved).toBe(false);
  });
});

describe('the recap', () => {
  // @spec DIR-RECAP-001
  it('tells what changed and the routine at each quarter’s end', () => {
    const { recaps } = play(4, 4);
    expect(recaps).toHaveLength(4);
    for (const r of recaps) {
      expect(r.routine.habits.length).toBeGreaterThan(0);
      expect(Array.isArray(r.changes.seniorManagers)).toBe(true);
      expect(Array.isArray(r.changes.bets)).toBe(true);
      expect(Array.isArray(r.changes.upward)).toBe(true);
    }
    // the survey reports in the quarter it is taken: the second, before the first review
    expect(recaps[1]!.changes.survey).not.toBeNull();
    expect(recaps[0]!.changes.survey).toBeNull();
  });
});

describe('senior managers who quit', () => {
  // @spec DIR-RECAP-003
  it('reports each senior manager who quit in the quarter just played, with what led to it and the last thing between you', () => {
    const { level, sim } = director(3);
    const lead = leaderOf(sim, level.groupIds[0]!)!;
    const end = sim.week + T.weeksPerQuarter;
    const after = { ...structuredClone(sim), week: end };
    Object.assign(after.people[lead]!, { status: 'departed', departure: { week: sim.week, reason: 'quit' }, lowMotivationWeeks: 6, highStressWeeks: 0, trust: 70 });
    after.people[lead]!.history.push({ week: sim.week - 2, cause: { kind: 'rule', ruleId: 'x' }, note: 'Missed engineering' });
    expect(quitLastQuarter(level, after)).toEqual([{ personId: lead, name: sim.people[lead]!.name, lowMotivationWeeks: 6, highStressWeeks: 0, lowTrust: false, lastMemory: 'Missed engineering' }]);
    expect(quitLastQuarter(level, { ...after, week: end + T.weeksPerQuarter })).toEqual([]);
  });
});

describe('the scorecard', () => {
  // @spec DIR-END-003
  it('reports strategic outcomes, retention and health and the executive’s confidence, each against a target', () => {
    const { level, sim } = play(5, 2);
    const card = directorScorecard(level, sim);
    expect(card).toMatchObject({ strategic: { projectsOnTime: expect.any(Number) }, retention: { regretted: expect.any(Number) }, health: { motivation: expect.any(Number), stress: expect.any(Number) }, confidence: sim.people[level.executiveId]!.trust });
    const ids = assessDirector(level, sim).measures.map((m) => m.id);
    for (const id of ['projectsOnTime', 'regrettedAttrition', 'motivation', 'stress', 'executiveConfidence']) expect(ids).toContain(id);
    // the senior managers' calibration is theirs, and not scored
    expect(ids).not.toContain('calibrationQuality');
    for (const m of assessDirector(level, sim).measures) expect(m.tolerance).toBeGreaterThanOrEqual(0);
  });

  // @spec DIR-END-003
  it('counts bets landed against the bets whose results came in, and nothing for bets still running', () => {
    const fund = (kind: string, choices: string[]) => (kind === 'bets' ? null : choices[0] ?? null);
    const none = play(5, 2, fund);
    expect(directorScorecard(none.level, none.sim).strategic.betsLanded).toBeNull();
    // funded this period, but no result yet: no score, not a miss
    const { level, sim } = play(5, 2);
    const w = sim.week - 1;
    const running = { ...level, funded: [{ week: w, projectId: 'pa' }, { week: w, projectId: 'pb' }], betResults: [] };
    expect(directorScorecard(running, sim).strategic.betsLanded).toBeNull();
    expect(assessDirector(running, sim).measures.map((m) => m.id)).not.toContain('betsLanded');
    // one landed and one failed of those whose results came in; a third still running counts for nothing
    const resolved = { ...running, funded: [...running.funded, { week: w, projectId: 'pc' }], betResults: [{ week: w, projectId: 'pa', landed: true }, { week: w, projectId: 'pb', landed: false }] };
    expect(directorScorecard(resolved, sim).strategic.betsLanded).toBe(0.5);
  });

  // @spec DIR-END-003
  it('agrees with the regretted-attrition goal on how many lost is too many', () => {
    const target = T.review_targets.regrettedAttrition;
    // the measure is below target exactly when the goal is missed: more than the goal's limit
    expect(target.target + target.tolerance).toBe(T.goalRegrettedMost);
  });
});

describe('the whole view', () => {
  // @spec DIR-VIS-005
  it('gives the habits, the quarter’s moments, the player’s energy and reputation, the goals and the career summary', () => {
    const { level, sim } = director(2);
    const begun = beginQuarter(level, sim);
    const v = directorView(begun, sim);
    expect(v.moments.map((m) => m.id)).toEqual(begun.moments.map((m) => m.id));
    expect(v.moments.find((m) => m.kind === 'headcount')!.heads).toBeGreaterThanOrEqual(0);
    expect(v.moments.find((m) => m.kind === 'bets')!.offers!.length).toBeGreaterThanOrEqual(2);
    expect(v.player).toEqual({ energy: band(100 - sim.player.stress), reputation: band(sim.player.reputation), edge: { at: false, quarters: 0, limit: T.burnoutQuarters } });
    expect(v.career).toEqual({ quarters: 0, joined: [], letGo: [] });
    expect(v.goals).toHaveLength(level.goals.length);
  });

  // @spec DIR-VIS-005
  it('names in the career summary the senior managers who joined and who were let go', () => {
    const d = director(2);
    const g = d.level.groupIds[1]!;
    const held = leaderOf(d.sim, g)!;
    const level = beginQuarter({ ...d.level, heldEvaluations: [held] }, d.sim);
    const gone = ok(chooseDirector(level, d.sim, level.moments.find((m) => m.kind === 'finalEvaluation')!.id, 'letGo'));
    expect(directorView(gone.level, gone.sim).career.letGo).toEqual([d.sim.people[held]!.name]);
  });
});

describe('the turn loop contract', () => {
  // @spec DIR-CONTRACT-001
  it('steps thirteen weeks, counts moments’ days from the quarter’s first Monday, and takes over a senior manager run', () => {
    expect(directorLevel.params).toMatchObject({ id: 'director', weeksPerStep: 13 });
    expect(() => directorLevel.start(1)).toThrow();
    const s = promotedSenior(2);
    expect(directorLevel.handoverChoices!(s.level, s.sim).at(-1)!.id).toBe('hire');
    const taken = directorLevel.takeOver!(s.level, s.sim, 'hire');
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    const level = directorLevel.beginWeek(taken.level, taken.sim);
    const refs = directorLevel.moments(level, taken.sim);
    for (const [i, r] of refs.entries()) {
      const m = level.moments[i]!;
      expect(r).toMatchObject({ id: m.id, day: m.week * 5 + m.day, time: m.time, title: m.title, open: true });
    }
    expect(directorLevel.plan(level, taken.sim, { kind: 'habit', habit: 'time', value: 'upward' }).ok).toBe(true);
    expect(directorLevel.plan(level, taken.sim, { kind: 'nope' }).ok).toBe(false);
  });

  // @spec DIR-CONTRACT-001, DIR-STATE-001
  it('plays twelve quarters on several seeds without error, the same every time, its state plain data', () => {
    for (const seed of [1, 2, 3, 7]) {
      const a = play(seed, 12);
      expect(JSON.parse(JSON.stringify(a.level))).toEqual(a.level);
      if (seed === 1) expect(play(seed, 12)).toEqual(a);
    }
  });

  // @spec DIR-STATE-001
  it('closes a moment that can no longer be answered', () => {
    const d = director(2);
    const level = beginQuarter(d.level, d.sim);
    const trouble = (s: SimState) => directorLevel.moments(level, s);
    const lead = leaderOf(d.sim, d.level.groupIds[1]!)!;
    const gone = applyEffects(d.sim, [{ type: 'remove', personId: lead, reason: 'quit', cause: RULE }]);
    if (!gone.ok) throw new Error(gone.error.message);
    const withThem = level.moments.filter((m) => m.personId === lead).map((m) => m.id);
    for (const ref of trouble(gone.state)) if (withThem.includes(ref.id)) expect(ref.open).toBe(false);
  });
});
