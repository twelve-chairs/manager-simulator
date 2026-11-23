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

/** A group's mood as the engagement survey measured it: raw values, shown as bands. */
export interface SurveyEntry {
  motivation: number;
  stress: number;
  attritionRisk: number;
}

export interface Survey {
  /** The quarter of the level it was taken in, from 1. */
  quarter: number;
  groups: Record<string, SurveyEntry>;
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
  counters: { person: number; team: number; project: number; moment: number; goal: number; bet: number };
}
