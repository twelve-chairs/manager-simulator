import { lineManagerLevel, type LineState } from '../../src/levels/line-manager';
import { apply, type Command, type Dependencies, type Review, type ReviewOutcome, type Run, type WeekMoment } from '../../src/loop';
import type { Situation } from '../../src/situations';
import { plain, sit } from '../situations/fixtures';

/** Line manager situations: two with no roles and one about any engineer. */
export const CONTENT: Situation[] = [
  plain('org-wide'),
  plain('org-wide-2', { weight: 2 }),
  sit({ id: 'about-someone', roles: [{ name: 'engineer', kind: 'person' }] }),
];

/** A stand-in performance review that records its calls and returns a fixed outcome. */
export function stubReview(outcome: ReviewOutcome = 'continue') {
  const calls: Parameters<Review>[0][] = [];
  const review: Review = (input) => {
    calls.push(structuredClone(input));
    return {
      sim: { ...input.sim, player: { ...input.sim.player, reputation: 77 } },
      rating: 'meets',
      outcome,
      score: 0,
      measures: input.assessment.measures.map((m) => ({ ...m, verdict: 'at' as const })),
      debriefs: input.debriefs,
    };
  };
  return { review, calls };
}

export const deps = (review: Review = stubReview().review): Dependencies => ({ levels: [lineManagerLevel], review });

export function step(run: Run, command: Command, d: Dependencies = deps(), content = CONTENT): Run {
  const result = apply(run, command, content, d);
  if (!result.ok) throw new Error(`expected ${command.kind} to apply, got: ${result.error}`);
  return result.run;
}

/** Ends `n` weeks without answering anything, stopping early if the run leaves the week phase. */
export function endWeeks(run: Run, n: number, d: Dependencies = deps()): Run {
  let r = run;
  for (let i = 0; i < n && r.phase === 'week'; i++) r = step(r, { kind: 'endWeek' }, d);
  return r;
}

/** The week's current moment: the first still open. */
export const current = (run: Run): WeekMoment | undefined => run.week.find((m) => m.status === 'open');

/** The ids of the choices a moment of the week offers. */
export function choicesOf(run: Run, moment: WeekMoment): string[] {
  if (moment.source === 'situation') return run.presented.find((p) => p.id === moment.id)!.choices.map((c) => c.id);
  return (run.level as LineState).moments.find((m) => m.id === moment.id)!.choices.map((c) => c.id);
}

/** Answers the current moment with its first choice (or the one at `index`). */
export function answerCurrent(run: Run, index = 0, d: Dependencies = deps(), content = CONTENT): Run {
  const m = current(run);
  if (!m) throw new Error('no open moment');
  const choices = choicesOf(run, m);
  return step(run, { kind: 'answer', momentId: m.id, choiceId: choices[index % choices.length]! }, d, content);
}

/** Lets moments wait until the first open one is from `source`. */
export function waitUntil(run: Run, source: WeekMoment['source'], d: Dependencies = deps(), content = CONTENT): Run {
  let r = run;
  while (current(r) && current(r)!.source !== source) r = step(r, { kind: 'wait' }, d, content);
  if (!current(r)) throw new Error(`no open ${source} moment this week`);
  return r;
}
