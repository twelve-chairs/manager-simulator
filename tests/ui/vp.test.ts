// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { directorLevel } from '../../src/levels/director';
import { lineManagerLevel } from '../../src/levels/line-manager';
import { seniorManagerLevel } from '../../src/levels/senior-manager';
import { VP_TUNING as T, vpLevel, type VpState } from '../../src/levels/vp';
import { newRun, type Dependencies, type Run } from '../../src/loop';
import { BAND_WORDS } from '../../src/ui/bands';
import { VP_HELP_TOPICS, vpRenderer } from '../../src/ui/vp';
import { endWeeks, step, stubReview } from '../loop/fixtures';
import { $, $$, CONTENT, click, makeApp, select, text } from './fixtures';

const all = (outcome: 'promote' | 'continue' | 'stayed' = 'promote'): Dependencies => ({ levels: [lineManagerLevel, seniorManagerLevel, directorLevel, vpLevel], review: stubReview(outcome).review });
/** A run promoted at its first review at each of the three lower levels: in the VP's handover. */
function promotedThrice(seed = 1): Run {
  let r = step(endWeeks(newRun(seed, CONTENT, all()), 13, all()), { kind: 'acknowledge' }, all());
  r = step(r, { kind: 'handover', choice: 'hire' }, all());
  r = step(endWeeks(r, 6, all()), { kind: 'acknowledge' }, all());
  r = step(r, { kind: 'handover', choice: 'hire' }, all());
  return step(endWeeks(r, 2, all()), { kind: 'acknowledge' }, all());
}
/** The thrice-promoted run handed over to an outside hire, its later reviews answered with `outcome`. */
const vp = (seed = 1, outcome: 'promote' | 'continue' | 'stayed' = 'continue'): Run => step(promotedThrice(seed), { kind: 'handover', choice: 'hire' }, all(outcome));
const scene = (root: ParentNode) => $(root, '[data-scene]').dataset.scene;
const lvl = (run: Run) => run.level as VpState;
const playTo = (root: ParentNode, title: RegExp) => {
  click(root, '[data-action=start-week]');
  for (let i = 0; i < 20 && scene(root) === 'moment' && !title.test(text(root, '[data-scene] [data-part=heading]')); i++) click(root, '[data-action=wait]');
};

describe('the VP’s handover', () => {
  // @spec UI-VP-012
  it('says the player is promoted to VP and asks who leads their organization, offering each senior manager and an outside hire', () => {
    const run = promotedThrice(2);
    expect(run.phase).toBe('handover');
    const { root } = makeApp({ run, deps: all() });
    expect(text(root, '[data-part=heading]')).toMatch(/promoted to VP/);
    expect(text(root, '[data-part=question]')).toMatch(/who leads your organization now\?/i);
    expect($$(root, '[data-handover]').map((b) => b.dataset.handover)).toEqual(run.handoverChoices!.map((c) => c.id));
    expect(text(root, '[data-handover=hire]')).toMatch(/capable director you don.t know yet/i);
    expect(text(root, '[data-part=trade]')).toMatch(/trust they.ve built.*unsettles the division/i);
  });
});

