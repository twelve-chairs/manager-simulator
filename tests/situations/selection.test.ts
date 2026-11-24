import { describe, expect, it } from 'vitest';
import { debriefsSince, type Condition, type Situation } from '../../src/situations';
import { aggregateTeam } from '../../src/sim';
import { seeds } from '../sim/fixtures';
import { ONLY_E1, OTHER_TEAM, engine, fresh, holds, patch, plain, resolve, select, sit } from './fixtures';

const c = (x: unknown) => x as Condition;
const ids = (result: { presented: { situationId: string }[] }) => result.presented.map((p) => p.situationId).sort();

/** A situation with one person role whose where is given. */
const about = (id: string, where: unknown, overrides: Partial<Situation> = {}) =>
  sit({ id, roles: [{ name: 'engineer', kind: 'person', where: c(where) }], ...overrides });

const T2_ENGINEER = { all: [{ value: 'engineer.team', isNot: { value: 'player.team' } }, { value: 'engineer.role', is: 'engineer' }] };

describe('eligibility', () => {
  // @spec SIT-SEL-001
  it('considers only situations tagged with the level', () => {
    const situations = [plain('lm'), plain('dir', { levels: ['director'] }), plain('both', { levels: ['director', 'line-manager'] })];
    expect(ids(select(engine(), fresh(), situations, 5))).toEqual(['both', 'lm']);
    expect(ids(select(engine(), fresh(), situations, 5, 'director'))).toEqual(['both', 'dir']);
  });

  // @spec SIT-SEL-002
  it('skips once situations already presented and situations in cooldown', () => {
    const once = plain('once', { once: true });
    const cool = plain('cool', { cooldownWeeks: 4 });
    const at = (week: number) => patch(fresh(), (s) => (s.week = week));

    const first = select(engine(), at(0), [once, cool]);
    expect(ids(first)).toEqual(['cool', 'once']);
    const second = select(first.engine, at(3), [once, cool]);
    expect(ids(second)).toEqual([]);
    const third = select(second.engine, at(4), [once, cool]);
    expect(ids(third)).toEqual(['cool']);
  });

  // @spec SIT-SEL-016
  it('does not bring a situation back to the same person within its person cooldown, 26 weeks by default', () => {
    const at = (week: number) => patch(fresh(), (s) => (s.week = week));
    const s = about('s', ONLY_E1);
    const first = select(engine(), at(0), [s]);
    expect(first.presented.map((p) => p.bindings.engineer)).toEqual(['e1']);
    expect(select(first.engine, at(25), [s]).presented).toEqual([]);
    expect(ids(select(first.engine, at(26), [s]))).toEqual(['s']);
    const short = about('s', ONLY_E1, { personCooldownWeeks: 4 });
    const once = select(engine(), at(0), [short]);
    expect(select(once.engine, at(3), [short]).presented).toEqual([]);
    expect(ids(select(once.engine, at(4), [short]))).toEqual(['s']);
    const any = about('s', ONLY_E1, { personCooldownWeeks: 0 });
    expect(ids(select(select(engine(), at(0), [any]).engine, at(1), [any]))).toEqual(['s']);
  });

  // @spec SIT-SEL-003
  it('skips a situation whose when does not hold', () => {
    const s = plain('s', { when: c({ value: 'player.reputation', above: 60 }) });
    expect(select(engine(), fresh(), [s]).presented).toEqual([]);
    const liked = patch(fresh(), (st) => (st.player.reputation = 70));
    expect(ids(select(engine(), liked, [s]))).toEqual(['s']);
  });

  // @spec SIT-SEL-013
  it('skips a situation that would offer no choice once bound', () => {
    const s = about('s', ONLY_E1);
    s.choices[0]!.availableIf = c({ value: 'engineer.motivation', above: 90 });
    expect(select(engine(), fresh(), [s]).presented).toEqual([]);
  });
});

