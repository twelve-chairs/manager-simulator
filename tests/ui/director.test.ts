// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { directorLevel, type DirectorState } from '../../src/levels/director';
import { lineManagerLevel } from '../../src/levels/line-manager';
import { seniorManagerLevel } from '../../src/levels/senior-manager';
import { newRun, type Dependencies, type Run } from '../../src/loop';
import { BAND_WORDS } from '../../src/ui/bands';
import { DIRECTOR_HELP_TOPICS } from '../../src/ui/director';
import { endWeeks, step, stubReview } from '../loop/fixtures';
import { $, $$, CONTENT, click, makeApp, select, text } from './fixtures';

const all = (outcome: 'promote' | 'continue' | 'stayed' = 'promote'): Dependencies => ({ levels: [lineManagerLevel, seniorManagerLevel, directorLevel], review: stubReview(outcome).review });
/** A run promoted from line manager, then from senior manager at its first review: in the director's handover. */
function promotedTwice(seed = 1): Run {
  let r = step(endWeeks(newRun(seed, CONTENT, all()), 13, all()), { kind: 'acknowledge' }, all());
  r = step(r, { kind: 'handover', choice: 'hire' }, all());
  r = endWeeks(r, 6, all());
  return step(r, { kind: 'acknowledge' }, all());
}
/** The twice-promoted run handed over to an outside hire, its later reviews answered with `outcome`. */
const director = (seed = 1, outcome: 'promote' | 'continue' | 'stayed' = 'continue'): Run => step(promotedTwice(seed), { kind: 'handover', choice: 'hire' }, all(outcome));
const scene = (root: ParentNode) => $(root, '[data-scene]').dataset.scene;
const lvl = (run: Run) => run.level as DirectorState;
/** Plays on from the first quarter's opening scene to its first moment of the given kind. */
const showing = (root: ParentNode, kind: string) => root.querySelector(`[data-scene] [data-detail=${kind}]`) !== null;
function toMoment(root: ParentNode, kind: string) {
  click(root, '[data-action=start-week]');
  for (let i = 0; i < 20 && scene(root) === 'moment' && !showing(root, kind); i++) click(root, '[data-action=wait]');
}

describe('the director’s handover', () => {
  // @spec UI-DIR-015
  it('says the player is promoted to director and asks who leads their group, offering each manager and an outside hire', () => {
    const run = promotedTwice(2);
    expect(run.phase).toBe('handover');
    const { root } = makeApp({ run, deps: all() });
    expect(text(root, '[data-part=heading]')).toMatch(/promoted to director/i);
    expect(text(root, '[data-part=question]')).toMatch(/who leads your group now\?/i);
    expect($$(root, '[data-handover]').map((b) => b.dataset.handover)).toEqual(run.handoverChoices!.map((c) => c.id));
    const first = run.handoverChoices![0]!;
    expect(text($(root, `[data-handover="${first.id}"]`), '[data-field=skill]')).toBe(BAND_WORDS.skill[Math.min(4, Math.floor(first.skill! / 20))]);
    expect(text(root, '[data-handover=hire]')).toMatch(/capable senior manager you don.t know yet/i);
    expect(text(root, '[data-part=trade]')).toMatch(/trust they.ve built.*unsettles the group/i);
  });
});

