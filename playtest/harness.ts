import { expect, type Page, type TestInfo } from '@playwright/test';
import { realContent } from '../tests/balance/harness';
import { BETTER_CHOICES } from '../tests/balance/strategies';
import { DIRECTOR_TITLES, LINE_TITLES, SENIOR_TITLES, VP_TITLES, type Level, type Look, type PlayEvent } from './metrics';

/** The save the game keeps in the browser's storage, and its format, as the save component writes them. */
const SAVE_KEY = 'manager-simulator.save';

/** Collects what the page reports while a test runs: errors, policy violations, and requests to other origins. */
export function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('request', (r) => {
    const base = new URL(page.url() || 'about:blank');
    const url = new URL(r.url());
    if (base.origin !== 'null' && url.origin !== base.origin && url.protocol !== 'data:' && url.protocol !== 'blob:') problems.push(`request to another origin: ${r.url()}`);
  });
  return problems;
}

/**
 * Opens the game on a new run from a fixed seed, so a failure can be played again exactly: it reads the content
 * fingerprint from a save the game writes, then stores a save with the seed and no commands and reloads.
 */
export async function startSeeded(page: Page, seed: number) {
  await page.goto('./');
  await page.evaluate((key) => localStorage.removeItem(key), SAVE_KEY);
  await page.goto('./');
  await page.locator('[data-action=begin]').click();
  const content = await page.evaluate((key) => (JSON.parse(localStorage.getItem(key) ?? '{}') as { content?: unknown }).content, SAVE_KEY);
  expect(content, 'the game saved a run, so its content fingerprint can be read').toBeTruthy();
  await page.evaluate(
    ({ key, save }) => localStorage.setItem(key, JSON.stringify(save)),
    { key: SAVE_KEY, save: { format: 'manager-simulator-save', version: 2, seed, content, commands: [] } },
  );
  await page.goto('./');
  await expect(page.locator('[data-scene]')).toHaveAttribute('data-scene', 'before-monday');
}

export type Strategy = 'sound' | 'delegate' | 'hero' | 'decline' | 'waiter' | 'mixed' | 'heavyThenEase';
export type Until = 'end' | 'finalEvaluation' | 'letGoWarning' | 'review' | 'edgeWarning' | 'seniorHandover' | 'directorHandover' | 'vpHandover';

export interface PlayOptions {
  strategy: Strategy;
  /** Seeds the scripted player's own randomness, for the strategies that have any. */
  seed: number;
  until?: Until;
  /** Stops after this many weeks, at the latest. */
  maxWeeks?: number;
}

export interface PlaySummary {
  ending: string | null;
  stoppedAt: string | null;
  weeks: number;
  reviews: { week: string; rating: string; ceiling: string | null; outcome: string }[];
  career: string[];
  violations: string[];
  seen: {
    finalEvaluations: { title: string; choices: string[] }[];
    letGoWarnings: string[];
    assigned: string[];
    held: string[];
    edgeWarnings: string[];
    waitedLessons: number;
    waitedWithoutLesson: string[];
    endings: string[];
    /** The handover, if the run reached one: what was offered and what the player chose. */
    handover: { choice: string; options: { id: string; trust: string; want: string | null }[] } | null;
    /** Each senior manager moment: the choices offered and the one taken ('settle' for calibration settled on the evidence, null for waiting). */
    seniorChoices: { title: string; offered: string[]; chosen: string | null }[];
    /** The director's handover, if the run reached one, as the senior manager's is kept. */
    directorHandover: { choice: string; options: { id: string; trust: string; want: string | null }[] } | null;
    /** Each director moment: the choices offered and the one taken ('fund-bets' for bets funded through their scene, null for waiting). */
    directorChoices: { title: string; offered: string[]; chosen: string | null }[];
    /** The VP's handover and moments, kept as the director's are. */
    vpHandover: { choice: string; options: { id: string; trust: string; want: string | null }[] } | null;
    vpChoices: { title: string; offered: string[]; chosen: string | null }[];
  };
  energyTrail: string[];
  /** What the player read, clicked and saw, in order, for the success-metric scorecard (playtest/metrics.ts). */
  events: PlayEvent[];
}

/** Plays a run in the page, from wherever it is, checking every screen; see `playInPage`. */
export function play(page: Page, options: PlayOptions): Promise<PlaySummary> {
  const args: InPage = {
    strategy: options.strategy,
    seed: options.seed,
    until: options.until ?? 'end',
    maxWeeks: options.maxWeeks ?? 400,
    // the page cannot import the title table, so it gets the patterns as text
    titles: { line: LINE_TITLES.source, senior: SENIOR_TITLES.map(([, re]) => re.source), director: DIRECTOR_TITLES.map(([, re]) => re.source), vp: VP_TITLES.map(([, re]) => re.source) },
    better: betterByTitle(),
  };
  return page.evaluate(playInPage, args);
}

/** Plays each seed in turn until a run reaches what `reached` looks for; fails if none does. */
export async function firstSeedThatReaches(page: Page, seeds: number[], options: Omit<PlayOptions, 'seed'>, reached: (s: PlaySummary) => boolean) {
  for (const seed of seeds) {
    await startSeeded(page, seed);
    const summary = await play(page, { ...options, seed });
    if (reached(summary)) return { seed, summary };
  }
  throw new Error(`none of seeds ${seeds.join(', ')} reached the scene with a ${options.strategy} player`);
}

/** Attaches a run's summary to the test report, so a run can be read without replaying it. */
export async function attachSummary(testInfo: TestInfo, name: string, summary: PlaySummary) {
  // The event log is long and the seed replays it, so the report gives only its length.
  const { violations, events, ...rest } = summary;
  await testInfo.attach(name, { body: JSON.stringify({ ...rest, violations: violations.length, events: events.length }, null, 2), contentType: 'application/json' });
}

/**
 * Runs inside the page: a scripted player plays the run screen by screen through the page's own buttons and
 * selects, and every screen is checked as it goes. It is self-contained, because Playwright sends it to the page
 * as source.
 */
type InPage = Required<PlayOptions> & { titles: { line: string; senior: string[]; director: string[]; vp: string[] }; better: Record<string, string> };

