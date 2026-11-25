import { describe, expect, it } from 'vitest';
import { startRun } from '../../../src/levels/line-manager';
import type { SimState } from '../../../src/sim';
import { createEngine, resolveChoice, selectSituations, type Situation } from '../../../src/situations';
import { realContent } from '../../balance/harness';
import { engineers } from './fixtures';

const WEEK = 30;

/** A team at week 30 where only the first engineer is in the state a scene is about, and is put back in it on demand. */
const SCENES: Record<string, (sim: SimState, id: string) => void> = {
  // Gone quiet: motivation low, and what they want unserved for months.
  'flight-risk-1on1': (sim, id) => Object.assign(sim.people[id]!, { motivation: 30, wantServedWeek: 0, trust: 60 }),
  // On an improvement plan: two low ratings in a row.
  'improvement-plan': (sim, id) => {
    const p = sim.people[id]!;
    if (!p.history.some((h) => h.rating)) p.history.push({ week: 1, cause: { kind: 'rule', ruleId: 'x' }, rating: 'partial' }, { week: 14, cause: { kind: 'rule', ruleId: 'x' }, rating: 'below' });
    Object.assign(p, { motivation: 45 });
  },
};

function team(scene: string): { sim: SimState; who: string } {
  const sim = structuredClone(startRun(1).sim);
  sim.week = WEEK;
  for (const id of engineers(sim)) Object.assign(sim.people[id]!, { motivation: 70, stress: 30, trust: 60, wantServedWeek: WEEK });
  const who = engineers(sim)[0]!;
  SCENES[scene]!(sim, who);
  return { sim, who };
}

/** The same team `weeks` on, the engineer back in the scene's state. */
function weeksOn(scene: string, sim: SimState, who: string, weeks: number): SimState {
  const next = structuredClone(sim);
  next.week += weeks;
  SCENES[scene]!(next, who);
  return next;
}

const person = (s: Situation) => s.roles.find((r) => r.kind === 'person')!.name;

describe('follow-ups for scenes about a person’s state', () => {
  // @spec LINE-MOMENT-013
  it('comes once for the same person, then as a follow-up a quarter later, whatever was chosen, once', () => {
    const content = realContent();
    for (const id of Object.keys(SCENES)) {
      const first = content.find((s) => s.id === id)!;
      const later = content.find((s) => s.id === `${id}-later`);
      expect(later, `${id} has a follow-up`).toBeDefined();
      const { sim, who } = team(id);
      const shown = selectSituations(createEngine(1), sim, [first], 'line-manager', 1, {}, 0);
      const p = shown.presented[0]!;
      expect(p?.bindings[person(first)], `${id} is about the engineer in that state`).toBe(who);
      for (const choice of p.choices) {
        const resolved = resolveChoice(shown.engine, sim, content, p.id, choice.id);
        expect(resolved.kind, `${id}: ${choice.id}`).toBe('resolved');
        if (resolved.kind !== 'resolved') continue;
        const at = (weeks: number) => weeksOn(id, resolved.sim, who, weeks);
        const offer = (s: Situation, weeks: number, engine = resolved.engine) => selectSituations(engine, at(weeks), [s], 'line-manager', 1, {}, 0);
        // Never the same scene about the same person again.
        expect(offer(first, 30).presented, `${id} again for the same person, after ${choice.id}`).toEqual([]);
        // The follow-up, from a quarter on, about them.
        expect(offer(later!, 12).presented, `${id}-later 12 weeks on, after ${choice.id}`).toEqual([]);
        const back = offer(later!, 13);
        expect(back.presented, `${id}-later a quarter on, after ${choice.id}`).toHaveLength(1);
        expect(back.presented[0]!.bindings[person(later!)]).toBe(who);
        // and only once for them.
        const done = resolveChoice(back.engine, at(13), content, back.presented[0]!.id, back.presented[0]!.choices[0]!.id);
        if (done.kind !== 'resolved') throw new Error(`${id}-later did not resolve`);
        expect(selectSituations(done.engine, weeksOn(id, done.sim, who, 30), [later!], 'line-manager', 1, {}, 0).presented, `${id}-later twice`).toEqual([]);
      }
      // Nobody who was not in the first.
      expect(selectSituations(createEngine(1), weeksOn(id, sim, who, 13), [later!], 'line-manager', 1, {}, 0).presented, `${id}-later without ${id}`).toEqual([]);
    }
  });
});
