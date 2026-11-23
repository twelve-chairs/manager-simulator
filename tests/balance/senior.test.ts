/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { realContent, summarize, table, type Summary } from './harness';
import { SENIOR_BALANCE_TUNING, playSeniorRun, type SeniorSeen, type SeniorStrategy } from './senior';
import { SENIOR_STRATEGIES, seniorIdle, seniorSound } from './senior-strategies';

const CONTENT = realContent();
const SEEDS = Array.from({ length: Number(process.env.BALANCE_SEEDS ?? 20) }, (_, i) => i + 1);
const T = SENIOR_BALANCE_TUNING;

let summaries: Summary[] | undefined;
/** Every senior strategy over every seed, played once and shared by the checks. */
function measure(): Summary[] {
  summaries ??= SENIOR_STRATEGIES.map((s) => summarize(s as never, SEEDS.map((seed) => playSeniorRun(s, seed, CONTENT))));
  return summaries;
}
const of = (name: string) => measure().find((s) => s.strategy === name)!;
const naive = () => measure().filter((s) => s.naive);

describe('playing senior manager runs', () => {
  // @spec BAL-SENIOR-001
  it('starts the senior manager from an outside hire and plays up to 36 months, acknowledging reviews', () => {
    const r = playSeniorRun(seniorIdle, 1, CONTENT);
    expect(r.months).toBeGreaterThan(0);
    expect(r.months).toBeLessThanOrEqual(T.months);
    expect(r.ratings.length).toBeLessThanOrEqual(6);
    if (r.ending === null) expect(r.months).toBe(T.months);
  });

  // @spec BAL-SENIOR-002
  it('shows a strategy only the view and the month’s moments, and fails with strategy, seed and month on a refused command', () => {
    const seen: SeniorSeen[] = [];
    const spy: SeniorStrategy = { name: 'spy', naive: true, habits: (s) => (seen.push(s), []), choose: () => 'wait' };
    playSeniorRun(spy, 2, CONTENT);
    expect(seen.length).toBeGreaterThan(0);
    expect(Object.keys(seen[0]!).sort()).toEqual(['month', 'reviews', 'view']);
    expect(seen[0]!.view.managers.length).toBe(3);
    const bad: SeniorStrategy = { name: 'bad', naive: true, choose: () => 'nonsense' };
    expect(() => playSeniorRun(bad, 3, CONTENT)).toThrow(/bad, seed 3, month \d+/);
  });

  // @spec BAL-SENIOR-003
  it('records ratings and endings and summarizes them as for the line manager', () => {
    const r = playSeniorRun(seniorSound, 4, CONTENT);
    expect(['promoted', 'burnout', 'managedOut', null]).toContain(r.ending);
    const s = summarize(seniorSound as never, [r]);
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(4);
  });
});

describe('senior manager balance', { timeout: Math.max(120_000, SEEDS.length * SENIOR_STRATEGIES.length * 1_000) }, () => {
  // @spec BAL-SENIOR-004, BAL-SENIOR-007
  it('reports the senior strategies, sound practice with skip-levels outside every check', () => {
    expect(measure().find((s) => s.strategy === 'sound-skip')!.naive).toBe(false);
    console.log(`\nSenior manager: ${SEEDS.length} seeds per strategy, ${T.months} months\n${table(measure())}\n`);
  });

  // @spec BAL-SENIOR-005
  it('rewards sound practice, lets it earn promotion, keeps naive play from promotion and sound practice from burnout', () => {
    for (const n of naive()) expect({ vs: n.strategy, margin: of('sound').score - n.score >= T.scoreMargin }).toEqual({ vs: n.strategy, margin: true });
    expect(of('sound').promoted).toBeGreaterThanOrEqual(T.minSoundPromotionShare);
    for (const n of naive()) expect({ strategy: n.strategy, promoted: n.promoted <= T.maxNaivePromotionShare }).toEqual({ strategy: n.strategy, promoted: true });
    expect(of('sound').burnout).toBeLessThanOrEqual(T.maxSoundBurnoutShare);
  });

  // @spec BAL-SENIOR-006
  it('does not manage sound practice out often', () => {
    expect(of('sound').managedOut).toBeLessThanOrEqual(T.maxSoundManagedOutShare);
  });
});
