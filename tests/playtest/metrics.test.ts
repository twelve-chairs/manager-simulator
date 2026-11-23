import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLOCK, formatScorecard, momentKind, scoreRun, scorecard, type Level, type Look, type PlayEvent } from '../../playtest/metrics';
import { directorLevel } from '../../src/levels/director';
import { advance } from '../../src/sim';
import { director } from '../levels/director/fixtures';
import { realContent } from '../balance/harness';
import { playSeniorRun, type SeniorStrategy } from '../balance/senior';
import { SENIOR_STRATEGIES } from '../balance/senior-strategies';

/** Builders for the event log a scripted player records from the screen. */
const person = (name: string, motivation = 'fine', stress = 'steady', memory: string[] = []) => ({ name, motivation, stress, memory });
const look = (week: number, over: Partial<Omit<Look, 'kind' | 'week'>> = {}): Look => ({
  kind: 'look',
  week,
  people: over.people ?? [person('Ada')],
  projects: over.projects ?? [],
  energy: over.energy ?? 'good',
  burnout: over.burnout ?? false,
});
const read = (words: number): PlayEvent => ({ kind: 'read', words });
const click = (decision = false): PlayEvent => ({ kind: 'click', decision });
const moment = (week: number, title: string, level: Level = 'line'): PlayEvent => ({ kind: 'moment', week, title, level });
const layout = (level: Level, panels: string[], habits: string[]): PlayEvent => ({ kind: 'layout', level, panels, habits });
const answer = (week: number, title: string, reaction: string | null = 'They nod.', chips: string[] = [], notes: { name: string; note: string }[] = []): PlayEvent => ({
  kind: 'answer',
  week,
  title,
  reaction,
  chips,
  notes,
});
const wait = (week: number): PlayEvent => ({ kind: 'wait', week });
const review = (week: number, rating: string, promoted = false): PlayEvent => ({ kind: 'review', week, rating, promoted });
const ended = (ending: string, left: { name: string; reason: string }[] = []): PlayEvent => ({ kind: 'ended', ending, left });

describe('the session clock', () => {
  // @spec PLAY-CLOCK-001, PLAY-CLOCK-002, PLAY-CLOCK-003
  it('adds reading at 230 words a minute, 4 seconds a decision and 1 second for every other click', () => {
    expect(CLOCK).toEqual({ wordsPerMinute: 230, decisionSeconds: 4, clickSeconds: 1 });
    const card = scoreRun(1, [read(230), click(true), click(true), click(), read(115), ended('done')]);
    expect(card.minutes).toBeCloseTo(1 + 8 / 60 + 1 / 60 + 0.5, 6);
  });
});

describe('a promotion in the first session', () => {
  // @spec PLAY-PROMO-001
  it('records the estimated time at the first review that promotes', () => {
    const card = scoreRun(1, [read(230 * 10), review(52, 'exceeds', true), read(230 * 5), review(65, 'exceeds', true), ended('won')]);
    expect(card.promotedAtMinutes).toBeCloseTo(10, 6);
  });

  // @spec PLAY-PROMO-002
  it('records a run that ends without a promotion as not promoted', () => {
    expect(scoreRun(1, [read(230), review(13, 'meets'), ended('stayed')]).promotedAtMinutes).toBeNull();
  });

  // @spec PLAY-PROMO-003
  it('reports the share promoted within 60 minutes beside the target share, failing no check', () => {
    const quick = scoreRun(1, [read(230 * 50), review(52, 'exceeds', true), ended('won')]);
    const slow = scoreRun(2, [read(230 * 70), review(52, 'exceeds', true), ended('won')]);
    const never = scoreRun(3, [read(230), ended('stayed')]);
    const card = scorecard('first-timer', [quick, slow, never]);
    expect(card.promotion).toEqual({ withinSession: 1 / 3, target: 0.5, sessionMinutes: 60 });
    expect(card.checks.every((c) => c.passed)).toBe(true);
  });
});

