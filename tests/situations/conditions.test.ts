import { describe, expect, it } from 'vitest';
import { evaluateCondition, resolveChoice, selectSituations, type Condition } from '../../src/situations';
import { applyEffects, contribution, correspondingRating, teamSummary, type Cause, type SimState } from '../../src/sim';
import { engine, fresh, holds, patch, plain, rated, select } from './fixtures';

const c = (x: unknown) => x as Condition;
const TRUE = c({ value: 'player.reputation', atLeast: 50 });
const FALSE = c({ value: 'player.reputation', above: 50 });

/** Asserts each condition holds or not against the state and bindings. */
function check(sim: SimState, bindings: Record<string, string>, cases: [unknown, boolean][]) {
  for (const [condition, expected] of cases) {
    expect({ condition, holds: holds(sim, c(condition), bindings) }).toEqual({ condition, holds: expected });
  }
}

describe('logical forms', () => {
  // @spec SIT-COND-001
  it('combines conditions with all, any and not', () => {
    check(fresh(), {}, [
      [{ all: [] }, true],
      [{ any: [] }, false],
      [{ all: [TRUE, TRUE] }, true],
      [{ all: [TRUE, FALSE] }, false],
      [{ any: [FALSE, TRUE] }, true],
      [{ any: [FALSE, FALSE] }, false],
      [{ not: TRUE }, false],
      [{ not: FALSE }, true],
      [{ not: { all: [] } }, false],
    ]);
  });
});

describe('comparisons', () => {
  // @spec SIT-COND-002
  it('compares numbers, strings, the player and the week with every operator', () => {
    const e1 = { engineer: 'e1' };
    check(fresh(), e1, [
      [{ value: 'engineer.motivation', below: 51 }, true],
      [{ value: 'engineer.motivation', below: 50 }, false],
      [{ value: 'engineer.motivation', atMost: 50 }, true],
      [{ value: 'engineer.motivation', atMost: 49 }, false],
      [{ value: 'engineer.motivation', above: 49 }, true],
      [{ value: 'engineer.motivation', above: 50 }, false],
      [{ value: 'engineer.motivation', atLeast: 50 }, true],
      [{ value: 'engineer.motivation', atLeast: 51 }, false],
      [{ value: 'engineer.motivation', is: 50 }, true],
      [{ value: 'engineer.motivation', isNot: 50 }, false],
      [{ value: 'engineer.want', is: 'growth' }, true],
      [{ value: 'engineer.want', isNot: 'growth' }, false],
      [{ value: 'engineer.want', in: ['autonomy', 'growth'] }, true],
      [{ value: 'engineer.want', in: ['autonomy', 'stability'] }, false],
      [{ value: 'player.stress', is: 30 }, true],
      [{ value: 'week', is: 0 }, true],
    ]);
    check(patch(fresh(), (s) => (s.week = 7)), {}, [
      [{ value: 'week', atLeast: 7 }, true],
      [{ value: 'week', above: 7 }, false],
    ]);
  });

  // @spec SIT-COND-003
  it('compares against another path', () => {
    const sim = patch(fresh(), (s) => (s.people.e1!.motivation = 40));
    check(sim, { a: 'e1', b: 'e2' }, [
      [{ value: 'a.motivation', below: { value: 'b.motivation' } }, true],
      [{ value: 'b.motivation', below: { value: 'a.motivation' } }, false],
      [{ value: 'a.team', is: { value: 'b.team' } }, true],
      [{ value: 'a.team', is: { value: 'player.team' } }, true],
    ]);
    check(sim, { a: 'e1', b: 'e4', lead: 'm1' }, [
      [{ value: 'a.team', is: { value: 'b.team' } }, false],
      [{ value: 'a.team', isNot: { value: 'b.team' } }, true],
      [{ value: 'lead.ledTeam', is: { value: 'b.team' } }, true],
    ]);
  });

  // @spec SIT-COND-004
  it('orders ratings on their scale, with unrated below every rating', () => {
    // rated(): e1 exceeds, e2 meets, e3 outstanding, e4 below, e5 partial
    const sim = rated();
    const perf = (id: string, op: string, operand: string, expected: boolean): [unknown, boolean] => [
      { value: `${id}.performance`, [op]: operand },
      expected,
    ];
    check(sim, { e1: 'e1', e2: 'e2', e3: 'e3', e4: 'e4', e5: 'e5' }, [
      perf('e1', 'above', 'meets', true),
      perf('e2', 'above', 'meets', false),
      perf('e2', 'atLeast', 'meets', true),
      perf('e3', 'above', 'exceeds', true),
      perf('e4', 'below', 'partial', true),
      perf('e5', 'below', 'meets', true),
      perf('e5', 'atMost', 'below', false),
      [{ value: 'e1.performance', below: { value: 'e3.performance' } }, true],
    ]);
    check(fresh(), { e1: 'e1' }, [
      perf('e1', 'below', 'below', true),
      perf('e1', 'is', 'unrated', true),
      perf('e1', 'above', 'below', false),
    ]);
  });

  // @spec SIT-COND-005
  it('fails every comparison with a missing value except isNot', () => {
    // e1 leads no team, so engineer.ledTeam has no value
    check(fresh(), { engineer: 'e1', other: 'e2' }, [
      [{ value: 'engineer.ledTeam', is: 't1' }, false],
      [{ value: 'engineer.ledTeam', in: ['t1', 't2'] }, false],
      [{ value: 'engineer.ledTeam', isNot: 't1' }, true],
      [{ value: 'engineer.team', is: { value: 'other.ledTeam' } }, false],
      [{ value: 'engineer.team', isNot: { value: 'other.ledTeam' } }, true],
      [{ value: 'engineer.ledTeam', is: { value: 'other.ledTeam' } }, false],
    ]);
  });
});

