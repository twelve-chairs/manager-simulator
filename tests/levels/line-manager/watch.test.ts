import { describe, expect, it } from 'vitest';
import { LINE_TUNING, afterAdvance, watchLastWeek, type LineState } from '../../../src/levels/line-manager';
import { behindScheduleProjects, type SimState } from '../../../src/sim';
import { engineers, patch, projects, quietRun } from './fixtures';

/** A quiet team with nothing close: everyone in the middle, and every project on track with time to spare. */
function calm(): { level: LineState; sim: SimState } {
  const { level, sim } = quietRun(1);
  const s = patch(sim, (x) => {
    for (const id of projects(x)) Object.assign(x.projects[id]!, { startWeek: x.week - 2, deadlineWeek: x.week + 40, progress: Math.ceil(x.projects[id]!.scope / 2) });
  });
  return { level, sim: s };
}

/**
 * Plays one week as the level sees it: the week begins from `sim` (with the level's own stress causes that week), then
 * `change` makes the state after the advance, and the level looks at it.
 */
function played(level: LineState, sim: SimState, change: (s: SimState) => void = () => {}, stress: LineState['weekStart']['stress'] = {}) {
  const people = Object.fromEntries(engineers(sim).map((id) => [id, { motivation: sim.people[id]!.motivation, stress: sim.people[id]!.stress, skill: sim.people[id]!.skill }]));
  const progress = Object.fromEntries(projects(sim).map((id) => [id, sim.projects[id]!.progress]));
  const started: LineState = { ...level, weekStart: { ...level.weekStart, week: sim.week, people, projects: progress, causes: {}, stress } };
  const next = patch(sim, (s) => {
    s.week += 1;
    change(s);
  });
  const after = afterAdvance(started, next, []);
  return { level: after.level, sim: next, burnedOut: after.burnedOut, watch: watchLastWeek(after.level, next) };
}

const over = (s: SimState, id: string, weeks: number, line: 'stress' | 'motivation' = 'stress') =>
  Object.assign(s.people[id]!, line === 'stress' ? { stress: 85, highStressWeeks: weeks } : { motivation: 20, lowMotivationWeeks: weeks });

