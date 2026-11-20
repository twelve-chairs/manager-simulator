import { describe, expect, it } from 'vitest';
import { LEVEL, LINE_TUNING, NAMES, beginWeek, scorecard, view } from '../../../src/levels/line-manager';
import { PERSONALITIES } from '../../../src/personalities';
import { behindScheduleProjects, overdueProjects } from '../../../src/sim';
import { PLAYER_ACTION_IDS } from '../../../src/actions';
import { choose, end, engineers, habit, nextWeek, projects, run, seeds, teamOf } from './fixtures';


describe('starting organization', () => {
  // @spec LINE-ORG-001, LINE-ORG-004
  it('generates one player-led team of five engineers and two projects, one at risk', () => {
    for (const seed of seeds(10)) {
      const { sim } = run(seed);
      const teams = Object.values(sim.teams);
      expect(teams).toHaveLength(1);
      expect(teams[0]!.leader).toEqual({ kind: 'player' });
      expect(teams[0]!.form).toBe('detailed');
      const people = engineers(sim).map((id) => sim.people[id]!);
      expect(people).toHaveLength(5);
      expect(people.every((p) => p.role === 'engineer')).toBe(true);
      for (const field of ['skill', 'motivation', 'stress'] as const) expect(new Set(people.map((p) => p[field])).size).toBeGreaterThan(1);
      expect(new Set(people.map((p) => p.want)).size).toBeGreaterThan(1);
      expect(new Set(people.map((p) => p.personality)).size).toBeGreaterThanOrEqual(3);
      for (const p of people) expect(PERSONALITIES).toContain(p.personality);
      const team = projects(sim).map((id) => sim.projects[id]!);
      expect(team).toHaveLength(2);
      expect(new Set(team.map((p) => p.risk)).size).toBe(2);
      expect(Math.max(...team.map((p) => p.risk))).toBeGreaterThanOrEqual(LINE_TUNING.atRiskProjectRisk);
      expect(Math.min(...team.map((p) => p.risk))).toBeLessThan(LINE_TUNING.atRiskProjectRisk);
      expect([...overdueProjects(sim), ...behindScheduleProjects(sim)]).toEqual([]);
    }
  });

  // @spec LINE-ORG-002
  it('names people and projects from the fictional list, with no two people alike', () => {
    for (const seed of seeds(10)) {
      const { sim } = run(seed);
      const names = Object.values(sim.people).map((p) => p.name);
      for (const name of names) expect(NAMES.people).toContain(name);
      for (const p of Object.values(sim.projects)) expect(NAMES.projects).toContain(p.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  // @spec LINE-ORG-003
  it('generates identical states from the same seed', () => {
    expect(run(7)).toEqual(run(7));
    expect(run(7)).not.toEqual(run(8));
  });
});

describe('level parameters', () => {
  // @spec LINE-WEEK-001
  it('declares its id, time step, situation limit and review cadence', () => {
    expect(LEVEL).toMatchObject({ id: 'line-manager', weeksPerStep: 1, reviewEveryWeeks: 13 });
    expect(LEVEL.situationLimit).toBeGreaterThan(0);
  });
});

describe('causes', () => {
  // @spec LINE-STATE-004
  it('uses only action ids from the player action catalogue', () => {
    const used = new Set<string>();
    for (const seed of seeds(6)) {
      let { level, sim } = run(seed);
      level = habit(habit(level, sim, 'approvals', engineers(sim)[0]!), sim, 'growth', engineers(sim)[1]!);
      for (let week = 0; week < 8; week++) {
        level = beginWeek({ ...level, vacancies: week === 0 ? [{ id: 'v-test', interviews: 0 }] : level.vacancies }, sim);
        level = { ...level, habits: { ...level.habits, nightPages: week % 3 === 0 ? 'me' : 'rotation' } };
        for (const m of level.moments.filter((x) => x.status === 'open')) {
          const r = choose(level, sim, m.id, m.choices[(seed + week) % m.choices.length]!.id);
          r.log.forEach((x) => x.cause.kind === 'action' && used.add(x.cause.actionId));
          ({ level, sim } = r);
        }
        const ended = end(level, sim);
        ended.log.forEach((x) => x.cause.kind === 'action' && used.add(x.cause.actionId));
        ({ level, sim } = nextWeek(level, sim));
      }
    }
    expect(used.size).toBeGreaterThan(5);
    for (const id of used) expect(PLAYER_ACTION_IDS).toContain(id);
  });
});

describe('purity and determinism', () => {
  // @spec LINE-STATE-001
  it('keeps a state that survives JSON unchanged', () => {
    let { level, sim } = run(3);
    level = beginWeek(level, sim);
    const open = level.moments.find((m) => m.status === 'open');
    if (open) ({ level, sim } = choose(level, sim, open.id, open.choices[0]!.id));
    ({ level, sim } = nextWeek(level, sim));
    expect(JSON.parse(JSON.stringify(level))).toEqual(level);
  });

  // @spec LINE-STATE-002
  it('leaves its inputs unchanged', () => {
    const { level, sim } = run(3);
    const before = structuredClone({ level, sim });
    const arrived = beginWeek(level, sim);
    view(arrived, sim);
    scorecard(arrived, sim);
    end(arrived, sim);
    nextWeek(arrived, sim);
    const open = arrived.moments.find((m) => m.status === 'open');
    if (open) choose(arrived, sim, open.id, open.choices[0]!.id);
    expect({ level, sim }).toEqual(before);
    expect(arrived).not.toBe(level);
  });

  // @spec LINE-STATE-003
  it('produces identical results from the same seed and inputs', () => {
    const play = () => {
      let { level, sim } = run(5);
      const trace: unknown[] = [];
      for (let week = 0; week < 6; week++) {
        level = beginWeek(level, sim);
        for (const m of level.moments.filter((x) => x.status === 'open')) ({ level, sim } = choose(level, sim, m.id, m.choices[0]!.id));
        const next = nextWeek(level, sim);
        trace.push(next.recap);
        ({ level, sim } = next);
      }
      return { level, sim, trace, team: teamOf(sim) };
    };
    expect(play()).toEqual(play());
  });
});
