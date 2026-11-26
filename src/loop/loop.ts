import { advance } from '../sim';
import { createEngine, debriefsSince, resolveChoice, selectSituations, type DebriefRecord, type Situation, type Timing } from '../situations';
import type { AnyLevel, ApplyResult, Command, Dependencies, Run, WeekMoment } from './types';

/** Weeks until the next review is held: to the end of the first whole step that reaches the next review week. */
// @spec LOOP-WEEK-007
function timingOf(run: Run, level: AnyLevel): Timing {
  const { weeksPerStep: step, reviewEveryWeeks: cadence } = level.params;
  // Reviews count from the week the active level began.
  const since = run.sim.week - run.levelStartWeek;
  const nextReview = (Math.floor(since / cadence) + 1) * cadence;
  return { weeksToReview: Math.ceil((nextReview - since) / step) * step };
}

/** Weeks until the run's next review is held, for display. */
export function weeksToReview(run: Run, deps: Dependencies): number | undefined {
  const level = deps.levels.find((l) => l.params.id === run.levelId);
  return level ? timingOf(run, level).weeksToReview : undefined;
}

/** Whether an advance from one week to another reached or passed a review week. */
const crossedReview = (from: number, to: number, cadence: number) => Math.floor(to / cadence) > Math.floor(from / cadence);

const TIME_ORDER = { morning: 0, afternoon: 1, night: 2 } as const;

/** Begins the run's next week: the level makes its moments, situations are presented, and both are ordered into one sequence. */
// @spec LOOP-WEEK-005, LOOP-WEEK-008, LOOP-WEEK-010
function beginWeek(run: Run, level: AnyLevel, content: Situation[]) {
  run.level = level.beginWeek(run.level, run.sim);
  const levelMoments = level.moments(run.level, run.sim).filter((m) => m.open);
  const { engine, presented } = selectSituations(run.engine, run.sim, content, level.params.id, level.params.situationLimit, timingOf(run, level), levelMoments.length);
  run.engine = engine;
  run.presented = presented;
  // A situation's day of the week is spread over a longer turn: day d becomes day d × the weeks per step (LOOP-WEEK-010).
  const situation = (p: (typeof presented)[number]): WeekMoment => ({ source: 'situation', id: p.id, day: p.day * level.params.weeksPerStep, time: p.time, title: content.find((x) => x.id === p.situationId)?.title ?? p.situationId, status: 'open' });
  const urgent = (p: (typeof presented)[number]) => content.find((x) => x.id === p.situationId)?.priority === 'urgent';
  const moments: WeekMoment[] = [
    ...presented.filter(urgent).map(situation),
    ...levelMoments.map((m): WeekMoment => ({ source: 'level', id: m.id, day: m.day, time: m.time, title: m.title ?? '', status: 'open' })),
    ...presented.filter((p) => !urgent(p)).map(situation),
  ];
  // The sort is stable, so within a slot urgent situations lead, then the level's moments, then the other situations, each in its own order.
  run.week = moments.sort((a, b) => a.day - b.day || TIME_ORDER[a.time] - TIME_ORDER[b.time]);
  run.phase = 'week';
}

/** The week's current moment: the first still open. */
// @spec LOOP-WEEK-009
const currentMoment = (run: Run) => run.week.find((m) => m.status === 'open');

/** Starts a run at the lowest level given, in week 0's planning phase. */
// @spec LOOP-RUN-001, LOOP-RUN-002
export function newRun(seed: number, content: Situation[], deps: Dependencies): Run {
  const level = deps.levels[0];
  if (!level) throw new Error('a run needs at least one career level');
  const { sim, level: levelState } = level.start(seed);
  const run: Run = {
    seed,
    levelId: level.params.id,
    levelStartWeek: 0,
    earlierLevels: [],
    sim,
    engine: createEngine(seed),
    level: levelState,
    phase: 'week',
    handoverChoices: null,
    week: [],
    presented: [],
    lastWeek: null,
    review: null,
    towardPromotion: null,
    ending: null,
    commands: [],
  };
  beginWeek(run, level, content);
  return run;
}

type Outcome = { ok: true } | { ok: false; error: string };

