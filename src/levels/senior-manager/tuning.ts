/** The senior manager level's tunable values, set by the balance harness and playtesting. */
export const SENIOR_TUNING = {
  /** Weeks in a month: one turn. */
  weeksPerMonth: 4,
  /** Months between reviews. */
  reviewEveryMonths: 6,
  /** The stress band from which a team is strained: calm, steady, busy, strained, overwhelmed. */
  strainedBand: 3,
  /** Stress an outside hire adds to the team while it adjusts. */
  hireStress: 10,
  /** Trust at or above which an engineer who wants growth starts as a developing manager. */
  growingManagerTrust: 60,
  /** Below this trust, a manager reports their team rosier than it is; below the capable band of skill too. */
  candidTrust: 40,
  /** The size of a team generated at the handover. */
  teamSize: [4, 7] as const,

  /** Oversight: energy each month per manager, and the skill coaching grows. */
  coachingEnergy: 1,
  closeEnergy: 3,
  coachingGrowth: 2,
  /** Close oversight: motivation a manager who wants autonomy loses each month, and trust after this many months. */
  closeAutonomyMotivation: 4,
  closeTrustMonths: 3,
  closeTrust: 4,
  /** 1:1s: per 1:1, trust gained and energy spent. */
  oneOnOneTrust: 2,
  oneOnOneEnergy: 1,
  /** Backfill: months before a lost head is replaced, the skill a fast backfill costs, and the stress of each month without the head. */
  backfillMonths: { fast: 1, holdTheBar: 2 } as const,
  fastBackfillSkill: 5,
  backfillGapStress: 4,
  /** Skip-level listening: energy, and the trust it costs a manager who trusts the player less than this. */
  skipLevelEnergy: 3,
  skipLevelTrust: 4,
  skipLevelTrustBelow: 50,
  /** Weeks a surfaced problem the player settled stays settled for that team before it can be raised again. */
  issueSettledWeeks: 26,
  /** Drift: the share of the way a team moves each month toward what its manager sustains, and how much faster hands-off under a struggling one. */
  driftShare: 0.25,
  handsOffDrift: 1.6,
  sustains: { motivationBase: 30, motivationPerSkill: 0.6, stressBase: 55, stressPerSkill: 0.5 },
  /** The management skill a leaderless team is treated as having. */
  leaderlessSkill: 15,
  /** A manager's motivation when the month serves their want or doesn't, and the share their stress moves toward their team's. */
  wantServed: 3,
  wantUnserved: -2,
  managerStressShare: 0.25,
  /** Moments: the most a month holds, and the risk at or above which a project counts as at risk for a dispute. */
  momentCap: 5,
  /** A stay conversation: the energy giving a restless leader what they want costs, and the motivation and trust it gives them. */
  stay: { energy: 3, motivation: 8, trust: 4 },
  atRiskProject: 40,
  /** Escalations: how much stepping in and coaching fix a team's stress, what they cost, and the skill coaching grows. */
  stepInFix: 15,
  stepInEnergy: 6,
  coachFix: 8,
  coachEnergy: 1,
  coachGrowth: 3,
  /** Staffing: the stress a moved head relieves and adds, and the trust a now-busy giving manager loses. */
  moveRelief: 10,
  moveStress: 6,
  moveTrust: 5,
  /** Disputes: the skill agreeing grows, the relief and trust cost of deciding, and the risk letting it run adds. */
  agreeGrowth: 2,
  agreeEnergy: 1,
  agreeRelief: 5,
  /** Weeks a dispute the player agreed or decided stays settled between those two teams: a quarter. */
  disputeSettledWeeks: 13,
  decideRelief: 10,
  decideTrust: 5,
  letRunRisk: 8,
  /** New work: the stress spreading it adds to every team, and the reputation declining it costs. */
  spreadStress: 6,
  declineWork: 8,
  /** While the player decides each offer of new work, the weeks between offers for a team with room. */
  newWorkOfferWeeks: 12,
  /** New work that differs: a launch's reputation taken and declined; a handover's tech debt and decline; the idle team's own project's motivation, taken and declined. */
  launchReputation: 3,
  launchDecline: 10,
  handoverTechDebt: 60,
  handoverDecline: 3,
  ownProjectMotivation: 8,
  ownProjectDeclineMotivation: 5,
  /** Approvals: the motivation an unearned promotion costs the team, the trust asking for evidence and refusing cost, and the weeks between a team's proposals. */
  approvalDip: 5,
  evidenceTrust: 2,
  refuseTrust: 4,
  approvalCooldownWeeks: 26,
  /** Restructuring: the month it is offered from, and the skill a team loses when its strongest is promoted out. */
  restructureMonth: 12,
  restructureSkill: 5,
  /** Promoting a replacement from the team: the new manager's management skill, their trust (they know the team and the player), and the skill the team loses. */
  promotedSkill: [30, 39] as const,
  promotedTrust: 65,
  promoteSkill: 2,
  /** Calibration: a pleased manager's motivation, the trust each head marked below their proposal costs, and the motivation a team loses per rating step its ratings stray from its delivery. */
  calAcceptMotivation: 3,
  calTrustPerHead: 2,
  calUnfairMotivation: 6,
  /** The group's curve: the share of its heads that may hold a top rating, the reputation an exception needs to hold, and what arguing for one costs. */
  curveShare: 0.35,
  /** Where the good reputation band begins, so the scene can name it. */
  curveExceptionReputation: 60,
  curveExceptionCost: 4,
  /** After an argument: the weeks the room remembers it, and the reputation the next exception takes, where the excellent band begins. */
  curveMemoryWeeks: 26,
  curveExceptionAgainReputation: 80,
  /** Delivery: the score thresholds for partial, meets, exceeds and outstanding, and the share of heads a rating either side. */
  deliveryThresholds: [20, 35, 55, 72] as const,
  deliverySpread: 0.2,
  /** Months before promotion is possible, and the month of the last review. */
  promotionFromMonth: 18,
  lastReviewMonth: 36,
  /** The review's targets. */
  review: {
    completedOnTime: { target: 4, tolerance: 1 },
    onScheduleShare: { target: 0.85, tolerance: 0.1 },
    regrettedAttrition: { target: 0, tolerance: 1 },
    motivation: { target: 70, tolerance: 5 },
    stress: { target: 15, tolerance: 8 },
    managerGrowth: { target: 10, tolerance: 4 },
    healthHeld: { target: 0.67, tolerance: 0.2 },
    calibrationQuality: { target: 0.9, tolerance: 0.1 },
    goal: { target: 0.5, tolerance: 0.4 },
  },
};
