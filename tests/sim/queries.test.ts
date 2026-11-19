import { describe, expect, it } from 'vitest';
import {
  advance,
  applyEffects,
  behindScheduleProjects,
  leaderlessTeams,
  overdueProjects,
  peopleWhere,
  personHistory,
  playerStanding,
  teamSummary,
} from '../../src/sim';
import { RULE, SITUATION, expectOk, fresh, patch } from './fixtures';

describe('queries', () => {
  // @spec SIM-QUERY-001
  it('provides read-only queries over the state', () => {
    const s = expectOk(
      applyEffects(fresh(), [
        { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'motivation', amount: -5, cause: SITUATION, historyNote: 'Missed 1:1' },
      ]),
    ).state;
    const snapshot = structuredClone(s);
    expect(peopleWhere(s, (p) => p.want === 'growth' && p.teamId === 't1').map((p) => p.id)).toEqual(['e1']);
    expect(personHistory(s, 'e1').map((h) => h.note)).toEqual(['Missed 1:1']);
    expect(teamSummary(s, 't2').headcount).toBe(2);
    expect(overdueProjects(s)).toEqual([]);
    expect(behindScheduleProjects(s)).toEqual([]);
    expect(leaderlessTeams(s)).toEqual([]);
    expect(playerStanding(s)).toEqual({ reputation: 50, stress: 30 });
    expect(s).toEqual(snapshot);
  });

  // @spec SIM-QUERY-002
  it('computes a detailed team’s summary from its active members', () => {
    const r = expectOk(
      applyEffects(fresh(), [
        { type: 'value', target: { kind: 'person', id: 'e1' }, field: 'stress', amount: 30, cause: RULE },
        { type: 'remove', personId: 'e3', reason: 'quit', cause: RULE },
      ]),
    );
    const summary = teamSummary(r.state, 't1');
    expect(summary.headcount).toBe(2);
    expect(summary.stress).toBe(45); // (60 + 30) / 2
  });

  // @spec SIM-QUERY-003
  it('reports the player’s standing without judging it', () => {
    const s = patch(fresh(), (st) => {
      st.player = { reputation: 0, stress: 100 };
    });
    const after = advance(s, 4).state;
    expect(Object.keys(playerStanding(after)).sort()).toEqual(['reputation', 'stress']);
    expect(Object.keys(after).sort()).toEqual(['people', 'player', 'projects', 'rngState', 'teams', 'week']);
  });

  // @spec SIM-QUERY-004
  it('reports an active project past its deadline as overdue', () => {
    const s = patch(fresh(), (st) => {
      st.week = 27;
    });
    expect(overdueProjects(s).map((p) => p.id)).toEqual(['p1']);
    const done = patch(s, (st) => {
      st.projects.p1!.status = 'completed';
    });
    expect(overdueProjects(done)).toEqual([]);
  });

  // @spec SIM-QUERY-005
  it('reports a project as behind schedule when completion lags elapsed time', () => {
    const at = (week: number, progress: number) =>
      patch(fresh(), (st) => {
        st.week = week;
        st.projects.p1!.progress = progress;
      });
    expect(behindScheduleProjects(at(13, 20)).map((p) => p.id)).toEqual(['p1']); // 20% done, 50% of time gone
    expect(behindScheduleProjects(at(13, 60))).toEqual([]);
    expect(behindScheduleProjects(at(30, 20))).toEqual([]); // overdue, not behind
  });
});
