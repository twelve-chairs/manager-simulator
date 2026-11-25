import type { Effect, SimState } from '../../sim';
import { action, isEngineer, listOf, nameOf, personEffect, playerEffect, projectEffect, teamEngineers, teamProjects } from './core';
import { HABIT_CAUSE, LINE_TUNING } from './tuning';
import type { HabitId, Habits, LevelResult, LineState } from './types';

const OPTIONS: Record<HabitId, readonly string[] | 'engineer'> = {
  nightPages: ['rotation', 'me', 'seniors', 'backup'],
  oneOnOnes: ['fortnightly', 'weekly', 'whenNeeded'],
  approvals: 'engineer',
  ceremonies: ['full', 'light'],
  growth: 'engineer',
};
/** The setting of a habit that names an engineer when it names nobody. */
const NOBODY = { approvals: 'me', growth: 'nobody' } as const;

export const DEFAULT_HABITS: Habits = { nightPages: 'rotation', oneOnOnes: 'fortnightly', approvals: 'me', ceremonies: 'full', growth: 'nobody' };

/** Changes one habit; moments already produced keep the choices they were made with. */
// @spec LINE-HABIT-002, LINE-HABIT-003
export function setHabit(level: LineState, sim: SimState, habit: HabitId, value: string): LevelResult<{ level: LineState }> {
  // Commands can come back from a saved run, so the habit and value are checked rather than trusted.
  if (typeof habit !== 'string' || !Object.hasOwn(OPTIONS, habit)) return { ok: false, error: `unknown habit ${String(habit)}` };
  if (typeof value !== 'string') return { ok: false, error: `${habit}: a habit setting must be a string` };
  const options = OPTIONS[habit];
  if (options === 'engineer') {
    if (value !== NOBODY[habit as keyof typeof NOBODY] && !isEngineer(level, sim, value)) return { ok: false, error: `${habit}: ${value} is not an active engineer on the team` };
  } else if (!options.includes(value)) return { ok: false, error: `${habit}: unknown option ${value}` };
  const s = structuredClone(level);
  (s.habits as unknown as Record<string, string>)[habit] = value;
  return { ok: true, level: s };
}

/** Sets a habit back to nobody when the engineer it names has left. Mutates `s`; returns what changed, for the recap. */
// @spec LINE-HABIT-004
export function fallBack(s: LineState, sim: SimState): string[] {
  const changes: string[] = [];
  if (s.habits.approvals !== NOBODY.approvals && !isEngineer(s, sim, s.habits.approvals)) {
    changes.push(`${nameOf(sim, s.habits.approvals)} has left, so routine approvals come back to you.`);
    s.habits.approvals = NOBODY.approvals;
  }
  if (s.habits.growth !== NOBODY.growth && !isEngineer(s, sim, s.habits.growth)) {
    changes.push(`${nameOf(sim, s.habits.growth)} has left, so nobody is your growth focus now.`);
    s.habits.growth = NOBODY.growth;
  }
  return changes;
}

/** Engineers due a 1:1 this week under the cadence. */
export function dueOneOnOnes(level: LineState, sim: SimState): string[] {
  const people = teamEngineers(level, sim);
  switch (level.habits.oneOnOnes) {
    case 'weekly':
      return people;
    case 'fortnightly':
      return people.filter((_, i) => i % 2 === sim.week % 2);
    case 'whenNeeded':
      return [];
  }
}

/** The weekly effects of 1:1s, ceremonies and the growth focus, with what each did for the recap. Records learned wants on `s`. */
// @spec LINE-HABIT-005, LINE-HABIT-012, LINE-HABIT-015, LINE-HABIT-016
export function habitEffects(s: LineState, sim: SimState): { effects: Effect[]; recap: string[] } {
  const t = LINE_TUNING.habits;
  const effects: Effect[] = [];
  const recap: string[] = [];

  const oneOnOne = action(HABIT_CAUSE.oneOnOnes);
  const met = dueOneOnOnes(s, sim);
  for (const id of met) {
    effects.push(
      personEffect(id, 'trust', t.oneOnOneTrust, oneOnOne, { note: '1:1' }),
      personEffect(id, 'motivation', t.oneOnOneMotivation, oneOnOne),
    );
    s.learnedWants[id] = { want: sim.people[id]!.want, week: sim.week };
  }
  if (met.length) effects.push(playerEffect('stress', met.length * t.oneOnOneStress, oneOnOne));
  recap.push(met.length ? `1:1s with ${listOf(met.map((id) => nameOf(sim, id)))}.` : 'No 1:1s this week.');

  const ceremonies = action(HABIT_CAUSE.ceremonies);
  if (s.habits.ceremonies === 'full') {
    for (const id of teamEngineers(s, sim)) effects.push(personEffect(id, 'motivation', t.ceremoniesMotivation, ceremonies, { serves: ['stability'] }));
    effects.push(playerEffect('stress', t.ceremoniesStress, ceremonies));
    recap.push('Stand-ups, planning and the retro ran in full.');
  } else {
    for (const id of teamProjects(s, sim)) effects.push(projectEffect(id, 'risk', t.lightCeremoniesRisk, ceremonies));
    recap.push('Ceremonies ran light: more time back, and less sense of where the projects stand.');
  }

  if (s.habits.growth !== 'nobody' && isEngineer(s, sim, s.habits.growth)) {
    const id = s.habits.growth;
    const growth = action(HABIT_CAUSE.growth);
    effects.push(personEffect(id, 'skill', t.coachingSkill, growth, { serves: ['growth'], note: 'Coaching' }), playerEffect('stress', t.coachingStress, growth));
    recap.push(`You coached ${nameOf(sim, id)}.`);
  }
  return { effects, recap };
}
