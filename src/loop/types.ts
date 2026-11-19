import type { ChangeLogEntry, Rating, SimState } from '../sim';
import type { EngineState, Presentation } from '../situations';

/** The operations every career level provides, so the turn loop can run any of them. */
export interface CareerLevel<L = unknown, P = unknown, C = unknown> {
  params: { id: string; weeksPerStep: number; situationLimit: number; reviewEveryWeeks: number };
  start(seed: number): { sim: SimState; level: L };
  beginWeek(level: L, sim: SimState): L;
  emptyPlan(): P;
  updatePlan(level: L, sim: SimState, plan: P, command: C): { ok: true; level: L; plan: P } | { ok: false; error: string };
  commit(level: L, sim: SimState, plan: P): { ok: true; level: L; sim: SimState; log: ChangeLogEntry[]; report: unknown } | { ok: false; error: string };
  afterAdvance(level: L, sim: SimState): { level: L; burnedOut: boolean };
  scorecard(level: L, sim: SimState): unknown;
  view(level: L, sim: SimState, plan: P): unknown;
}

export type ReviewOutcome = 'continue' | 'promote' | 'managedOut';

/** The performance review: rates the player and decides what happens next. */
export type Review = (input: { levelId: string; sim: SimState; scorecard: unknown }) => { sim: SimState; rating: Rating; outcome: ReviewOutcome };

/** A career level of any state, plan and command types; the loop only passes its own values back to it. */
export type AnyLevel = CareerLevel<any, any, any>;

export interface Dependencies {
  /** The career levels the run can use, lowest first. */
  levels: AnyLevel[];
  review: Review;
}

export type Command =
  | { kind: 'plan'; command: unknown }
  | { kind: 'answer'; presentationId: string; choiceId: string }
  | { kind: 'endWeek' }
  | { kind: 'acknowledge' };

export interface PresentedRecord {
  presentation: Presentation;
  status: 'open' | 'answered' | 'expired';
  aftermath?: string;
}

export interface Run {
  seed: number;
  levelId: string;
  sim: SimState;
  engine: EngineState;
  level: unknown;
  plan: unknown;
  phase: 'planning' | 'review' | 'ended';
  presented: PresentedRecord[];
  lastWeek: { report: unknown; aftermaths: string[] } | null;
  review: { rating: Rating; outcome: ReviewOutcome } | null;
  ending: 'burnout' | 'managedOut' | 'completed' | null;
  commands: Command[];
}

export type ApplyResult = { ok: true; run: Run } | { ok: false; error: string; run: Run };
