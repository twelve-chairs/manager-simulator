import { describe, expect, it } from 'vitest';
import type { ProjectMove } from '../../src/levels/line-manager';
import { moveLine } from '../../src/ui/text';

describe('how a project moved', () => {
  // @spec UI-LINE-011
  it('names each cause and its amount, costs first', () => {
    const move: ProjectMove = { projectId: 'p1', name: 'Mobile login', start: 9, end: 4, scope: 60, causes: [{ cause: 'payDown', amount: -6 }, { cause: 'setback', amount: -6 }, { cause: 'work', amount: 7 }] };
    expect(moveLine(move)).toBe('Mobile login went from 9 to 4 of 60: fixing the debt first cost 6, a setback cost 6, and the team’s work added 7.');
    expect(moveLine({ ...move, end: 16, causes: [{ cause: 'work', amount: 7 }] })).toBe('Mobile login went from 9 to 16 of 60: the team’s work added 7.');
    expect(moveLine({ ...move, end: 11, causes: [{ cause: 'work', amount: 7 }, { cause: 'rollBack', amount: -5 }] })).toBe('Mobile login went from 9 to 11 of 60: rolling the change back cost 5, and the team’s work added 7.');
    expect(moveLine({ ...move, end: 6, causes: [{ cause: 'approvals', amount: -2 }, { cause: 'situations', amount: -5 }, { cause: 'work', amount: 4 }] })).toBe(
      'Mobile login went from 9 to 6 of 60: approvals that slipped cost 2, this week’s situations cost 5, and the team’s work added 4.',
    );
  });
});
