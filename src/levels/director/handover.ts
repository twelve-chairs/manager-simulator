import type { SeniorState } from '../senior-manager';
import { addOutsider, applyEffects, type Effect, type SimState, type Want } from '../../sim';
import { addUnit, foldUnits, must } from '../org';
import { generateOutsider, generateSeniorManager, leaderOf, randomInt, rule } from './core';
import { DEFAULT_DIRECTOR_HABITS } from './habits';
import { takeSurvey } from './survey';
import { remember } from './review';
import { setGoals } from './goals';
import { DIRECTOR_TUNING as T } from './tuning';
import type { DirectorState } from './types';

const HANDOVER = rule('director.handover');

export interface HandoverChoice {
  id: string;
  name: string;
  skill?: number;
  trust?: number;
  want?: Want;
}

type Result = { ok: true; sim: SimState; level: DirectorState } | { ok: false; error: string };

/** The managers leading the promoted player's teams, in the group's order. */
const managersOf = (senior: SeniorState, sim: SimState) => [...new Set(senior.teamIds.map((t) => leaderOf(sim, t)).filter((id): id is string => id !== null))];

/** Who can lead the promoted player's group: each of their managers, or an outside hire. */
// @spec DIR-HAND-001
export function handoverChoices(senior: SeniorState, sim: SimState): HandoverChoice[] {
  return [...managersOf(senior, sim).map((id) => {
    const p = sim.people[id]!;
    return { id: p.id, name: p.name, skill: p.skill, trust: p.trust, want: p.want };
  }), { id: 'hire', name: 'An outside hire' }];
}

const apply = (sim: SimState, effects: Effect[]) => must(applyEffects(sim, effects), 'handover: effects').state;

/**
 * Folds the promoted player's teams into one group under its new senior manager, before the hire's adjustment: the
 * group is the chosen manager's team, or the first team with an outside hire leading it; every other team's heads,
 * manager and active projects move into it, and the emptied team is closed.
 */
// @spec DIR-HAND-002, DIR-HAND-004
export function foldGroup(senior: SeniorState, start: SimState, choice: string, level: DirectorState): { sim: SimState; groupId: string } {
  const folded = foldUnits(start, senior.teamIds, choice, (sim) => generateSeniorManager(level, sim, { skill: randomInt(level, [40, 59]), trust: 50 }), HANDOVER);
  return { sim: folded.sim, groupId: folded.unitId };
}

/**
 * Takes a promoted senior manager run over at the director level: the player's teams become one group under the chosen
 * senior manager, two more groups join, the executive and two peers arrive, and the player's standing carries over.
 */
// @spec DIR-HAND-002, DIR-HAND-003, DIR-HAND-004, DIR-HAND-005, DIR-HAND-006, DIR-HAND-007, DIR-STATE-001
export function takeOver(senior: SeniorState, seniorSim: SimState, choice: string): Result {
  const managers = managersOf(senior, seniorSim);
  if (choice !== 'hire' && !managers.includes(choice)) return { ok: false, error: `${choice || 'nobody'} cannot lead the group: choose one of its managers or an outside hire` };

  const level: DirectorState = {
    // Its own stream, from the senior level's, so the same promoted run always takes over the same way.
    rngState: Math.imul((senior.rngState ^ 0x85ebca6b) >>> 0, 3266489917) >>> 0,
    startWeek: seniorSim.week,
    groupIds: [],
    executiveId: '',
    peerIds: [],
    leniency: {},
    habits: { ...DEFAULT_DIRECTOR_HABITS },
    learnedWants: {},
    survey: { quarter: 1, groups: {} },
    visited: null,
    bets: [],
    tourRotation: 0,
    surfaced: [],
    heldEvaluations: [],
    calibrations: [],
    burnoutQuarters: 0,
    moments: [],
    arriving: {},
    leftOut: [],
    completions: {},
    leaderlessEnds: {},
    escalated: {},
    goals: [],
    periodStart: seniorSim.week,
    knownRatings: {},
    regretted: [],
    headsLost: [],
    funded: [],
    betResults: [],
    quarterStart: null,
    joined: [],
    letGo: [],
    counters: { person: 0, team: 0, project: 0, moment: 0, goal: 0, bet: 0 },
  };
  let { sim, groupId } = foldGroup(senior, seniorSim, choice, level);
  if (choice === 'hire') {
    const stress = sim.teams[groupId]!.aggregate!.stress;
    sim = apply(sim, [{ type: 'value', target: { kind: 'team', id: groupId }, field: 'stress', amount: Math.min(100, stress + T.hireStress) - stress, cause: HANDOVER }]);
  }
  level.groupIds.push(groupId);

  const shape = { size: T.groupSize, skill: T.groupSkill, motivation: T.groupMotivation, stress: T.groupStress, projectDeadline: T.groupProjectDeadline, projectScopePerWeek: T.groupProjectScopePerWeek };
  for (let i = 0; i < 2; i++) {
    const added = addUnit(level, sim, { unit: 'g', project: 'gp' }, generateSeniorManager(level, sim), shape, HANDOVER);
    sim = added.sim;
    level.groupIds.push(added.unitId);
  }

  const executive = generateOutsider(level, sim, 'executive');
  sim = must(addOutsider(sim, executive, HANDOVER), 'adding the executive').state;
  level.executiveId = executive.id;
  for (let i = 0; i < 2; i++) {
    const peer = generateOutsider(level, sim, 'peer');
    sim = must(addOutsider(sim, peer, HANDOVER), 'adding a peer').state;
    level.peerIds.push(peer.id);
  }

  for (const g of level.groupIds) {
    const lead = leaderOf(sim, g)!;
    level.leniency[lead] = senior.leniency[lead] ?? randomInt(level, [0, 2]);
  }
  level.survey = takeSurvey(level, sim);
  remember(level, sim);
  setGoals(level, sim);
  return { ok: true, sim, level };
}

