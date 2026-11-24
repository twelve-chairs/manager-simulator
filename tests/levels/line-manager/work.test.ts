import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERSONALITIES } from '../../../src/personalities';
import { CALLBACKS, LINE_TUNING, NAMES, WORK_KINDS, beginWeek, chooseMoment, view, type LineState, type WorkItem } from '../../../src/levels/line-manager';
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
      const [a, b, c, ...rest] = Object.keys(s.people).sort();
      for (const id of rest) Object.assign(s.people[id]!, { skill: 10, stress: 50 });
      // Both who could take it are strained, so it is a moment rather than the team's (LINE-WORK-013).
      Object.assign(s.people[a!]!, { skill: 80, stress: 70 });
      Object.assign(s.people[b!]!, { skill: 80, stress: 65 });
      Object.assign(s.people[c!]!, { skill: 20, stress: 10 });
      s.projects[project(s).id]!.techDebt = 0;
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

/** A night page on call for the first engineer, whose skill is given, against a difficulty-60 page. */
function paged(skill: number) {
  const q = quietRun(1);
  const onCall = engineers(q.sim)[0]!;
  const sim = patch(q.sim, (s) => (s.people[onCall]!.skill = skill));
  const { level, id } = withItem(q.level, { kind: 'onCall', subject: project(sim), size: 8, difficulty: 60, lastWeek: sim.week });
  return { level: begin(level, sim), sim, id, onCall };
}

describe('on-call moments', () => {
  // @spec LINE-WORK-005
  it('offers rolling back, backing up, taking over, or leaving it to the engineer on call', () => {
    const p = project(quietRun(1).sim).id;
    const out = paged(30);
    const mo = momentFor(out.level, out.id);
    expect(mo.choices.map((c) => c.id)).toEqual(['rollBack', 'backUp', 'takeOver', 'leave']);
    expect(mo.personId).toBe(out.onCall);
    expect(paged(90).level.moments.filter((m) => m.kind === 'onCall')).toEqual([]);
    const leftOut = choose(out.level, out.sim, mo.id, 'leave');
    const backed = choose(out.level, out.sim, mo.id, 'backUp');
    const took = choose(out.level, out.sim, mo.id, 'takeOver');
    expect(leftOut.sim.projects[p]!.risk).toBeGreaterThan(backed.sim.projects[p]!.risk);
    expect(backed.sim.projects[p]!.risk).toBeGreaterThan(took.sim.projects[p]!.risk - 1);
    expect(backed.sim.people[out.onCall]!.skill).toBeGreaterThan(out.sim.people[out.onCall]!.skill);
    expect(took.sim.player.stress - out.sim.player.stress).toBeGreaterThan(backed.sim.player.stress - out.sim.player.stress);
    expect(backed.sim.player.stress).toBeGreaterThan(out.sim.player.stress);
    expect(leftOut.sim.player.stress).toBe(out.sim.player.stress);
    expect(leftOut.sim.people[out.onCall]!.stress).toBeGreaterThan(out.sim.people[out.onCall]!.stress);
  });

  // @spec LINE-WORK-012
  it('ends the outage at once when the change is rolled back, at a cost in progress, teaching nobody', () => {
    const R = LINE_TUNING.rollBack;
    const out = paged(30);
    const p = project(out.sim).id;
    const start = patch(out.sim, (s) => (s.projects[p]!.progress = 20));
    const r = choose(out.level, start, momentFor(out.level, out.id).id, 'rollBack');
    expect(r.sim.projects[p]!.progress).toBe(20 - R.progress);
    expect(r.sim.projects[p]!.risk).toBe(start.projects[p]!.risk);
    expect(r.sim.player.reputation).toBe(start.player.reputation);
    expect(r.sim.people[out.onCall]!.stress).toBe(start.people[out.onCall]!.stress + R.stress);
    expect(r.sim.people[out.onCall]!.skill).toBe(start.people[out.onCall]!.skill);
    expect(r.level.items).toEqual([]);
    expect(r.reaction.length).toBeGreaterThan(0);
    // never below zero
    const fresh = patch(out.sim, (s) => (s.projects[p]!.progress = 2));
    expect(choose(out.level, fresh, momentFor(out.level, out.id).id, 'rollBack').sim.projects[p]!.progress).toBe(0);
  });
});

