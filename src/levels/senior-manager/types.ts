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
}

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
  counters: { person: number; team: number; project: number };
}
