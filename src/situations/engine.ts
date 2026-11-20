import { applyEffects, nextRandom as random, type Cause, type Effect, type SimState, type ValueTarget } from '../sim';
import { candidatesOf, evaluateCondition, type EvalContext } from './conditions';
import { render } from './text';
import { DAYS } from './types';
import type {
  DebriefRecord,
  EngineState,
  OpenPresentation,
  Presentation,
  ResolveResult,
  RoleKind,
  Situation,
  SituationEffect,
} from './types';

function shuffled<T>(s: EngineState, items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// @spec SIT-SEL-011, SIT-STATE-001
export function createEngine(seed: number): EngineState {
  // A different multiplier from the simulation's, so equal seeds do not start both generators in the same place.
  return { rngState: Math.imul(seed >>> 0, 2246822519) >>> 0, presentationCount: 0, presentations: [], open: [], debriefs: [] };
}

const kindsOf = (situation: Situation): Record<string, RoleKind> => Object.fromEntries(situation.roles.map((r) => [r.name, r.kind]));

/** What the caller knows about the game's calendar that the engine does not. */
export interface Timing {
  /** Weeks until the next performance review; content reads it as `review.weeksAway`. */
  weeksToReview?: number;
}

const ctxFor = (sim: SimState, engine: EngineState, situation: Situation, bindings: Record<string, string>, timing: Timing): EvalContext => ({
  sim,
  engine,
  bindings,
  kinds: kindsOf(situation),
  ...(timing.weeksToReview !== undefined && { weeksToReview: timing.weeksToReview }),
});

/**
 * Binds roles in order, trying each role's candidates in shuffled order and backtracking when a later role cannot bind.
 * Returns undefined when no complete binding exists.
 */
// @spec SIT-SEL-004, SIT-SEL-005, SIT-SEL-014
function bind(s: EngineState, sim: SimState, situation: Situation, excludedPeople: Set<string>, timing: Timing): Record<string, string> | undefined {
  const bindings: Record<string, string> = {};
  const used = new Set<string>();
  const step = (i: number): boolean => {
    const role = situation.roles[i];
    if (!role) return true;
    const key = (id: string) => `${role.kind}:${id}`;
    const candidates = candidatesOf(sim, role.kind).filter(
      (id) =>
        !used.has(key(id)) &&
        !(role.kind === 'person' && excludedPeople.has(id)) &&
        !(role.kind === 'team' && role.form && sim.teams[id]!.form !== role.form),
    );
    for (const id of shuffled(s, candidates)) {
      bindings[role.name] = id;
      if (role.where && !evaluateCondition(role.where, ctxFor(sim, s, situation, bindings, timing))) continue;
      used.add(key(id));
      if (step(i + 1)) return true;
      used.delete(key(id));
    }
    delete bindings[role.name];
    return false;
  };
  return step(0) ? bindings : undefined;
}

function pickWeighted(s: EngineState, pool: Situation[]): number {
  const total = pool.reduce((a, x) => a + (x.weight ?? 1), 0);
  let r = random(s) * total;
  for (let i = 0; i < pool.length; i++) {
    r -= pool[i]!.weight ?? 1;
    if (r < 0) return i;
  }
  return pool.length - 1;
}

function isEligible(s: EngineState, sim: SimState, situation: Situation, level: string, timing: Timing): boolean {
  if (!situation.levels.includes(level)) return false;
  const last = s.presentations.reduce<number | undefined>((w, p) => (p.situationId === situation.id && (w === undefined || p.week > w) ? p.week : w), undefined);
  if (situation.once && last !== undefined) return false;
  if (last !== undefined && sim.week - last < (situation.cooldownWeeks ?? 0)) return false;
  return !situation.when || evaluateCondition(situation.when, ctxFor(sim, s, situation, {}, timing));
}

/** Selects up to `limit` situations for the career level, closing any still open from an earlier selection as ignored. */
// @spec SIT-COND-014
// @spec SIT-SEL-001, SIT-SEL-002, SIT-SEL-003, SIT-SEL-006, SIT-SEL-007, SIT-SEL-008, SIT-SEL-009, SIT-SEL-010, SIT-SEL-012, SIT-SEL-013, SIT-SEL-015
// @spec SIT-STATE-002, SIT-STATE-003, SIT-STATE-005
export function selectSituations(
  engine: EngineState,
  sim: SimState,
  situations: Situation[],
  level: string,
  limit: number,
  timing: Timing = {},
): { engine: EngineState; presented: Presentation[] } {
  const s = structuredClone(engine);
  for (const o of s.open) s.debriefs.push({ week: o.week, situationId: o.situationId, bindings: o.bindings, status: 'ignored' });
  s.open = [];

  const presented: Presentation[] = [];
  if (!(limit > 0)) return { engine: s, presented };

  const eligible = situations.filter((x) => isEligible(s, sim, x, level, timing));
  const boundPeople = new Set<string>();
  for (const priority of ['urgent', 'normal'] as const) {
    const pool = eligible.filter((x) => x.priority === priority);
    while (pool.length > 0 && presented.length < limit) {
      const [situation] = pool.splice(pickWeighted(s, pool), 1) as [Situation];
      const bindings = bind(s, sim, situation, boundPeople, timing);
      if (!bindings) continue;

      // Record the presentation before offering choices, so conditions inside it count it as presented.
      s.presentations.push({ situationId: situation.id, week: sim.week });
      const ctx = ctxFor(sim, s, situation, bindings, timing);
      const kinds = kindsOf(situation);
      const choices = situation.choices
        .filter((c) => !c.availableIf || evaluateCondition(c.availableIf, ctx))
        .map((c) => ({ id: c.id, label: render(c.label, sim, bindings, kinds) }));
      if (choices.length === 0) {
        s.presentations.pop();
        continue;
      }

      s.presentationCount += 1;
      const id = `presentation-${s.presentationCount}`;
      s.open.push({ id, situationId: situation.id, week: sim.week, bindings });
      for (const role of situation.roles) if (role.kind === 'person') boundPeople.add(bindings[role.name]!);
      presented.push({ id, situationId: situation.id, bindings: { ...bindings }, day: 0, time: 'morning', text: render(situation.text, sim, bindings, kinds), choices });
    }
  }
  // Placed only once the selection is made, so authoring a situation's time never changes which situations are selected.
  for (const p of presented) {
    const situation = situations.find((x) => x.id === p.situationId)!;
    p.day = situation.day ? DAYS.indexOf(situation.day) : Math.floor(random(s) * DAYS.length);
    p.time = situation.time ?? (random(s) < 0.5 ? 'morning' : 'afternoon');
  }
  return { engine: s, presented };
}

function stillBound(sim: SimState, situation: Situation, bindings: Record<string, string>): boolean {
  return situation.roles.every((role) => {
    const id = bindings[role.name];
    if (id === undefined) return false;
    switch (role.kind) {
      case 'person':
        return sim.people[id]?.status === 'active';
      case 'team':
        return Object.hasOwn(sim.teams, id) && (!role.form || sim.teams[id]!.form === role.form);
      case 'project':
        return sim.projects[id]?.status === 'active';
    }
  });
}

/** Turns a situation effect into a core effect: role names become bound ids, and the cause is attached. */
function toCoreEffect(e: SituationEffect, bindings: Record<string, string>, kinds: Record<string, RoleKind>, cause: Cause): Effect {
  const id = (role: string) => bindings[role]!;
  switch (e.type) {
    case 'value': {
      const target: ValueTarget = e.target === 'player' ? { kind: 'player' } : { kind: kinds[e.target]!, id: id(e.target) };
      return { ...e, target, cause };
    }
    case 'rate':
      return { ...e, target: { kind: 'person', id: id(e.target) }, cause };
    case 'reRate':
      return { ...e, teamId: id(e.teamId), cause };
    case 'remove':
      return { ...e, personId: id(e.personId), cause };
    case 'move':
      return { ...e, personId: id(e.personId), teamId: id(e.teamId), cause };
    case 'setLeader':
      return { ...e, teamId: id(e.teamId), leader: e.leader === 'player' ? { kind: 'player' } : { kind: 'person', id: id(e.leader) }, cause };
    case 'reassignProject':
      return { ...e, projectId: id(e.projectId), teamId: id(e.teamId), cause };
    case 'cancelProject':
      return { ...e, projectId: id(e.projectId), cause };
  }
}

const error = (message: string): ResolveResult => ({ kind: 'error', message });

/** Applies the player's choice for an open presentation. */
// @spec SIT-RES-001, SIT-RES-002, SIT-RES-003, SIT-RES-004, SIT-RES-005, SIT-RES-006, SIT-RES-007, SIT-RES-008, SIT-RES-009, SIT-RES-010
// @spec SIT-STATE-002
export function resolveChoice(
  engine: EngineState,
  sim: SimState,
  situations: Situation[],
  presentationId: string,
  choiceId: string,
  timing: Timing = {},
): ResolveResult {
  const open: OpenPresentation | undefined = engine.open.find((o) => o.id === presentationId);
  if (!open) return error(`presentation ${presentationId} is not open`);
  const situation = situations.find((x) => x.id === open.situationId);
  if (!situation) return error(`situation ${open.situationId} is not in the loaded content`);

  const s = structuredClone(engine);
  s.open = s.open.filter((o) => o.id !== presentationId);
  const record = { week: open.week, situationId: open.situationId, bindings: { ...open.bindings } };

  if (!stillBound(sim, situation, open.bindings)) {
    const debrief: DebriefRecord = { ...record, status: 'expired' };
    s.debriefs.push(debrief);
    return { kind: 'expired', engine: s, sim, debrief };
  }

  const ctx = ctxFor(sim, engine, situation, open.bindings, timing);
  const choice = situation.choices.find((c) => c.id === choiceId);
  if (!choice) return error(`situation ${situation.id} has no choice ${choiceId}`);
  if (choice.availableIf && !evaluateCondition(choice.availableIf, ctx)) return error(`choice ${choiceId} of situation ${situation.id} is not offered`);

  const outcome = choice.outcomes.find((o) => !o.when || evaluateCondition(o.when, ctx))!;
  const kinds = kindsOf(situation);
  const cause: Cause = { kind: 'situation', situationId: situation.id, choiceId: choice.id };
  const applied = applyEffects(
    sim,
    outcome.effects.map((e) => toCoreEffect(e, open.bindings, kinds, cause)),
  );
  if (!applied.ok) {
    return error(`situation ${situation.id}, choice ${choice.id}, outcome ${outcome.id}: the simulation rejected effect ${applied.error.index}: ${applied.error.message}`);
  }

  // Rendered after the effects, so placeholders name where things stand now (a moved person's new team).
  const aftermath = render(outcome.aftermath, applied.state, open.bindings, kinds);
  const debrief: DebriefRecord = {
    ...record,
    status: 'resolved',
    choiceId: choice.id,
    outcomeId: outcome.id,
    aftermath,
    debrief: render(outcome.debrief, applied.state, open.bindings, kinds),
  };
  s.debriefs.push(debrief);
  return { kind: 'resolved', engine: s, sim: applied.state, log: applied.log, aftermath, debrief };
}

/** Debrief records from a game week on, in the order they were recorded. */
// @spec SIT-STATE-004
export function debriefsSince(engine: EngineState, week: number): DebriefRecord[] {
  return structuredClone(engine.debriefs.filter((r) => r.week >= week));
}
