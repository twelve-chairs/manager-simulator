import type { SimState, Want } from '../sim';

/** A promise the player can make someone: the history note that makes it, the notes that keep or break it, and how long it is remembered. */
export interface PromiseKind {
  id: string;
  /** The note added to the person's history when the promise is made. */
  made: string;
  /** The promise in words, as the recap lists it. */
  promise: string;
  kept: string[];
  broken: string[];
  /** Weeks after which an unanswered promise drops off the list. */
  lapseWeeks: number;
  /** A stay conversation's promise: it breaks when the person turns restless again. */
  breaksWhenRestless?: boolean;
}

/** What a stay conversation promises a restless leader, by what they want. */
export const STAY_PROMISES: Record<Want, string> = {
  growth: 'a bigger remit',
  recognition: 'their work in front of your own manager',
  stability: 'a steadier stretch',
  autonomy: 'a call of their own to make',
};

/** The promises the game remembers, each named by the note that makes it. */
// @spec UI-PROMISE-003
export const PROMISES: readonly PromiseKind[] = [
  { id: 'clean-up', made: 'Was promised a clean-up after the deadline', promise: 'a clean-up after the deadline', kept: ['Led a clean-up of the code'], broken: ['Heard the clean-up was put off again'], lapseWeeks: 26 },
  { id: 'reorg', made: "Was told there were reorg plans you couldn't share yet", promise: 'that they will hear first about the reorg', kept: [], broken: [], lapseWeeks: 26 },
  ...(Object.entries(STAY_PROMISES) as [Want, string][]).map(([want, promise]) => ({ id: `stay:${want}`, made: `Was promised ${promise}`, promise, kept: [], broken: [], lapseWeeks: 52, breaksWhenRestless: true })),
];

export interface PromiseLine {
  personId: string;
  name: string;
  promise: string;
  /** The kind of promise, as the table of promises names it. */
  kindId: string;
}

/** When a promise was last made to someone, and what answered it since: kept, broken, or their turning restless again. */
function promiseState(p: SimState['people'][string], kind: PromiseKind): { made: number; answered: { week: number; kept: boolean; restless: boolean } | null } | null {
  const made = p.history.findLast((h) => h.note === kind.made);
  if (!made) return null;
  const after = p.history.filter((h) => h.week >= made.week && h !== made && h.note !== undefined);
  const keptBy = after.find((h) => kind.kept.includes(h.note!));
  if (keptBy) return { made: made.week, answered: { week: keptBy.week, kept: true, restless: false } };
  const brokenBy = after.find((h) => kind.broken.includes(h.note!));
  if (brokenBy) return { made: made.week, answered: { week: brokenBy.week, kept: false, restless: false } };
  if (kind.breaksWhenRestless === true && p.restlessSince !== null && p.restlessSince > made.week) return { made: made.week, answered: { week: p.restlessSince, kept: false, restless: true } };
  return { made: made.week, answered: null };
}

/**
 * The player's promises as a turn that began at `since` ends: those still open, most recent first, with how long ago
 * each was made, and those kept or broken during the turn.
 */
// @spec UI-PROMISE-001, UI-PROMISE-002
export function promisesAt(sim: SimState, since: number): { open: (PromiseLine & { weeksAgo: number })[]; kept: PromiseLine[]; broken: (PromiseLine & { restless: boolean })[] } {
  const open: (PromiseLine & { weeksAgo: number })[] = [];
  const kept: PromiseLine[] = [];
  const broken: (PromiseLine & { restless: boolean })[] = [];
  for (const p of Object.values(sim.people)) {
    if (p.status !== 'active') continue;
    for (const kind of PROMISES) {
      const state = promiseState(p, kind);
      if (!state) continue;
      const line = { personId: p.id, name: p.name, promise: kind.promise, kindId: kind.id };
      if (state.answered === null) {
        if (sim.week - state.made <= kind.lapseWeeks) open.push({ ...line, weeksAgo: sim.week - state.made });
      } else if (state.answered.week >= since) {
        if (state.answered.kept) kept.push(line);
        else broken.push({ ...line, restless: state.answered.restless });
      }
    }
  }
  open.sort((a, b) => a.weeksAgo - b.weeksAgo || (a.personId < b.personId ? -1 : 1));
  return { open, kept, broken };
}
