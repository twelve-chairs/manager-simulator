import { nextRandom, type NewPerson, type NewProject, type SimState, type Want } from '../../sim';
import { NAMES } from './names';
import { LINE_TUNING } from './tuning';
import type { LineState, Target } from './types';

export const WANTS: readonly Want[] = ['growth', 'recognition', 'stability', 'autonomy'];

/** Draws from the level's own generator. */
export const random = (s: LineState): number => nextRandom(s);

export const randomInt = (s: LineState, min: number, max: number) => min + Math.floor(random(s) * (max - min + 1));
export const pick = <T>(s: LineState, items: readonly T[]): T => items[Math.floor(random(s) * items.length)]!;

/** Active engineers on the level's team, in id order. */
export const teamEngineers = (level: LineState, sim: SimState): string[] =>
  Object.keys(sim.people)
    .filter((id) => {
      const p = sim.people[id]!;
      return p.status === 'active' && p.teamId === level.teamId && p.role === 'engineer';
    })
    .sort();

/** Active projects on the level's team, in id order. */
export const teamProjects = (level: LineState, sim: SimState): string[] =>
  Object.keys(sim.projects)
    .filter((id) => sim.projects[id]!.status === 'active' && sim.projects[id]!.teamId === level.teamId)
    .sort();

/** Why a target is not valid now, or undefined when it is. */
export function invalidTarget(level: LineState, sim: SimState, target: Target): string | undefined {
  switch (target.kind) {
    case 'player':
      return undefined;
    case 'person':
      return teamEngineers(level, sim).includes(target.id) ? undefined : `${target.id} is no longer an active engineer on the team`;
    case 'team':
      return target.id === level.teamId ? undefined : `${target.id} is not the player's team`;
    case 'project':
      return teamProjects(level, sim).includes(target.id) ? undefined : `${target.id} is no longer an active project of the team`;
    case 'vacancy':
      return level.vacancies.some((v) => v.id === target.id) ? undefined : `vacancy ${target.id} is no longer open`;
  }
}

/** Opens or closes vacancies so that active engineers plus vacancies match the target headcount. */
// @spec LINE-HIRE-002
export function reconcileVacancies(level: LineState, sim: SimState) {
  const short = level.targetHeadcount - teamEngineers(level, sim).length;
  while (level.vacancies.length < short) {
    level.counters.vacancy += 1;
    level.vacancies.push({ id: `v${level.counters.vacancy}`, interviews: 0 });
  }
  if (level.vacancies.length > Math.max(0, short)) level.vacancies = level.vacancies.slice(0, Math.max(0, short));
}

/** A name from the list that is not taken; once the list runs out, a listed name with a number. */
function unusedName(level: LineState, list: readonly string[], taken: readonly string[], n: number): string {
  const free = list.filter((name) => !taken.includes(name));
  return free.length > 0 ? pick(level, free) : `${pick(level, list)} ${n}`;
}

export const peopleNames = (sim: SimState) => Object.values(sim.people).map((p) => p.name);
export const projectNames = (sim: SimState) => Object.values(sim.projects).map((p) => p.name);

/** A new engineer whose name nobody in `taken` has. */
export function generatePerson(level: LineState, taken: readonly string[]): NewPerson {
  level.counters.person += 1;
  return {
    id: `e${level.counters.person}`,
    name: unusedName(level, NAMES.people, taken, level.counters.person),
    role: 'engineer',
    skill: randomInt(level, 30, 80),
    motivation: randomInt(level, 40, 80),
    stress: randomInt(level, 15, 50),
    trust: randomInt(level, 40, 70),
    want: pick(level, WANTS),
  };
}

export function generateProject(level: LineState, taken: readonly string[], teamId: string, week: number, risk: number): NewProject {
  level.counters.project += 1;
  return {
    id: `pr${level.counters.project}`,
    name: unusedName(level, NAMES.projects, taken, level.counters.project),
    teamId,
    scope: randomInt(level, 80, 140),
    risk,
    techDebt: randomInt(level, 10, 50),
    deadlineWeek: week + randomInt(level, 20, 32),
  };
}

export const atRiskRisk = (level: LineState) => randomInt(level, LINE_TUNING.atRiskProjectRisk, 85);
export const calmRisk = (level: LineState) => randomInt(level, 5, LINE_TUNING.atRiskProjectRisk - 20);

/** Whether an entry runs in the given week. */
export const runsIn = (entry: { cadence: string; startWeek: number }, week: number) =>
  entry.cadence !== 'biweekly' || (week >= entry.startWeek && (week - entry.startWeek) % 2 === 0);