describe('properties', () => {
  // @spec SIT-COND-006
  it('provides person properties', () => {
    const base = rated();
    const sim = patch(base, (s) => {
      s.week = 10;
      Object.assign(s.people.e1!, { skill: 70, stress: 45, joinedWeek: 2, wantServedWeek: 4, lowMotivationWeeks: 3, highStressWeeks: 1 });
    });
    check(sim, { engineer: 'e1', lead: 'm1', low: 'e4' }, [
      [{ value: 'engineer.skill', is: 70 }, true],
      [{ value: 'engineer.motivation', is: 50 }, true],
      [{ value: 'engineer.stress', is: 45 }, true],
      [{ value: 'engineer.trust', is: 60 }, true],
      [{ value: 'engineer.want', is: 'growth' }, true],
      [{ value: 'engineer.role', is: 'engineer' }, true],
      [{ value: 'lead.role', is: 'manager' }, true],
      [{ value: 'engineer.performance', is: 'exceeds' }, true],
      [{ value: 'engineer.plan', is: 'none' }, true],
      [{ value: 'low.plan', is: 'coaching' }, true],
      [{ value: 'engineer.contribution', is: contribution(sim, 'e1') }, true],
      [{ value: 'engineer.correspondingRating', is: correspondingRating(sim, 'e1') }, true],
      [{ value: 'engineer.team', is: 't1' }, true],
      [{ value: 'lead.ledTeam', is: 't2' }, true],
      [{ value: 'engineer.tenureWeeks', is: 8 }, true],
      [{ value: 'engineer.weeksSinceWantServed', is: 6 }, true],
      [{ value: 'engineer.lowMotivationWeeks', is: 3 }, true],
      [{ value: 'engineer.highStressWeeks', is: 1 }, true],
    ]);
  });

  // @spec SIT-COND-006
  it('provides team properties from the team summary', () => {
    const sim = rated();
    const summary = teamSummary(sim, 't2');
    check(sim, { team: 't2' }, [
      [{ value: 'team.form', is: 'detailed' }, true],
      [{ value: 'team.headcount', is: summary.headcount }, true],
      [{ value: 'team.skill', is: summary.skill }, true],
      [{ value: 'team.motivation', is: summary.motivation }, true],
      [{ value: 'team.stress', is: summary.stress }, true],
      [{ value: 'team.attritionRisk', is: summary.attritionRisk }, true],
      [{ value: 'team.ratings.below', is: summary.ratings.below }, true],
      [{ value: 'team.ratings.below', is: 1 }, true],
      [{ value: 'team.leaderless', is: false }, true],
      [{ value: 'team.troubled', is: false }, true],
    ]);
    check(
      patch(sim, (s) => (s.teams.t2!.leader = null)),
      { team: 't2' },
      [
        [{ value: 'team.leaderless', is: true }, true],
        [{ value: 'team.troubled', is: true }, true],
      ],
    );
  });

  // @spec SIT-COND-006
  it('provides project properties', () => {
    // p1: scope 100, deadline week 26, started week 0
    const at = (week: number, progress: number) =>
      patch(fresh(), (s) => {
        s.week = week;
        Object.assign(s.projects.p1!, { progress, risk: 20, techDebt: 15 });
      });
    check(at(10, 50), { project: 'p1' }, [
      [{ value: 'project.team', is: 't1' }, true],
      [{ value: 'project.progressShare', is: 50 }, true],
      [{ value: 'project.risk', is: 20 }, true],
      [{ value: 'project.techDebt', is: 15 }, true],
      [{ value: 'project.overdue', is: false }, true],
      [{ value: 'project.behind', is: false }, true],
      [{ value: 'project.weeksToDeadline', is: 16 }, true],
      [{ value: 'project.status', is: 'active' }, true],
    ]);
    check(at(13, 25), { project: 'p1' }, [[{ value: 'project.behind', is: true }, true]]);
    check(at(30, 25), { project: 'p1' }, [[{ value: 'project.overdue', is: true }, true]]);
  });

  // @spec SIT-COND-012
  it('gives entities an id and a person-led team its leader', () => {
    check(fresh(), { engineer: 'e1', lead: 'm1', mine: 't1', other: 't2', project: 'p1' }, [
      [{ value: 'engineer.id', is: 'e1' }, true],
      [{ value: 'other.id', is: { value: 'lead.ledTeam' } }, true],
      [{ value: 'project.id', is: 'p1' }, true],
      [{ value: 'other.leader', is: { value: 'lead.id' } }, true],
      [{ value: 'other.leader', is: { value: 'engineer.id' } }, false],
      // the player leads t1, so it has no leader value
      [{ value: 'mine.leader', is: { value: 'lead.id' } }, false],
      [{ value: 'mine.leader', isNot: { value: 'lead.id' } }, true],
    ]);
    check(
      patch(fresh(), (s) => (s.teams.t2!.leader = null)),
      { other: 't2', lead: 'm1' },
      [[{ value: 'other.leader', is: { value: 'lead.id' } }, false]],
    );
  });

  // @spec SIT-COND-006
  it('provides player properties', () => {
    check(fresh(), {}, [
      [{ value: 'player.reputation', is: 50 }, true],
      [{ value: 'player.stress', is: 30 }, true],
      [{ value: 'player.performance', is: 'unrated' }, true],
      [{ value: 'player.plan', is: 'none' }, true],
      [{ value: 'player.team', is: 't1' }, true],
    ]);
  });
});

