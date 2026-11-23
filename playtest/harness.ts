import { expect, type Page, type TestInfo } from '@playwright/test';
import { realContent } from '../tests/balance/harness';
import { BETTER_CHOICES } from '../tests/balance/strategies';
import { DIRECTOR_TITLES, LINE_TITLES, SENIOR_TITLES, type Level, type Look, type PlayEvent } from './metrics';

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
export type Until = 'end' | 'finalEvaluation' | 'letGoWarning' | 'review' | 'edgeWarning' | 'directorHandover';

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
  };
  energyTrail: string[];
  /** What the player read, clicked and saw, in order, for the success-metric scorecard (playtest/metrics.ts). */
  events: PlayEvent[];
}

/** Plays a run in the page, from wherever it is, checking every screen; see `playInPage`. */
export async function play(page: Page, options: PlayOptions): Promise<PlaySummary> {
  const args: InPage = {
    strategy: options.strategy,
    seed: options.seed,
    until: options.until ?? 'end',
    maxWeeks: options.maxWeeks ?? 400,
    // the page cannot import the title table, so it gets the patterns as text
    titles: { line: LINE_TITLES.source, senior: SENIOR_TITLES.map(([, re]) => re.source), director: DIRECTOR_TITLES.map(([, re]) => re.source) },
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
type InPage = Required<PlayOptions> & { titles: { line: string; senior: string[]; director: string[] }; better: Record<string, string> };

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
  const random = () => ((state = (Math.imul(state, 1103515245) + 12345) >>> 0) / 2 ** 32);
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const TIMES = ['morning', 'afternoon', 'night'];
  const ENERGY = ['running on fumes', 'tired', 'okay', 'good', 'fresh', 'at the edge'];
  const VERDICTS = ['above target', 'on target', 'below target'];
  const STATUSES = ['You dealt with it', 'You let it wait', 'It passed before you got to it'];
  const COUNTED = /, (twice|\d+ times)$/;
  /** The titles of each career level's own moments (playtest/metrics.ts); any other moment is a situation. */
  const LINE_TITLES = new RegExp(options.titles.line, 'i');
  const SENIOR_TITLES = options.titles.senior.map((source) => new RegExp(source));
  const DIRECTOR_TITLES = options.titles.director.map((source) => new RegExp(source));

  const violations = new Set<string>();
  const flag = (where: string, what: string) => violations.add(`${where}: ${what}`);
  const summary: PlaySummary = {
    ending: null,
    stoppedAt: null,
    weeks: 0,
    reviews: [],
    career: [],
    violations: [],
    seen: { finalEvaluations: [], letGoWarnings: [], assigned: [], held: [], edgeWarnings: [], waitedLessons: 0, waitedWithoutLesson: [], endings: [], handover: null, seniorChoices: [], directorHandover: null, directorChoices: [] },
    energyTrail: [],
    events: [],
  };

  /** Whether the page shows the senior manager: managers rather than a team. */
  const senior = () => q('[data-panel=managers]') !== null;
  /** Whether the page shows the director: senior managers and their groups. */
  const director = () => q('[data-panel=senior-managers]') !== null;
  const levelOn = (): Level => (director() ? 'director' : senior() ? 'senior' : 'line');
  /** Whether a moment is the career level's own rather than a situation, by its title at the level on screen. */
  const isLevelMoment = (title: string) => (director() ? DIRECTOR_TITLES.some((re) => re.test(title)) : senior() ? SENIOR_TITLES.some((re) => re.test(title)) : LINE_TITLES.test(title));
  /** The game week the senior manager and director levels began, as the player counts weeks: the last review before each. */
  let seniorBase = 0;
  let directorBase = 0;
  let lastReviewWeek = 0;
  /** The week of the run a screen is about, counting from 1: the header's week, or at a higher level its turn's first week. */
  const runWeek = () => {
    const n = Number(text('[data-field=week]'));
    return director() ? directorBase + (n - 1) * 13 + 1 : senior() ? seniorBase + (n - 1) * 4 + 1 : n;
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
  let lastLook = '';
  function look() {
    const entry: Look = {
      kind: 'look',
      week: runWeek(),
      people: qa('[data-panel=team] [data-person]').map((card) => ({
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

  /** Text quality on every leaf of the screen: no placeholders, code names, broken spacing or plural slips. */
  function checkText(where: string) {
    for (const el of qa('[data-screen] p, [data-screen] li, [data-screen] td, [data-screen] h1, [data-screen] h2, [data-screen] h3, [data-screen] button, [data-screen] small, header.status p, header.status div')) {
      if (el.children.length && !['P', 'LI', 'BUTTON'].includes(el.tagName)) continue;
      const t = (el.innerText ?? '').trim();
      if (!t) continue;
      if (/[{}]|\b(undefined|null|NaN|Infinity|\[object)\b/.test(t)) flag(where, `broken text: ${t.slice(0, 120)}`);
      if (/\b[a-z]+[A-Z][a-z]+\w*\b/.test(t)) flag(where, `code name in text: ${t.slice(0, 120)}`);
      if (/ {2,}| [.,;:!?](?!\d)|\.\.(?!\.)/.test(t)) flag(where, `spacing: ${t.slice(0, 120)}`);
      if (/\b1 (weeks|interviews|engineers|projects|reviews|approvals|pages|times)\b/.test(t)) flag(where, `plural: ${t.slice(0, 120)}`);
      if (/\b(\w{2,}) \1\b/i.test(t)) flag(where, `repeated word: ${t.slice(0, 120)}`);
    }
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) flag(where, `wider than the viewport (${document.documentElement.scrollWidth}px)`);
  }

  /** The week screen's own rules: the header, the team cards and the scene. */
  function checkWeek(sc: string, lastSlot: { week: string; slot: number }) {
    const week = text('[data-field=week]');
    const turn = director() ? 'quarter' : senior() ? 'month' : 'week';
    const energy = text('[data-field=energy]');
    if (!ENERGY.includes(energy)) flag('header', `energy word "${energy}"`);
    const warning = q('[data-field=burnout]')?.textContent ?? null;
    if (warning && !/^You're close to the edge\. Take something off your plate\.$|^You've ended \d+ (weeks?|months?|quarters?) at the edge\. \d+ in a row and you burn out\.$/.test(warning)) flag('header', `burnout warning "${warning}"`);
    for (const card of qa('[data-panel=team] [data-person]')) {
      const lines = qa('[data-part=memory] li', card).map((l) => l.textContent ?? '');
      if (lines.length > 3) flag('team', `more than three memory lines`);
      lines.forEach((l, i) => {
        if (l === '1:1') flag('team', 'a 1:1 note in memory');
        if (i > 0 && lines[i - 1] === l) flag('team', `the same memory line twice in a row: ${l}`);
      });
    }
    if (sc === 'recap') {
      const heading = text('[data-scene] [data-part=heading]');
      if (heading !== `How ${turn} ${week} went`) flag('recap', `heading "${heading}" in ${turn} ${week}`);
      const start = text('[data-action=close-recap]');
      if (start !== `Start ${turn} ${Number(week) + 1}`) flag('recap', `button "${start}" after ${turn} ${week}`);
      if (text('[data-scene] .where') !== 'The weekend') flag('recap', 'not set at the weekend');
    }
    if (sc === 'done' && text('[data-scene] .where') !== 'The weekend') flag('done', 'not set at the weekend');
    const besideEndWeek = q('.stage > .end-week') !== null;
    if ((sc === 'moment' || sc === 'reaction') !== besideEndWeek) flag(sc, `End the week beside the scene: ${besideEndWeek}`);
    if (sc === 'reaction') {
      for (const chip of qa('[data-scene] [data-chip]')) if (COUNTED.test(chip.textContent ?? '')) flag('reaction', `a chip with a count: ${chip.textContent}`);
    }
    if (sc === 'moment') {
      // A month's or a quarter's moment says its week of the turn too: "Week 2, Tuesday morning".
      const at = /^(?:Week ([1-9]|1[0-3]), )?(\w+) (\w+)$/.exec(text('[data-field=when]'));
      if ((levelOn() !== 'line') !== Boolean(at?.[1])) flag('moment', `when "${text('[data-field=when]')}" at the ${turn} level`);
      const [day, time] = [at?.[2], at?.[3]];
      const slot = at ? (Number(at[1] ?? 1) - 1) * 15 + DAYS.indexOf(day!) * 3 + TIMES.indexOf(time!) : -1;
      if (slot < 0) flag('moment', `when "${text('[data-field=when]')}"`);
      if (lastSlot.week === week && slot < lastSlot.slot) flag('moment', `week ${week}: ${text('[data-field=when]')} after a later moment`);
      lastSlot.week = week;
      lastSlot.slot = slot;
      const now = qa('[data-panel=days] [data-day]').findIndex((e) => e.dataset.state === 'now');
      if (now !== DAYS.indexOf(day!)) flag('moment', `day strip marks day ${now} on ${day}`);
    }
  }

  function checkReview() {
    const week = text('[data-part=heading]');
    const measures = qa('[data-measure]');
    for (const m of measures) {
      const name = text('[data-field=name]', m);
      if (/^[a-z]+[A-Z]/.test(name) || name === m.dataset.measure) flag('review', `measure shown by its id: ${name}`);
      if (!VERDICTS.includes(text('[data-field=verdict]', m))) flag('review', `verdict "${text('[data-field=verdict]', m)}"`);
      if (!text('[data-field=numbers]', m)) flag('review', `no numbers for ${name}`);
    }
    for (const d of qa('[data-debrief]')) {
      const status = text('[data-field=status]', d);
      if (!STATUSES.includes(status)) flag('review', `debrief status "${status}"`);
      const lesson = q('[data-field=text]', d);
      if (status === 'You dealt with it' && !lesson?.textContent) flag('review', `no lesson for ${text('[data-field=title]', d)}`);
      if (status === 'You let it wait') {
        if (lesson?.textContent) summary.seen.waitedLessons++;
        else if (!text('[data-field=title]', d).startsWith('Onboarding')) summary.seen.waitedWithoutLesson.push(text('[data-field=title]', d));
      }
    }
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
  const card = (name: string) => qa('[data-panel=team] [data-person]').find((c) => text('[data-field=name]', c) === name) ?? null;

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
    const difficulty = q('[data-scene] [data-field=difficulty]') ? bandOf('skill', text('[data-scene] [data-field=difficulty]')) : undefined;
    if (title === 'Night page') {
      const name = /and (.+) is on call\.$/.exec(text('[data-scene] [data-part=text]'))?.[1] ?? '';
      const onCall = card(name);
      return onCall && difficulty !== undefined && bandOf('skill', text('[data-field=skill]', onCall)) >= difficulty ? has('leave') : has('backUp');
    }
    if (title.startsWith('Check-in: ')) {
      const project = qa('[data-project]').find((p) => text('[data-field=name]', p) === title.slice('Check-in: '.length));
      const schedule = project ? text('[data-field=schedule]', project) : 'on schedule';
      if (schedule !== 'on schedule' && bandOf('reputation', text('[data-field=reputation]')) >= OKAY) return has('cutScope');
      return rested ? has('replan') : has('pushOn');
    }
    // The engineers a choice offers, least stressed first, ties by id, as the harness orders them.
    const offered = (prefix: string) =>
      choices
        .filter((c) => (c.dataset.choice ?? '').startsWith(prefix))
        .map((c) => {
          const [skill = '', stress = ''] = (q('[data-part=who]', c)?.textContent ?? '').split(', ');
          return { el: c, id: c.dataset.choice!.slice(prefix.length), skill: bandOf('skill', skill), stress: bandOf('stress', stress) };
        })
        .sort((a, b) => a.stress - b.stress || (a.id < b.id ? -1 : 1));
    if (title === 'Interview') return rested ? has('self') : (offered('ask:')[0]?.el ?? has('skip'));
    if (has('take')) return qa('[data-project]').length < 2 && rested ? has('take') : has('decline');
    // Debt the design review's text calls elevated or worse is worth slowing down for.
    if (has('payDown') && /tech debt is (elevated|high|severe)/.test(text('[data-scene] [data-part=text]'))) return has('payDown');
    const givable = offered('give:');
    const able = givable.find((p) => (difficulty === undefined || p.skill >= difficulty) && p.stress <= OKAY);
    if (able) return able.el;
    if (rested) return has('self');
    // Tired, with no one able: the customer can take part of what they asked.
    if (has('smaller')) return has('smaller');
    // Tired, with no one able: a stretch for someone with room, or push back.
    return givable.find((p) => p.stress <= OKAY)?.el ?? has('pushBack');
  }

  /** Sound practice's habit: the growth focus on whoever a goal names, or who wants growth, or the least skilled. */
  // @spec PLAY-RUN-007
  let habitsWeek = '';
  function soundHabits() {
    if (levelOn() !== 'line' || !['sound', 'mixed'].includes(options.strategy)) return;
    const week = text('[data-field=week]');
    if (week === habitsWeek) return;
    habitsWeek = week;
    const goals = qa('[data-goal] [data-field=text]').map((g) => g.textContent ?? '');
    const people = qa('[data-panel=team] [data-person]').map((c) => ({ id: c.dataset.person!, name: text('[data-field=name]', c), want: text('[data-field=want]', c), skill: bandOf('skill', text('[data-field=skill]', c)) }));
    const growth =
      people.find((p) => goals.includes(`Help ${p.name} grow`)) ??
      people.find((p) => p.want === 'growth') ??
      [...people].sort((a, b) => a.skill - b.skill || (a.id < b.id ? -1 : 1))[0];
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
    const situation = !/^(Check-in|Night page|Interview|Design review|Customer request|New work on offer|Final evaluation|Onboarding)/.test(title);
    // @spec PLAY-RUN-007
    const sound = () => lineSound(choices, by);
    if (senior()) return seniorChoice(choices, by);
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
      case 'mixed': {
        const r = random();
        if (r < 0.1) return null;
        if (r < 0.3) return choices[Math.floor(random() * choices.length)] ?? null;
        return sound();
      }
      case 'heavyThenEase':
        if (!easing && q('[data-field=burnout]')) {
          easing = true;
          setHabit('nightPages', /rotation/i);
        }
        return easing ? by((id) => id.startsWith('give:') || ['leave', 'cutScope', 'decline', 'pushOn', 'oneMoreQuarter'].includes(id)) : hero();
    }
  }

  /** Sound practice at the director, in order of preference among the choices a moment offers (PLAY-RUN-009). */
  const DIRECTOR_SOUND = ['spread', 'coach', 'promote', 'letGo', 'splitPromote', 'merge', 'straight'];
  // @spec PLAY-RUN-009
  function directorChoice(choices: HTMLElement[], by: (pred: (id: string) => boolean) => HTMLElement | null): HTMLElement | null {
    const prefer = (order: string[]) => {
      for (const id of order) {
        const found = by((x) => x === id);
        if (found) return found;
      }
      return null;
    };
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
    const sound = () => (situation ? (better ? by((x) => x === better) : null) ?? choices[0] ?? null : q('[data-scene] [data-detail=bets]') ? fundBets() : (peerAsk() ?? prefer(DIRECTOR_SOUND) ?? choices[0] ?? null));
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
    const prefer = (order: string[]) => {
      for (const id of order) {
        const found = by((x) => x === id);
        if (found) return found;
      }
      return null;
    };
    const title = text('[data-scene] [data-part=heading]');
    const better = isLevelMoment(title) ? undefined : options.better[title];
    // A situation: its better choice from the table, or the first offered (PLAY-RUN-006).
    const sound = () => (isLevelMoment(title) ? prefer(SENIOR_SOUND) : better ? by((x) => x === better) : null) ?? choices[0] ?? null;
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
  if (options.strategy === 'hero' || options.strategy === 'heavyThenEase') setHabit('nightPages', /you take/i);
  if (q('[data-scene]')?.dataset.scene === 'before-monday') {
    look();
    read('before-monday', q('[data-scene]'));
  }
  press(q('[data-action=start-week]'));

  const lastSlot = { week: '', slot: -1 };
  let lastRecapWeek = '';
  for (let step = 0; step < 200_000; step++) {
    const screen = q('[data-screen]')?.dataset.screen;
    if (screen === 'review') {
      checkText('review');
      checkReview();
      const heading = text('[data-part=heading]');
      if (!readScreens.has(`review|${heading}`)) {
        read(`review|${heading}`, q('[data-screen]'));
        const turn = Number(/\d+/.exec(heading)?.[0] ?? 0);
        const reviewWeek = heading.startsWith('Quarter') ? directorBase + turn * 13 : heading.startsWith('Month') ? seniorBase + turn * 4 : turn;
        lastReviewWeek = reviewWeek;
        log.push({ kind: 'review', week: reviewWeek, rating: text('[data-field=rating]'), promoted: text('[data-field=outcome]') === 'You are being promoted.' });
      }
      if (options.until === 'review') return { ...summary, stoppedAt: 'review', violations: [...violations] };
      press(q('[data-action=acknowledge]'));
      continue;
    }
    if (screen === 'handover') {
      checkText('handover');
      // @spec PLAY-RUN-005
      const TRUST = ['wary', 'guarded', 'neutral', 'trusting', 'loyal'];
      const offered = qa('[data-handover]').map((b) => ({ id: b.dataset.handover!, trust: text('[data-field=trust]', b), want: q('[data-field=want]', b)?.textContent ?? null }));
      const growers = offered.filter((o) => o.want === 'growth' && TRUST.indexOf(o.trust) >= 3).sort((a, b) => TRUST.indexOf(b.trust) - TRUST.indexOf(a.trust));
      const choice = growers[0]?.id ?? 'hire';
      // @spec PLAY-RUN-009
      const toDirector = /promoted to director/i.test(text('[data-part=heading]'));
      if (toDirector) {
        summary.seen.directorHandover = { choice, options: offered.filter((o) => o.id !== 'hire') };
        directorBase = lastReviewWeek;
        // left on the handover screen, for a player that takes over from here
        if (options.until === 'directorHandover') return { ...summary, stoppedAt: 'director handover', violations: [...violations] };
      } else {
        summary.seen.handover = { choice, options: offered.filter((o) => o.id !== 'hire') };
        seniorBase = lastReviewWeek;
      }
      read('handover', q('[data-screen]'));
      press(q(`[data-handover="${choice}"]`));
      continue;
    }
    if (screen !== 'week') {
      checkText('ended');
      checkEnded();
      read('ended', q('[data-screen]'));
      const leftText = text('[data-part=career] [data-field=left]');
      const left = leftText === 'nobody' ? [] : leftText.split(', ').map((entry) => /^(.*) \((.*)\)$/.exec(entry)).filter((m) => m !== null).map((m) => ({ name: m[1]!, reason: m[2]! }));
      log.push({ kind: 'ended', ending: summary.ending ?? '', left });
      break;
    }
    const sc = q('[data-scene]')?.dataset.scene ?? '';
    checkText(sc);
    checkWeek(sc, lastSlot);
    look();
    layout();
    // Habits change once a week, at its first scene, before any of its moments is answered, as the harness changes them.
    if (sc !== 'recap') soundHabits();
    const sceneKey = `${text('[data-field=week]')}|${sc}|${text('[data-scene] [data-part=heading]')}|${text('[data-field=when]')}`;
    if (sc === 'moment' && !readScreens.has(sceneKey)) {
      const heading = text('[data-scene] [data-part=heading]');
      log.push({ kind: 'moment', week: runWeek(), title: heading, level: levelOn() });
    }
    read(sceneKey, q('[data-scene]'));
    const warning = q('[data-field=burnout]')?.textContent;
    if (warning && !summary.seen.edgeWarnings.includes(warning)) summary.seen.edgeWarnings.push(warning);
    if (options.until === 'edgeWarning' && warning) return { ...summary, stoppedAt: 'edgeWarning', violations: [...violations] };
    if (sc === 'recap') {
      const week = text('[data-field=week]');
      if (week !== lastRecapWeek) {
        lastRecapWeek = week;
        // At the senior manager the header counts months from the level's start; the run counts weeks.
        summary.weeks = director() ? directorBase + Number(week) * 13 : senior() ? seniorBase + Number(week) * 4 : Number(week);
        summary.energyTrail.push(`${week}:${text('[data-field=energy]')}`);
        summary.seen.assigned.push(...qa('[data-part=recap-assigned] li').map((l) => l.textContent ?? ''));
        summary.seen.held.push(...qa('[data-part=recap-held] li').map((l) => l.textContent ?? ''));
      }
      if (summary.weeks >= options.maxWeeks) return { ...summary, stoppedAt: `week ${summary.weeks}`, violations: [...violations] };
      press(q('[data-action=close-recap]'));
      continue;
    }
    if (sc === 'done') {
      press(q('[data-action=finish-week]'));
      continue;
    }
    if (sc === 'before-monday') {
      press(q('[data-action=start-week]'));
      continue;
    }
    if (sc === 'reaction') {
      press(q('[data-action=continue]'));
      continue;
    }
    if (sc !== 'moment') {
      flag('week', `unexpected scene "${sc}"`);
      break;
    }
    const title = text('[data-scene] [data-part=heading]');
    if (title.startsWith('Final evaluation')) {
      summary.seen.finalEvaluations.push({ title, choices: qa('[data-scene] [data-choice]').map((c) => c.childNodes[0]?.textContent ?? '') });
      if (options.until === 'finalEvaluation') return { ...summary, stoppedAt: 'finalEvaluation', violations: [...violations] };
    }
    const letGo = q('[data-scene] [data-choice=honest-let-go]');
    if (letGo) {
      summary.seen.letGoWarnings.push(letGo.textContent ?? '');
      if (options.until === 'letGoWarning') return { ...summary, stoppedAt: 'letGoWarning', violations: [...violations] };
    }
    const offered = qa('[data-scene] [data-choice]').map((c) => c.dataset.choice ?? '');
    // Calibration, settled on the evidence by every player who plays sound practice for it.
    if (senior() && q('[data-scene] [data-calibration]') && (options.strategy === 'sound' || options.strategy === 'mixed' || options.strategy === 'waiter')) {
      summary.seen.seniorChoices.push({ title, offered, chosen: 'settle' });
      const week = runWeek();
      settleOnEvidence();
      log.push({ kind: 'answer', week, title, reaction: q('[data-scene] [data-part=reaction]')?.textContent ?? null, chips: qa('[data-scene] [data-chip]').map((c) => c.textContent ?? ''), notes: [] });
      continue;
    }
    const choice = choose();
    if (senior()) summary.seen.seniorChoices.push({ title, offered, chosen: choice?.dataset.choice ?? null });
    if (director()) summary.seen.directorChoices.push({ title, offered, chosen: choice?.dataset.choice ?? choice?.dataset.action ?? null });
    const week = runWeek();
    if (choice) {
      const before = firstNotes();
      press(choice, true);
      const reacted = q('[data-scene]')?.dataset.scene === 'reaction';
      // A refused answer leaves the moment open: flag it and let it wait, rather than choose it again forever.
      if (!reacted && q('[data-scene]')?.dataset.scene === 'moment' && q(`[data-scene][data-moment="${q('[data-scene]')!.dataset.moment}"] .error, [data-scene] [role=alert]`)) {
        flag('moment', `"${title}" refused the answer ${choice.dataset.choice ?? ''}`);
        press(q('[data-scene] [data-action=wait]'), true);
        log.push({ kind: 'wait', week });
        continue;
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
    } else {
      press(q('[data-scene] [data-action=wait]'), true);
      log.push({ kind: 'wait', week });
    }
  }
  return { ...summary, violations: [...violations] };
}
