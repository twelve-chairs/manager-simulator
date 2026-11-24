/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import type { Moment } from './harness';
import { BALANCE_TUNING, DEPS, playRun, realContent, runScore, summarize, table, type Seen, type Strategy, type Summary } from './harness';
import { BETTER_CHOICES, STRATEGIES, idle, sound, soundHabits } from './strategies';

const CONTENT = realContent();
const SEEDS = Array.from({ length: Number(process.env.BALANCE_SEEDS ?? 40) }, (_, i) => i + 1);

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
  it('lets strategies set habits each week, then decide each moment, seeing only what the player sees', () => {
    const calls: string[] = [];
    const seen: Seen[] = [];
    const moments: Moment[] = [];
    const recorder: Strategy = {
      name: 'recorder',
      naive: true,
      habits: (s) => (calls.push(`habits ${s.week}`), seen.push(s), []),
      choose: (s, m) => (calls.push(`moment ${s.week}`), seen.push(s), moments.push(m), m.choices[0]!.id),
    };
    const result = playRun(recorder, 2, CONTENT);
    expect(calls[0]).toBe('habits 0');
    // habits once at the start of every week played, before that week's moments
    for (let week = 0; week < result.weeks; week++) {
      const first = calls.findIndex((c) => c.endsWith(` ${week}`));
      expect(calls[first]).toBe(`habits ${week}`);
      expect(calls.filter((c) => c === `habits ${week}`)).toHaveLength(1);
    }
    expect(moments.length).toBeGreaterThan(result.weeks);
    for (const s of seen) {
      expect(Object.keys(s).sort()).toEqual(['reviews', 'view', 'week']);
      expect(JSON.stringify(s)).not.toMatch(/"trust"|"rngState"|"history"/);
    }
    for (const m of moments) {
      expect(m.choices.length).toBeGreaterThan(0);
      expect(['level', 'situation']).toContain(m.source);
      expect(JSON.stringify(m)).not.toMatch(/"trust"|"rngState"|"history"|"bindings"/);
    }
    expect(moments.some((m) => m.source === 'situation' && m.situationId)).toBe(true);
    expect(moments.some((m) => m.source === 'level' && m.kind === 'work' && m.difficulty !== undefined)).toBe(true);
  });

  // @spec BAL-PLAY-002
  it('lets a moment wait when the strategy says so, and ends the week when none is open', () => {
    const waiter: Strategy = { name: 'waiter', naive: true, choose: () => 'wait' };
    const result = playRun(waiter, 2, CONTENT);
    expect(result.weeks).toBeGreaterThan(1);
  });

  // @spec BAL-PLAY-004
  it('fails with the strategy, seed and week when a command is refused', () => {
    const broken: Strategy = { name: 'broken', naive: true, choose: () => 'not-a-choice' };
    expect(() => playRun(broken, 3, CONTENT)).toThrow(/broken, seed 3, week 0: answer refused/);
    const badHabit: Strategy = { name: 'bad-habit', naive: true, habits: () => [{ kind: 'acknowledge' }], choose: () => 'wait' };
    expect(() => playRun(badHabit, 3, CONTENT)).toThrow(/bad-habit, seed 3, week 0: acknowledge refused/);
  });

  // @spec BAL-PLAY-005
  it('produces the same results from the same seed and content', () => {
    expect(playRun(sound, 4, CONTENT, DEPS)).toEqual(playRun(sound, 4, CONTENT, DEPS));
  });
});

describe('better choices', () => {
  const graded = () => CONTENT.filter((x) => !x.id.startsWith('onboarding-'));

  // @spec BAL-CHOICE-001
  it('names a valid better choice for every situation but onboarding, at every career level', () => {
    for (const s of graded()) {
      expect({ situation: s.id, has: s.choices.some((c) => c.id === BETTER_CHOICES[s.id]) }).toEqual({ situation: s.id, has: true });
    }
  });

  // @spec BAL-CHOICE-003
  it('has a lesson for letting it wait in every situation but onboarding, at every career level', () => {
    for (const s of graded()) {
      expect({ situation: s.id, has: typeof s.waitDebrief === 'string' }).toEqual({ situation: s.id, has: true });
    }
  });

  // @spec BAL-CHOICE-002
  it('keeps the better choice from sitting first, or last, in most of each level’s situations', () => {
    const levels = [...new Set(CONTENT.flatMap((s) => s.levels))];
    expect(levels).toEqual(expect.arrayContaining(['line-manager', 'senior-manager']));
    for (const level of levels) {
      const listed = CONTENT.filter((s) => s.levels.includes(level) && Object.hasOwn(BETTER_CHOICES, s.id));
      const at = (pick: (ids: string[]) => string | undefined) => listed.filter((s) => pick(s.choices.map((c) => c.id)) === BETTER_CHOICES[s.id]).length;
      const half = listed.length / 2;
      expect({ level, first: at((ids) => ids[0]) <= half, last: at((ids) => ids.at(-1)) <= half }).toEqual({ level, first: true, last: true });
    }
  });
});

describe('measures', () => {
  // @spec BAL-MEASURE-003
  // It reads the shared measurement, which the first test to ask for it plays, so it needs the checks' time limit.
  it('reports sound practice with other habits, outside every check', { timeout: Math.max(120_000, SEEDS.length * STRATEGIES.length * 1_000) }, () => {
    expect(soundHabits.naive).toBe(false);
    expect(STRATEGIES.map((s) => s.name)).toContain(soundHabits.name);
    const view = { people: [], projects: [], habits: { nightPages: 'rotation', oneOnOnes: 'fortnightly', approvals: 'me', ceremonies: 'full', growth: 'nobody' } };
    const commands = soundHabits.habits!({ week: 0, view: view as never, reviews: [] });
    expect(commands).toEqual(expect.arrayContaining([
      { kind: 'plan', command: { kind: 'habit', habit: 'oneOnOnes', value: 'weekly' } },
      { kind: 'plan', command: { kind: 'habit', habit: 'ceremonies', value: 'light' } },
    ]));
    expect(naive().map((n) => n.strategy)).not.toContain(soundHabits.name);
  });

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
