import { describe, expect, it } from 'vitest';
import { PERSONALITIES } from '../../../src/personalities';
import { NAMES, WORK_KINDS, beginWeek, chooseMoment, type WorkItem } from '../../../src/levels/line-manager';
import type { SimState } from '../../../src/sim';
import { begin, choose, end, engineers, expectRefused, momentFor, patch, projects, quietRun, run, seeds, teamOf, withItem } from './fixtures';

/** Average number of work items of a kind arriving in one week, over many seeds, for a state shaped by `shape`. */
function arrivals(kind: WorkItem['kind'], shape: (s: SimState) => void, n = 60): number {
  let total = 0;
  for (const seed of seeds(n)) {
    const { level, sim } = run(seed);
    const shaped = patch(sim, shape);
    total += beginWeek({ ...level, items: [] }, shaped).items.filter((d) => d.kind === kind).length;
  }
  return total / n;
}

const project = (sim: SimState) => ({ kind: 'project' as const, id: projects(sim)[0]! });

/** A quiet run with one design review open and presented as a work moment. */
function oneReview(difficulty = 50, setup: (s: SimState) => void = () => {}) {
  const q = quietRun(1);
  const sim = patch(q.sim, setup);
  const { level, id } = withItem(q.level, { kind: 'designReview', subject: project(sim), size: 5, difficulty, lastWeek: sim.week + 2 });
  return { level: begin(level, sim), sim, id };
}

