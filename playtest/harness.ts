import { expect, type Page, type TestInfo } from '@playwright/test';

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
export type Until = 'end' | 'finalEvaluation' | 'letGoWarning' | 'review' | 'edgeWarning';

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
  };
  energyTrail: string[];
}

/** Plays a run in the page, from wherever it is, checking every screen; see `playInPage`. */
export async function play(page: Page, options: PlayOptions): Promise<PlaySummary> {
  const args: Required<PlayOptions> = { strategy: options.strategy, seed: options.seed, until: options.until ?? 'end', maxWeeks: options.maxWeeks ?? 400 };
  return page.evaluate(playInPage, args);
}

/** Attaches a run's summary to the test report, so a run can be read without replaying it. */
export async function attachSummary(testInfo: TestInfo, name: string, summary: PlaySummary) {
  const { violations, ...rest } = summary;
  await testInfo.attach(name, { body: JSON.stringify({ ...rest, violations: violations.length }, null, 2), contentType: 'application/json' });
}

/**
 * Runs inside the page: a scripted player plays the run screen by screen through the page's own buttons and
 * selects, and every screen is checked as it goes. It is self-contained, because Playwright sends it to the page
 * as source.
 */
function playInPage(options: Required<PlayOptions>): PlaySummary {
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
  const BETTER = ['blameless', 'direct', 'ask', 'real-plan', 'honest', 'honest-let-go', 'separately', 'write-it', 'trade', 'sprint', 'buddy-up', 'time-off', 'ask-priorities', 'ask-delegation', 'ask-wants'];
  const COUNTED = /, (twice|\d+ times)$/;

  const violations = new Set<string>();
  const flag = (where: string, what: string) => violations.add(`${where}: ${what}`);
  const summary: PlaySummary = {
    ending: null,
    stoppedAt: null,
    weeks: 0,
    reviews: [],
    career: [],
    violations: [],
    seen: { finalEvaluations: [], letGoWarnings: [], assigned: [], held: [], edgeWarnings: [], waitedLessons: 0, waitedWithoutLesson: [], endings: [] },
    energyTrail: [],
  };

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
    const energy = text('[data-field=energy]');
    if (!ENERGY.includes(energy)) flag('header', `energy word "${energy}"`);
    const warning = q('[data-field=burnout]')?.textContent ?? null;
    if (warning && !/^You're close to the edge\. Take something off your plate\.$|^You've ended \d+ weeks? at the edge\. 4 in a row and you burn out\.$/.test(warning)) flag('header', `burnout warning "${warning}"`);
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
      if (heading !== `How week ${week} went`) flag('recap', `heading "${heading}" in week ${week}`);
      const start = text('[data-action=close-recap]');
      if (start !== `Start week ${Number(week) + 1}`) flag('recap', `button "${start}" after week ${week}`);
      if (text('[data-scene] .where') !== 'The weekend') flag('recap', 'not set at the weekend');
    }
    if (sc === 'done' && text('[data-scene] .where') !== 'The weekend') flag('done', 'not set at the weekend');
    const besideEndWeek = q('.stage > .end-week') !== null;
    if ((sc === 'moment' || sc === 'reaction') !== besideEndWeek) flag(sc, `End the week beside the scene: ${besideEndWeek}`);
    if (sc === 'reaction') {
      for (const chip of qa('[data-scene] [data-chip]')) if (COUNTED.test(chip.textContent ?? '')) flag('reaction', `a chip with a count: ${chip.textContent}`);
    }
    if (sc === 'moment') {
      const [day, time] = text('[data-field=when]').split(' ');
      const slot = DAYS.indexOf(day!) * 3 + TIMES.indexOf(time!);
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

  let easing = false;
  /** The scripted player's choice for the current moment, or null to let it wait. */
  function choose(): HTMLElement | null {
    const choices = qa('[data-scene] [data-choice]');
    const ids = choices.map((c) => c.dataset.choice ?? '');
    const by = (pred: (id: string, el: HTMLElement) => boolean) => choices.find((c) => pred(c.dataset.choice ?? '', c)) ?? null;
    const who = (el: HTMLElement) => q('[data-part=who]', el)?.textContent ?? '';
    const energy = text('[data-field=energy]');
    const rested = ['okay', 'good', 'fresh'].includes(energy);
    const title = text('[data-scene] [data-part=heading]');
    const situation = !/^(Check-in|Night page|Interview|Design review|Customer request|New work on offer|Final evaluation|Onboarding)/.test(title);
    const sound = () =>
      by((id) => BETTER.includes(id)) ??
      by((id) => id === 'letGo') ??
      by((id) => id === 'backUp') ??
      by((id, el) => id.startsWith('give:') && !/strained|overwhelmed/.test(who(el)) && !/learning/.test(who(el))) ??
      (rested ? by((id) => id === 'self' || id === 'replan' || (id === 'take' && qa('[data-project]').length < 2)) : null) ??
      by((id, el) => id.startsWith('ask:') && !/strained|overwhelmed/.test(who(el))) ??
      by((id) => ['cutScope', 'decline', 'pushBack', 'pushOn', 'skip'].includes(id));
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

  if (options.strategy === 'sound' || options.strategy === 'decline' || options.strategy === 'waiter' || options.strategy === 'mixed') setHabit('oneOnOnes', /every week|weekly/i);
  if (options.strategy === 'hero' || options.strategy === 'heavyThenEase') setHabit('nightPages', /you take/i);
  q('[data-action=start-week]')?.click();

  const lastSlot = { week: '', slot: -1 };
  let lastRecapWeek = '';
  for (let step = 0; step < 200_000; step++) {
    const screen = q('[data-screen]')?.dataset.screen;
    if (screen === 'review') {
      checkText('review');
      checkReview();
      if (options.until === 'review') return { ...summary, stoppedAt: 'review', violations: [...violations] };
      q('[data-action=acknowledge]')?.click();
      continue;
    }
    if (screen !== 'week') {
      checkText('ended');
      checkEnded();
      break;
    }
    const sc = q('[data-scene]')?.dataset.scene ?? '';
    checkText(sc);
    checkWeek(sc, lastSlot);
    const warning = q('[data-field=burnout]')?.textContent;
    if (warning && !summary.seen.edgeWarnings.includes(warning)) summary.seen.edgeWarnings.push(warning);
    if (options.until === 'edgeWarning' && warning) return { ...summary, stoppedAt: 'edgeWarning', violations: [...violations] };
    if (sc === 'recap') {
      const week = text('[data-field=week]');
      if (week !== lastRecapWeek) {
        lastRecapWeek = week;
        summary.weeks = Number(week);
        summary.energyTrail.push(`${week}:${text('[data-field=energy]')}`);
        summary.seen.assigned.push(...qa('[data-part=recap-assigned] li').map((l) => l.textContent ?? ''));
        summary.seen.held.push(...qa('[data-part=recap-held] li').map((l) => l.textContent ?? ''));
      }
      if (summary.weeks >= options.maxWeeks) return { ...summary, stoppedAt: `week ${summary.weeks}`, violations: [...violations] };
      q('[data-action=close-recap]')?.click();
      continue;
    }
    if (sc === 'done') {
      q('[data-action=finish-week]')?.click();
      continue;
    }
    if (sc === 'reaction') {
      q('[data-action=continue]')?.click();
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
    const choice = choose();
    if (choice) choice.click();
    else q('[data-scene] [data-action=wait]')?.click();
  }
  return { ...summary, violations: [...violations] };
}
