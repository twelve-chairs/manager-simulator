import type { SimState } from '../sim';
import { propertyValue, ratingRank, type Value } from './properties';
import type { Condition, EngineState, Operand, Operator, RoleKind } from './types';

export const OPERATORS: readonly Operator[] = ['below', 'atMost', 'above', 'atLeast', 'is', 'isNot', 'in'];

export interface EvalContext {
  sim: SimState;
  engine: EngineState;
  /** Role name to bound entity id. */
  bindings: Record<string, string>;
  /** Role name to kind; a role missing here is looked up among people, then teams, then projects. */
  kinds?: Record<string, RoleKind>;
  /** The candidate inside a count. */
  it?: { kind: RoleKind; id: string };
  /** Weeks until the next performance review, when the caller knows it. */
  weeksToReview?: number;
}

const has = (o: object, key: string) => Object.hasOwn(o, key);

function kindOf(ctx: EvalContext, role: string, id: string): RoleKind | undefined {
  if (ctx.kinds && has(ctx.kinds, role)) return ctx.kinds[role];
  if (has(ctx.sim.people, id)) return 'person';
  if (has(ctx.sim.teams, id)) return 'team';
  if (has(ctx.sim.projects, id)) return 'project';
  return undefined;
}

/** Resolves a path such as `engineer.motivation`, `player.team`, `it.headcount` or `week`. */
function resolvePath(ctx: EvalContext, path: string): Value {
  if (path === 'week') return ctx.sim.week;
  if (path === 'review.weeksAway') return ctx.weeksToReview;
  const dot = path.indexOf('.');
  if (dot < 0) return undefined;
  const subject = path.slice(0, dot);
  const property = path.slice(dot + 1);
  if (subject === 'it' && ctx.it) return propertyValue(ctx.sim, ctx.it.kind, ctx.it.id, property);
  if (subject === 'player') return propertyValue(ctx.sim, 'player', '', property);
  if (!has(ctx.bindings, subject)) return undefined;
  const id = ctx.bindings[subject]!;
  const kind = kindOf(ctx, subject, id);
  return kind ? propertyValue(ctx.sim, kind, id, property) : undefined;
}

const isPath = (operand: Operand): operand is { value: string } =>
  typeof operand === 'object' && operand !== null && !Array.isArray(operand);

/** Ratings compare by scale position, everything else by value. */
function order(left: Value, right: Value): [number, number] | undefined {
  if (typeof left === 'number' && typeof right === 'number') return [left, right];
  if (typeof left === 'string' && typeof right === 'string') {
    const [a, b] = [ratingRank(left), ratingRank(right)];
    if (a >= 0 && b >= 0) return [a, b];
  }
  return undefined;
}

/** Finds the comparison operator in a condition that carries one. */
export function operatorOf(condition: object): Operator | undefined {
  return OPERATORS.find((op) => has(condition, op));
}

function compare(left: Value, op: Operator, operand: Operand, ctx: EvalContext): boolean {
  if (op === 'in') {
    if (left === undefined || !Array.isArray(operand)) return false;
    return operand.some((x) => x === left);
  }
  const right = isPath(operand) ? resolvePath(ctx, operand.value) : (operand as Value);
  if (left === undefined || right === undefined) return op === 'isNot';
  if (op === 'is') return left === right;
  if (op === 'isNot') return left !== right;
  const pair = order(left, right);
  if (!pair) return false;
  const [a, b] = pair;
  switch (op) {
    case 'below':
      return a < b;
    case 'atMost':
      return a <= b;
    case 'above':
      return a > b;
    case 'atLeast':
      return a >= b;
  }
}

function compareCount(n: number, condition: object, ctx: EvalContext): boolean {
  const op = operatorOf(condition);
  if (!op) return false;
  return compare(n, op, (condition as Record<Operator, Operand>)[op], ctx);
}

/** Whether a week falls within the last `withinWeeks` weeks; always when no window is given. */
const inWindow = (ctx: EvalContext, week: number, withinWeeks: number | undefined) =>
  withinWeeks === undefined || week > ctx.sim.week - withinWeeks;

function candidates(sim: SimState, kind: RoleKind): string[] {
  switch (kind) {
    case 'person':
      return Object.keys(sim.people).filter((id) => sim.people[id]!.status === 'active');
    case 'team':
      return Object.keys(sim.teams);
    case 'project':
      return Object.keys(sim.projects).filter((id) => sim.projects[id]!.status === 'active');
  }
}

/** Active people, existing teams or active projects of a kind, in id order. */
export const candidatesOf = (sim: SimState, kind: RoleKind) => candidates(sim, kind).sort();

/** Evaluates a condition against the simulation and engine state. Changes neither. */
// @spec SIT-COND-001, SIT-COND-002, SIT-COND-003, SIT-COND-004, SIT-COND-005, SIT-COND-007, SIT-COND-008, SIT-COND-009, SIT-COND-010, SIT-COND-011, SIT-COND-013
export function evaluateCondition(condition: Condition, ctx: EvalContext): boolean {
  const c = condition as Record<string, unknown>;
  if (has(c, 'all')) return (c.all as Condition[]).every((x) => evaluateCondition(x, ctx));
  if (has(c, 'any')) return (c.any as Condition[]).some((x) => evaluateCondition(x, ctx));
  if (has(c, 'not')) return !evaluateCondition(c.not as Condition, ctx);

  if (has(c, 'count')) {
    const { kind, where } = c.count as { kind: RoleKind; where?: Condition };
    const n = candidatesOf(ctx.sim, kind).filter((id) => !where || evaluateCondition(where, { ...ctx, it: { kind, id } })).length;
    return compareCount(n, c, ctx);
  }

  if (has(c, 'history')) {
    const id = has(ctx.bindings, c.history as string) ? ctx.bindings[c.history as string]! : undefined;
    const person = id !== undefined && has(ctx.sim.people, id) ? ctx.sim.people[id]! : undefined;
    if (!person) return false;
    const situation = c.situation as string | undefined;
    const choice = c.choice as string | undefined;
    const action = c.action as string | undefined;
    const ratings = c.rating as string[] | undefined;
    const n = person.history.filter(
      (h) =>
        (situation === undefined || (h.cause.kind === 'situation' && h.cause.situationId === situation)) &&
        (choice === undefined || (h.cause.kind === 'situation' && h.cause.choiceId === choice)) &&
        (action === undefined || (h.cause.kind === 'action' && h.cause.actionId === action)) &&
        (ratings === undefined || (h.rating !== undefined && ratings.includes(h.rating))) &&
        inWindow(ctx, h.week, c.withinWeeks as number | undefined),
    ).length;
    return compareCount(n, c, ctx);
  }

  if (has(c, 'presented')) {
    const n = ctx.engine.presentations.filter(
      (p) => p.situationId === c.presented && inWindow(ctx, p.week, c.withinWeeks as number | undefined),
    ).length;
    return compareCount(n, c, ctx);
  }

  if (has(c, 'value')) {
    const op = operatorOf(c);
    if (!op) return false;
    return compare(resolvePath(ctx, c.value as string), op, c[op] as Operand, ctx);
  }
  return false;
}
