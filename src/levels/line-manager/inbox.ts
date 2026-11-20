import type { SimState } from '../../sim';
import { random, randomInt, teamEngineers, teamProjects } from './core';
import { DEMAND_TYPES, LINE_TUNING } from './tuning';
import type { Demand, DemandType, LineState } from './types';

/** Whether a demand's subject still exists in a form it can be about. */
export function subjectValid(level: LineState, sim: SimState, demand: Demand): boolean {
  switch (demand.subject.kind) {
    case 'project':
      return teamProjects(level, sim).includes(demand.subject.id);
    case 'person':
      return teamEngineers(level, sim).includes(demand.subject.id);
    case 'team':
      return demand.subject.id === level.teamId;
  }
}

/** How many demands arrive at an expected rate: the whole part always, plus one more with the fractional part's chance. */
const count = (s: LineState, rate: number) => Math.floor(rate) + (random(s) < rate - Math.floor(rate) ? 1 : 0);

function addDemand(level: LineState, sim: SimState, type: DemandType, subject: Demand['subject']) {
  level.counters.demand += 1;
  const [low, high] = LINE_TUNING.difficultyRange;
  level.inbox.push({
    id: `d${level.counters.demand}`,
    type,
    subject,
    hours: DEMAND_TYPES[type].hours,
    difficulty: randomInt(level, low, high),
    arrivedWeek: sim.week,
    lastWeek: sim.week + DEMAND_TYPES[type].expiryWeeks,
  });
}

/** Adds this week's demands to the inbox, after dropping those whose subject is gone. */
// @spec LINE-INBOX-001, LINE-INBOX-002, LINE-INBOX-003, LINE-INBOX-010
export function arriveDemands(level: LineState, sim: SimState): LineState {
  const s = structuredClone(level);
  s.inbox = s.inbox.filter((d) => subjectValid(s, sim, d));
  const projects = teamProjects(s, sim);
  if (projects.length < 2 && !s.inbox.some((d) => d.type === 'workIntake')) addDemand(s, sim, 'workIntake', { kind: 'team', id: s.teamId });

  const chance = LINE_TUNING.arrivals;
  for (const id of projects) {
    const p = sim.projects[id]!;
    const subject = { kind: 'project' as const, id };
    const arrive = (type: DemandType, rate: number) => {
      for (let i = count(s, rate); i > 0; i--) addDemand(s, sim, type, subject);
    };
    arrive('approval', chance.approval);
    arrive('designReview', chance.designReview);
    arrive('customerRequest', chance.customerRequest);
    arrive('onCall', chance.onCallBase + (chance.onCallFromTrouble * (p.risk + p.techDebt)) / 200);
  }
  for (const id of teamEngineers(s, sim)) {
    if (random(s) < chance.expense) addDemand(s, sim, 'expense', { kind: 'person', id });
  }
  return s;
}