describe('the watch line', () => {
  // @spec LINE-RECAP-007
  it('reports nothing when nothing is close', () => {
    const { level, sim } = calm();
    expect(played(level, sim).watch).toBeUndefined();
  });

  // @spec LINE-RECAP-007
  it('puts the player’s own energy at the edge first, with the weeks there and the weeks left', () => {
    const { level, sim } = calm();
    const [a] = engineers(sim);
    const w = played({ ...level, burnoutWeeks: 1 }, sim, (s) => {
      s.player.stress = LINE_TUNING.burnoutThreshold;
      over(s, a!, 3);
    }).watch;
    expect(w).toMatchObject({ kind: 'edge', subject: 'player', weeks: 2, weeksLeft: LINE_TUNING.burnoutWeeks - 2 });
  });

  // @spec LINE-RECAP-007
  it('reports nothing in the week the player burned out', () => {
    const { level, sim } = calm();
    const r = played({ ...level, burnoutWeeks: LINE_TUNING.burnoutWeeks - 1 }, sim, (s) => (s.player.stress = 95));
    expect(r.burnedOut).toBe(true);
    expect(r.watch).toBeUndefined();
  });

  // @spec LINE-RECAP-007
  it('then the engineer longest over a departure line, of either kind', () => {
    const { level, sim } = calm();
    const [a, b, c] = engineers(sim);
    const w = played(level, sim, (s) => {
      over(s, a!, 2, 'stress');
      over(s, b!, 3, 'motivation');
      s.people[c!]!.stress = 65; // nearing, which comes later
    }).watch;
    expect(w).toMatchObject({ kind: 'over', subject: b, line: 'motivation', weeks: 3 });
    expect(w!.text).toContain(sim.people[b!]!.name.split(' ')[0]);
  });

  // @spec LINE-RECAP-007
  it('leaves out someone who has left', () => {
    const { level, sim } = calm();
    const [a] = engineers(sim);
    const w = played(level, sim, (s) => {
      over(s, a!, 4);
      Object.assign(s.people[a!]!, { status: 'departed', departure: { week: s.week - 1, reason: 'quit' } });
    }).watch;
    expect(w?.subject).not.toBe(a);
  });

  // @spec LINE-RECAP-007
  it('then an engineer who moved this week into the band that holds a line, but not one already there or coming back from over it', () => {
    const { level, sim } = calm();
    const [a, b] = engineers(sim);
    // stress from 50 to 65: into the band that holds the high stress line
    expect(played(level, sim, (s) => (s.people[a!]!.stress = 65)).watch).toMatchObject({ kind: 'nearing', subject: a, line: 'stress' });
    // motivation from 50 to 35: into the band that holds the low motivation line
    expect(played(level, sim, (s) => (s.people[b!]!.motivation = 35)).watch).toMatchObject({ kind: 'nearing', subject: b, line: 'motivation' });
    // already in that band when the week began
    const inBand = patch(sim, (s) => (s.people[a!]!.stress = 65));
    expect(played(level, inBand, (s) => (s.people[a!]!.stress = 70)).watch).toBeUndefined();
    // back from over the line
    const wasOver = patch(sim, (s) => (s.people[a!]!.stress = 85));
    expect(played(level, wasOver, (s) => (s.people[a!]!.stress = 70)).watch).toBeUndefined();
  });

  // @spec LINE-RECAP-007
  it('then an overdue project, a project behind schedule, or one due soon that its pace will not finish', () => {
    const { level, sim } = calm();
    const [p, q] = projects(sim);
    // overdue before behind
    const w = played(level, sim, (s) => {
      Object.assign(s.projects[p!]!, { deadlineWeek: s.week - 1, progress: 1 });
      Object.assign(s.projects[q!]!, { startWeek: s.week - 20, deadlineWeek: s.week + 2, progress: 1 });
    }).watch;
    expect(w).toMatchObject({ kind: 'project', subject: p });
    // Due in 3 weeks and ahead of its schedule share, with 11 left: at 1 a week over the last four weeks it will not
    // finish; at 4 a week, it will.
    const paced = (perWeek: number) => {
      let r = { level, sim: patch(sim, (s) => Object.assign(s.projects[q!]!, { scope: 100, progress: 89 - 4 * perWeek, startWeek: s.week - 10, deadlineWeek: s.week + 7 })) };
      const weeks = [];
      for (let i = 0; i < LINE_TUNING.watchWeeks; i++) weeks.push((r = played(r.level, r.sim, (s) => (s.projects[q!]!.progress += perWeek))));
      return weeks;
    };
    // Warned once it comes within watchWeeks of its deadline (and then held back, LINE-RECAP-009).
    const slow = paced(1);
    expect(slow.at(-1)!.sim.projects[q!]!.deadlineWeek - slow.at(-1)!.sim.week).toBe(3);
    expect(slow.map((w) => w.watch?.subject)).toContain(q);
    expect(slow.every((w) => !behindScheduleProjects(w.sim).some((x) => x.id === q))).toBe(true);
    expect(paced(4).map((w) => w.watch)).toEqual([undefined, undefined, undefined, undefined]);
  });
});