/** Ends the week: open moments wait, the level ends the week, then advance, after-advance, and a review or the next week. */
// @spec LOOP-WEEK-001, LOOP-WEEK-002, LOOP-WEEK-003, LOOP-WEEK-004, LOOP-WEEK-006, LOOP-CMD-005
function endWeek(run: Run, level: AnyLevel, content: Situation[], deps: Dependencies): Outcome {
  for (const m of run.week) if (m.status === 'open') m.status = 'waited';
  const committed = level.endWeek(run.level, run.sim);
  if (!committed.ok) return committed;
  run.lastWeek = { recap: committed.recap, moments: structuredClone(run.week) };
  const fromWeek = committed.sim.week;
  const advanced = advance(committed.sim, level.params.weeksPerStep);
  run.sim = advanced.state;
  const after = level.afterAdvance(committed.level, run.sim, advanced.log);
  run.level = after.level;
  if (after.burnedOut) {
    run.phase = 'ended';
    run.ending = 'burnout';
    return { ok: true };
  }
  if (crossedReview(fromWeek - run.levelStartWeek, run.sim.week - run.levelStartWeek, level.params.reviewEveryWeeks)) {
    const { sim, ...result } = deps.review({ levelId: level.params.id, sim: run.sim, assessment: level.assess(run.level, run.sim), debriefs: quarterDebriefs(run) });
    run.sim = sim;
    run.review = result;
    run.phase = 'review';
    return { ok: true };
  }
  beginWeek(run, level, content);
  return { ok: true };
}

/**
 * The situations since the player's previous rating: the engine's records, then a record marked ignored for each of
 * the last week's situations still open, which the engine closes only at its next selection, after the review.
 */
function quarterDebriefs(run: Run): DebriefRecord[] {
  const since = run.sim.player.ratingHistory.at(-1)?.week ?? 0;
  const lastWeek = run.sim.week - 1;
  const unanswered = new Set(run.week.filter((m) => m.source === 'situation' && (m.status === 'open' || m.status === 'waited')).map((m) => m.id));
  const open = run.presented
    .filter((p) => unanswered.has(p.id))
    .map((p): DebriefRecord => ({ week: lastWeek, situationId: p.situationId, bindings: { ...p.bindings }, status: 'ignored' }));
  return [...debriefsSince(run.engine, since), ...open];
}

/** Applies a review's outcome. */
// @spec LOOP-REV-001, LOOP-REV-002, LOOP-REV-003, LOOP-REV-004, LOOP-REV-005, LOOP-REV-006
function acknowledge(run: Run, level: AnyLevel, content: Situation[], deps: Dependencies): Outcome {
  const outcome = run.review!.outcome;
  run.towardPromotion = run.review!.standing.promotion;
  run.review = null;
  if (outcome === 'managedOut' || outcome === 'stayed') {
    run.phase = 'ended';
    run.ending = outcome;
  } else if (outcome === 'promote' && deps.levels.indexOf(level) === deps.levels.length - 1) {
    run.phase = 'ended';
    run.ending = 'completed';
  } else if (outcome === 'promote') {
    // Below the top: the next level offers its handover choices, and the hand over command takes the run on.
    const next = deps.levels[deps.levels.indexOf(level) + 1]!;
    if (!next.handoverChoices || !next.takeOver) return { ok: false, error: `level ${next.params.id} cannot take a run over` };
    run.phase = 'handover';
    run.handoverChoices = next.handoverChoices(run.level, run.sim);
  } else {
    beginWeek(run, level, content);
  }
  return { ok: true };
}

/** Hands the run to the next level: it takes the run over with the player's choice and begins its first turn. */
// @spec LOOP-HAND-001, LOOP-HAND-002, LOOP-HAND-004, LOOP-REV-006
function handOver(run: Run, level: AnyLevel, content: Situation[], deps: Dependencies, choice: unknown): Outcome {
  const next = deps.levels[deps.levels.indexOf(level) + 1];
  if (!next?.takeOver) return { ok: false, error: 'there is no level to hand the run over to' };
  if (typeof choice !== 'string') return { ok: false, error: 'a handover names a choice' };
  const taken = next.takeOver(run.level, run.sim, choice);
  if (!taken.ok) return taken;
  run.earlierLevels = [...run.earlierLevels, { levelId: run.levelId, level: run.level, sim: run.sim, endWeek: run.sim.week }];
  run.levelId = next.params.id;
  run.levelStartWeek = run.sim.week;
  run.sim = taken.sim;
  run.level = taken.level;
  run.handoverChoices = null;
  // A new level's promotion starts over.
  run.towardPromotion = null;
  beginWeek(run, next, content);
  return { ok: true };
}

type Current = NonNullable<ReturnType<typeof currentMoment>>;

/** A level moment is answered by the level; one the level still reports open has a further step (calibration over the curve) and stays current. */
function answerLevel(run: Run, level: AnyLevel, m: Current, choiceId: string): Outcome {
  const chosen = level.choose(run.level, run.sim, m.id, choiceId);
  if (!chosen.ok) return chosen;
  run.level = chosen.level;
  run.sim = chosen.sim;
  const further = level.moments(run.level, run.sim).some((x) => x.id === m.id && x.open);
  m.status = further ? 'open' : 'answered';
  m.text = chosen.reaction;
  return { ok: true };
}

