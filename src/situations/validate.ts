import {
  AGGREGATE_TEAM_FIELDS,
  DEPARTURE_REASONS,
  DETAILED_TEAM_FIELDS,
  PERFORMANCE_LEVELS,
  PERSON_FIELDS,
  PLAYER_FIELDS,
  PROJECT_FIELDS,
  RATINGS,
  WANTS,
} from '../sim';
import { PLAYER_ACTION_IDS } from '../actions';
import { OPERATORS } from './conditions';
import { WEEK_TYPE, propertyType, type PropertyType } from './properties';
import { PLACEHOLDER, PLACEHOLDER_PROPERTIES } from './text';
import { DAYS, TIMES, type ContentError, type RoleKind, type Situation } from './types';

class Invalid extends Error {}

const fail = (path: string, problem: string): never => {
  throw new Invalid(path ? `${path}: ${problem}` : problem);
};

type Obj = Record<string, unknown>;

const isObject = (x: unknown): x is Obj => {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
  const proto = Object.getPrototypeOf(x);
  return proto === Object.prototype || proto === null;
};

const at = (path: string, key: string | number) => (typeof key === 'number' ? `${path}[${key}]` : path ? `${path}.${key}` : key);
const get = (o: Obj, key: string) => (Object.hasOwn(o, key) ? o[key] : undefined);

function object(x: unknown, path: string, what: string, required: readonly string[], optional: readonly string[] = []): Obj {
  if (!isObject(x)) fail(path, `must be ${what}`);
  const o = x as Obj;
  for (const key of Object.keys(o)) if (!required.includes(key) && !optional.includes(key)) fail(at(path, key), `not a field of ${what}`);
  for (const key of required) if (!Object.hasOwn(o, key)) fail(at(path, key), 'required');
  return o;
}

function string(o: Obj, key: string, path: string): string {
  const x = get(o, key);
  if (typeof x !== 'string') fail(at(path, key), 'must be text');
  return x as string;
}

function finite(o: Obj, key: string, path: string): number {
  const x = get(o, key);
  if (typeof x !== 'number' || !Number.isFinite(x)) fail(at(path, key), 'must be a number');
  return x as number;
}

function list(x: unknown, path: string): unknown[] {
  if (!Array.isArray(x)) fail(path, 'must be a list');
  return x as unknown[];
}

function oneOf<T extends string>(x: unknown, values: readonly T[], path: string, what: string): T {
  if (typeof x !== 'string' || !values.includes(x as T)) fail(path, `${String(x)} is not ${what} (${values.join(', ')})`);
  return x as T;
}

const KINDS: readonly RoleKind[] = ['person', 'team', 'project'];
const RESERVED = ['player', 'week', 'review', 'it'];
const ROLE_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/** The roles visible at a point in a situation, and the candidate inside a count. */
interface Scope {
  roles: Record<string, RoleKind>;
  /** The declared form of each team role that has one. */
  forms?: Record<string, string>;
  it?: RoleKind;
}

// ---- conditions ----

const describe = (t: PropertyType) => (t.kind === 'enum' ? `a ${t.name}` : t.kind === 'id' ? 'an id' : `a ${t.kind}`);

function pathType(path: unknown, scope: Scope, where: string): PropertyType {
  if (typeof path !== 'string') fail(where, 'a path must be text');
  const p = path as string;
  if (p === 'week') return WEEK_TYPE;
  if (p === 'review.weeksAway') return WEEK_TYPE;
  if (p === 'review' || p.startsWith('review.')) return fail(where, `review has no property ${p.slice('review.'.length) || '(none)'}; it has weeksAway`);
  const dot = p.indexOf('.');
  const subject = dot < 0 ? p : p.slice(0, dot);
  const property = dot < 0 ? '' : p.slice(dot + 1);
  let kind: RoleKind | 'player';
  if (subject === 'player') kind = 'player';
  else if (subject === 'it' && scope.it) kind = scope.it;
  else if (Object.hasOwn(scope.roles, subject)) kind = scope.roles[subject]!;
  else if (subject === 'it') return fail(where, 'it is only defined inside a count');
  else return fail(where, `unknown subject ${subject}: not player, week or a role bound here`);
  const type = propertyType(kind, property);
  if (!type) fail(where, `${subject} (${kind}) has no property ${property || '(none)'}`);
  return type!;
}

