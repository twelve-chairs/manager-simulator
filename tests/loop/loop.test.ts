import { describe, expect, it } from 'vitest';
import { lineManagerLevel, type LineState } from '../../src/levels/line-manager';
import { apply, newRun, replay, type Command, type Run } from '../../src/loop';
import { debriefsSince, selectSituations } from '../../src/situations';
import { advance } from '../../src/sim';
import { CONTENT, deps, endWeeks, step, stubReview } from './fixtures';

const L = lineManagerLevel;
const start = (seed = 1, d = deps()) => newRun(seed, CONTENT, d);
const level = (run: Run) => run.level as LineState;

/** Expects a command to fail and leave the run unchanged. */
function expectRefused(run: Run, command: Command, d = deps()) {
  const before = structuredClone(run);
  const result = apply(run, command, CONTENT, d);
  expect(result.ok).toBe(false);
  expect(run).toEqual(before);
  return result;
}

describe('the run', () => {
  // @spec LOOP-RUN-001
  it('starts week 0 of the lowest level in planning, with situations and no last week', () => {
    const run = start(3);
    const { sim, level: initial } = L.start(3);
    const begun = L.beginWeek(initial, sim);
    expect(run).toMatchObject({ seed: 3, levelId: 'line-manager', phase: 'planning', lastWeek: null, review: null, ending: null, commands: [] });
    expect(run.sim).toEqual(sim);
    expect(run.level).toEqual(begun);
    expect(run.plan).toEqual(L.emptyPlan());
    expect(run.presented.length).toBeGreaterThan(0);
    expect(run.presented.length).toBeLessThanOrEqual(L.params.situationLimit);
    expect(run.presented.every((p) => p.status === 'open')).toBe(true);
  });

  // @spec LOOP-RUN-002
  it('survives JSON unchanged', () => {
    let run = endWeeks(start(), 3);
    run = step(run, { kind: 'answer', presentationId: run.presented[0]!.presentation.id, choiceId: run.presented[0]!.presentation.choices[0]!.id });
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });

  // @spec LOOP-RUN-003
  it('leaves the input run unchanged', () => {
    const run = start();
    const before = structuredClone(run);
    step(run, { kind: 'endWeek' });
    step(run, { kind: 'answer', presentationId: run.presented[0]!.presentation.id, choiceId: run.presented[0]!.presentation.choices[0]!.id });
    expect(run).toEqual(before);
  });

  // @spec LOOP-RUN-004
  it('records applied commands and not failed ones', () => {
    let run = start();
    run = step(run, { kind: 'endWeek' });
    const failed = apply(run, { kind: 'acknowledge' }, CONTENT, deps());
    expect(failed.ok).toBe(false);
    expect(failed.run.commands).toEqual([{ kind: 'endWeek' }]);
    run = step(run, { kind: 'endWeek' });
    expect(run.commands).toEqual([{ kind: 'endWeek' }, { kind: 'endWeek' }]);
  });

  // @spec LOOP-RUN-005
  it('replays a run from its seed, content and commands', () => {
    let run = start(9);
    for (let week = 0; week < 15; week++) {
      if (run.phase === 'review') run = step(run, { kind: 'acknowledge' });
      const open = run.presented.find((p) => p.status === 'open');
      if (open) run = step(run, { kind: 'answer', presentationId: open.presentation.id, choiceId: open.presentation.choices[0]!.id });
      const demand = level(run).inbox[0];
      if (demand && demand.type !== 'workIntake') run = step(run, { kind: 'plan', command: { kind: 'decide', demandId: demand.id, decision: { kind: 'handle' } } });
      run = step(run, { kind: 'endWeek' });
    }
    expect(replay(9, CONTENT, deps(), run.commands)).toEqual(run);
  });
});

