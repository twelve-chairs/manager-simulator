import { describe, expect, it } from 'vitest';
import { lineManagerLevel, type LineState } from '../../src/levels/line-manager';
import { apply, newRun, replay, type AnyLevel, type Command, type Run } from '../../src/loop';
import { debriefsSince, selectSituations, type Situation } from '../../src/situations';
import { advance, type ChangeLogEntry, type SimState } from '../../src/sim';
import { conductReview } from '../../src/review';
import { plain } from '../situations/fixtures';
import { CONTENT, answerCurrent, choicesOf, current, deps, endWeeks, step, stubReview, waitUntil } from './fixtures';

const L = lineManagerLevel;
const start = (seed = 1, d = deps()) => newRun(seed, CONTENT, d);
const level = (run: Run) => run.level as LineState;
const TIME_RANK = { morning: 0, afternoon: 1, night: 2 } as const;

/** Expects a command to fail and leave the run unchanged. */
function expectRefused(run: Run, command: Command, d = deps(), content = CONTENT) {
  const before = structuredClone(run);
  const result = apply(run, command, content, d);
  expect(result.ok).toBe(false);
  expect(run).toEqual(before);
  return result;
}

describe('the run', () => {
  // @spec LOOP-RUN-001
  it('starts week 0 of the lowest level in the week phase, with its moments and no last week', () => {
    const run = start(3);
    const { sim, level: initial } = L.start(3);
    const begun = L.beginWeek(initial, sim);
    expect(run).toMatchObject({ seed: 3, levelId: 'line-manager', phase: 'week', lastWeek: null, review: null, ending: null, commands: [] });
    expect(run).not.toHaveProperty('plan');
    expect(run.sim).toEqual(sim);
    expect(run.level).toEqual(begun);
    expect(run.presented.length).toBeGreaterThan(0);
    expect(run.presented.length).toBeLessThanOrEqual(L.params.situationLimit);
    expect(run.week).toHaveLength(L.moments(begun, sim).length + run.presented.length);
    expect(run.week.every((m) => m.status === 'open')).toBe(true);
  });

  // @spec LOOP-RUN-002
  it('survives JSON unchanged', () => {
    let run = endWeeks(start(), 3);
    run = answerCurrent(run);
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });

  // @spec LOOP-RUN-003
  it('leaves the input run unchanged', () => {
    const run = start();
    const before = structuredClone(run);
    step(run, { kind: 'endWeek' });
    answerCurrent(run);
    step(run, { kind: 'wait' });
    step(run, { kind: 'plan', command: { kind: 'habit', habit: 'ceremonies', value: 'light' } });
    expect(run).toEqual(before);
  });

  // @spec LOOP-RUN-004
  it('records applied commands and not failed ones', () => {
    let run = start();
    run = step(run, { kind: 'endWeek' });
    const failed = apply(run, { kind: 'acknowledge' }, CONTENT, deps());
    expect(failed.ok).toBe(false);
    expect(failed.run.commands).toEqual([{ kind: 'endWeek' }]);
    run = step(run, { kind: 'wait' });
    expect(run.commands).toEqual([{ kind: 'endWeek' }, { kind: 'wait' }]);
  });

  // @spec LOOP-RUN-005
  it('replays a run from its seed, content and commands', () => {
    let run = start(9);
    for (let week = 0; week < 15 && run.phase !== 'ended'; week++) {
      if (run.phase === 'review') run = step(run, { kind: 'acknowledge' });
      if (week === 2) run = step(run, { kind: 'plan', command: { kind: 'habit', habit: 'oneOnOnes', value: 'weekly' } });
      for (let i = 0; current(run) && i < 6; i++) run = i % 3 === 2 ? step(run, { kind: 'wait' }) : answerCurrent(run, week + i);
      run = step(run, { kind: 'endWeek' });
    }
    expect(run.commands.length).toBeGreaterThan(30);
    expect(replay(9, CONTENT, deps(), run.commands)).toEqual(run);
  });
});

