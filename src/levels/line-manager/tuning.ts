import type { ActionId, DemandType, TargetKind } from './types';

/** Balancing constants for the line manager level. Values are provisional until playtesting. */
export const LINE_TUNING = {
  weeklyHours: 40,
  overtimeCapHours: 12,
  /** Player stress added per overtime hour. */
  overtimeStressPerHour: 2,
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
  /** Share of a demand's consequence applied when a delegate's skill falls short of it. */
  reducedConsequence: 0.5,

  effects: {
    oneOnOneTrust: 4,
    oneOnOneMotivation: 2,
    coachingSkill: 2,
    recognitionMotivation: 5,
    trainingSkill: 4,
    trainingStress: 5,
    ceremoniesMotivation: 1,
    noCeremoniesRisk: 3,
    planningRisk: -6,
    /** Share of scope removed by scope negotiation. */
    scopeCut: 0.1,
    scopeReputation: -3,
    teamEventMotivation: 4,
    teamEventStress: -5,
    recoveryStress: -6,
    delegateStress: 4,
    delegateSkillOnStretch: 2,
    declineIntakeReputation: -2,
  },

  /** Weekly chance of each demand per active project (or, for expenses, per engineer). */
  arrivals: {
    approval: 0.35,
    designReview: 0.15,
    customerRequest: 0.2,
    /** On-call chance at zero risk and tech debt, and the extra at both 100. */
    onCallBase: 0.03,
    onCallFromTrouble: 0.3,
    expense: 0.06,
  },
  difficultyRange: [20, 90] as const,

  /** Review targets for the level's measures: at target within the tolerance, edges included. */
  review: {
    completedOnTime: { target: 0, tolerance: 0 },
    onScheduleShare: { target: 0.75, tolerance: 0.15 },
    regrettedQuits: { target: 0, tolerance: 0 },
    motivation: { target: 55, tolerance: 10 },
    stress: { target: 45, tolerance: 10 },
    oneOnOneShare: { target: 0.8, tolerance: 0.15 },
  },

  /** Consequences of an expired demand. */
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

export const ACTIONS: Record<ActionId, { hours: number; target: TargetKind; oneOff: boolean }> = {
  'line-manager.one-on-one': { hours: 1, target: 'person', oneOff: false },
  'line-manager.coaching': { hours: 2, target: 'person', oneOff: false },
  'line-manager.recognition': { hours: 1, target: 'person', oneOff: false },
  'line-manager.training': { hours: 1, target: 'person', oneOff: true },
  'line-manager.ceremonies': { hours: 4, target: 'team', oneOff: false },
  'line-manager.project-planning': { hours: 3, target: 'project', oneOff: false },
  'line-manager.scope-negotiation': { hours: 2, target: 'project', oneOff: true },
  'line-manager.team-event': { hours: 3, target: 'team', oneOff: true },
  'line-manager.interview': { hours: 2, target: 'vacancy', oneOff: true },
  'line-manager.recovery': { hours: 2, target: 'player', oneOff: false },
};

export const DEMAND_TYPES: Record<DemandType, { hours: number; expiryWeeks: number }> = {
  approval: { hours: 1, expiryWeeks: 1 },
  designReview: { hours: 3, expiryWeeks: 2 },
  customerRequest: { hours: 2, expiryWeeks: 2 },
  onCall: { hours: 4, expiryWeeks: 0 },
  expense: { hours: 1, expiryWeeks: 2 },
  workIntake: { hours: 2, expiryWeeks: 2 },
};

/** Action ids for decisions that are not calendar actions. */
export const DELEGATE = 'line-manager.delegate';
export const ACCEPT_INTAKE = 'line-manager.accept-intake';
export const DECLINE_INTAKE = 'line-manager.decline-intake';