describe('the director’s week screen', () => {
  // @spec UI-DIR-001, UI-WEEK-016
  it('opens the first quarter on a scene with the habits and How to play, closed by Start quarter 1', () => {
    const { root } = makeApp({ run: director(3), deps: all() });
    expect(scene(root)).toBe('before-monday');
    expect(text(root, '[data-scene] .where')).toBe('Before the quarter');
    expect($$(root, '[data-scene] [data-habit]')).toHaveLength(3);
    expect(text(root, '[data-action=start-week]')).toBe('Start quarter 1');
    expect(text(root, '.week-number')).toMatch(/^Quarter 1 · review in 2 quarters/);
  });

  // @spec UI-DIR-002, UI-DIR-003
  it('shows a card per senior manager with their group, its mood labelled by the survey', () => {
    const run = director(3);
    const { root } = makeApp({ run, deps: all() });
    const cards = $$(root, '[data-panel=senior-managers] [data-senior-manager]');
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(text(card, '[data-field=skill]')).toMatch(new RegExp(BAND_WORDS.skill.join('|')));
      expect(card.querySelector('[data-group]')).not.toBeNull();
      expect(text(card, '[data-group] [data-field=source]')).toBe('at the survey in quarter 1');
      expect(text(card, '[data-group] [data-field=headcount]')).toMatch(/\d+ people/);
    }
  });

  // @spec UI-DIR-004, UI-DIR-005, UI-DIR-006
  it('shows the room above, the bets, and the three director habits', () => {
    const { root, app } = makeApp({ run: director(3), deps: all() });
    const above = $$(root, '[data-panel=upward] [data-outsider]');
    expect(above).toHaveLength(3);
    expect(text(above[0]!, '[data-field=role]')).toBe('your executive');
    expect(text(above[1]!, '[data-field=role]')).toBe('a peer director');
    expect(text(above[0]!, '[data-field=trust]')).toMatch(new RegExp(BAND_WORDS.trust.join('|')));
    expect(text(root, '[data-panel=bets]')).toMatch(/no bet/i);
    expect($$(root, '[data-panel=habits] [data-habit]').map((s) => s.dataset.habit)).toEqual(['time', 'staffMeeting', 'listeningTour']);
    select(root, '[data-panel=habits] [data-habit=time]', 'upward');
    const s = app.state();
    expect(s.screen === 'run' && lvl(s.run).habits.time).toBe('upward');
  });

  // @spec UI-DIR-014
  it('holds the director’s How to play topics and panel help', () => {
    const { root } = makeApp({ run: director(3), deps: all() });
    expect($$(root, '[data-panel=help] [data-topic]').map((t) => t.dataset.topic)).toEqual(DIRECTOR_HELP_TOPICS.map((t) => t.id));
    for (const panel of ['senior-managers', 'upward', 'bets', 'habits']) expect(text(root, `[data-panel=${panel}] [data-part=help]`).length).toBeGreaterThan(10);
  });
});

describe('the director’s scenes', () => {
  // @spec UI-DIR-007
  it('places headcount with a stepper per group and sends the placement', () => {
    const { root, app } = makeApp({ run: director(4), deps: all() });
    toMoment(root, 'headcount');
    expect(showing(root, 'headcount')).toBe(true);
    const given = Number(text(root, '[data-field=heads-given]'));
    const groups = $$(root, '[data-step-up^="group:"]');
    expect(groups.length).toBe(3);
    if (given > 0) {
      groups[0]!.click();
      expect(Number(text(root, '[data-field=heads-left]'))).toBe(given - 1);
    }
    const before = app.state();
    click(root, '[data-action=place-heads]');
    const after = app.state();
    expect(before.screen === 'run' && after.screen === 'run' && after.run.commands.length).toBe(before.screen === 'run' ? before.run.commands.length + 1 : -1);
    expect(['reaction', 'moment']).toContain(scene(root));
    const last = after.screen === 'run' ? after.run.commands.at(-1) : undefined;
    expect(last).toMatchObject({ kind: 'answer', choiceId: expect.stringMatching(/^place:/) });
  });

  // @spec UI-DIR-008
  it('funds bets with a group chosen for each, at most two', () => {
    const { root, app } = makeApp({ run: director(4), deps: all() });
    toMoment(root, 'headcount');
    click(root, '[data-choice=spread]');
    if (scene(root) === 'reaction') click(root, '[data-action=continue]');
    for (let i = 0; i < 10 && !showing(root, 'bets'); i++) click(root, '[data-action=wait]');
    expect(showing(root, 'bets')).toBe(true);
    const offers = $$(root, '[data-offer]');
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(text(offers[0]!, '[data-field=stakes]')).toMatch(/lands|fails/);
    // what a group can carry: its stress as last seen and its projects, and what speeds or slows a bet
    expect(text(root, '[data-part=bet-capacity]')).toMatch(/strained group carries a bet slowly/);
    const option = (($$(root, '[data-offer] select')[0] as unknown as HTMLSelectElement).options[1]!.textContent ?? '');
    expect(option).toMatch(/^.+: (calm|steady|busy|strained|overwhelmed), \d+ projects?$/);
    const pickers = $$(root, '[data-offer] select');
    const group = (pickers[0] as unknown as HTMLSelectElement).options[1]!.value;
    (pickers[0] as unknown as HTMLSelectElement).value = group;
    pickers[0]!.dispatchEvent(new Event('change', { bubbles: true }));
    click(root, '[data-action=fund-bets]');
    const s = app.state();
    const last = s.screen === 'run' ? s.run.commands.at(-1) : undefined;
    expect(last).toMatchObject({ kind: 'answer', choiceId: expect.stringMatching(/^fund:/) });
    expect(s.screen === 'run' && lvl(s.run).bets).toHaveLength(1);
  });

  // @spec UI-DIR-009
  it('shows a senior manager’s skill beside choices that depend on them', () => {
    const run = director(5);
    const l = lvl(run);
    const trouble = { ...l, moments: [{ id: 'dmx', kind: 'trouble' as const, week: 0, day: 0, time: 'morning' as const, title: 'A group is in trouble', text: 'It is.', status: 'open' as const, choices: [{ id: 'coach', label: 'Coach' }], groupId: l.groupIds[0]!, personId: Object.keys(l.leniency)[0]! }] };
    const r = { ...run, level: trouble, week: [{ source: 'level' as const, id: 'dmx', day: 0, time: 'morning' as const, title: 'A group is in trouble', status: 'open' as const }] };
    const { root } = makeApp({ run: r, deps: all() });
    click(root, '[data-action=start-week]');
    expect(text(root, '[data-choice=coach] [data-part=who]')).toMatch(/^leads: /);
  });
});