describe('commands', () => {
  // @spec LOOP-CMD-001
  it('refuses commands the phase does not allow', () => {
    const planning = start();
    expectRefused(planning, { kind: 'acknowledge' });
    const review = endWeeks(planning, 13);
    expect(review.phase).toBe('review');
    expectRefused(review, { kind: 'endWeek' });
    expectRefused(review, { kind: 'plan', command: { kind: 'clear', demandId: 'x' } });
    const ended = step(endWeeks(start(1, deps(stubReview('managedOut').review)), 13, deps(stubReview('managedOut').review)), { kind: 'acknowledge' }, deps(stubReview('managedOut').review));
    expect(ended.phase).toBe('ended');
    for (const command of [{ kind: 'endWeek' }, { kind: 'acknowledge' }] as Command[]) expectRefused(ended, command);

    // a run from a tampered save is refused, not thrown on
    expectRefused({ ...planning, phase: 'paused' as never }, { kind: 'endWeek' });
    expectRefused({ ...planning, levelId: 'director' }, { kind: 'endWeek' });
    expectRefused(planning, { kind: 'plan', command: null });
  });

  // @spec LOOP-CMD-002
  it('passes plan commands to the level and refuses ones it rejects', () => {
    const run = start();
    const e = Object.keys(run.sim.people).sort()[0]!;
    const command = { kind: 'calendar', add: [{ action: 'line-manager.coaching', target: { kind: 'person', id: e }, cadence: 'once' }] };
    const planned = step(run, { kind: 'plan', command });
    const direct = L.updatePlan(run.level as LineState, run.sim, run.plan as never, command as never);
    if (!direct.ok) throw new Error(direct.error);
    expect(planned.level).toEqual(direct.level);
    expect(planned.plan).toEqual(direct.plan);
    expectRefused(run, { kind: 'plan', command: { kind: 'decide', demandId: 'missing', decision: { kind: 'handle' } } });
  });

  // @spec LOOP-CMD-003
  it('resolves answers at once and records the aftermath, or the expiry', () => {
    const run = start();
    const open = run.presented[0]!;
    const answered = step(run, { kind: 'answer', presentationId: open.presentation.id, choiceId: open.presentation.choices[0]!.id });
    const record = answered.presented.find((p) => p.presentation.id === open.presentation.id)!;
    expect(record.status).toBe('answered');
    expect(typeof record.aftermath).toBe('string');
    expect(answered.engine).not.toEqual(run.engine);

    // a situation about someone who has since left expires
    const personalOnly = [CONTENT[2]!];
    const about = newRun(1, personalOnly, deps());
    const personal = about.presented[0]!;
    const gone = structuredClone(about);
    gone.sim.people[personal.presentation.bindings.engineer!]!.status = 'departed';
    const expired = step(gone, { kind: 'answer', presentationId: personal.presentation.id, choiceId: 'talk' }, deps(), personalOnly);
    expect(expired.presented[0]!.status).toBe('expired');
  });

  // @spec LOOP-CMD-004
  it('refuses answers the situation engine rejects', () => {
    const run = start();
    expectRefused(run, { kind: 'answer', presentationId: run.presented[0]!.presentation.id, choiceId: 'no-such-choice' });
    expectRefused(run, { kind: 'answer', presentationId: 'no-such-presentation', choiceId: 'ok' });
  });

  // @spec LOOP-CMD-005
  it('ends a week with situations unanswered, which close as ignored', () => {
    const run = start();
    const next = step(run, { kind: 'endWeek' });
    expect(debriefsSince(next.engine, 0).map((r) => r.status)).toEqual(run.presented.map(() => 'ignored'));
  });
});

