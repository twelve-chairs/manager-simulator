import type { DirectorState } from '../director';
import type { CareerLevel } from '../../loop/types';
import { leaderOf } from '../org';
import type { SimState } from '../../sim';
import { setVpHabit } from './core';
import { goalViews } from './goals';
import { handoverChoices, takeOver } from './handover';
import { beginQuarter, chooseVp } from './moments';
import { endQuarter } from './quarter';
import { VP_LEVEL, afterAdvanceVp, assessVp, vpScorecard } from './review';
import type { VpMoment, VpState } from './types';
import { vpView } from './view';

/** Whether a moment can still be answered: what it is about is still there for its choices to act on. */
function answerable(level: VpState, sim: SimState, m: VpMoment): boolean {
  if (m.status !== 'open') return false;
  const active = (id?: string) => id !== undefined && sim.people[id]?.status === 'active';
  switch (m.kind) {
    case 'finalEvaluation':
    case 'dispute':
      return active(m.personId);
    case 'odds':
      return active(m.personId) && active(m.otherId) && sim.people[m.personId!]!.teamId !== null && sim.people[m.otherId!]!.teamId !== null;
    case 'newDirector':
      return sim.teams[m.divisionId!] !== undefined && leaderOf(sim, m.divisionId!) === null && level.arriving[m.divisionId!] === undefined;
    default:
      return true;
  }
}

/** The VP level as the turn loop sees it. */
// @spec VP-CONTRACT-001, VP-STATE-001, VP-VIS-005, VP-GOAL-002
export const vpLevel: CareerLevel<VpState> = {
  params: VP_LEVEL,
  start() {
    throw new Error('the VP level is reached by promotion, not started');
  },
  beginWeek: beginQuarter,
  moments: (level, sim) => level.moments.map((m) => ({ id: m.id, day: m.week * 5 + m.day, time: m.time, open: answerable(level, sim, m), title: m.title })),
  plan(level, sim, command) {
    if (typeof command !== 'object' || command === null || Array.isArray(command)) return { ok: false, error: 'a planning command must be an object' };
    const { kind, ...habit } = command as { kind?: unknown };
    if (kind !== 'habit') return { ok: false, error: `unknown planning command ${String(kind)}` };
    return setVpHabit(level, sim, habit);
  },
  choose: chooseVp,
  endWeek: endQuarter,
  afterAdvance: afterAdvanceVp,
  scorecard: vpScorecard,
  assess: assessVp,
  view: (level, sim) => vpView(level, sim, goalViews(level, sim)),
  handoverChoices: (previous, sim) => handoverChoices(previous as DirectorState, sim),
  takeOver: (previous, sim, choice) => takeOver(previous as DirectorState, sim, choice),
};
