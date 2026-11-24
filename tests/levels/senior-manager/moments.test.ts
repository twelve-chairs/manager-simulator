import { describe, expect, it } from 'vitest';
import { SENIOR_TUNING, beginMonth, chooseSenior, endMonth, seniorView, type SeniorMoment, type SeniorState } from '../../../src/levels/senior-manager';
import type { SimState } from '../../../src/sim';
import { senior } from './fixtures';

const T = SENIOR_TUNING;
const leader = (sim: SimState, teamId: string) => (sim.teams[teamId]!.leader as { id: string }).id;
const edit = (sim: SimState, change: (s: SimState) => void) => {
  const copy = structuredClone(sim);
  change(copy);
  return copy;
};
/** A group where nothing calls for a moment: calm teams and calm projects. */
function calm(seed = 1) {
  const { level, sim } = senior(seed);
  const quiet = edit(sim, (s) => {
    for (const t of level.teamIds) Object.assign(s.teams[t]!.aggregate!, { stress: 30, motivation: 60, attritionRisk: 10 });
    for (const p of Object.values(s.projects)) if (level.teamIds.includes(p.teamId)) p.risk = 10;
  });
  return { level, sim: quiet };
}
const kinds = (level: SeniorState) => level.moments.map((m) => m.kind);
/** The level with new work given to teams with room. */
const assigning = (level: SeniorState): SeniorState => ({ ...level, habits: { ...level.habits, newWork: 'assign' } });
const find = (level: SeniorState, kind: SeniorMoment['kind']) => level.moments.find((m) => m.kind === kind)!;
function answer(level: SeniorState, sim: SimState, moment: SeniorMoment, choice: string) {
  const r = chooseSenior(level, sim, moment.id, choice);
  if (!r.ok) throw new Error(r.error);
  return r;
}
const TIMES = { morning: 0, afternoon: 1, night: 2 } as const;

describe('new work assigned', () => {
  // @spec SENIOR-MOMENT-013
  it('has the player\u2019s manager give new work to an idle team with room at the month\u2019s end, under the habit, and says so', () => {
    const { level: asking, sim } = calm(6);
    const level = assigning(asking);
    const t = level.teamIds[2]!;
    const idle = edit(sim, (s) => {
      for (const p of Object.values(s.projects)) if (p.teamId === t) p.status = 'cancelled';
    });
    const ended = endMonth(beginMonth(level, idle), idle);
    if (!ended.ok) throw new Error(ended.error);
    const added = Object.values(ended.sim.projects).filter((p) => p.teamId === t && p.status === 'active');
    expect(added).toHaveLength(1);
    expect((ended.recap as { changes: { assigned: unknown[] } }).changes.assigned).toEqual([{ teamId: t, name: idle.teams[t]!.name, project: added[0]!.name }]);
    // not while the team is strained: then it was the player's call this month
    const strained = edit(idle, (s) => (s.teams[t]!.aggregate!.stress = 70));
    const busy = endMonth(beginMonth(level, strained), strained);
    if (!busy.ok) throw new Error(busy.error);
    expect(Object.values(busy.sim.projects).filter((p) => p.teamId === t && p.status === 'active')).toHaveLength(0);
    // and not under the default habit, where it is a moment
    const asked = endMonth(beginMonth(asking, idle), idle);
    if (!asked.ok) throw new Error(asked.error);
    expect(Object.values(asked.sim.projects).filter((p) => p.teamId === t && p.status === 'active')).toHaveLength(0);
  });
});

