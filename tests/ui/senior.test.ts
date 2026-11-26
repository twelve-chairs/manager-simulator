// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { lineManagerLevel } from '../../src/levels/line-manager';
import { CURVE_CHOICES, beginMonth, endMonth, seniorManagerLevel, seniorView, type SeniorState } from '../../src/levels/senior-manager';
import { newRun, type Dependencies, type Run } from '../../src/loop';
import { BAND_WORDS } from '../../src/ui/bands';
import { SENIOR_HELP_TOPICS, seniorManagerRenderer } from '../../src/ui/senior-manager';
import { endWeeks, step, stubReview } from '../loop/fixtures';
import { $, $$, CONTENT, click, makeApp, select, text } from './fixtures';

const both = (outcome: 'promote' | 'continue' | 'stayed' = 'promote'): Dependencies => ({ levels: [lineManagerLevel, seniorManagerLevel], review: stubReview(outcome).review });
/** A line manager run promoted at its first review: in the handover phase. */
const promoted = (seed = 1): Run => step(endWeeks(newRun(seed, CONTENT, both()), 13, both()), { kind: 'acknowledge' }, both());
/** The promoted run handed over to an outside hire, its later reviews answered with `outcome`. */
const senior = (seed = 1, outcome: 'promote' | 'continue' | 'stayed' = 'continue'): Run => step(promoted(seed), { kind: 'handover', choice: 'hire' }, both(outcome));
const level = (run: Run) => run.level as SeniorState;
const scene = (root: ParentNode) => $(root, '[data-scene]').dataset.scene;

describe('the handover screen', () => {
  // @spec UI-SHELL-002, UI-HAND-001
  it('says the player is promoted and asks who leads their team, offering each engineer and an outside hire', () => {
    const run = promoted(2);
    const { root } = makeApp({ run, deps: both() });
    expect($(root, '[data-screen]').dataset.screen).toBe('handover');
    expect(text(root, '[data-part=heading]')).toMatch(/promoted to senior manager/i);
    expect(text(root, '[data-part=question]')).toMatch(/who leads .+ now\?/i);
    const offered = $$(root, '[data-handover]').map((b) => b.dataset.handover);
    expect(offered).toEqual(run.handoverChoices!.map((c) => c.id));
    for (const choice of run.handoverChoices!.slice(0, -1)) {
      const button = $(root, `[data-handover="${choice.id}"]`);
      expect(text(button, '[data-field=skill]')).toBe(BAND_WORDS.skill[Math.min(4, Math.floor(choice.skill! / 20))]);
      expect(text(button, '[data-field=trust]')).toBe(BAND_WORDS.trust[Math.min(4, Math.floor(choice.trust! / 20))]);
      expect(button.querySelector('[data-field=want]')?.textContent ?? 'unknown').toMatch(/^(unknown|growth|recognition|stability|autonomy)$/);
    }
    expect(text(root, '[data-handover=hire]')).toMatch(/capable manager you don.t know yet/i);
    expect(text(root, '[data-part=trade]')).toMatch(/an engineer short.*outside hire keeps every engineer.*unsettles the team/i);
  });

  // @spec UI-HAND-002
  it('hands the run over with the player’s choice', () => {
    const { root, app } = makeApp({ run: promoted(3), deps: both() });
    click(root, '[data-handover=hire]');
    const state = app.state();
    expect(state.screen === 'run' && state.run.levelId).toBe('senior-manager');
    expect($(root, '[data-screen]').dataset.screen).toBe('week');
  });
});

