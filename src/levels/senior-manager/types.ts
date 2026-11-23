/** How closely the player manages one of their managers. */
export type Oversight = 'handsOff' | 'coaching' | 'close';

export interface SeniorHabits {
  /** Per manager id. */
  oversight: Record<string, Oversight>;
  oneOnOnes: 'weekly' | 'fortnightly' | 'monthly';
  backfill: 'fast' | 'holdTheBar';
  skipLevel: 'none' | 'monthly';
}

/** A head a team has lost and not yet replaced. */
export interface Backfill {
  teamId: string;
  /** The game week the head was lost. */
  since: number;
  /** Month ends the head has been missing for. */
  months: number;
}

/** A team's heads at each performance level. */
export type RatingCounts = Record<'unrated' | 'below' | 'partial' | 'meets' | 'exceeds' | 'outstanding', number>;

export interface SeniorState {
  /** The level's own generator, apart from the simulation's and the situation engine's. */
  rngState: number;
  /** The game week the level began; its months and reviews count from here. */
  startWeek: number;
  /** The player's group, the old team first. */
  teamIds: string[];
  /** Per manager id: how many rating steps their proposals run above what their team delivered. Never shown. */
  leniency: Record<string, number>;
  habits: SeniorHabits;
  /** Managers whose want a 1:1 has revealed. */
  learnedWants: Record<string, true>;
  /** Teams a skip-level session listened to this month. */
  listenedTo: string[];
  backfills: Backfill[];
  /** Per manager id: months in a row under close oversight. */
  closeMonths: Record<string, number>;
  /** The next team a skip-level session listens to, as an index into the group. */
  skipRotation: number;
  /** Problems skip-level listening surfaced, to become moments next month. */
  surfaced: { teamId: string; week: number }[];
  /** Months in a row the player has ended at the edge. */
  burnoutMonths: number;
  /** Each team's headcount as the level last saw it, so a lost head can be noticed. */
  knownHeadcount: Record<string, number>;
  /** Each team's rating counts as the level last saw them, so heads lost from them can be counted. */
  knownRatings: Record<string, RatingCounts>;
  /** Heads rated meets or better that left, by the week they left. */
  regretted: { week: number; count: number }[];
  /** Per project id: the week it was completed. */
  completions: Record<string, number>;
  /** The review period's start: when, the managers' average skill, and each team's health bands. */
  periodStart: { week: number; skill: number; health: Record<string, { motivation: number; stress: number }> };
  counters: { person: number; team: number; project: number; hire: number };
}
