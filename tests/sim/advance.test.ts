import { describe, expect, it } from 'vitest';
import { RULE_ORDER, TUNING, advance, aggregateTeam, teamSummary, type SimState } from '../../src/sim';
import { ACTION, fresh, patch, person, seeds } from './fixtures';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Average progress p1 gains over one week, across many seeds, for a variant of the fixture. */
function meanProgressGain(change: (s: SimState) => void) {
  return mean(
    seeds(50).map((seed) => {
      const s = patch(fresh(seed), change);
      return advance(s, 1).state.projects.p1!.progress - s.projects.p1!.progress;
    }),
  );
}

/** Fixture with no projects, so no project-driven stress or setbacks. */
const quiet = (seed = 1) =>
  patch(fresh(seed), (s) => {
    s.projects = {};
  });

describe('advance', () => {
  // @spec SIM-ADV-001
  it('applies rules in order: project work, setbacks, stress, want drift, departure, player standing, game time', () => {
    const s = patch(fresh(), (st) => {
      st.projects.p1!.risk = 100;
      st.projects.p1!.techDebt = 100;
      st.week = 20;
    });
    const { log } = advance(s, 4);
    const ranks = log.map((e) => RULE_ORDER.indexOf((e.cause as { ruleId: string }).ruleId as (typeof RULE_ORDER)[number]));
    expect(ranks).not.toContain(-1);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  // @spec SIM-ADV-002
  it('makes project progress rise with headcount, skill and motivation and fall with stress and tech debt', () => {
    const base = meanProgressGain(() => {});
    expect(base).toBeGreaterThan(0);
    expect(meanProgressGain((s) => {
      s.people.e3!.teamId = 't2';
    })).toBeLessThan(base);
    expect(meanProgressGain((s) => {
      for (const id of ['e1', 'e2', 'e3']) s.people[id]!.skill = 90;
    })).toBeGreaterThan(base);
    expect(meanProgressGain((s) => {
      for (const id of ['e1', 'e2', 'e3']) s.people[id]!.motivation = 90;
    })).toBeGreaterThan(base);
    expect(meanProgressGain((s) => {
      for (const id of ['e1', 'e2', 'e3']) s.people[id]!.stress = 90;
    })).toBeLessThan(base);
    expect(meanProgressGain((s) => {
      s.projects.p1!.techDebt = 60;
    })).toBeLessThan(base);
  });

  // @spec SIM-ADV-003
  it('completes a project whose progress reaches its scope', () => {
    const s = patch(fresh(), (st) => {
      st.projects.p1!.progress = 99;
    });
    expect(advance(s, 1).state.projects.p1!.status).toBe('completed');
  });

  // @spec SIM-ADV-004
  it('makes setbacks more likely with higher risk and tech debt', () => {
    const setbacks = (risk: number, techDebt: number) =>
      seeds(200).filter((seed) => {
        const s = patch(fresh(seed), (st) => {
          st.projects.p1!.risk = risk;
          st.projects.p1!.techDebt = techDebt;
        });
        return advance(s, 4).log.some((e) => e.cause.kind === 'rule' && e.cause.ruleId === 'rule.setbacks');
      }).length;
    expect(setbacks(80, 0)).toBeGreaterThan(setbacks(10, 0));
    expect(setbacks(10, 80)).toBeGreaterThan(setbacks(10, 0));
  });

  // @spec SIM-ADV-005
  it('makes a setback reduce progress and raise the team’s stress', () => {
    const seed = seeds(200).find((sd) => {
      const s = patch(fresh(sd), (st) => {
        st.projects.p1!.risk = 100;
        st.projects.p1!.techDebt = 100;
      });
      return advance(s, 4).log.some((e) => e.cause.kind === 'rule' && e.cause.ruleId === 'rule.setbacks');
    });
    expect(seed).toBeDefined();
    const s = patch(fresh(seed), (st) => {
      st.projects.p1!.risk = 100;
      st.projects.p1!.techDebt = 100;
    });
    const setbackLog = advance(s, 4).log.filter((e) => e.cause.kind === 'rule' && e.cause.ruleId === 'rule.setbacks');
    const progress = setbackLog.find((e) => e.field === 'progress');
    expect(progress && (progress.after as number) < (progress.before as number)).toBe(true);
    const stress = setbackLog.filter((e) => e.field === 'stress');
    expect(stress.length).toBeGreaterThan(0);
    for (const e of stress) expect(e.after as number).toBeGreaterThan(e.before as number);
  });

  // @spec SIM-ADV-006
  it('raises stress on a team with an overdue project', () => {
    const s = patch(fresh(), (st) => {
      st.week = 30;
    });
    expect(teamSummary(advance(s, 1).state, 't1').stress).toBeGreaterThan(teamSummary(s, 't1').stress);
  });

  // @spec SIM-ADV-007
  it('raises stress on a leaderless team', () => {
    const s = patch(quiet(), (st) => {
      st.teams.t2!.leader = null;
    });
    expect(teamSummary(advance(s, 1).state, 't2').stress).toBeGreaterThan(teamSummary(s, 't2').stress);
  });

  // @spec SIM-ADV-008
  it('lowers stress on a led team with nothing overdue or behind', () => {
    const s = quiet();
    expect(teamSummary(advance(s, 1).state, 't2').stress).toBeLessThan(teamSummary(s, 't2').stress);
  });

  // @spec SIM-ADV-009
  it('lowers motivation once a want has gone unserved past the drift threshold', () => {
    const s = patch(quiet(), (st) => {
      st.week = TUNING.wantDriftThresholdWeeks + 5;
      st.people.e1!.wantServedWeek = 0;
    });
    expect(person(advance(s, 1).state, 'e1').motivation).toBeLessThan(50);
  });

  // @spec SIM-ADV-010
  it('slowly raises motivation while a want has been served recently', () => {
    const s = patch(quiet(), (st) => {
      st.week = 10;
      st.people.e1!.wantServedWeek = 10;
    });
    const after = person(advance(s, 1).state, 'e1').motivation;
    expect(after).toBeGreaterThan(50);
    expect(after).toBeLessThanOrEqual(55);
  });

  // @spec SIM-ADV-011
  it('makes quitting more likely with long low motivation, long high stress, and low trust', () => {
    const quits = (change: (s: SimState) => void) =>
      seeds(200).filter((seed) => {
        const s = patch(quiet(seed), (st) => {
          st.week = 4;
          st.people.e1!.wantServedWeek = 4;
          change(st);
        });
        return person(advance(s, 4).state, 'e1').status === 'departed';
      }).length;
    const baseline = quits(() => {});
    expect(quits((s) => {
      s.people.e1!.motivation = 10;
      s.people.e1!.lowMotivationWeeks = 20;
    })).toBeGreaterThan(baseline);
    expect(quits((s) => {
      s.people.e1!.stress = 95;
      s.people.e1!.highStressWeeks = 20;
    })).toBeGreaterThan(baseline);
    const lowMotivation = (trust: number) => (s: SimState) => {
      s.people.e1!.motivation = 20;
      s.people.e1!.lowMotivationWeeks = 10;
      s.people.e1!.trust = trust;
    };
    expect(quits(lowMotivation(5))).toBeGreaterThan(quits(lowMotivation(95)));
  });

  // @spec SIM-ADV-012
  it('makes aggregate teams lose headcount more often with higher attrition risk', () => {
    const losses = (risk: number) =>
      seeds(200).filter((seed) => {
        const s = patch(aggregateTeam(quiet(seed), 't2', ACTION).state, (st) => {
          st.teams.t2!.aggregate!.attritionRisk = risk;
        });
        return advance(s, 4).state.teams.t2!.aggregate!.headcount < 2;
      }).length;
    expect(losses(80)).toBeGreaterThan(losses(10));
  });

  // @spec SIM-ADV-013
  it('moves reputation up when projects are on track and down when they are overdue', () => {
    const ahead = patch(fresh(), (st) => {
      st.projects.p1!.progress = 60;
      st.projects.p1!.deadlineWeek = 52;
    });
    expect(advance(ahead, 4).state.player.reputation).toBeGreaterThan(50);
    const overdue = patch(fresh(), (st) => {
      st.week = 40;
    });
    expect(advance(overdue, 4).state.player.reputation).toBeLessThan(50);
  });

  // @spec SIM-ADV-014
  it('raises player stress with teams in trouble and lowers it when there are none', () => {
    const troubled = patch(quiet(), (st) => {
      st.teams.t2!.leader = null;
    });
    expect(advance(troubled, 4).state.player.stress).toBeGreaterThan(30);
    expect(advance(quiet(), 4).state.player.stress).toBeLessThan(30);
  });

  // @spec SIM-ADV-015
  it('scales rule magnitudes with step length', () => {
    const s = patch(quiet(), (st) => {
      st.teams.t2!.leader = null;
    });
    const rise = (weeks: number) => teamSummary(advance(s, weeks).state, 't2').stress - teamSummary(s, 't2').stress;
    expect(rise(4)).toBeGreaterThan(rise(1));
  });
});
