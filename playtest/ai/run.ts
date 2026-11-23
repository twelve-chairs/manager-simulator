import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { betterByTitle } from '../harness';
import { InterviewSchema, decide, interviewMessage, scriptQuestions, systemPrompt, type AiClient, type Interview, type Persona, type Step } from './core';
import { act, moveOn, readPage } from './page';

export interface AiRun {
  reached: string;
  steps: Step[];
  interviews: { when: string; interview: Interview }[];
}

/**
 * Plays the page from wherever it is: a decision on every screen that asks for one, the other clicks made without a
 * request, and the interview at each promotion and at the end. Stops at the run's end, at the promotion `until` asks
 * for, or at the decision limit.
 */
// @spec PLAY-AI-002, PLAY-AI-004, PLAY-AI-005, PLAY-AI-006, PLAY-AI-008
export async function playAi(page: Page, client: AiClient, options: { persona: Persona; until: 'promotion' | 'director' | 'end'; maxDecisions: number }): Promise<AiRun> {
  const system = systemPrompt(options.persona);
  const questions = scriptQuestions(readFileSync(new URL('../HUMAN.md', import.meta.url), 'utf8'));
  const better = betterByTitle();
  let notebook = '';
  let lastRead = '';
  let promotions = 0;
  let reached = 'line manager';
  const steps: Step[] = [];
  const interviews: AiRun['interviews'] = [];
  const interview = async (when: string) => {
    const thoughts = steps.flatMap((s) => (s.reply ? [`${s.turn}, ${s.title}: ${s.reply.thinkAloud}`] : []));
    const answers = await client.ask(system, interviewMessage(questions, promotions > 0, notebook, thoughts), InterviewSchema, 'high');
    interviews.push({ when, interview: answers ?? { answers: [{ heading: '(no answer)', answer: 'The interview reply could not be read.' }] } });
  };

  let stopped = '';
  for (let guard = 0; guard < 20_000 && !stopped; guard++) {
    const state = await readPage(page);
    if (state.screen === 'ended') {
      reached += ` (the run ended: ${(await page.locator('[data-field=ending]').textContent()) ?? ''})`;
      stopped = 'ended';
      break;
    }
    if (state.reading) lastRead = state.reading;
    const screen = state.decision;
    if (!screen) {
      if (!(await moveOn(page, state))) throw new Error(`stuck on screen "${state.screen}", scene "${state.scene}"`);
      continue;
    }
    if (screen.kind === 'handover') {
      promotions += 1;
      reached = /director/i.test(screen.title) ? 'promoted to director' : 'promoted to senior manager';
      await interview(promotions === 1 ? 'after the first promotion' : 'after the second promotion');
      if ((options.until === 'promotion' && promotions >= 1) || (options.until === 'director' && /director/i.test(screen.title))) {
        stopped = 'reached';
        break;
      }
    }
    if (steps.length >= options.maxDecisions) {
      reached += ` (stopped at the limit of ${options.maxDecisions} decisions)`;
      stopped = 'limit';
      break;
    }
    const d = await decide(client, system, screen, notebook, lastRead);
    lastRead = '';
    notebook = d.notebook;
    steps.push({ n: steps.length + 1, turn: screen.turn, title: screen.title, screen: screen.text, reply: d.reply, action: d.action, ...(better[screen.title] && { better: better[screen.title] }), ...(d.note && { note: d.note }) });
    await act(page, screen, d.action, d.habits);
  }
  if (stopped !== 'reached') await interview('at the end of the run');
  return { reached, steps, interviews };
}