describe('the senior manager’s week screen', () => {
  // @spec UI-SENIOR-001
  it('opens the first month on a scene with the habits and How to play, until the player starts it', () => {
    const { root } = makeApp({ run: senior(4), deps: both() });
    expect(scene(root)).toBe('before-monday');
    expect(text(root, '[data-scene] .where')).toBe('Before the month');
    expect($$(root, '[data-scene] [data-habit]').length).toBeGreaterThan(3);
    expect(root.querySelector('[data-scene] [data-panel=help]')).not.toBeNull();
    expect(text(root, '[data-action=start-week]')).toBe('Start month 1');
    click(root, '[data-action=start-week]');
    expect(['moment', 'done']).toContain(scene(root));
  });

  // @spec UI-SENIOR-002, UI-SENIOR-003
  it('shows a card per manager with their team beneath, labelled by where its numbers come from', () => {
    const run = senior(5);
    const { root } = makeApp({ run, deps: both() });
    const view = seniorView(level(run), run.sim);
    expect($$(root, '[data-panel=managers] [data-manager]').map((c) => c.dataset.manager)).toEqual(view.managers.map((m) => m.id));
    for (const m of view.managers) {
      const card = $(root, `[data-manager="${m.id}"]`);
      expect(text(card, '[data-field=name]')).toBe(m.name);
      expect(text(card, '[data-field=motivation]')).toBe(BAND_WORDS.motivation[m.motivation]);
      expect(text(card, '[data-field=stress]')).toBe(BAND_WORDS.stress[m.stress]);
      expect(text(card, '[data-field=skill]')).toBe(BAND_WORDS.skill[m.skill]);
      expect(text(card, '[data-field=want]')).toBe(m.want);
      const t = view.teams.find((x) => x.id === m.teamId)!;
      const team = $(card, `[data-team="${t.id}"]`);
      expect(text(team, '[data-field=headcount]')).toBe(`${t.headcount} ${t.headcount === 1 ? 'person' : 'people'}`);
      expect(text(team, '[data-field=attrition]')).toBe(BAND_WORDS.risk[t.attritionRisk]);
      expect(text(team, '[data-field=source]')).toBe(t.truth ? 'as you saw it' : `as ${m.name} tells it`);
      expect($$(team, '[data-project]').map((p) => p.dataset.project)).toEqual(t.projects.map((p) => p.id));
    }
    // a team without a manager says so
    const leaderless = structuredClone(run);
    const teamId = level(run).teamIds[1]!;
    leaderless.sim.teams[teamId]!.leader = null;
    expect(text(makeApp({ run: leaderless, deps: both() }).root, `[data-panel=managers] [data-team="${teamId}"]`)).toMatch(/No manager yet/);
  });

  // @spec UI-SENIOR-004
  it('has the senior habits, each sending a plan command, with the panels’ help lines', () => {
    const run = senior(6);
    const { root, app } = makeApp({ run, deps: both() });
    const m = seniorView(level(run), run.sim).managers[0]!.id;
    const habits = $(root, '[data-panel=habits]');
    expect($$(habits, '[data-habit]').map((s) => s.dataset.habit)).toEqual([...level(run).teamIds.map((t) => `oversight:${(run.sim.teams[t]!.leader as { id: string }).id}`), 'oneOnOnes', 'backfill', 'skipLevel', 'newWork']);
    select(root, '[data-panel=habits] [data-habit=oneOnOnes]', 'weekly');
    select(root, `[data-panel=habits] [data-habit="oversight:${m}"]`, 'close');
    const state = app.state();
    const l = state.screen === 'run' ? level(state.run) : null;
    expect(l?.habits.oneOnOnes).toBe('weekly');
    expect(l?.habits.oversight[m]).toBe('close');
    expect(text(root, '[data-panel=managers] [data-part=help]').length).toBeGreaterThan(0);
    expect(text(root, '[data-panel=habits] [data-part=help]').length).toBeGreaterThan(0);
  });

  // @spec UI-SENIOR-005
  it('shows calibration as each team’s proposal beside its delivery, with moves, accept-all and settle', () => {
    let run = senior(7);
    run = endWeeks(run, 5, both('continue'));
    // let any moment ahead of calibration wait, so calibration is the scene
    const calibrationId = level(run).moments.find((m) => m.kind === 'calibration')!.id;
    while (run.week.find((m) => m.status === 'open')?.id !== calibrationId) run = step(run, { kind: 'wait' }, both('continue'));
    const { root, app } = makeApp({ run, deps: both('continue') });
    if (scene(root) === 'recap') click(root, '[data-action=close-recap]');
    if (scene(root) === 'opening') click(root, '[data-action=start-week]');
    expect(text(root, '[data-scene] [data-part=heading]')).toBe('Calibration');
    const teams = $$(root, '[data-calibration]').map((t) => t.dataset.calibration);
    expect(teams).toEqual(level(run).teamIds);
    const first = $(root, `[data-calibration="${teams[0]}"]`);
    const entry = level(run).moments.find((m) => m.kind === 'calibration')!.calibration![0]!;
    for (const r of ['below', 'partial', 'meets', 'exceeds', 'outstanding'] as const) {
      expect(text(first, `[data-proposed=${r}]`)).toBe(String(entry.proposed[r]));
      expect(text(first, `[data-delivered=${r}]`)).toBe(String(entry.delivered[r]));
    }
    expect(root.querySelector('[data-choice=acceptAll]')).not.toBeNull();
    // the group's curve, beside the top ratings the teams would hold as the moves stand
    const moment = level(run).moments.find((m) => m.kind === 'calibration')!;
    const topOf = (c: { exceeds: number; outstanding: number }) => c.exceeds + c.outstanding;
    const proposedTop = moment.calibration!.reduce((n, c) => n + topOf(c.proposed), 0);
    expect(text(root, '[data-part=curve] [data-curve-room]')).toBe(String(moment.curve));
    expect(text(root, '[data-part=curve] [data-curve-held]')).toBe(String(proposedTop));
    expect(text(root, '[data-part=curve]')).toMatch(/^Top ratings \(exceeds and outstanding\)/);
    const top = (['outstanding', 'exceeds', 'meets', 'partial'] as const).find((r) => entry.proposed[r] > 0)!;
    const lower = { outstanding: 'exceeds', exceeds: 'meets', meets: 'partial', partial: 'below' }[top];
    // no move is offered out of an empty rating
    expect(root.querySelector(`[data-move="${teams[0]}:below:partial"]`) === null).toBe(entry.proposed.below === 0);
    click(root, `[data-move="${teams[0]}:${top}:${lower}"]`);
    // the move redraws the page, so the team's table is found again
    expect(text(root, `[data-calibration="${teams[0]}"] [data-proposed=${lower}]`)).toBe(String(entry.proposed[lower as 'meets'] + 1));
    // a head moved out of the top ratings shows in the curve at once
    expect(text(root, '[data-part=curve] [data-curve-held]')).toBe(String(proposedTop - (top === 'exceeds' ? 1 : 0)));
    // one move per team undoes its manager's inflation: the proposal set to what the team delivered
    click(root, `[data-set-delivered="${teams[1]}"]`);
    const second = moment.calibration![1]!;
    for (const r of ['below', 'partial', 'meets', 'exceeds', 'outstanding'] as const) expect(text(root, `[data-calibration="${teams[1]}"] [data-proposed=${r}]`)).toBe(String(second.delivered[r]));
    click(root, '[data-action=settle]');
    const state = app.state();
    if (state.screen !== 'run') throw new Error('expected a run');
    expect(state.run.sim.teams[teams[0]!]!.aggregate!.ratings[lower as 'meets']).toBe(entry.proposed[lower as 'meets'] + 1);
    expect({ ...state.run.sim.teams[teams[1]!]!.aggregate!.ratings, unrated: 0 }).toEqual({ ...second.delivered, unrated: 0 });
  });
});

