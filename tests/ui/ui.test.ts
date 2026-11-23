// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { band, lineManagerLevel, type LineState, type View } from '../../src/levels/line-manager';
import type { AnyLevel, Dependencies, Run } from '../../src/loop';
import { BAND_WORDS } from '../../src/ui/bands';
import { emphasis } from '../../src/ui/text';
import { current, waitUntil } from '../loop/fixtures';
import { $, $$, CONTENT, DEPS, click, endWeeks, level, makeApp, run, select, step, text } from './fixtures';
import { sit } from '../situations/fixtures';

const L = lineManagerLevel;
const word = (kind: keyof typeof BAND_WORDS, value: number) => BAND_WORDS[kind][band(value)];
const scene = (root: ParentNode) => $(root, '[data-scene]').dataset.scene;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** A run in week 0 past Before Monday: a moment has been let wait, so the page opens on the current moment. */
const playing = (seed = 1) => step(run(seed), { kind: 'wait' });

/** A run whose current moment is a line manager work moment offering to give the work to someone. */
function atWorkMoment(): Run {
  for (let seed = 1; seed < 40; seed++) {
    let r = playing(seed);
    while (current(r)) {
      const m = current(r)!;
      const lm = m.source === 'level' ? level(r).moments.find((x) => x.id === m.id)! : undefined;
      if (lm?.kind === 'work' && lm.choices.some((c) => c.id.startsWith('give:'))) return r;
      r = step(r, { kind: 'wait' });
    }
  }
  throw new Error('no seed has a work moment to give away');
}

