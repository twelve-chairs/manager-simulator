import { describe, expect, it } from 'vitest';
import { quitLine } from '../../src/ui/text';

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
});
