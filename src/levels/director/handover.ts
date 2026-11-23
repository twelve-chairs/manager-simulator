import { NAMES } from '../line-manager';
import type { SeniorState } from '../senior-manager';
import {
  addOutsider,
  addTeam,
  applyEffects,
  closeTeam,
  moveHeads,
  PERFORMANCE_LEVELS,
  type Effect,
  type NewProject,
  type SimState,
  type Want,
} from '../../sim';
import { generateOutsider, generateSeniorManager, leaderOf, nextId, randomInt, rule, unusedName } from './core';
import { DEFAULT_DIRECTOR_HABITS } from './habits';
import { takeSurvey } from './survey';
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

/** Steps the handover builds itself; a refusal is a bug in the level, not the player's doing. */
function must<T extends { ok: boolean }>(result: T, what: string): Extract<T, { ok: true }> {
  if (!result.ok) throw new Error(`handover: ${what}: ${JSON.stringify((result as { error?: unknown }).error)}`);
  return result as Extract<T, { ok: true }>;
}
const apply = (sim: SimState, effects: Effect[]) => must(applyEffects(sim, effects), 'effects').state;

/**
 * Folds the promoted player's teams into one group under its new senior manager, before the hire's adjustment: the
 * group is the chosen manager's team, or the first team with an outside hire leading it; every other team's heads,
 * manager and active projects move into it, and the emptied team is closed.
 */
// @spec DIR-HAND-002, DIR-HAND-004
export function foldGroup(senior: SeniorState, start: SimState, choice: string, level: DirectorState): { sim: SimState; groupId: string } {
  const teams = senior.teamIds.filter((t) => start.teams[t]);
  const groupId = choice === 'hire' ? teams[0]! : teams.find((t) => leaderOf(start, t) === choice)!;
  let sim = start;
  if (choice === 'hire') {
    const old = leaderOf(sim, groupId);
    if (old) sim = apply(sim, [{ type: 'move', personId: old, teamId: groupId, cause: HANDOVER }]);
    const hire = generateSeniorManager(level, sim, { skill: randomInt(level, [40, 59]), trust: 50 });
    sim = apply(sim, [{ type: 'hire', teamId: groupId, person: hire, cause: HANDOVER }]);
  }
  for (const t of teams.filter((x) => x !== groupId)) {
    for (const l of PERFORMANCE_LEVELS) {
      const n = sim.teams[t]!.aggregate!.ratings[l];
      if (n > 0) sim = must(moveHeads(sim, { from: t, to: groupId, level: l, count: n }, HANDOVER), `moving heads from ${t}`).state;
    }
    const manager = leaderOf(sim, t);
    if (manager) sim = apply(sim, [{ type: 'move', personId: manager, teamId: groupId, cause: HANDOVER }]);
    const projects = Object.values(sim.projects).filter((p) => p.teamId === t && p.status === 'active');
    if (projects.length) sim = apply(sim, projects.map((p): Effect => ({ type: 'reassignProject', projectId: p.id, teamId: groupId, cause: HANDOVER })));
    sim = must(closeTeam(sim, t, HANDOVER), `closing ${t}`).state;
  }
  return { sim, groupId };
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
    counters: { person: 0, team: 0, project: 0, moment: 0, goal: 0, bet: 0 },
  };
  let { sim, groupId } = foldGroup(senior, seniorSim, choice, level);
  if (choice === 'hire') {
    const stress = sim.teams[groupId]!.aggregate!.stress;
    sim = apply(sim, [{ type: 'value', target: { kind: 'team', id: groupId }, field: 'stress', amount: Math.min(100, stress + T.hireStress) - stress, cause: HANDOVER }]);
  }
  level.groupIds.push(groupId);

  for (let i = 0; i < 2; i++) {
    const id = nextId(level, 'team', 'g', sim.teams);
    const manager = generateSeniorManager(level, sim);
    sim = must(
      addTeam(sim, {
        team: {
          id,
          name: unusedName(level, NAMES.teams, Object.values(sim.teams).map((t) => t.name)),
          aggregate: { headcount: randomInt(level, T.groupSize), skill: randomInt(level, T.groupSkill), motivation: randomInt(level, T.groupMotivation), stress: randomInt(level, T.groupStress) },
        },
        manager,
      }, HANDOVER),
      'adding a group',
    ).state;
    for (let j = 0; j < 2; j++) {
      const project: NewProject = {
        id: nextId(level, 'project', 'gp', sim.projects),
        name: unusedName(level, NAMES.projects, Object.values(sim.projects).map((p) => p.name)),
        teamId: id,
        scope: randomInt(level, T.groupProjectScope),
        risk: randomInt(level, [10, 70]),
        techDebt: randomInt(level, [10, 50]),
        deadlineWeek: sim.week + randomInt(level, T.groupProjectDeadline),
      };
      sim = apply(sim, [{ type: 'startProject', project, cause: HANDOVER }]);
    }
    level.groupIds.push(id);
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
  return { ok: true, sim, level };
}

