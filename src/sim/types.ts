export type Want = 'growth' | 'recognition' | 'stability' | 'autonomy';
export type Role = 'engineer' | 'manager';
export type PersonStatus = 'active' | 'departed' | 'aggregated';
export type DepartureReason = 'quit' | 'fired' | 'transferred';
export type ProjectStatus = 'active' | 'completed' | 'cancelled';

export type Cause =
  | { kind: 'action'; actionId: string }
  | { kind: 'situation'; situationId: string; choiceId: string }
  | { kind: 'rule'; ruleId: string };

export interface HistoryEntry {
  week: number;
  cause: Cause;
  note: string;
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
  joinedWeek: number;
  wantServedWeek: number;
  /** Consecutive weeks motivation has been below the low-motivation line. */
  lowMotivationWeeks: number;
  /** Consecutive weeks stress has been above the high-stress line. */
  highStressWeeks: number;
  teamId: string;
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

export interface StartingOrganization {
  player: PlayerStanding;
  teams: Team[];
  /** People with the team they belong to (for managers, the team they lead). */
  people: (NewPerson & { teamId: string })[];
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