describe('binding roles', () => {
  // @spec SIT-SEL-004
  it('binds only matching active people, existing teams and active projects', () => {
    const p = select(engine(), fresh(), [about('s', T2_ENGINEER)]).presented[0]!;
    expect(['e4', 'e5']).toContain(p.bindings.engineer);

    const gone = patch(fresh(), (s) => {
      s.people.e4!.status = 'departed';
      s.people.e5!.status = 'departed';
    });
    expect(select(engine(), gone, [about('s', T2_ENGINEER)]).presented).toEqual([]);

    const onProject = sit({ id: 'p', roles: [{ name: 'project', kind: 'project' }], text: '{project}', choices: plain('x').choices });
    expect(select(engine(), fresh(), [onProject]).presented[0]!.bindings).toEqual({ project: 'p1' });
    const done = patch(fresh(), (s) => (s.projects.p1!.status = 'completed'));
    expect(select(engine(), done, [onProject]).presented).toEqual([]);

    const onTeam = sit({ id: 't', roles: [{ name: 'team', kind: 'team', where: OTHER_TEAM }], text: '{team}', choices: plain('x').choices });
    expect(select(engine(), fresh(), [onTeam]).presented[0]!.bindings).toEqual({ team: 't2' });
  });

  // @spec SIT-SEL-004
  it('shuffles candidates with the engine generator', () => {
    const bound = new Set(seeds(30).map((seed) => select(engine(seed), fresh(), [about('s', { value: 'engineer.team', is: { value: 'player.team' } })]).presented[0]!.bindings.engineer));
    expect(bound).toEqual(new Set(['e1', 'e2', 'e3']));
  });

  // @spec SIT-SEL-004
  it('never binds one entity to two roles of a situation', () => {
    const pair = sit({
      id: 'pair',
      roles: [
        { name: 'a', kind: 'person', where: c({ value: 'a.team', isNot: { value: 'player.team' } }) },
        { name: 'b', kind: 'person', where: c({ value: 'b.team', isNot: { value: 'player.team' } }) },
      ],
      text: '{a} and {b}',
      choices: plain('x').choices,
    });
    for (const seed of seeds(20)) {
      const { bindings } = select(engine(seed), fresh(), [pair]).presented[0]!;
      expect(bindings.a).not.toBe(bindings.b);
    }
    const managers = sit({
      ...pair,
      roles: [
        { name: 'a', kind: 'person', where: c({ value: 'a.role', is: 'manager' }) },
        { name: 'b', kind: 'person', where: c({ value: 'b.role', is: 'manager' }) },
      ],
    });
    expect(select(engine(), fresh(), [managers]).presented).toEqual([]);
  });

  // @spec SIT-SEL-014
  it('binds a team role with a form only to teams of that form', () => {
    const onForm = (form: 'detailed' | 'aggregate') =>
      sit({ id: form, roles: [{ name: 'team', kind: 'team', form }], text: '{team}', choices: plain('x').choices });
    expect(select(engine(), fresh(), [onForm('aggregate')]).presented).toEqual([]);
    const mixed = aggregateTeam(fresh(), 't2', { kind: 'rule', ruleId: 'test.rule' }).state;
    for (const seed of seeds(10)) {
      expect(select(engine(seed), mixed, [onForm('aggregate')]).presented[0]!.bindings).toEqual({ team: 't2' });
      expect(select(engine(seed), mixed, [onForm('detailed')]).presented[0]!.bindings).toEqual({ team: 't1' });
    }
  });

  // @spec SIT-SEL-005
  it('backtracks to find a binding whenever one exists', () => {
    // only m1 leads a team, so lead must be m1 however the candidates are shuffled
    const s = sit({
      id: 'lead-and-report',
      roles: [
        { name: 'lead', kind: 'person' },
        {
          name: 'engineer',
          kind: 'person',
          where: c({ all: [{ value: 'engineer.team', is: { value: 'lead.ledTeam' } }, { value: 'engineer.role', is: 'engineer' }] }),
        },
      ],
    });
    for (const seed of seeds(20)) {
      const presented = select(engine(seed), fresh(), [s]).presented;
      expect(presented).toHaveLength(1);
      expect(presented[0]!.bindings.lead).toBe('m1');
    }
    const leaderless = patch(fresh(), (st) => (st.teams.t2!.leader = null));
    expect(select(engine(), leaderless, [s]).presented).toEqual([]);
  });
});

describe('drawing', () => {
  // @spec SIT-SEL-006
  it('draws urgent situations before normal ones', () => {
    const situations = [plain('n1'), plain('u', { priority: 'urgent' }), plain('n2')];
    for (const seed of seeds(20)) expect(ids(select(engine(seed), fresh(), situations, 1))).toEqual(['u']);
    const urgent = [plain('u1', { priority: 'urgent' }), plain('u2', { priority: 'urgent' }), plain('u3', { priority: 'urgent' }), plain('n')];
    for (const seed of seeds(20)) {
      const picked = ids(select(engine(seed), fresh(), urgent, 2));
      expect(picked).toHaveLength(2);
      expect(picked).not.toContain('n');
    }
  });

  // @spec SIT-SEL-006
  it('draws within a priority in proportion to weight', () => {
    const situations = [plain('light', { weight: 1 }), plain('heavy', { weight: 9 })];
    const picks = seeds(300).map((seed) => select(engine(seed), fresh(), situations, 1).presented[0]!.situationId);
    const heavy = picks.filter((id) => id === 'heavy').length;
    expect(heavy).toBeGreaterThan(240);
    expect(heavy).toBeLessThan(300);
  });

  // @spec SIT-SEL-007
  it('selects at most the limit', () => {
    const situations = ['a', 'b', 'c', 'd'].map((id) => plain(id));
    expect(select(engine(), fresh(), situations, 2).presented).toHaveLength(2);
    expect(select(engine(), fresh(), situations, 9).presented).toHaveLength(4);
    expect(select(engine(), fresh(), situations, 0).presented).toEqual([]);
    expect(select(engine(), fresh(), situations, -1).presented).toEqual([]);
  });

  // @spec SIT-SEL-008
  it('binds no person into two situations in a turn', () => {
    const situations = ['a', 'b', 'c'].map((id) => about(id, T2_ENGINEER));
    for (const seed of seeds(20)) {
      const { presented } = select(engine(seed), fresh(), situations, 3);
      expect(presented).toHaveLength(2);
      expect(new Set(presented.map((p) => p.bindings.engineer))).toEqual(new Set(['e4', 'e5']));
    }
  });
});

