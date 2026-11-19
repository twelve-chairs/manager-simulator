import { describe, expect, it } from 'vitest';
import type { Situation } from '../../src/situations';
import type { SimState } from '../../src/sim';
import { ONLY_E1, OTHER_TEAM, engine, expectResolved, fresh, patch, presentOne, resolve, sit } from './fixtures';

/** A situation binding e1, team t2 and project p1, with placeholders in every kind of text. */
const story = (): Situation =>
  sit({
    id: 'story',
    roles: [
      { name: 'engineer', kind: 'person', where: ONLY_E1 },
      { name: 'team', kind: 'team', where: OTHER_TEAM },
      { name: 'project', kind: 'project' },
    ],
    text: '{engineer} from {engineer.team} works on {project}; {team} watches.',
    choices: [
      {
        id: 'ask',
        label: 'Ask {engineer} about {project}',
        outcomes: [{ id: 'asked', effects: [], aftermath: '{engineer} explains {project}.', debrief: '{team} noticed.' }],
      },
    ],
  });

const named = (engineerName: string, projectName = 'Checkout rewrite'): SimState =>
  patch(fresh(), (s) => {
    s.people.e1!.name = engineerName;
    s.projects.p1!.name = projectName;
  });

describe('placeholders', () => {
  // @spec SIT-TEXT-001
  it('replaces roles with names and role.team with the person team name', () => {
    const sim = named('Ana');
    const { engine: eng, presentation } = presentOne(engine(), sim, story());
    expect(presentation.text).toBe('Ana from Payments works on Checkout rewrite; Search watches.');
    expect(presentation.choices).toEqual([{ id: 'ask', label: 'Ask Ana about Checkout rewrite' }]);
    const result = expectResolved(resolve(eng, sim, [story()], presentation, 'ask'));
    expect(result.aftermath).toBe('Ana explains Checkout rewrite.');
    expect(result.debrief.aftermath).toBe('Ana explains Checkout rewrite.');
    expect(result.debrief.debrief).toBe('Search noticed.');
  });

  // @spec SIT-TEXT-002
  it('inserts names verbatim as plain text', () => {
    const { presentation } = presentOne(engine(), named('<b>Ana</b> & "co"'), story());
    expect(presentation.text).toBe('<b>Ana</b> & "co" from Payments works on Checkout rewrite; Search watches.');
  });

  // @spec SIT-TEXT-003
  it('substitutes in a single pass', () => {
    const { presentation } = presentOne(engine(), named('{project}', '{engineer.team}'), story());
    expect(presentation.text).toBe('{project} from Payments works on {engineer.team}; Search watches.');
  });
});