describe('commands', () => {
  // @spec LOOP-CMD-001
  it('refuses commands the phase does not allow', () => {
    const week = start();
    expectRefused(week, { kind: 'acknowledge' });
    const review = endWeeks(week, 13);
    expect(review.phase).toBe('review');
    for (const command of [{ kind: 'endWeek' }, { kind: 'wait' }, { kind: 'plan', command: { kind: 'habit', habit: 'ceremonies', value: 'light' } }] as Command[]) expectRefused(review, command);
    const managedOut = deps(stubReview('managedOut').review);
    const ended = step(endWeeks(start(1, managedOut), 13, managedOut), { kind: 'acknowledge' }, managedOut);
    expect(ended.phase).toBe('ended');
    for (const command of [{ kind: 'endWeek' }, { kind: 'acknowledge' }, { kind: 'wait' }] as Command[]) expectRefused(ended, command);

    // a run from a tampered save is refused, not thrown on
    expectRefused({ ...week, phase: 'paused' as never }, { kind: 'endWeek' });
    expectRefused({ ...week, levelId: 'director' }, { kind: 'endWeek' });
    expectRefused(week, { kind: 'plan', command: null });
  });

  // @spec LOOP-CMD-002
  it('passes plan commands to the level at once and refuses ones it rejects', () => {
    const run = start();
    const command = { kind: 'habit', habit: 'ceremonies', value: 'light' };
    const planned = step(run, { kind: 'plan', command });
    const direct = L.plan(level(run), run.sim, command);
    if (!direct.ok) throw new Error(direct.error);
    expect(planned.level).toEqual(direct.level);
    expect(planned.sim).toEqual(run.sim);
    expectRefused(run, { kind: 'plan', command: { kind: 'habit', habit: 'coffee', value: 'yes' } });
  });

  // @spec LOOP-CMD-003
  it('applies a level moment’s choice through the level and records its reaction', () => {
    const run = waitUntil(start(), 'level');
    const m = current(run)!;
    const choiceId = choicesOf(run, m)[0]!;
    const answered = step(run, { kind: 'answer', momentId: m.id, choiceId });
    const direct = L.choose(level(run), run.sim, m.id, choiceId);
    if (!direct.ok) throw new Error(direct.error);
    expect(answered.level).toEqual(direct.level);
    expect(answered.sim).toEqual(direct.sim);
    expect(answered.week.find((x) => x.id === m.id)).toMatchObject({ status: 'answered', text: direct.reaction });
  });

  // @spec LOOP-CMD-003
  it('keeps a level moment open after a choice when the level still has a step for it, so it comes back at once', () => {
    let target = '';
    // A level whose moment, once answered, asks one more question: the level reports it still open.
    const twoStep: AnyLevel = {
      ...L,
      choose(l, s, momentId, choiceId) {
        const r = L.choose(l as LineState, s, momentId, choiceId);
        target = momentId;
        return r;
      },
      moments(l, s) {
        return L.moments(l as LineState, s).map((m) => (m.id === target ? { ...m, open: true } : m));
      },
    };
    const d = { ...deps(), levels: [twoStep] };
    const run = waitUntil(start(1, d), 'level', d);
    const m = current(run)!;
    const answered = step(run, { kind: 'answer', momentId: m.id, choiceId: choicesOf(run, m)[0]! }, d);
    const entry = answered.week.find((x) => x.id === m.id)!;
    expect(entry.status).toBe('open');
    expect(typeof entry.text).toBe('string');
    expect(current(answered)!.id).toBe(m.id);
  });

  // @spec LOOP-CMD-003
  it('resolves a situation through the engine and records its aftermath, or its expiry', () => {
    const run = waitUntil(start(), 'situation');
    const m = current(run)!;
    const answered = answerCurrent(run);
    expect(answered.week.find((x) => x.id === m.id)!.status).toBe('answered');
    expect(typeof answered.week.find((x) => x.id === m.id)!.text).toBe('string');
    expect(answered.engine).not.toEqual(run.engine);

    // a situation about someone who has since left expires
    const personalOnly = [CONTENT[2]!];
    const about = waitUntil(newRun(1, personalOnly, deps()), 'situation', deps(), personalOnly);
    const personal = about.presented[0]!;
    const gone = structuredClone(about);
    gone.sim.people[personal.bindings.engineer!]!.status = 'departed';
    const expired = step(gone, { kind: 'answer', momentId: personal.id, choiceId: 'talk' }, deps(), personalOnly);
    expect(expired.week.find((x) => x.id === personal.id)!.status).toBe('expired');
  });

  // @spec LOOP-CMD-004
  it('refuses answers the level or the situation engine rejects', () => {
    const lvl = waitUntil(start(), 'level');
    expectRefused(lvl, { kind: 'answer', momentId: current(lvl)!.id, choiceId: 'no-such-choice' });
    const sit = waitUntil(start(), 'situation');
    expectRefused(sit, { kind: 'answer', momentId: current(sit)!.id, choiceId: 'no-such-choice' });
  });

  // @spec LOOP-CMD-006
  it('refuses answering or waiting on anything but the current moment', () => {
    const run = start();
    const later = run.week[1]!;
    expectRefused(run, { kind: 'answer', momentId: later.id, choiceId: choicesOf(run, later)[0]! });
    expectRefused(run, { kind: 'answer', momentId: 'no-such-moment', choiceId: 'self' });
    let done = run;
    while (current(done)) done = step(done, { kind: 'wait' });
    expectRefused(done, { kind: 'wait' });
    expectRefused(done, { kind: 'answer', momentId: run.week[0]!.id, choiceId: choicesOf(run, run.week[0]!)[0]! });
  });

  // @spec LOOP-CMD-007, LOOP-WEEK-009
  it('lets the current moment wait without telling the level or the engine', () => {
    const run = start();
    const [first, second] = run.week as [Run['week'][number], Run['week'][number]];
    expect(current(run)).toEqual(first);
    const waited = step(run, { kind: 'wait' });
    expect(waited.week[0]!.status).toBe('waited');
    expect({ level: waited.level, sim: waited.sim, engine: waited.engine }).toEqual({ level: run.level, sim: run.sim, engine: run.engine });
    expect(current(waited)!.id).toBe(second.id);
  });

  // @spec LOOP-CMD-008
  it('expires a later level moment the level no longer reports open after an answer', () => {
    // a level that reports one later moment closed, as if the current answer had made it impossible
    const closed = new Set<string>();
    const closing: AnyLevel = { ...L, moments: (l: LineState, s) => L.moments(l, s).map((m) => (closed.has(m.id) ? { ...m, open: false } : m)) };
    const d = { ...deps(), levels: [closing] };
    const run = waitUntil(newRun(5, CONTENT, d), 'level', d);
    const target = run.week.find((x) => x.source === 'level' && x.status === 'open' && x.id !== current(run)!.id)!;
    closed.add(target.id);
    const answered = answerCurrent(run, 0, d);
    expect(answered.week.find((x) => x.id === target.id)!.status).toBe('expired');
    expect(answered.week.filter((x) => x.source === 'situation').map((x) => x.status)).toEqual(run.week.filter((x) => x.source === 'situation').map((x) => x.status));
  });

  // @spec LOOP-CMD-005
  it('ends a week with moments still open, marking them waited; situations close as ignored', () => {
    const run = start();
    const next = step(run, { kind: 'endWeek' });
    expect(next.lastWeek!.moments.every((m) => m.status === 'waited')).toBe(true);
    expect(debriefsSince(next.engine, 0).map((r) => r.status)).toEqual(run.presented.map(() => 'ignored'));
  });
});

