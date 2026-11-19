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

/** What a career level hands the review: its measures and whether promotion is possible yet. */
export interface Assessment {
  measures: Measure[];
  promotionPossible: boolean;
}

export type ReviewOutcome = 'continue' | 'promote' | 'managedOut';

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
  /** The average verdict, from −1 (all below) to 1 (all above). */
  score: number;
  measures: ScoredMeasure[];
  debriefs: DebriefRecord[];
}
