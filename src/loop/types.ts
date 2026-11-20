import type { Assessment, ReviewInput, ReviewResult } from '../review';
import type { ChangeLogEntry, SimState } from '../sim';
import type { EngineState, Presentation, TimeOfDay } from '../situations';

export type { ReviewOutcome } from '../review';

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** One of the level's moments in the week, as the loop sees it. */
export interface LevelMomentRef {
  id: string;
  /** 0 is Monday, 4 is Friday. */
  day: number;
  time: TimeOfDay;
  /** Whether it can still be answered. */
  open: boolean;
  /** What the moment is called, for the recap once the level has moved on. */
  title?: string;
}

/** The operations every career level provides, so the turn loop can run any of them. */
export interface CareerLevel<L = unknown> {
  params: { id: string; weeksPerStep: number; situationLimit: number; reviewEveryWeeks: number };
  start(seed: number): { sim: SimState; level: L };
  beginWeek(level: L, sim: SimState): L;
  moments(level: L, sim: SimState): LevelMomentRef[];
  plan(level: L, sim: SimState, command: unknown): Result<{ level: L }>;
  choose(level: L, sim: SimState, momentId: string, choiceId: string): Result<{ level: L; sim: SimState; log: ChangeLogEntry[]; reaction: string }>;
  endWeek(level: L, sim: SimState): Result<{ level: L; sim: SimState; log: ChangeLogEntry[]; recap: unknown }>;
  afterAdvance(level: L, sim: SimState): { level: L; burnedOut: boolean };
  scorecard(level: L, sim: SimState): unknown;
  assess(level: L, sim: SimState): Assessment;
  view(level: L, sim: SimState): unknown;
}

/** The performance review: rates the player and decides what happens next. */
export type Review = (input: ReviewInput) => ReviewResult;

/** A career level of any state type; the loop only passes its own values back to it. */
export type AnyLevel = CareerLevel<any>;

export interface Dependencies {
  /** The career levels the run can use, lowest first. */
  levels: AnyLevel[];
  review: Review;
}

export type Command =
  | { kind: 'plan'; command: unknown }
  | { kind: 'answer'; momentId: string; choiceId: string }
  | { kind: 'wait' }
  | { kind: 'endWeek' }
  | { kind: 'acknowledge' };

/** A moment in the week's sequence: one of the level's, or a situation. */
export interface WeekMoment {
  source: 'level' | 'situation';
  /** The id its owner gave it: the level's moment id or the situation engine's presentation id. */
  id: string;
  day: number;
  time: TimeOfDay;
  /** What the moment is called: the level's title for it, or the situation's. */
  title: string;
  status: 'open' | 'answered' | 'waited' | 'expired';
  /** The reaction or aftermath line, once answered. */
  text?: string;
}

export interface Run {
  seed: number;
  levelId: string;
  sim: SimState;
  engine: EngineState;
  level: unknown;
  phase: 'week' | 'review' | 'ended';
  /** The week's moments in the order they play. */
  week: WeekMoment[];
  /** The situations presented this week. */
  presented: Presentation[];
  lastWeek: { recap: unknown; moments: WeekMoment[] } | null;
  /** A conducted review waiting to be acknowledged: everything the review returned but the simulation state. */
  review: Omit<ReviewResult, 'sim'> | null;
  ending: 'burnout' | 'managedOut' | 'completed' | null;
  commands: Command[];
}

export type ApplyResult = { ok: true; run: Run } | { ok: false; error: string; run: Run };
