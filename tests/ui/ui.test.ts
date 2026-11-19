// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { ACTIONS, band, lineManagerLevel } from '../../src/levels/line-manager';
import { BAND_WORDS } from '../../src/ui/bands';
import { emphasis } from '../../src/ui/text';
import { $, $$, CONTENT, DEPS, click, endWeeks, level, makeApp, run, select, step, text } from './fixtures';

const L = lineManagerLevel;
const word = (kind: keyof typeof BAND_WORDS, value: number) => BAND_WORDS[kind][band(value)];

describe('the page', () => {
  // @spec UI-SHELL-001
  it('starts on the start screen with a seed, and begins a run from it', () => {
    const { root, app } = makeApp();
    expect($(root, '[data-screen]').dataset.screen).toBe('start');
    expect(text(root, '[data-field=seed]')).toBe('42');
    click(root, '[data-action=begin]');
    expect($(root, '[data-screen]').dataset.screen).toBe('week');
    const state = app.state();
    expect(state.screen === 'run' && state.run.seed).toBe(42);
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

  // @spec UI-SHELL-003, UI-WEEK-003
  it('redraws from the new run after a command', () => {
    const { root, app } = makeApp({ run: run() });
    expect(text(root, '[data-field=week]')).toBe('0');
    click(root, '[data-action=end-week]');
    expect(text(root, '[data-field=week]')).toBe('1');
    const state = app.state();
    expect(state.screen === 'run' && state.run.commands).toEqual([{ kind: 'endWeek' }]);
  });

  // @spec UI-SHELL-004
  it('shows a refused command’s error next to its control and changes nothing else', () => {
    let r = run();
    const e = Object.keys(r.sim.people).sort()[0]!;
    const coaching = { action: 'line-manager.coaching', target: { kind: 'person', id: e }, cadence: 'once' };
    r = step(r, { kind: 'plan', command: { kind: 'calendar', add: Array.from({ length: 30 }, () => coaching) } });
    const { root, app } = makeApp({ run: r });
    click(root, '[data-action=end-week]');
    const error = $($(root, '[data-action=end-week]').parentElement!, '[data-error]');
    expect(error.textContent).toMatch(/hours/);
    expect(text(root, '[data-field=week]')).toBe('0');
    const state = app.state();
    expect(state.screen === 'run' && state.run).toEqual(r);
  });

  // @spec UI-SHELL-004
  it('keeps a form as the player filled it in when its command is refused', () => {
    const refusing = { ...DEPS, levels: [{ ...lineManagerLevel, updatePlan: () => ({ ok: false as const, error: 'refused for the test' }) }] };
    const { root } = makeApp({ run: run(), deps: refusing });
    const form = () => $(root, '[data-form=add-entry]');
    select(form(), '[data-input=action]', 'line-manager.coaching');
    const people = Object.keys(run().sim.people).sort();
    select(form(), '[data-input=target]', people[3]!);
    select(form(), '[data-input=cadence]', 'biweekly');
    select(form(), '[data-input=start]', '1');
    click(form(), '[data-action=add]');
    expect(text(form(), '[data-error]')).toBe('refused for the test');
    expect(($(form(), '[data-input=action]') as HTMLSelectElement).value).toBe('line-manager.coaching');
    expect(($(form(), '[data-input=target]') as HTMLSelectElement).value).toBe(people[3]);
    expect(($(form(), '[data-input=start]') as HTMLSelectElement).value).toBe('1');
  });

  // @spec UI-SHELL-002
  it('says so rather than crashing when a run’s level is not available', () => {
    const { root } = makeApp({ run: { ...run(), levelId: 'director' } });
    expect($(root, '[data-screen]').dataset.screen).toBe('unavailable');
  });

  // @spec UI-SHELL-003
  it('keeps keyboard focus on the same control across a redraw', () => {
    const { root } = makeApp({ run: run(), attach: true });
    $(root, '[data-form=add-entry] [data-input=action]').focus();
    select(root, '[data-form=add-entry] [data-input=action]', 'line-manager.team-event');
    expect(document.activeElement).toBe($(root, '[data-form=add-entry] [data-input=action]'));
  });

  // @spec UI-TEXT-001
  it('puts names and content on the page as text, never as markup', () => {
    let r = run();
    const e = Object.keys(r.sim.people).sort()[0]!;
    r = structuredClone(r);
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
    expect(wrap(emphasis('5 * 3 is 15')).textContent).toBe('5 * 3 is 15');
    // a skipped near-match must not swallow the next real span
    const later = wrap(emphasis('Pick *one*, budget 5 * 3, then *two*'));
    expect([...later.querySelectorAll('em')].map((x) => x.textContent)).toEqual(['one', 'two']);
    expect(wrap(emphasis('the deploy_job_runner failed')).querySelector('em')).toBeNull();
    expect(wrap(emphasis('**urgent**')).querySelector('em')).toBeNull();
    expect(wrap(emphasis('**urgent**')).textContent).toBe('**urgent**');
    const tricky = wrap(emphasis('*<b>bold</b>*'));
    expect(tricky.querySelector('b')).toBeNull();
    expect(tricky.querySelector('em')!.textContent).toBe('<b>bold</b>');
  });
});

describe('the week screen', () => {
  // @spec UI-WEEK-001
  it('shows the week, weeks to review, standing and planned hours', () => {
    const r = run();
    const { root } = makeApp({ run: r });
    const v = L.view(level(r), r.sim, r.plan as never) as { plannedHours: number; overtime: number };
    expect(text(root, '[data-field=week]')).toBe('0');
    expect(text(root, '[data-field=weeks-to-review]')).toBe('13');
    expect(text(root, '[data-field=reputation]')).toBe(word('reputation', r.sim.player.reputation));
    expect(text(root, '[data-field=stress]')).toBe(word('stress', r.sim.player.stress));
    expect(text(root, '[data-field=planned-hours]')).toBe(String(v.plannedHours));
    expect(text(root, '[data-field=overtime]')).toBe(String(v.overtime));
  });

  // @spec UI-WEEK-002
  it('shows situations with choice buttons, then their aftermath once answered', () => {
    const r = run();
    const { root } = makeApp({ run: r });
    const first = r.presented[0]!.presentation;
    const card = $(root, `[data-situation="${first.id}"]`);
    expect(card.dataset.status).toBe('open');
    expect(text(card, '[data-part=text]')).toBe(first.text);
    expect($$(card, '[data-choice]').map((b) => b.textContent)).toEqual(first.choices.map((c) => c.label));
    click(card, `[data-choice="${first.choices[0]!.id}"]`);
    const answered = $(root, `[data-situation="${first.id}"]`);
    expect(answered.dataset.status).toBe('answered');
    expect(text(answered, '[data-part=aftermath]').length).toBeGreaterThan(0);
    expect($$(answered, '[data-choice]')).toEqual([]);
  });

  // @spec UI-WEEK-004
  it('shows last week’s report once a week has ended', () => {
    const r = run();
    expect(makeApp({ run: r }).root.querySelector('[data-panel=last-week]')).toBeNull();
    const first = r.presented[0]!.presentation;
    const after = step(step(r, { kind: 'answer', presentationId: first.id, choiceId: first.choices[0]!.id }), { kind: 'endWeek' });
    const { root } = makeApp({ run: after });
    const panel = $(root, '[data-panel=last-week]');
    expect($$(panel, '[data-part=aftermaths] li').map((li) => li.textContent)).toEqual(after.lastWeek!.aftermaths);
    for (const part of ['dropped', 'delegations', 'undelegated', 'voided', 'expired']) expect(panel.querySelector(`[data-part=${part}]`)).not.toBeNull();
  });
});

describe('line manager panels', () => {
  // @spec UI-LINE-001, UI-BAND-001
  it('lists the team with band words and known wants', () => {
    const r = run();
    const { root } = makeApp({ run: r });
    const ids = Object.keys(r.sim.people).sort();
    expect($$(root, '[data-panel=team] [data-person]').map((row) => row.dataset.person)).toEqual(ids);
    const p = r.sim.people[ids[0]!]!;
    const row = $(root, `[data-person="${ids[0]}"]`);
    expect(text(row, '[data-field=name]')).toBe(p.name);
    expect(text(row, '[data-field=role]')).toBe(p.role);
    expect(text(row, '[data-field=tenure]')).toBe('0');
    expect(text(row, '[data-field=performance]')).toBe(p.performance);
    expect(text(row, '[data-field=motivation]')).toBe(word('motivation', p.motivation));
    expect(text(row, '[data-field=stress]')).toBe(word('stress', p.stress));
    expect(text(row, '[data-field=skill]')).toBe(word('skill', p.skill));
    expect(text(row, '[data-field=want]')).toBe('unknown');
  });

  // @spec UI-LINE-002
  it('lists projects with progress, deadline, schedule and band words', () => {
    const r = run();
    const { root } = makeApp({ run: r });
    for (const id of Object.keys(r.sim.projects)) {
      const p = r.sim.projects[id]!;
      const row = $(root, `[data-project="${id}"]`);
      expect(text(row, '[data-field=name]')).toBe(p.name);
      expect(text(row, '[data-field=progress]')).toBe(`${p.progress} / ${p.scope}`);
      expect(text(row, '[data-field=deadline]')).toBe(String(p.deadlineWeek));
      expect(text(row, '[data-field=schedule]')).toBe('onSchedule');
      expect(text(row, '[data-field=risk]')).toBe(word('risk', p.risk));
      expect(text(row, '[data-field=tech-debt]')).toBe(word('risk', p.techDebt));
    }
  });

  // @spec UI-LINE-003
  it('decides inbox demands through plan commands, never offering the requester as delegate', () => {
    let r = run();
    const e = Object.keys(r.sim.people).sort();
    r = structuredClone(r);
    level(r).inbox = [
      { id: 'd-exp', type: 'expense', subject: { kind: 'person', id: e[0]! }, hours: 1, difficulty: 30, arrivedWeek: 0, lastWeek: 2 },
      { id: 'd-in', type: 'workIntake', subject: { kind: 'team', id: 't1' }, hours: 2, difficulty: 30, arrivedWeek: 0, lastWeek: 2 },
    ];
    const { root, app } = makeApp({ run: r });
    const exp = $(root, '[data-demand=d-exp]');
    expect(text(exp, '[data-field=type]')).toBe('expense');
    expect(text(exp, '[data-field=subject]')).toBe(r.sim.people[e[0]!]!.name);
    expect(text(exp, '[data-field=difficulty]')).toBe(word('skill', 30));
    const options = $$(exp, '[data-input=delegate-to] option').map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(e.slice(1));
    select(exp, '[data-input=delegate-to]', e[2]!);
    // a redraw before clicking Delegate (here, changing the calendar form) keeps the chosen delegate
    select(root, '[data-form=add-entry] [data-input=action]', 'line-manager.team-event');
    expect(($(root, '[data-demand=d-exp] [data-input=delegate-to]') as HTMLSelectElement).value).toBe(e[2]);
    select(root, '[data-demand=d-exp] [data-input=delegate-to]', e[1]!);
    click(root, '[data-demand=d-exp] [data-action=delegate]');
    let state = app.state();
    expect(state.screen === 'run' && state.run.plan).toEqual({ decisions: { 'd-exp': { kind: 'delegate', to: e[1] } } });
    expect(text(root, '[data-demand=d-exp] [data-field=decision]')).toMatch(/delegate/);
    click(root, '[data-demand=d-exp] [data-action=clear]');
    state = app.state();
    expect(state.screen === 'run' && state.run.plan).toEqual({ decisions: {} });

    const intake = $(root, '[data-demand=d-in]');
    expect(intake.querySelector('[data-action=handle]')).toBeNull();
    expect(intake.querySelector('[data-action=delegate]')).toBeNull();
    click(intake, '[data-action=accept]');
    state = app.state();
    expect(state.screen === 'run' && state.run.plan).toEqual({ decisions: { 'd-in': { kind: 'accept' } } });
  });

  // @spec UI-LINE-004
  it('edits the calendar through plan commands, offering valid targets, cadences and start weeks', () => {
    const r = run();
    const { root, app } = makeApp({ run: r });
    const entries = level(r).calendar;
    expect($$(root, '[data-panel=calendar] [data-entry]')).toHaveLength(entries.length);
    click(root, `[data-entry="${entries[0]!.id}"] [data-action=remove]`);
    let state = app.state();
    expect(state.screen === 'run' && level(state.run).calendar).toHaveLength(entries.length - 1);

    const form = () => $(root, '[data-form=add-entry]');
    select(form(), '[data-input=action]', 'line-manager.team-event');
    expect($$(form(), '[data-input=target] option').map((o) => (o as HTMLOptionElement).value)).toEqual(['t1']);
    expect($$(form(), '[data-input=cadence] option').map((o) => (o as HTMLOptionElement).value)).toEqual(['once']);
    select(form(), '[data-input=action]', 'line-manager.one-on-one');
    const people = Object.keys(r.sim.people).sort();
    expect($$(form(), '[data-input=target] option').map((o) => (o as HTMLOptionElement).value)).toEqual(people);
    expect($$(form(), '[data-input=cadence] option').map((o) => (o as HTMLOptionElement).value)).toEqual(['weekly', 'biweekly', 'once']);
    select(form(), '[data-input=target]', people[2]!);
    select(form(), '[data-input=cadence]', 'biweekly');
    expect($$(form(), '[data-input=start] option').map((o) => (o as HTMLOptionElement).value)).toEqual(['0', '1']);
    select(form(), '[data-input=start]', '1');
    click(form(), '[data-action=add]');
    state = app.state();
    const added = state.screen === 'run' ? level(state.run).calendar.at(-1) : undefined;
    expect(added).toMatchObject({ action: 'line-manager.one-on-one', target: { kind: 'person', id: people[2] }, cadence: 'biweekly', startWeek: 1 });
    expect(ACTIONS['line-manager.one-on-one'].oneOff).toBe(false);
  });
});

describe('band words', () => {
  // @spec UI-BAND-001
  it('names bands 0 to 4 for each kind of value', () => {
    expect(BAND_WORDS).toEqual({
      motivation: ['struggling', 'flat', 'fine', 'good', 'energized'],
      stress: ['calm', 'steady', 'busy', 'strained', 'overwhelmed'],
      skill: ['learning', 'developing', 'capable', 'strong', 'expert'],
      risk: ['low', 'moderate', 'elevated', 'high', 'severe'],
      reputation: ['poor', 'mixed', 'fair', 'good', 'excellent'],
    });
    expect(band(100)).toBe(4);
  });
});

describe('review and end', () => {
  // @spec UI-REVIEW-001
  it('shows the rating, scored measures and the quarter’s debriefs, and acknowledges', () => {
    let r = endWeeks(run(), 13);
    r = structuredClone(r);
    r.review!.debriefs.push({ week: 5, situationId: 'retired-situation', bindings: {}, status: 'ignored' });
    const { root, app } = makeApp({ run: r });
    expect(text(root, '[data-field=rating]')).toBe(r.review!.rating);
    expect($$(root, '[data-measure]').map((m) => m.dataset.measure)).toEqual(r.review!.measures.map((m) => m.id));
    const first = r.review!.measures[0]!;
    expect(text(root, `[data-measure="${first.id}"] [data-field=verdict]`)).toBe(first.verdict);
    const debriefs = $$(root, '[data-debrief]');
    expect(debriefs).toHaveLength(r.review!.debriefs.length);
    const titles = new Map(CONTENT.map((s) => [s.id, s.title]));
    expect(text(debriefs[0]!, '[data-field=title]')).toBe(titles.get(r.review!.debriefs[0]!.situationId));
    expect(text(debriefs.at(-1)!, '[data-field=title]')).toBe('retired-situation');
    expect(text(debriefs.at(-1)!, '[data-field=status]')).toBe('ignored');
    expect(text(root, '[data-action=acknowledge]')).toBe('Acknowledge');
    click(root, '[data-action=acknowledge]');
    const state = app.state();
    expect(state.screen === 'run' && state.run.phase).toBe('planning');
  });

  // @spec UI-END-001
  it('says why the run ended and starts over with a new seed', () => {
    const ended = { ...run(), phase: 'ended' as const, ending: 'managedOut' as const };
    const { root } = makeApp({ run: ended, seeds: [7] });
    expect(text(root, '[data-field=ending]')).toMatch(/managed out/i);
    click(root, '[data-action=new-run]');
    expect($(root, '[data-screen]').dataset.screen).toBe('start');
    expect(text(root, '[data-field=seed]')).toBe('7');
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
