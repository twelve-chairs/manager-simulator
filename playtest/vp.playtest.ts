import { expect, test } from '@playwright/test';
import { attachSummary, betterByTitle, firstSeedThatReaches, watch } from './harness';
import { momentKind } from './metrics';

const TRUST = ['wary', 'guarded', 'neutral', 'trusting', 'loyal'];
const SOUND = ['plan', 'together', 'once', 'truth', 'promote', 'letGo'];

// @spec PLAY-RUN-001, PLAY-RUN-010, UI-VP-013
test('a sound player promoted to VP hands over by the rule and plays sound practice through the quarters', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const problems = watch(page);
  // Which seeds a scripted sound run takes to the VP moves with tuning and content, so the search is wide.
  const seeds = [101, 102, 103, 104, 105, 106, 107, 108, 11, 12, 13, 14, ...Array.from({ length: 48 }, (_, i) => 109 + i)];
  const { seed, summary } = await firstSeedThatReaches(page, seeds, { strategy: 'sound' }, (s) => s.seen.vpHandover !== null);
  await attachSummary(testInfo, `vp-${seed}`, summary);
  expect(summary.violations, 'every screen passes its checks').toEqual([]);
  expect(problems).toEqual([]);

  // The handover: the most trusting senior manager who wants growth, if one is trusting or better; otherwise an outside hire.
  const { choice, options } = summary.seen.vpHandover!;
  const growers = options.filter((o) => o.want === 'growth' && TRUST.indexOf(o.trust) >= 3);
  const best = Math.max(-1, ...growers.map((o) => TRUST.indexOf(o.trust)));
  if (growers.length) expect(growers.filter((o) => TRUST.indexOf(o.trust) === best).map((o) => o.id)).toContain(choice);
  else expect(choice).toBe('hire');

  // Every VP moment answered by sound practice; the priority and disputes depend on what the cards show, so any sound answer passes.
  expect(summary.seen.vpChoices.length).toBeGreaterThan(0);
  const better = betterByTitle();
  for (const { title, offered, chosen } of summary.seen.vpChoices) {
    const kind = momentKind(title, 'vp');
    if (kind === 'Company priority') {
      expect(chosen, title).toMatch(/^one:/);
      continue;
    }
    if (kind === 'Leadership dispute') {
      expect(['trade', 'company']).toContain(chosen);
      continue;
    }
    const situationBetter = kind === null ? better[title] : undefined;
    const situationPick = situationBetter && offered.includes(situationBetter) ? situationBetter : offered[0];
    const preferred = kind === null ? situationPick : (SOUND.find((id) => offered.includes(id)) ?? offered[0]);
    expect(chosen, `${title}: offered ${offered.join(', ')}`).toBe(preferred);
  }
  expect(summary.ending).toMatch(/VP|burned out|managed out|promoted past the top/);
});
