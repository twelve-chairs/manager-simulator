import { compareCodeUnits } from '../sim';
import {
  PERFORMANCE_LEVELS,
  WANTS as WANT_VALUES,
  behindScheduleProjects,
  contribution,
  correspondingRating,
  overdueProjects,
  planOf,
  teamSummary,
  type PerformanceLevel,
  type SimState,
} from '../sim';
import { PERSONALITIES } from '../personalities';
import type { RoleKind } from './types';

/** What a property's values are, which decides the operators and literals it can be compared with. */
export type PropertyType =
  | { kind: 'number' }
  | { kind: 'rating' }
  | { kind: 'boolean' }
  | { kind: 'id' }
  | { kind: 'enum'; name: string; values: readonly string[] };

export type Subject = RoleKind | 'player';
export type Value = number | string | boolean | undefined;

const NUMBER: PropertyType = { kind: 'number' };
const RATING: PropertyType = { kind: 'rating' };
const BOOLEAN: PropertyType = { kind: 'boolean' };
const ID: PropertyType = { kind: 'id' };
const enumOf = (name: string, values: readonly string[]): PropertyType => ({ kind: 'enum', name, values });

const WANTS = enumOf('want', WANT_VALUES);
const PLANS = enumOf('plan', ['none', 'coaching', 'pip', 'failedPip']);

const PROPERTIES: Record<Subject, Record<string, PropertyType>> = {
  person: {
    id: ID,
    skill: NUMBER,
    motivation: NUMBER,
    stress: NUMBER,
    trust: NUMBER,
    want: WANTS,
    personality: enumOf('personality', PERSONALITIES),
    role: enumOf('role', ['engineer', 'manager']),
    performance: RATING,
    plan: PLANS,
    contribution: NUMBER,
    correspondingRating: RATING,
    team: ID,
    ledTeam: ID,
    tenureWeeks: NUMBER,
    weeksSinceWantServed: NUMBER,
    lowMotivationWeeks: NUMBER,
    highStressWeeks: NUMBER,
  },
  team: {
    id: ID,
    form: enumOf('form', ['detailed', 'aggregate']),
    headcount: NUMBER,
    skill: NUMBER,
    motivation: NUMBER,
    stress: NUMBER,
    attritionRisk: NUMBER,
    ...Object.fromEntries(PERFORMANCE_LEVELS.map((level) => [`ratings.${level}`, NUMBER])),
    leader: ID,
    leaderless: BOOLEAN,
    troubled: BOOLEAN,
  },
  project: {
    id: ID,
    team: ID,
    progressShare: NUMBER,
    risk: NUMBER,
    techDebt: NUMBER,
    overdue: BOOLEAN,
    behind: BOOLEAN,
    weeksToDeadline: NUMBER,
    status: enumOf('status', ['active', 'completed', 'cancelled']),
  },
  player: {
    reputation: NUMBER,
    stress: NUMBER,
    performance: RATING,
    plan: PLANS,
    team: ID,
  },
};

/** The type of a subject's property, or undefined when the subject has no such property. */
export function propertyType(subject: Subject, property: string): PropertyType | undefined {
  return Object.hasOwn(PROPERTIES[subject], property) ? PROPERTIES[subject][property] : undefined;
}

export const WEEK_TYPE = NUMBER;

/** Rating order for comparisons: unrated sits below every rating. */
export const ratingRank = (level: string) => PERFORMANCE_LEVELS.indexOf(level as PerformanceLevel);

const ledTeam = (sim: SimState, personId: string) =>
  Object.keys(sim.teams)
    .sort(compareCodeUnits)
    .find((id) => {
      const leader = sim.teams[id]!.leader;
      return leader?.kind === 'person' && leader.id === personId;
    });

/** The value of a property of the entity with the given id, or undefined when it has none. */
// @spec SIT-COND-006, SIT-COND-012, SIT-COND-015
export function propertyValue(sim: SimState, subject: Subject, id: string, property: string): Value {
  switch (subject) {
    case 'person': {
      const p = sim.people[id];
      if (!p) return undefined;
      switch (property) {
        case 'id':
          return p.id;
        case 'skill':
        case 'motivation':
        case 'stress':
        case 'trust':
        case 'want':
        case 'personality':
        case 'role':
        case 'performance':
        case 'lowMotivationWeeks':
        case 'highStressWeeks':
          return p[property];
        case 'plan':
          return planOf(sim, { kind: 'person', id });
        case 'contribution':
          return contribution(sim, id) ?? undefined;
        case 'correspondingRating':
          return correspondingRating(sim, id) ?? undefined;
        case 'team':
          return p.teamId;
        case 'ledTeam':
          return ledTeam(sim, id);
        case 'tenureWeeks':
          return sim.week - p.joinedWeek;
        case 'weeksSinceWantServed':
          return sim.week - p.wantServedWeek;
      }
      return undefined;
    }
    case 'team': {
      const t = sim.teams[id];
      if (!t) return undefined;
      switch (property) {
        case 'id':
          return t.id;
        case 'form':
          return t.form;
        case 'leader':
          return t.leader?.kind === 'person' ? t.leader.id : undefined;
        case 'leaderless':
          return t.leader === null;
        case 'troubled':
          return t.leader === null || [...overdueProjects(sim), ...behindScheduleProjects(sim)].some((p) => p.teamId === id);
      }
      const summary = teamSummary(sim, id);
      if (property.startsWith('ratings.')) return summary.ratings[property.slice('ratings.'.length) as PerformanceLevel];
      switch (property) {
        case 'headcount':
        case 'skill':
        case 'motivation':
        case 'stress':
        case 'attritionRisk':
          return summary[property];
      }
      return undefined;
    }
    case 'project': {
      const p = sim.projects[id];
      if (!p) return undefined;
      switch (property) {
        case 'id':
          return p.id;
        case 'team':
          return p.teamId;
        case 'progressShare':
          return p.scope > 0 ? (p.progress / p.scope) * 100 : 0;
        case 'risk':
        case 'techDebt':
        case 'status':
          return p[property];
        case 'overdue':
          return overdueProjects(sim).some((x) => x.id === id);
        case 'behind':
          return behindScheduleProjects(sim).some((x) => x.id === id);
        case 'weeksToDeadline':
          return p.deadlineWeek - sim.week;
      }
      return undefined;
    }
    case 'player':
      switch (property) {
        case 'reputation':
        case 'stress':
        case 'performance':
          return sim.player[property];
        case 'plan':
          return planOf(sim, { kind: 'player' });
        case 'team':
          return Object.keys(sim.teams)
            .sort(compareCodeUnits)
            .find((tid) => sim.teams[tid]!.leader?.kind === 'player');
      }
      return undefined;
  }
}