function checkLiteral(x: unknown, type: PropertyType, path: string, where: string) {
  switch (type.kind) {
    case 'number':
      if (typeof x !== 'number' || !Number.isFinite(x)) fail(where, `${path} is compared with ${String(x)}, which is not a number`);
      return;
    case 'boolean':
      if (typeof x !== 'boolean') fail(where, `${path} is compared with ${String(x)}, which is not true or false`);
      return;
    case 'rating':
      oneOf(x, PERFORMANCE_LEVELS, where, `a performance level for ${path}`);
      return;
    case 'enum':
      oneOf(x, type.values, where, `a ${type.name} for ${path}`);
      return;
    case 'id':
      fail(where, `${path} is an id and can only be compared with another path, not a literal`);
  }
}

const ORDERING = ['below', 'atMost', 'above', 'atLeast'];

/** Finds the one operator among a condition's keys, rejecting unknown keys. */
function operator(o: Obj, allowed: readonly string[], where: string) {
  const ops: string[] = [];
  for (const key of Object.keys(o)) {
    if ((OPERATORS as readonly string[]).includes(key)) ops.push(key);
    else if (!allowed.includes(key)) fail(where, `unknown operator ${key}`);
  }
  if (ops.length !== 1) fail(where, ops.length ? `has more than one operator (${ops.join(', ')})` : 'needs an operator');
  return ops[0]!;
}

function checkComparison(o: Obj, scope: Scope, where: string) {
  const op = operator(o, ['value'], where);
  const path = o.value as string;
  const left = pathType(path, scope, where);
  const operand = o[op];
  if (ORDERING.includes(op) && left.kind !== 'number' && left.kind !== 'rating') fail(where, `${op} cannot compare ${path}, which is ${describe(left)}`);
  if (op === 'in') {
    if (!Array.isArray(operand)) fail(where, `in needs a list, not ${JSON.stringify(operand)}`);
    for (const x of operand as unknown[]) checkLiteral(x, left, path, where);
    return;
  }
  if (isObject(operand)) {
    object(operand, where, 'a path operand', ['value']);
    const right = pathType(operand.value, scope, where);
    const same = left.kind === right.kind && (left.kind !== 'enum' || (right.kind === 'enum' && left.name === right.name));
    if (!same) fail(where, `${path} (${describe(left)}) cannot be compared with ${String(operand.value)} (${describe(right)})`);
    return;
  }
  checkLiteral(operand, left, path, where);
}

/** count, history and presented compare a number with a number. */
function checkCountOperand(o: Obj, form: string, allowed: readonly string[], where: string) {
  const op = operator(o, allowed, where);
  const operand = o[op];
  const numbers = op === 'in' ? list(operand, at(where, 'in')) : [operand];
  for (const x of numbers) if (typeof x !== 'number' || !Number.isFinite(x)) fail(at(where, op), `${form} is compared with ${String(x)}, which is not a number`);
}

function checkWindow(o: Obj, where: string) {
  if (Object.hasOwn(o, 'withinWeeks') && !(finite(o, 'withinWeeks', where) > 0)) fail(at(where, 'withinWeeks'), 'must be above 0');
}

/** How deeply `all`, `any`, `not` and `count` may nest; a cap keeps a malformed bundle from exhausting the stack. */
const MAX_CONDITION_DEPTH = 32;