describe('calibration over the curve, played', () => {
  // @spec UI-SENIOR-011, LOOP-CMD-003
  it('asks the room’s question straight after a settlement over the curve, through the real loop', () => {
    let run = senior(7);
    run = endWeeks(run, 5, both('continue'));
    const calibrationId = level(run).moments.find((m) => m.kind === 'calibration')!.id;
    while (run.week.find((m) => m.status === 'open')?.id !== calibrationId) run = step(run, { kind: 'wait' }, both('continue'));
    const moment = level(run).moments.find((m) => m.id === calibrationId)!;
    const proposedTop = moment.calibration!.reduce((n, c) => n + c.proposed.exceeds + c.proposed.outstanding, 0);
    expect(proposedTop, 'the proposals go over the curve').toBeGreaterThan(moment.curve!);
    const { root } = makeApp({ run, deps: both('continue') });
    if (scene(root) === 'recap') click(root, '[data-action=close-recap]');
    if (scene(root) === 'opening') click(root, '[data-action=start-week]');
    click(root, '[data-scene] [data-choice=acceptAll]');
    // the reaction, then the same moment again with the room's question
    if (root.querySelector('[data-action=continue]')) click(root, '[data-action=continue]');
    expect(text(root, '[data-part=over-curve]')).toContain(`the curve allows ${moment.curve}`);
    expect(root.querySelector('[data-scene] [data-choice=argue]')).not.toBeNull();
    expect(root.querySelector('[data-scene] [data-choice=trim]')).not.toBeNull();
  });
});

