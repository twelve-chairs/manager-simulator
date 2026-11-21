import { compareCodeUnits } from '../../sim';
import { nextRandom, type Cause, type Effect, type NewPerson, type NewProject, type SimState, type Want } from '../../sim';
import { NAMES } from './names';
import { PERSONALITIES } from '../../personalities';
import { LINE_TUNING } from './tuning';
import type { LineState, WorkItem } from './types';

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
    .sort(compareCodeUnits);

/** Active projects on the level's team, in id order. */
export const teamProjects = (level: LineState, sim: SimState): string[] =>
  Object.keys(sim.projects)
    .filter((id) => sim.projects[id]!.status === 'active' && sim.projects[id]!.teamId === level.teamId)
    .sort(compareCodeUnits);

export const isEngineer = (level: LineState, sim: SimState, id: string) => teamEngineers(level, sim).includes(id);

/** Whether a work item's subject still exists in a form it can be about. */
// @spec LINE-INBOX-010
export function subjectValid(level: LineState, sim: SimState, item: WorkItem): boolean {
  switch (item.subject.kind) {
    case 'project':
      return teamProjects(level, sim).includes(item.subject.id);
    case 'person':
      return teamEngineers(level, sim).includes(item.subject.id);
    case 'team':
      return item.subject.id === level.teamId;
  }
}

/** Opens vacancies until active engineers plus vacancies reach the target headcount. */
// @spec LINE-HIRE-002
export function reconcileVacancies(level: LineState, sim: SimState) {
  const short = level.targetHeadcount - teamEngineers(level, sim).length;
  while (level.vacancies.length < short) {
    level.counters.vacancy += 1;
    level.vacancies.push({ id: `v${level.counters.vacancy}`, interviews: 0 });
  }
}

/** An unused name from the list; once all are taken, a listed name with the lowest number from 2 that makes it unused. */
// @spec LINE-ORG-002
function unusedName(level: LineState, list: readonly string[], taken: readonly string[]): string {
  for (let n = 1; ; n++) {
    const free = list.map((name) => (n === 1 ? name : `${name} ${n}`)).filter((name) => !taken.includes(name));
    if (free.length > 0) return pick(level, free);
  }
}

export const peopleNames = (sim: SimState) => Object.values(sim.people).map((p) => p.name);
export const projectNames = (sim: SimState) => Object.values(sim.projects).map((p) => p.name);

/** A new engineer with a personality, whose name nobody in `taken` has. */
// @spec LINE-ORG-004
export function generatePerson(level: LineState, taken: readonly string[]): NewPerson {
  level.counters.person += 1;
  return {
    id: `e${level.counters.person}`,
    name: unusedName(level, NAMES.people, taken),
    role: 'engineer',
    skill: randomInt(level, 30, 80),
    motivation: randomInt(level, 40, 80),
    stress: randomInt(level, 15, 50),
    trust: randomInt(level, 40, 70),
    want: pick(level, WANTS),
    personality: pick(level, PERSONALITIES),
  };
}

export function generateProject(level: LineState, taken: readonly string[], teamId: string, week: number, risk: number): NewProject {
  level.counters.project += 1;
  return {
    id: `pr${level.counters.project}`,
    name: unusedName(level, NAMES.projects, taken),
    teamId,
    scope: randomInt(level, 80, 140),
    risk,
    techDebt: randomInt(level, 10, 50),
    deadlineWeek: week + randomInt(level, 20, 32),
  };
}

export const atRiskRisk = (level: LineState) => randomInt(level, LINE_TUNING.atRiskProjectRisk, 85);
export const calmRisk = (level: LineState) => randomInt(level, 5, LINE_TUNING.atRiskProjectRisk - 20);

export const action = (actionId: string): Cause => ({ kind: 'action', actionId });
export const rule = (ruleId: string): Cause => ({ kind: 'rule', ruleId });

export const personEffect = (id: string, field: string, amount: number, cause: Cause, extra: { serves?: Want[]; note?: string } = {}): Effect => ({
  type: 'value',
  target: { kind: 'person', id },
  field,
  amount,
  cause,
  ...(extra.serves && { wantTags: { serves: extra.serves } }),
  ...(extra.note && { historyNote: extra.note }),
});
export const projectEffect = (id: string, field: string, amount: number, cause: Cause): Effect => ({ type: 'value', target: { kind: 'project', id }, field, amount, cause });
export const playerEffect = (field: string, amount: number, cause: Cause): Effect => ({ type: 'value', target: { kind: 'player' }, field, amount, cause });

/** Joins names into a phrase: "Ada", "Ada and Carmen", "Ada, Carmen and Dario". */
export function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export const nameOf = (sim: SimState, id: string) => sim.people[id]?.name ?? id;

/** The band a 0–100 value falls in; every banded value uses this one scale. */
// @spec LINE-VIS-009
export const band = (value: number): number => LINE_TUNING.bandEdges.filter((edge) => value >= edge).length;