describe('count', () => {
  // @spec SIT-COND-007
  it('counts active people, teams and active projects matching where', () => {
    const sim = fresh();
    const inT1 = { kind: 'person', where: { value: 'it.team', is: 't1' } };
    check(sim, {}, [
      [{ count: inT1, is: 3 }, true],
      [{ count: { kind: 'team', where: { value: 'it.leaderless', is: false } }, is: 2 }, true],
      [{ count: { kind: 'project', where: { value: 'it.team', is: 't1' } }, is: 1 }, true],
    ]);
    const changed = patch(sim, (s) => {
      s.people.e2!.status = 'departed';
      s.projects.p1!.status = 'completed';
    });
    check(changed, {}, [
      [{ count: inT1, is: 2 }, true],
      [{ count: { kind: 'project', where: { value: 'it.team', is: 't1' } }, is: 0 }, true],
    ]);
  });

  // @spec SIT-COND-007
  it('keeps the situation roles visible inside where', () => {
    const sameTeam = { kind: 'person', where: { value: 'it.team', is: { value: 'engineer.team' } } };
    check(fresh(), { engineer: 'e1' }, [[{ count: sameTeam, is: 3 }, true]]);
    check(fresh(), { engineer: 'e4' }, [[{ count: sameTeam, is: 3 }, true]]);
  });

  // @spec SIT-COND-011
  it('binds it to the inner candidate in a nested count', () => {
    // want is a person property: it only holds if `it` is the inner person, not the outer team
    const teamsWithGrowth = { kind: 'team', where: { count: { kind: 'person', where: { value: 'it.want', is: 'growth' } }, atLeast: 1 } };
    const teamsWhileEngineerTeamFull = {
      kind: 'team',
      where: { count: { kind: 'person', where: { value: 'it.team', is: { value: 'engineer.team' } } }, is: 3 },
    };
    check(fresh(), { engineer: 'e1' }, [
      [{ count: teamsWithGrowth, is: 2 }, true],
      [{ count: teamsWhileEngineerTeamFull, is: 2 }, true],
    ]);
  });
});