describe('calibration over the curve', () => {
  // @spec UI-SENIOR-011
  it('says how far over the curve the settled ratings are, and offers to argue or let the room trim', () => {
    let run = senior(7);
    run = endWeeks(run, 5, both('continue'));
    const calibrationId = level(run).moments.find((m) => m.kind === 'calibration')!.id;
    while (run.week.find((m) => m.status === 'open')?.id !== calibrationId) run = step(run, { kind: 'wait' }, both('continue'));
    const over = structuredClone(run);
    const m = (over.level as SeniorState).moments.find((x) => x.id === calibrationId)!;
    m.overCurve = { held: 9, room: 6 };
    m.choices = CURVE_CHOICES;
    const { root } = makeApp({ run: over, deps: both('continue') });
    if (scene(root) === 'recap') click(root, '[data-action=close-recap]');
    if (scene(root) === 'opening') click(root, '[data-action=start-week]');
    expect(text(root, '[data-part=over-curve]')).toContain('9 top ratings');
    expect(text(root, '[data-part=over-curve]')).toContain('6');
    expect(text(root, '[data-choice=argue]')).toMatch(/good or excellent reputation/i);
    expect(root.querySelector('[data-choice=trim]')).not.toBeNull();
    // the settled teams are not offered for moving again
    expect(root.querySelector('[data-action=settle]')).toBeNull();
  });
});

