import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROMISES, STAY_PROMISES, promisesAt } from '../../src/levels/promises';
import { stayAnswer } from '../../src/levels/org';
import type { SimState } from '../../src/sim';
import { engineers, run } from './line-manager/fixtures';

const RULE = { kind: 'rule', ruleId: 'test' } as const;
/** The simulation with these notes added to one person's history, each at its week. */
function withNotes(sim: SimState, id: string, notes: { week: number; note: string }[], week: number): SimState {
  const copy = structuredClone(sim);
  copy.week = week;
  copy.people[id]!.history.push(...notes.map((n) => ({ week: n.week, cause: RULE, note: n.note })));
  return copy;
}
const CLEAN_UP = PROMISES.find((p) => p.id === 'clean-up')!;

describe('promises', () => {
  // @spec UI-PROMISE-001
  it('lists a promise still open, with how long ago it was made, until it lapses', () => {
    const { sim: s0 } = run(1);
    const id = engineers(s0)[0]!;
    const sim = withNotes(s0, id, [{ week: 3, note: CLEAN_UP.made }], 10);
    expect(promisesAt(sim, 9).open).toEqual([{ personId: id, name: sim.people[id]!.name, promise: CLEAN_UP.promise, kindId: 'clean-up', weeksAgo: 7 }]);
    expect(promisesAt({ ...sim, week: 3 + CLEAN_UP.lapseWeeks + 1 }, 3 + CLEAN_UP.lapseWeeks).open).toEqual([]);
    // someone who has left is not listed
    const gone = structuredClone(sim);
    gone.people[id]!.status = 'departed';
    expect(promisesAt(gone, 9).open).toEqual([]);
  });

  // @spec UI-PROMISE-002
  it('says once when a promise was kept or broken in the turn just played, and drops it from the open list', () => {
    const { sim: s0 } = run(1);
    const id = engineers(s0)[0]!;
    const kept = withNotes(s0, id, [{ week: 3, note: CLEAN_UP.made }, { week: 9, note: CLEAN_UP.kept[0]! }], 10);
    expect(promisesAt(kept, 9)).toMatchObject({ open: [], kept: [{ personId: id, promise: CLEAN_UP.promise }], broken: [] });
    // the turn after, it is not said again
    expect(promisesAt({ ...kept, week: 11 }, 10)).toMatchObject({ open: [], kept: [], broken: [] });
    const broken = withNotes(s0, id, [{ week: 3, note: CLEAN_UP.made }, { week: 9, note: CLEAN_UP.broken[0]! }], 10);
    expect(promisesAt(broken, 9)).toMatchObject({ open: [], kept: [], broken: [{ personId: id, promise: CLEAN_UP.promise, restless: false }] });
  });

  // @spec UI-PROMISE-002, SENIOR-MOMENT-019
  it('records a stay conversation’s promise, and breaks it when that leader turns restless again', () => {
    const { sim: s0 } = run(1);
    const id = engineers(s0)[0]!;
    const want = s0.people[id]!.want;
    const kept = stayAnswer(s0, id, 'keep', { energy: 1, motivation: 1, trust: 1 }, 'test.stay');
    const note = kept.effects.map((e) => ('historyNote' in e ? e.historyNote : undefined)).find(Boolean);
    expect(note).toBe(`Was promised ${STAY_PROMISES[want]}`);
    const promised = withNotes(s0, id, [{ week: 4, note: note! }], 8);
    expect(promisesAt(promised, 7).open.map((p) => p.promise)).toEqual([STAY_PROMISES[want]]);
    const restless = structuredClone(promised);
    restless.people[id]!.restlessSince = 7;
    expect(promisesAt(restless, 7)).toMatchObject({ open: [], broken: [{ personId: id, promise: STAY_PROMISES[want], restless: true }] });
    // and said once: a turn later it is gone
    expect(promisesAt({ ...restless, week: 9 }, 8).broken).toEqual([]);
  });

  // @spec UI-PROMISE-003
  it('names only notes the content or a level writes', () => {
    const content = readdirSync('content/situations').map((f) => readFileSync(`content/situations/${f}`, 'utf8')).join('\n');
    const stayNotes = new Set(Object.values(STAY_PROMISES).map((p) => `Was promised ${p}`));
    for (const p of PROMISES) for (const note of [p.made, ...p.kept, ...p.broken]) expect(content.includes(note) || stayNotes.has(note), note).toBe(true);
    expect(PROMISES.map((p) => p.id)).toEqual(expect.arrayContaining(['clean-up', 'reorg', 'stay:growth', 'stay:recognition', 'stay:stability', 'stay:autonomy']));
  });
});