describe('a week', () => {
  // @spec LOOP-WEEK-001
  it('refuses to end a week the level rejects', () => {
    const failing: AnyLevel = { ...L, endWeek: () => ({ ok: false, error: 'no' }) };
    const d = { ...deps(), levels: [failing] };
    expectRefused(newRun(1, CONTENT, d), { kind: 'endWeek' }, d);
  });

  // @spec LOOP-WEEK-002, LOOP-WEEK-005
  it('ends the week, advances, runs after-advance with the advance’s log, then begins the next week', () => {
    const run = start(2);
    const next = step(run, { kind: 'endWeek' });
    const ended = L.endWeek(level(run), run.sim);
    if (!ended.ok) throw new Error(ended.error);
    const advancedWith = advance(ended.sim, L.params.weeksPerStep);
    const advanced = advancedWith.state;
    const after = L.afterAdvance(ended.level, advanced, advancedWith.log);
    const begun = L.beginWeek(after.level, advanced);
    // The after-advance step is given the advance's change log.
    let given: unknown = null;
    const watching = { ...deps(), levels: [{ ...L, afterAdvance: (l: never, sim: SimState, log: ChangeLogEntry[]) => ((given = log), L.afterAdvance(l, sim, log)) }] };
    step(newRun(2, CONTENT, watching), { kind: 'endWeek' }, watching);
    expect(given).toEqual(advancedWith.log);
    expect(next.sim.week).toBe(1);
    expect(next.sim).toEqual(advanced);
    expect(next.level).toEqual(begun);
    const selected = selectSituations(run.engine, advanced, CONTENT, 'line-manager', L.params.situationLimit, { weeksToReview: L.params.reviewEveryWeeks - 1 });
    expect(next.engine).toEqual(selected.engine);
    expect(next.presented).toEqual(selected.presented);
    const ids = [...L.moments(begun, advanced).map((m) => m.id), ...selected.presented.map((p) => p.id)];
    expect(next.week.map((m) => m.id).sort()).toEqual(ids.sort());
  });

  // @spec LOOP-WEEK-005
  it('tells the situation engine how many moments the level has open, so a quiet-week situation comes only to an empty week', () => {
    const content: Situation[] = [plain('quiet', { quietWeek: true })];
    const withMoments = (moments: { id: string; open: boolean }[]): AnyLevel => ({
      ...L,
      moments: () => moments.map((m) => ({ ...m, day: 0, time: 'morning' as const })),
    });
    const empty = newRun(1, content, { ...deps(), levels: [withMoments([])] });
    expect(empty.presented.map((p) => p.situationId)).toEqual(['quiet']);
    const busy = newRun(1, content, { ...deps(), levels: [withMoments([{ id: 'lm', open: true }])] });
    expect(busy.presented).toEqual([]);
    // Only open moments count: a level whose one moment is already closed leaves the week empty.
    const closed = newRun(1, content, { ...deps(), levels: [withMoments([{ id: 'lm', open: false }])] });
    expect(closed.presented.map((p) => p.situationId)).toEqual(['quiet']);
  });

  // @spec LOOP-WEEK-008
  it('orders the week by day and time, the level’s moments first within a slot', () => {
    const fixed: AnyLevel = {
      ...L,
      params: { ...L.params, situationLimit: 2 },
      moments: () => [
        { id: 'lm-b', day: 0, time: 'night', open: true },
        { id: 'lm-a', day: 0, time: 'morning', open: true },
        { id: 'lm-c', day: 2, time: 'morning', open: true },
      ],
    };
    const content: Situation[] = [plain('s-tue', { day: 'tuesday', time: 'morning' } as never), plain('s-mon-night', { day: 'monday', time: 'night' } as never)];
    const run = newRun(1, content, { ...deps(), levels: [fixed] });
    const night = run.presented.find((p) => p.situationId === 's-mon-night')!.id;
    const tue = run.presented.find((p) => p.situationId === 's-tue')!.id;
    expect(run.week.map((m) => m.id)).toEqual(['lm-a', 'lm-b', night, tue, 'lm-c']);

    // and a real week is sorted the same way
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = start(seed).week;
      const key = (m: (typeof w)[number]) => m.day * 10 + TIME_RANK[m.time] * 2 + (m.source === 'level' ? 0 : 1);
      expect(w.map(key)).toEqual(w.map(key).sort((a, b) => a - b));
    }
  });

  // @spec LOOP-WEEK-008
  it('puts urgent situations ahead of the level’s moments within a slot, and other situations after', () => {
    const fixed: AnyLevel = {
      ...L,
      params: { ...L.params, situationLimit: 2 },
      moments: () => [{ id: 'lm-a', day: 0, time: 'morning', open: true }],
    };
    const content: Situation[] = [
      plain('s-normal', { day: 'monday', time: 'morning', priority: 'normal' } as never),
      plain('s-urgent', { day: 'monday', time: 'morning', priority: 'urgent' } as never),
    ];
    const run = newRun(1, content, { ...deps(), levels: [fixed] });
    const id = (situationId: string) => run.presented.find((p) => p.situationId === situationId)!.id;
    expect(run.week.map((m) => m.id)).toEqual([id('s-urgent'), 'lm-a', id('s-normal')]);
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
  it('conducts a review every 13 weeks with the level assessment and the quarter’s debriefs', () => {
    const { review, calls } = stubReview();
    const d = deps(review);
    let run = endWeeks(start(1, d), 12, d);
    expect(run.phase).toBe('week');
    const beforeReview = run;
    run = step(run, { kind: 'endWeek' }, d);
    expect(run.phase).toBe('review');
    expect(run.sim.week).toBe(13);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.levelId).toBe('line-manager');
    const ended = L.endWeek(level(beforeReview), beforeReview.sim);
    if (!ended.ok) throw new Error(ended.error);
    const advanced = advance(ended.sim, 1);
    expect(calls[0]!.assessment).toEqual(L.assess(L.afterAdvance(ended.level, advanced.state, advanced.log).level, advanced.state));
    // every situation presented since week 0: the closed ones as recorded, the last week's still-open ones as ignored
    const closed = debriefsSince(beforeReview.engine, 0);
    const stillOpen = beforeReview.presented.map((p) => ({ week: 12, situationId: p.situationId, bindings: p.bindings, status: 'ignored' }));
    expect(calls[0]!.debriefs).toEqual([...closed, ...stillOpen]);
    expect(run.sim.player.reputation).toBe(77);
    expect(run.review).toEqual({ rating: 'meets', outcome: 'continue', standing: { promotion: { kind: 'twoInARow', reviewsLeft: 3 } }, score: 0, measures: calls[0]!.assessment.measures.map((m) => ({ ...m, verdict: 'at' })), debriefs: calls[0]!.debriefs });
  });

  // @spec LOOP-WEEK-004
  it('takes the debriefs since the player’s previous rating at later reviews', () => {
    // the real review, since only a review that rates the player leaves a previous rating to count from
    const calls: Parameters<typeof conductReview>[0][] = [];
    const review: typeof conductReview = (input) => {
      calls.push(structuredClone(input));
      return { ...conductReview(input), outcome: 'continue' };
    };
    const d = deps(review);
    let run = step(endWeeks(start(1, d), 13, d), { kind: 'acknowledge' }, d);
    run = endWeeks(run, 13, d);
    expect(run.sim.week).toBe(26);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.debriefs.every((r) => r.week >= 13)).toBe(true);
    expect(calls[1]!.debriefs.some((r) => r.week === 13)).toBe(true);
  });

  // @spec LOOP-WEEK-004
  it('runs with the real performance review', () => {
    const d = { levels: [L], review: conductReview };
    const run = endWeeks(newRun(1, CONTENT, d), 13, d);
    expect(run.phase).toBe('review');
    expect(run.sim.player.ratingHistory).toHaveLength(1);
    expect(run.review!.measures.map((m) => m.id)).toContain('reputation');
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
    expect(run.presented.map((p) => p.situationId)).toEqual(['in-16']);
    const weeks: number[] = [];
    while (run.phase === 'week') {
      run = step(run, { kind: 'endWeek' }, d, content);
      weeks.push(run.sim.week);
    }
    expect(weeks).toEqual([4, 8, 12, 16]);
    expect(calls).toHaveLength(1);
    run = step(run, { kind: 'acknowledge' }, d, content);
    // week 16: the next review is after the step that reaches week 26, which ends at week 28
    expect(run.presented.map((p) => p.situationId)).toEqual(['in-12']);
    run = endWeeks(run, 5, d);
    expect(run.sim.week).toBe(28);
    expect(run.phase).toBe('review');
    expect(calls).toHaveLength(2);
  });

  // @spec LOOP-WEEK-006
  it('keeps the level’s recap and every moment’s outcome as last week', () => {
    let run = answerCurrent(start());
    run = step(run, { kind: 'wait' });
    const week = run.week.map((m) => ({ ...m, status: m.status === 'open' ? 'waited' : m.status }));
    const ended = L.endWeek(level(run), run.sim);
    if (!ended.ok) throw new Error(ended.error);
    run = step(run, { kind: 'endWeek' });
    expect(run.lastWeek).toEqual({ recap: ended.recap, moments: week });
    expect(run.lastWeek!.moments[0]!.status).toBe('answered');
    expect(run.lastWeek!.moments[1]!.status).toBe('waited');
  });

  // @spec LOOP-WEEK-007
  it('tells the situation engine how many weeks remain until the review', () => {
    const timed = (weeks: number) => ({ ...CONTENT[0]!, id: `review-in-${weeks}`, when: { value: 'review.weeksAway', is: weeks } }) as (typeof CONTENT)[number];
    const content = [timed(13), timed(1)];
    const atStart = newRun(1, content, deps());
    expect(atStart.presented.map((p) => p.situationId)).toEqual(['review-in-13']);
    let run = atStart;
    for (let i = 0; i < 12; i++) run = step(run, { kind: 'endWeek' }, deps(), content);
    expect(run.sim.week).toBe(12);
    expect(run.presented.map((p) => p.situationId)).toEqual(['review-in-1']);
  });
});

