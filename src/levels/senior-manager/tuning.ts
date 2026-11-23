/** The senior manager level's tunable values, set by the balance harness and playtesting. */
export const SENIOR_TUNING = {
  /** Weeks in a month: one turn. */
  weeksPerMonth: 4,
  /** Months between reviews. */
  reviewEveryMonths: 6,
  /** Stress an outside hire adds to the team while it adjusts. */
  hireStress: 10,
  /** Trust at or above which an engineer who wants growth starts as a developing manager. */
  growingManagerTrust: 60,
  /** Below this trust, a manager reports their team rosier than it is; below the capable band of skill too. */
  candidTrust: 40,
  /** The size of a team generated at the handover. */
  teamSize: [4, 7] as const,
};
