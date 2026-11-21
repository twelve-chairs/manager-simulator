import { describe, expect, it } from 'vitest';
import { LINE_TUNING, NAMES, afterAdvance, assess, beginWeek, scorecard, view, type Goal, type LineState } from '../../../src/levels/line-manager';
import { verdictOf } from '../../../src/review';
import { behindScheduleProjects, correspondingRating, overdueProjects, type SimState } from '../../../src/sim';
import { begin, choose, end, engineers, momentFor, nextWeek, patch, projects, quietRun, run, seeds, withItem } from './fixtures';

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
    const committed = end(next.level, depart(next.sim, [b]));
    expect(committed.level.vacancies).toHaveLength(2);
    expect(committed.level.vacancies.every((v) => v.interviews === 0)).toBe(true);
  });

  // @spec LINE-HIRE-004
  it('adds interviews through interview moments, at a cost to whoever interviews', () => {
    const q = quietRun(1);
    const [a] = engineers(q.sim) as [string];
    const level = begin({ ...q.level, vacancies: [{ id: 'v1', interviews: 0 }] }, q.sim);
    const m = momentFor(level, 'v1');
    expect(m.choices.map((c) => c.id)).toEqual(['self', ...engineers(q.sim).map((id) => `ask:${id}`), 'skip']);
    const self = choose(level, q.sim, m.id, 'self');
    expect(self.level.vacancies[0]!.interviews).toBe(1);
    expect(self.sim.player.stress).toBeGreaterThan(q.sim.player.stress);
    const asked = choose(level, q.sim, m.id, `ask:${a}`);
    expect(asked.level.vacancies[0]!.interviews).toBe(1);
    expect(asked.sim.people[a]!.stress).toBeGreaterThan(q.sim.people[a]!.stress);
    expect(asked.sim.player.stress).toBe(q.sim.player.stress);
    const skipped = choose(level, q.sim, m.id, 'skip');
    expect(skipped.level.vacancies[0]!.interviews).toBe(0);
  });

  // @spec LINE-HIRE-003, LINE-ORG-002, LINE-ORG-004
  it('hires a named engineer with a personality once a vacancy has its interviews', () => {
    const { level, sim } = run(1);
    const state = nextWeek(level, depart(sim, [engineers(sim)[0]!]));
    let l: LineState = { ...state.level, vacancies: [{ id: state.level.vacancies[0]!.id, interviews: LINE_TUNING.interviewsPerHire - 1 }], items: [], moments: [] };
    l = begin(l, state.sim);
    const done = choose(l, state.sim, momentFor(l, l.vacancies[0]!.id).id, 'self');
    expect(done.level.vacancies).toEqual([]);
    const hired = engineers(done.sim).filter((id) => !engineers(state.sim).includes(id));
    expect(hired).toHaveLength(1);
    const person = done.sim.people[hired[0]!]!;
    expect(NAMES.people).toContain(person.name);
    expect(person.personality).toBeTruthy();
    expect(Object.values(done.sim.people).filter((p) => p.name === person.name)).toHaveLength(1);
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
    const late = { ...after.level, completions: { [p]: atReview.projects[p]!.deadlineWeek + 1 } };
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
    // two engineers had a 1:1 in week 0
    const withOnes = {
      level,
      sim: patch(s0, (s) => ids.slice(0, 2).forEach((id) => s.people[id]!.history.push({ week: 0, cause: { kind: 'action', actionId: 'line-manager.habit.one-on-ones' }, note: '1:1' }))),
    };
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

  // @spec LINE-END-010
  it('counts the weeks the team ends overwhelmed, from zero again each review period', () => {
    const q = quietRun(1);
    const at = (week: number, stress: number) => patch(q.sim, (s) => { s.week = week; engineers(s).forEach((id) => (s.people[id]!.stress = stress)); });
    expect(end(q.level, at(3, 95)).level.overwhelmedWeeks).toBe(q.level.overwhelmedWeeks + 1);
    expect(end({ ...q.level, overwhelmedWeeks: 4 }, at(5, 95)).level.overwhelmedWeeks).toBe(5);
    expect(end({ ...q.level, overwhelmedWeeks: 4 }, at(5, 30)).level.overwhelmedWeeks).toBe(4);
    // the first week of a period starts the count again
    expect(end({ ...q.level, overwhelmedWeeks: 9 }, at(13, 95)).level.overwhelmedWeeks).toBe(1);
    expect(end({ ...q.level, overwhelmedWeeks: 9 }, at(13, 30)).level.overwhelmedWeeks).toBe(0);
  });

  // @spec LINE-END-011, LINE-END-009
  it('caps the rating at partial after a quarter mostly overwhelmed', () => {
    const { level, sim } = run(1);
    const calm = patch(sim, (s) => { s.week = 13; engineers(s).forEach((id) => (s.people[id]!.stress = 30)); });
    const overwhelmed = patch(calm, (s) => engineers(s).forEach((id) => (s.people[id]!.stress = 90)));
    expect(assess({ ...level, overwhelmedWeeks: 7 }, calm).ceiling).toEqual({ rating: 'partial', reason: 'Your team spent most of the quarter overwhelmed.' });
    expect(assess({ ...level, overwhelmedWeeks: 7 }, overwhelmed).ceiling?.rating).toBe('partial');
    expect(assess({ ...level, overwhelmedWeeks: 6 }, overwhelmed).ceiling?.rating).toBe('meets');
    expect(assess({ ...level, overwhelmedWeeks: 6 }, calm).ceiling).toBeUndefined();
  });

  // @spec LINE-END-008
  it('says the review at week 156, the twelfth, is the level’s last', () => {
    const { level, sim } = run(1);
    expect(assess(level, patch(sim, (s) => (s.week = 143))).lastReview).toBe(false);
    expect(assess(level, patch(sim, (s) => (s.week = 156))).lastReview).toBe(true);
  });

  // @spec LINE-END-009
  it('caps the rating at meets while the team is overwhelmed, and not before', () => {
    const { level, sim } = run(1);
    const stressed = (value: number) => patch(sim, (s) => { s.week = 13; engineers(s).forEach((id) => (s.people[id]!.stress = value)); });
    expect(assess(level, stressed(79)).ceiling).toBeUndefined();
    expect(assess(level, stressed(80)).ceiling).toEqual({ rating: 'meets', reason: "Your manager won't call it a strong quarter with the team this stretched." });
    expect(assess(level, stressed(95)).ceiling?.rating).toBe('meets');
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
    expect(a.measures.slice(0, 6)).toEqual([
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

describe('goals', () => {
  // @spec LINE-GOAL-001
  it('sets two or three goals when a review period begins, ship-by-deadline only within the period', () => {
    for (const seed of seeds(20)) {
      const { level, sim } = run(seed);
      for (const week of [0, 13]) {
        const s = patch(sim, (st) => (st.week = week));
        const goals = beginWeek({ ...level, goals: [], goalsPeriod: -1 }, s).goals;
        expect(goals.length).toBeGreaterThanOrEqual(2);
        expect(goals.length).toBeLessThanOrEqual(3);
        for (const g of goals.filter((x) => x.kind === 'shipOnTime')) {
          expect(s.projects[g.projectId!]!.deadlineWeek).toBeLessThan(week + 13);
          expect(g.startValue).toBe(s.projects[g.projectId!]!.deadlineWeek);
        }
      }
    }
    const { level, sim } = run(3);
    expect(beginWeek(level, sim).goals).toEqual(beginWeek(level, sim).goals);
  });

  // @spec LINE-GOAL-002
  it('shows each goal’s progress', () => {
    const { level, sim } = run(3);
    const begun = beginWeek(level, sim);
    const v = view(begun, sim);
    expect(v.goals.map((g) => g.id)).toEqual(begun.goals.map((g) => g.id));
    for (const g of v.goals) expect(typeof g.progress).toBe('string');
  });

  // @spec LINE-GOAL-002
  it('says no projects are running rather than counting none on schedule', () => {
    const q = quietRun(1);
    const idle = patch(q.sim, (s) => Object.values(s.projects).forEach((p) => (p.status = 'completed')));
    const level: LineState = { ...q.level, goals: [{ id: 'g-sched', kind: 'onSchedule', periodStart: 0 }] };
    expect(view(level, idle).goals[0]!.progress).toBe('No projects running');
  });

  // @spec LINE-GOAL-002
  it('shows a goal’s deadline counting weeks from 1', () => {
    const q = quietRun(1);
    const p = projects(q.sim)[0]!;
    const level: LineState = { ...q.level, goals: [{ id: 'g-ship', kind: 'shipOnTime', projectId: p, startValue: 20, periodStart: 0 }] };
    expect(view(level, q.sim).goals[0]!.progress).toMatch(/due week 21$/);
  });

  // @spec LINE-GOAL-003
  it('scores goals at the review, leaving out a goal about someone who left', () => {
    const { level, sim } = run(1);
    const [a, b] = engineers(sim) as [string, string];
    const goals: Goal[] = [
      { id: 'g-keep', kind: 'keepEveryone', periodStart: 0 },
      { id: 'g-grow', kind: 'growSomeone', personId: a, startValue: sim.people[a]!.skill, target: 10, periodStart: 0 },
      { id: 'g-grow-gone', kind: 'growSomeone', personId: b, startValue: sim.people[b]!.skill, target: 10, periodStart: 0 },
    ];
    const at13 = patch(sim, (s) => {
      s.week = 13;
      s.people[a]!.skill += 12;
      Object.assign(s.people[b]!, { status: 'departed', departure: { week: 5, reason: 'fired' } });
    });
    const measures = assess({ ...level, goals, goalsPeriod: 0 }, at13).measures;
    const byId = new Map(measures.map((m) => [m.id, m]));
    expect(verdictOf(byId.get('goal:g-keep')!)).toBe('above');
    expect(verdictOf(byId.get('goal:g-grow')!)).toBe('above');
    expect(byId.has('goal:g-grow-gone')).toBe(false);
    const quitting = patch(at13, (s) => Object.assign(s.people[engineers(sim)[2]!]!, { status: 'departed', departure: { week: 8, reason: 'quit' } }));
    expect(verdictOf(new Map(assess({ ...level, goals, goalsPeriod: 0 }, quitting).measures.map((m) => [m.id, m])).get('goal:g-keep')!)).toBe('below');
    const recap = end({ ...level, goals, goalsPeriod: 0, items: [], moments: [] }, at13).recap;
    expect(recap.goals.some((g) => g.id === 'g-grow-gone' && /left/.test(g.text))).toBe(true);
  });
});

describe('goals and moved deadlines', () => {
  // @spec LINE-GOAL-003
  it('judges a ship-by-deadline goal by the deadline it recorded, not a moved one', () => {
    const { level, sim } = run(1);
    const [p] = projects(sim) as [string];
    const goal: Goal = { id: 'g-ship', kind: 'shipOnTime', projectId: p, startValue: 10, periodStart: 0 };
    const at13 = patch(sim, (s) => {
      s.week = 13;
      Object.assign(s.projects[p]!, { status: 'completed', deadlineWeek: 14 });
    });
    const score = (completed: number) =>
      verdictOf(assess({ ...level, goals: [goal], goalsPeriod: 0, completions: { [p]: completed } }, at13).measures.find((m) => m.id === 'goal:g-ship')!);
    expect(score(9)).toBe('above');
    expect(score(12)).toBe('below');
  });
});

describe('recap', () => {
  // @spec LINE-RECAP-001
  it('reports habits, answered moments, expiries and goals', () => {
    const q = quietRun(1);
    const p = { kind: 'project' as const, id: projects(q.sim)[0]! };
    let level: LineState = { ...q.level, items: [
      { id: 'answered', kind: 'designReview' as const, subject: p, size: 5, difficulty: 50, arrivedWeek: 0, lastWeek: 3 },
      { id: 'left', kind: 'customerRequest' as const, subject: p, size: 4, difficulty: 50, arrivedWeek: 0, lastWeek: 0 },
    ] };
    level = begin(level, q.sim);
    const answered = choose(level, q.sim, momentFor(level, 'answered').id, 'self');
    const recap = end(answered.level, answered.sim).recap;
    expect(recap.habits.length).toBeGreaterThan(0);
    expect(recap.moments.map((m) => m.ref)).toContain('answered');
    expect(recap.expired.map((e) => e.itemId)).toContain('left');
    expect(recap.goals.length).toBe(answered.level.goals.length);
  });

  // @spec LINE-RECAP-002
  it('reports who changed band this week, with what was recorded for them', () => {
    const q = quietRun(1);
    const [a] = engineers(q.sim) as [string];
    // 1:1s every week lift trust and motivation; a growth focus adds a note
    let level = { ...q.level, habits: { ...q.level.habits, oneOnOnes: 'weekly', growth: a } } as LineState;
    const s = patch(q.sim, (st) => (st.people[a]!.motivation = 59));
    const recap = end(level, s).recap;
    const entry = recap.people.find((x) => x.personId === a);
    expect(entry).toBeDefined();
    expect(entry!.notes.length).toBeGreaterThan(0);
  });

  // @spec LINE-RECAP-002
  it('lists a note recorded more than once that week once, with how many times', () => {
    const q = quietRun(1);
    const p = projects(q.sim)[0]!;
    let level = q.level;
    for (const id of ['r1', 'r2']) level = withItem(level, { kind: 'designReview', subject: { kind: 'project', id: p }, difficulty: 10, lastWeek: q.sim.week + 3, id }).level;
    let begun = begin(level, q.sim);
    const give = (ref: string) => momentFor(begun, ref).choices.find((c) => c.id.startsWith('give:'))!.id;
    const who = give('r1').slice('give:'.length);
    let sim = q.sim;
    for (const ref of ['r1', 'r2']) {
      const m = momentFor(begun, ref);
      const choice = m.choices.find((c) => c.id === `give:${who}`) ?? m.choices.find((c) => c.id.startsWith('give:'))!;
      const chosen = choose(begun, sim, m.id, choice.id);
      begun = chosen.level;
      sim = chosen.sim;
    }
    const entry = end(begun, sim).recap.people.find((x) => x.personId === who)!;
    expect(entry.notes.filter((n) => n.startsWith('Took on a design review'))).toEqual(['Took on a design review, twice']);
  });

  // @spec LINE-RECAP-002
  it('reports someone a moment left a note on, though no band changed, but not someone with only a habit’s note', () => {
    const q = quietRun(1);
    const p = projects(q.sim)[0]!;
    const { level: withWork, id } = withItem(q.level, { kind: 'designReview', subject: { kind: 'project', id: p }, difficulty: 10, lastWeek: q.sim.week + 3 });
    const begun = begin(withWork, q.sim);
    const m = momentFor(begun, id);
    const give = m.choices.find((c) => c.id.startsWith('give:'))!;
    const who = give.id.slice('give:'.length);
    const chosen = choose(begun, q.sim, m.id, give.id);
    const ended = end(chosen.level, chosen.sim);
    // the fortnightly 1:1s left notes on others this week, with no band change
    const habitNoted = engineers(ended.sim).filter((x) => x !== who && ended.sim.people[x]!.history.some((h) => h.week === q.sim.week && h.note));
    expect(habitNoted.length).toBeGreaterThan(0);
    expect(ended.recap.people.map((x) => x.personId)).toEqual([who]);
    expect(ended.recap.people[0]).toMatchObject({ changes: [] });
    expect(ended.recap.people[0]!.notes.length).toBeGreaterThan(0);
  });
});

describe('evaluations at the end of a review period', () => {
  const lastWeekOfPeriod = () => {
    const q = quietRun(1);
    return { ...q, sim: patch(q.sim, (s) => (s.week = 12)) };
  };

  // @spec LINE-EVAL-001
  it('rates everyone not rated this period on what they delivered, ignoring the starting organization’s ratings', () => {
    const { level, sim } = lastWeekOfPeriod();
    const [already, ...rest] = engineers(sim) as [string, ...string[]];
    // one engineer had their evaluation this period; another joined mid-period
    const s0 = patch(sim, (s) => {
      s.people[already]!.history.push({ week: 10, cause: { kind: 'situation', situationId: 'quarterly-evaluation', choiceId: 'honest' }, rating: 'meets', note: 'Rated on what they delivered' });
      s.people[rest[0]!]!.joinedWeek = 5;
    });
    const ended = end(level, s0);
    const ratedNow = (id: string) => ended.sim.people[id]!.history.filter((h) => h.week === 12 && h.rating);
    expect(ratedNow(already)).toEqual([]);
    expect(ratedNow(rest[0]!)).toEqual([]);
    for (const id of rest.slice(1)) {
      const [entry] = ratedNow(id);
      expect(entry!.rating).toBe(correspondingRating(s0, id));
      expect(entry!.note).toMatch(/^Rated (below expectations|partially meets|meets|exceeds|outstanding) on what they delivered$/);
    }
    // not in any other week
    const midPeriod = end(level, patch(s0, (s) => (s.week = 11)));
    expect(engineers(midPeriod.sim).every((id) => !midPeriod.sim.people[id]!.history.some((h) => h.week === 11 && h.rating))).toBe(true);
  });

  // @spec LINE-EVAL-002
  it('names each engineer it rated, with the rating, in that week’s recap', () => {
    const { level, sim } = lastWeekOfPeriod();
    const ended = end(level, sim);
    expect(ended.recap.evaluations.map((e) => e.personId).sort()).toEqual([...engineers(sim)].sort());
    for (const e of ended.recap.evaluations) expect(e).toMatchObject({ name: sim.people[e.personId]!.name, rating: correspondingRating(sim, e.personId) });
    expect(end(quietRun(1).level, quietRun(1).sim).recap.evaluations).toEqual([]);
  });

  // @spec LINE-RECAP-002
  it('leaves the evaluations out of the recap’s people, since they have their own list', () => {
    const { level, sim } = lastWeekOfPeriod();
    const ended = end(level, sim);
    expect(ended.recap.evaluations.length).toBeGreaterThan(0);
    for (const p of ended.recap.people) expect(p.notes.some((n) => n.startsWith('Rated '))).toBe(false);
  });
});
