/** Balancing constants for the simulation rules. Values are provisional until playtesting. */
export const TUNING = {
  /** Weeks since a want was last served before motivation starts to drift down. */
  wantDriftThresholdWeeks: 4,
  /** Motivation lost per week while a want is past the drift threshold. */
  wantDriftPerWeek: 3,
  /** Motivation regained per week while a want has been served recently. */
  wantRecoveryPerWeek: 1,
  /** Multiplier on motivation changes that serve or work against a person's want. */
  wantTagMultiplier: 1.5,

  /** Work units one average engineer completes per week. */
  workPerPersonPerWeek: 2,
  /** Weekly setback chance for a project at 100 risk and 100 tech debt. */
  setbackChancePerWeek: 0.11,
  /** Share of scope lost in a setback. */
  setbackProgressLoss: 0.1,
  /** Stress added to a team by a setback. */
  setbackStress: 10,

  /** Weekly team stress rise per trouble (overdue or behind project, no leader). */
  troubleStressPerWeek: 3,
  /** Weekly team stress recovery when the team is not in trouble. */
  stressRecoveryPerWeek: 1,

  /** Motivation below this counts as low. */
  lowMotivationLine: 30,
  /** Stress above this counts as high. */
  highStressLine: 75,
  /** Weekly quit chance with no risk factors. */
  baseQuitChancePerWeek: 0.002,
  /** Added weekly quit chance per year of low motivation. */
  lowMotivationQuitChancePerYear: 0.15,
  /** Added weekly quit chance per year of high stress. */
  highStressQuitChancePerYear: 0.1,
  /** Weekly chance that each head of an aggregate team leaves, at 100 attrition risk. */
  aggregateAttritionPerWeek: 0.01,
  /** Relative chance that a head lost from an aggregate team comes from each performance level. */
  lossWeightByLevel: { unrated: 1, below: 2, partial: 1.25, meets: 1, exceeds: 1.25, outstanding: 2 },

  /** Lowest contribution that corresponds to each rating above `below`. */
  contributionBands: { partial: 20, meets: 40, exceeds: 60, outstanding: 80 },

  /** Weekly reputation change per project on track (positive) or in trouble (negative). */
  reputationPerProjectPerWeek: 1,
  /** Weekly player stress rise per team in trouble. */
  playerStressPerTroubledTeamPerWeek: 1,
  /** Weekly player stress recovery when no team is in trouble. */
  playerStressRecoveryPerWeek: 4,
} as const;
