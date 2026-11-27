import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import {
  AI_TUNING,
  NO_CREDENTIALS,
  addReading,
  checkReply,
  decide,
  decisionMessage,
  hasCredentials,
  interviewDue,
  interviewMessage,
  withHeading,
  keepNotebook,
  renderReport,
  runOptions,
  scriptQuestions,
  systemPrompt,
  type AiClient,
  type Reply,
  type Screen,
  type Promotion,
  type Step,
} from '../../playtest/ai/core';

const moment = (over: Partial<Screen> = {}): Screen => ({
  kind: 'moment',
  turn: 'Week 3',
  title: 'Quiet in the 1:1',
  text: 'Ada answers every question in the 1:1 with a word or two.',
  choices: [{ id: 'move-on', label: 'Keep the 1:1 on project status' }, { id: 'ask', label: 'Ask what would make the job worth staying for' }],
  habits: [{ id: 'oneOnOnes', label: '1:1s', options: [{ value: 'weekly', label: 'Every week' }, { value: 'fortnightly', label: 'Every other week' }], value: 'fortnightly' }],
  canWait: true,
  ...over,
});
const reply = (over: Partial<Reply> = {}, action: Partial<Reply['action']> = {}): Reply => ({
  thinkAloud: 'She seems withdrawn; I should ask.',
  feeling: 'clear',
  action: { kind: 'choose', choice: '2', place: [], fund: [], calibrate: [], ...action },
  habits: [],
  notebook: 'Quiet engineers may be flight risks.',
  ...over,
});
/** A client that answers from a list, recording what it was sent. */
function fake(answers: (Reply | null)[]): AiClient & { sent: string[]; models: string[] } {
  const sent: string[] = [];
  const models: string[] = [];
  return {
    sent,
    models,
    async ask<T>(_system: string, user: string, _schema: z.ZodType<T>, _effort: 'medium' | 'high', model: string) {
      sent.push(user);
      models.push(model);
      return (answers.shift() ?? null) as T | null;
    },
  };
}

