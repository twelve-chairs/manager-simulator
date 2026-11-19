import { describe, expect, it } from 'vitest';
import { advance } from '../../src/sim';
import { fresh, patch, person } from './fixtures';

describe('game time', () => {
  // @spec SIM-TIME-001
  it('starts at week 0', () => {
    expect(fresh().week).toBe(0);
  });

  // @spec SIM-TIME-002
  it('advances the game week by the step length', () => {
    const afterWeek = advance(fresh(), 1).state;
    expect(afterWeek.week).toBe(1);
    expect(advance(afterWeek, 13).state.week).toBe(14);
  });

  // @spec SIM-TIME-003
  it('counts tracked durations in weeks, not steps', () => {
    const low = patch(fresh(), (s) => {
      s.projects = {};
      s.people.e1!.motivation = 5;
      s.people.e1!.lowMotivationWeeks = 0;
    });
    const { state } = advance(low, 4);
    const e1 = person(state, 'e1');
    // e1 may quit; the duration must still have been counted in weeks.
    if (e1.status === 'active') expect(e1.lowMotivationWeeks).toBe(4);

    const served = patch(fresh(), (s) => {
      s.projects = {};
      s.people.e1!.wantServedWeek = 0;
    });
    // One 13-week step passes the 8-week drift threshold even though it is a single step.
    expect(person(advance(served, 13).state, 'e1').motivation).toBeLessThan(50);
  });
});