function checkCondition(x: unknown, scope: Scope, where: string, depth = 0): void {
  if (!isObject(x)) fail(where, 'a condition must be an object');
  const o = x as Obj;
  const nested = ['all', 'any', 'not', 'count'].some((form) => Object.hasOwn(o, form));
  if (nested && depth >= MAX_CONDITION_DEPTH) fail(where, `conditions nest too deep (more than ${MAX_CONDITION_DEPTH} levels)`);
  if (Object.hasOwn(o, 'all') || Object.hasOwn(o, 'any')) {
    const form = Object.hasOwn(o, 'all') ? 'all' : 'any';
    object(o, where, `an ${form} condition`, [form]);
    list(o[form], at(where, form)).forEach((c, i) => checkCondition(c, scope, at(at(where, form), i), depth + 1));
    return;
  }
  if (Object.hasOwn(o, 'not')) {
    object(o, where, 'a not condition', ['not']);
    checkCondition(o.not, scope, at(where, 'not'), depth + 1);
    return;
  }
  if (Object.hasOwn(o, 'value')) return checkComparison(o, scope, where);
  if (Object.hasOwn(o, 'count')) {
    checkCountOperand(o, 'count', ['count'], where);
    const count = object(o.count, at(where, 'count'), 'a count', ['kind'], ['where']);
    const kind = oneOf(count.kind, KINDS, at(at(where, 'count'), 'kind'), 'a kind');
    if (Object.hasOwn(count, 'where')) checkCondition(count.where, { roles: scope.roles, it: kind }, at(at(where, 'count'), 'where'), depth + 1);
    return;
  }
  if (Object.hasOwn(o, 'history')) {
    checkCountOperand(o, 'history', ['history', 'situation', 'choice', 'action', 'note', 'rating', 'withinWeeks'], where);
    const role = o.history;
    if (typeof role !== 'string' || !Object.hasOwn(scope.roles, role) || scope.roles[role] !== 'person')
      fail(at(where, 'history'), `${String(role)} is not a person role bound here`);
    if (Object.hasOwn(o, 'situation')) string(o, 'situation', where);
    if (Object.hasOwn(o, 'choice')) string(o, 'choice', where);
    if (Object.hasOwn(o, 'action')) {
      const action = string(o, 'action', where);
      if (Object.hasOwn(o, 'situation') || Object.hasOwn(o, 'choice'))
        fail(at(where, 'action'), 'an action cannot be combined with a situation or choice; no history entry is caused by both');
      if (!PLAYER_ACTION_IDS.includes(action)) fail(at(where, 'action'), `${action} is not in the player action catalogue`);
    }
    // @spec SIT-CONTENT-028
    if (Object.hasOwn(o, 'note') && string(o, 'note', where) === '') fail(at(where, 'note'), 'must not be empty');
    if (Object.hasOwn(o, 'rating')) list(o.rating, at(where, 'rating')).forEach((r, i) => oneOf(r, RATINGS, at(at(where, 'rating'), i), 'a rating'));
    checkWindow(o, where);
    return;
  }
  if (Object.hasOwn(o, 'presented')) {
    checkCountOperand(o, 'presented', ['presented', 'choice', 'withinWeeks'], where);
    string(o, 'presented', where);
    if (Object.hasOwn(o, 'choice')) string(o, 'choice', where);
    checkWindow(o, where);
    return;
  }
  const keys = Object.keys(o);
  fail(where, `unknown condition form ${keys.length ? keys.join(', ') : '(empty)'}`);
}

// ---- text ----

function checkText(o: Obj, key: string, path: string, scope: Scope) {
  const text = string(o, key, path);
  for (const match of text.matchAll(PLACEHOLDER)) {
    const [role, property, ...rest] = match[1]!.split('.');
    if (!role || !Object.hasOwn(scope.roles, role)) fail(at(path, key), `placeholder ${match[0]} names unknown role ${role}`);
    const allowed = PLACEHOLDER_PROPERTIES[scope.roles[role!]!] ?? [];
    if (rest.length > 0 || (property !== undefined && !allowed.includes(property)))
      fail(at(path, key), `placeholder ${match[0]} names unknown property ${match[1]!.slice(role!.length + 1)}`);
  }
}

