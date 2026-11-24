import { describe, expect, it } from 'vitest';
import { headsLostLine, quitLine } from '../../src/ui/text';

describe('who left', () => {
  // @spec UI-QUIT-001
  it('says what led to a quit, clause by clause, and the last thing between you', () => {
    const q = { personId: 'e1', name: 'Lena Varga', lowMotivationWeeks: 6, highStressWeeks: 3, lowTrust: true, lastMemory: 'Agreed to give managing another year' };
    expect(quitLine(q)).toBe('Lena Varga quit, after 6 weeks of low motivation and 3 of high stress, trusting you little. The last thing between you: Agreed to give managing another year.');
    expect(quitLine({ ...q, highStressWeeks: 0, lowTrust: false, lastMemory: undefined })).toBe('Lena Varga quit, after 6 weeks of low motivation.');
    expect(quitLine({ ...q, lowMotivationWeeks: 0, highStressWeeks: 1, lowTrust: false })).toBe('Lena Varga quit, after 1 week of high stress. The last thing between you: Agreed to give managing another year.');
    expect(quitLine({ ...q, lowMotivationWeeks: 0, highStressWeeks: 0 })).toBe('Lena Varga quit, trusting you little. The last thing between you: Agreed to give managing another year.');
    expect(quitLine({ ...q, lowMotivationWeeks: 0, highStressWeeks: 0, lowTrust: false, lastMemory: undefined })).toBe('Lena Varga quit, for reasons of their own.');
  });

  // @spec UI-QUIT-001
  it('says how many engineers a team lost, and how many you would have kept', () => {
    expect(headsLostLine({ name: 'Platform', count: 1, regretted: 1 })).toBe("Platform lost 1 engineer, one you'd have kept.");
    expect(headsLostLine({ name: 'Platform', count: 3, regretted: 2 })).toBe("Platform lost 3 engineers, 2 of them ones you'd have kept.");
    expect(headsLostLine({ name: 'Search', count: 2, regretted: 0 })).toBe('Search lost 2 engineers.');
  });
});
