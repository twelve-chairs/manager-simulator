import { advance } from '../sim';
import { createEngine, debriefsSince, resolveChoice, selectSituations, type DebriefRecord, type Situation, type Timing } from '../situations';
import type { AnyLevel, ApplyResult, Command, Dependencies, Run } from './types';

/** Weeks until the next review is held: to the end of the first whole step that reaches the next review week. */
// @spec LOOP-WEEK-007
function timingOf(run: Run, level: AnyLevel): Timing {
  const { weeksPerStep: step, reviewEveryWeeks: cadence } = level.params;
  const nextReviewWeek = (Math.floor(run.sim.week / cadence) + 1) * cadence;
  return { weeksToReview: Math.ceil((nextReviewWeek - run.sim.week) / step) * step };
}

/** Whether an advance from one week to another reached or passed a review week. */
const crossedReview = (from: number, to: number, cadence: number) => Math.floor(to / cadence) > Math.floor(from / cadence);

/** Begins the run's next week: the level prepares it, the plan empties, and situations are presented. */
// @spec LOOP-WEEK-005
function beginWeek(run: Run, level: AnyLevel, content: Situation[]) {
  run.level = level.beginWeek(run.level, run.sim);
  run.plan = level.emptyPlan();
  const { engine, presented } = selectSituations(run.engine, run.sim, content, level.params.id, level.params.situationLimit, timingOf(run, level));
  run.engine = engine;
  run.presented = presented.map((presentation) => ({ presentation, status: 'open' }));
  run.phase = 'planning';
}

/** Starts a run at the lowest level given, in week 0's planning phase. */
// @spec LOOP-RUN-001, LOOP-RUN-002
export function newRun(seed: number, content: Situation[], deps: Dependencies): Run {
  const level = deps.levels[0];
  if (!level) throw new Error('a run needs at least one career level');
  const { sim, level: levelState } = level.start(seed);
  const run: Run = {
    seed,
    levelId: level.params.id,
    sim,
    engine: createEngine(seed),
    level: levelState,
    plan: null, // set when the week begins
    phase: 'planning',
    presented: [],
    lastWeek: null,
    review: null,
    ending: null,
    commands: [],
  };
  beginWeek(run, level, content);
  return run;
}

type Outcome = { ok: true } | { ok: false; error: string };

/** Ends the week: commit, advance, after-advance, then a review or the next week. */
// @spec LOOP-WEEK-001, LOOP-WEEK-002, LOOP-WEEK-003, LOOP-WEEK-004, LOOP-WEEK-006, LOOP-CMD-005
function endWeek(run: Run, level: AnyLevel, content: Situation[], deps: Dependencies): Outcome {
  const committed = level.commit(run.level, run.sim, run.plan);
  if (!committed.ok) return committed;
  run.lastWeek = {
    report: committed.report,
    aftermaths: run.presented.flatMap((p) => (p.status === 'answered' && p.aftermath !== undefined ? [p.aftermath] : [])),
  };
  const fromWeek = committed.sim.week;
  run.sim = advance(committed.sim, level.params.weeksPerStep).state;
  const after = level.afterAdvance(committed.level, run.sim);
  run.level = after.level;
  if (after.burnedOut) {
    run.phase = 'ended';
    run.ending = 'burnout';
    return { ok: true };
  }
  if (crossedReview(fromWeek, run.sim.week, level.params.reviewEveryWeeks)) {
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
  const open = run.presented
    .filter((p) => p.status === 'open')
    .map((p): DebriefRecord => ({ week: lastWeek, situationId: p.presentation.situationId, bindings: { ...p.presentation.bindings }, status: 'ignored' }));
  return [...debriefsSince(run.engine, since), ...open];
}

/** Applies a review's outcome. */
// @spec LOOP-REV-001, LOOP-REV-002, LOOP-REV-003
function acknowledge(run: Run, level: AnyLevel, content: Situation[], deps: Dependencies): Outcome {
  const outcome = run.review!.outcome;
  run.review = null;
  if (outcome === 'managedOut') {
    run.phase = 'ended';
    run.ending = 'managedOut';
  } else if (outcome === 'promote' && deps.levels.indexOf(level) === deps.levels.length - 1) {
    run.phase = 'ended';
    run.ending = 'completed';
  } else if (outcome === 'promote') {
    return { ok: false, error: 'promotion to a higher career level is not designed yet' };
  } else {
    beginWeek(run, level, content);
  }
  return { ok: true };
}

const ALLOWED: Record<Run['phase'], Command['kind'][]> = {
  planning: ['plan', 'answer', 'endWeek'],
  review: ['acknowledge'],
  ended: [],
};

/** Applies one command to a run, returning the new run, or an error and the unchanged run. */
// @spec LOOP-RUN-003, LOOP-RUN-004, LOOP-CMD-001, LOOP-CMD-002, LOOP-CMD-003, LOOP-CMD-004
export function apply(run: Run, command: Command, content: Situation[], deps: Dependencies): ApplyResult {
  // A run can come from a save, so an unknown phase or level is an error, never an exception.
  const allowed = Object.hasOwn(ALLOWED, run.phase) ? ALLOWED[run.phase] : undefined;
  if (!allowed) return { ok: false, error: `unknown run phase ${String(run.phase)}`, run };
  if (!allowed.includes(command?.kind)) return { ok: false, error: `${String(command?.kind)} is not allowed while the run is ${run.phase}`, run };
  const level = deps.levels.find((l) => l.params.id === run.levelId);
  if (!level) return { ok: false, error: `the run's level ${run.levelId} is not among the levels given`, run };
  // Clone everything but the command history, which only ever grows and is never changed in place.
  const { commands, ...rest } = run;
  const next: Run = { ...structuredClone(rest), commands };
  let outcome: Outcome;
  switch (command.kind) {
    case 'plan': {
      const updated = level.updatePlan(next.level, next.sim, next.plan, command.command);
      if (updated.ok) {
        next.level = updated.level;
        next.plan = updated.plan;
      }
      outcome = updated;
      break;
    }
    case 'answer': {
      const result = resolveChoice(next.engine, next.sim, content, command.presentationId, command.choiceId, timingOf(next, level));
      if (result.kind === 'error') {
        outcome = { ok: false, error: result.message };
        break;
      }
      next.engine = result.engine;
      next.sim = result.sim;
      const record = next.presented.find((p) => p.presentation.id === command.presentationId);
      if (record) {
        record.status = result.kind === 'resolved' ? 'answered' : 'expired';
        if (result.kind === 'resolved') record.aftermath = result.aftermath;
      }
      outcome = { ok: true };
      break;
    }
    case 'endWeek':
      outcome = endWeek(next, level, content, deps);
      break;
    case 'acknowledge':
      outcome = acknowledge(next, level, content, deps);
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