describe('what the watch line says about an engineer', () => {
  // @spec LINE-RECAP-008
  it('names the largest of the level’s own stress causes over the last watchWeeks weeks, in the recap’s words', () => {
    const { level, sim } = calm();
    const [a] = engineers(sim);
    // night pages five weeks ago, approvals since
    let r = played(level, sim, () => {}, { [a!]: { nightPages: 9 } });
    for (let i = 0; i < LINE_TUNING.watchWeeks - 1; i++) r = played(r.level, r.sim, () => {}, { [a!]: { approvals: 2 } });
    const w = played(r.level, r.sim, (s) => over(s, a!, 1), { [a!]: { approvals: 2 } }).watch;
    expect(w).toMatchObject({ kind: 'over', subject: a, line: 'stress', cause: { kind: 'stress', stress: 'approvals' } });
    expect(w!.text).toContain('signing approvals');
    // and within the window, the largest
    const n = played(level, sim, (s) => over(s, a!, 1), { [a!]: { nightPages: 6, approvals: 2 } }).watch;
    expect(n).toMatchObject({ cause: { kind: 'stress', stress: 'nightPages' } });
    expect(n!.text).toContain('night pages');
    // none recorded: no cause
    expect(played(level, sim, (s) => over(s, a!, 1)).watch!.cause).toBeUndefined();
  });

  // @spec LINE-RECAP-008
  it('names, for motivation, a learned want gone unserved, or that the player does not know what they want', () => {
    const { level, sim } = calm();
    const [a] = engineers(sim);
    const want = sim.people[a!]!.want;
    const unserved = (s: SimState) => {
      over(s, a!, 2, 'motivation');
      s.people[a!]!.wantServedWeek = s.week - 10;
    };
    const learned = { ...level, learnedWants: { [a!]: { want, week: 0 } } };
    expect(played(learned, sim, unserved).watch).toMatchObject({ line: 'motivation', cause: { kind: 'want', want, weeks: 10 } });
    // not learned, or learned and since changed
    expect(played(level, sim, unserved).watch).toMatchObject({ cause: { kind: 'unknownWant' } });
    const other = want === 'growth' ? 'stability' : 'growth';
    expect(played({ ...level, learnedWants: { [a!]: { want: other, week: 0 } } }, sim, unserved).watch).toMatchObject({ cause: { kind: 'unknownWant' } });
    // learned and served lately: no cause to name
    expect(played(learned, sim, (s) => over(s, a!, 2, 'motivation')).watch?.cause).toBeUndefined();
  });

  // @spec LINE-RECAP-008
  it('names the line they have been over longer, stress on a tie', () => {
    const { level, sim } = calm();
    const [a] = engineers(sim);
    const both = (stressWeeks: number, motivationWeeks: number) => (s: SimState) => {
      over(s, a!, stressWeeks, 'stress');
      over(s, a!, motivationWeeks, 'motivation');
    };
    expect(played(level, sim, both(2, 3)).watch).toMatchObject({ line: 'motivation', weeks: 3 });
    expect(played(level, sim, both(2, 2)).watch).toMatchObject({ line: 'stress', weeks: 2 });
  });
});

describe('a watch line that comes back', () => {
  // @spec LINE-RECAP-009
  it('holds back the same warning about the same engineer for three weeks', () => {
    const { level, sim } = calm();
    const [a] = engineers(sim);
    let r = played(level, sim, (s) => over(s, a!, 1));
    expect(r.watch).toMatchObject({ kind: 'over', subject: a });
    for (let week = 2; week <= 3; week++) {
      r = played(r.level, r.sim, (s) => (s.people[a!]!.highStressWeeks += 1));
      expect(r.watch?.subject, `week ${week}`).not.toBe(a);
    }
    r = played(r.level, r.sim, (s) => (s.people[a!]!.highStressWeeks += 1));
    expect(r.watch).toMatchObject({ kind: 'over', subject: a, weeks: 4 });
  });

  // @spec LINE-RECAP-009
  it('passes a held-back week to the next risk on the list', () => {
    const { level, sim } = calm();
    const [a, b] = engineers(sim);
    let r = played(level, sim, (s) => over(s, a!, 1));
    r = played(r.level, r.sim, (s) => {
      s.people[a!]!.highStressWeeks += 1;
      s.people[b!]!.stress = 65;
    });
    expect(r.watch).toMatchObject({ kind: 'nearing', subject: b });
  });

  // @spec LINE-RECAP-009
  it('lets a warning through again when it has moved up the list', () => {
    const { level, sim } = calm();
    const [a] = engineers(sim);
    let r = played(level, sim, (s) => (s.people[a!]!.stress = 65));
    expect(r.watch).toMatchObject({ kind: 'nearing', subject: a });
    r = played(r.level, r.sim, (s) => over(s, a!, 1));
    expect(r.watch).toMatchObject({ kind: 'over', subject: a });
  });

  // @spec LINE-RECAP-009
  it('warns the player again when one week is left before burnout', () => {
    const { level, sim } = calm();
    const edge = (s: SimState) => (s.player.stress = LINE_TUNING.burnoutThreshold);
    let r = played(level, sim, edge);
    expect(r.watch).toMatchObject({ kind: 'edge', weeks: 1 });
    r = played(r.level, r.sim, edge);
    expect(r.watch).toBeUndefined();
    r = played(r.level, r.sim, edge);
    expect(r.watch).toMatchObject({ kind: 'edge', weeks: LINE_TUNING.burnoutWeeks - 1, weeksLeft: 1 });
  });
});