describe('the senior manager renderer', () => {
  // @spec UI-WEEK-019
  it('shows a manager a choice added stress to, without moving their band, as a heavier week', () => {
    const run = senior(8);
    const view = seniorView(level(run), run.sim);
    const m = view.managers[0]!;
    const chips = seniorManagerRenderer.chips(view, view, (id) => id === m.id);
    expect(chips).toContainEqual({ key: `manager:${m.id}:heavier`, text: `${m.name}: a heavier week`, tone: 'bad' });
    expect(seniorManagerRenderer.chips(view, view, () => false).some((c) => c.key.endsWith(':heavier'))).toBe(false);
  });

  // @spec UI-SENIOR-006
  it('shows the manager’s skill beside a choice that depends on them', () => {
    const run = senior(8);
    const l = level(run);
    const busy = structuredClone(run.sim);
    for (const t of l.teamIds) busy.teams[t]!.aggregate!.stress = 80;
    const begun = beginMonth(l, busy);
    const view = seniorView(begun, busy);
    const e = view.moments.find((m) => m.kind === 'escalation')!;
    const details = seniorManagerRenderer.moment({ view } as never, e.id)!;
    const m = view.managers.find((x) => x.id === e.managerIds[0])!;
    for (const c of details.choices) expect(c.note).toBe(`manages: ${BAND_WORDS.skill[m.skill]}`);
  });

  // @spec UI-SENIOR-007
  it('chips each band that moved for managers, teams and the player, and each headcount change', () => {
    const run = senior(9);
    const before = seniorView(level(run), run.sim);
    const after = structuredClone(before);
    after.managers[0]!.stress = Math.min(4, before.managers[0]!.stress + 1);
    after.teams[1]!.motivation = Math.max(0, before.teams[1]!.motivation - 1);
    after.teams[2]!.headcount = before.teams[2]!.headcount + 1;
    after.player.energy = Math.max(0, before.player.energy - 1);
    const chips = seniorManagerRenderer.chips(before, after).map((c) => c.text);
    expect(chips).toEqual(
      expect.arrayContaining([
        `${before.managers[0]!.name}: more stressed`,
        `${before.teams[1]!.name}: less motivated`,
        `${before.teams[2]!.name}: one more person`,
        'You: less energy',
      ]),
    );
  });

  // @spec UI-SENIOR-008
  it('recaps what changed, or a quiet month, and folds the habits and goals into The whole month', () => {
    const run = senior(10);
    const ended = endMonth(level(run), run.sim);
    if (!ended.ok) throw new Error(ended.error);
    const part = seniorManagerRenderer.recap(run, ended.recap);
    const holder = document.createElement('div');
    const append = (c: unknown) => (Array.isArray(c) ? c.forEach(append) : c instanceof Node ? holder.append(c) : null);
    append(part.changes);
    const routine = document.createElement('div');
    for (const c of [part.routine].flat(3)) if (c instanceof Node) routine.append(c);
    expect(routine.querySelector('[data-part=recap-habits] li')).not.toBeNull();
    expect($$(routine, '[data-part=recap-goals] li')).toHaveLength(level(run).goals.length);
    const quiet = seniorManagerRenderer.recap(run, { changes: { managers: [], teams: [], heads: [], slipped: [], assigned: [] }, routine: { habits: [], goals: [] } });
    const q = document.createElement('div');
    for (const c of [quiet.changes].flat(3)) if (c instanceof Node) q.append(c);
    expect(text(q, '[data-part=recap-quiet]')).toBe('A quiet month.');
    // a project that shipped in the month just played, with its team
    const shipped = structuredClone(run);
    const p = Object.values(shipped.sim.projects).find((x) => level(shipped).teamIds.includes(x.teamId) && x.status === 'active')!;
    Object.assign(p, { status: 'completed', deadlineWeek: shipped.sim.week - 4 });
    level(shipped).completions[p.id] = shipped.sim.week - 4;
    const withShipped = seniorManagerRenderer.recap(shipped, { changes: { managers: [], teams: [], heads: [], slipped: [], assigned: [] }, routine: { habits: [], goals: [] } });
    const s = document.createElement('div');
    for (const c of [withShipped.changes].flat(3)) if (c instanceof Node) s.append(c);
    expect(text(s, '[data-part=recap-shipped] li')).toBe(`${p.name} shipped on time (${shipped.sim.teams[p.teamId]!.name}).`);
    expect(s.querySelector('[data-part=recap-quiet]')).toBeNull();
    // new work the player's manager gave a team with room
    const withWork = seniorManagerRenderer.recap(run, { changes: { managers: [], teams: [], heads: [], slipped: [], assigned: [{ teamId: 't9', name: 'Search', project: 'Ledger sync' }] }, routine: { habits: [], goals: [] } });
    const w = document.createElement('div');
    for (const c of [withWork.changes].flat(3)) if (c instanceof Node) w.append(c);
    expect(text(w, '[data-part=recap-assigned] li')).toBe('Your manager gave Ledger sync to Search.');
    expect(w.querySelector('[data-part=recap-quiet]')).toBeNull();
    // and the shell titles the disclosure for a month
    const later = endWeeks(run, 1, both('continue'));
    const { root } = makeApp({ run: later, deps: both('continue') });
    expect(text(root, '[data-part=recap-whole-week] summary')).toBe('The whole month');
  });

  // @spec UI-SENIOR-009
  it('names the senior measures, and ends a stayed run as a senior manager', () => {
    const run = senior(11);
    const view = seniorView(level(run), run.sim);
    const names = ['completedOnTime', 'onScheduleShare', 'regrettedAttrition', 'motivation', 'stress', 'managerGrowth', 'healthHeld', 'calibrationQuality', 'reputation'].map((id) => seniorManagerRenderer.measureName(view, id));
    expect(names).toEqual(['Projects shipped on time', 'Projects on schedule', "People you'd have kept who left", 'Team motivation', 'Team stress', 'How much your managers grew', 'Teams that held up', 'Calibration quality', 'Your reputation']);
    const stayed: Run = { ...run, phase: 'ended', ending: 'stayed' };
    expect(text(makeApp({ run: stayed, deps: both() }).root, '[data-field=ending]')).toBe('You stayed a senior manager. Three years went by without the promotion.');
  });

  // @spec UI-SENIOR-010, UI-END-002
  it('tells the whole career at the end: the line manager’s part, then the senior manager’s', () => {
    const run = endWeeks(senior(12), 2, both('continue'));
    const ended: Run = { ...run, phase: 'ended', ending: 'burnout' };
    const { root } = makeApp({ run: ended, deps: both() });
    expect(root.querySelector('[data-part=career] [data-field=shipped]')).not.toBeNull();
    expect(text(root, '[data-part=career] [data-field=months]')).toBe('2');
    expect(root.querySelector('[data-part=career] [data-field=managers-joined]')).not.toBeNull();
    expect(root.querySelector('[data-part=career] [data-field=managers-let-go]')).not.toBeNull();
  });
});

