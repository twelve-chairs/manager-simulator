import { create, type SimState } from '../../sim';
import { WANTS, atRiskRisk, calmRisk, generatePerson, generateProject, pick } from './core';
import { NAMES } from './names';
import type { CalendarEntry, LineState } from './types';

const TEAM_SIZE = 5;

/** Level parameters the turn loop reads. */
// @spec LINE-WEEK-001
export const LEVEL = { id: 'line-manager', weeksPerStep: 1, situationLimit: 2, reviewEveryWeeks: 13 } as const;

/** Generates the starting organization and level state from a seed. */
// @spec LINE-ORG-001, LINE-ORG-002, LINE-ORG-003, LINE-CAL-001, LINE-HIRE-001
export function startRun(seed: number): { sim: SimState; level: LineState } {
  const teamId = 't1';
  const level: LineState = {
    // A different multiplier from the simulation's and the situation engine's, so equal seeds start each generator elsewhere.
    rngState: Math.imul(seed >>> 0, 2654435789) >>> 0,
    teamId,
    targetHeadcount: TEAM_SIZE,
    calendar: [],
    inbox: [],
    vacancies: [],
    learnedWants: {},
    completions: {},
    burnoutWeeks: 0,
    counters: { entry: 0, demand: 0, vacancy: 0, person: 0, project: 0 },
  };

  const taken: string[] = [];
  const people = Array.from({ length: TEAM_SIZE }, () => {
    const p = generatePerson(level, taken);
    taken.push(p.name);
    return p;
  });
  // A team where everyone wants the same thing teaches nothing about wants.
  if (new Set(people.map((p) => p.want)).size === 1) people[1]!.want = WANTS[(WANTS.indexOf(people[0]!.want) + 1) % WANTS.length]!;

  const calm = generateProject(level, [], teamId, 0, calmRisk(level));
  const risky = generateProject(level, [calm.name], teamId, 0, atRiskRisk(level));

  const sim = create(seed, {
    player: { reputation: 50, stress: 30 },
    teams: [{ id: teamId, name: pick(level, NAMES.teams), leader: { kind: 'player' }, form: 'detailed' }],
    people: people.map((p) => ({ ...p, teamId })),
    projects: [calm, risky],
  });

  const entry = (e: Omit<CalendarEntry, 'id'>): CalendarEntry => {
    level.counters.entry += 1;
    return { id: `c${level.counters.entry}`, ...e };
  };
  level.calendar = [
    entry({ action: 'line-manager.ceremonies', target: { kind: 'team', id: teamId }, cadence: 'weekly', startWeek: 0 }),
    ...people.map((p, i) => entry({ action: 'line-manager.one-on-one', target: { kind: 'person', id: p.id }, cadence: 'biweekly', startWeek: i % 2 })),
  ];
  return { sim, level };
}
