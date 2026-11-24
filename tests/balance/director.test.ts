/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { realContent, summarize, table, type Summary } from './harness';
import { DIRECTOR_BALANCE_TUNING, playDirectorRun, type DirectorSeen, type DirectorStrategy } from './director';
import { DIRECTOR_STRATEGIES, directorContrarian, directorHero, directorIdle, directorSound } from './director-strategies';

const CONTENT = realContent();
const SEEDS = Array.from({ length: Number(process.env.BALANCE_SEEDS ?? 40) }, (_, i) => i + 1);
const T = DIRECTOR_BALANCE_TUNING;

let summaries: Summary[] | undefined;
/** Every director strategy over every seed, played once and shared by the checks. */
function measure(): Summary[] {
  summaries ??= DIRECTOR_STRATEGIES.map((s) => summarize(s as never, SEEDS.map((seed) => playDirectorRun(s, seed, CONTENT))));
  return summaries;
}
const of = (name: string) => measure().find((s) => s.strategy === name)!;
const naive = () => measure().filter((s) => s.naive);

describe('playing director runs', () => {
  // @spec BAL-DIR-001
  it('starts the director from outside hires at both promotions and plays up to 12 quarters, acknowledging reviews', () => {
    const r = playDirectorRun(directorIdle, 1, CONTENT);
    expect(r.quarters).toBeGreaterThan(0);
    expect(r.quarters).toBeLessThanOrEqual(T.quarters);
    expect(r.ratings.length).toBeLessThanOrEqual(6);
    if (r.ending === null) expect(r.quarters).toBe(T.quarters);
  });

  // @spec BAL-DIR-002
  it('shows a strategy only the view and the quarter’s moments, and fails with strategy, seed and quarter on a refused command', () => {
    const seen: DirectorSeen[] = [];
    const spy: DirectorStrategy = { name: 'spy', naive: true, habits: (s) => (seen.push(s), []), choose: () => 'wait' };
    playDirectorRun(spy, 2, CONTENT);
    expect(Object.keys(seen[0]!).sort()).toEqual(['quarter', 'reviews', 'view']);
    expect(seen[0]!.view.seniorManagers.length).toBe(3);
    const bad: DirectorStrategy = { name: 'bad', naive: true, choose: () => 'nonsense' };
    expect(() => playDirectorRun(bad, 3, CONTENT)).toThrow(/bad, seed 3, quarter \d+/);
  });

  // @spec BAL-DIR-003
  it('records ratings and endings and summarizes them as for the line manager', () => {
    const r = playDirectorRun(directorSound, 4, CONTENT);
    expect(['promoted', 'burnout', 'managedOut', null]).toContain(r.ending);
    const s = summarize(directorSound as never, [r]);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(4);
  });

  // @spec BAL-DIR-004
  it('plays the strategies by the design’s table', () => {
    const view = { groups: [{ id: 'g2', stress: 1 }, { id: 'g1', stress: 1 }, { id: 'g3', stress: 0 }], habits: { time: 'balanced', staffMeeting: 'weekly', listeningTour: 'none' } };
    const seen = { quarter: 1, view, reviews: [] } as unknown as DirectorSeen;
    const bets = { id: 'm', source: 'level' as const, title: 't', text: 't', kind: 'bets' as const, choices: [{ id: 'none', label: '' }], offers: [{ id: 'bo1', name: 'x', scope: 30, deadlineWeeks: 1, landing: 1, failing: 1, peerId: null }, { id: 'bo2', name: 'y', scope: 20, deadlineWeeks: 1, landing: 1, failing: 1, peerId: null }] };
    // sound practice funds the bet with the least work per week, on the calmest group
    expect(directorSound.choose(seen, bets)).toBe(`fund:${JSON.stringify({ bo2: 'g3' })}`);
    expect(directorHero.choose(seen, bets)).toBe(`fund:${JSON.stringify({ bo1: 'g2', bo2: 'g1' })}`);
    const review = { id: 'r', source: 'level' as const, title: 't', text: 't', kind: 'review' as const, choices: ['straight', 'wins', 'promise'].map((id) => ({ id, label: '' })) };
    expect([directorSound, directorHero, directorContrarian].map((s) => s.choose(seen, review))).toEqual(['straight', 'promise', 'wins']);
    expect(directorIdle.choose(seen, review)).toBe('wait');
  });
});

describe('director balance', { timeout: Math.max(180_000, SEEDS.length * DIRECTOR_STRATEGIES.length * 2_000) }, () => {
  // @spec BAL-DIR-004, BAL-DIR-007
  it('reports the director strategies, sound practice with a listening tour outside every check', () => {
    expect(measure().find((s) => s.strategy === 'sound-tour')!.naive).toBe(false);
    console.log(`\nDirector: ${SEEDS.length} seeds per strategy, ${T.quarters} quarters\n${table(measure())}\n`);
  });

  // @spec BAL-DIR-005
  it('rewards sound practice, lets it earn promotion, keeps naive play from promotion and sound practice from burnout', () => {
    for (const n of naive()) expect({ vs: n.strategy, margin: of('sound').score - n.score >= T.scoreMargin }).toEqual({ vs: n.strategy, margin: true });
    expect(of('sound').promoted).toBeGreaterThanOrEqual(T.minSoundPromotionShare);
    for (const n of naive()) expect({ strategy: n.strategy, promoted: n.promoted <= T.maxNaivePromotionShare }).toEqual({ strategy: n.strategy, promoted: true });
    expect(of('sound').burnout).toBeLessThanOrEqual(T.maxSoundBurnoutShare);
  });

  // @spec BAL-DIR-006
  it('does not manage sound practice out often', () => {
    expect(of('sound').managedOut).toBeLessThanOrEqual(T.maxSoundManagedOutShare);
  });
});
