import { describe, expect, it } from 'vitest';
import { debriefsSince, type Condition, type Situation } from '../../src/situations';
import { applyEffects, type SimState } from '../../src/sim';
import { ONLY_E1, OTHER_TEAM, engine, expectResolved, fresh, patch, plain, presentOne, resolve, select, sit } from './fixtures';

const c = (x: unknown) => x as Condition;

/** A situation about e1 with a guarded outcome: trust decides whether talking goes well. */
function talk(overrides: Partial<Situation> = {}): Situation {
  return sit({
    id: 'talk-it-out',
    roles: [{ name: 'engineer', kind: 'person', where: ONLY_E1 }],
    choices: [
      {
        id: 'talk',
        label: 'Talk to {engineer}',
        outcomes: [
          {
            id: 'good',
            when: c({ value: 'engineer.trust', atLeast: 50 }),
            effects: [{ type: 'value', target: 'engineer', field: 'stress', amount: -5 }],
            aftermath: '{engineer} nods.',
            debrief: 'Talking works with trust.',
          },
          {
            id: 'bad',
            effects: [{ type: 'value', target: 'engineer', field: 'stress', amount: 5 }],
            aftermath: '{engineer} shrugs.',
            debrief: 'Without trust, talking goes nowhere.',
          },
        ],
      },
      {
        id: 'push',
        label: 'Push {engineer}',
        availableIf: c({ value: 'engineer.motivation', above: 40 }),
        outcomes: [{ id: 'pushed', effects: [], aftermath: 'Pushed.', debrief: 'Pushing.' }],
      },
    ],
    ...overrides,
  });
}

/** Presents a situation at the given week, returning the engine and simulation states to resolve against. */
function presented(situation: Situation, week = 4, sim: SimState = fresh()) {
  const at = patch(sim, (s) => (s.week = week));
  const { engine: eng, presentation } = presentOne(engine(), at, situation);
  return { eng, sim: at, presentation, situations: [situation] };
}

/** Asserts a resolution failed and that it changed neither state. */
function expectErrorUnchanged(run: () => ReturnType<typeof resolve>, eng: unknown, sim: unknown) {
  const engBefore = structuredClone(eng);
  const simBefore = structuredClone(sim);
  const result = run();
  expect(result.kind).toBe('error');
  expect(eng).toEqual(engBefore);
  expect(sim).toEqual(simBefore);
  return result;
}

describe('open presentations', () => {
  // @spec SIT-RES-008
  it('rejects a presentation that is not open', () => {
    const { eng, sim, presentation, situations } = presented(talk());
    expectErrorUnchanged(() => resolve(eng, sim, situations, { ...presentation, id: 'never-presented' }, 'talk'), eng, sim);
    const next = select(eng, sim, []).engine;
    expectErrorUnchanged(() => resolve(next, sim, situations, presentation, 'talk'), next, sim);
  });

  // @spec SIT-RES-009, SIT-RES-008
  it('closes a presentation when it is resolved or expires', () => {
    const { eng, sim, presentation, situations } = presented(talk());
    const done = expectResolved(resolve(eng, sim, situations, presentation, 'talk'));
    expectErrorUnchanged(() => resolve(done.engine, done.sim, situations, presentation, 'talk'), done.engine, done.sim);

    const gone = patch(sim, (s) => (s.people.e1!.status = 'departed'));
    const expired = resolve(eng, gone, situations, presentation, 'talk');
    expect(expired.kind).toBe('expired');
    if (expired.kind !== 'expired') return;
    expectErrorUnchanged(() => resolve(expired.engine, gone, situations, presentation, 'talk'), expired.engine, gone);
  });
});

describe('expiry', () => {
  // @spec SIT-RES-001
  it('expires with no effects when a bound person, team or project is gone', () => {
    const { eng, sim, presentation, situations } = presented(talk(), 4);
    const gone = patch(sim, (s) => (s.people.e1!.status = 'departed'));
    const result = resolve(eng, gone, situations, presentation, 'talk');
    if (result.kind !== 'expired') throw new Error(`expected expiry, got ${result.kind}`);
    expect(result.sim).toEqual(gone);
    expect(result.debrief).toEqual({ week: 4, situationId: 'talk-it-out', bindings: { engineer: 'e1' }, status: 'expired' });
    expect(debriefsSince(result.engine, 0)).toEqual([result.debrief]);

    const onProject = sit({ id: 'proj', roles: [{ name: 'project', kind: 'project' }], text: '{project}', choices: plain('x').choices });
    const p = presented(onProject);
    const cancelled = patch(p.sim, (s) => (s.projects.p1!.status = 'cancelled'));
    expect(resolve(p.eng, cancelled, p.situations, p.presentation, 'ok').kind).toBe('expired');

    const onTeam = sit({ id: 'team', roles: [{ name: 'team', kind: 'team', where: OTHER_TEAM }], text: '{team}', choices: plain('x').choices });
    const t = presented(onTeam);
    const noTeam = patch(t.sim, (s) => delete s.teams.t2);
    expect(resolve(t.eng, noTeam, t.situations, t.presentation, 'ok').kind).toBe('expired');
  });
});

