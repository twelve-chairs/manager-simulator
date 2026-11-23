import { expect, test } from '@playwright/test';
import type { z } from 'zod';
import type { AiClient } from './ai/core';
import { playAi } from './ai/run';
import { play, startSeeded, watch } from './harness';

/**
 * The AI playtester's driver with a fake client in place of Claude, so it costs nothing and runs with the playtests:
 * a scripted sound player carries a run to the director's handover, then the fake plays on, taking the first valid action on
 * every screen. It checks that the driver reads every kind of decision screen and acts on it in the real page.
 */
function fakeClient(): AiClient & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async ask<T>(_system: string, user: string, schema: z.ZodType<T>): Promise<T | null> {
      asked.push(user);
      if (user.includes('The facilitator asks you')) return schema.parse({ answers: [{ heading: 'Promotion changes the job', answer: 'A fake answer.' }] });
      const choice = /Choices \(ids in backticks\):\n- `([^`]+)`/.exec(user)?.[1] ?? '';
      const heads = /Heads to place: (\d+)\. Targets:\n- `([^`]+)`/.exec(user);
      const bet = /Bets on offer:\n- `([^`]+)`[\s\S]*Groups that could carry one:\n- `([^`]+)`/.exec(user);
      const action = heads
        ? { kind: 'place', choiceId: '', place: [{ target: heads[2], count: Number(heads[1]) }], fund: [] }
        : bet
          ? { kind: 'fund', choiceId: '', place: [], fund: [{ offerId: bet[1], groupId: bet[2] }] }
          : { kind: 'choose', choiceId: choice, place: [], fund: [] };
      return schema.parse({ thinkAloud: 'A fake thought.', feeling: 'clear', action, habits: [], notebook: 'Fake notes.' });
    },
  };
}

// @spec PLAY-AI-002, PLAY-AI-003, PLAY-AI-004, PLAY-AI-005
test('the AI playtester’s driver reads and acts on every kind of decision screen, with a fake client', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const problems = watch(page);
  let carried = false;
  // Seed 108 reaches the director soonest under the scripted sound player; the rest are a fallback if tuning moves it.
  for (const seed of [108, 101, 102, 103, 104, 105, 106, 107]) {
    await startSeeded(page, seed);
    const s = await play(page, { strategy: 'sound', seed, maxWeeks: 170, until: 'directorHandover' });
    if (s.seen.directorHandover) {
      carried = true;
      break;
    }
  }
  expect(carried, 'a scripted run reached the director').toBe(true);
  const client = fakeClient();
  const run = await playAi(page, client, { persona: 'new-manager', until: 'end', maxDecisions: 60 });
  const kinds = new Set(run.steps.map((s) => s.action.kind));
  expect([...kinds].sort()).toEqual(['choose', 'fund', 'place']);
  expect(run.steps.filter((s) => s.note), 'every fake reply was valid').toEqual([]);
  // the screen text reaches the playtester, and nothing of the game's state does
  expect(client.asked.some((m) => m.includes('Your senior managers'))).toBe(true);
  // How to play is open in a level's first turns, as a newcomer sees it
  expect(client.asked.some((m) => m.includes('How to play'))).toBe(true);
  expect(client.asked.some((m) => /"seed"|rngState|leniency/.test(m))).toBe(false);
  expect(run.interviews.length).toBeGreaterThan(0);
  // the interview after the promotion follows the director's first quarters, and is told of the promotion
  expect(run.interviews[0]?.when).toMatch(/after the first promotion and \d+ turns/);
  expect(client.asked.find((m) => m.includes('The facilitator asks you'))).toMatch(/You were promoted[\s\S]*director/i);
  expect(problems).toEqual([]);
});
