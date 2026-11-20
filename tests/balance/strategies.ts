import { ACTIONS, LINE_TUNING, type LinePlanCommand, type NewEntry, type View } from '../../src/levels/line-manager';
import type { Command } from '../../src/loop';
import type { Seen, Strategy } from './harness';

/** The better choice in each line manager situation, as sound practice judges it. Onboarding situations have none. */
export const BETTER_CHOICES: Record<string, string> = {
  'flight-risk-1on1': 'ask',
  'feedback-gap': 'direct',
  'improvement-plan': 'real-plan',
  'quarterly-evaluation': 'honest',
  'incident-2am': 'back-up',
  'review-friction': 'separately',
  'promotion-case': 'write-it',
  'scope-creep': 'trade',
  'tech-debt-ask': 'sprint',
  'new-starter': 'buddy-up',
  'quiet-overload': 'time-off',
};

const plan = (command: LinePlanCommand): Command => ({ kind: 'plan', command });
const MAX_HOURS = LINE_TUNING.weeklyHours + LINE_TUNING.overtimeCapHours;

/** Answers every open situation with the choice `pick` makes from those offered. */
const answer = (seen: Seen, pick: (situationId: string, choiceIds: string[]) => string): Command[] =>
  seen.presented
    .filter((p) => p.status === 'open')
    .map((p) => ({ kind: 'answer', presentationId: p.presentation.id, choiceId: pick(p.presentation.situationId, p.presentation.choices.map((c) => c.id)) }));

const requester = (d: View['inbox'][number]) => (d.subject.kind === 'person' ? d.subject.id : undefined);

/** Engineers in order of least stress, ties broken by id. */
const byStress = (view: View) => [...view.people].sort((a, b) => a.stress - b.stress || (a.id < b.id ? -1 : 1));

export const idle: Strategy = { name: 'idle', naive: true, play: () => [] };

export const hero: Strategy = {
  name: 'hero',
  naive: true,
  play(seen) {
    let hours = seen.view.plannedHours;
    const commands: Command[] = [];
    for (const d of seen.view.inbox) {
      if (hours + d.hours > MAX_HOURS) continue;
      hours += d.hours;
      commands.push(plan({ kind: 'decide', demandId: d.id, decision: d.type === 'workIntake' ? { kind: 'accept' } : { kind: 'handle' } }));
    }
    return [...commands, ...answer(seen, (_, choices) => choices[0]!)];
  },
};

export const delegator: Strategy = {
  name: 'delegator',
  naive: true,
  play(seen) {
    let hours = seen.view.plannedHours;
    const commands: Command[] = [];
    for (const d of seen.view.inbox) {
      if (d.type === 'workIntake') {
        if (hours + d.hours <= MAX_HOURS) {
          hours += d.hours;
          commands.push(plan({ kind: 'decide', demandId: d.id, decision: { kind: 'accept' } }));
        }
        continue;
      }
      const to = byStress(seen.view).find((p) => p.id !== requester(d));
      if (to) commands.push(plan({ kind: 'decide', demandId: d.id, decision: { kind: 'delegate', to: to.id } }));
    }
    return [...commands, ...answer(seen, (_, choices) => choices[0]!)];
  },
};

export const contrarian: Strategy = { name: 'contrarian', naive: true, play: (seen) => answer(seen, (_, choices) => choices.at(-1)!) };

/** What a careful line manager does with what they can see; the rules are described in the balance design doc. */
export const sound: Strategy = {
  name: 'sound',
  naive: false,
  play(seen) {
    const { view } = seen;
    const commands: Command[] = [];
    let hours = view.plannedHours;
    const budget = LINE_TUNING.weeklyHours;
    const add = (entry: NewEntry) => {
      const cost = ACTIONS[entry.action].hours;
      if (hours + cost > budget) return;
      hours += cost;
      commands.push(plan({ kind: 'calendar', add: [entry] }));
    };

    // Situations first: their choices apply at once and can change the team the plan is for.
    commands.push(...answer(seen, (id, choices) => (choices.includes(BETTER_CHOICES[id] ?? '') ? BETTER_CHOICES[id]! : choices[0]!)));

    // Inbox: on-call personally. Otherwise handle it yourself while your week has room, unless delegating it would
    // serve the person's want; once out of room, delegate within reach, spreading the load; leave the rest.
    const load = new Map<string, number>();
    const reach = (d: View['inbox'][number]) =>
      byStress(view).filter((p) => p.id !== requester(d) && p.skill >= d.difficulty && p.stress <= 2 && (load.get(p.id) ?? 0) < 2);
    const delegateTo = (d: View['inbox'][number], to: string) => {
      load.set(to, (load.get(to) ?? 0) + 1);
      commands.push(plan({ kind: 'decide', demandId: d.id, decision: { kind: 'delegate', to } }));
    };
    const handle = (d: View['inbox'][number]) => {
      hours += d.hours;
      commands.push(plan({ kind: 'decide', demandId: d.id, decision: d.type === 'workIntake' ? { kind: 'accept' } : { kind: 'handle' } }));
    };
    for (const d of view.inbox) {
      if (d.type === 'workIntake' || d.type === 'onCall') {
        if (hours + d.hours <= budget + (d.type === 'onCall' ? LINE_TUNING.overtimeCapHours : 0)) handle(d);
        continue;
      }
      const candidates = reach(d);
      const growing = candidates.find((p) => p.want === 'growth' || p.want === 'autonomy');
      if (growing) delegateTo(d, growing.id);
      else if (hours + d.hours <= budget) handle(d);
      else if (candidates[0]) delegateTo(d, candidates[0].id);
    }

    // Calendar: recover when stretched, interview for vacancies, plan risky projects, then serve known wants in turn.
    // Everyone gets a fortnightly 1:1, including people hired after the default calendar was set up.
    const withOneOnOne = new Set(view.calendar.filter((e) => e.action === 'line-manager.one-on-one' && e.cadence !== 'once').map((e) => ('id' in e.target ? e.target.id : '')));
    for (const p of view.people) if (!withOneOnOne.has(p.id)) add({ action: 'line-manager.one-on-one', target: { kind: 'person', id: p.id }, cadence: 'biweekly' });
    if (view.player.stress >= 3) add({ action: 'line-manager.recovery', target: { kind: 'player' }, cadence: 'once' });
    for (const v of view.vacancies) add({ action: 'line-manager.interview', target: { kind: 'vacancy', id: v.id }, cadence: 'once' });
    for (const p of view.projects) if (p.risk >= 3) add({ action: 'line-manager.project-planning', target: { kind: 'project', id: p.id }, cadence: 'once' });
    const people = view.people;
    if (people.length > 0) {
      const p = people[seen.week % people.length]!;
      const target = { kind: 'person' as const, id: p.id };
      if (p.want === 'growth') add({ action: 'line-manager.coaching', target, cadence: 'once' });
      if (p.want === 'recognition') add({ action: 'line-manager.recognition', target, cadence: 'once' });
    }
    if (view.people.some((p) => p.stress >= 3) && seen.week % 4 === 0) add({ action: 'line-manager.team-event', target: { kind: 'team', id: 't1' }, cadence: 'once' });
    return commands;
  },
};

export const STRATEGIES: Strategy[] = [idle, hero, delegator, contrarian, sound];