/** The balance harness's better choice for each situation, by the title the page shows it under. */
export function betterByTitle(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of realContent()) {
    if (!Object.hasOwn(BETTER_CHOICES, s.id)) continue;
    if (Object.hasOwn(out, s.title)) throw new Error(`two situations are titled "${s.title}"; the page cannot tell them apart`);
    out[s.title] = BETTER_CHOICES[s.id]!;
  }
  return out;
}

function playInPage(options: InPage): PlaySummary {
  const q = (s: string, r: ParentNode = document) => r.querySelector<HTMLElement>(s);
  const qa = (s: string, r: ParentNode = document) => [...r.querySelectorAll<HTMLElement>(s)];
  const text = (s: string, r: ParentNode = document) => q(s, r)?.textContent ?? '';
  let state = options.seed >>> 0 || 1;
  const random = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 2 ** 32;
  };
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const TIMES = ['morning', 'afternoon', 'night'];
  const ENERGY = new Set(['running on fumes', 'tired', 'okay', 'good', 'fresh', 'at the edge']);
  const VERDICTS = new Set(['above target', 'on target', 'below target']);
  const STATUSES = new Set(['You dealt with it', 'You let it wait', 'It passed before you got to it']);
  const COUNTED = /, (twice|\d+ times)$/;
  /** The titles of each career level's own moments (playtest/metrics.ts); any other moment is a situation. */
  const LINE_TITLES = new RegExp(options.titles.line, 'i');
  const SENIOR_TITLES = options.titles.senior.map((source) => new RegExp(source));
  const DIRECTOR_TITLES = options.titles.director.map((source) => new RegExp(source));
  const VP_TITLES = options.titles.vp.map((source) => new RegExp(source));

  const violations = new Set<string>();
  const flag = (where: string, what: string) => violations.add(`${where}: ${what}`);
  const summary: PlaySummary = {
    ending: null,
    stoppedAt: null,
    weeks: 0,
    reviews: [],
    career: [],
    violations: [],
    seen: { finalEvaluations: [], letGoWarnings: [], assigned: [], held: [], edgeWarnings: [], waitedLessons: 0, waitedWithoutLesson: [], endings: [], handover: null, seniorChoices: [], directorHandover: null, directorChoices: [], vpHandover: null, vpChoices: [] },
    energyTrail: [],
    events: [],
  };

  /** Whether the page shows the senior manager: managers rather than a team. */
  const senior = () => q('[data-panel=managers]') !== null;
  /** Whether the page shows the director: senior managers and their groups. */
  const director = () => q('[data-panel=senior-managers]') !== null;
  /** Whether the page shows the VP: directors and their divisions. */
  const vp = () => q('[data-panel=directors]') !== null;
  const levelOn = (): Level => {
    if (vp()) return 'vp';
    if (director()) return 'director';
    return senior() ? 'senior' : 'line';
  };
  /** The value for the career level on screen. */
  const atLevel = <T,>(values: Record<Level, T>): T => values[levelOn()];
  /** Whether a moment is the career level's own rather than a situation, by its title at the level on screen. */
  const isLevelMoment = (title: string) => atLevel({ vp: VP_TITLES, director: DIRECTOR_TITLES, senior: SENIOR_TITLES, line: [LINE_TITLES] }).some((re) => re.test(title));
  /** The game week the senior manager level, and the quarterly level on screen (director, then VP), began, as the player counts weeks: the last review before each. */
  let seniorBase = 0;
  let quarterBase = 0;
  let lastReviewWeek = 0;
  /** The week of the run a screen is about, counting from 1: the header's week, or at a higher level its turn's first week. */
  const runWeek = () => {
    const n = Number(text('[data-field=week]'));
    return atLevel({ vp: quarterBase + (n - 1) * 13 + 1, director: quarterBase + (n - 1) * 13 + 1, senior: seniorBase + (n - 1) * 4 + 1, line: n });
  };

  /** The event log (PLAY-RUN-002): only what the page shows, as the player would see it. */
  // @spec PLAY-RUN-002, PLAY-CLOCK-001, PLAY-CLOCK-002, PLAY-CLOCK-003
  const log = summary.events;
  const readScreens = new Set<string>();
  /** Words a player reads on a screen: its text nodes, leaving out the panels they only glance at. */
  function wordsOn(root: HTMLElement | null) {
    if (!root) return 0;
    const copy = root.cloneNode(true) as HTMLElement;
    for (const skip of copy.querySelectorAll('[data-panel=team], [data-panel=habits], [data-panel=projects], .habit, header.status')) skip.remove();
    // A closed disclosure shows only its summary, and the scripted players never open one.
    for (const hidden of copy.querySelectorAll('details:not([open]) > :not(summary)')) hidden.remove();
    const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
    let words = 0;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) words += (n.textContent ?? '').split(/\s+/).filter(Boolean).length;
    return words;
  }
  const read = (key: string, root: HTMLElement | null) => {
    if (readScreens.has(key)) return;
    readScreens.add(key);
    log.push({ kind: 'read', words: wordsOn(root) });
  };
  const press = (el: HTMLElement | null, decision = false) => {
    if (!el) return;
    el.click();
    log.push({ kind: 'click', decision });
  };
  const PERSON_CARDS = ['[data-panel=team] [data-person]', '[data-panel=managers] [data-manager]', '[data-panel=senior-managers] [data-senior-manager]', '[data-panel=directors] [data-director]'].join(', ');
  let lastLook = '';
  function look() {
    const entry: Look = {
      kind: 'look',
      week: runWeek(),
      // Everyone the player leads, on a card beside the scene: engineers, then managers, senior managers or directors (PLAY-TRACE-001).
      people: qa(PERSON_CARDS).map((card) => ({
        name: text('[data-field=name]', card),
        motivation: text('[data-field=motivation]', card),
        stress: text('[data-field=stress]', card),
        memory: qa('[data-part=memory] li', card).map((l) => l.textContent ?? ''),
      })),
      projects: qa('[data-project]').map((p) => ({ name: text('[data-field=name]', p), schedule: text('[data-field=schedule]', p), risk: text('[data-field=risk]', p) })),
      energy: text('[data-field=energy]'),
      burnout: q('[data-field=burnout]') !== null,
    };
    const key = JSON.stringify(entry);
    if (key !== lastLook) log.push(entry);
    lastLook = key;
  }
  /** The panels beside the scene, by heading, and the habits offered, by label with a person's name left out (PLAY-JOB-001). */
  // @spec PLAY-JOB-001
  let lastLayout = '';
  function layout() {
    const panels = qa('[data-panel]').map((p) => q(':scope > h2, :scope > summary', p)?.textContent?.trim() ?? '').filter(Boolean);
    if (!panels.length) return;
    const habits = [...new Set(qa('[data-panel=habits] .habit-name').map((n) => (n.textContent ?? '').trim().replace(/ of .+$/, '')))];
    const entry: PlayEvent = { kind: 'layout', level: levelOn(), panels: [...new Set(panels)], habits };
    const key = JSON.stringify(entry);
    if (key !== lastLayout) log.push(entry);
    lastLayout = key;
  }
  const firstNotes = () => new Map(qa('[data-panel=team] [data-person]').map((card) => [text('[data-field=name]', card), q('[data-part=memory] li', card)?.textContent ?? '']));
  const uncounted = (line: string) => line.replace(COUNTED, '');

  /** What text on a screen must not show, in the order it is checked. */
  const TEXT_RULES: [RegExp, string][] = [
    [/[{}]|\b(undefined|null|NaN|Infinity|\[object)\b/, 'broken text'],
    [/\b[a-z]+[A-Z][a-z]/, 'code name in text'],
    [/ {2,}| [.,;:!?](?!\d)|\.\.(?!\.)/, 'spacing'],
    [/\b1 (weeks|interviews|engineers|projects|reviews|approvals|pages|times)\b/, 'plural'],
    [/\b(\w{2,}) \1\b/i, 'repeated word'],
  ];
  /** Text quality on every leaf of the screen: no placeholders, code names, broken spacing or plural slips. */
  function checkText(where: string) {
    for (const el of qa('[data-screen] p, [data-screen] li, [data-screen] td, [data-screen] h1, [data-screen] h2, [data-screen] h3, [data-screen] button, [data-screen] small, header.status p, header.status div')) {
      if (el.children.length && !['P', 'LI', 'BUTTON'].includes(el.tagName)) continue;
      const t = (el.innerText ?? '').trim();
      if (t) for (const [rule, problem] of TEXT_RULES) if (rule.test(t)) flag(where, `${problem}: ${t.slice(0, 120)}`);
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) flag(where, `wider than the viewport (${document.documentElement.scrollWidth}px)`);
  }

  /** The week screen's own rules: the header, the team cards and the scene. */
  function checkWeek(sc: string, lastSlot: { week: string; slot: number }) {
    const week = text('[data-field=week]');
    const turn = atLevel({ vp: 'quarter', director: 'quarter', senior: 'month', line: 'week' });
    checkHeader();
    checkMemories();
    if (sc === 'recap') checkRecap(turn, week);
    if (sc === 'done' && text('[data-scene] .where') !== 'The weekend') flag('done', 'not set at the weekend');
    const besideEndWeek = q('.stage > .end-week') !== null;
    if ((sc === 'moment' || sc === 'reaction') !== besideEndWeek) flag(sc, `End the week beside the scene: ${besideEndWeek}`);
    if (sc === 'reaction') {
      for (const chip of qa('[data-scene] [data-chip]')) if (COUNTED.test(chip.textContent ?? '')) flag('reaction', `a chip with a count: ${chip.textContent}`);
    }
    if (sc === 'moment') checkWhen(turn, week, lastSlot);
  }

  /** The header's energy word, and its burnout warning in one of its two forms. */
  function checkHeader() {
    const energy = text('[data-field=energy]');
    if (!ENERGY.has(energy)) flag('header', `energy word "${energy}"`);
    const warning = q('[data-field=burnout]')?.textContent ?? null;
    if (warning && !/^You're close to the edge\. Take something off your plate\.$|^You've ended \d+ (weeks?|months?|quarters?) at the edge\. \d+ in a row and you burn out\.$/.test(warning)) flag('header', `burnout warning "${warning}"`);
  }

  /** At most three memory lines on a card, no 1:1 notes, and no line twice in a row. */
  function checkMemories() {
    for (const card of qa('[data-panel=team] [data-person]')) {
      const lines = qa('[data-part=memory] li', card).map((l) => l.textContent ?? '');
      if (lines.length > 3) flag('team', `more than three memory lines`);
      lines.forEach((l, i) => {
        if (l === '1:1') flag('team', 'a 1:1 note in memory');
        if (i > 0 && lines[i - 1] === l) flag('team', `the same memory line twice in a row: ${l}`);
      });
    }
  }

  function checkRecap(turn: string, week: string) {
    const heading = text('[data-scene] [data-part=heading]');
    if (heading !== `How ${turn} ${week} went`) flag('recap', `heading "${heading}" in ${turn} ${week}`);
    const start = text('[data-action=close-recap]');
    if (start !== `Start ${turn} ${Number(week) + 1}`) flag('recap', `button "${start}" after ${turn} ${week}`);
    if (text('[data-scene] .where') !== 'The weekend') flag('recap', 'not set at the weekend');
  }

  /** A moment's time: well formed, never before an earlier moment of the week, and the day strip on its day. */
  function checkWhen(turn: string, week: string, lastSlot: { week: string; slot: number }) {
    // A month's or a quarter's moment says its week of the turn too: "Week 2, Tuesday morning".
    const when = text('[data-field=when]');
    const at = /^(?:Week ([1-9]|1[0-3]), )?(\w+) (\w+)$/.exec(when);
    if ((levelOn() !== 'line') !== Boolean(at?.[1])) flag('moment', `when "${when}" at the ${turn} level`);
    const [day, time] = [at?.[2], at?.[3]];
    const slot = at ? (Number(at[1] ?? 1) - 1) * 15 + DAYS.indexOf(day!) * 3 + TIMES.indexOf(time!) : -1;
    if (slot < 0) flag('moment', `when "${when}"`);
    if (lastSlot.week === week && slot < lastSlot.slot) flag('moment', `week ${week}: ${when} after a later moment`);
    lastSlot.week = week;
    lastSlot.slot = slot;
    const now = qa('[data-panel=days] [data-day]').findIndex((e) => e.dataset.state === 'now');
    if (now !== DAYS.indexOf(day!)) flag('moment', `day strip marks day ${now} on ${day}`);
  }

  /** A debrief's status, and a lesson for every situation dealt with; a lesson for one let wait is counted. */
  function checkDebrief(d: HTMLElement) {
    const status = text('[data-field=status]', d);
    if (!STATUSES.has(status)) flag('review', `debrief status "${status}"`);
    const lesson = q('[data-field=text]', d)?.textContent;
    const title = text('[data-field=title]', d);
    if (status === 'You dealt with it' && !lesson) flag('review', `no lesson for ${title}`);
    if (status !== 'You let it wait') return;
    if (lesson) summary.seen.waitedLessons++;
    else if (!title.startsWith('Onboarding')) summary.seen.waitedWithoutLesson.push(title);
  }

  function checkReview() {
    const week = text('[data-part=heading]');
    const measures = qa('[data-measure]');
    for (const m of measures) {
      const name = text('[data-field=name]', m);
      if (/^[a-z]+[A-Z]/.test(name) || name === m.dataset.measure) flag('review', `measure shown by its id: ${name}`);
      if (!VERDICTS.has(text('[data-field=verdict]', m))) flag('review', `verdict "${text('[data-field=verdict]', m)}"`);
      if (!text('[data-field=numbers]', m)) flag('review', `no numbers for ${name}`);
    }
    for (const d of qa('[data-debrief]')) checkDebrief(d);
    const ceiling = q('[data-field=ceiling]')?.textContent ?? null;
    summary.reviews.push({ week, rating: text('[data-field=rating]'), ceiling, outcome: text('[data-field=outcome]') });
  }

  function checkEnded() {
    summary.ending = text('[data-field=ending]');
    summary.career = qa('[data-part=career] li').map((l) => l.textContent ?? '');
    if (!q('[data-part=career]')) flag('ended', 'no career summary');
    const ratings = text('[data-part=career] [data-field=ratings]');
    const reviewed = summary.reviews.map((r) => r.rating).join(', ');
    if (summary.reviews.length && ratings !== reviewed) flag('ended', `career ratings "${ratings}" but the reviews were "${reviewed}"`);
  }

  const setHabit = (habit: string, match: RegExp) => {
    const select = q(`[data-habit=${habit}]`) as HTMLSelectElement | null;
    const option = select && [...select.options].find((o) => match.test(o.textContent ?? '') || match.test(o.value));
    if (select && option && select.value !== option.value) {
      select.value = option.value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const BANDS = {
    stress: ['calm', 'steady', 'busy', 'strained', 'overwhelmed'],
    skill: ['learning', 'developing', 'capable', 'strong', 'expert'],
    energy: ['running on fumes', 'tired', 'okay', 'good', 'fresh'],
    reputation: ['poor', 'mixed', 'fair', 'good', 'excellent'],
  };
  /** A band word as the balance harness's band number: 2 is "okay" energy, "busy" stress and "fair" reputation. */
  const bandOf = (kind: keyof typeof BANDS, word: string) => BANDS[kind].indexOf(word.trim());
  const OKAY = 2;

  /**
   * Sound practice at the line manager, as the balance design states it and the balance harness plays it
   * (tests/balance/strategies.ts), reading the page's band words where the harness reads the view's bands.
   */
  // @spec PLAY-RUN-007
  function lineSound(choices: HTMLElement[], by: (pred: (id: string, el: HTMLElement) => boolean) => HTMLElement | null): HTMLElement | null {
    const title = text('[data-scene] [data-part=heading]');
    const has = (id: string) => by((x) => x === id);
    const rested = bandOf('energy', text('[data-field=energy]')) >= OKAY;
    if (!isLevelMoment(title)) {
      const better = options.better[title];
      return (better ? has(better) : null) ?? choices[0] ?? null;
    }
    if (title.startsWith('Final evaluation')) return has('letGo');
    // Only pages beyond the engineer on call reach a moment: back them up with energy to spare, or roll the change back.
    if (title === 'Night page') return rested ? has('backUp') : has('rollBack');
    if (title.startsWith('Check-in: ')) return checkInSound(title.slice('Check-in: '.length), rested, has);
    if (title === 'Interview') return rested ? has('self') : (offeredEngineers(choices, 'ask:')[0]?.el ?? has('skip'));
    return workSound(choices, rested, has);
  }

  /** A check-in: cut scope on a slipping project while reputation allows, otherwise replan with energy or push on. */
  function checkInSound(name: string, rested: boolean, has: (id: string) => HTMLElement | null): HTMLElement | null {
    const project = qa('[data-project]').find((p) => text('[data-field=name]', p) === name);
    const schedule = project ? text('[data-field=schedule]', project) : 'on schedule';
    if (schedule !== 'on schedule' && bandOf('reputation', text('[data-field=reputation]')) >= OKAY) return has('cutScope');
    return rested ? has('replan') : has('pushOn');
  }

  /** The engineers a choice offers, least stressed first, ties by id, as the harness orders them. */
  const offeredEngineers = (choices: HTMLElement[], prefix: string) =>
    choices
      .filter((c) => (c.dataset.choice ?? '').startsWith(prefix))
      .map((c) => {
        const [skill = '', stress = ''] = (q('[data-part=who]', c)?.textContent ?? '').split(', ');
        return { el: c, id: c.dataset.choice!.slice(prefix.length), skill: bandOf('skill', skill), stress: bandOf('stress', stress) };
      })
      .sort((a, b) => a.stress - b.stress || (a.id < b.id ? -1 : 1));

  /** Work to hand out, as the balance harness's sound practice hands it out. */
  function workSound(choices: HTMLElement[], rested: boolean, has: (id: string) => HTMLElement | null): HTMLElement | null {
    // New work is offered only while someone is strained: protecting the team is worth a little reputation.
    if (has('take')) return has('decline');
    // Debt the design review's text calls elevated or worse is worth slowing down for.
    if (has('payDown') && /tech debt is (elevated|high|severe)/.test(text('[data-scene] [data-part=text]'))) return has('payDown');
    const difficulty = q('[data-scene] [data-field=difficulty]') ? bandOf('skill', text('[data-scene] [data-field=difficulty]')) : undefined;
    const givable = offeredEngineers(choices, 'give:');
    const able = givable.find((p) => (difficulty === undefined || p.skill >= difficulty) && p.stress <= OKAY);
    if (able) return able.el;
    if (rested) return has('self');
    // Tired, with no one able: the customer can take part of what they asked.
    if (has('smaller')) return has('smaller');
    // Tired, with no one able: a stretch for someone with room, or push back.
    return givable.find((p) => p.stress <= OKAY)?.el ?? has('pushBack');
  }

  /** Whoever a goal names, or who wants growth, or the least skilled, ties by id. */
  function growthFocus() {
    const goals = new Set(qa('[data-goal] [data-field=text]').map((g) => g.textContent ?? ''));
    const people = qa('[data-panel=team] [data-person]').map((c) => ({ id: c.dataset.person!, name: text('[data-field=name]', c), want: text('[data-field=want]', c), skill: bandOf('skill', text('[data-field=skill]', c)) }));
    return (
      people.find((p) => goals.has(`Help ${p.name} grow`)) ??
      people.find((p) => p.want === 'growth') ??
      [...people].sort((a, b) => a.skill - b.skill || (a.id < b.id ? -1 : 1))[0]
    );
  }

  /** Sound practice's habit: the growth focus on whoever a goal names, or who wants growth, or the least skilled. */
  // @spec PLAY-RUN-007
  let habitsWeek = '';
  function soundHabits() {
    // @spec PLAY-RUN-010
    if (levelOn() === 'vp' && ['sound', 'mixed'].includes(options.strategy)) setHabit('firstTeam', /leadership/i);
    if (levelOn() !== 'line' || !['sound', 'mixed'].includes(options.strategy)) return;
    const week = text('[data-field=week]');
    if (week === habitsWeek) return;
    habitsWeek = week;
    const growth = growthFocus();
    const select = q('[data-habit=growth]') as HTMLSelectElement | null;
    if (growth && select && select.value !== growth.id) {
      select.value = growth.id;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  let easing = false;
  /** The scripted player's choice for the current moment, or null to let it wait. */
  function choose(): HTMLElement | null {
    const choices = qa('[data-scene] [data-choice]');
    const ids = choices.map((c) => c.dataset.choice ?? '');
    const by = (pred: (id: string, el: HTMLElement) => boolean) => choices.find((c) => pred(c.dataset.choice ?? '', c)) ?? null;
    const title = text('[data-scene] [data-part=heading]');
    // The strategies' own rule, kept as their runs were tuned against it: approvals count as situations here.
    const situation = !/^(Check-in|Night page|Interview|Design review|Customer request|New work|Final evaluation|Onboarding)/.test(title);
    // @spec PLAY-RUN-007
    const sound = () => lineSound(choices, by);
    if (senior()) return seniorChoice(choices, by);
    if (vp()) return vpChoice(choices, by);
    if (director()) return directorChoice(choices, by);
    const delegate = () => by((id) => id === 'leave') ?? by((id) => id.startsWith('give:') || id.startsWith('ask:')) ?? by((id) => id === 'take' || id === 'pushOn') ?? choices.at(-1) ?? null;
    const hero = () => by((id) => ['self', 'takeOver', 'replan', 'take'].includes(id)) ?? choices[0] ?? null;
    switch (options.strategy) {
      case 'sound':
        return sound();
      case 'delegate':
        return delegate();
      case 'hero':
        return hero();
      case 'decline':
        return ids.includes('decline') ? by((id) => id === 'decline') : sound();
      case 'waiter':
        return situation && random() < 0.5 ? null : sound();
      // The success-metric playtests' first-timer (PLAY-RUN-003).
      // @spec PLAY-RUN-003
      case 'mixed':
        return firstTimer(choices, sound);
      case 'heavyThenEase':
        return heavyThenEase(by, hero);
    }
  }

  /** A first-timer: lets a tenth of moments wait, picks a fifth at random, and plays the rest soundly. */
  function firstTimer(choices: HTMLElement[], sound: () => HTMLElement | null): HTMLElement | null {
    const r = random();
    if (r < 0.1) return null;
    if (r < 0.3) return choices[Math.floor(random() * choices.length)] ?? null;
    return sound();
  }

  /** Plays the hero until the first burnout warning, then eases off for good: pages left to the team, work handed out. */
  function heavyThenEase(by: (pred: (id: string) => boolean) => HTMLElement | null, hero: () => HTMLElement | null): HTMLElement | null {
    if (!easing && q('[data-field=burnout]')) {
      easing = true;
      setHabit('nightPages', /a week on their own/i);
    }
    return easing ? by((id) => id.startsWith('give:') || ['leave', 'cutScope', 'decline', 'pushOn', 'oneMoreQuarter'].includes(id)) : hero();
  }

  /** The first of the choices, in order of preference, that a moment offers. */
  const preferIn = (by: (pred: (id: string) => boolean) => HTMLElement | null, order: string[]) => {
    for (const id of order) {
      const found = by((x) => x === id);
      if (found) return found;
    }
    return null;
  };

  /** Sound practice at the VP, in order of preference among the choices a moment offers (PLAY-RUN-010). */
  const VP_SOUND = ['plan', 'together', 'once', 'truth', 'promote', 'letGo'];
  // @spec PLAY-RUN-010
  function vpChoice(choices: HTMLElement[], by: (pred: (id: string) => boolean) => HTMLElement | null): HTMLElement | null {
    const prefer = (order: string[]) => preferIn(by, order);
    const title = text('[data-scene] [data-part=heading]');
    const situation = !isLevelMoment(title);
    const better = situation ? options.better[title] : undefined;
    /** The division calmest as last surveyed, among those the priority's choices name. */
    const calmest = () => {
      const named = choices.filter((c) => (c.dataset.choice ?? '').startsWith('one:')).map((c) => c.dataset.choice!.slice('one:'.length));
      const stress = (id: string) => bandOf('stress', text(`[data-panel=directors] [data-division="${id}"] [data-field=stress]`));
      const id = [...named].sort((a, b) => stress(a) - stress(b) || (a < b ? -1 : 1))[0];
      return id ? by((x) => x === `one:${id}`) : prefer(['spread']);
    };
    /** A dispute: a trade with a peer whose card shows trusting or better, the company's answer otherwise. */
    const dispute = () => {
      const name = /^(.+) disagrees$/.exec(title)?.[1] ?? '';
      const card = qa('[data-panel=leadership] [data-outsider]').find((c) => text('[data-field=name]', c) === name);
      const trust = ['wary', 'guarded', 'neutral', 'trusting', 'loyal'].indexOf(card ? text('[data-field=trust]', card) : '');
      return by((x) => x === (trust >= 3 ? 'trade' : 'company'));
    };
    const sound = (): HTMLElement | null => {
      if (situation) return (better ? by((x) => x === better) : null) ?? choices[0] ?? null;
      if (title === 'The company priority') return calmest();
      if (title.endsWith(' disagrees')) return dispute();
      return prefer(VP_SOUND) ?? choices[0] ?? null;
    };
    switch (options.strategy) {
      case 'hero':
      case 'heavyThenEase':
        return by((x) => x.startsWith('one:')) ?? prefer(['more', 'function', 'decide', 'across', 'celebrate', 'hire', 'oneMore']) ?? choices[0] ?? null;
      case 'delegate':
        return prefer(['plan', 'spread', 'company', 'together', 'across', 'short', 'promote', 'oneMore']) ?? choices.at(-1) ?? null;
      case 'decline':
        return prefer(['push', 'short']) ?? sound();
      case 'waiter':
        return situation && random() < 0.5 ? null : sound();
      case 'mixed':
        return firstTimer(choices, sound);
      default:
        return sound();
    }
  }

  /** Sound practice at the director, in order of preference among the choices a moment offers (PLAY-RUN-009). */
  const DIRECTOR_SOUND = ['spread', 'coach', 'promote', 'letGo', 'splitPromote', 'merge', 'straight'];
  // @spec PLAY-RUN-009
  function directorChoice(choices: HTMLElement[], by: (pred: (id: string) => boolean) => HTMLElement | null): HTMLElement | null {
    const prefer = (order: string[]) => preferIn(by, order);
    const title = text('[data-scene] [data-part=heading]');
    const situation = !isLevelMoment(title);
    const better = situation ? options.better[title] : undefined;
    /** Funds the first bet on offer on the group with the lowest stress, as the group panel shows it. */
    const fundBets = () => {
      const groups = qa('[data-panel=senior-managers] [data-group]').map((g) => ({ id: g.dataset.group!, stress: bandOf('stress', text('[data-field=stress]', g)) }));
      const calmest = [...groups].sort((a, b) => a.stress - b.stress || (a.id < b.id ? -1 : 1))[0];
      const picker = q('[data-scene] [data-offer] select') as HTMLSelectElement | null;
      if (!calmest || !picker) return prefer(['none']);
      picker.value = calmest.id;
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      return q('[data-action=fund-bets]');
    };
    /** A peer's ask: negotiate with a peer whose card shows trusting or better, agree otherwise. */
    const peerAsk = () => {
      if (!by((x) => x === 'negotiate')) return null;
      const name = /^(.+) needs something$/.exec(title)?.[1] ?? '';
      const card = qa('[data-panel=upward] [data-outsider]').find((c) => text('[data-field=name]', c) === name);
      const trust = ['wary', 'guarded', 'neutral', 'trusting', 'loyal'].indexOf(card ? text('[data-field=trust]', card) : '');
      return by((x) => x === (trust >= 3 ? 'negotiate' : 'agree'));
    };
    const sound = () => {
      if (situation) return (better ? by((x) => x === better) : null) ?? choices[0] ?? null;
      if (q('[data-scene] [data-detail=bets]')) return fundBets();
      return peerAsk() ?? prefer(DIRECTOR_SOUND) ?? choices[0] ?? null;
    };
    switch (options.strategy) {
      case 'hero':
      case 'heavyThenEase':
        return prefer(['decide', 'neediest', 'agree', 'promote', 'oneMore', 'straight']) ?? choices[0] ?? null;
      case 'delegate':
        return prefer(['spread', 'agree', 'leave', 'hire', 'oneMore', 'wins']) ?? choices.at(-1) ?? null;
      case 'decline':
        return prefer(['refuse', 'hold', 'none', 'leave']) ?? sound();
      case 'waiter':
        return situation && random() < 0.5 ? null : sound();
      case 'mixed': {
        const r = random();
        if (r < 0.1) return null;
        if (r < 0.3) return choices[Math.floor(random() * choices.length)] ?? null;
        return sound();
      }
      default:
        return sound();
    }
  }

  /** Sound practice at the senior manager, in order of preference among the choices a moment offers (PLAY-RUN-006). */
  const SENIOR_SOUND = ['coach', 'move', 'agree', 'give', 'evidence', 'promoteFromTeam', 'letGo'];
  const SENIOR_HERO = ['stepIn', 'decide', 'give', 'approve', 'promoteFromTeam', 'letGo'];
  const SENIOR_DELEGATE = ['letThem', 'acceptAll', 'approve', 'hire', 'letRun', 'oneMorePeriod'];
  // @spec PLAY-RUN-006
  function seniorChoice(choices: HTMLElement[], by: (pred: (id: string) => boolean) => HTMLElement | null): HTMLElement | null {
    const prefer = (order: string[]) => preferIn(by, order);
    const title = text('[data-scene] [data-part=heading]');
    const better = isLevelMoment(title) ? undefined : options.better[title];
    // A situation: its better choice from the table, or the first offered (PLAY-RUN-006).
    const sound = () => {
      if (isLevelMoment(title)) return prefer(SENIOR_SOUND) ?? choices[0] ?? null;
      return (better ? by((x) => x === better) : null) ?? choices[0] ?? null;
    };
    switch (options.strategy) {
      case 'hero':
      case 'heavyThenEase':
        return prefer(SENIOR_HERO) ?? choices[0] ?? null;
      case 'delegate':
        return prefer(SENIOR_DELEGATE) ?? choices.at(-1) ?? null;
      case 'decline':
        return prefer(['decline', 'refuse']) ?? sound();
      case 'waiter':
        return !isLevelMoment(text('[data-scene] [data-part=heading]')) && random() < 0.5 ? null : sound();
      case 'mixed': {
        const r = random();
        if (r < 0.1) return null;
        if (r < 0.3) return choices[Math.floor(random() * choices.length)] ?? null;
        return sound();
      }
      default:
        return sound();
    }
  }

  /** Settles calibration on the evidence: every head moved, a rating at a time, to what its team delivered. */
  function settleOnEvidence() {
    for (const table of qa('[data-scene] [data-calibration]')) {
      const team = table.dataset.calibration!;
      for (let i = 0; i < 60; i++) {
        const t = q(`[data-scene] [data-calibration="${team}"]`)!;
        const RATINGS = ['below', 'partial', 'meets', 'exceeds', 'outstanding'];
        const count = (attr: string, r: string) => Number(text(`[${attr}=${r}]`, t));
        // The highest rating proposed above its delivery gives a head to the rating below; a lenient proposal only ever runs high.
        const over = [...RATINGS].reverse().find((r) => count('data-proposed', r) > count('data-delivered', r));
        if (!over) break;
        const below = RATINGS[RATINGS.indexOf(over) - 1];
        const move = below ? q(`[data-move="${team}:${over}:${below}"]`) : null;
        if (!move) break;
        move.click();
      }
    }
    press(q('[data-action=settle]'), true);
  }

  if (options.strategy === 'decline' || options.strategy === 'waiter') setHabit('oneOnOnes', /every week|weekly/i);
  soundHabits();
  if (options.strategy === 'hero' || options.strategy === 'heavyThenEase') setHabit('nightPages', /every night/i);
  if (q('[data-scene]')?.dataset.scene === 'before-monday') {
    look();
    read('before-monday', q('[data-scene]'));
  }
  press(q('[data-action=start-week]'));

  const lastSlot = { week: '', slot: -1 };
  let lastRecapWeek = '';
  /** What a step leaves the loop to do: go on to the next screen, stop playing, or return the summary as it stands. */
  type Next = 'next' | 'stop' | PlaySummary;
  const stopAt = (stoppedAt: string): PlaySummary => ({ ...summary, stoppedAt, violations: [...violations] });

  function reviewStep(): Next {
    checkText('review');
    checkReview();
    const heading = text('[data-part=heading]');
    if (!readScreens.has(`review|${heading}`)) {
      read(`review|${heading}`, q('[data-screen]'));
      const turn = Number(/\d+/.exec(heading)?.[0] ?? 0);
      let reviewWeek = turn;
      if (heading.startsWith('Quarter')) reviewWeek = quarterBase + turn * 13;
      else if (heading.startsWith('Month')) reviewWeek = seniorBase + turn * 4;
      lastReviewWeek = reviewWeek;
      log.push({ kind: 'review', week: reviewWeek, rating: text('[data-field=rating]'), promoted: text('[data-field=outcome]') === 'You are being promoted.' });
    }
    if (options.until === 'review') return stopAt('review');
    press(q('[data-action=acknowledge]'));
    return 'next';
  }

  // @spec PLAY-RUN-005, PLAY-RUN-009, PLAY-RUN-010
  function handoverStep(): Next {
    checkText('handover');
    const TRUST = ['wary', 'guarded', 'neutral', 'trusting', 'loyal'];
    const offered = qa('[data-handover]').map((b) => ({ id: b.dataset.handover!, trust: text('[data-field=trust]', b), want: q('[data-field=want]', b)?.textContent ?? null }));
    const growers = offered.filter((o) => o.want === 'growth' && TRUST.indexOf(o.trust) >= 3).sort((a, b) => TRUST.indexOf(b.trust) - TRUST.indexOf(a.trust));
    const choice = growers[0]?.id ?? 'hire';
    const seen = { choice, options: offered.filter((o) => o.id !== 'hire') };
    if (/promoted to VP/.test(text('[data-part=heading]'))) {
      summary.seen.vpHandover = seen;
      quarterBase = lastReviewWeek;
      if (options.until === 'vpHandover') return stopAt('VP handover');
    } else if (/promoted to director/i.test(text('[data-part=heading]'))) {
      summary.seen.directorHandover = seen;
      quarterBase = lastReviewWeek;
      // left on the handover screen, for a player that takes over from here
      if (options.until === 'directorHandover') return stopAt('director handover');
    } else {
      summary.seen.handover = seen;
      seniorBase = lastReviewWeek;
      if (options.until === 'seniorHandover') return stopAt('senior handover');
    }
    read('handover', q('[data-screen]'));
    press(q(`[data-handover="${choice}"]`));
    return 'next';
  }

  function endedStep(): Next {
    checkText('ended');
    checkEnded();
    read('ended', q('[data-screen]'));
    const leftText = text('[data-part=career] [data-field=left]');
    const left = leftText === 'nobody' ? [] : leftText.split(', ').map((entry) => /^(.*) \((.*)\)$/.exec(entry)).filter((m) => m !== null).map((m) => ({ name: m[1]!, reason: m[2]! }));
    log.push({ kind: 'ended', ending: summary.ending ?? '', left });
    return 'stop';
  }

  /** Every scene: its checks, the look and layout, the habits, the moment and read events, and the edge warning. */
  function sceneStep(sc: string): Next {
    checkText(sc);
    checkWeek(sc, lastSlot);
    look();
    layout();
    // Habits change once a week, at its first scene, before any of its moments is answered, as the harness changes them.
    if (sc !== 'recap') soundHabits();
    const sceneKey = `${text('[data-field=week]')}|${sc}|${text('[data-scene] [data-part=heading]')}|${text('[data-field=when]')}`;
    if (sc === 'moment' && !readScreens.has(sceneKey)) log.push({ kind: 'moment', week: runWeek(), title: text('[data-scene] [data-part=heading]'), level: levelOn() });
    read(sceneKey, q('[data-scene]'));
    const warning = q('[data-field=burnout]')?.textContent;
    if (warning && !summary.seen.edgeWarnings.includes(warning)) summary.seen.edgeWarnings.push(warning);
    return options.until === 'edgeWarning' && warning ? stopAt('edgeWarning') : 'next';
  }

  /** At the senior manager and director the header counts months or quarters from the level's start; the run counts weeks. */
  const runWeeks = (week: string) => {
    if (vp() || director()) return quarterBase + Number(week) * 13;
    return senior() ? seniorBase + Number(week) * 4 : Number(week);
  };

  function recapStep(): Next {
    const week = text('[data-field=week]');
    if (week !== lastRecapWeek) {
      lastRecapWeek = week;
      summary.weeks = runWeeks(week);
      summary.energyTrail.push(`${week}:${text('[data-field=energy]')}`);
      summary.seen.assigned.push(...qa('[data-part=recap-assigned] li').map((l) => l.textContent ?? ''));
      summary.seen.held.push(...qa('[data-part=recap-held] li').map((l) => l.textContent ?? ''));
    }
    if (summary.weeks >= options.maxWeeks) return stopAt(`week ${summary.weeks}`);
    press(q('[data-action=close-recap]'));
    return 'next';
  }

  /** The buttons that move a scene on without a decision. */
  const MOVE_ON: Record<string, string> = { done: 'finish-week', 'before-monday': 'start-week', reaction: 'continue' };

  function weekStep(): Next {
    const sc = q('[data-scene]')?.dataset.scene ?? '';
    const seen = sceneStep(sc);
    if (seen !== 'next') return seen;
    if (sc === 'recap') return recapStep();
    if (Object.hasOwn(MOVE_ON, sc)) {
      press(q(`[data-action=${MOVE_ON[sc]}]`));
      return 'next';
    }
    if (sc !== 'moment') {
      flag('week', `unexpected scene "${sc}"`);
      return 'stop';
    }
    return momentStep();
  }

  /** Final evaluations and the honest let-go warning are recorded as they are seen, and a run can stop at either. */
  function milestones(title: string): PlaySummary | undefined {
    if (title.startsWith('Final evaluation')) {
      summary.seen.finalEvaluations.push({ title, choices: qa('[data-scene] [data-choice]').map((c) => c.childNodes[0]?.textContent ?? '') });
      if (options.until === 'finalEvaluation') return stopAt('finalEvaluation');
    }
    const letGo = q('[data-scene] [data-choice=honest-let-go]');
    if (!letGo) return undefined;
    summary.seen.letGoWarnings.push(letGo.textContent ?? '');
    return options.until === 'letGoWarning' ? stopAt('letGoWarning') : undefined;
  }

  /** Calibration, settled on the evidence by every player who plays sound practice for it. */
  const settlesOnEvidence = () => senior() && q('[data-scene] [data-calibration]') !== null && ['sound', 'mixed', 'waiter'].includes(options.strategy);

  function momentStep(): Next {
    const title = text('[data-scene] [data-part=heading]');
    const stopped = milestones(title);
    if (stopped) return stopped;
    const offered = qa('[data-scene] [data-choice]').map((c) => c.dataset.choice ?? '');
    if (settlesOnEvidence()) {
      summary.seen.seniorChoices.push({ title, offered, chosen: 'settle' });
      const week = runWeek();
      settleOnEvidence();
      log.push({ kind: 'answer', week, title, reaction: q('[data-scene] [data-part=reaction]')?.textContent ?? null, chips: qa('[data-scene] [data-chip]').map((c) => c.textContent ?? ''), notes: [] });
      return 'next';
    }
    const choice = choose();
    if (senior()) summary.seen.seniorChoices.push({ title, offered, chosen: choice?.dataset.choice ?? null });
    if (director()) summary.seen.directorChoices.push({ title, offered, chosen: choice?.dataset.choice ?? choice?.dataset.action ?? null });
    if (vp()) summary.seen.vpChoices.push({ title, offered, chosen: choice?.dataset.choice ?? null });
    const week = runWeek();
    if (choice) answer(title, choice, week);
    else waitIt(week);
    return 'next';
  }

  const waitIt = (week: number) => {
    press(q('[data-scene] [data-action=wait]'), true);
    log.push({ kind: 'wait', week });
  };

  /** Answers the moment, logging the reaction, its chips and the notes it left on cards. */
  function answer(title: string, choice: HTMLElement, week: number) {
    const before = firstNotes();
    press(choice, true);
    const scene = () => q('[data-scene]');
    const reacted = scene()?.dataset.scene === 'reaction';
    // A refused answer leaves the moment open: flag it and let it wait, rather than choose it again forever.
    if (!reacted && scene()?.dataset.scene === 'moment' && q(`[data-scene][data-moment="${scene()!.dataset.moment}"] .error, [data-scene] [role=alert]`)) {
      flag('moment', `"${title}" refused the answer ${choice.dataset.choice ?? ''}`);
      waitIt(week);
      return;
    }
    const notes = [...firstNotes()]
      .filter(([name, note]) => note && note !== before.get(name))
      .map(([name, note]) => ({ name, note: uncounted(note) }));
    log.push({
      kind: 'answer',
      week,
      title,
      reaction: reacted ? (q('[data-scene] [data-part=reaction]')?.textContent ?? '') : null,
      chips: reacted ? qa('[data-scene] [data-chip]').map((c) => c.textContent ?? '') : [],
      notes,
    });
  }

  const STEPS: Record<string, () => Next> = { review: reviewStep, handover: handoverStep, week: weekStep };
  for (let step = 0; step < 200_000; step++) {
    const screen = q('[data-screen]')?.dataset.screen ?? '';
    // Any other screen is where the run ended.
    const next = (Object.hasOwn(STEPS, screen) ? STEPS[screen]! : endedStep)();
    if (next === 'stop') break;
    if (next !== 'next') return next;
  }
  return { ...summary, violations: [...violations] };
}
