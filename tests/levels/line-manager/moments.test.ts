import { describe, expect, it } from 'vitest';
import { LINE_TUNING } from '../../../src/levels/line-manager';
import type { SimState } from '../../../src/sim';
import { begin, choose, end, engineers, momentFor, patch, projects, quietRun, withItem } from './fixtures';

const project = (sim: SimState) => ({ kind: 'project' as const, id: projects(sim)[0]! });

describe('a week’s moments', () => {
  // @spec LINE-MOMENT-001, LINE-WEEK-002
  it('presents work closest to expiring first, up to the cap, with interviews and pages', () => {
    let { level, sim } = quietRun(1);
    const cap = LINE_TUNING.levelMomentCap;
    for (let i = 0; i < cap + 2; i++) level = withItem(level, { kind: 'designReview', subject: project(sim), lastWeek: sim.week + 2 + i, id: `w${i}` }).level;
    const begun = begin(level, sim);
    const work = begun.moments.filter((m) => m.kind === 'work');
    expect(begun.moments.length).toBeLessThanOrEqual(cap);
    expect(work.map((m) => m.ref)).toEqual(Array.from({ length: work.length }, (_, i) => `w${i}`));

    // a vacancy brings an interview moment, a page under the rotation an on-call moment
    const gone = patch(sim, (s) => (s.people[engineers(sim)[4]!]!.status = 'departed'));
    let l2 = { ...quietRun(1).level, vacancies: [{ id: 'v1', interviews: 0 }] };
    l2 = withItem(l2, { kind: 'onCall', subject: project(gone), size: 8, difficulty: 90, lastWeek: gone.week }).level;
    const kinds = begin(l2, gone).moments.map((m) => m.kind).sort();
    expect(kinds).toEqual(['interview', 'onCall']);
  });

  // @spec LINE-MOMENT-001
  it('brings back work pushed back or left unanswered in earlier weeks', () => {
    let { level, sim } = quietRun(1);
    level = withItem(level, { kind: 'customerRequest', subject: project(sim), lastWeek: sim.week + 3, id: 'later' }).level;
    level = begin(level, sim);
    level = choose(level, sim, momentFor(level, 'later').id, 'pushBack').level;
    const next = patch(sim, (s) => (s.week += 1));
    const ended = end(level, sim);
    const again = begin(ended.level, next);
    expect(momentFor(again, 'later').status).toBe('open');
  });

  // @spec LINE-MOMENT-002
  it('places pages at night, interviews on Wednesday and work through the week', () => {
    let { level, sim } = quietRun(1);
    level = { ...level, vacancies: [{ id: 'v1', interviews: 0 }] };
    level = withItem(level, { kind: 'onCall', subject: project(sim), size: 8, difficulty: 90, lastWeek: sim.week }).level;
    for (let i = 0; i < 3; i++) level = withItem(level, { kind: 'designReview', subject: project(sim), lastWeek: sim.week + 2 + i, id: `w${i}` }).level;
    const moments = begin(level, sim).moments;
    for (const m of moments) {
      expect(m.day).toBeGreaterThanOrEqual(0);
      expect(m.day).toBeLessThanOrEqual(4);
    }
    expect(moments.find((m) => m.kind === 'onCall')!.time).toBe('night');
    expect(moments.find((m) => m.kind === 'interview')!.day).toBe(2);
    const workDays = moments.filter((m) => m.kind === 'work').map((m) => m.day);
    expect(workDays).toEqual([...workDays].sort((a, b) => a - b));
  });

  // @spec LINE-MOMENT-004
  it('closes unanswered moments as letting it wait at the end of the week', () => {
    let { level, sim } = quietRun(1);
    level = { ...level, vacancies: [{ id: 'v1', interviews: 0 }] };
    level = withItem(level, { kind: 'onCall', subject: project(sim), size: 8, difficulty: 90, lastWeek: sim.week, id: 'page' }).level;
    level = withItem(level, { kind: 'designReview', subject: project(sim), lastWeek: sim.week + 2, id: 'review' }).level;
    const ended = end(begin(level, sim), sim);
    expect(ended.level.moments.every((m) => m.status !== 'open')).toBe(true);
    expect(ended.level.items.map((i) => i.id)).toEqual(['review']);
    expect(ended.level.vacancies).toEqual([{ id: 'v1', interviews: 0 }]);
    expect(ended.recap.expired.map((e) => e.itemId)).toEqual(['page']);
    expect(ended.sim.projects[project(sim).id]!.risk).toBeGreaterThan(sim.projects[project(sim).id]!.risk);
  });
});