describe('months on screen', () => {
  // @spec UI-WEEK-016
  it('names a monthly turn in months from the level’s start, and a moment by its week and day', () => {
    const run = senior(13);
    const { root } = makeApp({ run, deps: both('continue') });
    expect(text(root, '.week-number')).toMatch(/^Month 1 · review in 6 months$/);
    click(root, '[data-action=start-week]');
    if (scene(root) === 'moment') expect(text(root, '[data-field=when]')).toMatch(/^Week [1-4], (Monday|Tuesday|Wednesday|Thursday|Friday) (morning|afternoon|night)$/);
    const later = endWeeks(run, 1, both('continue'));
    const next = makeApp({ run: later, deps: both('continue') }).root;
    expect(text(next, '[data-scene] [data-part=heading]')).toBe('How month 1 went');
    expect(text(next, '[data-action=close-recap]')).toBe('Start month 2');
    const reviewed = endWeeks(later, 5, both('continue'));
    expect(reviewed.phase).toBe('review');
    expect(text(makeApp({ run: reviewed, deps: both('continue') }).root, '[data-part=heading]')).toBe('Month 6 review');
  });
});

describe('the day strip in a month', () => {
  // @spec UI-WEEK-016
  it('marks every day of the week past once the month is done', () => {
    let run = senior(16);
    const d = both('continue');
    while (run.week.some((m) => m.status === 'open')) run = step(run, { kind: 'wait' }, d);
    // every moment let wait: the opening scene has passed, and the month is done
    const { root } = makeApp({ run, deps: d });
    expect(scene(root)).toBe('done');
    expect($$(root, '[data-panel=days] [data-day]').map((x) => x.dataset.state)).toEqual(['past', 'past', 'past', 'past', 'past']);
  });
});

describe('help and words', () => {
  // @spec UI-HELP-001
  it('shows the senior manager’s How to play topics', () => {
    const { root } = makeApp({ run: senior(14), deps: both() });
    expect(SENIOR_HELP_TOPICS.map((t) => t.title)).toEqual(['How to play', 'Managers', "What you're told", 'Calibration', 'Energy', 'Reviews']);
    expect($$(root, '[data-scene] [data-panel=help] [data-topic]').map((t) => t.dataset.topic)).toEqual(SENIOR_HELP_TOPICS.map((t) => t.id));
  });

  // @spec UI-BAND-001
  it('names trust’s bands', () => {
    expect(BAND_WORDS.trust).toEqual(['wary', 'guarded', 'neutral', 'trusting', 'loyal']);
  });

  // @spec UI-REVIEW-001, UI-END-001
  it('says staying at the level in the level’s own words', () => {
    const run = endWeeks(senior(15, 'stayed'), 6, both('stayed'));
    expect(run.phase).toBe('review');
    expect(text(makeApp({ run, deps: both('stayed') }).root, '[data-field=outcome]')).toMatch(/last review as a senior manager/i);
  });
});
