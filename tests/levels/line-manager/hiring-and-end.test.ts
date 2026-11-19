import { describe, expect, it } from 'vitest';
import { LINE_TUNING, NAMES, afterAdvance, assess, scorecard, type LineState } from '../../../src/levels/line-manager';
import { behindScheduleProjects, overdueProjects, type SimState } from '../../../src/sim';
import { commit, engineers, nextWeek, only, patch, projects, run } from './fixtures';

const depart = (sim: SimState, ids: string[], reason: 'quit' | 'fired' = 'quit', week = sim.week) =>
  patch(sim, (s) => ids.forEach((id) => Object.assign(s.people[id]!, { status: 'departed', departure: { week, reason } })));

describe('vacancies and hiring', () => {
  // @spec LINE-HIRE-001
  it('sets the target headcount to the starting team size', () => {
    expect(run(1).level.targetHeadcount).toBe(5);
  });

  // @spec LINE-HIRE-002
  it('opens a vacancy per missing engineer after an advance and when a week commits', () => {
    const { level, sim } = run(1);
    const [a, b] = engineers(sim) as [string, string];
    let next = nextWeek(level, depart(sim, [a]));
    expect(next.level.vacancies).toHaveLength(1);
    next = nextWeek(next.level, next.sim);
    expect(next.level.vacancies).toHaveLength(1);
    const committed = commit(only(next.level, next.sim), depart(next.sim, [b]));
    expect(committed.level.vacancies).toHaveLength(2);
    expect(committed.level.vacancies.every((v) => v.interviews === 0)).toBe(true);
  });

  // @spec LINE-HIRE-003, LINE-ACT-011, LINE-ORG-002
  it('hires a named engineer once a vacancy has its interviews', () => {
    const { level, sim } = run(1);
    let state = nextWeek(level, depart(sim, [engineers(sim)[0]!]));
    const vacancy = state.level.vacancies[0]!;
    const interview = { action: 'line-manager.interview' as const, target: { kind: 'vacancy' as const, id: vacancy.id }, cadence: 'once' as const };
    const short = commit(only(state.level, state.sim, ...Array.from({ length: LINE_TUNING.interviewsPerHire - 1 }, () => interview)), state.sim);
    expect(short.level.vacancies[0]!.interviews).toBe(LINE_TUNING.interviewsPerHire - 1);
    expect(engineers(short.sim)).toHaveLength(4);

    const done = commit(only(short.level, short.sim, interview), short.sim);
    expect(done.level.vacancies).toEqual([]);
    const hired = engineers(done.sim).filter((id) => !engineers(state.sim).includes(id));
    expect(hired).toHaveLength(1);
    const name = done.sim.people[hired[0]!]!.name;
    expect(NAMES.people).toContain(name);
    expect(Object.values(done.sim.people).filter((p) => p.name === name)).toHaveLength(1);
    state = nextWeek(done.level, done.sim);
    expect(state.level.vacancies).toEqual([]);
  });
});

