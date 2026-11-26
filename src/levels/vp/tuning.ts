/** The VP level's tunable values, set by the balance harness and playtesting. */
export const VP_TUNING = {
  /** Weeks in a quarter: one turn. Quarters in a year, and in a half. */
  weeksPerQuarter: 13,
  quartersPerYear: 4,
  quartersPerHalf: 2,
  /** Stress an outside hire adds to the division while it adjusts. */
  hireStress: 10,
  /** A generated division's headcount and health, and its projects: weeks to their deadline, and scope per week of that. */
  division: {
    size: [36, 56] as const,
    skill: [35, 75] as const,
    motivation: [40, 75] as const,
    stress: [20, 55] as const,
    projectDeadline: [39, 65] as const,
    projectScopePerWeek: [40, 62] as const,
  },
  /** A generated director's management skill. */
  directorSkill: [35, 75] as const,
  /** The CEO's and peers' trust in the player, motivation and stress when the level begins. */
  outsiderTrust: [40, 70] as const,
  outsiderMotivation: [40, 80] as const,
  outsiderStress: [15, 50] as const,
  /** Quarters between reviews, the quarter promotion is possible from, and the quarter of the last review. */
  reviewEveryQuarters: 2,
  promotionFromQuarter: 6,
  lastReviewQuarter: 12,
  /** Quarters in a row at the edge that burn the player out. */
  burnoutQuarters: 2,
};
