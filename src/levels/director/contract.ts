import type { SeniorState } from '../senior-manager';
import type { CareerLevel } from '../../loop/types';
import type { SimState } from '../../sim';
import { leaderOf } from './core';
import { handoverChoices, takeOver } from './handover';
import { beginQuarter, chooseDirector } from './moments';
import { endQuarter, setDirectorHabit } from './quarter';
import { DIRECTOR_LEVEL, afterAdvanceDirector, assessDirector, directorScorecard } from './review';
import type { DirectorMoment, DirectorState } from './types';
import { directorView } from './view';

/** Whether a moment can still be answered: what it is about is still there for its choices to act on. */
function answerable(level: DirectorState, sim: SimState, m: DirectorMoment): boolean {
  if (m.status !== 'open') return false;
  const person = m.personId ? sim.people[m.personId] : undefined;
  const group = m.groupId ? sim.teams[m.groupId] : undefined;
  switch (m.kind) {
    case 'finalEvaluation':
    case 'peerAsk':
      return person?.status === 'active' && (m.kind !== 'peerAsk' || group !== undefined);
    case 'surfaced':
    case 'trouble':
      return person?.status === 'active' && group !== undefined && leaderOf(sim, m.groupId!) === m.personId;
    case 'newSenior':
      return group !== undefined && leaderOf(sim, m.groupId!) === null && level.arriving[m.groupId!] === undefined;
    case 'orgDesign':
      return group !== undefined && level.groupIds.includes(m.groupId!);
    default:
      return true;
  }
}

/** The director level as the turn loop sees it. */
// @spec DIR-CONTRACT-001, DIR-STATE-001
export const directorLevel: CareerLevel<DirectorState> = {
  params: DIRECTOR_LEVEL,
  start() {
    throw new Error('the director level is reached by promotion, not started');
  },
  beginWeek: beginQuarter,
  moments: (level, sim) => level.moments.map((m) => ({ id: m.id, day: m.week * 5 + m.day, time: m.time, open: answerable(level, sim, m), title: m.title })),
  plan(level, sim, command) {
    if (typeof command !== 'object' || command === null || Array.isArray(command)) return { ok: false, error: 'a planning command must be an object' };
    const { kind, ...habit } = command as { kind?: unknown };
    if (kind !== 'habit') return { ok: false, error: `unknown planning command ${String(kind)}` };
    return setDirectorHabit(level, sim, habit);
  },
  choose: chooseDirector,
  endWeek: endQuarter,
  afterAdvance: afterAdvanceDirector,
  scorecard: directorScorecard,
  assess: assessDirector,
  view: directorView,
  handoverChoices: (previous, sim) => handoverChoices(previous as SeniorState, sim),
  takeOver: (previous, sim, choice) => takeOver(previous as SeniorState, sim, choice),
};