describe('bad outcomes can be traced', () => {
  // @spec PLAY-TRACE-001
  it('records whether the card of someone who quit showed a worse-half band in its last four weeks on screen', () => {
    const events = [
      look(1, { people: [person('Ada', 'flat'), person('Bo')] }),
      look(2, { people: [person('Ada'), person('Bo')] }),
      look(3, { people: [person('Ada'), person('Bo')] }),
      look(4, { people: [person('Ada'), person('Bo')] }),
      look(5, { people: [person('Ada', 'fine', 'steady', ['Took on a design review']), person('Bo', 'fine', 'strained')] }),
      look(6, { people: [] }),
      ended('stayed', [{ name: 'Ada', reason: 'quit' }, { name: 'Bo', reason: 'quit' }, { name: 'Cy', reason: 'let go' }]),
    ];
    const card = scoreRun(7, events);
    // Ada's flat week fell out of her last four weeks on screen, and a memory note is no warning; Bo was strained.
    expect(card.trace.quits).toEqual([{ name: 'Ada', warned: false }, { name: 'Bo', warned: true }]);
    // The simulation lets anyone quit, so a quit with no warning is reported, never a failure.
    expect(scorecard('sound', [card]).checks.every((c) => c.passed)).toBe(true);
  });

  // @spec PLAY-TRACE-001
  it('looks only at the weeks a young run has had', () => {
    const card = scoreRun(1, [look(1, { people: [person('Ada', 'struggling')] }), look(2, { people: [] }), ended('x', [{ name: 'Ada', reason: 'quit' }])]);
    expect(card.trace.quits).toEqual([{ name: 'Ada', warned: true }]);
  });

  // @spec PLAY-TRACE-002
  it('records whether a low rating followed a project behind or a person in the worse half', () => {
    const card = scoreRun(1, [
      look(10, { projects: [{ name: 'Search', schedule: 'behind', risk: 'low' }] }),
      look(13),
      review(13, 'partial'),
      look(26),
      review(26, 'below'),
      look(39),
      review(39, 'meets'),
      ended('x'),
    ]);
    // A review's window is its own week and the three before: week 10 warns of week 13's rating, not week 26's.
    expect(card.trace.lowRatings).toEqual([{ week: 13, warned: true }, { week: 26, warned: false }]);
  });

  // @spec PLAY-TRACE-003
  it('records whether a project was behind or at risk before it was first shown overdue', () => {
    const card = scoreRun(1, [
      look(3, { projects: [{ name: 'Search', schedule: 'on schedule', risk: 'elevated' }, { name: 'Billing', schedule: 'on schedule', risk: 'low' }] }),
      look(4, { projects: [{ name: 'Search', schedule: 'overdue', risk: 'elevated' }, { name: 'Billing', schedule: 'overdue', risk: 'low' }] }),
      look(5, { projects: [{ name: 'Search', schedule: 'overdue', risk: 'elevated' }] }),
      ended('x'),
    ]);
    expect(card.trace.overdue).toEqual([{ name: 'Search', week: 4, warned: true }, { name: 'Billing', week: 4, warned: false }]);
  });

  // @spec PLAY-TRACE-004
  it('records whether energy showed tired or running on fumes before the first burnout warning', () => {
    const warned = scoreRun(1, [look(1, { energy: 'tired' }), look(2, { energy: 'at the edge', burnout: true }), look(3, { burnout: true }), ended('x')]);
    expect(warned.trace.burnout).toEqual({ week: 2, warned: true });
    const sudden = scoreRun(1, [look(1, { energy: 'good' }), look(2, { energy: 'at the edge', burnout: true }), ended('x')]);
    expect(sudden.trace.burnout).toEqual({ week: 2, warned: false });
    expect(scoreRun(1, [look(1), ended('x')]).trace.burnout).toBeNull();
  });

  // @spec PLAY-TRACE-005
  it('reports the share of quits, low ratings, overdue projects and burnout warnings that had a warning sign', () => {
    const a = scoreRun(1, [look(13, { people: [person('Ada', 'flat')] }), review(13, 'below'), look(26), review(26, 'partial'), ended('x')]);
    const b = scoreRun(2, [look(1, { energy: 'tired' }), look(2, { burnout: true, people: [] }), ended('x', [{ name: 'Ada', reason: 'quit' }])]);
    const card = scorecard('first-timer', [a, b]);
    expect(card.trace).toEqual({ quits: 0, lowRatings: 0.5, overdue: null, burnout: 1 });
  });
});

