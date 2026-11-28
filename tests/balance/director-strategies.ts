import type { Command } from '../../src/loop';
import type { DirectorMomentSeen, DirectorSeen, DirectorStrategy } from './director';
import { BETTER_CHOICES } from './strategies';
import { DIRECTOR_ISSUES } from '../../src/levels/director/moments';

const has = (m: DirectorMomentSeen, id: string) => m.choices.some((c) => c.id === id);
const first = (m: DirectorMomentSeen) => m.choices[0]?.id ?? 'wait';
const last = (m: DirectorMomentSeen) => m.choices.at(-1)?.id ?? 'wait';
const prefer = (m: DirectorMomentSeen, order: string[]) => order.find((id) => has(m, id)) ?? first(m);
/** A situation's better choice from the table, or its first choice when that one is not offered. */
const better = (m: DirectorMomentSeen) => {
  const id = BETTER_CHOICES[m.situationId ?? ''];
  return id && has(m, id) ? id : first(m);
};

/** Plan commands that set the director's habits, where they differ from what the view shows. */
function habits(seen: DirectorSeen, want: Partial<Record<'time' | 'staffMeeting' | 'listeningTour', string>>): Command[] {
  return Object.entries(want).flatMap(([habit, value]) => ((seen.view.habits as unknown as Record<string, string>)[habit] === value ? [] : [{ kind: 'plan' as const, command: { kind: 'habit', habit, value } }]));
}

/** The groups in order of their stress as last surveyed, calmest first, ties by id. */
const calmest = (seen: DirectorSeen) => [...seen.view.groups].sort((a, b) => a.stress - b.stress || (a.id < b.id ? -1 : 1)).map((g) => g.id);

export const directorIdle: DirectorStrategy = { name: 'idle', naive: true, choose: () => 'wait' };

export const directorHero: DirectorStrategy = {
  name: 'hero',
  naive: true,
  habits: (seen) => habits(seen, { time: 'upward' }),
  choose(seen, m) {
    if (m.source === 'situation') return first(m);
    if (m.kind === 'bets') {
      const groups = seen.view.groups.map((g) => g.id);
      return `fund:${JSON.stringify(Object.fromEntries((m.offers ?? []).slice(0, 2).map((o, i) => [o.id, groups[i % groups.length]])))}`;
    }
    return prefer(m, ['neediest', 'decide', 'agree', 'promise', 'hire', 'oneMore', 'leave', 'keep']);
  },
};

export const directorDelegator: DirectorStrategy = {
  name: 'delegator',
  naive: true,
  habits: (seen) => habits(seen, { time: 'organization', staffMeeting: 'fortnightly' }),
  choose: (_seen, m) => (m.source === 'situation' ? first(m) : prefer(m, ['spread', 'none', 'coach', 'agree', 'wins', 'promote', 'oneMore', 'leave', 'release'])),
};

export const directorContrarian: DirectorStrategy = {
  name: 'contrarian',
  naive: true,
  choose: (_seen, m) => (m.source === 'situation' ? last(m) : prefer(m, ['hold', 'none', 'replace', 'refuse', 'wins', 'hire', 'letGo', 'leave', 'release'])),
};

/** Sound practice at the director: the rules in the balance design. */
// @spec BAL-DIR-004
function soundChoice(seen: DirectorSeen, m: DirectorMomentSeen): string {
  if (m.source === 'situation') return better(m);
  if (m.kind === 'bets') {
    // The bet a group can carry: the least work per week to its deadline.
    const offer = [...(m.offers ?? [])].sort((a, b) => a.scope / a.deadlineWeeks - b.scope / b.deadlineWeeks)[0];
    const group = calmest(seen)[0];
    return offer && group ? `fund:${JSON.stringify({ [offer.id]: group })}` : 'none';
  }
  // Build a peer's trust before trading with them: negotiating with a peer who doesn't trust you costs more of it.
  if (m.kind === 'peerAsk') {
    const peer = seen.view.upward.find((u) => u.id === m.personId);
    return peer && peer.trust >= 3 ? 'negotiate' : 'agree';
  }
  // A problem above the senior manager is the director's to take: coaching them through it changes nothing.
  if (m.kind === 'surfaced' && DIRECTOR_ISSUES.some((x) => x.above && m.text.includes(x.text))) return 'decide';
  return prefer(m, ['spread', 'coach', 'straight', 'promote', 'letGo', 'splitPromote', 'merge', 'keep']);
}

export const directorSound: DirectorStrategy = { name: 'sound', naive: false, choose: soundChoice };

export const directorSoundTour: DirectorStrategy = { name: 'sound-tour', naive: false, habits: (seen) => habits(seen, { listeningTour: 'quarterly' }), choose: soundChoice };

export const DIRECTOR_STRATEGIES: DirectorStrategy[] = [directorIdle, directorHero, directorDelegator, directorContrarian, directorSound, directorSoundTour];