/** A design review on the first project, with the project's tech debt and each engineer's skill and stress set. */
function review(debt: number, difficulty: number, people: Record<number, { skill: number; stress: number }>) {
  const q = quietRun(1);
  const ids = engineers(q.sim);
  const sim = patch(q.sim, (s) => {
    s.projects[project(s).id]!.techDebt = debt;
    for (const id of ids) Object.assign(s.people[id]!, { skill: 10, stress: 10 });
    for (const [i, p] of Object.entries(people)) Object.assign(s.people[ids[Number(i)]!]!, p);
  });
  const made = withItem({ ...q.level, items: [] }, { kind: 'designReview', subject: project(sim), size: WORK_KINDS.designReview.size, difficulty, lastWeek: sim.week + 2, id: 'r1' });
  return { level: begin(made.level, sim), sim, ids };
}
const hasMoment = (level: LineState, ref: string) => level.moments.some((m) => m.ref === ref && m.status === 'open');

describe('routine design reviews', () => {
  // @spec LINE-WORK-001, LINE-WORK-013
  it('hands a review someone can handle unstrained, on a project with no worse than moderate debt, to the least stressed of them, with no moment', () => {
    const r = review(10, 50, { 0: { skill: 70, stress: 30 }, 1: { skill: 55, stress: 20 }, 2: { skill: 30, stress: 0 } });
    expect(hasMoment(r.level, 'r1')).toBe(false);
    expect(r.level.routineReviews).toEqual({ r1: r.ids[1] });
    // a debt worth paying down, a review beyond everyone, or only strained engineers who could take it: a moment
    expect(hasMoment(review(30, 50, { 0: { skill: 70, stress: 30 } }).level, 'r1'), 'moderate debt is still routine').toBe(false);
    expect(hasMoment(review(45, 50, { 0: { skill: 70, stress: 30 } }).level, 'r1')).toBe(true);
    expect(hasMoment(review(10, 90, { 0: { skill: 70, stress: 30 } }).level, 'r1')).toBe(true);
    const strained = review(10, 50, { 0: { skill: 70, stress: 65 } });
    expect(hasMoment(strained.level, 'r1')).toBe(true);
    expect(strained.level.routineReviews).toEqual({});
  });

  // @spec LINE-WORK-014
  it('has the engineer take it at the week’s end, as if given it, and says so in the recap', () => {
    const r = review(10, 50, { 0: { skill: 70, stress: 30 } });
    const who = r.ids[0]!;
    const done = end(r.level, r.sim);
    expect(done.level.items.some((i) => i.id === 'r1')).toBe(false);
    expect(done.sim.people[who]!.stress).toBe(30 + LINE_TUNING.work.delegateStress);
    expect(done.sim.people[who]!.history.filter((h) => h.week === r.sim.week).map((h) => h.note)).toContain('Took on a design review');
    expect(done.sim.projects[project(r.sim).id]!.techDebt).toBe(10);
    expect(done.recap.habits).toContain(`${r.sim.people[who]!.name} took 1 design review.`);
    expect(done.level.routineReviews).toEqual({});
    // someone who left before the week's end leaves it open
    const gone = patch(r.sim, (s) => Object.assign(s.people[who]!, { status: 'departed', departure: { week: s.week, reason: 'quit' } }));
    expect(end(r.level, gone).level.items.some((i) => i.id === 'r1')).toBe(true);
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

describe('callbacks', () => {
  /** A design review with one engineer offered, who remembers what the notes say, at the weeks before now given. */
  function remembering(memories: { note: string; weeksAgo: number }[]) {
    const { level, sim, id } = oneReview(20);
    const give = momentFor(level, id).choices.find((c) => c.id.startsWith('give:'))!;
    const who = give.id.slice('give:'.length);
    const withMemories = patch(sim, (s) => {
      s.week = 20;
      for (const m of memories) s.people[who]!.history.push({ week: 20 - m.weeksAgo, cause: { kind: 'action', actionId: 'test' }, note: m.note });
    });
    return { level, sim: withMemories, momentId: momentFor(level, id).id, choiceId: give.id, who };
  }
  const line = (note: string, name: string) => CALLBACKS[note]!.replaceAll('{name}', name);

  // @spec LINE-WORK-006
  it('ends the reaction with a line bringing up the most recent memory the table holds', () => {
    const r = remembering([
      { note: 'Handled a night page alone', weeksAgo: 5 },
      { note: 'You argued for them in calibration', weeksAgo: 2 },
      { note: 'Took on a design review', weeksAgo: 1 },
    ]);
    const name = r.sim.people[r.who]!.name;
    const out = choose(r.level, r.sim, r.momentId, r.choiceId);
    expect(out.reaction.endsWith(line('You argued for them in calibration', name))).toBe(true);
    expect(out.reaction).not.toContain(line('Handled a night page alone', name));
  });

  // @spec LINE-WORK-006
  it('never brings up an earlier night page in the reaction to a night page', () => {
    const out = paged(30);
    const remember = (note: string) =>
      patch(out.sim, (s) => s.people[out.onCall]!.history.push({ week: s.week - 1, cause: { kind: 'action', actionId: 'line-manager.on-call' }, note }));
    const m = momentFor(out.level, out.id).id;
    for (const [note, choice] of [['Handled a night page with you', 'leave'], ['Handled a night page alone', 'backUp']] as const) {
      const r = choose(out.level, remember(note), m, choice);
      expect(r.reaction).not.toContain(CALLBACKS[note]!.replaceAll('{name}', out.sim.people[out.onCall]!.name));
      expect(r.level.calledBack).toEqual([]);
    }
    // a page memory still comes up elsewhere
    const review = remembering([{ note: 'Handled a night page with you', weeksAgo: 1 }]);
    expect(choose(review.level, review.sim, review.momentId, review.choiceId).reaction).toContain('sitting in on that page');
  });

  // @spec LINE-WORK-006, LINE-WORK-007
  it('calls back only memories from the last weeks that the table holds, each once', () => {
    const old = remembering([{ note: 'Handled a night page alone', weeksAgo: LINE_TUNING.callbackWeeks + 1 }]);
    const name = old.sim.people[old.who]!.name;
    expect(choose(old.level, old.sim, old.momentId, old.choiceId).reaction).not.toContain(line('Handled a night page alone', name));
    const routine = remembering([{ note: 'Took on a design review', weeksAgo: 1 }]);
    const plain = remembering([]);
    expect(choose(routine.level, routine.sim, routine.momentId, routine.choiceId).reaction).toBe(choose(plain.level, plain.sim, plain.momentId, plain.choiceId).reaction);
    // once called back, the same memory is not brought up again
    const once = remembering([{ note: 'Handled a night page alone', weeksAgo: 2 }]);
    const first = choose(once.level, once.sim, once.momentId, once.choiceId);
    expect(first.reaction).toContain(line('Handled a night page alone', name));
    const repeat = remembering([{ note: 'Handled a night page alone', weeksAgo: 2 }]);
    const again = choose({ ...repeat.level, calledBack: first.level.calledBack }, repeat.sim, repeat.momentId, repeat.choiceId);
    expect(again.reaction).not.toContain(line('Handled a night page alone', name));
  });

  // @spec LINE-WORK-007
  it('holds lines only for memories its situations and moments record, each naming the person', () => {
    expect(Object.keys(CALLBACKS).length).toBeGreaterThanOrEqual(15);
    const sources = [
      ...readdirSync(new URL('../../../content/situations/', import.meta.url)).map((f) => readFileSync(new URL(`../../../content/situations/${f}`, import.meta.url), 'utf8')),
      readFileSync(new URL('../../../src/levels/line-manager/moments.ts', import.meta.url), 'utf8'),
    ].join('\n');
    for (const [note, text] of Object.entries(CALLBACKS)) {
      expect(text, note).toContain('{name}');
      expect(sources.includes(`historyNote: ${note}\n`) || sources.includes(`historyNote: ${note} }`) || sources.includes(`note: '${note}'`), `a memory recorded as "${note}"`).toBe(true);
    }
  });
});

/** A quiet run with one item of the kind open on the first project, whose tech debt is `debt`. */
function oneOf(kind: 'designReview' | 'customerRequest', debt: number, id = 'w7', difficulty = 50) {
  const q = quietRun(1);
  const sim = patch(q.sim, (s) => (s.projects[project(s).id]!.techDebt = debt));
  const made = withItem(q.level, { kind, subject: project(sim), size: WORK_KINDS[kind].size, difficulty, lastWeek: sim.week + 2, id });
  return { level: begin(made.level, sim), sim, id: made.id };
}
const edge = (b: number) => LINE_TUNING.bandEdges[b - 1]!;
const textOf = (level: LineState, sim: SimState, ref: string) => view(level, sim).moments.find((m) => m.id === momentFor(level, ref).id)!.text;

describe('trades in routine work', () => {
  // @spec LINE-WORK-002, LINE-WORK-008
  it('offers fixing the debt a design review touches once the project’s tech debt reaches the band, before pushing back', () => {
    const P = LINE_TUNING.payDown;
    // Beyond everyone, so a moment though the debt is low (LINE-WORK-013).
    const below = oneOf('designReview', edge(P.band) - 1, 'w7', 95);
    expect(momentFor(below.level, below.id).choices.map((c) => c.id)).not.toContain('payDown');
    const at = oneOf('designReview', edge(P.band), 'w7', 95);
    const ids = momentFor(at.level, at.id).choices.map((c) => c.id);
    expect(ids.at(-2)).toBe('payDown');
    expect(ids.at(-1)).toBe('pushBack');
  });

  // @spec LINE-WORK-009
  it('slows the project, lowers its tech debt and costs a little stress to fix the debt first', () => {
    const P = LINE_TUNING.payDown;
    const { level, sim, id } = oneOf('designReview', 60);
    const p = project(sim).id;
    const before = patch(sim, (s) => (s.projects[p]!.progress = 30));
    const r = choose(level, before, momentFor(level, id).id, 'payDown');
    expect(r.sim.projects[p]!.progress).toBe(30 - P.progress);
    expect(r.sim.projects[p]!.techDebt).toBe(60 - P.techDebt);
    expect(r.sim.player.stress).toBe(Math.min(100, before.player.stress + P.stress));
    expect(r.level.items).toEqual([]);
    expect(r.reaction.length).toBeGreaterThan(0);
  });

  // @spec LINE-WORK-002, LINE-WORK-010
  it('offers a smaller change for a customer request, before pushing back', () => {
    const { level, id } = oneOf('customerRequest', 0);
    const ids = momentFor(level, id).choices.map((c) => c.id);
    expect(ids.at(-2)).toBe('smaller');
    expect(ids.at(-1)).toBe('pushBack');
  });

  // @spec LINE-WORK-011
  it('costs less reputation than letting the request expire, and nobody’s stress, to offer a smaller change', () => {
    const { level, sim, id } = oneOf('customerRequest', 0);
    const start = patch(sim, (s) => (s.player.reputation = 50));
    const r = choose(level, start, momentFor(level, id).id, 'smaller');
    expect(r.sim.player.reputation).toBe(50 - LINE_TUNING.smallerChange.reputation);
    expect(LINE_TUNING.smallerChange.reputation).toBeLessThan(-LINE_TUNING.expiry.customerRequestReputation);
    expect(r.sim.player.stress).toBe(start.player.stress);
    for (const pid of engineers(sim)) expect(r.sim.people[pid]!.stress).toBe(start.people[pid]!.stress);
    expect(r.level.items).toEqual([]);
  });

  // @spec LINE-MOMENT-006
  it('describes a design review with its project, its tech debt and what waiting costs, in phrasings picked by the item’s number', () => {
    const texts = ['w1', 'w2', 'w3', 'w4'].map((n) => {
      const r = oneOf('designReview', 60, n);
      return textOf(r.level, r.sim, r.id);
    });
    const { sim } = oneOf('designReview', 60);
    for (const t of texts) {
      expect(t).toContain(sim.projects[project(sim).id]!.name);
      expect(t).toMatch(/tech debt is high/);
      expect(t).toMatch(/the debt rises/);
    }
    expect(new Set(texts).size).toBeGreaterThan(1);
    const again = oneOf('designReview', 60, 'w2');
    expect(textOf(again.level, again.sim, again.id)).toBe(texts[1]);
  });

  // @spec LINE-MOMENT-007
  it('describes a customer request with a named customer, its project and what waiting costs', () => {
    const texts = ['w1', 'w2', 'w3', 'w4'].map((n) => {
      const r = oneOf('customerRequest', 0, n);
      return textOf(r.level, r.sim, r.id);
    });
    const { sim } = oneOf('customerRequest', 0);
    for (const t of texts) {
      expect(t).toContain(sim.projects[project(sim).id]!.name);
      expect(NAMES.customers.some((c) => t.includes(c))).toBe(true);
      expect(t).toMatch(/your reputation slips/);
    }
    expect(new Set(texts).size).toBeGreaterThan(1);
  });
});
