import type { ChangeLogEntry, PerformanceLevel, Rating, Role, SimState, Want } from '../../sim';

export type WorkKind = 'approval' | 'expense' | 'designReview' | 'customerRequest' | 'onCall' | 'workIntake';

/** Hands-on work for the team: routine items go to a habit, the rest become moments. */
export interface WorkItem {
  id: string;
  kind: WorkKind;
  subject: { kind: 'project' | 'person' | 'team'; id: string };
  /** How much work it is: what doing it yourself costs, and how hard its consequence lands. */
  size: number;
  /** 0–100, on the same scale as skill. */
  difficulty: number;
  arrivedWeek: number;
  /** The last week it can be dealt with; still open through it, it expires. */
  lastWeek: number;
}

export type HabitId = 'nightPages' | 'oneOnOnes' | 'approvals' | 'ceremonies' | 'growth';

export interface Habits {
  nightPages: 'rotation' | 'me' | 'seniors';
  oneOnOnes: 'fortnightly' | 'weekly' | 'whenNeeded';
  /** `me`, or the id of the engineer who signs routine approvals. */
  approvals: string;
  ceremonies: 'full' | 'light';
  /** `nobody`, or the id of the engineer being coached. */
  growth: string;
}

export interface MomentChoice {
  id: string;
  label: string;
}

/** A scene the level contributes to the week: work to decide, an interview, a project check-in, or a night page for the engineer on call. */
export interface LevelMoment {
  id: string;
  kind: 'work' | 'interview' | 'checkIn' | 'onCall';
  /** The work item, vacancy or project the moment is about. */
  ref: string;
  /** The engineer on call, for an on-call moment. */
  personId?: string;
  week: number;
  /** 0 is Monday, 4 is Friday. */
  day: number;
  time: 'morning' | 'afternoon' | 'night';
  choices: MomentChoice[];
  status: 'open' | 'answered' | 'waited';
  /** What happened, once answered or let wait. */
  outcome?: string;
}

export type GoalKind = 'shipOnTime' | 'onSchedule' | 'keepEveryone' | 'growSomeone' | 'lowerStress';

export interface Goal {
  id: string;
  kind: GoalKind;
  periodStart: number;
  projectId?: string;
  personId?: string;
  /** The value at the start of the period, for goals measured as a change; for a ship-by-deadline goal, the deadline when it was set. */
  startValue?: number;
  target?: number;
}

export interface Vacancy {
  id: string;
  interviews: number;
}

export interface LineState {
  rngState: number;
  teamId: string;
  targetHeadcount: number;
  habits: Habits;
  items: WorkItem[];
  moments: LevelMoment[];
  vacancies: Vacancy[];
  /** Person id to the want the player learned at a 1:1, and the week. */
  learnedWants: Record<string, { want: Want; week: number }>;
  /** Project id to the week it completed. */
  completions: Record<string, number>;
  /** Project id to the week of its last check-in moment. */
  checkIns: Record<string, number>;
  /** Consecutive weeks the player's stress has been at or above the burnout threshold. */
  burnoutWeeks: number;
  goals: Goal[];
  /** The first week of the review period the goals belong to; -1 before any are set. */
  goalsPeriod: number;
  /** Habit fall-backs made when the week began, for that week's recap. */
  habitNotes: string[];
  /** Each engineer's motivation and stress when the week began, so the recap can say who changed; week -1 before any week has begun. */
  weekStart: { week: number; people: Record<string, { motivation: number; stress: number }> };
  /** Counters for generated ids. */
  counters: { item: number; vacancy: number; person: number; project: number; moment: number; goal: number };
}

/** What the level reports at the end of a week. */
export interface Recap {
  habits: string[];
  habitChanges: string[];
  moments: { momentId: string; ref: string; text: string }[];
  expired: { itemId: string; kind: WorkKind; subject: WorkItem['subject'] }[];
  goals: { id: string; text: string }[];
  people: { personId: string; name: string; changes: string[]; notes: string[] }[];
  /** Engineers the level rated at the end of a review period, on what they delivered. */
  evaluations: { personId: string; name: string; rating: Rating }[];
}

export type LevelResult<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface ChoiceResult {
  level: LineState;
  sim: SimState;
  log: ChangeLogEntry[];
  reaction: string;
}

export interface WeekResult {
  level: LineState;
  sim: SimState;
  log: ChangeLogEntry[];
  recap: Recap;
}

/** A coarse reading of a 0–100 value: 0 is the lowest band. */
export type Band = number;

export interface View {
  people: {
    id: string;
    name: string;
    role: Role;
    tenureWeeks: number;
    personality: string | undefined;
    performance: PerformanceLevel;
    motivation: Band;
    stress: Band;
    skill: Band;
    want: Want | 'unknown';
    /** Their three latest history notes, newest first. */
    memory: string[];
    /** How many history notes they have, so a new note shows even when it repeats an earlier one. */
    notes: number;
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
  player: { energy: Band; reputation: Band };
  habits: Habits;
  vacancies: Vacancy[];
  goals: { id: string; text: string; progress: string }[];
  moments: (Omit<LevelMoment, 'week'> & { title: string; text: string; difficulty?: Band })[];
}

export interface Scorecard {
  /** No on-schedule share when the team has no active projects. */
  delivery: { completedOnTime: number; onScheduleShare: number | null };
  retention: { quits: number; quitsRatedMeetsOrAbove: number };
  teamHealth: { motivation: number; stress: number; oneOnOneShare: number };
  promotionPossible: boolean;
}
