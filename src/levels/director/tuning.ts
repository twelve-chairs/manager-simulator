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
  /** Quarters between reviews, the quarter promotion is possible from, and the quarter of the last review. */
  reviewEveryQuarters: 2,
  promotionFromQuarter: 6,
  lastReviewQuarter: 12,
  /** Quarters in a row at the edge that burn the player out. */
  burnoutQuarters: 2,
  /** Where the time goes: the trust the room above gains or loses, and the groups' motivation and senior managers' trust. */
  time: { aboveTrust: 4, groupMotivation: 4, seniorTrust: 3 },
  /** Staff meetings in a quarter: each senior manager's trust gained, and the player's energy spent. */
  staffMeeting: { weekly: { trust: 6, energy: 6 }, fortnightly: { trust: 3, energy: 3 } },
  /** The listening tour's energy. */
  tourEnergy: 4,
  /** Drift: the share of the way a group moves in a quarter toward what its senior manager sustains. */
  driftShare: 0.5,
  sustains: { motivationBase: 30, motivationPerSkill: 0.6, stressBase: 55, stressPerSkill: 0.5 },
  /** The management skill a leaderless group is treated as having. */
  leaderlessSkill: 15,
  /** A senior manager's motivation when the quarter serves their want or doesn't, and the share their stress moves toward their group's. */
  wantServed: 6,
  wantUnserved: -4,
  seniorStressShare: 0.4,
};
