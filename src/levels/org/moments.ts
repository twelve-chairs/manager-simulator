import type { ChangeLogEntry, Effect, NewPerson, SimState, Want } from '../../sim';
import { STAY_PROMISES } from '../promises';
import { randomInt, rule, type Rng } from './core';
import { applyLogged } from './units';

/** Where in the quarter a moment falls: week of the quarter 0 to 12, day 0 (Monday) to 4, and time. */
export interface Slot {
  week: number;
  day: number;
  time: 'morning' | 'afternoon';
}

/**
 * Places a quarter's moments: the first ones fill its first week, the rest spread through it, and the closing one is
 * the last afternoon of the last week.
 */
export function placeMoments<D>(first: D[], rest: D[], closing: D): (D & Slot)[] {
  return [
    ...first.map((d, i): D & Slot => ({ ...d, week: Math.floor(i / 5), day: i % 5, time: 'morning' })),
    ...rest.map((d, i): D & Slot => ({ ...d, week: 1 + Math.floor((i * 11) / Math.max(1, rest.length)), day: i % 5, time: i % 2 ? 'afternoon' : 'morning' })),
    { ...closing, week: 12, day: 4, time: 'afternoon' },
  ];
}

/** What arriving leaders read and write in the level's state. */
export type Arrivals = Rng & { arriving: Record<string, number>; leniency: Record<string, number>; joined: string[] };

/** Leaders hired from outside arrive at units still without one; each gets a leniency from the level's generator. */
export function arrivals(s: Arrivals, sim: SimState, hire: (sim: SimState) => NewPerson, ruleId: string): Effect[] {
  const effects: Effect[] = [];
  for (const [g, since] of Object.entries(s.arriving)) {
    if (since > sim.week) continue;
    delete s.arriving[g];
    const leader = sim.teams[g]?.leader;
    if (!sim.teams[g] || (leader?.kind === 'person' && sim.people[leader.id]?.status === 'active')) continue;
    const person = hire(sim);
    s.leniency[person.id] = randomInt(s, [0, 2]);
    s.joined.push(person.id);
    effects.push({ type: 'hire', teamId: g, person, cause: rule(ruleId) });
  }
  return effects;
}

type Handled = { ok: true; sim: SimState; reaction: string };

/** A final evaluation: let the leader go, leaving their unit leaderless, or give them one more period. */
export function finalEvaluation(
  s: { heldEvaluations: string[]; letGo: string[] },
  sim0: SimState,
  lead: string,
  choiceId: string,
  words: { oneMore: string; letGo: string },
  actionId: string,
  log: ChangeLogEntry[],
): Handled {
  s.heldEvaluations = s.heldEvaluations.filter((id) => id !== lead);
  if (choiceId !== 'letGo') return { ok: true, sim: sim0, reaction: words.oneMore };
  const sim = applyLogged(sim0, [{ type: 'remove', personId: lead, reason: 'fired', cause: { kind: 'action', actionId } }], log, 'final evaluation');
  s.letGo.push(lead);
  return { ok: true, sim, reaction: words.letGo };
}

/**
 * A new leader for a unit without one: promote from inside, at a cost to the unit's skill, or hire from outside,
 * which leaves it leaderless one more quarter.
 */
export function newLeader(
  s: Rng & { arriving: Record<string, number>; leniency: Record<string, number>; joined: string[] },
  sim0: SimState,
  unitId: string,
  choiceId: string,
  how: { promote: (sim: SimState) => NewPerson; promoteSkill: number; actionId: string },
  log: ChangeLogEntry[],
): Handled & { promoted: NewPerson | null } {
  const { promote, promoteSkill, actionId } = how;
  if (choiceId !== 'promote') {
    s.arriving[unitId] = sim0.week;
    return { ok: true, sim: sim0, reaction: '', promoted: null };
  }
  const promoted = promote(sim0);
  const cause = { kind: 'action', actionId } as const;
  const sim = applyLogged(sim0, [{ type: 'hire', teamId: unitId, person: promoted, cause }, { type: 'value', target: { kind: 'team', id: unitId }, field: 'skill', amount: -promoteSkill, cause }], log, 'new leader');
  s.leniency[promoted.id] = randomInt(s, [0, 2]);
  s.joined.push(promoted.id);
  return { ok: true, sim, reaction: '', promoted };
}

/** What a restless leader says would keep them, in their own terms. */
export const STAY_WANT_WORDS: Record<Want, string> = {
  growth: 'room to grow, a bigger remit than the one they have',
  recognition: 'to be seen for what they do, by people above you',
  stability: 'a steadier stretch, without the next upheaval',
  autonomy: 'room to run things their own way',
};

/** Giving a restless leader what they want, as the stay conversation offers it. */
export const STAY_OFFERS: Record<Want, string> = {
  growth: 'Give them a stretch: a bigger remit, with you behind them',
  recognition: 'Put their work in front of your own manager, by name',
  stability: 'Promise them a steadier stretch, and keep it',
  autonomy: 'Hand them a call you have been keeping for yourself',
};

/** The leaders among these who are active and restless: their notice is running. */
export const restlessLeaders = (sim: SimState, ids: readonly (string | null)[]): string[] =>
  ids.filter((id): id is string => id !== null && sim.people[id]?.status === 'active' && sim.people[id].restlessSince !== null);

/** A stay conversation with a restless leader: what would keep them, and the two answers. */
export function stayDraft(sim: SimState, id: string): { title: string; text: string; choices: { id: string; label: string }[] } {
  const p = sim.people[id]!;
  return {
    title: `A stay conversation: ${p.name}`,
    text: `${p.name} has gone quiet, and you hear they have been talking to another company. You ask what would make them stay. They want ${STAY_WANT_WORDS[p.want]}.`,
    choices: [
      { id: 'keep', label: STAY_OFFERS[p.want] },
      { id: 'release', label: 'Wish them well, and plan for them leaving' },
    ],
  };
}

/** What the stay conversation costs and gives at a level. */
export interface StayTuning {
  energy: number;
  motivation: number;
  trust: number;
}

/**
 * Answers a stay conversation. Keeping them serves their want, which settles them, and costs the player energy; wishing
 * them well changes nothing, and they leave when their notice runs. Once they have gone, neither changes anything.
 */
export function stayAnswer(sim: SimState, id: string, choiceId: string, t: StayTuning, actionId: string): { effects: Effect[]; reaction: string } {
  const p = sim.people[id]!;
  // Someone the quarter already took away, by a choice or a situation, is past keeping.
  if (p.status !== 'active') return { effects: [], reaction: `${p.name} has already gone.` };
  if (choiceId !== 'keep') return { effects: [], reaction: `${p.name} thanks you for being straight. They will be gone within weeks.` };
  const cause = { kind: 'action', actionId } as const;
  const target = { kind: 'person', id } as const;
  return {
    effects: [
      { type: 'value', target, field: 'motivation', amount: t.motivation, cause, wantTags: { serves: [p.want] } },
      // The promise is remembered, so the recap can say whether it holds (UI-PROMISE-001).
      { type: 'value', target, field: 'trust', amount: t.trust, cause, historyNote: `Was promised ${STAY_PROMISES[p.want]}` },
      { type: 'value', target: { kind: 'player' }, field: 'stress', amount: t.energy, cause },
    ],
    reaction: `${p.name} hears it, and believes you. They stay.`,
  };
}