describe('the page', () => {
  // @spec UI-SHELL-001
  it('starts on the start screen with a new seed, and begins a run from it', () => {
    const { root, app } = makeApp();
    expect($(root, '[data-screen]').dataset.screen).toBe('start');
    click(root, '[data-action=begin]');
    expect($(root, '[data-screen]').dataset.screen).toBe('week');
    const state = app.state();
    expect(state.screen === 'run' && state.run.seed).toBe(42);
  });

  // @spec UI-SHELL-006
  it('shows the disclaimer on the start screen', () => {
    const { root } = makeApp();
    expect(text(root, '[data-part=disclaimer]')).toBe(
      "Manager Simulator is a game. Its people, companies and situations are fictional, and its outcomes are simplified for play. It is not management, career, legal or HR advice; don't use it to make real decisions about real people.",
    );
  });

  // @spec UI-SHELL-007
  it('shows the version the build stamped on the start screen', () => {
    const { root } = makeApp({ version: 'v0.1.142 (93face2)' });
    expect(text(root, '[data-field=version]')).toBe('Version v0.1.142 (93face2)');
  });

  // @spec UI-SHELL-012
  it('shows the copyright notice on the start screen', () => {
    expect(text(makeApp().root, '[data-part=copyright]')).toBe('© 2026 Twelve Chairs Software. All rights reserved.');
  });

  // @spec UI-SHELL-008
  it('shows the seed on no screen', () => {
    const seed = 3141592653;
    const start = makeApp({ seeds: [seed] }).root;
    expect($(start, '[data-screen]').dataset.screen).toBe('start');
    const week = playing(seed);
    const review = endWeeks(run(seed), 13);
    expect(review.phase).toBe('review');
    const ended = { ...review, phase: 'ended' as const, ending: 'burnout' as const, review: null };
    for (const root of [start, makeApp({ run: week }).root, makeApp({ run: review }).root, makeApp({ run: ended }).root]) {
      expect(root.textContent).not.toContain(String(seed));
      expect(root.querySelector('[data-field=seed]')).toBeNull();
    }
  });

  // @spec UI-SHELL-009
  it('pitches the climb on the start screen, with buttons to start a new game and load a saved one', () => {
    const { root, app } = makeApp();
    expect(text(root, '[data-part=tagline]')).toBe('Every promotion is a new job.');
    expect(text(root, '[data-part=pitch]')).toBe(
      'Start with a team of five engineers and a pager. Earn your way to managing managers, then a whole organization, and learn a new job at every step.',
    );
    expect(text(root, '[data-action=load]')).toBe('Load a saved game');
    // the file input is hidden behind the button, which opens its picker
    const input = $(root, '[data-input=import]') as HTMLInputElement;
    expect(input.hidden).toBe(true);
    let opened = 0;
    input.click = () => void opened++;
    click(root, '[data-action=load]');
    expect(opened).toBe(1);
    expect(text(root, '[data-action=begin]')).toBe('Start a new game');
    click(root, '[data-action=begin]');
    expect(app.state().screen).toBe('run');
  });

  // @spec UI-SHELL-010
  it('shows the career ladder from line manager up', () => {
    const rungs = $$(makeApp().root, 'ol[data-part=ladder] > li').map((li) => [text(li, '[data-field=level]'), text(li, '[data-part=rung-text]')]);
    expect(rungs).toEqual([
      ['Line manager', 'You manage a team of five engineers. Each turn is a week.'],
      ['Senior manager', 'You manage several teams, through their managers. Each turn is a month.'],
      ['Director and above', 'You manage an organization. Each turn is a quarter.'],
    ]);
  });

  // @spec UI-SHELL-011
  it('marks the rungs the game has a level for as playable, and the rest as coming later', () => {
    const statuses = (deps: Dependencies) => $$(makeApp({ deps }).root, '[data-part=ladder] [data-field=status]').map((s) => s.textContent);
    expect(statuses(DEPS)).toEqual(['Playable now', 'Coming later', 'Coming later']);
    const as = (id: string) => ({ ...lineManagerLevel, params: { ...lineManagerLevel.params, id } }) as unknown as AnyLevel;
    expect(statuses({ ...DEPS, levels: [lineManagerLevel, as('senior-manager')] })).toEqual(['Playable now', 'Playable now', 'Coming later']);
    // director and above may span several levels: any of them lights the rung
    expect(statuses({ ...DEPS, levels: [lineManagerLevel, as('vp')] })).toEqual(['Playable now', 'Coming later', 'Playable now']);
  });

  // @spec UI-SHELL-002
  it('shows the screen for the run’s phase', () => {
    expect($(makeApp({ run: run() }).root, '[data-screen]').dataset.screen).toBe('week');
    const review = endWeeks(run(), 13);
    expect(review.phase).toBe('review');
    expect($(makeApp({ run: review }).root, '[data-screen]').dataset.screen).toBe('review');
    const ended = { ...review, phase: 'ended' as const, ending: 'burnout' as const, review: null };
    expect($(makeApp({ run: ended }).root, '[data-screen]').dataset.screen).toBe('ended');
  });

  // @spec UI-SHELL-002
  it('says so rather than crashing when a run’s level is not available', () => {
    const { root } = makeApp({ run: { ...run(), levelId: 'director' } });
    expect($(root, '[data-screen]').dataset.screen).toBe('unavailable');
  });

  // @spec UI-SHELL-003, UI-WEEK-003
  it('redraws from the new run after a command', () => {
    const { root, app } = makeApp({ run: playing() });
    expect(scene(root)).toBe('moment');
    click(root, '[data-action=end-week]');
    expect(scene(root)).toBe('recap');
    const state = app.state();
    expect(state.screen === 'run' && state.run.commands).toEqual([{ kind: 'wait' }, { kind: 'endWeek' }]);
  });

  // @spec UI-SHELL-004
  it('shows a refused command’s error next to its control and changes nothing else', () => {
    const refusing: AnyLevel = { ...L, choose: () => ({ ok: false, error: 'refused for the test' }), plan: () => ({ ok: false, error: 'habit refused' }) };
    const deps = { ...DEPS, levels: [refusing] };
    const r = waitUntil(playing(), 'level', deps);
    const { root, app } = makeApp({ run: r, deps });
    const choice = $(root, '[data-scene] [data-choice]');
    choice.click();
    expect(text($(root, '[data-scene] [data-choice]').parentElement!, '[data-error]')).toBe('refused for the test');
    let state = app.state();
    expect(state.screen === 'run' && state.run).toEqual(r);
    select(root, '[data-panel=habits] [data-habit=ceremonies]', 'light');
    expect(text($(root, '[data-panel=habits] [data-habit=ceremonies]').parentElement!, '[data-error]')).toBe('habit refused');
    state = app.state();
    expect(state.screen === 'run' && state.run).toEqual(r);
  });

  // @spec UI-SHELL-005
  it('moves focus to the scene heading when the scene changes, and keeps it on a habit control', () => {
    const { root } = makeApp({ run: playing(), attach: true });
    click(root, '[data-scene] [data-action=wait]');
    expect(document.activeElement).toBe($(root, '[data-scene] [data-part=heading]'));
    $(root, '[data-scene] [data-choice]').click();
    expect(scene(root)).toBe('reaction');
    expect(document.activeElement).toBe($(root, '[data-scene] [data-part=heading]'));
    $(root, '[data-panel=habits] [data-habit=ceremonies]').focus();
    select(root, '[data-panel=habits] [data-habit=ceremonies]', 'light');
    expect(document.activeElement).toBe($(root, '[data-panel=habits] [data-habit=ceremonies]'));
    click(root, '[data-action=end-week]');
    expect(document.activeElement).toBe($(root, '[data-scene] [data-part=heading]'));
  });

  // @spec UI-TEXT-001
  it('puts names and content on the page as text, never as markup', () => {
    const r = structuredClone(playing());
    const e = Object.keys(r.sim.people).sort()[0]!;
    r.sim.people[e]!.name = '<img src=x onerror="alert(1)">Ana';
    const { root } = makeApp({ run: r });
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain('<img src=x onerror="alert(1)">Ana');
  });

  // @spec UI-TEXT-002
  it('shows emphasis as emphasized text and leaves unmatched markers alone', () => {
    const wrap = (nodes: Node[]) => {
      const div = document.createElement('div');
      div.append(...nodes);
      return div;
    };
    const a = wrap(emphasis('a *quiet* week and _really_ late'));
    expect([...a.querySelectorAll('em')].map((x) => x.textContent)).toEqual(['quiet', 'really']);
    expect(a.textContent).toBe('a quiet week and really late');
    expect(wrap(emphasis('5 * 3 is 15')).querySelector('em')).toBeNull();
    const later = wrap(emphasis('Pick *one*, budget 5 * 3, then *two*'));
    expect([...later.querySelectorAll('em')].map((x) => x.textContent)).toEqual(['one', 'two']);
    expect(wrap(emphasis('the deploy_job_runner failed')).querySelector('em')).toBeNull();
    expect(wrap(emphasis('**urgent**')).textContent).toBe('**urgent**');
    const tricky = wrap(emphasis('*<b>bold</b>*'));
    expect(tricky.querySelector('b')).toBeNull();
    expect(tricky.querySelector('em')!.textContent).toBe('<b>bold</b>');
  });
});

describe('the header', () => {
  // @spec UI-WEEK-001
  it('shows the week, weeks to review, the days, energy, reputation and goals', () => {
    const r = waitUntil(playing(), 'level');
    const { root } = makeApp({ run: r });
    const v = L.view(level(r), r.sim) as View;
    expect(text(root, '[data-field=week]')).toBe('1');
    expect(text(root, '[data-field=weeks-to-review]')).toBe('13');
    const day = current(r)!.day;
    expect($$(root, '[data-panel=days] [data-day]').map((d) => d.dataset.state)).toEqual([0, 1, 2, 3, 4].map((i) => (i < day ? 'past' : i === day ? 'now' : 'ahead')));
    expect(text(root, '[data-field=energy]')).toBe(BAND_WORDS.energy[v.player.energy]);
    // happy-dom's meter getters always read 1; the attributes, which browsers reflect, carry the range and value
    expect([$(root, 'meter[data-meter=energy]').getAttribute('max'), $(root, 'meter[data-meter=energy]').getAttribute('value')]).toEqual(['4', String(v.player.energy)]);
    expect(text(root, '[data-field=reputation]')).toBe(word('reputation', r.sim.player.reputation));
    expect($$(root, '[data-panel=goals] [data-goal]').map((g) => [text(g, '[data-field=text]'), text(g, '[data-field=progress]')])).toEqual(v.goals.map((g) => [g.text, g.progress]));
  });
});

