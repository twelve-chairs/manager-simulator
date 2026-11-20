/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/loop';
import { BALANCE_TUNING, DEPS, playRun, realContent, runScore, summarize, table, type Seen, type Strategy, type Summary } from './harness';
import { BETTER_CHOICES, STRATEGIES, idle, sound } from './strategies';

const CONTENT = realContent();
const SEEDS = Array.from({ length: Number(process.env.BALANCE_SEEDS ?? 20) }, (_, i) => i + 1);

let summaries: Summary[] | undefined;
/** Every strategy over every seed, played once and shared by the checks. */
function measure(): Summary[] {
  summaries ??= STRATEGIES.map((s) => summarize(s, SEEDS.map((seed) => playRun(s, seed, CONTENT))));
  return summaries;
}
const of = (name: string) => measure().find((s) => s.strategy === name)!;
const naive = () => measure().filter((s) => s.naive);

describe('playing runs', () => {
  // @spec BAL-PLAY-001, BAL-PLAY-003
  it('plays the real game up to 78 weeks, acknowledging reviews', () => {
    const result = playRun(idle, 1, CONTENT);
    expect(result.weeks).toBeLessThanOrEqual(BALANCE_TUNING.weeks);
    if (result.ending === null) {
      expect(result.weeks).toBe(78);
      expect(result.ratings).toHaveLength(6);
    }
    expect(CONTENT.some((s) => s.id === 'onboarding-first-day')).toBe(true);
  });

  // @spec BAL-PLAY-002
  it('shows strategies only what the player sees', () => {
    const seen: Seen[] = [];
    const recorder: Strategy = { name: 'recorder', naive: true, play: (s) => (seen.push(s), []) };
    playRun(recorder, 2, CONTENT);
    expect(seen.length).toBeGreaterThan(0);
    for (const s of seen) {
      expect(Object.keys(s).sort()).toEqual(['plan', 'presented', 'reviews', 'view', 'week']);
      expect(JSON.stringify(s)).not.toMatch(/"trust"|"rngState"|"history"/);
    }
  });

  // @spec BAL-PLAY-004
  it('fails with the strategy, seed and week when a command is refused', () => {
    const broken: Strategy = { name: 'broken', naive: true, play: () => [{ kind: 'acknowledge' } as Command] };
    expect(() => playRun(broken, 3, CONTENT)).toThrow(/broken, seed 3, week 0: acknowledge refused/);
  });

  // @spec BAL-PLAY-005
  it('produces the same results from the same seed and content', () => {
    expect(playRun(sound, 4, CONTENT, DEPS)).toEqual(playRun(sound, 4, CONTENT, DEPS));
  });
});

describe('better choices', () => {
  // @spec BAL-CHOICE-001
  it('names a valid better choice for every line manager situation but onboarding', () => {
    for (const s of CONTENT.filter((x) => x.levels.includes('line-manager') && !x.id.startsWith('onboarding-'))) {
      expect({ situation: s.id, has: s.choices.some((c) => c.id === BETTER_CHOICES[s.id]) }).toEqual({ situation: s.id, has: true });
    }
  });
});

describe('measures', () => {
  // @spec BAL-MEASURE-002
  it('scores runs over six review slots, counting missed slots by how the run ended', () => {
    expect(runScore({ ending: null, ratings: ['meets', 'meets', 'meets', 'meets', 'meets', 'meets'] })).toBe(2);
    expect(runScore({ ending: 'burnout', ratings: ['exceeds', 'exceeds', 'exceeds'] })).toBe(1.5);
    expect(runScore({ ending: 'burnout', ratings: [] })).toBe(0);
    expect(runScore({ ending: 'promoted', ratings: ['meets', 'meets', 'exceeds', 'exceeds'] })).toBeCloseTo((2 + 2 + 3 + 3 + 3 + 3) / 6);
  });
});

// About 80 ms per run; the timeout grows with the seeds so the report command's larger runs fit.
describe('balance', { timeout: Math.max(120_000, SEEDS.length * STRATEGIES.length * 1_000) }, () => {
  it('reports the strategies', () => {
    console.log(`\n${SEEDS.length} seeds per strategy, ${BALANCE_TUNING.weeks} weeks\n${table(measure())}\n`);
  });

  // @spec BAL-CHECK-001
  it('rewards sound practice over every naive strategy', () => {
    for (const n of naive()) expect({ vs: n.strategy, margin: of('sound').score - n.score >= BALANCE_TUNING.scoreMargin }).toEqual({ vs: n.strategy, margin: true });
  });

  // @spec BAL-CHECK-002
  it('lets sound practice earn promotion', () => {
    expect(of('sound').promoted).toBeGreaterThanOrEqual(BALANCE_TUNING.minSoundPromotionShare);
  });

  // @spec BAL-CHECK-003
  it('does not promote any naive strategy often', () => {
    for (const n of naive()) expect({ strategy: n.strategy, promoted: n.promoted <= BALANCE_TUNING.maxNaivePromotionShare }).toEqual({ strategy: n.strategy, promoted: true });
  });

  // @spec BAL-CHECK-004
  it('does not burn out sound practice often', () => {
    expect(of('sound').burnout).toBeLessThanOrEqual(BALANCE_TUNING.maxSoundBurnoutShare);
  });
});