describe('choices feel consequential', () => {
  // @spec PLAY-CHOICE-001
  it('fails an answered moment not followed at once by a reaction with text', () => {
    const card = scoreRun(3, [answer(1, 'Check-in: Ada'), answer(1, 'Night page: Bo', null), answer(2, 'Scope creep', '  '), ended('x')]);
    const check = scorecard('sound', [card]).checks.find((c) => c.id === 'PLAY-CHOICE-001')!;
    expect(check.passed).toBe(false);
    expect(check.failures).toEqual(['seed 3, week 1: Night page: Bo had no reaction', 'seed 3, week 2: Scope creep had no reaction']);
  });

  // @spec PLAY-CHOICE-002
  it('reports the share of answered moments whose reaction showed a chip', () => {
    const card = scoreRun(1, [answer(1, 'A', 'Ok.', ['Ada: less stressed']), answer(1, 'B'), answer(2, 'C', 'Ok.', ['You: less energy', 'Ada: more motivated']), answer(2, 'D'), ended('x')]);
    expect(card.choices.withChip).toBe(0.5);
  });

  // @spec PLAY-CHOICE-003
  it('reports the share of notes a choice added that are still on the card two weeks later', () => {
    const card = scoreRun(1, [
      answer(1, 'A', 'Ok.', [], [{ name: 'Ada', note: 'Took on a design review' }, { name: 'Bo', note: 'Struggled through an incident' }]),
      answer(1, 'B', 'Ok.', [], [{ name: 'Cy', note: 'Was thanked' }]),
      look(3, { people: [person('Ada', 'fine', 'steady', ['Took on a design review, twice']), person('Bo', 'fine', 'steady', ['Had a 1:1'])] }),
      ended('x'),
    ]);
    // Cy was not on screen two weeks later, so their note is left out rather than counted as lost.
    expect(card.choices.notesKept).toBe(0.5);
  });
});

describe('the shape of a session', () => {
  const events: PlayEvent[] = [
    look(1),
    moment(1, 'Check-in: Ada'),
    answer(1, 'Check-in: Ada'),
    moment(1, 'Check-in: Bo'),
    wait(1),
    moment(1, 'Scope creep'),
    answer(1, 'Scope creep', 'They nod.'),
    look(2),
    look(3),
    moment(3, 'Night page: Bo'),
    answer(3, 'Night page: Bo', 'They nod.'),
    moment(15, 'Scope creep'),
    answer(15, 'Scope creep', 'They sigh.'),
    moment(29, 'Scope creep'),
    answer(29, 'Scope creep', 'They sigh.'),
    ended('x'),
  ];
  const card = scoreRun(1, events);

  // @spec PLAY-SHAPE-001
  it('reports decisions per week: the mean, the fewest, the most and the share of weeks with none', () => {
    // Weeks 1 to 29 were played: week 1 had three decisions, weeks 3, 15 and 29 one each, the other 25 none.
    expect(card.shape.decisions).toEqual({ mean: 6 / 29, fewest: 0, most: 3, weeksWithNone: 25 / 29 });
  });

  // @spec PLAY-SHAPE-002
  it('reports the longest run of moments of one kind, a level moment by its title before the colon', () => {
    expect(card.shape.longestSameKind).toBe(2);
  });

  // @spec PLAY-SHAPE-002
  it('reads a senior manager moment’s kind from its title’s fixed wording, around the names it carries', () => {
    const r = scoreRun(1, [moment(1, 'Ada needs help', 'senior'), moment(1, 'Bo needs help', 'senior'), moment(5, 'Cy needs help', 'senior'), moment(9, 'Calibration', 'senior'), ended('x')]);
    expect(r.shape.longestSameKind).toBe(3);
    // level moments that come back are not situation repeats
    expect(scoreRun(1, [moment(1, 'A staffing request', 'senior'), moment(5, 'A staffing request', 'senior'), ended('x')]).shape.situationRepeats).toBe(0);
  });

  // @spec PLAY-SHAPE-002
  it('tells a career level’s moments from situations by the level they came at', () => {
    expect(momentKind('Check-in: Ada', 'line')).toBe('Check-in');
    expect(momentKind('release approval', 'line')).toBe('release approval');
    // the line manager's calibration is a situation; the senior manager's is the level's own scene
    expect(momentKind('Calibration', 'line')).toBeNull();
    expect(momentKind('Calibration', 'senior')).toBe('Calibration');
    expect(momentKind('Ada needs help', 'senior')).toBe('Escalation');
    expect(momentKind('Platform and Payments disagree', 'senior')).toBe('Dispute');
    expect(momentKind('Final evaluation: Ada', 'senior')).toBe('Final evaluation');
    expect(momentKind('Running hot', 'senior')).toBeNull();
    expect(momentKind('Check-in: Ada', 'senior')).toBeNull();
  });

  // @spec PLAY-SHAPE-002, PLAY-JOB-001
  it('recognises every senior manager moment the level produces, and no senior situation', () => {
    const content = realContent();
    const level = new Set<string>();
    const situations = new Set<string>();
    for (const base of SENIOR_STRATEGIES) {
      const spy: SeniorStrategy = { ...base, choose: (seen, m) => ((m.source === 'level' ? level : situations).add(m.title), base.choose(seen, m)) };
      for (const seed of [1, 2, 3, 4]) playSeniorRun(spy, seed, content);
    }
    expect([...level].filter((t) => momentKind(t, 'senior') === null)).toEqual([]);
    expect([...situations].filter((t) => momentKind(t, 'senior') !== null)).toEqual([]);
    const kinds = new Set([...level].map((t) => momentKind(t, 'senior')));
    for (const k of ['Escalation', 'Staffing request', 'Dispute', 'Approval', 'Calibration']) expect(kinds).toContain(k);
  }, 120_000);

  // @spec PLAY-SHAPE-002
  it('reads a director moment’s kind from its title’s fixed wording', () => {
    expect(momentKind('Headcount for the quarter', 'director')).toBe('Headcount');
    expect(momentKind('Payments is in trouble', 'director')).toBe('Group in trouble');
    expect(momentKind('The quarterly review', 'director')).toBe('Quarterly review');
    expect(momentKind('Ada needs help', 'director')).toBeNull();
    expect(momentKind('Headcount for the quarter', 'senior')).toBeNull();
  });

  // @spec PLAY-SHAPE-002, PLAY-JOB-001
  it('recognises every director moment the level produces', () => {
    const kinds = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let { level, sim } = director(seed);
      for (let q = 0; q < 6; q++) {
        level = directorLevel.beginWeek(level, sim);
        for (const m of level.moments) {
          expect(momentKind(m.title, 'director'), m.title).not.toBeNull();
          kinds.add(momentKind(m.title, 'director')!);
        }
        const end = directorLevel.endWeek(level, sim);
        if (!end.ok) throw new Error(end.error);
        level = directorLevel.afterAdvance(end.level, advance(end.sim, 13).state).level;
        sim = advance(end.sim, 13).state;
      }
    }
    for (const k of ['Headcount', 'Strategy bets', 'Quarterly review']) expect(kinds).toContain(k);
  });

  // @spec PLAY-SHAPE-003
  it('counts situations shown again within 13 weeks of last being shown', () => {
    // Week 15 is 14 weeks after week 1; week 29 is 14 after week 15.
    expect(card.shape.situationRepeats).toBe(0);
    expect(scoreRun(1, [moment(1, 'Scope creep'), moment(14, 'Scope creep'), moment(20, 'Tech debt'), ended('x')]).shape.situationRepeats).toBe(1);
  });

  // @spec PLAY-SHAPE-004
  it('reports the share of reaction texts that are distinct', () => {
    expect(card.shape.distinctReactions).toBe(2 / 5);
  });
});