describe('the director’s recap, review and end', () => {
  // @spec UI-DIR-010, UI-DIR-011
  it('shows chips after a choice and a recap folded into The whole quarter', () => {
    const { root } = makeApp({ run: director(6), deps: all() });
    toMoment(root, 'headcount');
    click(root, '[data-choice=spread]');
    expect(scene(root)).toBe('reaction');
    expect($$(root, '[data-chip]').some((c) => /more people|one more person/.test(c.textContent ?? ''))).toBe(true);
    for (let i = 0; i < 30 && scene(root) !== 'recap'; i++) {
      const s = scene(root);
      if (s === 'reaction') click(root, '[data-action=continue]');
      else if (s === 'moment') click(root, '[data-action=wait]');
      else if (s === 'done') click(root, '[data-action=finish-week]');
    }
    expect(scene(root)).toBe('recap');
    expect(text(root, '[data-part=heading]')).toBe('How quarter 1 went');
    expect(text(root, '[data-part=recap-whole-week] summary')).toBe('The whole quarter');
    expect(text(root, '[data-action=close-recap]')).toBe('Start quarter 2');
  });

  // @spec UI-DIR-012, UI-DIR-013
  it('names the director’s measures at review, and ends a stayed run with the director’s part of the career', () => {
    let run = director(7, 'stayed');
    run = endWeeks(run, 2, all('stayed'));
    expect(run.phase).toBe('review');
    const { root } = makeApp({ run, deps: all('stayed') });
    expect(text(root, '[data-part=heading]')).toBe('Quarter 2 review');
    const names = $$(root, '[data-measure] [data-field=name]').map((n) => n.textContent);
    for (const n of ["Projects shipped on time", "People you'd have kept who left", "Your executive's confidence"]) expect(names).toContain(n);
    click(root, '[data-action=acknowledge]');
    expect(text(root, '[data-field=ending]')).toBe('You stayed a director. Three years went by without the promotion.');
    expect(text(root, '[data-field=quarters]')).toBe('2');
    expect(text(root, '[data-field=senior-managers-joined]')).toBe('nobody');
  });
});

describe('the game', () => {
  // @spec UI-DIR-016
  it('shows the director rung as playable when the game has the director level', () => {
    const { root } = makeApp({ deps: all() });
    const rungs = $$(root, '[data-part=ladder] li');
    expect(rungs.at(-1)!.textContent).toMatch(/Playable now/);
  });
});
