import { create, type SimState } from '../../sim';
import { WANTS, atRiskRisk, calmRisk, generatePerson, generateProject, pick } from './core';
import { setGoals } from './goals';
import { DEFAULT_HABITS } from './habits';
import { NAMES } from './names';
import { PERSONALITIES } from '../../personalities';
import { LINE_TUNING } from './tuning';
import type { LineState } from './types';

const TEAM_SIZE = 5;

/** Level parameters the turn loop reads. */
// @spec LINE-WEEK-001
export const LEVEL = { id: 'line-manager', weeksPerStep: 1, situationLimit: 2, reviewEveryWeeks: LINE_TUNING.reviewEveryWeeks } as const;

/** Generates the starting organization and level state from a seed. */
// @spec LINE-ORG-001, LINE-ORG-002, LINE-ORG-003, LINE-ORG-004, LINE-HABIT-001, LINE-HIRE-001
export function startRun(seed: number): { sim: SimState; level: LineState } {
  const teamId = 't1';
  const level: LineState = {
    // A different multiplier from the simulation's and the situation engine's, so equal seeds start each generator elsewhere.
    rngState: Math.imul(seed >>> 0, 2654435789) >>> 0,
    teamId,
    targetHeadcount: TEAM_SIZE,
    habits: { ...DEFAULT_HABITS },
    items: [],
    moments: [],
    vacancies: [],
    learnedWants: {},
    completions: {},
    checkIns: {},
    burnoutWeeks: 0,
    goals: [],
    goalsPeriod: -1,
    habitNotes: [],
    weekStart: { week: -1, people: {} },
    counters: { item: 0, vacancy: 0, person: 0, project: 0, moment: 0, goal: 0 },
  };

  const taken: string[] = [];
  const people = Array.from({ length: TEAM_SIZE }, () => {
    const p = generatePerson(level, taken);
    taken.push(p.name);
    return p;
  });
  // A team where everyone wants the same thing teaches nothing about wants, and one of near-identical people is no cast.
  if (new Set(people.map((p) => p.want)).size === 1) people[1]!.want = WANTS[(WANTS.indexOf(people[0]!.want) + 1) % WANTS.length]!;
  for (let i = 1; i < people.length && new Set(people.map((p) => p.personality)).size < 3; i++) {
    const earlier = people.slice(0, i).map((p) => p.personality);
    if (earlier.includes(people[i]!.personality)) people[i]!.personality = PERSONALITIES.find((x) => !people.some((p) => p.personality === x))!;
  }

  const calm = generateProject(level, [], teamId, 0, calmRisk(level));
  const risky = generateProject(level, [calm.name], teamId, 0, atRiskRisk(level));

  const sim = create(seed, {
    player: { reputation: 50, stress: 30 },
    teams: [{ id: teamId, name: pick(level, NAMES.teams), leader: { kind: 'player' }, form: 'detailed' }],
    people: people.map((p) => ({ ...p, teamId })),
    projects: [calm, risky],
  });
  setGoals(level, sim);
  return { sim, level };
}
