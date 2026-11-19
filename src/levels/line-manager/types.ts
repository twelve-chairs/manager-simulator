import type { ChangeLogEntry, PerformanceLevel, Role, SimState, Want } from '../../sim';

export type ActionId =
  | 'line-manager.one-on-one'
  | 'line-manager.coaching'
  | 'line-manager.recognition'
  | 'line-manager.training'
  | 'line-manager.ceremonies'
  | 'line-manager.project-planning'
  | 'line-manager.scope-negotiation'
  | 'line-manager.team-event'
  | 'line-manager.interview'
  | 'line-manager.recovery';

export type TargetKind = 'person' | 'team' | 'project' | 'vacancy' | 'player';
export type Target = { kind: 'person' | 'team' | 'project' | 'vacancy'; id: string } | { kind: 'player' };

/** Every week, every other week from the start week, or this week only. */
export type Cadence = 'weekly' | 'biweekly' | 'once';

export interface NewEntry {
  action: ActionId;
  target: Target;
  cadence: Cadence;
  /** For an every-other-week entry: this week (the default) or the next. */
  startWeek?: number;
}

export interface CalendarEntry {
  id: string;
  action: ActionId;
  target: Target;
  cadence: Cadence;
  startWeek: number;
}

export type DemandType = 'approval' | 'designReview' | 'customerRequest' | 'onCall' | 'expense' | 'workIntake';

export interface Demand {
  id: string;
  type: DemandType;
  subject: { kind: 'project' | 'person' | 'team'; id: string };
  hours: number;
  /** 0–100, on the same scale as skill. */
  difficulty: number;
  arrivedWeek: number;
  /** The last week the demand can be decided; left undecided through it, it expires. */
  lastWeek: number;
}

export type Decision = { kind: 'handle' } | { kind: 'delegate'; to: string } | { kind: 'accept' } | { kind: 'decline' };

/** The week's pending plan: a decision for each inbox demand the player has decided. */
export interface LinePlan {
  decisions: Record<string, Decision>;
}

/** A planning command: edit the calendar, decide a demand, or clear a decision. */
export type LinePlanCommand =
  | { kind: 'calendar'; add?: NewEntry[]; remove?: string[] }
  | { kind: 'decide'; demandId: string; decision: Decision }
  | { kind: 'clear'; demandId: string };

export interface Vacancy {
  id: string;
  interviews: number;
}

export interface LineState {
  rngState: number;
  teamId: string;
  targetHeadcount: number;
  calendar: CalendarEntry[];
  inbox: Demand[];
  vacancies: Vacancy[];
  /** Person id to the want the player learned at a 1:1, and the week. */
  learnedWants: Record<string, { want: Want; week: number }>;
  /** Project id to the week it completed. */
  completions: Record<string, number>;
  /** Consecutive weeks the player's stress has been at or above the burnout threshold. */
  burnoutWeeks: number;
  /** Counters for generated ids. */
  counters: { entry: number; demand: number; vacancy: number; person: number; project: number };
}

export interface CommitReport {
  hours: number;
  overtime: number;
  dropped: { entryId: string; reason: string }[];
  delegations: { demandId: string; to: string; succeeded: boolean }[];
  undelegated: { demandId: string; reason: string }[];
  /** Decisions on demands whose subject was gone, which had nothing to act on. */
  voided: { demandId: string; reason: string }[];
  expired: string[];
  /** Each demand named above, by type and subject, so the report reads after the demand has left the inbox. */
  demands: Record<string, Pick<Demand, 'type' | 'subject'>>;
}

export type CommitResult =
  | { ok: true; level: LineState; sim: SimState; log: ChangeLogEntry[]; report: CommitReport }
  | { ok: false; error: string };

/** A coarse reading of a 0–100 value: 0 is the lowest band. */
export type Band = number;

export interface View {
  people: {
    id: string;
    name: string;
    role: Role;
    tenureWeeks: number;
    performance: PerformanceLevel;
    motivation: Band;
    stress: Band;
    skill: Band;
    want: Want | 'unknown';
  }[];
  projects: {
    id: string;
    name: string;
    progress: number;
    scope: number;
    deadlineWeek: number;
    schedule: 'onSchedule' | 'behind' | 'overdue';
    risk: Band;
    techDebt: Band;
  }[];
  player: { reputation: Band; stress: Band };
  calendar: CalendarEntry[];
  vacancies: Vacancy[];
  inbox: { id: string; type: DemandType; subject: Demand['subject']; hours: number; lastWeek: number; difficulty: Band }[];
  /** Hours of the calendar entries that run this week and the demands the plan handles or accepts. */
  plannedHours: number;
  overtime: number;
}

export interface Scorecard {
  /** No on-schedule share when the team has no active projects. */
  delivery: { completedOnTime: number; onScheduleShare: number | null };
  retention: { quits: number; quitsRatedMeetsOrAbove: number };
  teamHealth: { motivation: number; stress: number; oneOnOneShare: number };
  promotionPossible: boolean;
}