describe('history and presented', () => {
  const cause = (situationId: string, choiceId: string): Cause => ({ kind: 'situation', situationId, choiceId });
  const note = (sim: SimState, situationId: string, choiceId: string) => {
    const result = applyEffects(sim, [
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'stress', amount: 1, cause: cause(situationId, choiceId), historyNote: 'x' },
    ]);
    if (!result.ok) throw new Error(result.error.message);
    return result.state;
  };

  // @spec SIT-COND-008
  it('counts history entries by situation, choice, rating and window', () => {
    // rated(): e1 starts with an exceeds rating at week 0
    let sim = note(note(note(rated(), 'sit-a', 'x'), 'sit-a', 'y'), 'sit-b', 'x');
    sim = note(
      patch(sim, (s) => (s.week = 10)),
      'sit-a',
      'x',
    );
    check(sim, { engineer: 'e1' }, [
      [{ history: 'engineer', is: 5 }, true],
      [{ history: 'engineer', situation: 'sit-a', is: 3 }, true],
      [{ history: 'engineer', situation: 'sit-a', choice: 'x', is: 2 }, true],
      [{ history: 'engineer', situation: 'sit-b', is: 1 }, true],
      [{ history: 'engineer', rating: ['exceeds', 'outstanding'], is: 1 }, true],
      [{ history: 'engineer', rating: ['below'], is: 0 }, true],
      [{ history: 'engineer', situation: 'sit-a', withinWeeks: 5, is: 1 }, true],
      [{ history: 'engineer', withinWeeks: 5, is: 1 }, true],
      [{ history: 'engineer', situation: 'sit-a', atLeast: 4 }, false],
    ]);
  });

  // @spec SIT-COND-013
  it('counts history entries caused by a player action', () => {
    const action = (actionId: string): Cause => ({ kind: 'action', actionId });
    const result = applyEffects(fresh(), [
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'trust', amount: 1, cause: action('line-manager.one-on-one'), historyNote: '1:1' },
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'trust', amount: 1, cause: action('line-manager.one-on-one'), historyNote: '1:1' },
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'skill', amount: 1, cause: action('line-manager.coaching'), historyNote: 'Coaching' },
    ]);
    if (!result.ok) throw new Error(result.error.message);
    check(result.state, { engineer: 'e1' }, [
      [{ history: 'engineer', action: 'line-manager.one-on-one', is: 2 }, true],
      [{ history: 'engineer', action: 'line-manager.coaching', is: 1 }, true],
    ]);
  });

  // @spec SIT-COND-017
  it('counts only history entries with the note given', () => {
    const page: Cause = { kind: 'action', actionId: 'line-manager.on-call' };
    const result = applyEffects(fresh(), [
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'stress', amount: 1, cause: page, historyNote: 'Handled a night page alone' },
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'stress', amount: 1, cause: page, historyNote: 'Handled a night page alone' },
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'stress', amount: 1, cause: page, historyNote: 'Handled a night page with you' },
    ]);
    if (!result.ok) throw new Error(result.error.message);
    check(result.state, { engineer: 'e1' }, [
      [{ history: 'engineer', action: 'line-manager.on-call', note: 'Handled a night page alone', is: 2 }, true],
      [{ history: 'engineer', note: 'Handled a night page with you', is: 1 }, true],
      [{ history: 'engineer', note: 'Handled a night page', is: 0 }, true],
    ]);
  });

  // @spec SIT-COND-009
  it('counts presentations of a situation, ever or within a window', () => {
    const sim = fresh();
    const { engine: eng } = select(engine(), sim, [plain('s1')]);
    expect(holds(sim, c({ presented: 's1', is: 1 }), {}, eng)).toBe(true);
    expect(holds(sim, c({ presented: 's2', is: 0 }), {}, eng)).toBe(true);
    const later = patch(sim, (s) => (s.week = 20));
    expect(holds(later, c({ presented: 's1', withinWeeks: 10, is: 0 }), {}, eng)).toBe(true);
    expect(holds(later, c({ presented: 's1', is: 1 }), {}, eng)).toBe(true);
  });

  // @spec SIT-COND-009
  it('includes the current presentation inside its own choices', () => {
    const s = plain('s1');
    s.choices[0]!.availableIf = c({ presented: 's1', is: 1 });
    expect(select(engine(), fresh(), [s]).presented).toHaveLength(1);
  });
});

