/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { realContent, summarize, table, type Summary } from './harness';
import { VP_BALANCE_TUNING, playVpRun, type VpSeen, type VpStrategy } from './vp';
import { VP_STRATEGIES, vpContrarian, vpHero, vpIdle, vpSound } from './vp-strategies';

const CONTENT = realContent();
const SEEDS = Array.from({ length: Number(process.env.BALANCE_SEEDS ?? 40) }, (_, i) => i + 1);
const T = VP_BALANCE_TUNING;

let summaries: Summary[] | undefined;
/** Every VP strategy over every seed, played once and shared by the checks. */
function measure(): Summary[] {
  summaries ??= VP_STRATEGIES.map((s) => summarize(s as never, SEEDS.map((seed) => playVpRun(s, seed, CONTENT))));
  return summaries;
}
const of = (name: string) => measure().find((s) => s.strategy === name)!;
const naive = () => measure().filter((s) => s.naive);

describe('playing VP runs', () => {
  // @spec BAL-VP-001
  it('starts the VP from outside hires at all three promotions and plays up to 12 quarters, acknowledging reviews', () => {
    const r = playVpRun(vpIdle, 1, CONTENT);
    expect(r.quarters).toBeGreaterThan(0);
    expect(r.quarters).toBeLessThanOrEqual(T.quarters);
    expect(r.ratings.length).toBeLessThanOrEqual(6);
    if (r.ending === null) expect(r.quarters).toBe(T.quarters);
  });

  // @spec BAL-VP-002
  it('shows a strategy only the view and the quarter’s moments, and fails with strategy, seed and quarter on a refused command', () => {
    const seen: VpSeen[] = [];
    const spy: VpStrategy = { name: 'spy', naive: true, habits: (s) => (seen.push(s), []), choose: () => 'wait' };
    playVpRun(spy, 2, CONTENT);
    expect(Object.keys(seen[0]!).sort()).toEqual(['quarter', 'reviews', 'view']);
    expect(seen[0]!.view.directors).toHaveLength(3);
    const bad: VpStrategy = { name: 'bad', naive: true, choose: () => 'nonsense' };
    expect(() => playVpRun(bad, 3, CONTENT)).toThrow(/bad, seed 3, quarter \d+/);
  });

  // @spec BAL-VP-003
  it('records ratings and endings and summarizes them as for the director', () => {
    const r = playVpRun(vpSound, 4, CONTENT);
    expect(['promoted', 'burnout', 'managedOut', null]).toContain(r.ending);
    const s = summarize(vpSound as never, [r]);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(4);
  });

  // @spec BAL-VP-004
  it('plays the strategies by the design’s table', () => {
    const view = { divisions: [{ id: 'd2', stress: 2 }, { id: 'd1', stress: 1 }], leadership: [{ id: 'x1', trust: 3 }, { id: 'x2', trust: 1 }], habits: { firstTeam: 'function', directors: 'stepBack' } };
    const seen = { quarter: 1, view, reviews: [] } as unknown as VpSeen;
    const moment = (kind: string, ids: string[], more = {}) => ({ id: 'm', source: 'level' as const, title: 't', text: 't', kind: kind as never, choices: ids.map((id) => ({ id, label: '' })), ...more });
    const priority = moment('priority', ['one:d2', 'one:d1', 'spread', 'push']);
    expect([vpSound, vpHero, vpContrarian].map((s) => s.choose(seen, priority))).toEqual(['one:d1', 'one:d2', 'push']);
    expect(vpSound.choose(seen, moment('dispute', ['company', 'function', 'trade'], { personId: 'x1' }))).toBe('trade');
    expect(vpSound.choose(seen, moment('dispute', ['company', 'function', 'trade'], { personId: 'x2' }))).toBe('company');
    const cuts = moment('cuts', ['once', 'across', 'waves']);
    expect([vpSound, vpHero, vpContrarian].map((s) => s.choose(seen, cuts))).toEqual(['once', 'across', 'waves']);
    expect(vpSound.habits!(seen)).toEqual([{ kind: 'plan', command: { kind: 'habit', habit: 'firstTeam', value: 'leadership' } }]);
    expect(vpIdle.choose(seen, cuts)).toBe('wait');
  });
});

describe('VP balance', { timeout: Math.max(180_000, SEEDS.length * VP_STRATEGIES.length * 2_000) }, () => {
  // @spec BAL-VP-004, BAL-VP-006
  it('reports the VP strategies, sound practice with close review outside every check', () => {
    expect(of('sound-review').naive).toBe(false);
    console.log(`\nVP: ${SEEDS.length} seeds per strategy, ${T.quarters} quarters\n${table(measure())}\n`);
  });

  // @spec BAL-VP-005
  it('rewards sound practice, lets it earn promotion, keeps naive play from promotion and sound practice from burnout and being managed out', () => {
    for (const n of naive()) expect({ vs: n.strategy, margin: of('sound').score - n.score >= T.scoreMargin }).toEqual({ vs: n.strategy, margin: true });
    expect(of('sound').promoted).toBeGreaterThanOrEqual(T.minSoundPromotionShare);
    for (const n of naive()) expect({ strategy: n.strategy, promoted: n.promoted <= T.maxNaivePromotionShare }).toEqual({ strategy: n.strategy, promoted: true });
    expect(of('sound').burnout).toBeLessThanOrEqual(T.maxSoundBurnoutShare);
    expect(of('sound').managedOut).toBeLessThanOrEqual(T.maxSoundManagedOutShare);
  });
});
