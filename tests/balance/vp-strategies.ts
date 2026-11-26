import type { Command } from '../../src/loop';
import { BETTER_CHOICES } from './strategies';
import type { VpMomentSeen, VpSeen, VpStrategy } from './vp';

const has = (m: VpMomentSeen, id: string) => m.choices.some((c) => c.id === id);
const first = (m: VpMomentSeen) => m.choices[0]?.id ?? 'wait';
const last = (m: VpMomentSeen) => m.choices.at(-1)?.id ?? 'wait';
const prefer = (m: VpMomentSeen, order: string[]) => order.find((id) => has(m, id)) ?? first(m);
const better = (m: VpMomentSeen) => {
  const id = BETTER_CHOICES[m.situationId ?? ''];
  return id && has(m, id) ? id : first(m);
};

/** Plan commands that set the VP's habits, where they differ from what the view shows. */
function habits(seen: VpSeen, want: Partial<Record<'firstTeam' | 'directors', string>>): Command[] {
  return Object.entries(want).flatMap(([habit, value]) => ((seen.view.habits as unknown as Record<string, string>)[habit] === value ? [] : [{ kind: 'plan' as const, command: { kind: 'habit', habit, value } }]));
}

/** Putting a named division on the company priority: the first offered, or the calmest as last surveyed. */
const firstDivision = (m: VpMomentSeen) => m.choices.find((c) => c.id.startsWith('one:'))?.id ?? 'spread';
function calmestDivision(seen: VpSeen, m: VpMomentSeen): string {
  const offered = new Set(m.choices.filter((c) => c.id.startsWith('one:')).map((c) => c.id.slice('one:'.length)));
  const calm = [...seen.view.divisions].filter((d) => offered.has(d.id)).sort((a, b) => a.stress - b.stress || (a.id < b.id ? -1 : 1))[0];
  return calm ? `one:${calm.id}` : 'spread';
}

export const vpIdle: VpStrategy = { name: 'idle', naive: true, choose: () => 'wait' };

export const vpHero: VpStrategy = {
  name: 'hero',
  naive: true,
  habits: (seen) => habits(seen, { firstTeam: 'function', directors: 'review' }),
  choose: (_seen, m) => {
    if (m.source === 'situation') return first(m);
    return m.kind === 'priority' ? firstDivision(m) : prefer(m, ['more', 'function', 'decide', 'across', 'celebrate', 'hire', 'oneMore']);
  },
};

export const vpDelegator: VpStrategy = {
  name: 'delegator',
  naive: true,
  choose: (_seen, m) => (m.source === 'situation' ? first(m) : prefer(m, ['plan', 'spread', 'company', 'together', 'across', 'short', 'promote', 'oneMore'])),
};

export const vpContrarian: VpStrategy = {
  name: 'contrarian',
  naive: true,
  habits: (seen) => habits(seen, { firstTeam: 'function' }),
  choose: (_seen, m) => (m.source === 'situation' ? last(m) : prefer(m, ['more', 'push', 'function', 'leave', 'waves', 'celebrate', 'hire', 'letGo'])),
};

/** Sound practice at the VP: the rules in the balance design. */
// @spec BAL-VP-004
function soundChoice(seen: VpSeen, m: VpMomentSeen): string {
  if (m.source === 'situation') return better(m);
  if (m.kind === 'priority') return calmestDivision(seen, m);
  // A trade works with a peer who trusts you; otherwise settle it on what the company needs.
  if (m.kind === 'dispute') return (seen.view.leadership.find((u) => u.id === m.personId)?.trust ?? 0) >= 3 ? 'trade' : 'company';
  return prefer(m, ['plan', 'together', 'once', 'truth', 'promote', 'letGo']);
}

const SOUND_HABITS = { firstTeam: 'leadership', directors: 'stepBack' } as const;

export const vpSound: VpStrategy = { name: 'sound', naive: false, habits: (seen) => habits(seen, SOUND_HABITS), choose: soundChoice };

export const vpSoundReview: VpStrategy = { name: 'sound-review', naive: false, habits: (seen) => habits(seen, { ...SOUND_HABITS, directors: 'review' }), choose: soundChoice };

export const VP_STRATEGIES: VpStrategy[] = [vpIdle, vpHero, vpDelegator, vpContrarian, vpSound, vpSoundReview];