describe('the header at the edge of burnout', () => {
  // @spec UI-WEEK-012, UI-WEEK-013
  it('says the player is at the edge, and counts the weeks they ended there toward burnout', () => {
    const r = structuredClone(playing());
    r.sim.player.stress = 85;
    let root = makeApp({ run: r }).root;
    expect(text(root, '[data-field=energy]')).toBe('running on fumes');
    // before a week has ended at the edge, the earlier warning shows (UI-WEEK-014), not the count
    expect(text(root, '[data-field=burnout]')).toBe("You're close to the edge. Take something off your plate.");
    r.sim.player.stress = 92;
    root = makeApp({ run: r }).root;
    expect(text(root, '[data-field=energy]')).toBe('at the edge');
    expect(text(root, '[data-field=burnout]')).not.toMatch(/You've ended/);
    level(r).burnoutWeeks = 1;
    expect(text(makeApp({ run: r }).root, '[data-field=burnout]')).toBe("You've ended 1 week at the edge. 4 in a row and you burn out.");
    level(r).burnoutWeeks = 3;
    r.sim.player.stress = 70;
    expect(text(makeApp({ run: r }).root, '[data-field=burnout]')).toBe("You've ended 3 weeks at the edge. 4 in a row and you burn out.");
  });
});

describe('the header close to the edge', () => {
  // @spec UI-WEEK-014
  it('warns while energy is running on fumes, before any week has ended at the edge', () => {
    const r = structuredClone(playing());
    const warningAt = (stress: number, weeks = 0) => {
      r.sim.player.stress = stress;
      level(r).burnoutWeeks = weeks;
      return makeApp({ run: r }).root.querySelector('[data-field=burnout]')?.textContent ?? null;
    };
    expect(warningAt(70)).toBeNull();
    expect(warningAt(85)).toBe("You're close to the edge. Take something off your plate.");
    expect(warningAt(92)).toBe("You're close to the edge. Take something off your plate.");
    expect(warningAt(92, 1)).toBe("You've ended 1 week at the edge. 4 in a row and you burn out.");
  });
});

describe('the header while the recap shows', () => {
  // @spec UI-WEEK-001, UI-WEEK-011
  it('shows the week the recap is about, then the new week once it is closed', () => {
    const r = answerAndEnd(playing());
    const { root } = makeApp({ run: r });
    expect(scene(root)).toBe('recap');
    expect(text(root, '[data-field=week]')).toBe('1');
    expect(text(root, '[data-field=weeks-to-review]')).toBe('12');
    expect(text(root, '[data-scene] [data-part=heading]')).toBe('How week 1 went');
    expect(text(root, '[data-action=close-recap]')).toBe('Start week 2');
    click(root, '[data-action=close-recap]');
    expect(text(root, '[data-field=week]')).toBe('2');
    expect(text(root, '[data-field=weeks-to-review]')).toBe('12');
  });
});

describe('the End the week button beside the scene', () => {
  // @spec UI-WEEK-003
  it('shows beside a moment or reaction, and not beside Before Monday, the recap or the week-done scene', () => {
    const beside = (root: ParentNode) => root.querySelector('[data-action=end-week]') !== null;
    expect(beside(makeApp({ run: run() }).root)).toBe(false);
    const { root } = makeApp({ run: waitUntil(playing(), 'level') });
    expect(beside(root)).toBe(true);
    $(root, '[data-scene] [data-choice]').click();
    expect(scene(root)).toBe('reaction');
    expect(beside(root)).toBe(true);
    let done = playing();
    while (current(done)) done = step(done, { kind: 'wait' });
    expect(beside(makeApp({ run: done }).root)).toBe(false);
    expect(beside(makeApp({ run: answerAndEnd(playing()) }).root)).toBe(false);
  });
});

describe('the scene', () => {
  // @spec UI-WEEK-005, UI-LINE-006
  it('opens week 0 Before Monday, with the habits and How to play, until the week starts', () => {
    const r = run();
    const { root, app } = makeApp({ run: r });
    expect(scene(root)).toBe('before-monday');
    expect($$(root, '[data-scene] [data-habit]').map((h) => h.dataset.habit)).toEqual(['nightPages', 'oneOnOnes', 'approvals', 'ceremonies', 'growth']);
    expect(($(root, '[data-scene] [data-panel=help]') as HTMLDetailsElement).open).toBe(true);
    select(root, '[data-scene] [data-habit=oneOnOnes]', 'weekly');
    let state = app.state();
    expect(state.screen === 'run' && level(state.run).habits.oneOnOnes).toBe('weekly');
    expect(scene(root)).toBe('before-monday');
    click(root, '[data-action=start-week]');
    expect(scene(root)).toBe('moment');
    state = app.state();
    expect(state.screen === 'run' && state.run.commands).toEqual([{ kind: 'plan', command: { kind: 'habit', habit: 'oneOnOnes', value: 'weekly' } }]);
  });

  // @spec UI-WEEK-002
  it('shows the current moment with its day and time, choices that answer it, and Let it wait', () => {
    const r = waitUntil(playing(), 'situation');
    const { root, app } = makeApp({ run: r });
    const m = current(r)!;
    const p = r.presented.find((x) => x.id === m.id)!;
    expect($(root, '[data-scene]').dataset.moment).toBe(m.id);
    expect(text(root, '[data-scene] [data-field=when]')).toBe(`${DAY_NAMES[m.day]} ${m.time}`);
    expect(text(root, '[data-scene] [data-part=text]')).toBe(p.text);
    expect($$(root, '[data-scene] [data-choice]').map((b) => b.dataset.choice)).toEqual(p.choices.map((c) => c.id));
    click(root, '[data-scene] [data-action=wait]');
    const state = app.state();
    expect(state.screen === 'run' && state.run.commands.at(-1)).toEqual({ kind: 'wait' });
  });

  // @spec UI-WEEK-006
  it('shows the reaction after a choice until Continue', () => {
    const r = waitUntil(playing(), 'level');
    const { root, app } = makeApp({ run: r });
    const m = current(r)!;
    $(root, '[data-scene] [data-choice]').click();
    const state = app.state();
    const answered = state.screen === 'run' ? state.run.week.find((x) => x.id === m.id)! : undefined;
    expect(scene(root)).toBe('reaction');
    expect(text(root, '[data-scene] [data-part=reaction]')).toBe(answered!.text);
    click(root, '[data-scene] [data-action=continue]');
    expect(scene(root)).not.toBe('reaction');
  });

  // @spec UI-WEEK-006
  it('names later moments the answer left expired', () => {
    const closed = new Set<string>();
    const closing: AnyLevel = { ...L, moments: (l: LineState, s) => L.moments(l, s).map((m) => (closed.has(m.id) ? { ...m, open: false } : m)) };
    const deps = { ...DEPS, levels: [closing] };
    const r = waitUntil(step(run(), { kind: 'wait' }), 'level', deps);
    const target = r.week.find((x) => x.source === 'level' && x.status === 'open' && x.id !== current(r)!.id)!;
    closed.add(target.id);
    const { root } = makeApp({ run: r, deps });
    $(root, '[data-scene] [data-choice]').click();
    expect($$(root, '[data-scene] [data-part=passed] li').map((li) => li.dataset.moment)).toEqual([target.id]);
    expect(text(root, '[data-scene] [data-part=passed]')).toContain(DAY_NAMES[target.day]!);
  });

  // @spec UI-WEEK-007
  it('shows the week as done once nothing is left, with End the week', () => {
    let r = playing();
    while (current(r)) r = step(r, { kind: 'wait' });
    const { root, app } = makeApp({ run: r });
    expect(scene(root)).toBe('done');
    expect(text(root, '[data-scene] .where')).toBe('The weekend');
    click(root, '[data-scene] [data-action=finish-week]');
    const state = app.state();
    expect(state.screen === 'run' && state.run.sim.week).toBe(1);
  });

  // @spec UI-WEEK-008
  it('shows a chip for each band that moved, marked good or bad for the player', () => {
    const r = structuredClone(atWorkMoment());
    const m = level(r).moments.find((x) => x.id === current(r)!.id)!;
    const give = m.choices.find((c) => c.id.startsWith('give:'))!;
    const who = give.id.slice('give:'.length);
    r.sim.people[who]!.stress = 39; // the next point of stress crosses into the next band
    const { root } = makeApp({ run: r });
    click(root, `[data-scene] [data-choice="${give.id}"]`);
    const chips = $$(root, '[data-scene] [data-chip]');
    const chip = chips.find((c) => c.dataset.chip === `person:${who}:stress`)!;
    expect(chip.textContent).toContain(r.sim.people[who]!.name);
    expect(chip.dataset.tone).toBe('bad');
    // a band chip already shows the choice landed on them, so no note chip
    expect(chips.some((c) => c.dataset.chip === `person:${who}:note`)).toBe(false);
  });

  // @spec UI-WEEK-010
  it('shows a person’s new memory note as a chip, marked neither good nor bad, when no band moved', () => {
    const r = structuredClone(atWorkMoment());
    const m = level(r).moments.find((x) => x.id === current(r)!.id)!;
    const give = m.choices.find((c) => c.id.startsWith('give:'))!;
    const who = give.id.slice('give:'.length);
    r.sim.people[who]!.stress = 50; // stays in its band
    const { root, app } = makeApp({ run: r });
    click(root, `[data-scene] [data-choice="${give.id}"]`);
    const state = app.state();
    const note = state.screen === 'run' ? state.run.sim.people[who]!.history.at(-1)!.note! : '';
    expect(note).not.toBe('');
    const chips = $$(root, '[data-scene] [data-chip]');
    expect(chips.some((c) => c.dataset.chip === `person:${who}:stress`)).toBe(false);
    const chip = chips.find((c) => c.dataset.chip === `person:${who}:note`)!;
    expect(chip.textContent).toBe(`${r.sim.people[who]!.name}: ${note}`);
    expect(chip.dataset.tone).toBe('neutral');
    // the same note again: the chip shows the note itself, not the card's count
    const again = structuredClone(r);
    again.sim.people[who]!.history.push({ week: 0, cause: { kind: 'rule', ruleId: 'x' }, note });
    const second = makeApp({ run: again }).root;
    click(second, `[data-scene] [data-choice="${give.id}"]`);
    expect(text(second, `[data-scene] [data-chip="person:${who}:note"]`)).toBe(`${r.sim.people[who]!.name}: ${note}`);
  });

  // @spec UI-WEEK-008
  it('shows chips for people who leave or join the team', () => {
    const shuffle: AnyLevel = {
      ...L,
      choose(l, s, momentId, choiceId) {
        const result = L.choose(l, s, momentId, choiceId);
        if (!result.ok) return result;
        const sim = structuredClone(result.sim);
        const [first] = Object.keys(sim.people).sort();
        sim.people[first!]!.status = 'departed';
        sim.people.newcomer = { ...structuredClone(sim.people[first!]!), id: 'newcomer', name: 'Newcomer', status: 'active' };
        return { ...result, sim };
      },
    };
    const deps = { ...DEPS, levels: [shuffle] };
    const r = waitUntil(playing(), 'level', deps);
    const first = Object.keys(r.sim.people).sort()[0]!;
    const { root } = makeApp({ run: r, deps });
    $(root, '[data-scene] [data-choice]').click();
    expect($(root, `[data-chip="person:${first}:left"]`).dataset.tone).toBe('bad');
    expect(text(root, `[data-chip="person:${first}:left"]`)).toContain(r.sim.people[first]!.name);
    expect(text(root, '[data-chip="person:newcomer:joined"]')).toContain('Newcomer');
  });

  // @spec UI-WEEK-004, UI-WEEK-009
  it('opens a new week on last week’s recap, read from the run, until a moment is played', () => {
    expect(scene(makeApp({ run: playing() }).root)).toBe('moment');
    let r = answerAndEnd(playing());
    const { root } = makeApp({ run: r });
    expect(scene(root)).toBe('recap');
    expect(text(root, '[data-scene] .where')).toBe('The weekend');
    // What changed first, then the whole week folded away, then Start week.
    const whole = $(root, '[data-part=recap-whole-week]') as HTMLDetailsElement;
    expect(whole.tagName).toBe('DETAILS');
    expect(whole.open).toBe(false);
    expect(text(whole, 'summary')).toBe('The whole week');
    const order = $$(root, '[data-part=recap-changes], [data-part=recap-whole-week], [data-action=close-recap]').map((el) => el.dataset.part ?? el.dataset.action);
    expect(order).toEqual(['recap-changes', 'recap-whole-week', 'close-recap']);
    expect($$(whole, '[data-part=recap-moments] li').map((li) => li.dataset.moment)).toEqual(r.lastWeek!.moments.map((m) => m.id));
    const answered = r.lastWeek!.moments.find((m) => m.status === 'answered')!;
    expect(text(whole, `[data-part=recap-moments] [data-moment="${answered.id}"]`)).toContain(answered.text!);
    expect(text(root, '[data-action=close-recap]')).toBe('Start week 2');
    click(root, '[data-action=close-recap]');
    expect(scene(root)).toBe('moment');
    // a reload after a moment of the new week has been played does not bring the recap back
    r = step(r, { kind: 'wait' });
    expect(scene(makeApp({ run: r }).root)).toBe('moment');
  });

  // @spec UI-WEEK-015
  it('keeps the whole week open in later recaps once the player opens it, until the page reloads', () => {
    const r = answerAndEnd(playing());
    const { root } = makeApp({ run: r });
    const whole = () => $(root, '[data-part=recap-whole-week]') as HTMLDetailsElement;
    whole().open = true;
    whole().dispatchEvent(new Event('toggle'));
    click(root, '[data-action=close-recap]');
    click(root, '[data-action=end-week]');
    if (root.querySelector('[data-action=finish-week]')) click(root, '[data-action=finish-week]');
    expect(scene(root)).toBe('recap');
    expect(whole().open).toBe(true);
    // closing it holds too
    whole().open = false;
    whole().dispatchEvent(new Event('toggle'));
    click(root, '[data-action=close-recap]');
    click(root, '[data-action=end-week]');
    if (root.querySelector('[data-action=finish-week]')) click(root, '[data-action=finish-week]');
    expect(whole().open).toBe(false);
    // a page load starts closed again: the choice is page state, not part of the run
    const reopened = makeApp({ run: answerAndEnd(playing()) }).root;
    expect(($(reopened, '[data-part=recap-whole-week]') as HTMLDetailsElement).open).toBe(false);
  });

  // @spec UI-WEEK-009
  it('keeps what the player has read only on the page, never in the run', () => {
    const r = waitUntil(playing(), 'level');
    const { root, app } = makeApp({ run: r });
    $(root, '[data-scene] [data-choice]').click();
    expect(scene(root)).toBe('reaction');
    const state = app.state();
    const after = state.screen === 'run' ? state.run : r;
    expect(JSON.stringify(after)).not.toMatch(/reaction|recapClosed|started/i);
    // a reload never shows the reaction again
    expect(scene(makeApp({ run: after }).root)).not.toBe('reaction');
  });
});

/** Answers the current moment, lets the rest wait, and ends the week. */
function answerAndEnd(r: Run): Run {
  const m = current(r)!;
  const choices = m.source === 'level' ? level(r).moments.find((x) => x.id === m.id)!.choices : r.presented.find((p) => p.id === m.id)!.choices;
  return step(step(r, { kind: 'answer', momentId: m.id, choiceId: choices[0]!.id }), { kind: 'endWeek' });
}

describe('line manager panels', () => {
  // @spec UI-LINE-001, UI-BAND-001
  it('shows each engineer as a card with band words, personality, want and memory', () => {
    const r = structuredClone(playing());
    const ids = Object.keys(r.sim.people).sort();
    r.sim.people[ids[0]!]!.history.push({ week: 0, cause: { kind: 'rule', ruleId: 'x' }, note: 'Fixed the build' });
    const { root } = makeApp({ run: r });
    expect($$(root, '[data-panel=team] [data-person]').map((row) => row.dataset.person)).toEqual(ids);
    const p = r.sim.people[ids[0]!]!;
    const card = $(root, `[data-person="${ids[0]}"]`);
    expect(text(card, '[data-field=name]')).toBe(p.name);
    expect(text(card, '[data-field=role]')).toBe(p.role);
    expect(text(card, '[data-field=personality]')).toBe(p.personality);
    expect(text(card, '[data-field=tenure]')).toBe('0 weeks here');
    const later = endWeeks(r, 1);
    expect(text($(makeApp({ run: later }).root, `[data-panel=team] [data-person="${ids[0]}"]`), '[data-field=tenure]')).toBe('1 week here');
    expect(text(card, '[data-field=performance]')).toBe(p.performance);
    expect(text(card, '[data-field=motivation]')).toBe(word('motivation', p.motivation));
    expect(text(card, '[data-field=stress]')).toBe(word('stress', p.stress));
    expect(text(card, '[data-field=skill]')).toBe(word('skill', p.skill));
    expect(text(card, '[data-field=want]')).toBe('unknown');
    expect($$(card, '[data-part=memory] li').map((li) => li.textContent)).toEqual(['Fixed the build']);
  });

  // @spec UI-LINE-002
  it('lists projects with progress, deadline, schedule and band words', () => {
    const r = playing();
    const { root } = makeApp({ run: r });
    for (const id of Object.keys(r.sim.projects)) {
      const p = r.sim.projects[id]!;
      const row = $(root, `[data-project="${id}"]`);
      expect(text(row, '[data-field=name]')).toBe(p.name);
      expect(text(row, '[data-field=progress]')).toBe(`${p.progress} / ${p.scope}`);
      expect(text(row, '[data-field=deadline]')).toBe(String(p.deadlineWeek + 1));
      expect(text(row, '[data-field=schedule]')).toBe('on schedule');
      expect(text(row, '[data-field=risk]')).toBe(word('risk', p.risk));
      expect(text(row, '[data-field=tech-debt]')).toBe(word('risk', p.techDebt));
    }
    // behind and overdue in words
    const late = structuredClone(r);
    const [a, b] = Object.keys(late.sim.projects).sort() as [string, string];
    late.sim.week = 10;
    Object.assign(late.sim.projects[a]!, { progress: 0, deadlineWeek: 30 });
    Object.assign(late.sim.projects[b]!, { deadlineWeek: 5 });
    const lateRoot = makeApp({ run: late }).root;
    expect(text($(lateRoot, `[data-project="${a}"]`), '[data-field=schedule]')).toBe('behind');
    expect(text($(lateRoot, `[data-project="${b}"]`), '[data-field=schedule]')).toBe('overdue');
  });

  // @spec UI-LINE-005
  it('shows open vacancies with their interview counts', () => {
    const r = structuredClone(playing());
    level(r).vacancies = [{ id: 'v1', interviews: 2 }];
    const { root } = makeApp({ run: r });
    expect(text(root, '[data-panel=vacancies] [data-vacancy=v1] [data-field=interviews]')).toBe('2 interviews so far');
    level(r).vacancies = [{ id: 'v1', interviews: 1 }];
    expect(text(makeApp({ run: r }).root, '[data-panel=vacancies] [data-vacancy=v1] [data-field=interviews]')).toBe('1 interview so far');
  });

  // @spec UI-LINE-006
  it('changes habits from a panel, folded after week 0, offering engineers by name', () => {
    const r = playing();
    const { root, app } = makeApp({ run: r });
    const people = Object.keys(r.sim.people).sort();
    const options = $$(root, '[data-panel=habits] [data-habit=growth] option').map((o) => [(o as HTMLOptionElement).value, o.textContent]);
    expect(options).toEqual([['nobody', 'Nobody'], ...people.map((id) => [id, r.sim.people[id]!.name])]);
    select(root, '[data-panel=habits] [data-habit=growth]', people[2]!);
    const state = app.state();
    expect(state.screen === 'run' && state.run.commands.at(-1)).toEqual({ kind: 'plan', command: { kind: 'habit', habit: 'growth', value: people[2] } });
    expect(($(root, '[data-panel=habits]') as HTMLDetailsElement).open).toBe(true);
    const later = endWeeks(r, 1);
    const folded = makeApp({ run: later }).root;
    expect(($(folded, '[data-panel=habits]') as HTMLDetailsElement).open).toBe(false);
  });

  // @spec UI-LINE-007
  it('shows a work moment’s difficulty and the skill and stress of whoever a choice names', () => {
    const r = atWorkMoment();
    const m = level(r).moments.find((x) => x.id === current(r)!.id)!;
    const item = level(r).items.find((i) => i.id === m.ref)!;
    const { root } = makeApp({ run: r });
    expect(text(root, '[data-scene] [data-field=difficulty]')).toBe(word('skill', item.difficulty));
    const give = m.choices.find((c) => c.id.startsWith('give:'))!;
    const who = r.sim.people[give.id.slice('give:'.length)]!;
    const note = text($(root, `[data-scene] [data-choice="${give.id}"]`), '[data-part=who]');
    expect(note).toContain(word('skill', who.skill));
    expect(note).toContain(word('stress', who.stress));
  });

  // @spec UI-LINE-008
  it('adds the level’s part to the recap: what changed at once, habits and goals in the whole week', () => {
    const r = answerAndEnd(playing());
    const recap = r.lastWeek!.recap as { habits: string[]; people: { personId: string }[]; expired: { itemId: string }[]; goals: { id: string; text: string }[] };
    const { root } = makeApp({ run: r });
    const changes = $(root, '[data-part=recap-changes]');
    const whole = $(root, '[data-part=recap-whole-week]');
    for (const part of ['recap-people', 'recap-evaluations', 'recap-habit-changes', 'recap-slipped', 'recap-held', 'recap-assigned']) expect(changes.querySelector(`[data-part=${part}]`), part).not.toBeNull();
    for (const part of ['recap-habits', 'recap-goals']) expect(whole.querySelector(`[data-part=${part}]`), part).not.toBeNull();
    expect($$(changes, '[data-part=recap-people] li').map((li) => li.dataset.person)).toEqual(recap.people.map((p) => p.personId));
    expect($$(whole, '[data-part=recap-habits] li').map((li) => li.textContent)).toEqual(recap.habits);
    expect($$(changes, '[data-part=recap-slipped] li')).toHaveLength(recap.expired.length);
    expect($$(whole, '[data-part=recap-goals] li').map((li) => li.textContent)).toEqual(recap.goals.map((g) => g.text));
    // A week where nothing changed says so, in place of the empty parts.
    const quiet = structuredClone(r);
    Object.assign(quiet.lastWeek!.recap as object, { people: [], evaluations: [], habitChanges: [], expired: [], held: [], assigned: [] });
    expect(text(makeApp({ run: quiet }).root, '[data-part=recap-changes] [data-part=recap-quiet]')).toBe('A quiet week.');
    if (recap.people.length) expect(root.querySelector('[data-part=recap-quiet]')).toBeNull();
    // a project the player's manager assigned to an idle team
    const assigned = structuredClone(r);
    (assigned.lastWeek!.recap as { assigned: { projectId: string; name: string }[] }).assigned = [{ projectId: 'p9', name: 'Ledger sync' }];
    expect(text(makeApp({ run: assigned }).root, '[data-part=recap-assigned] li')).toBe('Your manager assigned Ledger sync to the team.');
    const held = structuredClone(r);
    (held.lastWeek!.recap as { held: { personId: string; name: string }[] }).held = [{ personId: 'e1', name: 'Wen Albrecht' }];
    expect(text(makeApp({ run: held }).root, '[data-part=recap-held] li')).toBe("Wen Albrecht's final evaluation waits for you on Monday.");
  });
});

describe('band words', () => {
  // @spec UI-BAND-001
  it('names bands 0 to 4 for each kind of value', () => {
    expect(BAND_WORDS).toEqual({
      motivation: ['struggling', 'flat', 'fine', 'good', 'energized'],
      stress: ['calm', 'steady', 'busy', 'strained', 'overwhelmed'],
      energy: ['running on fumes', 'tired', 'okay', 'good', 'fresh'],
      skill: ['learning', 'developing', 'capable', 'strong', 'expert'],
      risk: ['low', 'moderate', 'elevated', 'high', 'severe'],
      reputation: ['poor', 'mixed', 'fair', 'good', 'excellent'],
      trust: ['wary', 'guarded', 'neutral', 'trusting', 'loyal'],
    });
  });
});

describe('review and end', () => {
  // @spec UI-REVIEW-001
  it('shows the rating, scored measures with goals by name, the quarter’s debriefs, and acknowledges', () => {
    let r = endWeeks(run(), 13);
    r = structuredClone(r);
    r.review!.debriefs.push({ week: 5, situationId: 'retired-situation', bindings: {}, status: 'ignored' });
    const { root, app } = makeApp({ run: r });
    // @spec UI-WEEK-011: the review after the thirteenth week
    expect(text(root, '[data-part=heading]')).toBe('Week 13 review');
    expect(text(root, '[data-field=rating]')).toBe(r.review!.rating);
    expect(text(root, '[data-field=outcome]')).toMatch(/continu/i);
    expect(text(makeApp({ run: { ...r, review: { ...r.review!, outcome: 'managedOut' } } }).root, '[data-field=outcome]')).toMatch(/managed out/i);
    expect(text(makeApp({ run: { ...r, review: { ...r.review!, outcome: 'promote' } } }).root, '[data-field=outcome]')).toMatch(/promot/i);
    expect($$(root, '[data-measure]').map((m) => m.dataset.measure)).toEqual(r.review!.measures.map((m) => m.id));
    const goal = r.review!.measures.find((m) => m.id.startsWith('goal:'))!;
    const goalText = (L.view(level(r), r.sim) as View).goals.find((g) => `goal:${g.id}` === goal.id)!.text;
    expect(text(root, `[data-measure="${goal.id}"] [data-field=name]`)).toBe(goalText);
    const debriefs = $$(root, '[data-debrief]');
    expect(debriefs).toHaveLength(r.review!.debriefs.length);
    expect(text(debriefs.at(-1)!, '[data-field=title]')).toBe('retired-situation');
    expect(text(debriefs.at(-1)!, '[data-field=status]')).toBe('You let it wait');
    click(root, '[data-action=acknowledge]');
    const state = app.state();
    expect(state.screen === 'run' && state.run.phase).toBe('week');
  });

  // @spec UI-REVIEW-001, UI-LINE-009
  it('names each measure and gives its value and verdict in words, with the numbers secondary', () => {
    const r = structuredClone(endWeeks(run(), 13));
    const review = r.review!;
    review.measures = [
      { id: 'completedOnTime', value: 2, target: 0, tolerance: 0, better: 'higher', verdict: 'above' },
      { id: 'onScheduleShare', value: 1, target: 0.75, tolerance: 0.15, better: 'higher', verdict: 'above' },
      { id: 'regrettedQuits', value: 0, target: 0, tolerance: 0, better: 'lower', verdict: 'at' },
      { id: 'motivation', value: 77.2, target: 65, tolerance: 10, better: 'higher', verdict: 'above' },
      { id: 'stress', value: 62, target: 35, tolerance: 10, better: 'lower', verdict: 'below' },
      { id: 'oneOnOneShare', value: 0.8, target: 0.9, tolerance: 0.08, better: 'higher', verdict: 'below' },
      { id: 'reputation', value: 88, target: 55, tolerance: 10, better: 'higher', verdict: 'above' },
      ...review.measures.filter((m) => m.id.startsWith('goal:')).map((m) => ({ ...m, value: 1, verdict: 'above' as const })),
    ];
    const { root } = makeApp({ run: r });
    const row = (id: string) => $(root, `[data-measure="${id}"]`);
    const shown = (id: string) => [text(row(id), '[data-field=name]'), text(row(id), '[data-field=value]'), text(row(id), '[data-field=verdict]')];
    expect(shown('completedOnTime')).toEqual(['Projects shipped on time', '2', 'above target']);
    expect(shown('onScheduleShare')).toEqual(['Projects on schedule', 'all', 'above target']);
    expect(shown('regrettedQuits')).toEqual(['People who quit', 'none', 'on target']);
    expect(shown('motivation')).toEqual(['Team motivation', word('motivation', 77.2), 'above target']);
    expect(shown('stress')).toEqual(['Team stress', word('stress', 62), 'below target']);
    expect(shown('oneOnOneShare')).toEqual(['1:1s held', '80%', 'below target']);
    expect(shown('reputation')).toEqual(['Your reputation', word('reputation', 88), 'above target']);
    const goal = review.measures.find((m) => m.id.startsWith('goal:'));
    if (goal) expect(text(row(goal.id), '[data-field=value]')).toBe('met');
    expect(text(row('motivation'), '[data-field=numbers]')).toBe('77.2; aim 65 ± 10, higher is better');
    // a share short of all, or above none, never rounds to 100% or 0%
    review.measures = review.measures.map((m) => (m.id === 'oneOnOneShare' ? { ...m, value: 0.996 } : m.id === 'onScheduleShare' ? { ...m, value: 0.004 } : m));
    const nearly = makeApp({ run: r }).root;
    expect(text($(nearly, '[data-measure=oneOnOneShare]'), '[data-field=value]')).toBe('99%');
    expect(text($(nearly, '[data-measure=onScheduleShare]'), '[data-field=value]')).toBe('1%');
    expect($$(root, '[data-measure] [data-field=target]')).toHaveLength(0);
  });

  // @spec UI-REVIEW-001
  it('says when a ceiling held the rating down, and what staying a line manager means', () => {
    const r = structuredClone(endWeeks(run(), 13));
    r.review!.ceilingReason = "Your manager won't call it a strong quarter with the team this stretched.";
    expect(text(makeApp({ run: r }).root, '[data-field=ceiling]')).toBe(r.review!.ceilingReason);
    expect(makeApp({ run: endWeeks(run(), 13) }).root.querySelector('[data-field=ceiling]')).toBeNull();
    r.review!.outcome = 'stayed';
    expect(text(makeApp({ run: r }).root, '[data-field=outcome]')).toMatch(/line manager/i);
  });

  // @spec UI-REVIEW-001
  it('says what happened to each situation in words, with the lesson for letting it wait', () => {
    const r = structuredClone(endWeeks(run(), 13));
    const content = [...CONTENT, sit({ id: 'waited-on', title: 'Waited on', waitDebrief: 'Waiting has a cost.' })];
    r.review!.debriefs = [
      { week: 3, situationId: 'about-someone', bindings: {}, status: 'resolved', debrief: 'Talking helps.' },
      { week: 4, situationId: 'waited-on', bindings: {}, status: 'ignored' },
      { week: 5, situationId: 'about-someone', bindings: {}, status: 'ignored' },
      { week: 6, situationId: 'about-someone', bindings: {}, status: 'expired' },
    ];
    const items = $$(makeApp({ run: r, content }).root, '[data-debrief]');
    expect(items.map((d) => text(d, '[data-field=status]'))).toEqual(['You dealt with it', 'You let it wait', 'You let it wait', 'It passed before you got to it']);
    expect(text(items[0]!, '[data-field=text]')).toBe('Talking helps.');
    expect(text(items[1]!, '[data-field=text]')).toBe('Waiting has a cost.');
    expect(items[2]!.querySelector('[data-field=text]')).toBeNull();
  });

  // @spec UI-END-002, UI-LINE-010
  it('sums up the career before the final week: weeks, review ratings, projects, who joined and who left', () => {
    const last = structuredClone(answerAndEnd(playing()));
    const ids = Object.keys(last.sim.people).sort();
    last.sim.player.ratingHistory = [
      { week: 13, cause: { kind: 'rule', ruleId: 'review.quarterly' }, rating: 'meets' },
      { week: 26, cause: { kind: 'rule', ruleId: 'review.quarterly' }, rating: 'partial' },
    ];
    last.sim.people[ids[0]!]!.joinedWeek = 1;
    Object.assign(last.sim.people[ids[1]!]!, { status: 'departed', departure: { week: 1, reason: 'quit' } });
    const ended = { ...last, phase: 'ended' as const, ending: 'stayed' as const };
    const { root } = makeApp({ run: ended });
    const career = $(root, '[data-part=career]');
    expect(text(career, '[data-field=weeks]')).toBe(String(last.sim.week));
    expect(text(career, '[data-field=ratings]')).toBe('meets, partial');
    expect(text(career, '[data-field=shipped]')).toMatch(/^\d+$/);
    expect(text(career, '[data-field=joined]')).toContain(last.sim.people[ids[0]!]!.name);
    expect(text(career, '[data-field=left]')).toContain(`${last.sim.people[ids[1]!]!.name} (quit)`);
    // it comes before the final week's recap
    const all = [...root.querySelectorAll('[data-part=career], [data-part=recap]')].map((e) => (e as HTMLElement).dataset.part);
    expect(all).toEqual(['career', 'recap']);
  });

  // @spec UI-END-001
  it('says the run ended with the player staying a line manager', () => {
    const last = answerAndEnd(playing());
    const { root } = makeApp({ run: { ...last, phase: 'ended' as const, ending: 'stayed' as const } });
    expect(text(root, '[data-field=ending]')).toMatch(/line manager/i);
  });

  // @spec UI-END-001
  it('says why the run ended, shows the final week’s recap, and starts over with a new seed', () => {
    const last = answerAndEnd(playing());
    const ended = { ...last, phase: 'ended' as const, ending: 'burnout' as const };
    const { root, app } = makeApp({ run: ended, seeds: [7] });
    expect(text(root, '[data-field=ending]')).toMatch(/burn/i);
    // the final week's moments are what explain the ending, so the whole week is open here
    expect(($(root, '[data-part=recap-whole-week]') as HTMLDetailsElement).open).toBe(true);
    expect($$(root, '[data-part=recap-moments] li')).toHaveLength(last.lastWeek!.moments.length);
    click(root, '[data-action=new-run]');
    expect($(root, '[data-screen]').dataset.screen).toBe('start');
    click(root, '[data-action=begin]');
    const state = app.state();
    expect(state.screen === 'run' && state.run.seed).toBe(7);
  });
});

describe('content', () => {
  // @spec UI-CONTENT-001
  it('lists content errors only when asked to', () => {
    const errors = [{ situationId: 'broken', message: 'priority: sometimes is not a priority' }];
    const shown = makeApp({ contentErrors: errors, showContentErrors: true }).root;
    expect($$(shown, '[data-panel=content-errors] li').map((li) => li.textContent)).toEqual(['broken: priority: sometimes is not a priority']);
    expect(makeApp({ contentErrors: errors, showContentErrors: false }).root.querySelector('[data-panel=content-errors]')).toBeNull();
  });
});

describe('help', () => {
  // @spec UI-HELP-001
  it('shows How to play, open in the first weeks and closed after, keeping the player’s choice', () => {
    const { root } = makeApp({ run: playing() });
    const help = () => $(root, '[data-panel=help]') as HTMLDetailsElement;
    expect(help().tagName).toBe('DETAILS');
    expect(help().open).toBe(true);
    expect($$(help(), '[data-topic]').map((t) => t.dataset.topic)).toEqual(['how-to-play', 'moments', 'habits', 'people', 'energy', 'reviews']);
    expect(text(help(), '[data-topic=energy]')).toContain('burn out');

    // the player's choice survives a redraw
    help().open = false;
    help().dispatchEvent(new Event('toggle'));
    click(root, '[data-scene] [data-action=wait]');
    expect(help().open).toBe(false);

    const later = endWeeks(run(), 3);
    expect(later.sim.week).toBe(3);
    expect(($(makeApp({ run: later }).root, '[data-panel=help]') as HTMLDetailsElement).open).toBe(false);
  });

  // @spec UI-HELP-002
  it('shows a help line under each line manager panel heading', () => {
    const { root } = makeApp({ run: playing() });
    const line = (panel: string) => text(root, `[data-panel=${panel}] [data-part=help]`);
    expect(line('team')).toBe('Words are your read on each person. Wants appear after a 1:1.');
    expect(line('projects')).toBe('Projects move on their own. Risk and tech debt make setbacks more likely.');
    expect(line('habits')).toBe("Changes apply from this week's end, and to moments from next week.");
  });
});