describe('the VP’s week screen', () => {
  // @spec UI-VP-001
  it('opens the first quarter on a scene with the two habits and How to play, closed by Start quarter 1', () => {
    const { root } = makeApp({ run: vp(3), deps: all() });
    expect(scene(root)).toBe('before-monday');
    expect($$(root, '[data-scene] [data-habit]')).toHaveLength(2);
    expect(text(root, '[data-action=start-week]')).toBe('Start quarter 1');
  });

  // @spec UI-QUIT-002
  it('shows the restless line on a restless person’s card, and on no other', () => {
    const r = structuredClone(vp(3));
    const first = $$(makeApp({ run: r, deps: all() }).root, '[data-panel=directors] [data-director]')[0]!.dataset.director!;
    r.sim.people[first]!.restlessSince = r.sim.week;
    const cards = $$(makeApp({ run: r, deps: all() }).root, '[data-panel=directors] [data-director]');
    expect(cards.map((c) => c.querySelector('[data-field=restless]')?.textContent ?? null)).toEqual(cards.map((c) => (c.dataset.director === first ? 'Restless: may leave within weeks unless they get what they want.' : null)));
  });

  // @spec UI-VP-002
  it('shows a card per director with their division, its mood labelled by the survey', () => {
    const { root } = makeApp({ run: vp(3), deps: all() });
    const cards = $$(root, '[data-panel=directors] [data-director]');
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(text(card, '[data-field=skill]')).toMatch(new RegExp(BAND_WORDS.skill.join('|')));
      expect(text(card, '[data-division] [data-field=source]')).toBe('at the survey in quarter 1');
      expect(text(card, '[data-division] [data-field=headcount]')).toMatch(/\d+ people/);
    }
  });

  // @spec UI-VP-003, UI-VP-004, UI-VP-005
  it('shows the leadership team, the year’s plan, and the two VP habits', () => {
    const { root, app } = makeApp({ run: vp(3), deps: all() });
    const team = $$(root, '[data-panel=leadership] [data-outsider]');
    expect(team).toHaveLength(3);
    expect(text(team[0]!, '[data-field=role]')).toBe('your CEO');
    expect(text(team[1]!, '[data-field=role]')).toBe('a peer VP');
    expect(text(root, '[data-panel=plan] [data-field=heads]')).toMatch(/not planned yet/);
    expect(text(root, '[data-panel=plan] [data-field=priority]')).toMatch(/no company priority/i);
    expect($$(root, '[data-panel=habits] [data-habit]').map((s) => s.dataset.habit)).toEqual(['firstTeam', 'directors']);
    select(root, '[data-panel=habits] [data-habit=firstTeam]', 'leadership');
    const s = app.state();
    expect(s.screen === 'run' && lvl(s.run).habits.firstTeam).toBe('leadership');
  });

  // @spec UI-VP-004
  it('shows the year’s heads arrived and the company priority once set', () => {
    const { root } = makeApp({ run: vp(3), deps: all() });
    playTo(root, /Annual planning/);
    click(root, '[data-choice=plan]');
    if (scene(root) === 'reaction') click(root, '[data-action=continue]');
    for (let i = 0; i < 10 && !/company priority/i.test(text(root, '[data-scene] [data-part=heading]')); i++) click(root, '[data-action=wait]');
    click(root, '[data-choice^="one:"]');
    expect(text(root, '[data-panel=plan] [data-field=heads]')).toMatch(/^0 of \d+ new heads have arrived/);
    expect(text(root, '[data-panel=plan] [data-field=priority]')).toMatch(/done, due week \d+/);
    expect(text(root, '[data-panel=plan] [data-field=stake]')).toMatch(/stake/);
  });

  // @spec UI-VP-011
  it('holds the VP’s How to play topics and panel help', () => {
    const { root } = makeApp({ run: vp(3), deps: all() });
    expect($$(root, '[data-panel=help] [data-topic]').map((t) => t.dataset.topic)).toEqual(VP_HELP_TOPICS.map((t) => t.id));
    for (const panel of ['directors', 'leadership', 'plan', 'habits']) expect(text(root, `[data-panel=${panel}] [data-part=help]`).length).toBeGreaterThan(10);
  });
});