describe('the AI playtester', () => {
  // @spec PLAY-AI-001
  it('finds credentials in an API key, a token, a named profile or a signed-in profile, and says how to provide them when there are none', () => {
    expect(hasCredentials({}, false)).toBe(false);
    expect(hasCredentials({ ANTHROPIC_API_KEY: 'k' }, false)).toBe(true);
    expect(hasCredentials({ ANTHROPIC_AUTH_TOKEN: 't' }, false)).toBe(true);
    expect(hasCredentials({ ANTHROPIC_PROFILE: 'work' }, false)).toBe(true);
    expect(hasCredentials({}, true)).toBe(true);
    expect(NO_CREDENTIALS).toMatch(/ant auth login/);
    expect(NO_CREDENTIALS).toMatch(/Nothing was sent/);
  });

  // @spec PLAY-AI-002
  it('sends only the screen’s text, its choices and habits by neutral handles, what was last read, and the notebook', () => {
    const m = decisionMessage(moment(), 'my notes', 'How week 2 went: Bo is less stressed.');
    expect(m).toContain('my notes');
    expect(m).toContain('How week 2 went');
    expect(addReading(addReading('', 'The review: meets.'), 'How week 13 went.')).toMatch(/^The review: meets\.\n[\s\S]*How week 13 went\.$/);
    expect(m).toContain('Ada answers every question');
    expect(m).toContain('- `1`: Keep the 1:1 on project status');
    expect(m).toContain('- `2`: Ask what would make the job worth staying for');
    expect(m).toContain('- `H1` (1:1s), now `2` (Every other week); settings: `1` (Every week), `2` (Every other week)');
    expect(m).toContain('You may also let this wait.');
    // never the game's ids
    for (const id of ['move-on', '`ask`', 'oneOnOnes', 'fortnightly', 'weekly`']) expect(m).not.toContain(id);
    const bets = decisionMessage(moment({ funding: { offers: [{ id: 'bo1', label: 'Atlas' }], groups: [{ id: 'g1', label: 'Payments' }] } }), '', '');
    expect(bets).toMatch(/Bets on offer:\n- `B1`: Atlas/);
    expect(bets).toMatch(/Groups that could carry one:\n- `G1`: Payments/);
    expect(bets).not.toMatch(/bo1|`g1`/);
    expect(bets).toContain('To fund bets, use the "fund" action');
    const heads = decisionMessage(moment({ placement: { heads: 2, targets: [{ id: 'group:g1', label: 'Payments' }] } }), '', '');
    expect(heads).toMatch(/- `T1`: Payments/);
    expect(heads).not.toContain('group:g1');
    expect(heads).toContain('To place them, use the "place" action');
    const cal = decisionMessage(moment({ calibration: { moves: [{ id: 't1:outstanding:exceeds', label: 'Platform: outstanding down to exceeds' }] } }), '', '');
    expect(cal).toMatch(/Calibration moves[\s\S]*`M1`: Platform: outstanding down to exceeds/);
    expect(cal).not.toContain('t1:outstanding');
    expect(bets).toContain('(empty: you have just started)');
    const promotion = decisionMessage(moment({ title: 'You have been promoted', text: 'You have been promoted\n\nWho leads Platform now?' }), '', '');
    expect(promotion.match(/You have been promoted/g)).toHaveLength(1);
    expect(withHeading({ title: 'You have been promoted', text: 'You have been promoted\n\nWho leads?' })).toBe('You have been promoted\n\nWho leads?');
    expect(systemPrompt('sceptic')).toMatch(/sceptical player/);
  });

  // @spec PLAY-AI-003
  it('accepts only what the screen offers, by its handles, and maps them back to the game’s ids', () => {
    expect(checkReply(moment(), reply())).toMatchObject({ ok: true, action: { kind: 'choose', choiceId: 'ask' } });
    // a handle not on the screen, or the game's id, is refused, naming the handles
    const shout = checkReply(moment(), reply({}, { choice: '3' }));
    expect(shout).toMatchObject({ ok: false, reason: expect.stringContaining('1, 2') });
    expect(shout.ok === false && shout.reason).not.toMatch(/move-on|ask/);
    expect(checkReply(moment(), reply({}, { choice: 'ask' })).ok).toBe(false);
    expect(checkReply(moment({ canWait: false }), reply({}, { kind: 'wait', choice: '' })).ok).toBe(false);
    const badSetting = checkReply(moment(), reply({ habits: [{ habit: 'H1', value: '3' }] }));
    expect(badSetting.ok === false && badSetting.reason).toMatch(/1, 2/);
    expect(badSetting.ok === false && badSetting.reason).not.toMatch(/weekly|fortnightly/);
    expect(checkReply(moment(), reply({ habits: [{ habit: 'oneOnOnes', value: '1' }] })).ok).toBe(false);
    expect(checkReply(moment(), reply({ habits: [{ habit: 'H1', value: '1' }] }))).toMatchObject({ ok: true, habits: [{ habit: 'oneOnOnes', value: 'weekly' }] });
    const heads = moment({ placement: { heads: 3, targets: [{ id: 'group:g1', label: 'Payments' }, { id: 'group:g2', label: 'Search' }] } });
    expect(checkReply(heads, reply({}, { kind: 'place', choice: '', place: [{ target: 'T1', count: 2 }, { target: 'T2', count: 1 }] }))).toMatchObject({ ok: true, action: { kind: 'place', place: { 'group:g1': 2, 'group:g2': 1 } } });
    expect(checkReply(heads, reply({}, { kind: 'place', choice: '', place: [{ target: 'T1', count: 4 }] })).ok).toBe(false);
    expect(checkReply(heads, reply({}, { kind: 'place', choice: '', place: [{ target: 'T9', count: 1 }] })).ok).toBe(false);
    const calibration = moment({ calibration: { moves: [{ id: 't1:outstanding:exceeds', label: 'Platform: outstanding down to exceeds' }, { id: 't1:meets:exceeds', label: 'Platform: meets up to exceeds' }] } });
    expect(checkReply(calibration, reply({}, { kind: 'calibrate', choice: '', calibrate: [{ move: 'M1', count: 2 }] }))).toMatchObject({ ok: true, action: { kind: 'calibrate', calibrate: { 't1:outstanding:exceeds': 2 } } });
    expect(checkReply(calibration, reply({}, { kind: 'calibrate', choice: '', calibrate: [] }))).toMatchObject({ ok: true, action: { kind: 'calibrate', calibrate: {} } });
    expect(checkReply(calibration, reply({}, { kind: 'calibrate', choice: '', calibrate: [{ move: 'M9', count: 1 }] })).ok).toBe(false);
    expect(checkReply(calibration, reply({}, { kind: 'calibrate', choice: '', calibrate: [{ move: 'M2', count: 0 }] })).ok).toBe(false);
    expect(checkReply(moment(), reply({}, { kind: 'calibrate', choice: '', calibrate: [] })).ok, 'no calibration on this screen').toBe(false);
    const bets = moment({ funding: { offers: [{ id: 'bo1', label: 'A' }, { id: 'bo2', label: 'B' }, { id: 'bo3', label: 'C' }], groups: [{ id: 'g1', label: 'P' }] } });
    expect(checkReply(bets, reply({}, { kind: 'fund', choice: '', fund: [{ bet: 'B1', group: 'G1' }] }))).toMatchObject({ ok: true, action: { kind: 'fund', fund: { bo1: 'g1' } } });
    expect(checkReply(bets, reply({}, { kind: 'fund', choice: '', fund: [{ bet: 'B1', group: 'G1' }, { bet: 'B2', group: 'G1' }, { bet: 'B3', group: 'G1' }] })).ok).toBe(false);
    expect(checkReply(bets, reply({}, { kind: 'fund', choice: '', fund: [{ bet: 'bo1', group: 'G1' }] })).ok).toBe(false);
    expect(checkReply(moment(), reply({}, { kind: 'fund', choice: '', fund: [] })).ok).toBe(false);
  });

  // @spec PLAY-AI-003, PLAY-AI-004, PLAY-AI-009
  it('sends an invalid reply back once with the reason, then lets the moment wait, and treats a refused reply as invalid', async () => {
    const good = fake([reply({}, { choice: '7' }), reply()]);
    const r = await decide(good, 'sys', moment(), 'old', '', AI_TUNING.models.sonnet);
    expect(good.models).toEqual([AI_TUNING.models.sonnet, AI_TUNING.models.sonnet]);
    // the action is recorded by the game's ids
    expect(r.action).toEqual({ kind: 'choose', choiceId: 'ask' });
    expect(r.notebook).toBe('Quiet engineers may be flight risks.');
    expect(good.sent[1]).toMatch(/could not be acted on: There is no choice "7"/);
    expect(good.sent[1]).not.toMatch(/move-on/);
    const bad = await decide(fake([null, reply({}, { choice: '7' })]), 'sys', moment(), 'old', '');
    expect(bad).toMatchObject({ reply: null, action: { kind: 'wait' }, notebook: 'old', note: expect.any(String) });
    const cannotWait = await decide(fake([null, null]), 'sys', moment({ canWait: false }), 'old', '');
    expect(cannotWait.action).toEqual({ kind: 'choose', choiceId: 'move-on' });
  });

  // @spec PLAY-AI-004
  it('keeps the notebook to its longest length', () => {
    const long = Array.from({ length: AI_TUNING.notebookWords + 50 }, (_, i) => `w${i}`).join(' ');
    expect(keepNotebook(long).split(' ')).toHaveLength(AI_TUNING.notebookWords);
    expect(keepNotebook('  short notes  ')).toBe('short notes');
  });

  // @spec PLAY-AI-006
  it('asks the human script’s questions for the metrics reached, under its headings', () => {
    const questions = scriptQuestions(readFileSync(new URL('../../playtest/HUMAN.md', import.meta.url), 'utf8'));
    expect(questions.map((q) => q.heading)).toEqual(expect.arrayContaining(['A promotion in the first session', 'Promotion changes the job', 'Skill can be learned']));
    for (const q of questions) expect(q.questions.length).toBeGreaterThan(0);
    const unpromoted = interviewMessage(questions, [], 'notes', ['first thought']);
    expect(unpromoted).not.toContain('### Promotion changes the job');
    expect(unpromoted).not.toContain('You were promoted');
    expect(unpromoted).toContain('1. first thought');
    const promoted = interviewMessage(questions, [{ title: 'You are now a senior manager', text: 'Three teams report to you.' }], 'notes', []);
    expect(promoted).toContain('### Promotion changes the job');
    expect(promoted).toMatch(/You were promoted[\s\S]*You are now a senior manager\nThree teams report to you\./);
  });

  // @spec PLAY-AI-006
  it('holds the interview after a promotion until the new level’s first turns are played', () => {
    expect(interviewDue(undefined, 'Week 9')).toBe(false);
    const p: Promotion = { title: 'Senior', text: '', turns: [], interviewed: false };
    const turns = Array.from({ length: AI_TUNING.turnsAfterPromotion }, (_, i) => `Month ${i + 1}`);
    for (const t of turns) {
      expect(interviewDue(p, t)).toBe(false);
      expect(interviewDue(p, t), 'a second decision in the same turn').toBe(false);
    }
    expect(interviewDue(p, `Month ${AI_TUNING.turnsAfterPromotion + 1}`)).toBe(true);
    p.interviewed = true;
    expect(interviewDue(p, 'Month 9')).toBe(false);
  });

  // @spec PLAY-AI-007
  it('writes a report opening with the run, then the interview, then the notable moments', () => {
    const steps: Step[] = [
      { n: 1, turn: 'Week 1', title: 'Quiet in the 1:1', screen: '', reply: reply(), action: { kind: 'choose', choiceId: 'ask' }, better: 'ask' },
      { n: 2, turn: 'Week 2', title: 'Scope creep', screen: '', reply: reply({ feeling: 'confused', thinkAloud: 'What does trade mean here?' }), action: { kind: 'choose', choiceId: 'say-yes' }, better: 'trade' },
    ];
    const report = renderReport(
      { version: 'v0.1.99 (abc1234)', persona: 'new-manager', seed: 101, model: 'claude-opus-5-5', reached: 'promoted to senior manager', requests: 3, tokens: { input: 1000, output: 200, cacheRead: 800, cacheWrite: 100 } },
      [{ when: 'after the first promotion', interview: { answers: [{ heading: 'Promotion changes the job', answer: 'I stopped doing night pages.' }] } }],
      steps,
    );
    const at = (s: string) => report.indexOf(s);
    expect(at('v0.1.99 (abc1234)')).toBeGreaterThan(0);
    expect(report).toMatch(/language model, not a person/);
    expect(at('## Interview: after the first promotion')).toBeLessThan(at('## Notable moments'));
    expect(report).toContain('I stopped doing night pages.');
    expect(report).toMatch(/2\. Week 2, Scope creep\*\* \(confused; chose say-yes, not trade\): What does trade mean here\?/);
    expect(report).not.toMatch(/1\. Week 1, Quiet/);
  });

  // @spec PLAY-AI-008
  it('plays one persona to the first promotion by default, and takes options for the rest', () => {
    expect(runOptions({})).toEqual({ persona: 'new-manager', seed: 101, until: 'promotion', maxDecisions: AI_TUNING.maxDecisions.promotion, decisionModel: AI_TUNING.models.opus });
    expect(runOptions({ AI_PERSONA: 'sceptic', AI_SEED: '7', AI_UNTIL: 'director', AI_MAX_DECISIONS: '50', AI_MODEL: 'sonnet' })).toEqual({ persona: 'sceptic', seed: 7, until: 'director', maxDecisions: 50, decisionModel: AI_TUNING.models.sonnet });
    for (const bad of [{ AI_PERSONA: 'robot' }, { AI_UNTIL: 'forever' }, { AI_SEED: '-1' }, { AI_MAX_DECISIONS: '0' }, { AI_MODEL: 'gpt' }]) expect(() => runOptions(bad)).toThrow();
  });
});