describe('arrivals', () => {
  // @spec LINE-INBOX-001
  it('brings more on-call pages to riskier projects, from the level’s own generator', () => {
    const calm = arrivals('onCall', (s) => Object.values(s.projects).forEach((p) => Object.assign(p, { risk: 5, techDebt: 5 })));
    const risky = arrivals('onCall', (s) => Object.values(s.projects).forEach((p) => Object.assign(p, { risk: 95, techDebt: 95 })));
    expect(risky).toBeGreaterThan(calm);
    const { level, sim } = run(4);
    const before = structuredClone(sim);
    const arrived = beginWeek(level, sim);
    expect(sim).toEqual(before);
    expect(arrived.rngState).not.toBe(level.rngState);
  });

  // @spec LINE-INBOX-002
  it('brings work intake while the team has fewer than two active projects', () => {
    const { level, sim } = run(1);
    const one = patch(sim, (s) => (s.projects[projects(sim)[0]!]!.status = 'completed'));
    expect(beginWeek({ ...level, items: [] }, one).items.filter((i) => i.kind === 'workIntake')).toHaveLength(1);
    expect(beginWeek({ ...level, items: [] }, sim).items.filter((i) => i.kind === 'workIntake')).toHaveLength(0);
  });

  // @spec LINE-INBOX-002
  it('waits three weeks after work intake is declined or let expire before offering more', () => {
    const q = quietRun(1);
    const one = patch(q.sim, (s) => { s.week = 4; s.projects[projects(q.sim)[0]!]!.status = 'completed'; });
    const { level, id } = withItem(q.level, { kind: 'workIntake', subject: { kind: 'team', id: teamOf(one) }, size: 2, lastWeek: 4 });
    const l = begin(level, one);
    const intake = (lv: typeof l, week: number) => beginWeek({ ...lv, items: [] }, patch(one, (s) => (s.week = week))).items.filter((i) => i.kind === 'workIntake');
    const declined = choose(l, one, momentFor(l, id).id, 'decline').level;
    for (const week of [5, 6, 7]) expect(intake(declined, week)).toHaveLength(0);
    expect(intake(declined, 8)).toHaveLength(1);
    // letting it expire counts the same
    const expired = end(l, one).level;
    expect(intake(expired, 7)).toHaveLength(0);
    expect(intake(expired, 8)).toHaveLength(1);
  });

  // @spec LINE-INBOX-013
  it('has the player’s manager assign a project after four weeks in a row with none', () => {
    const q = quietRun(1);
    const idle = patch(q.sim, (s) => Object.values(s.projects).forEach((p) => (p.status = 'completed')));
    let level = q.level;
    let sim = idle;
    for (let week = 1; week <= 3; week++) {
      const ended = end(level, patch(sim, (s) => (s.week = week)));
      expect(ended.recap.assigned).toEqual([]);
      level = ended.level;
      sim = ended.sim;
    }
    const fourth = end(level, patch(sim, (s) => (s.week = 4)));
    const added = projects(fourth.sim);
    expect(added).toHaveLength(1);
    expect(NAMES.projects).toContain(fourth.sim.projects[added[0]!]!.name);
    expect(fourth.recap.assigned).toEqual([{ projectId: added[0], name: fourth.sim.projects[added[0]!]!.name }]);
    // a week with a project breaks the run of idle weeks
    const busy = end({ ...level, idleStreak: 2 }, patch(q.sim, (s) => (s.week = 4)));
    expect(busy.recap.assigned).toEqual([]);
    expect(busy.level.idleStreak).toBe(0);
  });

  // @spec LINE-INBOX-003
  it('gives items unique ids, a kind, subject, size, difficulty and last week from their kind', () => {
    const ids: string[] = [];
    for (const seed of seeds(10)) {
      const { level, sim } = run(seed);
      const s = patch(sim, (st) => (st.week = 3));
      for (const item of beginWeek(beginWeek({ ...level, items: [] }, s), s).items) {
        expect(item).toMatchObject({ arrivedWeek: 3, size: WORK_KINDS[item.kind].size, lastWeek: 3 + WORK_KINDS[item.kind].expiryWeeks });
        ids.push(`${seed}:${item.id}`);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  // @spec LINE-INBOX-010
  it('drops items whose subject is gone, without consequence', () => {
    const { level, sim } = quietRun(1);
    const { level: l } = withItem(level, { kind: 'customerRequest', subject: project(sim), lastWeek: 0 });
    const gone = patch(sim, (s) => (s.projects[projects(sim)[0]!]!.status = 'cancelled'));
    const ended = end(begin(l, gone), gone);
    expect(ended.level.items).toEqual([]);
    expect(ended.sim.player.reputation).toBe(gone.player.reputation);
  });
});

describe('work moments', () => {
  // @spec LINE-WORK-001, LINE-WORK-002
  it('offers doing it yourself, a safe pair of hands, a stretch, and pushing back', () => {
    const { level, sim, id } = oneReview(50, (s) => {
      const [a, b, c] = Object.keys(s.people).sort();
      Object.assign(s.people[a!]!, { skill: 80, stress: 40 });
      Object.assign(s.people[b!]!, { skill: 80, stress: 20 });
      Object.assign(s.people[c!]!, { skill: 20, stress: 10 });
    });
    const [, b, c] = engineers(sim);
    expect(momentFor(level, id).choices.map((x) => x.id)).toEqual(['self', `give:${b}`, `give:${c}`, 'pushBack']);

    const intake = withItem(quietRun(1).level, { kind: 'workIntake', subject: { kind: 'team', id: teamOf(sim) } });
    expect(momentFor(begin(intake.level, sim), intake.id).choices.map((x) => x.id)).toEqual(['take', 'decline']);
  });

  // @spec LINE-INBOX-004, LINE-WORK-004
  it('resolves work done yourself at a stress cost growing with size, with a reaction', () => {
    const small = oneReview();
    const r = choose(small.level, small.sim, momentFor(small.level, small.id).id, 'self');
    expect(r.level.items).toEqual([]);
    expect(r.sim.player.stress).toBeGreaterThan(small.sim.player.stress);
    expect(r.reaction.length).toBeGreaterThan(0);
    const q = quietRun(1);
    const big = withItem(q.level, { kind: 'designReview', subject: project(q.sim), size: 10, lastWeek: 3 });
    const bl = begin(big.level, q.sim);
    const rb = choose(bl, q.sim, momentFor(bl, big.id).id, 'self');
    expect(rb.sim.player.stress - q.sim.player.stress).toBeGreaterThan(r.sim.player.stress - small.sim.player.stress);
  });

  // @spec LINE-INBOX-005, LINE-INBOX-006
  it('gives work to an engineer: stress, wants served, history, and growth on a stretch', () => {
    const { level, sim, id } = oneReview(90);
    const m = momentFor(level, id);
    const give = m.choices.find((c) => c.id.startsWith('give:'))!;
    const who = give.id.slice('give:'.length);
    const s = patch(sim, (st) => (st.people[who]!.want = 'growth'));
    const r = choose(level, s, m.id, give.id);
    expect(r.sim.people[who]!.stress).toBeGreaterThan(s.people[who]!.stress);
    expect(r.sim.people[who]!.wantServedWeek).toBe(s.week);
    expect(r.sim.people[who]!.history.at(-1)!.note).toBeTruthy();
    // a stretch: difficulty 90 against skill 50
    expect(r.sim.people[who]!.skill).toBeGreaterThan(s.people[who]!.skill);
    expect(r.sim.projects[project(sim).id]!.techDebt).toBeGreaterThan(s.projects[project(sim).id]!.techDebt);
    expect(r.level.items).toEqual([]);
  });

  // @spec LINE-INBOX-007
  it('raises an engineer’s stress once for each item given to them', () => {
    const q = quietRun(1);
    const a = withItem(q.level, { kind: 'designReview', subject: project(q.sim), difficulty: 20, lastWeek: 3 });
    const b = withItem(a.level, { kind: 'customerRequest', subject: project(q.sim), difficulty: 20, lastWeek: 3 });
    let level = begin(b.level, q.sim);
    const give = (l: typeof level, ref: string) => momentFor(l, ref).choices.find((c) => c.id.startsWith('give:'))!.id;
    const first = give(level, a.id);
    const r1 = choose(level, q.sim, momentFor(level, a.id).id, first);
    const who = first.slice('give:'.length);
    const once = r1.sim.people[who]!.stress - q.sim.people[who]!.stress;
    level = r1.level;
    const r2 = choose(level, r1.sim, momentFor(level, b.id).id, `give:${who}`);
    expect(r2.sim.people[who]!.stress - q.sim.people[who]!.stress).toBe(2 * once);
  });

  // @spec LINE-WORK-003, LINE-INBOX-009
  it('leaves pushed-back work open until it expires with its consequence', () => {
    const { level, sim, id } = oneReview();
    const pushed = choose(level, sim, momentFor(level, id).id, 'pushBack');
    expect(pushed.level.items.map((i) => i.id)).toEqual([id]);
    const atDeadline = patch(pushed.sim, (s) => (s.week = pushed.level.items[0]!.lastWeek));
    const ended = end(pushed.level, atDeadline);
    expect(ended.level.items).toEqual([]);
    expect(ended.recap.expired.map((e) => e.itemId)).toEqual([id]);
    expect(ended.log.some((x) => x.cause.kind === 'rule')).toBe(true);
    expect(ended.sim.projects[project(sim).id]!.techDebt).toBeGreaterThan(atDeadline.projects[project(sim).id]!.techDebt);
  });

  // @spec LINE-INBOX-011, LINE-INBOX-012
  it('starts a project when work intake is taken on, and costs a little reputation to decline', () => {
    const q = quietRun(1);
    const { level, id } = withItem(q.level, { kind: 'workIntake', subject: { kind: 'team', id: teamOf(q.sim) }, size: 2, lastWeek: 0 });
    const l = begin(level, q.sim);
    const taken = choose(l, q.sim, momentFor(l, id).id, 'take');
    const added = projects(taken.sim).filter((p) => !projects(q.sim).includes(p));
    expect(added).toHaveLength(1);
    expect(NAMES.projects).toContain(taken.sim.projects[added[0]!]!.name);
    expect(taken.sim.player.stress).toBeGreaterThan(q.sim.player.stress);
    const declined = choose(l, q.sim, momentFor(l, id).id, 'decline');
    const expired = end(l, q.sim);
    expect(declined.sim.player.reputation).toBeLessThan(q.sim.player.reputation);
    expect(declined.sim.player.reputation).toBeGreaterThan(expired.sim.player.reputation);
  });

  // @spec LINE-WORK-004
  it('words the reaction for the personality of the engineer involved', () => {
    const reactions = new Set<string>();
    for (const personality of PERSONALITIES) {
      const { level, sim, id } = oneReview(20);
      const m = momentFor(level, id);
      const give = m.choices.find((c) => c.id.startsWith('give:'))!;
      const s = patch(sim, (st) => (st.people[give.id.slice(5)]!.personality = personality));
      reactions.add(choose(level, s, m.id, give.id).reaction.replace(s.people[give.id.slice(5)]!.name, 'NAME'));
    }
    expect(reactions.size).toBeGreaterThan(1);
  });
});

describe('on-call moments', () => {
  /** A page this week, under the rotation, with the engineer on call set to the given skill. */
  function paged(skill: number) {
    const q = quietRun(1);
    const onCall = engineers(q.sim)[0]!;
    const sim = patch(q.sim, (s) => (s.people[onCall]!.skill = skill));
    const { level, id } = withItem(q.level, { kind: 'onCall', subject: project(sim), size: 8, difficulty: 60, lastWeek: sim.week });
    return { level: begin(level, sim), sim, id, onCall };
  }

  // @spec LINE-WORK-005
  it('offers backing up, taking over, or leaving it to the engineer on call', () => {
    const p = project(quietRun(1).sim).id;
    const able = paged(90);
    const m = momentFor(able.level, able.id);
    expect(m.choices.map((c) => c.id)).toEqual(['backUp', 'takeOver', 'leave']);
    expect(m.personId).toBe(able.onCall);

    const left = choose(able.level, able.sim, m.id, 'leave');
    expect(left.sim.player.stress).toBe(able.sim.player.stress);
    expect(left.sim.people[able.onCall]!.stress).toBeGreaterThan(able.sim.people[able.onCall]!.stress);
    expect(left.sim.projects[p]!.risk).toBe(able.sim.projects[p]!.risk);

    const out = paged(30);
    const mo = momentFor(out.level, out.id);
    const leftOut = choose(out.level, out.sim, mo.id, 'leave');
    const backed = choose(out.level, out.sim, mo.id, 'backUp');
    const took = choose(out.level, out.sim, mo.id, 'takeOver');
    expect(leftOut.sim.projects[p]!.risk).toBeGreaterThan(backed.sim.projects[p]!.risk);
    expect(backed.sim.projects[p]!.risk).toBeGreaterThan(took.sim.projects[p]!.risk - 1);
    expect(backed.sim.people[out.onCall]!.skill).toBeGreaterThan(out.sim.people[out.onCall]!.skill);
    expect(took.sim.player.stress - out.sim.player.stress).toBeGreaterThan(backed.sim.player.stress - out.sim.player.stress);
    expect(backed.sim.player.stress).toBeGreaterThan(out.sim.player.stress);
  });
});

describe('answering moments', () => {
  // @spec LINE-MOMENT-003
  it('refuses a closed moment or a choice it does not offer', () => {
    const { level, sim, id } = oneReview();
    const m = momentFor(level, id);
    for (const [momentId, choiceId] of [[m.id, 'shout'], ['no-such-moment', 'self']] as const) {
      const before = structuredClone({ level, sim });
      expectRefused(chooseMoment(level, sim, momentId, choiceId), level, sim, before.level, before.sim);
    }
    const answered = choose(level, sim, m.id, 'self');
    expect(chooseMoment(answered.level, answered.sim, m.id, 'self').ok).toBe(false);
  });
});
