/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { startRun } from '../../../src/levels/line-manager';
import { WANTS, type SimState } from '../../../src/sim';
import { createEngine, resolveChoice, selectSituations, type Situation } from '../../../src/situations';
import { realContent } from '../../balance/harness';
import { engineers, projects } from './fixtures';

const WEEK = 30;

/**
 * A team at week 30 with some friction in it: every engineer under some strain (enough for two of them to clash in code
 * review), a spread of skill and wants, and every project on track with time to spare, so a stakeholder's ask, a
 * conference talk and a code review clash can all find the people and projects they are about.
 */
function strainedTeam(): SimState {
  const sim = structuredClone(startRun(1).sim);
  sim.week = WEEK;
  Object.assign(sim.player, { stress: 30, reputation: 60 });
  const skills = [85, 70, 55, 40, 30, 60, 45];
  engineers(sim).forEach((id, i) => {
    Object.assign(sim.people[id]!, {
      stress: 55,
      motivation: 60,
      trust: 70,
      skill: skills[i % skills.length],
      want: WANTS[i % WANTS.length],
      joinedWeek: WEEK - 60,
      performance: 'meets',
      lowMotivationWeeks: 0,
      highStressWeeks: 0,
    });
  });
  projects(sim).forEach((id) => {
    const p = sim.projects[id]!;
    Object.assign(p, { risk: 20, techDebt: 30, startWeek: WEEK - 10, deadlineWeek: WEEK + 20 });
    p.progress = Math.ceil(p.scope * 0.6);
  });
  return sim;
}

/** The same team some weeks on, its projects' plans moved with the clock so that they are as on track as they were. */
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

const FOLLOWED = ['scope-creep', 'conference-talk', 'review-friction'];
const people = (s: Situation, bindings: Record<string, string>) =>
  s.roles
    .filter((r) => r.kind === 'person')
    .map((r) => bindings[r.name]!)
    .sort((a, b) => a.localeCompare(b));

describe('follow-ups to the story situations that came back most', () => {
  // @spec LINE-MOMENT-011
  it('shows each once a run, and follows it a quarter later with a scene about the same people, whatever was chosen', () => {
    const content = realContent();
    for (const id of FOLLOWED) {
      const first = content.find((s) => s.id === id)!;
      expect(first.once, `${id} is once a run`).toBe(true);
      const later = content.find((s) => s.id === `${id}-later`);
      expect(later, `${id} has a follow-up`).toBeDefined();
      for (const choice of first.choices) {
        const sim = strainedTeam();
        const shown = selectSituations(createEngine(1), sim, [first], 'line-manager', 1, {}, 0);
        const p = shown.presented[0]!;
        expect(p, `${id} is shown to the team`).toBeDefined();
        const resolved = resolveChoice(shown.engine, sim, content, p.id, choice.id);
        expect(resolved.kind, `${id}: ${choice.id}`).toBe('resolved');
        if (resolved.kind !== 'resolved') continue;
        const offer = (weeks: number) => selectSituations(resolved.engine, weeksOn(resolved.sim, weeks), [later!], 'line-manager', 1, {}, 0).presented;
        // Not before a quarter has passed.
        expect(offer(4), `${id}-later 4 weeks on, after ${choice.id}`).toEqual([]);
        expect(offer(12), `${id}-later 12 weeks on, after ${choice.id}`).toEqual([]);
        // From then on, about the people who were there, and only them.
        const back = offer(13);
        expect(back, `${id}-later a quarter on, after ${choice.id}`).toHaveLength(1);
        expect(people(later!, back[0]!.bindings), `${id}-later is about the same people, after ${choice.id}`).toEqual(people(first, p.bindings));
      }
      // On a team where the first was never shown, there is no follow-up.
      expect(selectSituations(createEngine(1), weeksOn(strainedTeam(), 13), [later!], 'line-manager', 1, {}, 0).presented, `${id}-later without ${id}`).toEqual([]);
    }
  });

  // @spec LINE-MOMENT-012
  it('names the engineer on the project’s team who would build a stakeholder’s ask, and leaves them a memory of every answer', () => {
    const content = realContent();
    const first = content.find((s) => s.id === 'scope-creep')!;
    const role = first.roles.find((r) => r.kind === 'person');
    expect(role, 'scope-creep has an engineer').toBeDefined();
    for (const choice of first.choices) {
      const sim = strainedTeam();
      const shown = selectSituations(createEngine(1), sim, [first], 'line-manager', 1, {}, 0);
      const p = shown.presented[0]!;
      const engineer = p.bindings[role!.name]!;
      const project = p.bindings[first.roles.find((r) => r.kind === 'project')!.name]!;
      expect(sim.people[engineer]!.teamId, 'the engineer is on the project’s team').toBe(sim.projects[project]!.teamId);
      const resolved = resolveChoice(shown.engine, sim, content, p.id, choice.id);
      if (resolved.kind !== 'resolved') throw new Error(`scope-creep: ${choice.id} did not resolve`);
      const remembered = resolved.sim.people[engineer]!.history.filter((h) => h.cause.kind === 'situation' && h.cause.situationId === 'scope-creep');
      expect(remembered, `scope-creep: ${choice.id} leaves the engineer a memory`).toHaveLength(1);
    }
  });
});