describe('reviews', () => {
  // @spec LOOP-REV-001
  it('begins the next week when a review says continue', () => {
    const run = step(endWeeks(start(), 13), { kind: 'acknowledge' });
    expect(run.phase).toBe('week');
    expect(run.review).toBeNull();
    expect(run.sim.week).toBe(13);
    expect(run.week.length).toBeGreaterThan(0);
  });

  // @spec LOOP-REV-006
  it('keeps the acknowledged review’s standing toward promotion on the run', () => {
    const first = start();
    expect(first.towardPromotion).toBeNull();
    const reviewed = endWeeks(first, 13);
    const run = step(reviewed, { kind: 'acknowledge' });
    expect(run.towardPromotion).toEqual(reviewed.review!.standing.promotion);
    expect(replay(1, CONTENT, deps(), run.commands)).toEqual(run);
  });

  // @spec LOOP-REV-002
  it('ends the run when the player is managed out', () => {
    const d = deps(stubReview('managedOut').review);
    const run = step(endWeeks(start(1, d), 13, d), { kind: 'acknowledge' }, d);
    expect(run).toMatchObject({ phase: 'ended', ending: 'managedOut' });
  });

  // @spec LOOP-REV-004
  it('ends the run as stayed after the level’s last review', () => {
    const d = deps(stubReview('stayed').review);
    const run = step(endWeeks(start(1, d), 13, d), { kind: 'acknowledge' }, d);
    expect(run).toMatchObject({ phase: 'ended', ending: 'stayed' });
  });

  // @spec LOOP-REV-003
  it('ends the run as completed on promotion past the highest level', () => {
    const d = deps(stubReview('promote').review);
    const run = step(endWeeks(start(1, d), 13, d), { kind: 'acknowledge' }, d);
    expect(run).toMatchObject({ phase: 'ended', ending: 'completed' });
  });
});
