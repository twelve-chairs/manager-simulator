import type { Rating, SimState } from '../sim';
import type { DebriefRecord } from '../situations';

/** One thing a review scores: the player's value for the quarter against a target. */
export interface Measure {
  id: string;
  value: number;
  target: number;
  /** How far from the target still counts as at target, edges included. */
  tolerance: number;
  better: 'higher' | 'lower';
}

export type Verdict = 'below' | 'at' | 'above';
export type ScoredMeasure = Measure & { verdict: Verdict };

/**
 * What a career level hands the review: its measures, whether promotion is possible yet, how many reviews until it is
 * and how many the level has left, whether this is its last review, and any ceiling on the rating.
 */
export interface Assessment {
  measures: Measure[];
  promotionPossible: boolean;
  /** Reviews after this one until promotion is possible; 0 when it is now. */
  reviewsUntilPromotion: number;
  /** Reviews the level has left after this one. */
  reviewsLeft: number;
  /** The level's last review: a player not promoted here stays at this level, and the run ends. */
  lastReview?: boolean;
  /** The highest rating the level allows this quarter, and why. */
  ceiling?: { rating: Rating; reason: string };
}

export type ReviewOutcome = 'continue' | 'promote' | 'managedOut' | 'stayed';

/** What the next reviews can do toward promotion. */
export type TowardPromotion =
  | { kind: 'promoted' | 'ended' | 'outOfTime' | 'oneMore' | 'twoInARow' }
  | { kind: 'notOpenYet'; reviews: number };

/** Where the player stands: how near the rating came to the ones either side, toward promotion, and on a plan. */
export interface Standing {
  /** The rating one measure a verdict better would have earned, when it is a higher one. */
  marginUp?: Rating;
  /** The rating one measure a verdict worse would have given, when it is a lower one. */
  marginDown?: Rating;
  promotion: TowardPromotion;
  /** The plan this rating leaves the player on, when there is one. */
  plan?: 'coaching' | 'pip';
}

export interface ReviewInput {
  levelId: string;
  sim: SimState;
  assessment: Assessment;
  /** The quarter's situations, as the turn loop gathered them. */
  debriefs: DebriefRecord[];
}

export interface ReviewResult {
  sim: SimState;
  rating: Rating;
  outcome: ReviewOutcome;
  standing: Standing;
  /** The average verdict, from −1 (all below) to 1 (all above). */
  score: number;
  measures: ScoredMeasure[];
  /** Present when the level's ceiling lowered the rating. */
  ceilingReason?: string;
  debriefs: DebriefRecord[];
}
