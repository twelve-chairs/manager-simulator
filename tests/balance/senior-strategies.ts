import { RATINGS, type Rating } from '../../src/sim';
import type { Command } from '../../src/loop';
import type { SeniorMoment, SeniorSeen, SeniorStrategy } from './senior';
import { BETTER_CHOICES } from './strategies';

type Counts = Record<Rating, number>;
/** The first choice the moment offers from an order of preference, or its first choice. */
const prefer = (m: SeniorMoment, order: string[]) => order.find((id) => m.choices.some((c) => c.id === id)) ?? m.choices[0]?.id ?? 'wait';

/** A situation's choice by position, for the naive strategies, which apply one rule whatever the scene. */
const first = (m: SeniorMoment) => m.choices[0]?.id ?? 'wait';
const last = (m: SeniorMoment) => m.choices.at(-1)?.id ?? 'wait';
/** A situation's better choice from the table, or its first choice when that one is not offered. */
const better = (m: SeniorMoment) => {
  const id = BETTER_CHOICES[m.situationId ?? ''];
  return id && m.choices.some((c) => c.id === id) ? id : first(m);
};

/** Plan commands that set every manager's oversight, and any other habits, where they differ from what the view shows. */
function habits(seen: SeniorSeen, oversight: string | null, rest: Record<string, string> = {}): Command[] {
  const out: Command[] = [];
  if (oversight) for (const m of seen.view.managers) if (seen.view.habits.oversight[m.id] !== oversight) out.push({ kind: 'plan', command: { kind: 'habit', habit: 'oversight', managerId: m.id, value: oversight } });
  for (const [habit, value] of Object.entries(rest)) if ((seen.view.habits as unknown as Record<string, string>)[habit] !== value) out.push({ kind: 'plan', command: { kind: 'habit', habit, value } });
  return out;
}

/** Moves, one rating at a time, that take a team's proposal down to `target`. */
function movesTo(proposed: Counts, target: Counts): { from: Rating; to: Rating; count: number }[] {
  const now = { ...proposed };
  const moves: { from: Rating; to: Rating; count: number }[] = [];
  for (let guard = 0; guard < 100; guard++) {
    const i = [...RATINGS.keys()].reverse().find((k) => now[RATINGS[k]!] > target[RATINGS[k]!] && k > 0);
    if (i === undefined) break;
    now[RATINGS[i]!] -= 1;
    now[RATINGS[i - 1]!] += 1;
    moves.push({ from: RATINGS[i]!, to: RATINGS[i - 1]!, count: 1 });
  }
  return moves;
}

/** Settles calibration on the evidence: every team's heads at what it delivered. */
const settleOnEvidence = (m: SeniorMoment) => `settle:${JSON.stringify(Object.fromEntries(m.calibration!.map((c) => [c.teamId, movesTo(c.proposed, c.delivered)])))}`;

/** Marks every team down a rating from its proposal. */
function markDown(m: SeniorMoment) {
  const moves = Object.fromEntries(
    m.calibration!.map((c) => [c.teamId, RATINGS.slice(1).flatMap((r, i) => (c.proposed[r] > 0 ? [{ from: r, to: RATINGS[i]!, count: c.proposed[r] }] : []))]),
  );
  return `settle:${JSON.stringify(moves)}`;
}

export const seniorIdle: SeniorStrategy = { name: 'idle', naive: true, choose: () => 'wait' };

export const seniorHero: SeniorStrategy = {
  name: 'hero',
  naive: true,
  habits: (seen) => habits(seen, 'close'),
  choose: (_seen, m) => m.source === 'situation' ? first(m) : prefer(m, ['stepIn', 'decide', 'spread', 'approve', 'acceptAll', 'hire', 'oneMorePeriod', 'decline']),
};

export const seniorDelegator: SeniorStrategy = {
  name: 'delegator',
  naive: true,
  habits: (seen) => habits(seen, 'handsOff'),
  choose: (_seen, m) => m.source === 'situation' ? first(m) : prefer(m, ['letThem', 'letRun', 'give', 'move', 'approve', 'acceptAll', 'hire', 'oneMorePeriod']),
};

export const seniorContrarian: SeniorStrategy = {
  name: 'contrarian',
  naive: true,
  choose: (_seen, m) => (m.source === 'situation' ? last(m) : m.kind === 'calibration' ? markDown(m) : prefer(m, ['decline', 'refuse', 'decide', 'letThem', 'hire', 'letGo'])),
};

/** Sound practice at the senior manager: the rules in the balance design. */
// @spec BAL-SENIOR-008
const soundChoice = (_seen: SeniorSeen, m: SeniorMoment) =>
  m.source === 'situation' ? better(m) : m.kind === 'calibration' ? settleOnEvidence(m) : prefer(m, ['coach', 'move', 'agree', 'give', 'evidence', 'promoteFromTeam', 'letGo']);

export const seniorSound: SeniorStrategy = { name: 'sound', naive: false, habits: (seen) => habits(seen, null, { newWork: 'assign' }), choose: soundChoice };

export const seniorSoundSkip: SeniorStrategy = { name: 'sound-skip', naive: false, habits: (seen) => habits(seen, null, { skipLevel: 'monthly', newWork: 'assign' }), choose: soundChoice };

export const SENIOR_STRATEGIES: SeniorStrategy[] = [seniorIdle, seniorHero, seniorDelegator, seniorContrarian, seniorSound, seniorSoundSkip];
