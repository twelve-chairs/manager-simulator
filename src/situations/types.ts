import type { ChangeLogEntry, DepartureReason, PerformanceLevel, Rating, SimState, WantTags } from '../sim';

export type RoleKind = 'person' | 'team' | 'project';
export type TeamForm = 'detailed' | 'aggregate';
export type Operator = 'below' | 'atMost' | 'above' | 'atLeast' | 'is' | 'isNot' | 'in';

/** A literal, or another path written as `{ value: path }`. */
export type Operand = number | string | boolean | { value: string } | (number | string | boolean)[];

export type Comparison = { value: string } & Partial<Record<Operator, Operand>>;

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | Comparison
  | ({ count: { kind: RoleKind; where?: Condition } } & Partial<Record<Operator, Operand>>)
  | ({ history: string; situation?: string; choice?: string; action?: string; note?: string; rating?: Rating[]; withinWeeks?: number } & Partial<Record<Operator, Operand>>)
  | ({ presented: string; withinWeeks?: number } & Partial<Record<Operator, Operand>>);

export interface SituationRole {
  name: string;
  kind: RoleKind;
  /** For a team role: binds only teams of this form. */
  form?: TeamForm;
  where?: Condition;
}

/** The simulation core's effects, written with role names where the core takes ids, and without a cause. */
export type SituationEffect =
  | { type: 'value'; target: string; field: string; amount: number; wantTags?: WantTags; historyNote?: string }
  | { type: 'rate'; target: string; rating: Rating; revision?: boolean; historyNote?: string }
  | { type: 'reRate'; teamId: string; from: PerformanceLevel; to: Rating; count: number }
  | { type: 'remove'; personId: string; reason: DepartureReason }
  | { type: 'move'; personId: string; teamId: string }
  | { type: 'setLeader'; teamId: string; leader: string }
  | { type: 'reassignProject'; projectId: string; teamId: string }
  | { type: 'cancelProject'; projectId: string };

export interface Outcome {
  id: string;
  when?: Condition;
  effects: SituationEffect[];
  aftermath: string;
  debrief: string;
}

export interface Choice {
  id: string;
  label: string;
  availableIf?: Condition;
  outcomes: Outcome[];
}

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
export type Day = (typeof DAYS)[number];
export const TIMES = ['morning', 'afternoon', 'night'] as const;
export type TimeOfDay = (typeof TIMES)[number];

export interface Situation {
  id: string;
  title: string;
  levels: string[];
  priority: 'urgent' | 'normal';
  weight?: number;
  cooldownWeeks?: number;
  once?: boolean;
  when?: Condition;
  /** The day of the week it falls on, when authored. */
  day?: Day;
  /** The time of day it falls at, when authored. */
  time?: TimeOfDay;
  roles: SituationRole[];
  choices: Choice[];
  /** The body: the text presented to the player. */
  text: string;
  /** What letting it wait teaches, shown at the review when the player let it wait. */
  waitDebrief?: string;
}

export interface ContentError {
  /** The situation's id, when it has a readable one. */
  situationId?: string;
  /** Position in the bundle. */
  index?: number;
  message: string;
}

export interface DebriefRecord {
  /** The game week the situation was presented. */
  week: number;
  situationId: string;
  bindings: Record<string, string>;
  status: 'resolved' | 'ignored' | 'expired';
  choiceId?: string;
  outcomeId?: string;
  aftermath?: string;
  debrief?: string;
}

export interface OpenPresentation {
  id: string;
  situationId: string;
  week: number;
  bindings: Record<string, string>;
}

export interface EngineState {
  rngState: number;
  /** Count of presentations made in the run; the next presentation id derives from it. */
  presentationCount: number;
  /** Every presentation, oldest first. */
  presentations: { situationId: string; week: number }[];
  open: OpenPresentation[];
  debriefs: DebriefRecord[];
}

export interface Presentation {
  id: string;
  situationId: string;
  bindings: Record<string, string>;
  /** 0 is Monday, 4 is Friday. */
  day: number;
  time: TimeOfDay;
  text: string;
  choices: { id: string; label: string }[];
}

export type ResolveResult =
  | {
      kind: 'resolved';
      engine: EngineState;
      sim: SimState;
      log: ChangeLogEntry[];
      aftermath: string;
      debrief: DebriefRecord;
    }
  | { kind: 'expired'; engine: EngineState; sim: SimState; debrief: DebriefRecord }
  | { kind: 'error'; message: string };
