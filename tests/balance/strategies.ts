import type { View } from '../../src/levels/line-manager';
import type { Command } from '../../src/loop';
import type { Moment, Seen, Strategy } from './harness';

/** The better choice in each line manager situation, as sound practice judges it. Onboarding situations have none. */
export const BETTER_CHOICES: Record<string, string> = {
  'flight-risk-1on1': 'ask',
  'feedback-gap': 'direct',
  'improvement-plan': 'real-plan',
  'quarterly-evaluation': 'honest',
  'incident-postmortem': 'blameless',
  'review-friction': 'separately',
  'promotion-case': 'write-it',
  'scope-creep': 'trade',
  'tech-debt-ask': 'sprint',
  'new-starter': 'buddy-up',
  'quiet-overload': 'time-off',
};

/** A band, as the view gives it: 2 is "okay" energy and "busy" stress. */
const OKAY = 2;

const habit = (name: string, value: string): Command => ({ kind: 'plan', command: { kind: 'habit', habit: name, value } });
const has = (m: Moment, id: string) => m.choices.some((c) => c.id === id);
const first = (m: Moment) => m.choices[0]!.id;
const last = (m: Moment) => m.choices.at(-1)!.id;
const isIntake = (m: Moment) => has(m, 'take');

/** Engineers in order of least stress, ties broken by id. */
const byStress = (view: View) => [...view.people].sort((a, b) => a.stress - b.stress || (a.id < b.id ? -1 : 1));

/** The offered give: or ask: choices, as engineer ids, least stressed first. */
function offered(seen: Seen, m: Moment, prefix: 'give:' | 'ask:'): View['people'] {
  const ids = new Set(m.choices.filter((c) => c.id.startsWith(prefix)).map((c) => c.id.slice(prefix.length)));
  return byStress(seen.view).filter((p) => ids.has(p.id));
}

export const idle: Strategy = { name: 'idle', naive: true, choose: () => 'wait' };

export const hero: Strategy = {
  name: 'hero',
  naive: true,
  habits: (seen) => (seen.week === 0 ? [habit('nightPages', 'me'), habit('approvals', 'me')] : []),
  choose(_, m) {
    if (m.source === 'situation' || m.kind === 'checkIn') return first(m);
    if (m.kind === 'onCall') return 'takeOver';
    if (isIntake(m)) return 'take';
    return 'self';
  },
};

export const delegator: Strategy = {
  name: 'delegator',
  naive: true,
  choose(seen, m) {
    if (m.source === 'situation' || m.kind === 'checkIn') return first(m);
    if (m.kind === 'onCall') return 'leave';
    if (isIntake(m)) return 'take';
    const prefix = m.kind === 'interview' ? 'ask:' : 'give:';
    const to = offered(seen, m, prefix)[0];
    return to ? `${prefix}${to.id}` : 'wait';
  },
};

export const contrarian: Strategy = {
  name: 'contrarian',
  naive: true,
  choose(_, m) {
    if (m.source === 'situation' || m.kind === 'checkIn') return last(m);
    if (m.kind === 'onCall') return 'leave';
    if (m.kind === 'interview') return 'skip';
    if (isIntake(m)) return 'decline';
    return 'pushBack';
  },
};

/** Habits a careful manager settles into: coach whoever a goal or their own want says to; routine approvals stay with them. */
function soundHabitChanges(seen: Seen): Command[] {
  const { view } = seen;
  const commands: Command[] = [];
  // A "Help <name> grow" goal names who to coach; the goal is in the view as text, as the player reads it.
  const goalPerson = view.people.find((p) => view.goals.some((g) => g.text === `Help ${p.name} grow`));
  const growth =
    goalPerson ?? view.people.find((p) => p.want === 'growth') ?? [...view.people].sort((a, b) => a.skill - b.skill || (a.id < b.id ? -1 : 1))[0];
  if (growth && view.habits.growth !== growth.id) commands.push(habit('growth', growth.id));
  return commands;
}

/** What a careful line manager does with what they can see; the rules are described in the balance design doc. */
function soundChoice(seen: Seen, m: Moment): string {
  const { view } = seen;
  const rested = view.player.energy >= OKAY;
  if (m.source === 'situation') return has(m, BETTER_CHOICES[m.situationId!] ?? '') ? BETTER_CHOICES[m.situationId!]! : first(m);
  if (m.kind === 'onCall') {
    const onCall = view.people.find((p) => p.id === m.personId);
    return onCall && m.difficulty !== undefined && onCall.skill >= m.difficulty ? 'leave' : 'backUp';
  }
  if (m.kind === 'checkIn') {
    const p = view.projects.find((x) => x.id === m.projectId);
    if (p && p.schedule !== 'onSchedule' && view.player.reputation >= OKAY) return 'cutScope';
    return rested ? 'replan' : 'pushOn';
  }
  if (m.kind === 'interview') {
    if (rested) return 'self';
    const asked = offered(seen, m, 'ask:')[0];
    return asked ? `ask:${asked.id}` : 'skip';
  }
  if (isIntake(m)) return view.projects.length < 2 && rested ? 'take' : 'decline';
  const givable = offered(seen, m, 'give:');
  const able = givable.find((p) => (m.difficulty === undefined || p.skill >= m.difficulty) && p.stress <= OKAY);
  if (able) return `give:${able.id}`;
  if (rested) return 'self';
  // Tired, with no one able: a stretch for someone with room lands part of the consequence; pushing back lands all of it.
  const stretch = givable.find((p) => p.stress <= OKAY);
  return stretch ? `give:${stretch.id}` : 'pushBack';
}

export const sound: Strategy = { name: 'sound', naive: false, habits: soundHabitChanges, choose: soundChoice };

/** Sound practice with 1:1s every week and light ceremonies: a measurement of how much the habits matter. */
export const soundHabits: Strategy = {
  name: 'sound-habits',
  naive: false,
  habits(seen) {
    const commands = soundHabitChanges(seen);
    if (seen.view.habits.oneOnOnes !== 'weekly') commands.push(habit('oneOnOnes', 'weekly'));
    if (seen.view.habits.ceremonies !== 'light') commands.push(habit('ceremonies', 'light'));
    return commands;
  },
  choose: soundChoice,
};

export const STRATEGIES: Strategy[] = [idle, hero, delegator, contrarian, sound, soundHabits];
