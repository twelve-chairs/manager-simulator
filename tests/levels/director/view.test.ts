import { describe, expect, it } from 'vitest';
import { band } from '../../../src/levels/line-manager';
import { directorView, quarterOf } from '../../../src/levels/director';
import { applyEffects } from '../../../src/sim';
import { director } from './fixtures';

const RULE = { kind: 'rule', ruleId: 'test' } as const;

describe('what a director sees', () => {
  // @spec DIR-VIS-007
  it('marks the senior manager who is restless, and no one else', () => {
    const { level, sim } = director(2);
    const id = directorView(level, sim).seniorManagers[0]!.id;
    const marked = structuredClone(sim);
    marked.people[id]!.restlessSince = sim.week;
    const v = directorView(level, marked);
    expect(v.seniorManagers.map((p) => p.restless)).toEqual(v.seniorManagers.map((p) => p.id === id));
  });

  // @spec DIR-VIS-001, DIR-ORG-003
  it('shows each senior manager as a person, their want only once learned, and no card for a leaderless group', () => {
    const { level, sim } = director(2);
    const v = directorView(level, sim);
    expect(v.seniorManagers).toHaveLength(3);
    for (const m of v.seniorManagers) {
      const p = sim.people[m.id]!;
      expect(m).toMatchObject({ name: p.name, groupId: expect.any(String), motivation: band(p.motivation), stress: band(p.stress), skill: band(p.skill), want: 'unknown' });
    }
    const known = { ...level, learnedWants: { [v.seniorManagers[0]!.id]: true as const } };
    expect(directorView(known, sim).seniorManagers[0]!.want).toBe(sim.people[v.seniorManagers[0]!.id]!.want);
    const gone = applyEffects(sim, [{ type: 'remove', personId: v.seniorManagers[1]!.id, reason: 'quit', cause: RULE }]);
    if (!gone.ok) throw new Error(gone.error.message);
    const after = directorView(level, gone.state);
    expect(after.seniorManagers).toHaveLength(2);
    expect(after.groups.find((g) => g.id === v.seniorManagers[1]!.groupId)!.seniorManagerId).toBeNull();
  });

  // @spec DIR-VIS-002, DIR-DRIFT-003
  it('shows each group’s mood as last surveyed, and as it is now in a quarter the listening tour visited it', () => {
    const { level, sim } = director(2);
    expect(level.survey.quarter).toBe(1);
    const g = level.groupIds[1]!;
    const was = sim.teams[g]!.aggregate!;
    const worse = applyEffects(sim, [{ type: 'value', target: { kind: 'team', id: g }, field: 'stress', amount: 60, cause: RULE }, { type: 'value', target: { kind: 'team', id: g }, field: 'headcount', amount: 2, cause: RULE }]);
    if (!worse.ok) throw new Error(worse.error.message);
    const seen = directorView(level, worse.state).groups.find((x) => x.id === g)!;
    expect(seen).toMatchObject({ headcount: was.headcount + 2, stress: band(was.stress), motivation: band(was.motivation), seen: 'survey', quarter: 1 });
    const toured = { ...level, visited: { groupId: g, quarter: quarterOf(level, worse.state) } };
    const now = directorView(toured, worse.state).groups.find((x) => x.id === g)!;
    expect(now).toMatchObject({ stress: band(worse.state.teams[g]!.aggregate!.stress), seen: 'tour' });
    expect(now.projects).toHaveLength(2);
  });

  // @spec DIR-VIS-003
  it('shows the executive and both peers with their trust in the player as a band', () => {
    const { level, sim } = director(2);
    const v = directorView(level, sim);
    expect(v.upward.map((u) => u.role)).toEqual(['executive', 'peer', 'peer']);
    for (const u of v.upward) expect(u).toMatchObject({ trust: band(sim.people[u.id]!.trust), want: 'unknown', name: sim.people[u.id]!.name });
  });

  // @spec DIR-VIS-004
  it('shows each funded bet with its group, schedule and stakes', () => {
    const { level, sim } = director(2);
    const project = Object.values(sim.projects).find((p) => p.teamId === level.groupIds[2] && p.status === 'active')!;
    const withBet = { ...level, bets: [{ projectId: project.id, groupId: level.groupIds[2]!, landing: 6, failing: 9, peerId: level.peerIds[0]! }] };
    expect(directorView(withBet, sim).bets).toEqual([
      { projectId: project.id, name: project.name, groupId: level.groupIds[2], progress: project.progress, scope: project.scope, deadlineWeek: project.deadlineWeek, schedule: expect.any(String), landing: 6, failing: 9 },
    ]);
  });

  // @spec DIR-VIS-006
  it('never shows leniency, nor any team or line manager inside a group', () => {
    const { level, sim } = director(6);
    const text = JSON.stringify(directorView(level, sim));
    expect(text).not.toMatch(/leniency/i);
    for (const p of Object.values(sim.people).filter((x) => x.status === 'aggregated')) expect(text).not.toContain(p.name);
  });
});
