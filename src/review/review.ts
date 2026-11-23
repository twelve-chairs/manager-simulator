import { RATINGS, applyEffects, planOf, type Rating } from '../sim';
import { REVIEW_TUNING } from './tuning';
import type { Assessment, Measure, ReviewInput, ReviewOutcome, ReviewResult, ScoredMeasure, Standing, TowardPromotion, Verdict } from './types';

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
const rank = (r: Rating) => RATINGS.indexOf(r);

/** How near the rating came to the ones either side: one measure a verdict better, or worse. */
// @spec REVIEW-STAND-001
function margins(measures: ScoredMeasure[], rating: Rating, ceiling: Rating | undefined, capped: boolean): Pick<Standing, 'marginUp' | 'marginDown'> {
  const sum = measures.reduce((s, m) => s + POINTS[m.verdict], 0);
  const n = measures.length;
  const cap = (r: Rating) => (ceiling !== undefined && rank(r) > rank(ceiling) ? ceiling : r);
  const up = !capped && measures.some((m) => m.verdict !== 'above') ? ratingFor((sum + 1) / n) : rating;
  const down = measures.some((m) => m.verdict !== 'below') ? cap(ratingFor((sum - 1) / n)) : rating;
  return { ...(rank(up) > rank(rating) && { marginUp: up }), ...(rank(down) < rank(rating) && { marginDown: down }) };
}

/** What the next reviews can do toward promotion. */
// @spec REVIEW-STAND-002
function towardPromotion(outcome: ReviewOutcome, rating: Rating, a: Assessment): TowardPromotion {
  if (outcome === 'promote') return { kind: 'promoted' };
  if (outcome === 'managedOut' || outcome === 'stayed') return { kind: 'ended' };
  if (a.reviewsUntilPromotion > 1) return { kind: 'notOpenYet', reviews: a.reviewsUntilPromotion };
  if (!exceedsOrBetter(rating) && a.reviewsLeft < 2) return { kind: 'outOfTime' };
  return { kind: exceedsOrBetter(rating) ? 'oneMore' : 'twoInARow' };
}

/** Scores the quarter, rates the player and decides whether the run continues, the player is promoted, or managed out. */
// @spec REVIEW-MEASURE-002, REVIEW-RATE-001, REVIEW-RATE-003, REVIEW-RATE-004, REVIEW-OUT-001, REVIEW-OUT-002, REVIEW-OUT-003
// @spec REVIEW-OUT-004, REVIEW-RESULT-001, REVIEW-RESULT-002, REVIEW-STAND-003
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

  const plan = planOf(rated.state, { kind: 'player' });
  const outcome: ReviewOutcome =
    plan === 'failedPip'
      ? 'managedOut'
      : input.assessment.promotionPossible && previous !== undefined && exceedsOrBetter(previous) && exceedsOrBetter(rating)
        ? 'promote'
        : input.assessment.lastReview
          ? 'stayed'
          : 'continue';
  const standing: Standing = {
    ...margins(measures, rating, ceiling?.rating, capped),
    promotion: towardPromotion(outcome, rating, input.assessment),
    ...((plan === 'coaching' || plan === 'pip') && { plan }),
  };
  return { sim: rated.state, rating, outcome, standing, score, measures, ...(capped ? { ceilingReason: ceiling.reason } : {}), debriefs: structuredClone(input.debriefs) };
}