// ---- effects ----

/** A history note is shown on the person's card as written, so a placeholder in it would appear literally. */
// @spec SIT-CONTENT-027
/** Whether text holds a `{…}` placeholder: a brace with a closing brace after it. A scan, not a regex, so it stays linear. */
function hasPlaceholder(text: string): boolean {
  const open = text.indexOf('{');
  return open >= 0 && text.includes('}', open);
}

function historyNote(o: Obj, path: string) {
  string(o, 'historyNote', path);
  if (typeof o.historyNote === 'string' && hasPlaceholder(o.historyNote)) fail(at(path, 'historyNote'), 'must not contain a placeholder');
}

const TEAM_FIELDS = [...new Set([...DETAILED_TEAM_FIELDS, ...AGGREGATE_TEAM_FIELDS])];
const AGGREGATE_ONLY_FIELDS: readonly string[] = AGGREGATE_TEAM_FIELDS.filter((f) => !(DETAILED_TEAM_FIELDS as readonly string[]).includes(f));

/** Effects only an aggregate team accepts must name a team role declared `form: aggregate`. */
function requireAggregate(role: string, scope: Scope, path: string, what: string) {
  if (scope.forms?.[role] !== 'aggregate') fail(path, `${what} only applies to aggregate teams; give role ${role} form: aggregate`);
}
const FIELDS: Record<RoleKind | 'player', readonly string[]> = {
  person: PERSON_FIELDS,
  team: TEAM_FIELDS,
  project: PROJECT_FIELDS,
  player: PLAYER_FIELDS,
};

function roleOf(o: Obj, key: string, kind: RoleKind, scope: Scope, path: string) {
  const name = string(o, key, path);
  if (!Object.hasOwn(scope.roles, name)) fail(at(path, key), `${name} is not a role`);
  if (scope.roles[name] !== kind) fail(at(path, key), `${name} is a ${scope.roles[name]} role, not a ${kind} role`);
}

function checkWantTags(x: unknown, path: string) {
  const tags = object(x, path, 'want tags', [], ['serves', 'against']);
  for (const key of ['serves', 'against']) {
    if (Object.hasOwn(tags, key)) list(tags[key], at(path, key)).forEach((w, i) => oneOf(w, WANTS, at(at(path, key), i), 'a want'));
  }
}

