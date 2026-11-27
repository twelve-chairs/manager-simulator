import type { RatingCounts, SurveyEntry } from '../org';

export type { RatingCounts, SurveyEntry };

/** Which team the VP puts first: their own function, or the leadership team they sit on. */
export type FirstTeam = 'function' | 'leadership';
/** How closely the VP directs their directors. */
export type DirectorStyle = 'stepBack' | 'review';

export interface VpHabits {
  firstTeam: FirstTeam;
  directors: DirectorStyle;
}

export interface VpSurvey {
  /** The quarter of the level it was taken in, from 1. */
  quarter: number;
  divisions: Record<string, SurveyEntry>;
}

export type VpMomentKind = 'finalEvaluation' | 'newDirector' | 'planning' | 'priority' | 'cuts' | 'dispute' | 'odds' | 'allHands' | 'stay';

export interface VpMoment {
  id: string;
  kind: VpMomentKind;
  /** Week of the quarter, 0 to 12, and day of that week, 0 (Monday) to 4. */
  week: number;
  day: number;
  time: 'morning' | 'afternoon';
  title: string;
  text: string;
  status: 'open' | 'answered' | 'waited';
  choices: { id: string; label: string }[];
  divisionId?: string;
  /** The director, peer or other person the moment is about. */
  personId?: string;
  /** Directors at odds: the other director. */
  otherId?: string;
  /** Annual planning: the planned headcount for the year. */
  planned?: number;
  /** Cuts: the heads the company asks the function to lose. */
  heads?: number;
}

/** The year's headcount: how many heads the leadership team gave the function, and how many arrive each quarter. */
export interface YearPlan {
  /** The quarter of the level the year began, from 1. */
  quarter: number;
  given: number;
  arrived: number;
  /** Heads still to arrive, one entry per quarter left in the year, earliest first. */
  due: number[];
  /** Whether the player asked for more than the plan needed. */
  askedMore: boolean;
}

/** The half's company priority: a project the function carries, with its stake. */
export interface Priority {
  projectId: string;
  divisionId: string;
  stake: number;
  /** The game week it was set. */
  week: number;
  /** Progress taken off each quarter's end when it is spread across the divisions; 0 when one division carries it. */
  spreadSlow: number;
}

export type VpGoalKind = 'landPriority' | 'fewRegretted' | 'peerTrust' | 'unstrainDivision';

export interface VpGoal {
  id: string;
  kind: VpGoalKind;
  /** The game week the goal was set. */
  week: number;
  divisionId?: string;
  personId?: string;
}

/** What the player could see as a quarter began, for the recap. */
export interface VpQuarterStart {
  week: number;
  directors: Record<string, { motivation: number; stress: number; skill: number }>;
  headcount: Record<string, number>;
  trust: Record<string, number>;
  surveyQuarter: number;
}

export interface VpState {
  /** The level's own generator, apart from the simulation's and the situation engine's. */
  rngState: number;
  /** The game week the level began; its quarters, years and reviews count from here. */
  startWeek: number;
  /** The function's divisions, the player's old organization first. */
  divisionIds: string[];
  /** The player's manager, outside the function. */
  ceoId: string;
  /** The peer VPs, outside the function. */
  peerIds: string[];
  /** Per director id: how many rating steps their calibration runs above what their division delivered. Never shown. */
  leniency: Record<string, number>;
  habits: VpHabits;
  /** People whose want a moment has revealed. */
  learnedWants: Record<string, true>;
  /** The last engagement survey. */
  survey: VpSurvey;
  /** The year's headcount, once annual planning has set it. */
  year: YearPlan | null;
  /** The half's company priority, while it runs. */
  priority: Priority | null;
  /** Company priorities and how they ended, by week. */
  priorityResults: { week: number; projectId: string; landed: boolean }[];
  /** Whether the company has asked for its cut, and the heads of each wave still due, earliest first. */
  cut: { asked: boolean; waves: number[] };
  /** Heads lost to cuts, by week; not attrition. */
  cutHeads: { week: number; count: number; divisions: Record<string, number> }[];
  /** What the function was last told at an all-hands, and the quarter of the level it was told. */
  told: { what: 'truth' | 'celebration' | 'short'; quarter: number } | null;
  /** The week a leadership dispute was last produced, so there is at most one a quarter. */
  lastDispute: number | null;
  /** Directors on a plan whose third low rating is held for a final evaluation. */
  heldEvaluations: string[];
  /** Each period's calibration: the average gap, in rating steps, between the divisions' ratings and their delivery. */
  calibrations: { week: number; gap: number }[];
  /** Quarters in a row the player has ended at the edge. */
  burnoutQuarters: number;
  /** The quarter's moments, in the order they play. */
  moments: VpMoment[];
  /** Per division: the week a director hired from outside arrives to lead it. */
  arriving: Record<string, number>;
  /** Per project id: the week it was completed. */
  completions: Record<string, number>;
  /** Per division: quarter ends in a row it has had no director. */
  leaderlessEnds: Record<string, number>;
  /** The review period's goals, and the week the period began. */
  goals: VpGoal[];
  periodStart: number;
  /** Each division's rating counts as the level last saw them, so heads lost from them can be counted. */
  knownRatings: Record<string, RatingCounts>;
  /** Heads rated meets or better that left, by the week they left. */
  regretted: { week: number; count: number }[];
  /** Per division: heads lost while the simulation advanced a quarter, by the week the quarter began, and how many were rated meets or better. */
  headsLost: { week: number; divisionId: string; count: number; regretted: number }[];
  /** What the player could see as the quarter began. */
  quarterStart: VpQuarterStart | null;
  /** Directors who joined after the handover, and those the player let go, for the career summary. */
  joined: string[];
  letGo: string[];
  counters: { person: number; team: number; project: number; moment: number; goal: number };
}
