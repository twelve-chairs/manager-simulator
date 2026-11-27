import type { DirectorState } from '../director';
import { addUnit, foldUnits, knownRatings, leaderOf, must, randomInt, rule, surveyUnits } from '../org';
import { addOutsider, applyEffects, type SimState, type Want } from '../../sim';
import { DEFAULT_VP_HABITS, generateDirector, generateOutsider, quarterOf } from './core';
import { VP_TUNING as T } from './tuning';
import type { VpState } from './types';

const HANDOVER = rule('vp.handover');

export interface HandoverChoice {
  id: string;
  name: string;
  skill?: number;
  trust?: number;
  want?: Want;
}

type Result = { ok: true; sim: SimState; level: VpState } | { ok: false; error: string };

/** The senior managers leading the promoted player's groups, in the organization's order. */
const seniorManagersOf = (director: DirectorState, sim: SimState) => [...new Set(director.groupIds.map((g) => leaderOf(sim, g)).filter((id): id is string => id !== null))];

/** Who can lead the promoted player's organization: each of their senior managers, or an outside hire. */
// @spec VP-HAND-001
export function handoverChoices(director: DirectorState, sim: SimState): HandoverChoice[] {
  return [...seniorManagersOf(director, sim).map((id) => {
    const p = sim.people[id]!;
    return { id: p.id, name: p.name, skill: p.skill, trust: p.trust, want: p.want };
  }), { id: 'hire', name: 'An outside hire' }];
}

/** The VP level's state as it begins, before the handover fills it in. */
function emptyState(director: DirectorState, week: number): VpState {
  return {
    // Its own stream, from the director level's, so the same promoted run always takes over the same way.
    rngState: Math.imul((director.rngState ^ 0xc2b2ae35) >>> 0, 2246822519) >>> 0,
    startWeek: week,
    divisionIds: [],
    ceoId: '',
    peerIds: [],
    leniency: {},
    habits: { ...DEFAULT_VP_HABITS },
    learnedWants: {},
    survey: { quarter: 1, divisions: {} },
    year: null,
    priority: null,
    priorityResults: [],
    cut: { asked: false, waves: [] },
    cutHeads: [],
    told: null,
    lastDispute: null,
    heldEvaluations: [],
    calibrations: [],
    burnoutQuarters: 0,
    moments: [],
    arriving: {},
    completions: {},
    leaderlessEnds: {},
    goals: [],
    periodStart: week,
    knownRatings: {},
    regretted: [],
    headsLost: [],
    quarterStart: null,
    joined: [],
    letGo: [],
    counters: { person: 0, team: 0, project: 0, moment: 0, goal: 0 },
  };
}

/**
 * Takes a promoted director run over at the VP level: the player's groups become one division under the chosen director,
 * two more divisions join, the CEO and two peer VPs arrive, and the player's standing carries over. The director level's
 * executive and peers stay in the state, out of the function's view.
 */
// @spec VP-HAND-002, VP-HAND-003, VP-HAND-004, VP-HAND-005, VP-HAND-006, VP-HAND-007, VP-STATE-001
export function takeOver(director: DirectorState, directorSim: SimState, choice: string): Result {
  const leads = seniorManagersOf(director, directorSim);
  if (choice !== 'hire' && !leads.includes(choice)) return { ok: false, error: `${choice || 'nobody'} cannot lead the organization: choose one of its senior managers or an outside hire` };

  const level = emptyState(director, directorSim.week);
  const hire = (sim: SimState) => generateDirector(level, sim, { skill: randomInt(level, [40, 59]), trust: 50 });
  let { sim, unitId } = foldUnits(directorSim, director.groupIds, choice, hire, HANDOVER);
  if (choice === 'hire') {
    const stress = sim.teams[unitId]!.aggregate!.stress;
    sim = must(applyEffects(sim, [{ type: 'value', target: { kind: 'team', id: unitId }, field: 'stress', amount: Math.min(100, stress + T.hireStress) - stress, cause: HANDOVER }]), 'handover: effects').state;
  }
  level.divisionIds.push(unitId);

  for (let i = 0; i < 2; i++) {
    const added = addUnit(level, sim, { unit: 'dv', project: 'dp' }, generateDirector(level, sim), T.division, HANDOVER);
    sim = added.sim;
    level.divisionIds.push(added.unitId);
  }

  const ceo = generateOutsider(level, sim, 'executive');
  sim = must(addOutsider(sim, ceo, HANDOVER), 'handover: adding the CEO').state;
  level.ceoId = ceo.id;
  for (let i = 0; i < 2; i++) {
    const peer = generateOutsider(level, sim, 'peer');
    sim = must(addOutsider(sim, peer, HANDOVER), 'handover: adding a peer').state;
    level.peerIds.push(peer.id);
  }

  for (const g of level.divisionIds) {
    const lead = leaderOf(sim, g)!;
    level.leniency[lead] = director.leniency[lead] ?? randomInt(level, [0, 2]);
  }
  level.survey = { quarter: quarterOf(level, sim), divisions: surveyUnits(level.divisionIds, sim) };
  level.knownRatings = knownRatings(level.divisionIds, sim);
  return { ok: true, sim, level };
}
