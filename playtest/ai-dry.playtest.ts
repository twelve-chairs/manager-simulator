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
      const choice = /Choices[^\n]*:\n- `([^`]+)`/.exec(user)?.[1] ?? '';
      const heads = /Heads to place: (\d+)\. Targets:\n- `([^`]+)`/.exec(user);
      const bet = /Bets on offer:\n- `([^`]+)`[\s\S]*Groups that could carry one:\n- `([^`]+)`/.exec(user);
      const move = /Calibration moves[^\n]*\n- `([^`]+)`/.exec(user);
      const none = { place: [], fund: [], calibrate: [] };
      const action = heads
        ? { ...none, kind: 'place', choice: '', place: [{ target: heads[2], count: Number(heads[1]) }] }
        : bet
          ? { ...none, kind: 'fund', choice: '', fund: [{ bet: bet[1], group: bet[2] }] }
          : move
            ? { ...none, kind: 'calibrate', choice: '', calibrate: [{ move: move[1], count: 1 }] }
            : { ...none, kind: 'choose', choice };
      return schema.parse({ thinkAloud: 'A fake thought.', feeling: 'clear', action, habits: [], notebook: 'Fake notes.' });
    },
  };
}

// @spec PLAY-AI-002, PLAY-AI-003, PLAY-AI-004, PLAY-AI-005
test('the AI playtester’s driver reads and acts on every kind of decision screen, with a fake client', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const problems = watch(page);
  let carried = false;
  // Any seed whose scripted sound run reaches the director will do; which ones do moves with tuning and content.
  for (let seed = 101; seed <= 140; seed++) {
    await startSeeded(page, seed);
    const s = await play(page, { strategy: 'sound', seed, maxWeeks: 200, until: 'directorHandover' });
    if (s.seen.directorHandover) {
      carried = true;
      break;
    }
  }
  expect(carried, 'a scripted run reached the director').toBe(true);
  const client = fakeClient();
  const run = await playAi(page, client, { persona: 'new-manager', until: 'end', maxDecisions: 60 });
  const kinds = new Set(run.steps.map((s) => s.action.kind));
  expect([...kinds].sort((a, b) => a.localeCompare(b))).toEqual(['choose', 'fund', 'place']);
  expect(run.steps.filter((s) => s.note), 'every fake reply was valid').toEqual([]);
  // the screen text reaches the playtester, and nothing of the game's state does
  expect(client.asked.some((m) => m.includes('Your senior managers'))).toBe(true);
  // How to play is open in a level's first turns, as a newcomer sees it
  expect(client.asked.some((m) => m.includes('How to play'))).toBe(true);
  // A reaction is read before the next decision: the scene's text, not the panels around it.
  expect(client.asked.some((m) => /reactions, recaps and reviews, in order\):\n[\s\S]*After your choice:\n\S/.test(m))).toBe(true);
  // The model is shown neutral handles, never the game's ids, which read as an answer key.
  expect(client.asked.filter((m) => /`(self|pushBack|backUp|takeOver|rollBack|give:[^`]*|agree|decide|letRun|coach|stepIn|rotation|seniors|me|fortnightly|weekly)`/.test(m))).toEqual([]);
  // and the transcript keeps what was read with the decision it came before, so a report's claims can be checked
  expect(run.steps.some((s) => s.read?.includes('After your choice:'))).toBe(true);
  expect(client.asked.some((m) => /"seed"|rngState|leniency/.test(m))).toBe(false);
  expect(run.interviews.length).toBeGreaterThan(0);
  // the interview after the promotion follows the director's first quarters, and is told of the promotion
  expect(run.interviews[0]?.when).toMatch(/after the first promotion and \d+ turns/);
  expect(client.asked.find((m) => m.includes('The facilitator asks you'))).toMatch(/You were promoted[\s\S]*director/i);
  expect(problems).toEqual([]);
});

// @spec PLAY-AI-010
test('the AI playtester keeps what it played when a request fails, and holds no interview', async ({ page }) => {
  await startSeeded(page, 101);
  const working = fakeClient();
  let calls = 0;
  const failing: AiClient = {
    async ask(system, user, schema, effort, model) {
      calls += 1;
      if (calls > 3) throw new Error('400 Your credit balance is too low\nmore detail');
      return working.ask(system, user, schema, effort, model);
    },
  };
  const run = await playAi(page, failing, { persona: 'new-manager', until: 'end', maxDecisions: 60 });
  expect(run.steps).toHaveLength(3);
  expect(run.interviews).toEqual([]);
  expect(run.error).toBe('400 Your credit balance is too low');
  expect(run.reached).toMatch(/stopped by an error: 400 Your credit balance is too low\)$/);
  expect(calls).toBe(4);
});

// @spec PLAY-AI-002, PLAY-AI-003
test('the AI playtester moves heads in a senior manager calibration, with a fake client', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const problems = watch(page);
  let carried = false;
  for (let seed = 101; seed <= 140; seed++) {
    await startSeeded(page, seed);
    const s = await play(page, { strategy: 'sound', seed, maxWeeks: 120, until: 'seniorHandover' });
    if (s.seen.handover) {
      carried = true;
      break;
    }
  }
  expect(carried, 'a scripted run reached the senior manager').toBe(true);
  const client = fakeClient();
  // Six months reach the first review's calibration.
  const run = await playAi(page, client, { persona: 'new-manager', until: 'director', maxDecisions: 40 });
  expect(run.steps.some((s) => s.action.kind === 'calibrate'), 'a calibration was settled with a move').toBe(true);
  expect(run.steps.filter((s) => s.note), 'every fake reply was valid').toEqual([]);
  expect(problems).toEqual([]);
});
