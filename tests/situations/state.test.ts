import { describe, expect, it } from 'vitest';
import { debriefsSince, type EngineState, type Situation } from '../../src/situations';
import type { SimState } from '../../src/sim';
import { ONLY_E1, engine, expectResolved, fresh, patch, plain, resolve, select, sit } from './fixtures';

const CONTENT: Situation[] = [
  sit({ id: 'about-e1', roles: [{ name: 'engineer', kind: 'person', where: ONLY_E1 }] }),
  sit({ id: 'about-anyone', cooldownWeeks: 2 }),
  plain('org-wide', { weight: 3 }),
];

const at = (sim: SimState, week: number) => patch(sim, (s) => (s.week = week));

/** Plays a few turns: select, resolve the first presentation with its first choice, leave the rest open. */
function play(start: EngineState, turns = 4, content = CONTENT) {
  let eng = start;
  let sim = fresh();
  const trace: unknown[] = [];
  for (let week = 0; week < turns; week++) {
    sim = at(sim, week);
    const selected = select(eng, sim, content, 2);
    eng = selected.engine;
    trace.push(selected.presented);
    const first = selected.presented[0];
    if (!first) continue;
    const result = resolve(eng, sim, content, first, first.choices[0]!.id);
    trace.push(result);
    if (result.kind === 'resolved') {
      eng = result.engine;
      sim = result.sim;
    }
  }
  return { eng, sim, trace };
}

describe('engine state', () => {
  // @spec SIT-STATE-001
  it('survives a JSON round trip unchanged', () => {
    const { eng, sim } = play(engine(3));
    const copy = JSON.parse(JSON.stringify(eng)) as EngineState;
    expect(copy).toEqual(eng);
    const next = at(sim, 10);
    expect(select(copy, next, CONTENT)).toEqual(select(eng, next, CONTENT));
  });

  // @spec SIT-STATE-002
  it('returns a new state from every operation and leaves the input unchanged', () => {
    const start = engine();
    const before = structuredClone(start);
    const selected = select(start, fresh(), CONTENT);
    expect(start).toEqual(before);
    expect(selected.engine).not.toBe(start);

    const opened = structuredClone(selected.engine);
    const result = expectResolved(resolve(selected.engine, fresh(), CONTENT, selected.presented[0]!, selected.presented[0]!.choices[0]!.id));
    expect(selected.engine).toEqual(opened);
    expect(result.engine).not.toBe(selected.engine);
  });

  // @spec SIT-STATE-003
  it('produces identical results from the same seed and inputs', () => {
    expect(play(engine(7)).trace).toEqual(play(engine(7)).trace);
  });

  // @spec SIT-STATE-005
  it('keeps records for situations no longer in the content', () => {
    const gone = plain('retired');
    const first = select(engine(), fresh(), [gone]);
    const second = select(first.engine, at(fresh(), 1), CONTENT);
    expect(second.presented.length).toBeGreaterThan(0);
    expect(debriefsSince(second.engine, 0).map((r) => r.situationId)).toEqual(['retired']);
    const restored = JSON.parse(JSON.stringify(second.engine)) as EngineState;
    expect(debriefsSince(restored, 0)).toEqual(debriefsSince(second.engine, 0));
  });

  // @spec SIT-STATE-004
  it('returns debrief records from a week on, in recorded order', () => {
    let eng = engine();
    for (const week of [0, 2, 5]) {
      const sim = at(fresh(), week);
      const { engine: next, presented } = select(eng, sim, [plain(`w${week}a`), plain(`w${week}b`)], 2);
      eng = expectResolved(resolve(next, sim, [plain(`w${week}a`), plain(`w${week}b`)], presented.find((p) => p.situationId === `w${week}a`)!, 'ok')).engine;
    }
    // each later selection closed the previous week's unresolved b-situation as ignored
    eng = select(eng, at(fresh(), 6), []).engine;
    const since = (week: number) => debriefsSince(eng, week).map((r) => `${r.situationId}:${r.status}`);
    expect(since(2)).toEqual(['w2a:resolved', 'w2b:ignored', 'w5a:resolved', 'w5b:ignored']);
    expect(since(0)).toHaveLength(6);
    expect(since(7)).toEqual([]);
  });
});
