import { describe, expect, it } from 'vitest';
import { PLAYER_ACTION_IDS } from '../../../src/actions';
import { ACTIONS, LINE_TUNING, commitWeek, editCalendar, type ActionId, type NewEntry } from '../../../src/levels/line-manager';
import type { SimState } from '../../../src/sim';
import { centeredRun, commit, edit, effectOf, engineers, expectRejected, nextWeek, only, patch, projects, run, teamOf, withDemand } from './fixtures';

const person = (id: string, action: ActionId, cadence: NewEntry['cadence'] = 'once'): NewEntry => ({ action, target: { kind: 'person', id }, cadence });
const hoursOf = (level: { calendar: unknown[] }, sim: SimState) => commit(level as never, sim).report.hours;

describe('the calendar', () => {
  // @spec LINE-CAL-001
  it('starts with weekly ceremonies and staggered fortnightly 1:1s', () => {
    const { level, sim } = run(1);
    const team = teamOf(sim);
    expect(level.calendar.filter((e) => e.action === 'line-manager.ceremonies')).toMatchObject([{ target: { kind: 'team', id: team }, cadence: 'weekly' }]);
    const ones = level.calendar.filter((e) => e.action === 'line-manager.one-on-one');
    expect(ones.map((e) => e.target)).toEqual(engineers(sim).map((id) => ({ kind: 'person', id })));
    expect(ones.every((e) => e.cadence === 'biweekly')).toBe(true);
    expect(ones.map((e) => e.startWeek)).toEqual([0, 1, 0, 1, 0]);
  });

  // @spec LINE-CAL-002
  it('keeps recurring entries and drops one-off entries after they run', () => {
    let { level, sim } = run(1);
    const e = engineers(sim)[0]!;
    level = only(level, sim, person(e, 'line-manager.coaching', 'weekly'), person(e, 'line-manager.recognition', 'once'));
    ({ level, sim } = commit(level, sim));
    expect(level.calendar.map((x) => x.action)).toEqual(['line-manager.coaching']);
    ({ level, sim } = nextWeek(level, sim));
    ({ level } = commit(level, sim));
    expect(level.calendar.map((x) => x.action)).toEqual(['line-manager.coaching']);
  });

  // @spec LINE-CAL-003
  it('runs an every-other-week entry from its start week, every second week', () => {
    let { level, sim } = run(1);
    const e = engineers(sim)[0]!;
    level = only(level, sim, person(e, 'line-manager.coaching', 'biweekly'), { ...person(e, 'line-manager.recognition', 'biweekly'), startWeek: 1 });
    const ran: string[][] = [];
    for (let week = 0; week < 4; week++) {
      const c = commit(level, sim);
      ran.push(c.log.filter((x) => x.cause.kind === 'action').map((x) => (x.cause as { actionId: string }).actionId).filter((v, i, a) => a.indexOf(v) === i));
      ({ level, sim } = nextWeek(c.level, c.sim));
    }
    expect(ran).toEqual([['line-manager.coaching'], ['line-manager.recognition'], ['line-manager.coaching'], ['line-manager.recognition']]);
  });

  // @spec LINE-CAL-004
  it('rejects entries with unknown actions, wrong targets or a recurring one-off action', () => {
    const { level, sim } = run(1);
    const before = structuredClone(level);
    const project = projects(sim)[0]!;
    const bad: NewEntry[] = [
      { action: 'line-manager.nap' as ActionId, target: { kind: 'player' }, cadence: 'weekly' },
      { action: 'line-manager.coaching', target: { kind: 'project', id: project }, cadence: 'weekly' },
      { action: 'line-manager.coaching', target: { kind: 'person', id: 'nobody' }, cadence: 'weekly' },
      { action: 'line-manager.team-event', target: { kind: 'team', id: teamOf(sim) }, cadence: 'weekly' },
      { action: 'line-manager.coaching', target: { kind: 'person', id: engineers(sim)[0]! }, cadence: 'biweekly', startWeek: 5 },
    ];
    for (const entry of bad) {
      const result = editCalendar(level, sim, { add: [entry] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(entry.action.split('.')[1]!);
      expect(level).toEqual(before);
    }
  });

  // @spec LINE-CAL-009
  it('accepts any action for this week only', () => {
    const { level, sim } = run(1);
    const e = engineers(sim)[0]!;
    for (const action of Object.keys(ACTIONS) as ActionId[]) {
      const target =
        ACTIONS[action].target === 'person' ? { kind: 'person' as const, id: e }
        : ACTIONS[action].target === 'team' ? { kind: 'team' as const, id: teamOf(sim) }
        : ACTIONS[action].target === 'project' ? { kind: 'project' as const, id: projects(sim)[0]! }
        : ACTIONS[action].target === 'player' ? { kind: 'player' as const }
        : undefined;
      if (!target) continue; // vacancies need an open vacancy; see hiring tests
      expect(editCalendar(level, sim, { add: [{ action, target, cadence: 'once' }] }).ok).toBe(true);
    }
  });

  // @spec LINE-CAL-005
  it('drops entries whose target is no longer valid, charging nothing', () => {
    const { level, sim } = run(1);
    const [a, b] = engineers(sim) as [string, string];
    const l = only(level, sim, person(a, 'line-manager.coaching', 'weekly'), person(b, 'line-manager.coaching', 'weekly'));
    const gone = patch(sim, (s) => (s.people[a]!.status = 'departed'));
    const c = commit(l, gone);
    expect(c.report.dropped).toEqual([{ entryId: l.calendar[0]!.id, reason: expect.stringMatching(/no longer/) }]);
    expect(c.report.hours).toBe(ACTIONS['line-manager.coaching'].hours);
    expect(c.level.calendar.map((e) => e.target)).toEqual([{ kind: 'person', id: b }]);

    const project = projects(sim)[0]!;
    const planned = only(level, sim, { action: 'line-manager.project-planning', target: { kind: 'project', id: project }, cadence: 'weekly' });
    const done = patch(sim, (s) => (s.projects[project]!.status = 'completed'));
    expect(commit(planned, done).report.dropped).toHaveLength(1);
    // removed even in a week the entry would not run, so the calendar never shows it
    const offWeek = only(level, sim, { ...person(a, 'line-manager.coaching', 'biweekly'), startWeek: 1 });
    const off = commit(offWeek, gone);
    expect(off.report.dropped).toHaveLength(1);
    expect(off.report.hours).toBe(0);
    expect(off.level.calendar).toEqual([]);
  });

  // @spec LINE-CAL-006
  it('charges the hours of entries that run and of demands handled or accepted', () => {
    const { level, sim } = run(1);
    const e = engineers(sim)[0]!;
    const l = only(level, sim, person(e, 'line-manager.coaching', 'weekly'), { ...person(e, 'line-manager.recognition', 'biweekly'), startWeek: 1 });
    expect(hoursOf(l, sim)).toBe(ACTIONS['line-manager.coaching'].hours);
  });

  // @spec LINE-CAL-007
  it('rejects a week over the budget plus the overtime cap', () => {
    const { level, sim } = run(1);
    const e = engineers(sim)[0]!;
    const limit = LINE_TUNING.weeklyHours + LINE_TUNING.overtimeCapHours;
    const n = Math.floor(limit / ACTIONS['line-manager.coaching'].hours) + 1;
    const l = only(level, sim, ...Array.from({ length: n }, () => person(e, 'line-manager.coaching')));
    const before = structuredClone({ l, sim });
    const result = commitWeek(l, sim, {});
    expectRejected(result, l, sim, before.l, before.sim);
  });

  // @spec LINE-CAL-008
  it('raises the player stress for each hour of overtime', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const hours = ACTIONS['line-manager.coaching'].hours;
    const entries = (n: number) => Array.from({ length: n }, () => person(e, 'line-manager.coaching'));
    const atBudget = Math.floor(LINE_TUNING.weeklyHours / hours);
    const within = commit(only(level, sim, ...entries(atBudget)), sim);
    const over = commit(only(level, sim, ...entries(atBudget + 2)), sim);
    expect(within.report.overtime).toBe(0);
    expect(over.report.overtime).toBe(atBudget * hours + 2 * hours - LINE_TUNING.weeklyHours);
    expect(over.sim.player.stress - within.sim.player.stress).toBe(over.report.overtime * LINE_TUNING.overtimeStressPerHour);
  });
});

describe('actions', () => {
  // @spec LINE-ACT-001
  it('submits the week’s actions as one batch caused by each action', () => {
    const { level, sim } = centeredRun(1);
    const [a, b] = engineers(sim) as [string, string];
    const { log } = effectOf(level, sim, person(a, 'line-manager.coaching'), person(b, 'line-manager.recognition'));
    const causes = new Set(log.filter((x) => x.cause.kind === 'action').map((x) => (x.cause as { actionId: string }).actionId));
    expect(causes).toEqual(new Set(['line-manager.coaching', 'line-manager.recognition']));
  });

  // @spec LINE-ACT-002
  it('makes a 1:1 raise trust and motivation and learn the want', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const r = effectOf(level, sim, person(e, 'line-manager.one-on-one'));
    expect(r.with.people[e]!.trust).toBeGreaterThan(r.without.people[e]!.trust);
    expect(r.with.people[e]!.motivation).toBeGreaterThan(r.without.people[e]!.motivation);
    const c = commit(only(level, sim, person(e, 'line-manager.one-on-one')), sim);
    expect(c.level.learnedWants[e]).toEqual({ want: sim.people[e]!.want, week: sim.week });
  });

  const servesWant = (action: ActionId, field: 'skill' | 'motivation', want: 'growth' | 'recognition') => () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const r = effectOf(level, sim, person(e, action));
    expect(r.with.people[e]![field]).toBeGreaterThan(r.without.people[e]![field]);
    // it serves the want: someone who wants it has it marked served this week
    const wanting = patch(sim, (s) => (s.people[e]!.want = want));
    const served = commit(only(level, wanting, person(e, action)), wanting).sim;
    expect(served.people[e]!.wantServedWeek).toBe(sim.week);
    return r;
  };

  // @spec LINE-ACT-003
  it('makes coaching raise skill, serving growth', () => void servesWant('line-manager.coaching', 'skill', 'growth')());

  // @spec LINE-ACT-004
  it('makes recognition raise motivation, serving recognition', () => void servesWant('line-manager.recognition', 'motivation', 'recognition')());

  // @spec LINE-ACT-005
  it('makes training raise skill and stress, serving growth', () => {
    const r = servesWant('line-manager.training', 'skill', 'growth')();
    const { sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    expect(r.with.people[e]!.stress).toBeGreaterThan(r.without.people[e]!.stress);
  });

  // @spec LINE-ACT-006
  it('raises project risk in a week without ceremonies', () => {
    const { level, sim } = centeredRun(1);
    const ceremonies: NewEntry = { action: 'line-manager.ceremonies', target: { kind: 'team', id: teamOf(sim) }, cadence: 'weekly' };
    const r = effectOf(level, sim, ceremonies);
    for (const p of projects(sim)) expect(r.without.projects[p]!.risk).toBeGreaterThan(r.with.projects[p]!.risk);
    const log = commit(only(level, sim), sim).log;
    expect(log.some((x) => x.cause.kind === 'rule' && x.field === 'risk')).toBe(true);
  });

  // @spec LINE-ACT-013
  it('makes ceremonies raise motivation, serving stability', () => {
    const { level, sim } = centeredRun(1);
    const stable = patch(sim, (s) => engineers(sim).forEach((id) => (s.people[id]!.want = 'stability')));
    const ceremonies: NewEntry = { action: 'line-manager.ceremonies', target: { kind: 'team', id: teamOf(sim) }, cadence: 'weekly' };
    const r = effectOf(level, stable, ceremonies);
    for (const id of engineers(sim)) {
      expect(r.with.people[id]!.motivation).toBeGreaterThan(r.without.people[id]!.motivation);
      expect(r.with.people[id]!.wantServedWeek).toBe(sim.week);
    }
  });

  // @spec LINE-ACT-007
  it('makes project planning lower risk', () => {
    const { level, sim } = centeredRun(1);
    const p = projects(sim)[0]!;
    const r = effectOf(level, sim, { action: 'line-manager.project-planning', target: { kind: 'project', id: p }, cadence: 'once' });
    expect(r.with.projects[p]!.risk).toBeLessThan(r.without.projects[p]!.risk);
  });

  // @spec LINE-ACT-008
  it('makes scope negotiation cut scope and cost reputation', () => {
    const { level, sim } = centeredRun(1);
    const p = projects(sim)[0]!;
    const r = effectOf(level, sim, { action: 'line-manager.scope-negotiation', target: { kind: 'project', id: p }, cadence: 'once' });
    expect(r.with.projects[p]!.scope).toBeLessThan(r.without.projects[p]!.scope);
    expect(r.with.player.reputation).toBeLessThan(r.without.player.reputation);
  });

  // @spec LINE-ACT-009
  it('makes a team event raise motivation and lower stress across the team', () => {
    const { level, sim } = centeredRun(1);
    const r = effectOf(level, sim, { action: 'line-manager.team-event', target: { kind: 'team', id: teamOf(sim) }, cadence: 'once' });
    for (const id of engineers(sim)) {
      expect(r.with.people[id]!.motivation).toBeGreaterThan(r.without.people[id]!.motivation);
      expect(r.with.people[id]!.stress).toBeLessThan(r.without.people[id]!.stress);
    }
  });

  // @spec LINE-ACT-010
  it('makes recovery time lower the player stress', () => {
    const { level, sim } = centeredRun(1);
    const r = effectOf(level, sim, { action: 'line-manager.recovery', target: { kind: 'player' }, cadence: 'once' });
    expect(r.with.player.stress).toBeLessThan(r.without.player.stress);
  });

  // @spec LINE-ACT-014
  it('uses only action ids from the player action catalogue', () => {
    let { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const intake = withDemand(only(level, sim), { type: 'workIntake', subject: { kind: 'team', id: teamOf(sim) }, lastWeek: 2 });
    const approval = withDemand(intake.level, { type: 'approval', subject: { kind: 'project', id: projects(sim)[0]! }, difficulty: 90, lastWeek: 2 });
    const all = (Object.keys(ACTIONS) as ActionId[]).filter((a) => a !== 'line-manager.interview');
    level = edit(approval.level, sim, { add: all.map((a) => ({ action: a, target: ACTIONS[a].target === 'person' ? { kind: 'person' as const, id: e } : ACTIONS[a].target === 'team' ? { kind: 'team' as const, id: teamOf(sim) } : ACTIONS[a].target === 'project' ? { kind: 'project' as const, id: projects(sim)[0]! } : { kind: 'player' as const }, cadence: 'once' as const })) });
    const accepted = commitWeek(level, sim, { [intake.id]: { kind: 'accept' }, [approval.id]: { kind: 'delegate', to: e } });
    const declined = commitWeek(level, sim, { [intake.id]: { kind: 'decline' } });
    const used = new Set<string>();
    for (const r of [accepted, declined]) {
      if (!r.ok) throw new Error(r.error);
      for (const x of r.log) if (x.cause.kind === 'action') used.add(x.cause.actionId);
    }
    for (const a of Object.keys(ACTIONS)) expect(PLAYER_ACTION_IDS).toContain(a);
    expect(used.size).toBeGreaterThan(all.length);
    for (const a of used) expect(PLAYER_ACTION_IDS).toContain(a);
  });

  // @spec LINE-ACT-012
  it('records actions aimed at a person in their history', () => {
    const { level, sim } = centeredRun(1);
    const e = engineers(sim)[0]!;
    const actions: ActionId[] = ['line-manager.one-on-one', 'line-manager.coaching', 'line-manager.recognition', 'line-manager.training'];
    const after = commit(only(level, sim, ...actions.map((a) => person(e, a))), sim).sim;
    const recorded = after.people[e]!.history.filter((h) => h.cause.kind === 'action').map((h) => (h.cause as { actionId: string }).actionId);
    expect(new Set(recorded)).toEqual(new Set(actions));
  });
});
