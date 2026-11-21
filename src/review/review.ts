import { RATINGS, applyEffects, planOf, type Rating } from '../sim';
import { REVIEW_TUNING } from './tuning';
import type { Measure, ReviewInput, ReviewResult, ScoredMeasure, Verdict } from './types';

const POINTS: Record<Verdict, number> = { above: 1, at: 0, below: -1 };

/** Whether a measure is below, at or above its target, counting the tolerance's edges as at target. */
// @spec REVIEW-MEASURE-001
export function verdictOf(m: Measure): Verdict {
  const gap = m.better === 'higher' ? m.value - m.target : m.target - m.value;
  return gap > m.tolerance ? 'above' : gap < -m.tolerance ? 'below' : 'at';
}

/** The highest rating whose threshold the score reaches. */
// @spec REVIEW-RATE-002
function ratingFor(score: number): Rating {
  const t = REVIEW_TUNING.thresholds;
  if (score >= t.outstanding) return 'outstanding';
  if (score >= t.exceeds) return 'exceeds';
  if (score >= t.meets) return 'meets';
  if (score >= t.partial) return 'partial';
  return 'below';
}

const exceedsOrBetter = (r: Rating) => RATINGS.indexOf(r) >= RATINGS.indexOf('exceeds');

/** Scores the quarter, rates the player and decides whether the run continues, the player is promoted, or managed out. */
// @spec REVIEW-MEASURE-002, REVIEW-RATE-001, REVIEW-RATE-003, REVIEW-RATE-004, REVIEW-OUT-001, REVIEW-OUT-002, REVIEW-OUT-003
// @spec REVIEW-OUT-004, REVIEW-RESULT-001, REVIEW-RESULT-002
export function conductReview(input: ReviewInput): ReviewResult {
  const { reputation } = REVIEW_TUNING;
  const measures: ScoredMeasure[] = [
    ...input.assessment.measures,
    { id: 'reputation', value: input.sim.player.reputation, target: reputation.target, tolerance: reputation.tolerance, better: 'higher' as const },
  ].map((m) => ({ ...m, verdict: verdictOf(m) }));
  const score = measures.reduce((sum, m) => sum + POINTS[m.verdict], 0) / measures.length;
  const scored = ratingFor(score);
  const { ceiling } = input.assessment;
  const capped = ceiling !== undefined && RATINGS.indexOf(scored) > RATINGS.indexOf(ceiling.rating);
  const rating = capped ? ceiling.rating : scored;

  const previous = input.sim.player.ratingHistory.at(-1)?.rating;
  const rated = applyEffects(input.sim, [{ type: 'rate', target: { kind: 'player' }, rating, cause: { kind: 'rule', ruleId: 'review.quarterly' } }]);
  if (!rated.ok) throw new Error(`the simulation rejected the review's rating: ${rated.error.message}`);

  const outcome =
    planOf(rated.state, { kind: 'player' }) === 'failedPip'
      ? 'managedOut'
      : input.assessment.promotionPossible && previous !== undefined && exceedsOrBetter(previous) && exceedsOrBetter(rating)
        ? 'promote'
        : input.assessment.lastReview
          ? 'stayed'
          : 'continue';
  return { sim: rated.state, rating, outcome, score, measures, ...(capped ? { ceilingReason: ceiling.reason } : {}), debriefs: structuredClone(input.debriefs) };
}
