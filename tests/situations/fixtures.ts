import { expect } from 'vitest';
import type { Condition, EngineState, Presentation, ResolveResult, Situation } from '../../src/situations';
import { createEngine, evaluateCondition, loadContent, resolveChoice, selectSituations } from '../../src/situations';
import type { SimState } from '../../src/sim';

export { fresh, patch, person, rated } from '../sim/fixtures';

/** A minimal valid situation with one person role and one choice; override any part. */
export function sit(overrides: Partial<Situation> = {}): Situation {
  return {
    id: 'test-situation',
    title: 'Test situation',
    levels: ['line-manager'],
    priority: 'normal',
    roles: [{ name: 'engineer', kind: 'person' }],
    choices: [
      {
        id: 'talk',
        label: 'Talk to {engineer}',
        outcomes: [
          {
            id: 'fine',
            effects: [{ type: 'value', target: 'engineer', field: 'motivation', amount: -5 }],
            aftermath: '{engineer} nods.',
            debrief: 'Talking helps.',
          },
        ],
      },
    ],
    text: '{engineer} looks tired.',
    ...overrides,
  };
}

/** Loads situations through validation, failing the test if any is invalid. */
export function valid(...situations: Situation[]): Situation[] {
  const { situations: ok, errors } = loadContent(situations);
  expect(errors).toEqual([]);
  return ok;
}

/** The error messages for a single situation that should be rejected. */
export function rejectionOf(raw: unknown): string {
  const { situations, errors } = loadContent([raw]);
  expect(situations).toEqual([]);
  expect(errors).toHaveLength(1);
  return errors[0]!.message;
}

export const engine = (seed = 1): EngineState => createEngine(seed);

/** Evaluates a condition against a simulation state with the given role bindings. */
export const holds = (sim: SimState, condition: Condition, bindings: Record<string, string> = {}, eng: EngineState = engine()) =>
  evaluateCondition(condition, { sim, engine: eng, bindings });

/** A valid situation with no roles and one choice with no effects. */
export const plain = (id: string, overrides: Partial<Situation> = {}): Situation =>
  sit({
    id,
    roles: [],
    text: 'Something happens.',
    choices: [{ id: 'ok', label: 'OK', outcomes: [{ id: 'done', effects: [], aftermath: 'Done.', debrief: 'Nothing to learn.' }] }],
    ...overrides,
  });

/** Selects situations for the line manager level. */
export const select = (eng: EngineState, sim: SimState, situations: Situation[], limit = 3, level = 'line-manager') =>
  selectSituations(eng, sim, situations, level, limit);

/** Selects exactly one situation, failing the test otherwise. */
export function presentOne(eng: EngineState, sim: SimState, situation: Situation): { engine: EngineState; presentation: Presentation } {
  const { engine: next, presented } = select(eng, sim, [situation]);
  expect(presented).toHaveLength(1);
  return { engine: next, presentation: presented[0]! };
}

export const resolve = (eng: EngineState, sim: SimState, situations: Situation[], presentation: Presentation, choiceId: string): ResolveResult =>
  resolveChoice(eng, sim, situations, presentation.id, choiceId);

export function expectResolved(result: ResolveResult) {
  if (result.kind !== 'resolved') throw new Error(`expected a resolution, got ${result.kind}`);
  return result;
}

/** A role binding only e1 in the fixture organization (the one growth-minded engineer on the player's team). */
export const ONLY_E1 = {
  all: [
    { value: 'engineer.team', is: { value: 'player.team' } },
    { value: 'engineer.want', is: 'growth' },
  ],
} as Condition;

/** A role condition binding only t2, the team the player does not lead. */
export const OTHER_TEAM = { value: 'team.id', isNot: { value: 'player.team' } } as Condition;
