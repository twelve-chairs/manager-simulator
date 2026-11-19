import type { SimState } from '../../sim';
import { invalidTarget } from './core';
import { ACTIONS } from './tuning';
import type { CalendarEntry, LineState, NewEntry } from './types';

const CADENCES = ['weekly', 'biweekly', 'once'];

/** Why an entry cannot be added, or undefined when it can. */
function invalidEntry(level: LineState, sim: SimState, entry: NewEntry): string | undefined {
  if (!Object.hasOwn(ACTIONS, entry.action)) return `unknown action ${String(entry.action)}`;
  const action = ACTIONS[entry.action];
  if (entry.target?.kind !== action.target) return `${entry.action} takes a ${action.target} target, not ${String(entry.target?.kind)}`;
  const reason = invalidTarget(level, sim, entry.target);
  if (reason) return `${entry.action}: ${reason}`;
  if (!CADENCES.includes(entry.cadence)) return `${entry.action}: unknown cadence ${String(entry.cadence)}`;
  if (action.oneOff && entry.cadence !== 'once') return `${entry.action} can only be scheduled for this week`;
  if (entry.startWeek !== undefined) {
    if (entry.cadence !== 'biweekly') return `${entry.action}: only an every-other-week entry takes a start week`;
    if (entry.startWeek !== sim.week && entry.startWeek !== sim.week + 1) return `${entry.action}: start week must be this week or next`;
  }
  return undefined;
}

/** Adds and removes calendar entries. */
// @spec LINE-CAL-004, LINE-CAL-009
export function editCalendar(
  level: LineState,
  sim: SimState,
  change: { add?: NewEntry[]; remove?: string[] },
): { ok: true; level: LineState } | { ok: false; error: string } {
  const next = structuredClone(level);
  for (const id of change.remove ?? []) {
    if (!next.calendar.some((e) => e.id === id)) return { ok: false, error: `no calendar entry ${id}` };
    next.calendar = next.calendar.filter((e) => e.id !== id);
  }
  for (const entry of change.add ?? []) {
    const error = invalidEntry(next, sim, entry);
    if (error) return { ok: false, error };
    next.counters.entry += 1;
    const added: CalendarEntry = {
      id: `c${next.counters.entry}`,
      action: entry.action,
      target: structuredClone(entry.target),
      cadence: entry.cadence,
      startWeek: entry.startWeek ?? sim.week,
    };
    next.calendar.push(added);
  }
  return { ok: true, level: next };
}