/** A situation is answered by the situation engine, which may find it no longer applies and expire it. */
function answerSituation(run: Run, level: AnyLevel, content: Situation[], m: Current, choiceId: string): Outcome {
  const result = resolveChoice(run.engine, run.sim, content, m.id, choiceId, timingOf(run, level));
  if (result.kind === 'error') return { ok: false, error: result.message };
  run.engine = result.engine;
  run.sim = result.sim;
  m.status = result.kind === 'resolved' ? 'answered' : 'expired';
  if (result.kind === 'resolved') m.text = result.aftermath;
  return { ok: true };
}

/** Answers the current moment through its owner, then expires level moments the answer left impossible to answer. */
function answer(run: Run, level: AnyLevel, content: Situation[], momentId: unknown, choiceId: unknown): Outcome {
  const m = currentMoment(run);
  if (!m) return { ok: false, error: 'no moment of the week is still open' };
  if (m.id !== momentId) return { ok: false, error: `${String(momentId)} is not the current moment; ${m.id} is` };
  if (typeof choiceId !== 'string') return { ok: false, error: 'an answer names a choice' };
  const answered = m.source === 'level' ? answerLevel(run, level, m, choiceId) : answerSituation(run, level, content, m, choiceId);
  if (!answered.ok) return answered;
  const stillOpen = new Set(level.moments(run.level, run.sim).filter((x) => x.open).map((x) => x.id));
  for (const x of run.week) if (x.source === 'level' && x.status === 'open' && !stillOpen.has(x.id)) x.status = 'expired';
  return { ok: true };
}

const ALLOWED: Record<Run['phase'], Command['kind'][]> = {
  week: ['plan', 'answer', 'wait', 'endWeek'],
  review: ['acknowledge'],
  // @spec LOOP-HAND-003
  handover: ['handover'],
  ended: [],
};

/** Applies one command to a run, returning the new run, or an error and the unchanged run. */
// @spec LOOP-RUN-003, LOOP-RUN-004, LOOP-CMD-001, LOOP-CMD-002, LOOP-CMD-003, LOOP-CMD-004
// @spec LOOP-CMD-006, LOOP-CMD-007, LOOP-CMD-008
export function apply(run: Run, command: Command, content: Situation[], deps: Dependencies): ApplyResult {
  // A run can come from a save, so an unknown phase or level is an error, never an exception.
  const allowed = Object.hasOwn(ALLOWED, run.phase) ? ALLOWED[run.phase] : undefined;
  if (!allowed) return { ok: false, error: `unknown run phase ${String(run.phase)}`, run };
  if (!allowed.includes(command?.kind)) return { ok: false, error: `${String(command?.kind)} is not allowed while the run is ${run.phase}`, run };
  const level = deps.levels.find((l) => l.params.id === run.levelId);
  if (!level) return { ok: false, error: `the run's level ${run.levelId} is not among the levels given`, run };
  // Every component returns new states and leaves its inputs unchanged, so the new run shares the simulation, engine and
  // level states with the old one and replaces them as commands apply. The loop changes only the week's moment entries in
  // place, so those are copied; copying the whole run on every command was most of a run's time.
  const { commands } = run;
  const next: Run = { ...run, week: run.week.map((m) => ({ ...m })) };
  let outcome: Outcome;
  switch (command.kind) {
    case 'plan': {
      const updated = level.plan(next.level, next.sim, command.command);
      if (updated.ok) next.level = updated.level;
      outcome = updated;
      break;
    }
    case 'answer':
      outcome = answer(next, level, content, command.momentId, command.choiceId);
      break;
    case 'wait': {
      const m = currentMoment(next);
      if (m) m.status = 'waited';
      outcome = m ? { ok: true } : { ok: false, error: 'no moment of the week is still open' };
      break;
    }
    case 'endWeek':
      outcome = endWeek(next, level, content, deps);
      break;
    case 'acknowledge':
      outcome = acknowledge(next, level, content, deps);
      break;
    case 'handover':
      outcome = handOver(next, level, content, deps, command.choice);
      break;
  }
  if (!outcome.ok) return { ok: false, error: outcome.error, run };
  next.commands = [...commands, structuredClone(command)];
  return { ok: true, run: next };
}

/** Rebuilds a run from its seed, content and commands. */
// @spec LOOP-RUN-005
export function replay(seed: number, content: Situation[], deps: Dependencies, commands: Command[]): Run {
  let run = newRun(seed, content, deps);
  for (const command of commands) {
    const result = apply(run, command, content, deps);
    if (!result.ok) throw new Error(`replay failed at command ${run.commands.length + 1} (${command.kind}): ${result.error}`);
    run = result.run;
  }
  return run;
}