describe('a month’s moments', () => {
  // @spec SENIOR-MOMENT-002
  // @spec SENIOR-HABIT-008
  it('names what a skip-level surfaced: a project behind, strain, people looking, low motivation, or shifting priorities', () => {
    const { level, sim } = calm(4);
    const t = level.teamIds[1]!;
    const told = (change: (s: SimState) => void) => {
      const state = edit(sim, change);
      return beginMonth({ ...level, surfaced: [{ teamId: t, week: state.week - 4 }] }, state).moments.find((m) => m.kind === 'surfaced')!.text;
    };
    const p = Object.values(sim.projects).find((x) => x.teamId === t && x.status === 'active')!;
    expect(told((s) => Object.assign(s.projects[p.id]!, { progress: 0, startWeek: s.week - 30, deadlineWeek: s.week + 1 }))).toContain(`${p.name} has been slipping`);
    expect(told((s) => (s.teams[t]!.aggregate!.stress = 70))).toMatch(/wearing everyone down/);
    expect(told((s) => (s.teams[t]!.aggregate!.attritionRisk = 50))).toMatch(/started looking around/);
    expect(told((s) => (s.teams[t]!.aggregate!.motivation = 15))).toMatch(/why the work matters/);
    expect(told(() => {})).toMatch(/priorities keep changing/);
  });

  it('sets each moment in a week, day and time of the month, in order through the month', () => {
    const { level, sim } = calm(1);
    const [a, b, c] = level.teamIds;
    const busy = edit(sim, (s) => {
      s.teams[a!]!.aggregate!.stress = 80;
      s.teams[b!]!.aggregate!.stress = 10;
      for (const p of Object.values(s.projects)) if (p.teamId !== c) p.risk = 60;
    });
    const moments = beginMonth(level, busy).moments;
    expect(moments.length).toBeGreaterThan(1);
    const keys = moments.map((m) => m.week * 100 + m.day * 10 + TIMES[m.time]);
    expect(keys).toEqual([...keys].sort((x, y) => x - y));
    for (const m of moments) {
      expect(m.week).toBeGreaterThanOrEqual(0);
      expect(m.week).toBeLessThanOrEqual(3);
      expect(m.day).toBeGreaterThanOrEqual(0);
      expect(m.day).toBeLessThanOrEqual(4);
    }
    expect(moments.length).toBeLessThanOrEqual(T.momentCap);
  });

  // @spec SENIOR-MOMENT-003
  it('brings an escalation from a team under strain or with a project behind, with coach, step in or let them', () => {
    const { level, sim } = calm(2);
    expect(kinds(beginMonth(level, sim))).not.toContain('escalation');
    const t = level.teamIds[1]!;
    const strained = beginMonth(level, edit(sim, (s) => (s.teams[t]!.aggregate!.stress = 75)));
    const e = find(strained, 'escalation');
    expect(e).toMatchObject({ teamId: t, status: 'open' });
    expect(e.choices.map((c) => c.id)).toEqual(['coach', 'stepIn', 'letThem']);
    // twelve weeks on with no progress, every project is behind schedule
    const behind = beginMonth(level, edit(sim, (s) => (s.week += 12)));
    expect(kinds(behind)).toContain('escalation');
  });

  // @spec SENIOR-MOMENT-004
  it('fixes the problem by stepping in at a cost and no growth, by coaching a developing manager more cheaply, or by leaving it to a capable one', () => {
    const { level, sim } = calm(3);
    const t = level.teamIds[1]!;
    const m = leader(sim, t);
    const setup = (skill: number) => edit(sim, (s) => {
      s.teams[t]!.aggregate!.stress = 75;
      s.people[m]!.skill = skill;
    });
    const go = (skill: number, choice: string) => {
      const s = setup(skill);
      const l = beginMonth(level, s);
      return { before: s, after: answer(l, s, find(l, 'escalation'), choice).sim };
    };
    const step = go(30, 'stepIn');
    expect(step.after.teams[t]!.aggregate!.stress).toBe(75 - T.stepInFix);
    expect(step.after.player.stress - step.before.player.stress).toBe(T.stepInEnergy);
    expect(step.after.people[m]!.skill).toBe(30);
    const coached = go(30, 'coach');
    expect(coached.after.teams[t]!.aggregate!.stress).toBe(75 - T.coachFix);
    expect(coached.after.people[m]!.skill).toBe(30 + T.coachGrowth);
    expect(coached.after.player.stress - coached.before.player.stress).toBe(T.coachEnergy);
    expect(T.coachEnergy).toBeLessThan(T.stepInEnergy);
    expect(go(10, 'coach').after.teams[t]!.aggregate!.stress).toBe(75);
    expect(go(50, 'letThem').after.teams[t]!.aggregate!.stress).toBe(75 - T.coachFix);
    expect(go(30, 'letThem').after.teams[t]!.aggregate!.stress).toBe(75);
  });

  // @spec SENIOR-MOMENT-005
  it('offers to move a head from a calm team to a strained one, hire, or decline', () => {
    const { level, sim } = calm(4);
    const [a, b, c] = level.teamIds;
    const setup = (bStress: number) => edit(sim, (s) => {
      s.teams[a!]!.aggregate!.stress = 75;
      s.teams[b!]!.aggregate!.stress = bStress;
      s.teams[c!]!.aggregate!.stress = 50;
    });
    const s1 = setup(15);
    const l1 = beginMonth(level, s1);
    const req = find(l1, 'staffing');
    expect(req).toMatchObject({ teamId: a, otherTeamId: b });
    expect(req.choices.map((x) => x.id)).toEqual(['move', 'hire', 'decline']);
    const moved = answer(l1, s1, req, 'move');
    expect(moved.sim.teams[a!]!.aggregate!.headcount).toBe(s1.teams[a!]!.aggregate!.headcount + 1);
    expect(moved.sim.teams[b!]!.aggregate!.headcount).toBe(s1.teams[b!]!.aggregate!.headcount - 1);
    expect(moved.sim.teams[a!]!.aggregate!.stress).toBe(75 - T.moveRelief);
    expect(moved.sim.people[leader(s1, b!)]!.trust).toBe(s1.people[leader(s1, b!)]!.trust);
    // the move does not count as a lost head to backfill
    expect(moved.level.knownHeadcount[b!]).toBe(moved.sim.teams[b!]!.aggregate!.headcount);
    const s2 = setup(38);
    const l2 = beginMonth(level, s2);
    const stretched = answer(l2, s2, find(l2, 'staffing'), 'move');
    expect(stretched.sim.people[leader(s2, b!)]!.trust).toBe(s2.people[leader(s2, b!)]!.trust - T.moveTrust);
    expect(answer(l1, s1, req, 'hire').level.backfills).toContainEqual(expect.objectContaining({ teamId: a }));
    expect(answer(l1, s1, req, 'decline').sim.teams).toEqual(s1.teams);
  });

  // @spec SENIOR-MOMENT-006
  it('brings a dispute between two teams with projects at risk: agree, decide, or let it run', () => {
    const { level, sim } = calm(5);
    const [a, b] = level.teamIds;
    const pa = Object.values(sim.projects).find((p) => p.teamId === a)!.id;
    const pb = Object.values(sim.projects).find((p) => p.teamId === b)!.id;
    const s = edit(sim, (x) => {
      x.projects[pa]!.risk = 70;
      x.projects[pb]!.risk = 50;
    });
    const l = beginMonth(level, s);
    const d = find(l, 'dispute');
    expect(new Set([d.teamId, d.otherTeamId])).toEqual(new Set([a, b]));
    expect(d.choices.map((x) => x.id)).toEqual(['agree', 'decide', 'letRun']);
    const agreed = answer(l, s, d, 'agree').sim;
    for (const t of [a!, b!]) expect(agreed.people[leader(s, t)]!.skill).toBe(s.people[leader(s, t)]!.skill + T.agreeGrowth);
    // deciding favours the project at greater risk; the other team's manager loses trust
    const decided = answer(l, s, d, 'decide').sim;
    expect(decided.people[leader(s, b!)]!.trust).toBe(s.people[leader(s, b!)]!.trust - T.decideTrust);
    expect(decided.people[leader(s, a!)]!.trust).toBe(s.people[leader(s, a!)]!.trust);
    const ran = answer(l, s, d, 'letRun').sim;
    expect(ran.projects[pa]!.risk).toBe(70 + T.letRunRisk);
    expect(ran.projects[pb]!.risk).toBe(50 + T.letRunRisk);
  });

  // @spec SENIOR-MOMENT-007
  it('offers new work when a strained team has no project: give it to that team, decline, or spread it across all', () => {
    const { level, sim } = calm(6);
    const t = level.teamIds[2]!;
    const idle = edit(sim, (s) => {
      for (const p of Object.values(s.projects)) if (p.teamId === t) p.status = 'cancelled';
      s.teams[t]!.aggregate!.stress = 70;
    });
    // with room, it is still the player's call by default; under the habit of giving work to teams with room, the
    // player's manager gives it at the month's end instead (SENIOR-MOMENT-013)
    const roomy = edit(idle, (s) => (s.teams[t]!.aggregate!.stress = 30));
    expect(kinds(beginMonth(level, roomy))).toContain('newWork');
    expect(kinds(beginMonth(assigning(level), roomy))).not.toContain('newWork');
    expect(kinds(beginMonth(assigning(level), idle))).toContain('newWork');
    const l = beginMonth(level, idle);
    const w = find(l, 'newWork');
    expect(w).toMatchObject({ teamId: t });
    expect(w.choices.map((x) => x.id)).toEqual(['give', 'decline', 'spread']);
    const given = answer(l, idle, w, 'give').sim;
    expect(Object.values(given.projects).filter((p) => p.teamId === t && p.status === 'active')).toHaveLength(1);
    const spread = answer(l, idle, w, 'spread').sim;
    for (const id of level.teamIds) expect(spread.teams[id]!.aggregate!.stress).toBe(idle.teams[id]!.aggregate!.stress + T.spreadStress);
    expect(answer(l, idle, w, 'decline').sim.player.reputation).toBe(idle.player.reputation - T.declineWork);
  });

  // @spec SENIOR-MOMENT-008
  it('brings an approval from a team’s ratings: approving applies it, asking for evidence applies it only for a strict manager', () => {
    const { level, sim } = calm(7);
    const t = level.teamIds[1]!;
    const m = leader(sim, t);
    const rated = edit(sim, (s) => {
      const r = s.teams[t]!.aggregate!.ratings;
      r.unrated -= 1;
      r.exceeds += 1;
    });
    const go = (leniency: number, choice: string) => {
      const l = beginMonth({ ...level, leniency: { ...level.leniency, [m]: leniency } }, rated);
      const a = find(l, 'approval');
      expect(a).toMatchObject({ teamId: t, detail: 'promote' });
      expect(a.choices.map((x) => x.id)).toEqual(['approve', 'evidence', 'refuse']);
      return answer(l, rated, a, choice).sim;
    };
    const fair = go(0, 'approve');
    expect(fair.teams[t]!.aggregate!.ratings.outstanding).toBe(rated.teams[t]!.aggregate!.ratings.outstanding + 1);
    expect(fair.teams[t]!.aggregate!.motivation).toBe(rated.teams[t]!.aggregate!.motivation);
    const lenient = go(2, 'approve');
    expect(lenient.teams[t]!.aggregate!.ratings.outstanding).toBe(rated.teams[t]!.aggregate!.ratings.outstanding + 1);
    expect(lenient.teams[t]!.aggregate!.motivation).toBe(rated.teams[t]!.aggregate!.motivation - T.approvalDip);
    const checked = go(0, 'evidence');
    expect(checked.teams[t]!.aggregate!.ratings.outstanding).toBe(rated.teams[t]!.aggregate!.ratings.outstanding + 1);
    expect(checked.people[m]!.trust).toBe(rated.people[m]!.trust - T.evidenceTrust);
    const caught = go(1, 'evidence');
    expect(caught.teams[t]!.aggregate!.ratings).toEqual(rated.teams[t]!.aggregate!.ratings);
    expect(caught.people[m]!.trust).toBe(rated.people[m]!.trust - T.evidenceTrust);
    expect(go(0, 'refuse').people[m]!.trust).toBe(rated.people[m]!.trust - T.refuseTrust);
    // letting someone go, for a head rated below
    const low = edit(sim, (s) => {
      const r = s.teams[t]!.aggregate!.ratings;
      r.unrated -= 1;
      r.below += 1;
    });
    const l = beginMonth(level, low);
    const letGo = find(l, 'approval');
    expect(letGo).toMatchObject({ detail: 'letGo' });
    const gone = answer(l, low, letGo, 'approve');
    expect(gone.sim.teams[t]!.aggregate!.headcount).toBe(low.teams[t]!.aggregate!.headcount - 1);
    expect(gone.level.knownHeadcount[t]).toBe(gone.sim.teams[t]!.aggregate!.headcount);
    // a team proposes at most once every three months
    const next = edit(rated, (s) => (s.week += 4));
    expect(kinds(beginMonth(beginMonth(level, rated), next))).not.toContain('approval');
  });

  // @spec SENIOR-MOMENT-009
  it('offers a fourth team after a year: promote its manager from a team, or hire one who starts next month', () => {
    const { level, sim } = calm(8);
    expect(kinds(beginMonth(level, edit(sim, (s) => (s.week = level.startWeek + 44))))).not.toContain('restructuring');
    const year = edit(sim, (s) => (s.week = level.startWeek + 48));
    const l = beginMonth(level, year);
    const r = find(l, 'restructuring');
    expect(r.choices.map((x) => x.id)).toEqual(['promoteFromTeam', 'hire']);
    const promoted = answer(l, year, r, 'promoteFromTeam');
    expect(promoted.level.teamIds).toHaveLength(4);
    const fourth = promoted.level.teamIds[3]!;
    expect(promoted.sim.people[leader(promoted.sim, fourth)]!.role).toBe('manager');
    const source = level.teamIds.reduce((x, y) => (year.teams[x]!.aggregate!.skill >= year.teams[y]!.aggregate!.skill ? x : y));
    expect(promoted.sim.teams[source]!.aggregate!.skill).toBe(year.teams[source]!.aggregate!.skill - T.restructureSkill);
    expect(promoted.sim.teams[source]!.aggregate!.headcount).toBe(year.teams[source]!.aggregate!.headcount - 1);
    const hired = answer(l, year, r, 'hire');
    const newTeam = hired.level.teamIds[3]!;
    expect(seniorView(hired.level, hired.sim).teams.find((x) => x.id === newTeam)!.managerId).toBeNull();
    const ended = endMonth(hired.level, hired.sim);
    if (!ended.ok) throw new Error(ended.error);
    const later = edit(ended.sim, (s) => (s.week += 4));
    expect(seniorView(beginMonth(ended.level, later), later).teams.find((x) => x.id === newTeam)!.managerId).not.toBeNull();
    // offered once
    expect(kinds(beginMonth(promoted.level, edit(promoted.sim, (s) => (s.week += 4))))).not.toContain('restructuring');
  });

  // @spec SENIOR-MOMENT-010
  it('rejects a choice for a moment that is not open or not offered, changing nothing', () => {
    const { level, sim } = calm(9);
    const t = level.teamIds[0]!;
    const s = edit(sim, (x) => (x.teams[t]!.aggregate!.stress = 75));
    const l = beginMonth(level, s);
    const e = find(l, 'escalation');
    expect(chooseSenior(l, s, 'nope', 'coach').ok).toBe(false);
    expect(chooseSenior(l, s, e.id, 'dance').ok).toBe(false);
    const done = answer(l, s, e, 'coach');
    expect(done.level.moments.find((m) => m.id === e.id)!.status).toBe('answered');
    expect(chooseSenior(done.level, done.sim, e.id, 'coach').ok).toBe(false);
    expect(typeof done.reaction).toBe('string');
    expect(done.reaction.length).toBeGreaterThan(0);
  });

  // @spec SENIOR-MOMENT-011
  it('closes the moments left unanswered at the month’s end as waited', () => {
    const { level, sim } = calm(10);
    const s = edit(sim, (x) => (x.teams[level.teamIds[0]!]!.aggregate!.stress = 75));
    const l = beginMonth(level, s);
    const r = endMonth(l, s);
    if (!r.ok) throw new Error(r.error);
    expect(r.level.moments.length).toBeGreaterThan(0);
    for (const m of r.level.moments) expect(m.status).toBe('waited');
  });
});
