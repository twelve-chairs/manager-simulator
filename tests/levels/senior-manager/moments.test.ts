import { describe, expect, it } from 'vitest';
import { SENIOR_TUNING, beginMonth, chooseSenior, endMonth, seniorView, type SeniorMoment, type SeniorRecap, type SeniorState } from '../../../src/levels/senior-manager';
import type { SimState } from '../../../src/sim';
import { EVERYDAY_ISSUES } from '../../../src/levels/senior-manager/moments';
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

describe('new work between offers', () => {
  // @spec SENIOR-MOMENT-026
  it('gives an idle team with room ordinary work between offers while the player decides each one, and holds it for an offer that is due', () => {
    const { level, sim } = calm(6);
    const t = level.teamIds[2]!;
    const idle = edit(sim, (s) => {
      for (const p of Object.values(s.projects)) if (p.teamId === t) p.status = 'cancelled';
    });
    const active = (x: SimState) => Object.values(x.projects).filter((p) => p.teamId === t && p.status === 'active');
    // an offer was made last month: this month the team is given ordinary work, and the recap says so
    const offered = { ...level, lastNewWorkOffer: idle.week - T.weeksPerMonth, newWorkTaken: true };
    const begun = beginMonth(offered, idle);
    expect(kinds(begun)).not.toContain('newWork');
    const ended = endMonth(begun, idle);
    if (!ended.ok) throw new Error(ended.error);
    expect(active(ended.sim)).toHaveLength(1);
    expect((ended.recap as { changes: { assigned: unknown[] } }).changes.assigned).toHaveLength(1);
    // an offer due next month: the team waits for it
    // last offer declined: no ordinary work until the player takes one
    const declined = endMonth(beginMonth({ ...offered, newWorkTaken: false }, idle), idle);
    if (!declined.ok) throw new Error(declined.error);
    expect(active(declined.sim)).toHaveLength(0);
    const due = { ...level, lastNewWorkOffer: idle.week + T.weeksPerMonth - T.newWorkOfferWeeks, newWorkTaken: true };
    const waiting = endMonth({ ...beginMonth(due, idle), moments: [] }, idle);
    if (!waiting.ok) throw new Error(waiting.error);
    expect(active(waiting.sim)).toHaveLength(0);
  });
});