function checkEffect(x: unknown, scope: Scope, path: string) {
  if (!isObject(x)) fail(path, 'an effect must be an object');
  const type = (x as Obj).type;
  switch (type) {
    case 'hire':
    case 'startProject':
      return fail(path, `situations cannot use ${type} effects; they are career-level actions`);
    case 'value': {
      const o = object(x, path, 'a value effect', ['type', 'target', 'field', 'amount'], ['wantTags', 'historyNote']);
      const target = string(o, 'target', path);
      let kind: RoleKind | 'player';
      if (target === 'player') kind = 'player';
      else if (Object.hasOwn(scope.roles, target)) kind = scope.roles[target]!;
      else return fail(at(path, 'target'), `${target} is not a role`);
      const field = string(o, 'field', path);
      if (!FIELDS[kind].includes(field)) fail(at(path, 'field'), `${kind} has no field ${field}`);
      if (kind === 'team' && AGGREGATE_ONLY_FIELDS.includes(field)) requireAggregate(target, scope, at(path, 'field'), `changing ${field}`);
      finite(o, 'amount', path);
      if (Object.hasOwn(o, 'wantTags')) checkWantTags(o.wantTags, at(path, 'wantTags'));
      if (Object.hasOwn(o, 'historyNote')) {
        historyNote(o, path);
        if (kind !== 'person') fail(at(path, 'historyNote'), 'history notes can only target a person');
      }
      return;
    }
    case 'rate': {
      const o = object(x, path, 'a rate effect', ['type', 'target', 'rating'], ['revision', 'historyNote']);
      if (o.target === 'player') fail(at(path, 'target'), 'situations cannot rate the player; only the performance review does');
      roleOf(o, 'target', 'person', scope, path);
      oneOf(o.rating, RATINGS, at(path, 'rating'), 'a rating');
      if (Object.hasOwn(o, 'revision') && typeof o.revision !== 'boolean') fail(at(path, 'revision'), 'must be true or false');
      if (Object.hasOwn(o, 'historyNote')) historyNote(o, path);
      return;
    }
    case 'reRate': {
      const o = object(x, path, 'a reRate effect', ['type', 'teamId', 'from', 'to', 'count']);
      roleOf(o, 'teamId', 'team', scope, path);
      requireAggregate(o.teamId as string, scope, at(path, 'teamId'), 're-rating');
      oneOf(o.from, PERFORMANCE_LEVELS, at(path, 'from'), 'a performance level');
      oneOf(o.to, RATINGS, at(path, 'to'), 'a rating');
      if (!Number.isInteger(o.count) || (o.count as number) < 1) fail(at(path, 'count'), 'must be a whole number of at least one');
      return;
    }
    case 'remove': {
      const o = object(x, path, 'a remove effect', ['type', 'personId', 'reason']);
      roleOf(o, 'personId', 'person', scope, path);
      oneOf(o.reason, DEPARTURE_REASONS, at(path, 'reason'), 'a departure reason');
      return;
    }
    case 'move': {
      const o = object(x, path, 'a move effect', ['type', 'personId', 'teamId']);
      roleOf(o, 'personId', 'person', scope, path);
      roleOf(o, 'teamId', 'team', scope, path);
      return;
    }
    case 'setLeader': {
      const o = object(x, path, 'a setLeader effect', ['type', 'teamId', 'leader']);
      roleOf(o, 'teamId', 'team', scope, path);
      if (o.leader !== 'player') roleOf(o, 'leader', 'person', scope, path);
      return;
    }
    case 'reassignProject': {
      const o = object(x, path, 'a reassignProject effect', ['type', 'projectId', 'teamId']);
      roleOf(o, 'projectId', 'project', scope, path);
      roleOf(o, 'teamId', 'team', scope, path);
      return;
    }
    case 'cancelProject': {
      const o = object(x, path, 'a cancelProject effect', ['type', 'projectId']);
      roleOf(o, 'projectId', 'project', scope, path);
      return;
    }
    default:
      fail(at(path, 'type'), `unknown effect type ${String(type)}`);
  }
}

// ---- situations ----

const SITUATION_FIELDS = ['id', 'title', 'levels', 'priority', 'roles', 'choices', 'text'] as const;
const OPTIONAL_SITUATION_FIELDS = ['weight', 'cooldownWeeks', 'personCooldownWeeks', 'once', 'quietWeek', 'when', 'day', 'time', 'waitDebrief'] as const;

