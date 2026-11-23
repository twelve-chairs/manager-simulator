import { expect, test } from '@playwright/test';
import { attachSummary, betterByTitle, firstSeedThatReaches, watch } from './harness';
import { momentKind } from './metrics';

const TRUST = ['wary', 'guarded', 'neutral', 'trusting', 'loyal'];
const SOUND = ['spread', 'coach', 'promote', 'letGo', 'splitPromote', 'merge', 'straight'];

// @spec PLAY-RUN-001, PLAY-RUN-009, UI-DIR-016
test('a sound player promoted to director hands over by the rule and plays sound practice through the quarters', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const problems = watch(page);
  const seeds = [101, 102, 103, 104, 105, 106, 107, 108, 11, 12, 13, 14];
  const { seed, summary } = await firstSeedThatReaches(page, seeds, { strategy: 'sound' }, (s) => s.seen.directorHandover !== null);
  await attachSummary(testInfo, `director-${seed}`, summary);
  expect(summary.violations, 'every screen passes its checks').toEqual([]);
  expect(problems).toEqual([]);

  // The handover: the most trusting manager who wants growth, if one is trusting or better; otherwise an outside hire.
  const { choice, options } = summary.seen.directorHandover!;
  const growers = options.filter((o) => o.want === 'growth' && TRUST.indexOf(o.trust) >= 3);
  const best = Math.max(-1, ...growers.map((o) => TRUST.indexOf(o.trust)));
  if (growers.length) expect(growers.filter((o) => TRUST.indexOf(o.trust) === best).map((o) => o.id)).toContain(choice);
  else expect(choice).toBe('hire');

  // Every director moment answered by sound practice: bets funded through their scene, situations by the table.
  expect(summary.seen.directorChoices.length).toBeGreaterThan(0);
  const better = betterByTitle();
  for (const { title, offered, chosen } of summary.seen.directorChoices) {
    if (momentKind(title, 'director') === 'Strategy bets') {
      expect(chosen).toBe('fund-bets');
      continue;
    }
    // A peer's ask: negotiate with a trusting peer, agree otherwise; which one depends on the card, so either is sound.
    if (momentKind(title, 'director') === 'Peer ask') {
      expect(['negotiate', 'agree']).toContain(chosen);
      continue;
    }
    const situationBetter = momentKind(title, 'director') === null ? better[title] : undefined;
    const preferred = momentKind(title, 'director') === null ? (situationBetter && offered.includes(situationBetter) ? situationBetter : offered[0]) : (SOUND.find((id) => offered.includes(id)) ?? offered[0]);
    expect(chosen, `${title}: offered ${offered.join(', ')}`).toBe(preferred);
  }
  expect(summary.ending).toMatch(/director|burned out|managed out|promoted past the top/);
});