describe('promotion changes the job', () => {
  const LINE_PANELS = ['Your team', 'Projects', 'Your habits'];
  const SENIOR_PANELS = ['Your managers', 'Your habits'];
  const promoted = (seed: number, extraSenior: string[] = []) =>
    scoreRun(seed, [
      layout('line', LINE_PANELS, ['Night pages', '1:1s', 'Growth focus']),
      moment(1, 'Check-in: Ada'),
      moment(2, 'Night page: Bo'),
      moment(3, 'Final evaluation: Cy'),
      moment(4, 'Calibration'),
      review(39, 'exceeds', true),
      layout('senior', SENIOR_PANELS, ['Oversight', '1:1s with your managers', 'Skip-level listening']),
      moment(40, 'Ada needs help', 'senior'),
      moment(44, 'Final evaluation: Bo', 'senior'),
      moment(48, 'Running hot', 'senior'),
      ...extraSenior.map((t) => moment(52, t, 'senior')),
      ended('x'),
    ]);

  // @spec PLAY-JOB-001
  it('lists, per promoted run, the panels, habits and level moments that stopped and started appearing', () => {
    expect(promoted(1).jobs).toEqual([{
      from: 'line',
      to: 'senior',
      gone: { panels: ['Projects', 'Your team'], habits: ['1:1s', 'Growth focus', 'Night pages'], moments: ['Check-in', 'Night page'] },
      came: { panels: ['Your managers'], habits: ['1:1s with your managers', 'Oversight', 'Skip-level listening'], moments: ['Escalation'] },
    }]);
    // a run that never left its first level has nothing to compare
    expect(scoreRun(2, [layout('line', LINE_PANELS, ['1:1s']), moment(1, 'Check-in: Ada'), ended('x')]).jobs).toEqual([]);
  });

  // @spec PLAY-JOB-001
  it('lists each promotion a run reaches, the second from senior manager to director', () => {
    const twice = scoreRun(4, [
      layout('line', LINE_PANELS, ['1:1s']),
      layout('senior', SENIOR_PANELS, ['Oversight']),
      moment(40, 'Ada needs help', 'senior'),
      layout('director', ['Your senior managers', 'Above and beside you', 'Your bets', 'Your habits'], ['Where your time goes']),
      moment(80, 'Headcount for the quarter', 'director'),
      ended('x'),
    ]);
    expect(twice.jobs.map((j) => [j.from, j.to])).toEqual([['line', 'senior'], ['senior', 'director']]);
    expect(twice.jobs[1]!.came.moments).toEqual(['Headcount']);
    expect(twice.jobs[1]!.gone.moments).toEqual(['Escalation']);
    expect(twice.jobs[1]!.gone.panels).toEqual(['Your managers']);
  });

  // @spec PLAY-JOB-002
  it('reports each change across promoted runs with the number of runs it happened in, failing no check', () => {
    const card = scorecard('sound', [promoted(1), promoted(2, ['Calibration']), scoreRun(3, [layout('line', LINE_PANELS, []), ended('x')])]);
    expect(card.jobs[0]).toMatchObject({ from: 'line', to: 'senior', runs: 2 });
    expect(card.jobs[0]!.came.moments).toEqual([
      { name: 'Escalation', runs: 2 },
      { name: 'Calibration', runs: 1 },
    ]);
    expect(card.jobs[0]!.gone.panels).toEqual([
      { name: 'Projects', runs: 2 },
      { name: 'Your team', runs: 2 },
    ]);
    expect(card.checks.map((c) => c.id)).toEqual(['PLAY-CHOICE-001']);
    const table = formatScorecard(card);
    expect(table).toMatch(/Promotion changes the job\n {2}line manager to senior manager: 2 of 3 runs/);
    expect(table).toMatch(/no longer.*Your team \(2\)/);
    expect(table).toMatch(/new.*Escalation \(2\), Calibration \(1\)/);
  });
});