describe('scorecard', () => {
  // @spec LINE-END-006, LINE-END-001
  it('records completion weeks and reports on-time completions and the on-schedule share', () => {
    const { level, sim } = run(1);
    const [p] = projects(sim) as [string];
    const nearlyDone = patch(sim, (s) => (s.projects[p]!.progress = s.projects[p]!.scope - 1));
    const after = nextWeek(level, nearlyDone);
    expect(after.sim.projects[p]!.status).toBe('completed');
    expect(after.level.completions[p]).toBe(0);

    const atReview = patch(after.sim, (s) => (s.week = 13));
    const card = scorecard(after.level, atReview);
    expect(card.delivery.completedOnTime).toBe(1);
    const late = { ...after.level, completions: { [p]: atReview.projects[p]!.deadlineWeek + 1 } } as LineState;
    expect(scorecard(late, patch(atReview, (s) => (s.week = s.projects[p]!.deadlineWeek + 5))).delivery.completedOnTime).toBe(0);
    expect(scorecard(after.level, patch(atReview, (s) => (s.week = 40))).delivery.completedOnTime).toBe(0);

    const active = projects(atReview);
    const troubled = new Set([...overdueProjects(atReview), ...behindScheduleProjects(atReview)].map((x) => x.id));
    expect(card.delivery.onScheduleShare).toBeCloseTo(active.filter((id) => !troubled.has(id)).length / active.length);
    const [q] = active as [string];
    const slipping = patch(atReview, (st) => (st.projects[q]!.progress = 0));
    expect(scorecard(after.level, slipping).delivery.onScheduleShare).toBe(0);
  });

  // @spec LINE-END-002
  it('reports quits in the last 13 weeks and how many were rated meets or above', () => {
    const { level, sim } = run(1);
    const [a, b, c, d] = engineers(sim) as [string, string, string, string];
    const rated = patch(sim, (s) => {
      s.people[a]!.performance = 'exceeds';
      s.people[b]!.performance = 'partial';
      s.people[c]!.performance = 'meets';
    });
    let s = depart(rated, [a, b], 'quit', 5);
    s = depart(s, [c], 'fired', 6);
    s = depart(s, [d], 'quit', 1);
    s = patch(s, (st) => (st.week = 15));
    expect(scorecard(level, s).retention).toEqual({ quits: 2, quitsRatedMeetsOrAbove: 1 });
  });

  // @spec LINE-END-003
  it('reports team averages and the share with a recent 1:1', () => {
    const { level, sim } = run(1);
    const ids = engineers(sim);
    const s0 = patch(sim, (s) => ids.forEach((id, i) => Object.assign(s.people[id]!, { motivation: 40 + i * 10, stress: 20 })));
    const withOnes = commit(only(level, s0, ...ids.slice(0, 2).map((id) => ({ action: 'line-manager.one-on-one' as const, target: { kind: 'person' as const, id }, cadence: 'once' as const }))), s0);
    const at = (week: number) => patch(withOnes.sim, (s) => (s.week = week));
    const card = scorecard(withOnes.level, at(3));
    const people = ids.map((id) => at(3).people[id]!);
    expect(card.teamHealth.motivation).toBeCloseTo(people.reduce((x, p) => x + p.motivation, 0) / people.length);
    expect(card.teamHealth.stress).toBeCloseTo(people.reduce((x, p) => x + p.stress, 0) / people.length);
    expect(card.teamHealth.oneOnOneShare).toBeCloseTo(2 / 5);
    // the four weeks before the scorecard's week: a 1:1 in week 0 counts at week 4, not at week 5
    expect(scorecard(withOnes.level, at(4)).teamHealth.oneOnOneShare).toBeCloseTo(2 / 5);
    expect(scorecard(withOnes.level, at(5)).teamHealth.oneOnOneShare).toBe(0);
  });

  // @spec LINE-END-004
  it('allows promotion from week 52', () => {
    const { level, sim } = run(1);
    expect(assess(level, patch(sim, (s) => (s.week = 51))).promotionPossible).toBe(false);
    expect(assess(level, patch(sim, (s) => (s.week = 52))).promotionPossible).toBe(true);
  });

  // @spec LINE-END-001
  it('has no on-schedule share when the team has no active projects', () => {
    const { level, sim } = run(1);
    const idle = patch(sim, (s) => Object.values(s.projects).forEach((p) => (p.status = 'completed')));
    expect(scorecard(level, idle).delivery.onScheduleShare).toBeNull();
  });

  // @spec LINE-END-007
  it('assesses six measures against tuned targets, leaving out the share without projects', () => {
    const { level, sim } = run(1);
    const at13 = patch(sim, (s) => (s.week = 13));
    const card = scorecard(level, at13);
    const a = assess(level, at13);
    const t = LINE_TUNING.review;
    expect(a.measures).toEqual([
      { id: 'completedOnTime', value: card.delivery.completedOnTime, ...t.completedOnTime, better: 'higher' },
      { id: 'onScheduleShare', value: card.delivery.onScheduleShare, ...t.onScheduleShare, better: 'higher' },
      { id: 'regrettedQuits', value: card.retention.quitsRatedMeetsOrAbove, ...t.regrettedQuits, better: 'lower' },
      { id: 'motivation', value: card.teamHealth.motivation, ...t.motivation, better: 'higher' },
      { id: 'stress', value: card.teamHealth.stress, ...t.stress, better: 'lower' },
      { id: 'oneOnOneShare', value: card.teamHealth.oneOnOneShare, ...t.oneOnOneShare, better: 'higher' },
    ]);
    const idle = patch(at13, (s) => Object.values(s.projects).forEach((p) => (p.status = 'completed')));
    expect(assess(level, idle).measures.map((m) => m.id)).not.toContain('onScheduleShare');
  });
});

describe('burnout', () => {
  // @spec LINE-END-005
  it('reports burnout after four consecutive weeks at or above the threshold', () => {
    const { level, sim } = run(1);
    const stressed = (week: number, stress: number = LINE_TUNING.burnoutThreshold) => patch(sim, (s) => Object.assign(s, { week, player: { ...s.player, stress } }));
    let l = level;
    const results: boolean[] = [];
    for (let week = 1; week <= 4; week++) {
      const r = afterAdvance(l, stressed(week));
      l = r.level;
      results.push(r.burnedOut);
    }
    expect(results).toEqual([false, false, false, true]);

    let reset = level;
    for (const [week, stress] of [[1, 100], [2, 100], [3, LINE_TUNING.burnoutThreshold - 1], [4, 100], [5, 100]] as const) {
      const r = afterAdvance(reset, stressed(week, stress));
      reset = r.level;
      expect(r.burnedOut).toBe(false);
    }
  });
});
