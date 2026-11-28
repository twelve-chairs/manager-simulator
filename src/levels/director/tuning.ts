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
  /** A generated group's project: weeks to its deadline, and its scope per week of that, so a healthy group lands it near the deadline. */
  groupProjectDeadline: [39, 65] as const,
  groupProjectScopePerWeek: [14, 22] as const,
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
  time: { aboveTrust: 4, groupMotivation: 9, seniorTrust: 3 },
  /** Staff meetings in a quarter: each senior manager's trust gained, and the player's energy spent. */
  staffMeeting: { weekly: { trust: 6, energy: 6 }, fortnightly: { trust: 3, energy: 3 } },
  /** The listening tour's energy. */
  tourEnergy: 4,
  /** Drift: the share of the way a group moves in a quarter toward what its senior manager sustains. */
  driftShare: 0.5,
  sustains: { motivationBase: 30, motivationPerSkill: 0.6, stressBase: 55, stressPerSkill: 0.5 },
  /** The motivation a group loses for each rating step its calibrated ratings sit above what it delivered. */
  calibrationMotivation: 6,
  /** The management skill a leaderless group is treated as having. */
  leaderlessSkill: 15,
  /** A senior manager's motivation when the quarter serves their want or doesn't, and the share their stress moves toward their group's. */
  wantServed: 6,
  wantUnserved: -4,
  seniorStressShare: 0.4,
  /** The most moments a quarter holds. */
  momentCap: 8,
  /** Weeks after a group receives heads during which its people don't raise headcount that never arrived: two quarters. */
  headcountIssueRestWeeks: 26,
  /** A stay conversation: the energy giving a restless leader what they want costs, and the motivation and trust it gives them. */
  stay: { energy: 4, motivation: 8, trust: 4 },
  /** Headcount: heads given at neutral standing, per point of the executive's trust and of reputation above 50, the most given, onboarding stress per head, a bet's progress per head, and the executive's trust lost per head held back. */
  head: { base: 3, perTrust: 0.06, perReputation: 0.04, max: 8, onboardingStress: 2, betSpeed: 15, heldTrust: 2 },
  /** Bets: how many are offered, their scope per week to their deadline, weeks to deadline and stakes, weeks overdue before one fails, progress lost under a strained group, progress a trusting peer adds and the trust that takes, and how far promising more raises stakes. */
  bets: { offers: [2, 3] as const, scopePerWeek: [16, 26] as const, deadline: [26, 52] as const, landing: [6, 12] as const, failing: [8, 14] as const, grace: 13, strainedSlow: 20, peerSpeed: 15, peerTrust: 60, promiseFactor: 1.25 },
  /** The quarterly review: trust telling it straight earns, reputation per thing in trouble, reputation leading with wins earns, what being found out costs, and what promising more earns. */
  review: { straightTrust: 4, troubleReputation: 2, winsReputation: 4, caughtTrust: 10, caughtReputation: 8, promiseReputation: 3 },
  /** Peers: the stress agreeing costs a group, trust agreeing earns, trust at which negotiating works and what it moves, trust refusing costs, and the trust below which a peer goes to the executive and what that costs. */
  // A peer asks at most every other quarter, so each ask moves trust enough to matter on its own.
  peer: { askStress: 6, agreeTrust: 14, negotiateAt: 50, negotiateTrust: 10, refuseTrust: 14, escalateBelow: 30, escalateTrust: 6 },
  /** A group in trouble: what coaching fixes and grows, and what deciding fixes and costs. */
  trouble: { coachFix: 8, coachGrowth: 3, decideFix: 15, decideEnergy: 6, decideTrust: 5 },
  /** Org design: group sizes above which a split is offered and below which a merge is. */
  org: { max: 32, min: 6 },
  /** A senior manager promoted from the group: management skill, trust, and the group's skill lost. */
  // A line manager promoted to lead their group already manages: they start capable, and know the group and the player.
  newSenior: { promotedSkill: [35, 55] as const, promotedTrust: 65, promoteSkill: 2 },
  /** The most people you would have kept that a period may lose and still meet the executive's goal: the review's own target for regretted attrition. */
  goalRegrettedMost: 4,
  /** The review's targets. */
  review_targets: {
    betsLanded: { target: 0.5, tolerance: 0.3 },
    projectsOnTime: { target: 1, tolerance: 1 },
    // Three groups of about twenty: a healthy organization loses about an eighth of its people a year (the simulation core's aggregate attrition rate), some of them people you would have kept.
    // On target up to the regretted-attrition goal's limit, so the measure and the goal agree.
    regrettedAttrition: { target: 3, tolerance: 1 },
    motivation: { target: 60, tolerance: 10 },
    stress: { target: 45, tolerance: 10 },
    executiveConfidence: { target: 60, tolerance: 10 },
    goal: { target: 0.5, tolerance: 0.4 },
  },
};
