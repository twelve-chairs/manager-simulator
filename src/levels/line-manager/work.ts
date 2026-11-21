import type { Effect, SimState } from '../../sim';
import { band, playerEffect, personEffect, projectEffect, random, randomInt, rule, subjectValid, teamEngineers, teamProjects } from './core';
import { LINE_TUNING, WORK_KINDS } from './tuning';
import type { LineState, MomentChoice, WorkItem, WorkKind } from './types';

export const EXPIRED = rule('line-manager.work-expired');
export const FELL_SHORT = rule('line-manager.work-fell-short');

/** What each kind of work is called in moments and the recap. */
export const WORK_LABELS: Record<WorkKind, string> = {
  approval: 'release approval',
  expense: 'expense approval',
  designReview: 'design review',
  customerRequest: 'customer request',
  onCall: 'night page',
  workIntake: 'work intake',
};

/** How many items arrive at an expected rate: the whole part always, plus one more with the fractional part's chance. */
const count = (s: LineState, rate: number) => Math.floor(rate) + (random(s) < rate - Math.floor(rate) ? 1 : 0);

function addItem(level: LineState, sim: SimState, kind: WorkKind, subject: WorkItem['subject']) {
  level.counters.item += 1;
  const [low, high] = LINE_TUNING.difficultyRange;
  level.items.push({
    id: `w${level.counters.item}`,
    kind,
    subject,
    size: WORK_KINDS[kind].size,
    difficulty: randomInt(level, low, high),
    arrivedWeek: sim.week,
    lastWeek: sim.week + WORK_KINDS[kind].expiryWeeks,
  });
}

/** Drops items whose subject is gone, then adds the week's arrivals. Mutates `s`. */
// @spec LINE-INBOX-001, LINE-INBOX-002, LINE-INBOX-003, LINE-INBOX-010
export function arriveWork(s: LineState, sim: SimState) {
  s.items = s.items.filter((d) => subjectValid(s, sim, d));
  const projects = teamProjects(s, sim);
  // After a no, the next offer waits, so declining is not met with the same scene every week.
  const waiting = s.intakeDeclinedWeek !== null && sim.week - s.intakeDeclinedWeek <= LINE_TUNING.intakeWaitWeeks;
  if (projects.length < 2 && !waiting && !s.items.some((d) => d.kind === 'workIntake')) addItem(s, sim, 'workIntake', { kind: 'team', id: s.teamId });

  const rate = LINE_TUNING.arrivals;
  for (const id of projects) {
    const p = sim.projects[id]!;
    const subject = { kind: 'project' as const, id };
    const arrive = (kind: WorkKind, r: number) => {
      for (let i = count(s, r); i > 0; i--) addItem(s, sim, kind, subject);
    };
    arrive('approval', rate.approval);
    arrive('designReview', rate.designReview);
    arrive('customerRequest', rate.customerRequest);
    arrive('onCall', rate.onCallBase + (rate.onCallFromTrouble * (p.risk + p.techDebt)) / 200);
  }
  for (const id of teamEngineers(s, sim)) {
    if (random(s) < rate.expense) addItem(s, sim, 'expense', { kind: 'person', id });
  }
}

/** The consequence of an item left to expire, at full strength or scaled down for help that fell short. */
// @spec LINE-INBOX-009
export function consequence(item: WorkItem, scale: number, cause = EXPIRED): Effect[] {
  const x = LINE_TUNING.expiry;
  const n = (amount: number) => Math.round(amount * scale);
  const id = item.subject.id;
  switch (item.kind) {
    case 'approval':
      return [projectEffect(id, 'progress', n(x.approvalProgress), cause)];
    case 'designReview':
      return [projectEffect(id, 'techDebt', n(x.designReviewTechDebt), cause)];
    case 'customerRequest':
      return [playerEffect('reputation', n(x.customerRequestReputation), cause)];
    case 'onCall':
      return [playerEffect('reputation', n(x.onCallReputation), cause), projectEffect(id, 'risk', n(x.onCallRisk), cause)];
    case 'expense':
      return [personEffect(id, 'motivation', n(x.expenseMotivation), cause)];
    case 'workIntake':
      return [playerEffect('reputation', n(x.workIntakeReputation), cause)];
  }
}

/** The least stressed of the given engineers, ties broken by id. */
function leastStressed(sim: SimState, ids: string[]): string | undefined {
  return [...ids].sort((a, b) => sim.people[a]!.stress - sim.people[b]!.stress || (a < b ? -1 : 1))[0];
}

/** The choices a work moment offers: do it, a safe pair of hands, a stretch, or push back; take or decline for work intake. */
// @spec LINE-WORK-002
export function workChoices(level: LineState, sim: SimState, item: WorkItem): MomentChoice[] {
  if (item.kind === 'workIntake') return [{ id: 'take', label: 'Take it on' }, { id: 'decline', label: 'Decline' }];
  const needed = band(item.difficulty);
  const requester = item.subject.kind === 'person' ? item.subject.id : undefined;
  const candidates = teamEngineers(level, sim).filter((id) => id !== requester);
  const safe = leastStressed(sim, candidates.filter((id) => band(sim.people[id]!.skill) >= needed));
  const stretch = leastStressed(sim, candidates.filter((id) => band(sim.people[id]!.skill) < needed));
  return [
    { id: 'self', label: 'Do it yourself' },
    ...[safe, stretch].filter((id): id is string => id !== undefined).map((id) => ({ id: `give:${id}`, label: `Give it to ${sim.people[id]!.name}` })),
    { id: 'pushBack', label: 'Push back' },
  ];
}
