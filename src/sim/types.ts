/** Everything a person can want from the job. */
export const WANTS = ['growth', 'recognition', 'stability', 'autonomy'] as const;
export type Want = (typeof WANTS)[number];
/** `executive` and `peer` are people outside the organization: the player's own manager and peers at their level. */
export type Role = 'engineer' | 'manager' | 'executive' | 'peer';
export type PersonStatus = 'active' | 'departed' | 'aggregated';
export const DEPARTURE_REASONS = ['quit', 'fired', 'transferred'] as const;
export type DepartureReason = (typeof DEPARTURE_REASONS)[number];
export type ProjectStatus = 'active' | 'completed' | 'cancelled';
export type Rating = 'below' | 'partial' | 'meets' | 'exceeds' | 'outstanding';
export type PerformanceLevel = 'unrated' | Rating;
export type Plan = 'none' | 'coaching' | 'pip' | 'failedPip';

/** Ratings from lowest to highest. */
export const RATINGS: readonly Rating[] = ['below', 'partial', 'meets', 'exceeds', 'outstanding'];
/** Every performance level, in the order rating counts list them. */
export const PERFORMANCE_LEVELS: readonly PerformanceLevel[] = ['unrated', ...RATINGS];

export type Cause =
  | { kind: 'action'; actionId: string }
  | { kind: 'situation'; situationId: string; choiceId: string }
  | { kind: 'rule'; ruleId: string };

export interface HistoryEntry {
  week: number;
  cause: Cause;
  note?: string;
  /** Present when the entry records a rating. */
  rating?: Rating;
}

export interface RatingEntry {
  week: number;
  cause: Cause;
  rating: Rating;
}

export interface Person {
  id: string;
  name: string;
  role: Role;
  skill: number;
  motivation: number;
  stress: number;
  trust: number;
  want: Want;
  /** A trait the career level gives the person; no simulation rule reads it. */
  personality?: string;
  performance: PerformanceLevel;
  joinedWeek: number;
  wantServedWeek: number;
  /** Consecutive weeks motivation has been below the low-motivation line. */
  lowMotivationWeeks: number;
  /** Consecutive weeks stress has been above the high-stress line. */
  highStressWeeks: number;
  /** The team they belong to, or lead; null for a person outside the organization. */
  teamId: string | null;
  status: PersonStatus;
  departure?: { week: number; reason: DepartureReason };
  history: HistoryEntry[];
}

export type Leader = { kind: 'player' } | { kind: 'person'; id: string };

export interface TeamAggregate {
  headcount: number;
  skill: number;
  motivation: number;
  stress: number;
  attritionRisk: number;
  /** Heads at each performance level; the counts sum to headcount. */
  ratings: Record<PerformanceLevel, number>;
}

export interface Team {
  id: string;
  name: string;
  leader: Leader | null;
  form: 'detailed' | 'aggregate';
  /** Present only when form is 'aggregate'. */
  aggregate?: TeamAggregate;
}

export interface Project {
  id: string;
  name: string;
  teamId: string;
  scope: number;
  progress: number;
  risk: number;
  techDebt: number;
  startWeek: number;
  deadlineWeek: number;
  status: ProjectStatus;
}

export interface PlayerStanding {
  reputation: number;
  stress: number;
  performance: PerformanceLevel;
  ratingHistory: RatingEntry[];
}

export interface SimState {
  week: number;
  rngState: number;
  player: PlayerStanding;
  people: Record<string, Person>;
  teams: Record<string, Team>;
  projects: Record<string, Project>;
}

export interface NewPerson {
  id: string;
  name: string;
  role: Role;
  skill: number;
  motivation: number;
  stress: number;
  trust: number;
  want: Want;
  personality?: string;
}

export interface NewProject {
  id: string;
  name: string;
  teamId: string;
  scope: number;
  risk: number;
  techDebt: number;
  deadlineWeek: number;
}

/** A team as given in a starting organization; an aggregate team's rating counts may be left out. */
export type StartingTeam = Omit<Team, 'aggregate'> & {
  aggregate?: Omit<TeamAggregate, 'ratings'> & { ratings?: Record<PerformanceLevel, number> };
};

export interface StartingOrganization {
  player: { reputation: number; stress: number; performance?: Rating };
  teams: StartingTeam[];
  /** People with the team they belong to (for managers, the team they lead). */
  people: (NewPerson & { teamId: string; performance?: Rating })[];
  projects: NewProject[];
}

export type ValueTarget =
  | { kind: 'person'; id: string }
  | { kind: 'team'; id: string }
  | { kind: 'project'; id: string }
  | { kind: 'player' };

export interface WantTags {
  serves?: Want[];
  against?: Want[];
}

export type Effect =
  | {
      type: 'value';
      target: ValueTarget;
      field: string;
      amount: number;
      cause: Cause;
      wantTags?: WantTags;
      historyNote?: string;
    }
  | {
      type: 'rate';
      target: { kind: 'person'; id: string } | { kind: 'player' };
      rating: Rating;
      cause: Cause;
      /** Replaces the latest rating instead of adding one. */
      revision?: boolean;
      historyNote?: string;
    }
  | { type: 'reRate'; teamId: string; from: PerformanceLevel; to: Rating; count: number; cause: Cause }
  | { type: 'hire'; teamId: string; person: NewPerson; cause: Cause }
  | { type: 'remove'; personId: string; reason: DepartureReason; cause: Cause }
  | { type: 'move'; personId: string; teamId: string; cause: Cause }
  | { type: 'setLeader'; teamId: string; leader: Leader; cause: Cause }
  | { type: 'startProject'; project: NewProject; cause: Cause }
  | { type: 'reassignProject'; projectId: string; teamId: string; cause: Cause }
  | { type: 'cancelProject'; projectId: string; cause: Cause };

export interface ChangeLogEntry {
  cause: Cause;
  target: ValueTarget | { kind: 'clock' };
  field: string;
  before: unknown;
  after: unknown;
}

export interface OperationResult {
  state: SimState;
  log: ChangeLogEntry[];
}

export type ApplyEffectsResult =
  | ({ ok: true } & OperationResult)
  | { ok: false; error: { index: number; effect: Effect; message: string } };