/** The situation's own fields, before its roles: ids, levels, priority, cooldowns, when, day, time and the lesson for waiting. */
function checkSituationFields(o: Record<string, unknown>) {
  string(o, 'id', '');
  string(o, 'title', '');
  const levels = o.levels;
  if (!Array.isArray(levels) || !levels.every((l) => typeof l === 'string')) fail('levels', 'must be a list of level ids');
  oneOf(o.priority, ['urgent', 'normal'], 'priority', 'a priority');
  if (Object.hasOwn(o, 'weight') && !(finite(o, 'weight', '') > 0)) fail('weight', 'must be above 0');
  if (Object.hasOwn(o, 'cooldownWeeks') && finite(o, 'cooldownWeeks', '') < 0) fail('cooldownWeeks', 'must not be negative');
  if (Object.hasOwn(o, 'personCooldownWeeks') && finite(o, 'personCooldownWeeks', '') < 0) fail('personCooldownWeeks', 'must not be negative');
  if (Object.hasOwn(o, 'once') && typeof o.once !== 'boolean') fail('once', 'must be true or false');
  if (Object.hasOwn(o, 'quietWeek') && typeof o.quietWeek !== 'boolean') fail('quietWeek', 'must be true or false');
  if (Object.hasOwn(o, 'when')) checkCondition(o.when, { roles: {} }, 'when');
  if (Object.hasOwn(o, 'day')) oneOf(o.day, DAYS, 'day', 'a weekday');
  if (Object.hasOwn(o, 'time')) oneOf(o.time, TIMES, 'time', 'a time of day');
  // @spec SIT-CONTENT-026
  // No outcome bound the roles when a situation was let wait, so its lesson for waiting names no one.
  if (Object.hasOwn(o, 'waitDebrief')) {
    const lesson = o.waitDebrief;
    if (typeof lesson !== 'string' || lesson.trim() === '') fail('waitDebrief', 'must be a non-empty string');
    else if (hasPlaceholder(lesson)) fail('waitDebrief', 'must not contain a placeholder');
  }
}

/** The situation's roles, each checked against those before it: the scope its text, choices and effects are checked in. */
function checkRoles(o: Record<string, unknown>): Scope {
  const roles: Record<string, RoleKind> = {};
  const forms: Record<string, string> = {};
  list(o.roles, 'roles').forEach((r, i) => {
    const path = at('roles', i);
    const role = object(r, path, 'a role', ['name', 'kind'], ['form', 'where']);
    const name = string(role, 'name', path);
    if (!ROLE_NAME.test(name) || RESERVED.includes(name)) fail(at(path, 'name'), `${name} cannot be a role name`);
    if (Object.hasOwn(roles, name)) fail(at(path, 'name'), `duplicate role ${name}`);
    roles[name] = oneOf(role.kind, KINDS, at(path, 'kind'), 'a role kind');
    if (Object.hasOwn(role, 'form')) {
      if (roles[name] !== 'team') fail(at(path, 'form'), `only team roles have a form, and ${name} is a ${roles[name]} role`);
      forms[name] = oneOf(role.form, ['detailed', 'aggregate'], at(path, 'form'), 'a team form');
    }
    if (Object.hasOwn(role, 'where')) checkCondition(role.where, { roles: { ...roles } }, at(path, 'where'));
  });
  return { roles, forms };
}

/** One outcome of a choice: unique id, a when on every outcome but the last, its effects and its text. */
function checkOutcome(oc: unknown, opath: string, last: boolean, choiceId: string, outcomeIds: Set<string>, scope: Scope) {
  const outcome = object(oc, opath, 'an outcome', ['id', 'effects', 'aftermath', 'debrief'], ['when']);
  const outcomeId = string(outcome, 'id', opath);
  if (outcomeIds.has(outcomeId)) fail(at(opath, 'id'), `duplicate outcome id ${outcomeId} in choice ${choiceId}`);
  outcomeIds.add(outcomeId);
  if (last && Object.hasOwn(outcome, 'when')) fail(at(opath, 'when'), 'the last outcome cannot have a when; it applies when no other does');
  if (!last && !Object.hasOwn(outcome, 'when')) fail(at(opath, 'when'), 'required on every outcome but the last');
  if (!last) checkCondition(outcome.when, scope, at(opath, 'when'));
  list(outcome.effects, at(opath, 'effects')).forEach((e, k) => checkEffect(e, scope, at(at(opath, 'effects'), k)));
  checkText(outcome, 'aftermath', opath, scope);
  checkText(outcome, 'debrief', opath, scope);
}