describe('skill can be learned', () => {
  // @spec PLAY-SKILL-001
  it('reports the average review rating, counted below 0 to outstanding 4', () => {
    const a = scoreRun(1, [review(13, 'below'), review(26, 'meets'), ended('x')]);
    const b = scoreRun(2, [review(13, 'outstanding'), ended('x')]);
    expect(scorecard('sound', [a, b]).averageRating).toBe(2);
  });
});

describe('the scorecard', () => {
  // @spec PLAY-CARD-001
  it('prints one row per run with its seed and ending, the measures under each heading and each hard check', () => {
    const run = scoreRun(11, [read(230), look(1), moment(1, 'Check-in: Ada'), answer(1, 'Check-in: Ada', 'Ok.', ['Ada: less stressed']), review(13, 'meets'), ended('You stayed a line manager.')]);
    const card = scorecard('sound', [run]);
    expect(card.runs[0]).toMatchObject({ seed: 11, ending: 'You stayed a line manager.' });
    expect(card.checks.map((c) => c.id)).toEqual(['PLAY-CHOICE-001']);
    const table = formatScorecard(card);
    for (const heading of ['A promotion in the first session', 'Bad outcomes can be traced', 'Choices feel consequential', 'The shape of a session', 'Promotion changes the job', 'Skill can be learned']) {
      expect(table).toContain(heading);
    }
    expect(table).toMatch(/seed 11 .*You stayed a line manager\./);
    expect(table).toMatch(/PLAY-CHOICE-001 +passed/);
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
  });
});

describe('the human script', () => {
  const script = readFileSync(new URL('../../playtest/HUMAN.md', import.meta.url), 'utf8');
  const HEADINGS = ['A promotion in the first session', 'Bad outcomes can be traced', 'Choices feel consequential', 'It feels like a game', 'Promotion changes the job', 'Skill can be learned'];

  // @spec PLAY-HUMAN-001
  it('has a setup section and, for each success metric, what to watch for and questions to ask', () => {
    expect(script).toMatch(/^## Setup$/m);
    for (const heading of HEADINGS) {
      const section = script.split(new RegExp(`^### ${heading}.*$`, 'm'))[1]?.split(/^##+ /m)[0] ?? '';
      expect(section, heading).toMatch(/Watch for/);
      expect(section, heading).toMatch(/Ask afterwards/);
    }
  });

  // @spec PLAY-HUMAN-002
  it('has a record sheet with the version and a space for each success metric', () => {
    const sheet = script.split(/^## Record sheet$/m)[1] ?? '';
    expect(sheet).toMatch(/Version/);
    for (const heading of HEADINGS) expect(sheet).toContain(heading);
  });
});
