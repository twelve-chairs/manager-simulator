import type { HabitId, WorkKind } from './types';

/** Balancing constants for the line manager level. Values are provisional until the balance harness and playtesting set them. */
export const LINE_TUNING = {
  /** Player stress at or above which a week counts toward burnout. */
  burnoutThreshold: 90,
  burnoutWeeks: 4,
  interviewsPerHire: 3,
  /** A starting project at or above this risk is the one at risk. */
  atRiskProjectRisk: 60,
  /** Upper edges of every band but the top one; a value below the first is band 0. */
  bandEdges: [20, 40, 60, 80] as readonly number[],
  /** Window for the scorecard's 1:1 share. */
  recentOneOnOneWeeks: 4,
  /** Share of a work item's consequence applied when the person handling it falls short of it. */
  reducedConsequence: 0.9,
  /** Most level moments in one week, so a week stays a handful of scenes. */
  levelMomentCap: 5,
  reviewEveryWeeks: 13,
  /** Promotion is possible from the third review (week 39), so a first session can reach one. */
  promotionFromReview: 3,
  /** The level's last review is its eighth: two years at a review every 13 weeks. */
  lastReview: 8,
  /** Average team stress band (overwhelmed) at or above which a review's rating is capped at meets. */
  stretchedTeamBand: 4,
  /** Overwhelmed weeks in a review period beyond which the rating is capped at partial: more than half of 13. */
  overloadedWeeks: 6,
  /** Idle weeks in a review period beyond which no projects counts against the player: more than half of 13. */
  idleQuarterWeeks: 6,
  /** Weeks after work intake is declined or expires before more is offered or assigned. */
  intakeWaitWeeks: 3,
  /** The stress band from which an engineer is strained: calm, steady, busy, strained, overwhelmed. */
  strainedBand: 3,
  /** Consecutive idle weeks after which the player's manager assigns the team a project. */
  assignAfterIdleWeeks: 4,
  /** Extra player stress recovered in a quiet week, one with no choice that raised the player's stress. */
  restRecovery: 6,

  habits: {
    /** Player stress per night page taken personally, per unit of the page's size. */
    pageStressPerSize: 1,
    oneOnOneTrust: 4,
    oneOnOneMotivation: 1,
    // A normal week's routine (1:1s, ceremonies, signing approvals) costs little; effort beyond it is what wears the player down.
    // The simulation keeps whole numbers, so these per-item costs are added up per habit before they apply.
    oneOnOneStress: 0.4,
    /** Player stress per routine item signed personally. */
    approvalStress: 0.25,
    /** An engineer's stress per routine item they sign. */
    signerStress: 1,
    ceremoniesMotivation: 1,
    ceremoniesStress: 1,
    lightCeremoniesRisk: 3,
    coachingSkill: 2,
    coachingStress: 1,
  },

  /** How many weeks back a memory can be brought up in a reaction. */
  callbackWeeks: 8,
  work: {
    /** Player stress per unit of size for work done yourself. */
    selfStressPerSize: 1.4,
    delegateStress: 6,
    stretchSkill: 1,
    declineIntakeReputation: -2,
    /** Stress each engineer takes on when the player takes on new work while someone is strained. */
    intakeTeamStress: 4,
    interviewStress: 3,
    interviewerStress: 2,
    interviewerMotivation: 1,
    backUpStress: 2,
  },

  /** Expected weekly number of each kind per active project (or, for expenses, per engineer); above 1, several can arrive. */
  arrivals: {
    approval: 0.6,
    designReview: 0.2,
    customerRequest: 0.15,
    /** On-call expectation at zero risk and tech debt, and the extra at both 100. */
    onCallBase: 0.1,
    onCallFromTrouble: 0.5,
    expense: 0.12,
  },
  difficultyRange: [20, 90] as const,

  /** Review targets for the level's measures: at target within the tolerance, edges included. */
  review: {
    completedOnTime: { target: 0, tolerance: 0 },
    onScheduleShare: { target: 0.75, tolerance: 0.15 },
    regrettedQuits: { target: 0, tolerance: 0 },
    motivation: { target: 65, tolerance: 10 },
    stress: { target: 35, tolerance: 10 },
    oneOnOneShare: { target: 0.9, tolerance: 0.08 },
    /** A goal is a measure of 1 when achieved and 0 when missed. */
    goal: { target: 0.5, tolerance: 0.4 },
  },

  /** Check-ins for projects in trouble: when they come, and what each choice does. */
  checkIn: {
    /** A project at or above this risk band is due a check-in. */
    band: 3,
    cooldownWeeks: 4,
    replanStress: 3,
    replanRisk: 20,
    /** Share of the remaining work cutting scope removes. */
    scopeShare: 0.2,
    scopeReputation: -2,
    deadlineWeeks: 4,
    deadlineReputation: -4,
  },

  goals: {
    growSkill: 8,
    teamStress: 40,
  },

  /** Fixing the debt a design review touches: offered from this tech debt band; the project slows and its debt falls. */
  payDown: { band: 1, progress: 6, techDebt: 15, stress: 2 },
  /** Rolling back the change behind a night page: progress lost, and the on-call engineer's stress. */
  rollBack: { progress: 5, stress: 3 },
  /** Offering a customer a smaller change: less reputation lost than letting the request expire. */
  smallerChange: { reputation: 1 },

  /** Consequences of an expired work item, at full strength. */
  expiry: {
    approvalProgress: -4,
    designReviewTechDebt: 8,
    customerRequestReputation: -3,
    onCallReputation: -5,
    onCallRisk: 6,
    expenseMotivation: -5,
    workIntakeReputation: -5,
  },
} as const;

/** Each kind of work: its size and how many weeks it waits before expiring. */
export const WORK_KINDS: Record<WorkKind, { size: number; expiryWeeks: number }> = {
  approval: { size: 2, expiryWeeks: 1 },
  expense: { size: 1, expiryWeeks: 2 },
  designReview: { size: 5, expiryWeeks: 2 },
  customerRequest: { size: 4, expiryWeeks: 2 },
  onCall: { size: 8, expiryWeeks: 0 },
  workIntake: { size: 2, expiryWeeks: 2 },
};

export const ROUTINE_KINDS: readonly WorkKind[] = ['approval', 'expense'];
export const MOMENT_KINDS: readonly WorkKind[] = ['designReview', 'customerRequest', 'workIntake'];


/** Cause ids for the level's habits and moment choices; all listed in the player action catalogue. */
export const HABIT_CAUSE: Record<HabitId, string> = {
  nightPages: 'line-manager.habit.night-pages',
  oneOnOnes: 'line-manager.habit.one-on-ones',
  approvals: 'line-manager.habit.approvals',
  ceremonies: 'line-manager.habit.ceremonies',
  growth: 'line-manager.habit.growth',
};
export const DO_IT_YOURSELF = 'line-manager.self';
export const DELEGATE = 'line-manager.delegate';
export const ACCEPT_INTAKE = 'line-manager.accept-intake';
export const DECLINE_INTAKE = 'line-manager.decline-intake';
export const PAY_DOWN = 'line-manager.pay-down';
export const ROLL_BACK = 'line-manager.roll-back';
export const SMALLER_CHANGE = 'line-manager.smaller-change';
export const FINAL_EVALUATION = 'line-manager.final-evaluation';
export const INTERVIEW = 'line-manager.interview';
export const ON_CALL = 'line-manager.on-call';
export const CHECK_IN = 'line-manager.check-in';