/** One choice: unique id, its label, availability and at least one outcome. */
function checkChoice(ch: unknown, path: string, choiceIds: Set<string>, scope: Scope) {
  const choice = object(ch, path, 'a choice', ['id', 'label', 'outcomes'], ['availableIf']);
  const choiceId = string(choice, 'id', path);
  if (choiceIds.has(choiceId)) fail(at(path, 'id'), `duplicate choice id ${choiceId}`);
  choiceIds.add(choiceId);
  checkText(choice, 'label', path, scope);
  if (Object.hasOwn(choice, 'availableIf')) checkCondition(choice.availableIf, scope, at(path, 'availableIf'));
  const outcomes = list(choice.outcomes, at(path, 'outcomes'));
  if (outcomes.length === 0) fail(at(path, 'outcomes'), 'needs at least one outcome');
  const outcomeIds = new Set<string>();
  outcomes.forEach((oc, j) => checkOutcome(oc, at(at(path, 'outcomes'), j), j === outcomes.length - 1, choiceId, outcomeIds, scope));
}

function checkSituation(x: unknown): Situation {
  const o = object(x, '', 'a situation', SITUATION_FIELDS, OPTIONAL_SITUATION_FIELDS);
  checkSituationFields(o);
  const scope = checkRoles(o);
  checkText(o, 'text', '', scope);
  const choices = list(o.choices, 'choices');
  if (choices.length === 0) fail('choices', 'needs at least one choice');
  const choiceIds = new Set<string>();
  choices.forEach((ch, i) => checkChoice(ch, at('choices', i), choiceIds, scope));
  return structuredClone(o) as unknown as Situation;
}

export type ValidationResult = { ok: true; situation: Situation } | { ok: false; error: ContentError };

/** Validates each item of a bundle; results line up with the input. Executes nothing from the content. */
// @spec SIT-CONTENT-004, SIT-CONTENT-005, SIT-CONTENT-006, SIT-CONTENT-007, SIT-CONTENT-008, SIT-CONTENT-009, SIT-CONTENT-010
// @spec SIT-CONTENT-024, SIT-CONTENT-025
// @spec SIT-CONTENT-012, SIT-CONTENT-013, SIT-CONTENT-014, SIT-CONTENT-016, SIT-CONTENT-017, SIT-CONTENT-018, SIT-CONTENT-019
// @spec SIT-CONTENT-020, SIT-CONTENT-021, SIT-CONTENT-022, SIT-CONTENT-023
export function validateBundle(items: unknown[]): ValidationResult[] {
  const seen = new Set<string>();
  return items.map((item, index) => {
    const rawId = isObject(item) && typeof get(item, 'id') === 'string' ? (get(item, 'id') as string) : undefined;
    try {
      const situation = checkSituation(item);
      if (seen.has(situation.id)) fail('id', `duplicate id ${situation.id}`);
      seen.add(situation.id);
      return { ok: true, situation };
    } catch (e) {
      if (!(e instanceof Invalid)) throw e;
      return { ok: false, error: { ...(rawId !== undefined && { situationId: rawId }), index, message: e.message } };
    }
  });
}

/** Loads a content bundle (parsed or as JSON text), keeping the valid situations and reporting the rest. Never throws. */
// @spec SIT-CONTENT-003, SIT-CONTENT-011
export function loadContent(bundle: unknown): { situations: Situation[]; errors: ContentError[] } {
  let parsed = bundle;
  if (typeof bundle === 'string') {
    try {
      parsed = JSON.parse(bundle);
    } catch {
      return { situations: [], errors: [{ message: 'content bundle is not valid JSON' }] };
    }
  }
  if (!Array.isArray(parsed)) return { situations: [], errors: [{ message: 'content bundle must be a list of situations' }] };
  const results = validateBundle(parsed);
  return {
    situations: results.flatMap((r) => (r.ok ? [r.situation] : [])),
    errors: results.flatMap((r) => (r.ok ? [] : [r.error])),
  };
}
