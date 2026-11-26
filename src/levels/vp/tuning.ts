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
  /** The most moments a quarter holds. */
  momentCap: 8,
  /** Drift, as at the director level: the share of the way a division moves in a quarter toward what its director sustains. */
  drift: {
    driftShare: 0.5,
    sustains: { motivationBase: 30, motivationPerSkill: 0.6, stressBase: 55, stressPerSkill: 0.5 },
    leaderlessSkill: 15,
    wantServed: 6,
    wantUnserved: -4,
    leaderStressShare: 0.4,
  },
  /** The motivation a division loses for each rating step its calibrated ratings sit above what it delivered. */
  calibrationMotivation: 6,
  /** Your first team: trust gained and lost each quarter with the function first, and with the leadership team first. */
  firstTeam: { functionDirectorTrust: 3, functionPeerTrust: 3, leadershipTrust: 3, leadershipDirectorTrust: 1 },
  /** How you lead your directors: growth from stepping back, and what close review speeds, steadies and costs. */
  directors: { growth: 2, prioritySpeed: 40, steadyShare: 0.25, trust: 3, energy: 4 },
  /** Annual planning: the planned heads at neutral standing, more per point of the CEO's trust and of reputation above 50, the most planned, and what asking for more and giving to a peer move. */
  planning: { base: 8, perTrust: 0.1, perReputation: 0.08, max: 16, functionFirst: 2, more: 5, moreAt: 55, morePeerTrust: 8, missedTrust: 10, missedReputation: 8, give: 3, givePeerTrust: 12, giveCeoTrust: 5, onboardingStress: 1 },
  /** The company priority: its scope per week to its deadline, weeks to its deadline within the half, its stake, the stress one division carrying it takes on, the share spreading it slows it by, and the CEO's trust pushing back costs. */
  priority: { scopePerWeek: [30, 44] as const, deadline: [20, 26] as const, stake: [8, 14] as const, oneStress: 8, spreadShare: 0.35, pushTrust: 8 },
  /** Leadership disputes: how often one comes, and the trust each answer moves and the energy a trade costs. */
  dispute: { chance: 0.6, ceoTrust: 6, loserTrust: 3, functionTrust: 4, peersTrust: 6, tradeAt: 50, tradeTrust: 8, tradeEnergy: 3 },
  /** Cuts: the quarter of the level from which the company may ask, the chance it does each quarter, the share of heads, and what each way of cutting costs. */
  cuts: { fromQuarter: 5, chance: 0.3, share: [0.08, 0.12] as const, onceMotivation: 6, acrossMotivation: 10, acrossSlow: 0.05, waveMotivation: 5, waveRisk: 6 },
  /** Directors at odds: how often, the growth settling it together brings, the trust deciding costs, and how much leaving it slows. */
  odds: { chance: 0.4, growth: 3, trust: 6, slow: 0.04 },
  /** The all-hands: motivation telling the truth steadies in a hard quarter, a celebration lifts, and a celebration found out costs. */
  allHands: { truthMotivation: 4, celebrateMotivation: 4, caughtMotivation: 9 },
  /** A director promoted from the division: management skill, trust, and the division's skill lost. */
  newDirector: { promotedSkill: [35, 55] as const, promotedTrust: 65, promoteSkill: 2 },
  /** The most people you would have kept that a period may lose and still meet the CEO's goal: the review's own target. */
  goalRegrettedMost: 6,
  review_targets: {
    prioritiesLanded: { target: 0.5, tolerance: 0.3 },
    projectsOnTime: { target: 1, tolerance: 1 },
    // Three divisions of about fifty: on target up to the regretted-attrition goal's limit, so the measure and the goal agree.
    regrettedAttrition: { target: 5, tolerance: 1 },
    motivation: { target: 60, tolerance: 10 },
    stress: { target: 45, tolerance: 10 },
    ceoConfidence: { target: 60, tolerance: 10 },
    peerConfidence: { target: 55, tolerance: 10 },
    goal: { target: 0.5, tolerance: 0.4 },
  },
};