describe('review timing', () => {
  // @spec SIT-COND-014
  it('gives review.weeksAway from the context, and no value without it', () => {
    const sim = fresh();
    const soon = c({ value: 'review.weeksAway', atMost: 2 });
    expect(evaluateCondition(soon, { sim, engine: engine(), bindings: {}, weeksToReview: 2 })).toBe(true);
    expect(evaluateCondition(soon, { sim, engine: engine(), bindings: {}, weeksToReview: 5 })).toBe(false);
    expect(holds(sim, soon)).toBe(false);
    expect(holds(sim, c({ value: 'review.weeksAway', isNot: 2 }))).toBe(true);

    const timed = plain('evaluation', { when: soon });
    expect(select(engine(), sim, [timed]).presented).toEqual([]);
    expect(selectSituations(engine(), sim, [timed], 'line-manager', 3, { weeksToReview: 1 }).presented).toHaveLength(1);

    const outcome = plain('x').choices[0]!.outcomes[0]!;
    const guarded = plain('guarded', {
      choices: [{ id: 'ok', label: 'OK', outcomes: [{ ...outcome, id: 'near', when: soon }, { ...outcome, id: 'far' }] }],
    });
    const { engine: eng, presented } = select(engine(), sim, [guarded]);
    const near = resolveChoice(eng, sim, [guarded], presented[0]!.id, 'ok', { weeksToReview: 1 });
    const far = resolveChoice(eng, sim, [guarded], presented[0]!.id, 'ok');
    expect(near.kind === 'resolved' && near.debrief.outcomeId).toBe('near');
    expect(far.kind === 'resolved' && far.debrief.outcomeId).toBe('far');
  });
});

describe('personality', () => {
  // @spec SIT-COND-015
  it('gives a person their personality, and no value when they have none', () => {
    const sim = patch(fresh(), (s) => (s.people.e1!.personality = 'quiet'));
    check(sim, { engineer: 'e1', other: 'e2' }, [
      [{ value: 'engineer.personality', is: 'quiet' }, true],
      [{ value: 'engineer.personality', isNot: 'quiet' }, false],
      [{ value: 'engineer.personality', in: ['blunt', 'quiet'] }, true],
      // e2 has no personality: every comparison fails except isNot
      [{ value: 'other.personality', is: 'quiet' }, false],
      [{ value: 'other.personality', in: ['quiet'] }, false],
      [{ value: 'other.personality', isNot: 'quiet' }, true],
      [{ value: 'other.personality', is: { value: 'engineer.personality' } }, false],
    ]);
    const same = patch(sim, (s) => (s.people.e2!.personality = 'quiet'));
    check(same, { engineer: 'e1', other: 'e2' }, [[{ value: 'other.personality', is: { value: 'engineer.personality' } }, true]]);
  });
});

describe('purity', () => {
  // @spec SIT-COND-010
  it('changes neither the simulation nor the engine state', () => {
    const sim = rated();
    const eng = select(engine(), sim, [plain('s1')]).engine;
    const simBefore = structuredClone(sim);
    const engBefore = structuredClone(eng);
    const conditions = [
      { all: [TRUE, { any: [FALSE] }] },
      { value: 'engineer.correspondingRating', above: 'below' },
      { count: { kind: 'team', where: { value: 'it.troubled', is: false } }, atLeast: 1 },
      { history: 'engineer', atLeast: 1 },
      { presented: 's1', is: 1 },
    ];
    for (const condition of conditions) holds(sim, c(condition), { engineer: 'e1' }, eng);
    expect(sim).toEqual(simBefore);
    expect(eng).toEqual(engBefore);
  });
});
