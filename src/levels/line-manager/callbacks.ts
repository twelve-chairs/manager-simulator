import { compareCodeUnits, type SimState } from '../../sim';
import { LINE_TUNING } from './tuning';
import type { LineState } from './types';

/**
 * What a person says, or how they act, when a moment brings up a memory of the player, keyed by the memory's note.
 * Only memories a person would bring up are here: routine notes, such as a design review taken or a 1:1, are not.
 */
export const CALLBACKS: Readonly<Record<string, string>> = {
  'Handled a night page with you': '"Thanks again for sitting in on that page," says {name}.',
  'Handled a night page alone': '{name} brings up the night page they handled alone. "Am I always on my own for those?"',
  'You backed them on a call with an angry customer': '"You had my back with that customer," says {name}. "I haven\'t forgotten."',
  'Faced an angry customer alone': '{name} hasn\'t forgotten facing that angry customer on their own. You can hear it in how they say "sure".',
  'Was asked to explain the outage alone': '{name} has been careful around you since the postmortem where they stood up alone.',
  'Walked the team through their outage': '"That postmortem was easier than I expected," says {name}. "Thanks for keeping it about the system."',
  'Lost the top rating in calibration': '{name} still hasn\'t mentioned calibration. You can tell they haven\'t forgotten.',
  'Was rated down to make room for a colleague': '{name} is polite with you, and careful. They know whose rating paid for whose.',
  'You argued for them in calibration': '"I heard you stood up for me in calibration," says {name}.',
  'You wrote their promotion case': '"Whatever happens with the promotion, thanks for writing it up," says {name}.',
  'Their promotion case was put off': '"Any news on my promotion case?" asks {name}, not quite lightly.',
  'Took two weeks off': '{name} looks rested. "Those two weeks off were exactly what I needed."',
  'You asked them to put off their leave': '{name} mentions, in passing, the leave they still haven\'t taken.',
  'You insisted they take time off': '"I didn\'t want the time off," says {name}. "I\'m glad you made me."',
  'You backed their conference talk': '"The talk went better than I feared," says {name}. "Thanks for clearing the time."',
  'Prepared a talk on top of a full week': '{name} mentions the weekend they spent on that talk. Not bitterly. Not quite.',
  'Got straight feedback on their work': '"I\'ve been working on what you said," says {name}.',
  'Got specific feedback on their work': '"That feedback was useful," says {name}. "Specific. Thanks."',
  'You asked how they were finding things': '"Thanks for asking how I was doing, the other week," says {name}. "Nobody had."',
  'Talked about what they want from the job': '{name} brings up your talk about what would make the job worth staying for. They\'re waiting to see what changes.',
  'You signed off their hotel as an exception': '"Finance never even asked about that hotel," says {name}. "Thanks for writing it up."',
  'You explained the expense policy': '{name} mentions they booked early this time, inside the policy. "Lesson learned."',
  "Took over a contractor's work": '{name} is still the one everyone asks about the contractor\'s old code. They don\'t complain about it, much.',
  'Went to the team event the team picked': '"People are still talking about that team event," says {name}. "Good call letting us choose."',
  'Gave up a Friday evening for a team dinner': '{name} mentions the Friday dinner. Politely. They had other plans that night.',
  'Given one more quarter': '{name} knows this quarter is their last chance. It shows in how carefully they answer.',
};

/** Night pages' memories: a reaction to a night page never brings one up, since any line about the last page reads as an answer to this one. */
const NIGHT_PAGE_NOTES: ReadonlySet<string> = new Set(['Handled a night page with you', 'Handled a night page alone']);

/** The key a called-back memory is recorded by: the person, the week and the note. */
const keyOf = (personId: string, week: number, note: string) => `${personId}@${week}:${note}`;

/**
 * The line that brings up an engineer's most recent memory of the player, from the last weeks, that the table holds
 * and no reaction has called back; recorded in the level as called back. Read from the simulation before the choice,
 * so the choice's own memory is not brought up by it.
 */
// @spec LINE-WORK-006, LINE-WORK-007
export function callBack(level: LineState, sim: SimState, personId: string, onNightPage = false): string | null {
  const person = sim.people[personId];
  if (!person) return null;
  const since = sim.week - LINE_TUNING.callbackWeeks;
  for (const entry of [...person.history].reverse()) {
    if (entry.week < since) break;
    if (!entry.note || !Object.hasOwn(CALLBACKS, entry.note)) continue;
    if (onNightPage && NIGHT_PAGE_NOTES.has(entry.note)) continue;
    const key = keyOf(personId, entry.week, entry.note);
    if (level.calledBack.includes(key)) continue;
    level.calledBack.push(key);
    return CALLBACKS[entry.note]!.replaceAll('{name}', person.name);
  }
  return null;
}

/**
 * The one memory a recap brings up: across the team, the most recent entry from before this week and within the
 * callback window whose note the table holds and nothing has called back (ties broken by engineer id); recorded in the
 * level as called back.
 */
// @spec LINE-RECAP-006
export function recallInRecap(level: LineState, sim: SimState, engineers: readonly string[]): { personId: string; text: string } | null {
  const since = sim.week - LINE_TUNING.callbackWeeks;
  let best: { personId: string; week: number; note: string } | null = null;
  for (const personId of [...engineers].sort(compareCodeUnits)) {
    for (const entry of sim.people[personId]?.history ?? []) {
      if (entry.week < since || entry.week >= sim.week || !entry.note || !Object.hasOwn(CALLBACKS, entry.note)) continue;
      if (level.calledBack.includes(keyOf(personId, entry.week, entry.note))) continue;
      if (!best || entry.week > best.week) best = { personId, week: entry.week, note: entry.note };
    }
  }
  if (!best) return null;
  level.calledBack.push(keyOf(best.personId, best.week, best.note));
  return { personId: best.personId, text: CALLBACKS[best.note]!.replaceAll('{name}', sim.people[best.personId]!.name) };
}