describe('choosing', () => {
  // @spec SIT-RES-002
  it('rejects a choice that does not exist or is no longer offered', () => {
    const { eng, sim, presentation, situations } = presented(talk());
    expectErrorUnchanged(() => resolve(eng, sim, situations, presentation, 'shout'), eng, sim);
    const demotivated = patch(sim, (s) => (s.people.e1!.motivation = 30));
    expectErrorUnchanged(() => resolve(eng, demotivated, situations, presentation, 'push'), eng, demotivated);
    expect(resolve(eng, sim, situations, presentation, 'push').kind).toBe('resolved');
  });

  // @spec SIT-RES-010
  it('rejects a presentation whose situation is not in the given content', () => {
    const { eng, sim, presentation } = presented(talk());
    expectErrorUnchanged(() => resolve(eng, sim, [plain('other')], presentation, 'talk'), eng, sim);
  });

  // @spec SIT-RES-003
  it('applies the first outcome whose when holds against the current state', () => {
    const { eng, sim, presentation, situations } = presented(talk());
    expect(expectResolved(resolve(eng, sim, situations, presentation, 'talk')).debrief.outcomeId).toBe('good');
    const distrustful = patch(sim, (s) => (s.people.e1!.trust = 40));
    expect(expectResolved(resolve(eng, distrustful, situations, presentation, 'talk')).debrief.outcomeId).toBe('bad');
  });
});

describe('applying an outcome', () => {
  // @spec SIT-RES-004
  it('substitutes bound ids, attaches the cause and submits one batch', () => {
    const s = sit({
      id: 'reshuffle',
      roles: [
        { name: 'engineer', kind: 'person', where: ONLY_E1 },
        { name: 'team', kind: 'team', where: OTHER_TEAM },
      ],
      choices: [
        {
          id: 'move',
          label: 'Move {engineer}',
          outcomes: [
            {
              id: 'moved',
              effects: [
                { type: 'value', target: 'engineer', field: 'stress', amount: 5, historyNote: 'Moved teams' },
                { type: 'move', personId: 'engineer', teamId: 'team' },
                { type: 'value', target: 'player', field: 'reputation', amount: -3 },
              ],
              aftermath: '{engineer} joins {engineer.team}.',
              debrief: 'Moves cost goodwill.',
            },
          ],
        },
      ],
    });
    const { eng, sim, presentation, situations } = presented(s);
    const cause = { kind: 'situation' as const, situationId: 'reshuffle', choiceId: 'move' };
    const direct = applyEffects(sim, [
      { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'stress', amount: 5, cause, historyNote: 'Moved teams' },
      { type: 'move', personId: 'e1', teamId: 't2', cause },
      { type: 'value', target: { kind: 'player' }, field: 'reputation', amount: -3, cause },
    ]);
    if (!direct.ok) throw new Error(direct.error.message);
    const result = expectResolved(resolve(eng, sim, situations, presentation, 'move'));
    expect(result.sim).toEqual(direct.state);
    expect(result.log).toEqual(direct.log);
    expect(result.aftermath).toBe('e1 joins Search.');
  });

  // @spec SIT-RES-005
  it('returns the new simulation state, change log, aftermath and debrief record', () => {
    const { eng, sim, presentation, situations } = presented(talk());
    const result = expectResolved(resolve(eng, sim, situations, presentation, 'talk'));
    expect(result.sim.people.e1!.stress).toBe(25);
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.aftermath).toBe('e1 nods.');
    expect(result.debrief.situationId).toBe('talk-it-out');
  });

  // @spec SIT-RES-006
  it('records a debrief record for the review', () => {
    const { eng, sim, presentation, situations } = presented(talk(), 4);
    const result = expectResolved(resolve(eng, sim, situations, presentation, 'talk'));
    const record = {
      week: 4,
      situationId: 'talk-it-out',
      choiceId: 'talk',
      outcomeId: 'good',
      bindings: { engineer: 'e1' },
      status: 'resolved',
      aftermath: 'e1 nods.',
      debrief: 'Talking works with trust.',
    };
    expect(result.debrief).toEqual(record);
    expect(debriefsSince(result.engine, 0)).toEqual([record]);
  });

  // @spec SIT-RES-007
  it('reports a batch the core rejects and changes nothing', () => {
    // re-rating needs an aggregate team; t2 is detailed, which validation cannot know
    const s = sit({
      id: 'calibrate',
      roles: [{ name: 'team', kind: 'team', where: OTHER_TEAM }],
      text: 'Calibrate {team}.',
      choices: [
        {
          id: 'raise',
          label: 'Raise one',
          outcomes: [{ id: 'raised', effects: [{ type: 'reRate', teamId: 'team', from: 'unrated', to: 'meets', count: 1 }], aftermath: '', debrief: '' }],
        },
      ],
    });
    const { eng, sim, presentation, situations } = presented(s);
    const result = expectErrorUnchanged(() => resolve(eng, sim, situations, presentation, 'raise'), eng, sim);
    if (result.kind !== 'error') return;
    expect(result.message).toMatch(/calibrate/);
    expect(result.message).toMatch(/raise/);
    expect(result.message).toMatch(/raised/);
  });
});
