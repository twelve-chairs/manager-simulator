/** The director level's tunable values, set by the balance harness and playtesting. */
export const DIRECTOR_TUNING = {
  /** Weeks in a quarter: one turn. */
  weeksPerQuarter: 13,
  /** Stress an outside hire adds to the group while it adjusts. */
  hireStress: 10,
  /** A generated group's headcount and health. */
  groupSize: [12, 20] as const,
  groupSkill: [35, 75] as const,
  groupMotivation: [40, 75] as const,
  groupStress: [20, 55] as const,
  /** A generated group's project: scope in work units, and weeks to its deadline. */
  groupProjectScope: [250, 400] as const,
  groupProjectDeadline: [39, 65] as const,
  /** A generated senior manager's management skill. */
  seniorSkill: [30, 75] as const,
  /** The executive's and peers' trust in the player, motivation and stress when the level begins. */
  outsiderTrust: [40, 70] as const,
  outsiderMotivation: [40, 80] as const,
  outsiderStress: [15, 50] as const,
};
