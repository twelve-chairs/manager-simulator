import { describe, expect, it } from 'vitest';
import type { Situation } from '../../../src/situations';
import { realContent } from '../../balance/harness';

/** Where a senior manager situation lowers a team's headcount, which the level would count as attrition. */
function headcountCuts(situations: Situation[]): string[] {
  const found: string[] = [];
  for (const s of situations.filter((x) => x.levels.includes('senior-manager'))) {
    for (const c of s.choices) {
      for (const o of c.outcomes) {
        for (const e of o.effects as { type: string; field?: string; amount?: number }[]) {
          if (e.type === 'value' && e.field === 'headcount' && (e.amount ?? 0) < 0) found.push(`${s.id}/${c.id}/${o.id}`);
        }
      }
    }
  }
  return found;
}

describe('senior manager situation content', () => {
  // @spec SENIOR-MOMENT-012
  it('never lowers a team’s headcount', () => {
    const content = realContent();
    expect(content.some((s) => s.levels.includes('senior-manager'))).toBe(true);
    expect(headcountCuts(content)).toEqual([]);
    // the check itself catches a cut
    const cut = structuredClone(content.find((s) => s.id === 'senior-back-to-keyboard')!);
    (cut.choices[1]!.outcomes[0]!.effects[0] as { amount: number }).amount = -1;
    expect(headcountCuts([cut])).toEqual(['senior-back-to-keyboard/help-move-back/moves-back']);
  });
});