describe('presenting', () => {
  // @spec SIT-SEL-009
  it('records a selected situation as presented this week and open', () => {
    const sim = patch(fresh(), (s) => (s.week = 6));
    const { engine: eng, presented } = select(engine(), sim, [plain('s')]);
    expect(holds(sim, c({ presented: 's', withinWeeks: 1, is: 1 }), {}, eng)).toBe(true);
    expect(resolve(eng, sim, [plain('s')], presented[0]!, 'ok').kind).toBe('resolved');
  });

  // @spec SIT-SEL-010
  it('returns presentation id, situation id, bindings, day and time, text and offered choices', () => {
    const s = about('s', ONLY_E1);
    s.choices.push({
      id: 'hidden',
      label: 'Never offered',
      availableIf: c({ value: 'engineer.motivation', above: 90 }),
      outcomes: s.choices[0]!.outcomes,
    });
    const p = select(engine(), fresh(), [s]).presented[0]!;
    expect(typeof p.id).toBe('string');
    expect([0, 1, 2, 3, 4]).toContain(p.day);
    expect(['morning', 'afternoon']).toContain(p.time);
    expect(p).toEqual({
      id: p.id,
      situationId: 's',
      bindings: { engineer: 'e1' },
      day: p.day,
      time: p.time,
      text: 'e1 looks tired.',
      choices: [{ id: 'talk', label: 'Talk to e1' }],
    });
  });

  // @spec SIT-SEL-010
  it('gives every presentation in a run a unique id', () => {
    let eng = engine();
    const seen: string[] = [];
    for (let week = 0; week < 5; week++) {
      const result = select(eng, patch(fresh(), (s) => (s.week = week)), [plain('a'), plain('b')]);
      eng = result.engine;
      seen.push(...result.presented.map((p) => p.id));
    }
    expect(seen).toHaveLength(10);
    expect(new Set(seen).size).toBe(10);
  });

  // @spec SIT-SEL-011
  it('draws from its own seeded generator and leaves the simulation generator alone', () => {
    const sim = fresh();
    const before = structuredClone(sim);
    const situations = [about('s', { value: 'engineer.team', is: { value: 'player.team' } })];
    const once = select(engine(4), sim, situations);
    const again = select(engine(4), sim, situations);
    expect(again).toEqual(once);
    expect(once.engine).not.toEqual(engine(4));
    expect(sim).toEqual(before);
  });

  // @spec SIT-SEL-012
  it('closes presentations left open as ignored', () => {
    const sim = patch(fresh(), (s) => (s.week = 2));
    const first = select(engine(), sim, [about('s', ONLY_E1)]);
    const next = select(first.engine, patch(sim, (s) => (s.week = 3)), []);
    expect(debriefsSince(next.engine, 0)).toEqual([{ week: 2, situationId: 's', bindings: { engineer: 'e1' }, status: 'ignored' }]);
    expect(resolve(next.engine, sim, [about('s', ONLY_E1)], first.presented[0]!, 'talk').kind).toBe('error');
  });
});

describe('place in the week', () => {
  const placed = (overrides: Record<string, unknown>, seed: number) => {
    const s = plain('s', overrides);
    return select(engine(seed), fresh(seed), [s]).presented[0]!;
  };

  // @spec SIT-SEL-015
  it('keeps an authored day and time', () => {
    for (const seed of seeds(10)) expect(placed({ day: 'thursday', time: 'night' }, seed)).toMatchObject({ day: 3, time: 'night' });
  });

  // @spec SIT-SEL-015
  it('draws a weekday and a morning or afternoon for whatever is not authored', () => {
    const days = new Set<number>();
    const times = new Set<string>();
    for (const seed of seeds(60)) {
      const p = placed({}, seed);
      days.add(p.day);
      times.add(p.time);
      expect(placed({ day: 'friday' }, seed).day).toBe(4);
      expect(['morning', 'afternoon']).toContain(placed({ day: 'friday' }, seed).time);
      expect(placed({ time: 'night' }, seed).time).toBe('night');
    }
    expect([...days].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    expect([...times].sort()).toEqual(['afternoon', 'morning']);
  });

  // @spec SIT-SEL-015, SIT-SEL-011
  it('draws placements after the selection, so authoring a time leaves who is selected unchanged', () => {
    for (const seed of seeds(20)) {
      const pick = (authored: boolean) =>
        select(engine(seed), fresh(seed), [plain('a', (authored ? { day: 'monday', time: 'morning' } : {}) as never), plain('b'), plain('c')], 2).presented.map((p) => [p.situationId, p.bindings]);
      expect(pick(true)).toEqual(pick(false));
    }
  });
});