describe('the VP’s moments', () => {
  // @spec UI-VP-006
  it('shows a director’s skill beside choices that depend on them', () => {
    const run = vp(5);
    const l = lvl(run);
    const lead = Object.keys(l.leniency)[0]!;
    const odds = { ...l, moments: [{ id: 'vmx', kind: 'odds' as const, week: 0, day: 0, time: 'morning' as const, title: 'Two directors at odds', text: 'They are.', status: 'open' as const, choices: [{ id: 'together', label: 'Together' }], personId: lead, otherId: Object.keys(l.leniency)[1]! }] };
    const r = { ...run, level: odds, week: [{ source: 'level' as const, id: 'vmx', day: 0, time: 'morning' as const, title: 'Two directors at odds', status: 'open' as const }] };
    const { root } = makeApp({ run: r, deps: all() });
    click(root, '[data-action=start-week]');
    expect(text(root, '[data-choice=together] [data-part=who]')).toMatch(/^leads: /);
  });

  // @spec UI-VP-007, UI-VP-008
  it('shows chips after a choice, and a recap with heads cut and the routine folded into The whole quarter', () => {
    const { root } = makeApp({ run: vp(6), deps: all() });
    playTo(root, /company priority/i);
    click(root, '[data-choice^="one:"]');
    expect(scene(root)).toBe('reaction');
    // A chip for each band that moved, a division's headcount, a trust, the priority's schedule and the player's standing.
    const priority = { projectId: 'pp1', name: 'Atlas', divisionId: 'dv1', progress: 0, scope: 10, deadlineWeek: 9, schedule: 'onSchedule' as const, stake: 9 };
    const before = { directors: [{ id: 'dr1', name: 'Kofi', motivation: 2, stress: 2, skill: 2 }], divisions: [{ id: 'dv1', name: 'Core', headcount: 40 }], leadership: [{ id: 'x1', name: 'Ana', trust: 2 }], plan: { priority }, player: { energy: 3, reputation: 3 } };
    const after = { directors: [{ id: 'dr1', name: 'Kofi', motivation: 3, stress: 2, skill: 2 }], divisions: [{ id: 'dv1', name: 'Core', headcount: 37 }], leadership: [{ id: 'x1', name: 'Ana', trust: 3 }], plan: { priority: { ...priority, schedule: 'behind' as const } }, player: { energy: 2, reputation: 3 } };
    expect(vpRenderer.chips(before, after).map((c) => c.key)).toEqual(['dr:dr1:motivation', 'division:dv1:headcount', 'outsider:x1:trust', 'priority:pp1:schedule', 'player:energy']);
    for (let i = 0; i < 30 && scene(root) !== 'recap'; i++) {
      const s = scene(root);
      if (s === 'reaction') click(root, '[data-action=continue]');
      else if (s === 'moment') click(root, '[data-action=wait]');
      else if (s === 'done') click(root, '[data-action=finish-week]');
    }
    expect(scene(root)).toBe('recap');
    expect(text(root, '[data-part=recap-whole-week] summary')).toBe('The whole quarter');
    const r = vp(6);
    const changes = { directors: [], survey: null, heads: [], cut: 7, priority: ['Atlas landed'], leadership: [] };
    const shown = vpRenderer.recap(r, { changes, routine: { habits: [], goals: [] } });
    const box = document.createElement('div');
    for (const c of [shown.changes].flat(3)) if (c instanceof Node) box.append(c);
    expect(text(box, '[data-part=recap-cut] li')).toBe('7 heads cut.');
    expect(text(box, '[data-part=recap-priority] li')).toBe('Atlas landed.');
  });
});

describe('the VP’s review and end', () => {
  // @spec UI-VP-009, UI-VP-010
  it('names the VP’s measures at review, and ends a stayed run with the VP’s part of the career', () => {
    let run = vp(7, 'stayed');
    run = endWeeks(run, 2, all('stayed'));
    expect(run.phase).toBe('review');
    const { root } = makeApp({ run, deps: all('stayed') });
    const names = $$(root, '[data-measure] [data-field=name]').map((n) => n.textContent);
    for (const n of ['Projects shipped on time', "People you'd have kept who left", "Your CEO's confidence", "Your peers' confidence"]) expect(names).toContain(n);
    click(root, '[data-action=acknowledge]');
    expect(text(root, '[data-field=ending]')).toBe('You stayed a VP. Three years went by without the promotion.');
    expect(text(root, '[data-field=quarters]')).toBe('2');
    expect(text(root, '[data-field=directors-joined]')).toBe('nobody');
    expect(T.weeksPerQuarter).toBe(13);
  });
});