describe('a week', () => {
  // @spec LOOP-WEEK-001
  it('refuses to end a week the level rejects', () => {
    let run = start();
    const e = Object.keys(run.sim.people).sort()[0]!;
    const coaching = { action: 'line-manager.coaching', target: { kind: 'person', id: e }, cadence: 'once' };
    run = step(run, { kind: 'plan', command: { kind: 'calendar', add: Array.from({ length: 40 }, () => coaching) } });
    expectRefused(run, { kind: 'endWeek' });
  });

  // @spec LOOP-WEEK-002, LOOP-WEEK-005
  it('commits, advances, runs after-advance, then begins the next week', () => {
    const run = start(2);
    const next = step(run, { kind: 'endWeek' });
    const committed = L.commit(level(run), run.sim, run.plan as never);
    if (!committed.ok) throw new Error(committed.error);
    const advanced = advance(committed.sim, L.params.weeksPerStep).state;
    const after = L.afterAdvance(committed.level, advanced);
    const begun = L.beginWeek(after.level, advanced);
    expect(next.sim.week).toBe(1);
    expect(next.sim).toEqual(advanced);
    expect(next.level).toEqual(begun);
    expect(next.plan).toEqual(L.emptyPlan());
    const selected = selectSituations(
      // the engine after the answers this week: none
      run.engine,
      advanced,
      CONTENT,
      'line-manager',
      L.params.situationLimit,
      { weeksToReview: L.params.reviewEveryWeeks - 1 },
    );
    expect(next.engine).toEqual(selected.engine);
    expect(next.presented.map((p) => p.presentation)).toEqual(selected.presented);
  });

  // @spec LOOP-WEEK-003
  it('ends the run on burnout before a due review', () => {
    const { review, calls } = stubReview();
    let run = endWeeks(start(1, deps(review)), 12, deps(review));
    expect(run.sim.week).toBe(12);
    run = structuredClone(run);
    run.sim.player.stress = 100;
    (run.level as LineState).burnoutWeeks = 3;
    const ended = step(run, { kind: 'endWeek' }, deps(review));
    expect(ended.phase).toBe('ended');
    expect(ended.ending).toBe('burnout');
    expect(calls).toHaveLength(0);
  });

  // @spec LOOP-WEEK-004
  it('conducts a review every 13 weeks with the level scorecard', () => {
    const { review, calls } = stubReview();
    const d = deps(review);
    let run = endWeeks(start(1, d), 12, d);
    expect(run.phase).toBe('planning');
    const beforeReview = run;
    run = step(run, { kind: 'endWeek' }, d);
    expect(run.phase).toBe('review');
    expect(run.sim.week).toBe(13);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.levelId).toBe('line-manager');
    const committed = L.commit(level(beforeReview), beforeReview.sim, beforeReview.plan as never);
    if (!committed.ok) throw new Error(committed.error);
    const advanced = advance(committed.sim, 1).state;
    expect(calls[0]!.scorecard).toEqual(L.scorecard(L.afterAdvance(committed.level, advanced).level, advanced));
    expect(run.sim.player.reputation).toBe(77);
    expect(run.review).toEqual({ rating: 'meets', outcome: 'continue' });
  });

  // @spec LOOP-WEEK-004, LOOP-WEEK-007
  it('reviews after the advance that crosses a review week when the step does not divide the cadence', () => {
    const monthly = { ...L, params: { ...L.params, weeksPerStep: 4 } };
    const { review, calls } = stubReview();
    const d = { levels: [monthly], review };
    const timed = (weeks: number) => ({ ...CONTENT[0]!, id: `in-${weeks}`, when: { value: 'review.weeksAway', is: weeks } }) as (typeof CONTENT)[number];
    const content = [4, 12, 16].map(timed);
    let run = newRun(1, content, d);
    // week 0: the review falls after the step that reaches week 13, which ends at week 16
    expect(run.presented.map((p) => p.presentation.situationId)).toEqual(['in-16']);
    const weeks: number[] = [];
    while (run.phase === 'planning') {
      run = step(run, { kind: 'endWeek' }, d, content);
      weeks.push(run.sim.week);
    }
    expect(weeks).toEqual([4, 8, 12, 16]);
    expect(calls).toHaveLength(1);
    run = step(run, { kind: 'acknowledge' }, d, content);
    // week 16: the next review is after the step that reaches week 26, which ends at week 28
    expect(run.presented.map((p) => p.presentation.situationId)).toEqual(['in-12']);
    run = endWeeks(run, 5, d);
    expect(run.sim.week).toBe(28);
    expect(run.phase).toBe('review');
    expect(calls).toHaveLength(2);
  });

  // @spec LOOP-WEEK-006
  it('keeps the level report and the week’s aftermaths as last week', () => {
    let run = start();
    const open = run.presented[0]!;
    run = step(run, { kind: 'answer', presentationId: open.presentation.id, choiceId: open.presentation.choices[0]!.id });
    const aftermath = run.presented[0]!.aftermath!;
    const committed = L.commit(level(run), run.sim, run.plan as never);
    if (!committed.ok) throw new Error(committed.error);
    run = step(run, { kind: 'endWeek' });
    expect(run.lastWeek).toEqual({ report: committed.report, aftermaths: [aftermath] });
  });

  // @spec LOOP-WEEK-007
  it('tells the situation engine how many weeks remain until the review', () => {
    const timed = (weeks: number) => ({ ...CONTENT[0]!, id: `review-in-${weeks}`, when: { value: 'review.weeksAway', is: weeks } }) as (typeof CONTENT)[number];
    const content = [timed(13), timed(1)];
    const atStart = newRun(1, content, deps());
    expect(atStart.presented.map((p) => p.presentation.situationId)).toEqual(['review-in-13']);
    let run = atStart;
    for (let i = 0; i < 12; i++) run = step(run, { kind: 'endWeek' }, deps(), content);
    expect(run.sim.week).toBe(12);
    expect(run.presented.map((p) => p.presentation.situationId)).toEqual(['review-in-1']);
  });
});

describe('reviews', () => {
  // @spec LOOP-REV-001
  it('begins the next week when a review says continue', () => {
    const run = step(endWeeks(start(), 13), { kind: 'acknowledge' });
    expect(run.phase).toBe('planning');
    expect(run.review).toBeNull();
    expect(run.sim.week).toBe(13);
    expect(run.presented.length).toBeGreaterThan(0);
  });

  // @spec LOOP-REV-002
  it('ends the run when the player is managed out', () => {
    const d = deps(stubReview('managedOut').review);
    const run = step(endWeeks(start(1, d), 13, d), { kind: 'acknowledge' }, d);
    expect(run).toMatchObject({ phase: 'ended', ending: 'managedOut' });
  });

  // @spec LOOP-REV-003
  it('ends the run as completed on promotion past the highest level', () => {
    const d = deps(stubReview('promote').review);
    const run = step(endWeeks(start(1, d), 13, d), { kind: 'acknowledge' }, d);
    expect(run).toMatchObject({ phase: 'ended', ending: 'completed' });
  });
});
