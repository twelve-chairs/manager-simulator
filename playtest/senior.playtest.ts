import { expect, test } from '@playwright/test';
import { attachSummary, betterByTitle, firstSeedThatReaches, watch } from './harness';
import { momentKind } from './metrics';

const TRUST = ['wary', 'guarded', 'neutral', 'trusting', 'loyal'];
const SOUND = ['coach', 'move', 'agree', 'give', 'evidence', 'promoteFromTeam', 'letGo'];

// @spec PLAY-RUN-001, PLAY-RUN-005, PLAY-RUN-006, LOOP-WEEK-010
test('a sound player promoted to senior manager hands over by the rule and plays sound practice through the months', async ({ page }, testInfo) => {
  const problems = watch(page);
  const { seed, summary } = await firstSeedThatReaches(page, [103, 104, 11, 12, 105, 106], { strategy: 'sound' }, (s) => s.seen.handover !== null);
  await attachSummary(testInfo, `senior-${seed}`, summary);
  expect(summary.violations, 'every screen passes its checks').toEqual([]);
  expect(problems).toEqual([]);

  // The handover: the most trusting engineer who wants growth, if one is trusting or better; otherwise an outside hire.
  const { choice, options } = summary.seen.handover!;
  const growers = options.filter((o) => o.want === 'growth' && TRUST.indexOf(o.trust) >= 3);
  const best = Math.max(-1, ...growers.map((o) => TRUST.indexOf(o.trust)));
  if (growers.length) expect(growers.filter((o) => TRUST.indexOf(o.trust) === best).map((o) => o.id)).toContain(choice);
  else expect(choice).toBe('hire');

  // Every senior moment answered by sound practice's first offered preference, every situation by its better choice,
  // and calibration settled on the evidence.
  expect(summary.seen.seniorChoices.length).toBeGreaterThan(0);
  const better = betterByTitle();
  for (const { title, offered, chosen } of summary.seen.seniorChoices) {
    if (chosen === 'settle') {
      expect(offered).toContain('acceptAll');
      continue;
    }
    const situationBetter = momentKind(title, 'senior') === null ? better[title] : undefined;
    const situationPick = situationBetter && offered.includes(situationBetter) ? situationBetter : offered[0];
    const preferred = momentKind(title, 'senior') === null ? situationPick : (SOUND.find((id) => offered.includes(id)) ?? offered[0]);
    expect(chosen, `offered ${offered.join(', ')}`).toBe(preferred);
  }
  // The run played until it ended, at the senior manager.
  expect(summary.ending).toMatch(/senior manager|director|burned out|managed out|promoted past the top/);
});
