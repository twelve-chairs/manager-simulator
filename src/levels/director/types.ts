import type { RatingCounts, SurveyEntry } from '../org';

export type { RatingCounts, SurveyEntry };

/** Where the director's time goes: their own organization, an even split, or the room above. */
export type TimeSplit = 'organization' | 'balanced' | 'upward';

export interface DirectorHabits {
  time: TimeSplit;
  staffMeeting: 'weekly' | 'fortnightly';
  listeningTour: 'none' | 'quarterly';
}

/** A funded strategy bet: a project a group carries, and what it stakes on landing and on failing. */
export interface Bet {
  projectId: string;
  groupId: string;
  landing: number;
  failing: number;
  /** The peer whose organization the bet's work touches. */
  peerId: string | null;
}


export interface Survey {
  /** The quarter of the level it was taken in, from 1. */
  quarter: number;
  groups: Record<string, SurveyEntry>;
}

export type DirectorMomentKind = 'finalEvaluation' | 'newSenior' | 'headcount' | 'bets' | 'surfaced' | 'trouble' | 'peerAsk' | 'orgDesign' | 'review' | 'stay';

/** A strategy bet the executive offers: a project with a stake on landing and on failing. */
export interface BetOffer {
  id: string;
  name: string;
  scope: number;
  /** Weeks from funding to its deadline. */
  deadlineWeeks: number;
  landing: number;
  failing: number;
  peerId: string | null;
}

export interface DirectorMoment {
  id: string;
  kind: DirectorMomentKind;
  /** Week of the quarter, 0 to 12, and day of that week, 0 (Monday) to 4. */
  week: number;
  day: number;
  time: 'morning' | 'afternoon';
  title: string;
  text: string;
  status: 'open' | 'answered' | 'waited';
  choices: { id: string; label: string }[];
  groupId?: string;
  /** The senior manager, peer or other person the moment is about. */
  personId?: string;
  /** Headcount planning: the heads given this quarter. */
  heads?: number;
  /** Strategy bets: what is on offer. */
  offers?: BetOffer[];
}

export type DirectorGoalKind = 'landBet' | 'zeroRegretted' | 'unstrainGroup' | 'peerTrust';

export interface DirectorGoal {
  id: string;
  kind: DirectorGoalKind;
  /** The game week the goal was set. */
  week: number;
  projectId?: string;
  groupId?: string;
  personId?: string;
}


/** What the player could see as a quarter began, for the recap. */
export interface QuarterStart {
  week: number;
  seniorManagers: Record<string, { motivation: number; stress: number; skill: number }>;
  headcount: Record<string, number>;
  trust: Record<string, number>;
  surveyQuarter: number;
  /** Heads the player's own reorganizations moved between groups this quarter, by the groups' names when they moved. */
  moved: { from: string; fromName: string; to: string; toName: string; count: number; kind: 'split' | 'merge' }[];
}

export interface DirectorState {
  /** The level's own generator, apart from the simulation's and the situation engine's. */
  rngState: number;
  /** The game week the level began; its quarters and reviews count from here. */
  startWeek: number;
  /** The organization's groups, the player's old group first. */
  groupIds: string[];
  /** The player's own manager, outside the organization. */
  executiveId: string;
  /** The peer directors, outside the organization. */
  peerIds: string[];
  /** Per senior manager id: how many rating steps their calibration runs above what their group delivered. Never shown. */
  leniency: Record<string, number>;
  habits: DirectorHabits;
  /** People whose want a staff meeting or a moment has revealed. */
  learnedWants: Record<string, true>;
  /** The last engagement survey. */
  survey: Survey;
  /** The group the listening tour visited, and the quarter it shows that group as it is. */
  visited: { groupId: string; quarter: number } | null;
  bets: Bet[];
  /** The next group the listening tour visits, as an index into the groups. */
  tourRotation: number;
  /** Problems the listening tour surfaced, to become moments next quarter. */
  surfaced: { groupId: string; week: number }[];
  /** Senior managers on a plan whose third low rating is held for a final evaluation. */
  heldEvaluations: string[];
  /** Each period's calibration: the average gap, in rating steps, between the groups' ratings and their delivery. */
  calibrations: { week: number; gap: number }[];
  /** Quarters in a row the player has ended at the edge. */
  burnoutQuarters: number;
  /** The quarter's moments, in the order they play. */
  moments: DirectorMoment[];
  /** Per group: the week a senior manager hired from outside arrives to lead it. */
  arriving: Record<string, number>;
  /** Projects and bets a quarterly review left out, and the week it was given. */
  leftOut: { id: string; week: number }[];
  /** Per bet project id: the week it was completed. */
  completions: Record<string, number>;
  /** Per group: quarter ends in a row it has had no senior manager. */
  leaderlessEnds: Record<string, number>;
  /** Per peer: the review period in which they last went to the executive about the player. */
  escalated: Record<string, number>;
  /** The review period's goals, and the week the period began. */
  goals: DirectorGoal[];
  periodStart: number;
  /** Each group's rating counts as the level last saw them, so heads lost from them can be counted. */
  knownRatings: Record<string, RatingCounts>;
  /** Heads rated meets or better that left, by the week they left. */
  regretted: { week: number; count: number }[];
  /** Bets funded and how they ended, by week. */
  funded: { week: number; projectId: string }[];
  betResults: { week: number; projectId: string; landed: boolean }[];
  /** What the player could see as the quarter began. */
  quarterStart: QuarterStart | null;
  /** Senior managers who joined after the handover, and those the player let go, for the career summary. */
  joined: string[];
  /** The week a peer last asked for something, so asks come at most every other quarter. */
  lastPeerAsk?: number;
  letGo: string[];
  counters: { person: number; team: number; project: number; moment: number; goal: number; bet: number };
}
