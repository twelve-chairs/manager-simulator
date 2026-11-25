/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { startRun } from '../../../src/levels/line-manager';
import { WANTS, type SimState } from '../../../src/sim';
import { createEngine, selectSituations, type Situation } from '../../../src/situations';
import { realContent } from '../../balance/harness';
import { engineers, projects, teamOf } from './fixtures';

const WEEK = 30;

/**
 * A healthy team at week 30: nobody strained or above, the team calm, and no project overdue, behind or at high risk.
 * It has a varied cast (one engineer of each want, a spread of skill, long tenure, wants long unserved, one engineer's
 * motivation slipping), one project carrying high tech debt, and one nearly done ahead of plan, so a situation
 * about a healthy team can find the people and projects it is about.
 */
function calmTeam(): SimState {
  const sim = structuredClone(startRun(1).sim);
  sim.week = WEEK;
  Object.assign(sim.player, { stress: 30, reputation: 60 });
  const skills = [85, 70, 55, 40, 30, 60, 45];
  engineers(sim).forEach((id, i) => {
    Object.assign(sim.people[id]!, {
      stress: 25,
      motivation: i === 1 ? 45 : 65,
      trust: 70,
      skill: skills[i % skills.length],
      want: WANTS[i % WANTS.length],
      joinedWeek: WEEK - 60,
      wantServedWeek: 0,
      performance: 'meets',
      lowMotivationWeeks: 0,
      highStressWeeks: 0,
    });
  });
  projects(sim).forEach((id, i) => {
    const p = sim.projects[id]!;
    Object.assign(p, { risk: 20, techDebt: i === 0 ? 75 : 30, startWeek: WEEK - 10, deadlineWeek: WEEK + 20 });
    // The last project is nearly done, ahead of plan.
    p.progress = Math.ceil(p.scope * (i === projects(sim).length - 1 ? 0.85 : 0.6));
  });
  return sim;
}

/** The same team in trouble: every engineer strained and the first project behind schedule. */
function troubled(calm: SimState): SimState {
  const sim = structuredClone(calm);
  for (const id of engineers(sim)) sim.people[id]!.stress = 70;
  sim.projects[projects(sim)[0]!]!.progress = 0;
  return sim;
}

const holdsFor = (sim: SimState) => (s: Situation) => selectSituations(createEngine(1), sim, [s], 'line-manager', 1).presented.length === 1;

describe('situation content for a calm team', () => {
  // @spec LINE-MOMENT-008
  it('includes at least five normal-priority quiet-week line manager situations that hold for a healthy team and give way when it is in trouble', () => {
    const sim = calmTeam();
    const team = teamOf(sim);
    // The fixture is what the spec describes.
    for (const id of engineers(sim)) expect(sim.people[id]!.stress).toBeLessThan(60);
    for (const id of projects(sim)) expect(sim.projects[id]!.risk).toBeLessThan(60);
    expect(team).toBeTruthy();
    expect(troubled(sim).projects[projects(sim)[0]!]!.progress).toBe(0);

    const holding = realContent()
      .filter((s) => s.levels.includes('line-manager') && !s.id.startsWith('onboarding-') && s.priority === 'normal' && s.quietWeek === true)
      .filter(holdsFor(sim))
      .filter((s) => !holdsFor(troubled(sim))(s))
      .map((s) => s.id);
    expect({ holding, enough: holding.length >= 5 }).toEqual({ holding, enough: true });
  });
});
