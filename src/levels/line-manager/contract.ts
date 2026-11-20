import type { SimState } from '../../sim';
import type { CareerLevel } from '../../loop/types';
import { isEngineer, subjectValid } from './core';
import { setHabit } from './habits';
import { chooseMoment } from './moments';
import { afterAdvance, assess, scorecard } from './review';
import { LEVEL, startRun } from './start';
import type { HabitId, LevelMoment, LineState } from './types';
import { describeMoment, view } from './view';
import { beginWeek, endWeek } from './week';

/** Whether a moment can still be answered: its work, vacancy and engineer on call are all still there. */
function answerable(level: LineState, sim: SimState, m: LevelMoment): boolean {
  if (m.status !== 'open') return false;
  if (m.kind === 'interview') return level.vacancies.some((v) => v.id === m.ref);
  if (m.kind === 'checkIn') return sim.projects[m.ref]?.status === 'active' && sim.projects[m.ref]!.teamId === level.teamId;
  const item = level.items.find((i) => i.id === m.ref);
  if (!item || !subjectValid(level, sim, item)) return false;
  return m.kind !== 'onCall' || isEngineer(level, sim, m.personId!);
}

/** The line manager level as the turn loop sees it. */
// @spec LINE-CONTRACT-005
export const lineManagerLevel: CareerLevel<LineState> = {
  params: LEVEL,
  start: startRun,
  beginWeek,
  moments: (level, sim) =>
    level.moments
      .filter((m) => m.week === sim.week)
      .map((m) => ({ id: m.id, day: m.day, time: m.time, open: answerable(level, sim, m), title: describeMoment(level, sim, m).title })),
  plan(level, sim, command) {
    // Commands can come back from a saved run, so their shape is checked rather than trusted.
    if (typeof command !== 'object' || command === null || Array.isArray(command)) return { ok: false, error: 'a planning command must be an object' };
    const c = command as { kind?: unknown; habit?: unknown; value?: unknown };
    if (c.kind !== 'habit') return { ok: false, error: `unknown planning command ${String(c.kind)}` };
    if (typeof c.habit !== 'string' || typeof c.value !== 'string') return { ok: false, error: 'a habit change names a habit and a setting' };
    return setHabit(level, sim, c.habit as HabitId, c.value);
  },
  choose: chooseMoment,
  endWeek,
  afterAdvance,
  scorecard,
  assess,
  view,
};
