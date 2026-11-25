/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { startRun } from '../../../src/levels/line-manager';
import { WANTS, type SimState } from '../../../src/sim';
import { createEngine, resolveChoice, selectSituations, type Situation } from '../../../src/situations';
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

/** The same team some weeks on, its projects' plans moved with the clock so that it is as calm as it was. */
function weeksOn(sim: SimState, weeks: number): SimState {
  const next = structuredClone(sim);
  next.week += weeks;
  for (const id of projects(next)) {
    const p = next.projects[id]!;
    p.startWeek += weeks;
    p.deadlineWeek += weeks;
  }
  return next;
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

  // @spec LINE-MOMENT-009
  it('presents each quiet-week situation once a run', () => {
    const quiet = realContent().filter((s) => s.levels.includes('line-manager') && s.quietWeek === true);
    expect(quiet.length).toBeGreaterThan(0);
    expect(quiet.filter((s) => s.once !== true).map((s) => s.id)).toEqual([]);
  });

  // @spec LINE-MOMENT-010
  it('follows each of the six calm-team scenes that came back most with a scene about the same person, a quarter later, whatever was chosen', () => {
    const content = realContent();
    const FOLLOWED = ['calm-loan', 'calm-prototype', 'calm-slack', 'calm-stretch', 'calm-ceremony', 'calm-pairing'];
    for (const id of FOLLOWED) {
      const first = content.find((s) => s.id === id)!;
      const later = content.find((s) => s.id === `${id}-later`);
      expect(later, `${id} has a follow-up`).toBeDefined();
      expect(later!.quietWeek).toBe(true);
      const person = (s: Situation) => s.roles.find((r) => r.kind === 'person')!.name;
      for (const choice of first.choices) {
        const sim = calmTeam();
        const shown = selectSituations(createEngine(1), sim, [first], 'line-manager', 1, {}, 0);
        const p = shown.presented[0]!;
        expect(p, `${id} is shown to the calm team`).toBeDefined();
        const resolved = resolveChoice(shown.engine, sim, content, p.id, choice.id);
        expect(resolved.kind, `${id}: ${choice.id}`).toBe('resolved');
        if (resolved.kind !== 'resolved') continue;
        const at = (weeks: number) => weeksOn(resolved.sim, weeks);
        const offer = (weeks: number) => selectSituations(resolved.engine, at(weeks), [later!], 'line-manager', 1, {}, 0).presented;
        // Not before a quarter has passed.
        expect(offer(4), `${id}-later 4 weeks on, after ${choice.id}`).toEqual([]);
        expect(offer(12), `${id}-later 12 weeks on, after ${choice.id}`).toEqual([]);
        // From then on, about the same person.
        const back = offer(13);
        expect(back, `${id}-later a quarter on, after ${choice.id}`).toHaveLength(1);
        expect(back[0]!.bindings[person(later!)], `${id}-later is about the same person, after ${choice.id}`).toBe(p.bindings[person(first)]);
      }
      // Nobody who was not in the first scene: on a team where it was never shown, there is no follow-up.
      expect(selectSituations(createEngine(1), weeksOn(calmTeam(), 13), [later!], 'line-manager', 1, {}, 0).presented, `${id}-later without ${id}`).toEqual([]);
    }
  });
});
