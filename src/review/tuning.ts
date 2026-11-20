/** Balancing constants for performance reviews. Values are provisional until playtesting. */
export const REVIEW_TUNING = {
  /** The boss's impression: the player's reputation, scored in every review. */
  reputation: { target: 55, tolerance: 10 },
  /**
   * The lowest score that earns each rating; below `partial` is `below`. A quarter with every measure at target
   * scores 0, which must be `meets`. Some measures cannot score above target, so `exceeds` and `outstanding` must
   * be reachable without every measure above.
   */
  thresholds: { outstanding: 0.65, exceeds: 0.45, meets: -0.2, partial: -0.55 },
} as const;