describe('a month’s moments', () => {
  // @spec SENIOR-MOMENT-002
  // @spec SENIOR-HABIT-008
  it('names what a skip-level surfaced: a project behind, strain, people looking, low motivation, or an everyday friction', () => {
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
    // nothing badly wrong: an everyday friction, a different one another month
    const everyday = told(() => {});
    expect(everyday).toMatch(/engineers told you .+\. .+ hasn't mentioned it/);
    expect(told((s) => (s.week += 4))).not.toBe(everyday);
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
    const later = edit(sim, (s) => (s.week += 12));
    const behind = beginMonth(level, later);
    expect(kinds(behind)).toContain('escalation');
    // and an escalation about a project behind names it, with its progress and deadline
    const slipping = behind.moments.filter((m) => m.kind === 'escalation').find((m) => / is slipping: /.test(m.text))!;
    const p = Object.values(later.projects).find((x) => slipping.text.includes(`${x.name} is slipping`))!;
    expect(slipping.text).toContain(`${p.name} is slipping: ${p.progress} of ${p.scope} done, due week ${p.deadlineWeek + 1}, in ${p.deadlineWeek - later.week} weeks.`);
    expect(slipping.projectId).toBe(p.id);
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
    const agreeing = answer(l, s, d, 'agree');
    const agreed = agreeing.sim;
    for (const t of [a!, b!]) expect(agreed.people[leader(s, t)]!.skill).toBe(s.people[leader(s, t)]!.skill + T.agreeGrowth);
    // agreeing eases both projects, and says the shared work is planned
    expect(agreed.projects[pa]!.risk).toBe(70 - T.agreeRelief);
    expect(agreed.projects[pb]!.risk).toBe(50 - T.agreeRelief);
    expect(agreeing.reaction).toMatch(/plan/);
    // deciding eases the winning project by more than agreeing eases each
    expect(answer(l, s, d, 'decide').sim.projects[pa]!.risk).toBe(70 - T.decideRelief);
    expect(T.decideRelief).toBeGreaterThan(T.agreeRelief);
    // deciding favours the project at greater risk; the other team's manager loses trust
    const decided = answer(l, s, d, 'decide').sim;
    expect(decided.people[leader(s, b!)]!.trust).toBe(s.people[leader(s, b!)]!.trust - T.decideTrust);
    expect(decided.people[leader(s, a!)]!.trust).toBe(s.people[leader(s, a!)]!.trust);
    const ran = answer(l, s, d, 'letRun').sim;
    expect(ran.projects[pa]!.risk).toBe(70 + T.letRunRisk);
    expect(ran.projects[pb]!.risk).toBe(50 + T.letRunRisk);
  });

  // @spec SENIOR-MOMENT-014
  it('keeps a dispute the player agreed or decided settled for a quarter, and one let run open', () => {
    const { level, sim } = calm(5);
    const [a, b, c] = level.teamIds as [string, string, string];
    const first = (t: string) => Object.values(sim.projects).find((p) => p.teamId === t)!.id;
    const risky = (risks: [number, number, number]) => edit(sim, (x) => [a, b, c].forEach((t, i) => (x.projects[first(t)]!.risk = risks[i]!)));
    const pair = (m: SeniorMoment) => new Set([m.teamId, m.otherTeamId]);
    const later = (s: SimState, weeks: number) => edit(s, (x) => (x.week += weeks));

    const s = risky([70, 60, 10]);
    const l = beginMonth(level, s);
    for (const choice of ['agree', 'decide']) {
      const settled = answer(l, s, find(l, 'dispute'), choice);
      // a month later both projects are still at risk, but the two teams settled it
      const keepRisk = (x: SimState) => edit(x, (y) => ((y.projects[first(a)]!.risk = 70), (y.projects[first(b)]!.risk = 60)));
      expect(kinds(beginMonth(settled.level, later(keepRisk(settled.sim), 4)))).not.toContain('dispute');
      expect(kinds(beginMonth(settled.level, later(keepRisk(settled.sim), T.disputeSettledWeeks - 1)))).not.toContain('dispute');
      // a quarter on, it can come back
      const back = beginMonth(settled.level, later(keepRisk(settled.sim), T.disputeSettledWeeks));
      expect(pair(find(back, 'dispute'))).toEqual(new Set([a, b]));
    }
    // letting it run settles nothing
    const ran = answer(l, s, find(l, 'dispute'), 'letRun');
    expect(pair(find(beginMonth(ran.level, later(ran.sim, 4)), 'dispute'))).toEqual(new Set([a, b]));

    // with the riskiest pair settled, the dispute falls to the riskiest team's next partner
    const three = risky([70, 60, 50]);
    const l3 = beginMonth(level, three);
    expect(pair(find(l3, 'dispute'))).toEqual(new Set([a, b]));
    const settled = answer(l3, three, find(l3, 'dispute'), 'agree');
    const again = edit(settled.sim, (y) => [a, b, c].forEach((t, i) => (y.projects[first(t)]!.risk = [70, 60, 50][i]!)));
    expect(pair(find(beginMonth(settled.level, later(again, 4)), 'dispute'))).toEqual(new Set([a, c]));
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
    expect(w.choices.map((x) => x.id).filter((id) => !id.startsWith('giveTo:'))).toEqual(['give', 'giveAlways', 'decline', 'spread']);
    expect(w.choices[0]!.label).toContain(idle.teams[t]!.name);
    const always = answer(l, idle, w, 'giveAlways');
    expect(Object.values(always.sim.projects).filter((p) => p.teamId === t && p.status === 'active')).toHaveLength(1);
    expect(always.level.habits.newWork).toBe('assign');
    const given = answer(l, idle, w, 'give').sim;
    expect(Object.values(given.projects).filter((p) => p.teamId === t && p.status === 'active')).toHaveLength(1);
    const spread = answer(l, idle, w, 'spread').sim;
    for (const id of level.teamIds) expect(spread.teams[id]!.aggregate!.stress).toBe(idle.teams[id]!.aggregate!.stress + T.spreadStress);
    // declining costs reputation, by how much depending on the kind of offer (SENIOR-MOMENT-016)
    expect(answer(l, idle, w, 'decline').sim.player.reputation).toBeLessThan(idle.player.reputation);
  });

  // @spec SENIOR-MOMENT-023
  it('offers a launch to other teams too, each with its load, and a stronger team carries it at less risk', () => {
    const { level, sim } = calm(6);
    const t = level.teamIds[2]!;
    const idle = edit(sim, (s) => {
      for (const p of Object.values(s.projects)) if (p.teamId === t) p.status = 'cancelled';
    });
    const l = beginMonth({ ...level, newWorkOffers: 0 }, idle);
    const w = find(l, 'newWork');
    expect(w.offer).toBe('launch');
    const others = w.choices.filter((c) => c.id.startsWith('giveTo:'));
    expect(others.map((c) => c.id.slice('giveTo:'.length)).sort()).toEqual(level.teamIds.filter((x) => x !== t).slice(0, T.newWorkOtherTeams).sort());
    for (const c of [w.choices[0]!, ...others]) expect(c.label).toMatch(/(nothing on|projects? on), (calm|steady|busy|strained|overwhelmed), an? \w+ team\)$/);
    // given to another team, the project is theirs
    const o = others[0]!.id.slice('giveTo:'.length);
    const before = Object.keys(idle.projects);
    const r = answer(l, idle, w, others[0]!.id);
    const started = Object.values(r.sim.projects).filter((p) => !before.includes(p.id));
    expect(started).toHaveLength(1);
    expect(started[0]!.teamId).toBe(o);
    expect(r.sim.player.reputation).toBe(Math.min(100, idle.player.reputation + T.launchReputation));
    // the same draw on a strong team carries less risk than on a weak one
    const risk = (skill: number) => {
      const set = edit(idle, (s) => (s.teams[t]!.aggregate!.skill = skill));
      const g = answer(l, set, w, 'give').sim;
      return Object.values(g.projects).find((p) => !before.includes(p.id))!.risk;
    };
    expect(risk(80)).toBeLessThan(risk(20));
    // the idle team's own project is theirs alone
    const own = beginMonth({ ...level, newWorkOffers: 2 }, idle);
    expect(find(own, 'newWork').choices.some((c) => c.id.startsWith('giveTo:'))).toBe(false);
  });

  // @spec SENIOR-MOMENT-022
  it('holds a month to a few everyday moments, and one held back keeps its turn', () => {
    const { level, sim } = calm(7);
    const [a, b, c] = level.teamIds as [string, string, string];
    // a skip-level problem, an approval and new work all due at once
    const busy = edit(sim, (s) => {
      const r = s.teams[b]!.aggregate!.ratings;
      r.unrated -= 1;
      r.exceeds += 1;
      for (const p of Object.values(s.projects)) if (p.teamId === c) p.status = 'cancelled';
    });
    const start = { ...level, surfaced: [{ teamId: a, week: sim.week - 1 }], newWorkOffers: 0 };
    const l = beginMonth(start, busy);
    const everyday = kinds(l).filter((k) => ['surfaced', 'staffing', 'dispute', 'approval', 'newWork'].includes(k));
    expect(everyday).toEqual(['surfaced', 'approval']);
    // the new work held back did not use its turn or its quarter: it comes next month, still a launch
    expect(l.newWorkOffers ?? 0).toBe(0);
    expect(l.lastNewWorkOffer).toBe(start.lastNewWorkOffer);
    const next = beginMonth({ ...l, moments: [], surfaced: [] }, edit(busy, (s) => (s.week += T.weeksPerMonth)));
    expect(find(next, 'newWork').offer).toBe('launch');
    // an approval held back keeps its cooldown untouched
    const crowded = beginMonth({ ...start, surfaced: [{ teamId: a, week: sim.week - 1 }], settledDisputes: [] }, edit(busy, (s) => {
      for (const p of Object.values(s.projects)) if (p.teamId === a) Object.assign(p, { status: 'active', risk: 60 });
      for (const p of Object.values(s.projects)) if (p.teamId === b) Object.assign(p, { status: 'active', risk: 60 });
    }));
    expect(kinds(crowded).filter((k) => k !== 'escalation')).toEqual(['surfaced', 'dispute']);
    expect(crowded.lastApproval[b]).toBe(start.lastApproval[b]);
    expect(l.lastApproval[b]).toBe(busy.week);
  });

  // @spec SENIOR-MOMENT-024
  it('lets stepping in pull a slipping project back at once, and coaching only while there is time before its deadline', () => {
    const { level, sim } = calm(2);
    const later = edit(sim, (s) => (s.week += 12));
    const l = beginMonth(level, later);
    const e = l.moments.filter((m) => m.kind === 'escalation').find((m) => m.projectId)!;
    const p = later.projects[e.projectId!]!;
    const progress = (r: { sim: SimState }) => r.sim.projects[p.id]!.progress;
    const withDeadline = (weeks: number, skill: number) =>
      edit(later, (s) => {
        s.projects[p.id]!.deadlineWeek = s.week + weeks;
        s.people[leader(s, e.teamId!)]!.skill = skill;
      });
    // stepping in recovers it whatever the deadline, at the player's energy
    const near = withDeadline(T.urgentWeeks, 50);
    const stepped = answer(l, near, e, 'stepIn');
    expect(progress(stepped)).toBe(p.progress + Math.round(p.scope * T.stepInRecovery));
    expect(stepped.sim.player.stress).toBeGreaterThan(near.player.stress);
    // coaching a developing manager recovers it with time to spare, not when it is due soon
    const far = withDeadline(T.urgentWeeks + 1, 50);
    expect(progress(answer(l, far, e, 'coach'))).toBe(p.progress + Math.round(p.scope * T.coachRecovery));
    const coachedNear = answer(l, near, e, 'coach');
    expect(progress(coachedNear)).toBe(p.progress);
    expect(coachedNear.reaction).toMatch(/too soon/);
    // and the manager still grows from it
    expect(coachedNear.sim.people[leader(near, e.teamId!)]!.skill).toBe(50 + T.coachGrowth);
    // left with a capable manager, likewise only with time to spare
    expect(progress(answer(l, withDeadline(T.urgentWeeks + 1, 70), e, 'letThem'))).toBe(p.progress + Math.round(p.scope * T.coachRecovery));
    expect(progress(answer(l, withDeadline(T.urgentWeeks, 70), e, 'letThem'))).toBe(p.progress);
  });

  // @spec SENIOR-MOMENT-017
  it('offers new work at most once a quarter while the player decides each offer, except for a strained team', () => {
    const { level, sim } = calm(6);
    const t = level.teamIds[2]!;
    const idleAt = (week: number, stress = 30) =>
      edit(sim, (s) => {
        s.week = week;
        s.teams[t]!.aggregate!.stress = stress;
        for (const p of Object.values(s.projects)) {
          if (p.teamId === t) p.status = 'cancelled';
          else Object.assign(p, { startWeek: s.week - 4, deadlineWeek: s.week + 40, progress: p.scope / 2 });
        }
      });
    const w0 = level.startWeek + 3 * T.weeksPerMonth;
    const first = beginMonth(level, idleAt(w0));
    expect(kinds(first)).toContain('newWork');
    // the month after, and the one after that: no offer yet
    expect(kinds(beginMonth(first, idleAt(w0 + T.weeksPerMonth)))).not.toContain('newWork');
    expect(kinds(beginMonth(first, idleAt(w0 + 2 * T.weeksPerMonth)))).not.toContain('newWork');
    // a quarter on, the next one
    expect(kinds(beginMonth(first, idleAt(w0 + T.newWorkOfferWeeks)))).toContain('newWork');
    // a strained idle team still brings it to the player
    expect(kinds(beginMonth(first, idleAt(w0 + T.weeksPerMonth, 70)))).toContain('newWork');
  });

  // @spec SENIOR-MOMENT-015, SENIOR-MOMENT-016
  it('makes successive offers a launch, a handover and the idle team’s own project in turn, each taken and declined at its own cost', () => {
    const { level, sim } = calm(6);
    const t = level.teamIds[2]!;
    const idleAt = (months: number) =>
      edit(sim, (s) => {
        s.week = level.startWeek + months * T.weeksPerMonth;
        for (const p of Object.values(s.projects)) {
          if (p.teamId === t) p.status = 'cancelled';
          else Object.assign(p, { startWeek: s.week - 4, deadlineWeek: s.week + 40, progress: p.scope / 2 });
        }
      });
    // offers in succession, as far apart as offers come: each a different kind
    let carried = level;
    const offers = [0, 1, 2].map((i) => {
      const state = idleAt(3 + (i * T.newWorkOfferWeeks) / T.weeksPerMonth);
      const l = beginMonth(carried, state);
      carried = { ...l, moments: [] };
      return { state, l, w: find(l, 'newWork') };
    });
    const titles = offers.map((o) => o.w.title);
    expect(new Set(titles).size).toBe(3);
    const of = (kind: string) => offers.find((o) => o.w.offer === kind)!;
    expect(of('launch').w.title).toMatch(/launch/);
    expect(of('handover').w.title).toMatch(/handover/);
    expect(of('own').w.text).toContain(sim.teams[t]!.name);
    // each choice says what it gains or costs for that kind, and the reaction says what it did
    const label = (o: { w: SeniorMoment }, id: string) => o.w.choices.find((c) => c.id === id)!.label;
    expect(label(of('launch'), 'give')).toMatch(/standing/);
    expect(label(of('launch'), 'decline')).toMatch(/standing|noticed/);
    expect(label(of('handover'), 'give')).toMatch(/tech debt/);
    expect(label(of('own'), 'decline')).toContain(sim.teams[t]!.name);
    expect(new Set(offers.map((o) => label(o, 'give'))).size).toBe(3);
    expect(answer(of('handover').l, of('handover').state, of('handover').w, 'give').reaction).toMatch(/debt/);
    expect(answer(of('own').l, of('own').state, of('own').w, 'decline').reaction).toContain(sim.teams[t]!.name);
    // taken
    const launch = of('launch');
    expect(answer(launch.l, launch.state, launch.w, 'give').sim.player.reputation).toBe(launch.state.player.reputation + T.launchReputation);
    const handover = of('handover');
    const taken = answer(handover.l, handover.state, handover.w, 'give').sim;
    expect(Object.values(taken.projects).find((p) => p.teamId === t && p.status === 'active')!.techDebt).toBe(T.handoverTechDebt);
    const own = of('own');
    expect(answer(own.l, own.state, own.w, 'give').sim.teams[t]!.aggregate!.motivation).toBe(own.state.teams[t]!.aggregate!.motivation + T.ownProjectMotivation);
    // declined
    expect(answer(launch.l, launch.state, launch.w, 'decline').sim.player.reputation).toBe(launch.state.player.reputation - T.launchDecline);
    expect(answer(handover.l, handover.state, handover.w, 'decline').sim.player.reputation).toBe(handover.state.player.reputation - T.handoverDecline);
    const turned = answer(own.l, own.state, own.w, 'decline').sim;
    expect(turned.player.reputation).toBe(own.state.player.reputation - T.declineWork);
    expect(turned.teams[t]!.aggregate!.motivation).toBe(own.state.teams[t]!.aggregate!.motivation - T.ownProjectDeclineMotivation);
    expect(T.launchDecline).toBeGreaterThan(T.declineWork);
    expect(T.handoverDecline).toBeLessThan(T.declineWork);
  });

  // @spec SENIOR-MOMENT-021, SENIOR-MOMENT-025
  it('brings at most one approval a month across the group, and none until the group spacing has passed', () => {
    const { level, sim } = calm(7);
    // every team has someone to propose
    const rated = edit(sim, (s) => {
      for (const t of level.teamIds) {
        const r = s.teams[t]!.aggregate!.ratings;
        const from = r.unrated > 0 ? 'unrated' : 'meets';
        r[from] -= 1;
        r.exceeds += 1;
      }
    });
    const first = beginMonth(level, rated);
    expect(first.moments.filter((m) => m.kind === 'approval')).toHaveLength(1);
    // the next month, another team's turn
    const a = first.moments.find((m) => m.kind === 'approval')!;
    // the month after: too soon for another anywhere in the group
    expect(beginMonth({ ...first, moments: [] }, edit(rated, (s) => (s.week += T.weeksPerMonth))).moments.filter((m) => m.kind === 'approval')).toHaveLength(0);
    const next = beginMonth({ ...first, moments: [] }, edit(rated, (s) => (s.week += T.approvalGroupWeeks)));
    const b = next.moments.filter((m) => m.kind === 'approval');
    expect(b).toHaveLength(1);
    expect(b[0]!.teamId).not.toBe(a.teamId);
  });

  // @spec SENIOR-MOMENT-020
  it('recalls in a manager’s next approval how the evidence went last time', () => {
    const { level, sim } = calm(7);
    const t = level.teamIds[1]!;
    const m = leader(sim, t);
    const who = sim.people[m]!.name;
    const rated = edit(sim, (s) => {
      const r = s.teams[t]!.aggregate!.ratings;
      r.unrated -= 1;
      r.exceeds += 1;
    });
    const textAfter = (leniency: number) => {
      const l = beginMonth({ ...level, leniency: { ...level.leniency, [m]: leniency } }, rated);
      const r = answer(l, rated, find(l, 'approval'), 'evidence');
      const later = edit(r.sim, (s) => {
        s.week += T.approvalCooldownWeeks + 1;
        // another head rated exceeds, so there is someone to propose
        const rr = s.teams[t]!.aggregate!.ratings;
        const from = rr.unrated > 0 ? 'unrated' : 'meets';
        rr[from] -= 1;
        rr.exceeds += 1;
      });
      const next = beginMonth({ ...r.level, moments: [] }, later).moments.find((x) => x.kind === 'approval' && x.teamId === t)!;
      return next.text;
    };
    expect(textAfter(0)).toContain(`Last time you asked ${who} for the evidence, they had the case ready.`);
    expect(textAfter(2)).toContain(`Last time you asked ${who} for the evidence, the case wasn't there.`);
    // a first request says nothing of a last time
    expect(find(beginMonth(level, rated), 'approval').text).not.toMatch(/Last time/);
  });

  // @spec SENIOR-RECAP-005
  it('says in the next month’s recap what came of an approval, in words matching what the answer did', () => {
    const { level, sim } = calm(7);
    const t = level.teamIds[1]!;
    const m = leader(sim, t);
    const who = sim.people[m]!.name;
    const rated = edit(sim, (s) => {
      const r = s.teams[t]!.aggregate!.ratings;
      r.unrated -= 1;
      r.exceeds += 1;
    });
    const nextMonth = (leniency: number, choice: string) => {
      const l = beginMonth({ ...level, leniency: { ...level.leniency, [m]: leniency } }, rated);
      const r = answer(l, rated, find(l, 'approval'), choice);
      const ended = endMonth(r.level, r.sim);
      if (!ended.ok) throw new Error(ended.error);
      // nothing yet in the month it was answered
      expect((ended.recap as SeniorRecap).changes.followUps).toEqual([]);
      const later = edit(ended.sim, (s) => (s.week += T.weeksPerMonth));
      const after = endMonth(beginMonth(ended.level, later), later);
      if (!after.ok) throw new Error(after.error);
      return (after.recap as SeniorRecap).changes.followUps;
    };
    expect(nextMonth(0, 'approve')).toEqual([`The promotion you signed for ${who} has settled in, ${sim.teams[t]!.name} took it well, and ${who} trusts you more for backing them.`]);
    expect(nextMonth(2, 'approve')[0]).toMatch(/still wonders what the promotion/);
    expect(nextMonth(0, 'evidence')[0]).toMatch(/had the case for the promotion all along; being asked for it cost a little of their trust/);
    expect(nextMonth(2, 'evidence')[0]).toMatch(/didn't go ahead/);
    expect(nextMonth(0, 'refuse')[0]).toMatch(/trusts you a little less/);
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
    // backing a strict manager's judgement earns a little of their trust
    expect(fair.people[m]!.trust).toBe(Math.min(100, rated.people[m]!.trust + T.approveTrust));
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

describe('skip-level problems that stay settled', () => {
  /** The month after a skip-level with team `t`, with the level's record of settled and unsettled problems given. */
  const surfacedFor = (level: SeniorState, sim: SimState, t: string) => beginMonth({ ...level, surfaced: [{ teamId: t, week: sim.week - 4 }] }, sim).moments.find((m) => m.kind === 'surfaced');

  // @spec SENIOR-HABIT-008, SENIOR-HABIT-011
  it('does not raise a settled friction again for a while, and has nothing to raise once all are settled', () => {
    const { level, sim } = calm(4);
    const t = level.teamIds[1]!;
    const first = surfacedFor(level, sim, t)!;
    expect(first.issue).toMatch(/^everyday:/);
    // settled by stepping in
    const answered = chooseSenior(beginMonth({ ...level, surfaced: [{ teamId: t, week: sim.week - 4 }] }, sim), sim, first.id, 'stepIn');
    if (!answered.ok) throw new Error(answered.error);
    expect(answered.level.issues[t]![first.issue!]).toMatchObject({ settled: true, answer: 'stepIn' });
    // the same month's draw again: another friction, not the settled one
    const next = surfacedFor(answered.level, sim, t)!;
    expect(next.issue).not.toBe(first.issue);
    // every friction settled lately: nothing new to raise
    const all = Object.fromEntries(EVERYDAY_ISSUES.map((_, i) => [`everyday:${i}`, { week: sim.week - 1, settled: true, answer: 'stepIn' as const }]));
    expect(surfacedFor({ ...level, issues: { [t]: all } }, sim, t)).toBeUndefined();
    // once the rest is over, a settled friction can come back
    const later = edit(sim, (s) => (s.week += Math.max(T.issueSettledWeeks, T.issueRestWeeks) + 1));
    expect(surfacedFor({ ...level, issues: { [t]: all } }, later, t)).toBeDefined();
  });

  // @spec SENIOR-HABIT-008
  it('rests a friction another team raised lately, and raises nothing when every friction left was heard lately', () => {
    const { level, sim } = calm(4);
    const [t0, t1] = level.teamIds as [string, string];
    const first = surfacedFor(level, sim, t1)!;
    const elsewhere = { [t0]: { [first.issue!]: { week: sim.week - 1, settled: false, answer: 'coach' as const } } };
    expect(surfacedFor({ ...level, issues: elsewhere }, sim, t1)!.issue).not.toBe(first.issue);
    // once its rest is over, it can come back
    const later = edit(sim, (s) => (s.week += T.issueRestWeeks + 1));
    const old = { [t0]: { [first.issue!]: { week: sim.week - 1, settled: false, answer: 'coach' as const } } };
    expect(surfacedFor({ ...level, issues: old }, later, t1)).toBeDefined();
    // the only friction left for this team, heard from another team lately, is not raised: the skip-level brings nothing
    const allButOne = Object.fromEntries(EVERYDAY_ISSUES.map((_, i) => `everyday:${i}`).filter((k) => k !== first.issue).map((k) => [k, { week: sim.week - 1, settled: true, answer: 'stepIn' as const }]));
    expect(surfacedFor({ ...level, issues: { ...elsewhere, [t1]: allButOne } }, sim, t1)).toBeUndefined();
  });

  /** Records of every friction but those of one owner, settled lately: what is left to raise is that owner's. */
  const onlyOpen = (above: boolean, week: number) =>
    Object.fromEntries(EVERYDAY_ISSUES.flatMap((x, i) => (x.above === above ? [] : [[`everyday:${i}`, { week: week - 1, settled: true, answer: 'stepIn' as const }]])));
  /** Answers the friction a skip-level with team `t` surfaced, of one owner, with the team's manager at a skill. */
  function answerFriction(seed: number, above: boolean, skill: number, choice: string) {
    const { level, sim } = calm(seed);
    const t = level.teamIds[1]!;
    const m = (sim.teams[t]!.leader as { id: string }).id;
    const state = edit(sim, (s) => (s.people[m]!.skill = skill));
    const begun = beginMonth({ ...level, issues: { [t]: onlyOpen(above, sim.week) }, surfaced: [{ teamId: t, week: state.week - 4 }] }, state);
    const moment = begun.moments.find((x) => x.kind === 'surfaced')!;
    const r = chooseSenior(begun, state, moment.id, choice);
    if (!r.ok) throw new Error(r.error);
    return { r, moment, issue: moment.issue!, state, t, m, settled: r.level.issues[t]![moment.issue!]!.settled };
  }

  // @spec SENIOR-HABIT-011
  it('settles a problem only by an answer that fixed it, and brings an unsettled one back saying how it was answered', () => {
    const settles = (skill: number, choice: string) => answerFriction(4, false, skill, choice);
    expect(settles(25, 'coach').settled).toBe(true);
    expect(settles(10, 'coach').settled).toBe(false);
    expect(settles(45, 'letThem').settled).toBe(true);
    expect(settles(25, 'letThem').settled).toBe(false);
    expect(settles(10, 'stepIn').settled).toBe(true);
    // left unsettled, it comes back as itself, saying so
    const { r, issue, state, t, m } = settles(10, 'letThem');
    // four months on, the projects' plans moved with the clock so that nothing is behind
    const later = edit(state, (s) => {
      s.week += 16;
      for (const p of Object.values(s.projects)) Object.assign(p, { startWeek: p.startWeek + 16, deadlineWeek: p.deadlineWeek + 16 });
    });
    const again = surfacedFor(r.level, later, t)!;
    expect(again.issue).toBe(issue);
    expect(again.title).toMatch(/again/);
    expect(again.text).toMatch(/again/);
    expect(again.text).toContain(`Last time you left it with ${r.sim.people[m]!.name}`);
  });

  // @spec SENIOR-HABIT-013
  it('offers to take a problem above the manager upward, settling it for standing rather than energy', () => {
    const above = answerFriction(4, true, 45, 'escalate');
    expect(above.moment.choices.map((c) => c.id)).toEqual(['coach', 'stepIn', 'letThem', 'escalate']);
    expect(above.settled).toBe(true);
    expect(above.r.sim.player.reputation).toBe(Math.max(0, above.state.player.reputation - T.escalateReputation));
    expect(above.r.sim.player.stress).toBe(above.state.player.stress);
    expect(above.r.sim.teams[above.t]!.aggregate!.stress).toBe(Math.max(0, above.state.teams[above.t]!.aggregate!.stress - T.stepInFix));
    // a problem the manager can settle has no such choice
    expect(answerFriction(4, false, 45, 'coach').moment.choices.map((c) => c.id)).not.toContain('escalate');
  });

  // @spec SENIOR-HABIT-008, SENIOR-HABIT-012
  it('says when a friction is above the manager, settles it only by stepping in, and eases nothing when coached or left', () => {
    expect(EVERYDAY_ISSUES).toHaveLength(16);
    expect(EVERYDAY_ISSUES.filter((x) => x.above)).toHaveLength(6);
    const mine = answerFriction(4, false, 45, 'coach');
    expect(mine.moment.text).not.toMatch(/can settle alone/);

    const coached = answerFriction(4, true, 45, 'coach');
    const manager = coached.state.people[coached.m]!.name;
    expect(coached.moment.text).toContain(`It isn't something ${manager} can settle alone.`);
    expect(coached.settled).toBe(false);
    expect(coached.r.reaction).toMatch(/isn't theirs to fix/);
    expect(coached.r.sim.teams[coached.t]!.aggregate!.stress).toBe(coached.state.teams[coached.t]!.aggregate!.stress);
    expect(coached.r.sim.people[coached.m]!.skill).toBeGreaterThan(45);
    expect(coached.r.sim.player.stress).toBeGreaterThan(coached.state.player.stress);

    const left = answerFriction(4, true, 45, 'letThem');
    expect(left.settled).toBe(false);
    expect(left.r.reaction).toMatch(/isn't theirs to fix/);
    expect(left.r.sim.teams[left.t]!.aggregate!.stress).toBe(left.state.teams[left.t]!.aggregate!.stress);

    expect(answerFriction(4, true, 45, 'stepIn').settled).toBe(true);
  });
});
