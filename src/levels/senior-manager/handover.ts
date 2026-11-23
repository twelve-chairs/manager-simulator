import { NAMES, type LineState } from '../line-manager';
import { addTeam, aggregateTeam, applyEffects, type Effect, type NewProject, type SimState, type Want } from '../../sim';
import { generateManager, nextId, randomInt, rule, summarizeTeam, unusedName } from './core';
import { DEFAULT_SENIOR_HABITS } from './habits';
import { periodSnapshot, remember } from './review';
import { SENIOR_TUNING } from './tuning';
import type { SeniorState } from './types';

const HANDOVER = rule('senior.handover');

export interface HandoverChoice {
  id: string;
  name: string;
  skill?: number;
  trust?: number;
  want?: Want;
}

const engineersOf = (line: LineState, sim: SimState) =>
  Object.values(sim.people)
    .filter((p) => p.teamId === line.teamId && p.status === 'active' && p.role === 'engineer')
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Who can lead the promoted player's old team: each of its engineers, or an outside hire. */
// @spec SENIOR-HAND-001
export function handoverChoices(line: LineState, sim: SimState): HandoverChoice[] {
  return [...engineersOf(line, sim).map((p) => ({ id: p.id, name: p.name, skill: p.skill, trust: p.trust, want: p.want })), { id: 'hire', name: 'An outside hire' }];
}

type Result = { ok: true; sim: SimState; level: SeniorState } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });

/** Applies a batch the handover builds itself; a refusal is a bug in the level, not the player's doing. */
function apply(sim: SimState, effects: Effect[]): SimState {
  const result = applyEffects(sim, effects);
  if (!result.ok) throw new Error(`handover: ${result.error.message}`);
  return result.state;
}

/**
 * Takes a promoted line manager run over at the senior manager level: the old team gets the chosen leader and is folded
 * into an aggregate, two more teams join the group, and the player's standing carries over.
 */
// @spec SENIOR-HAND-002, SENIOR-HAND-003, SENIOR-HAND-004, SENIOR-HAND-005, SENIOR-HAND-006, SENIOR-CONTRACT-001, SENIOR-STATE-001
export function takeOver(line: LineState, lineSim: SimState, choice: string): Result {
  const engineers = engineersOf(line, lineSim);
  if (choice !== 'hire' && !engineers.some((p) => p.id === choice)) return fail(`${choice || 'nobody'} cannot lead the team: choose one of its engineers or an outside hire`);

  const level: SeniorState = {
    // Its own stream, from the line level's, so the same promoted run always takes over the same way.
    rngState: Math.imul((line.rngState ^ 0x9e3779b9) >>> 0, 2246822519) >>> 0,
    startWeek: lineSim.week,
    teamIds: [line.teamId],
    leniency: {},
    habits: { ...DEFAULT_SENIOR_HABITS, oversight: {} },
    learnedWants: {},
    listenedTo: [],
    backfills: [],
    closeMonths: {},
    skipRotation: 0,
    surfaced: [],
    burnoutMonths: 0,
    knownHeadcount: {},
    knownRatings: {},
    regretted: [],
    completions: {},
    periodStart: { week: lineSim.week, skill: 0, health: {} },
    moments: [],
    lastApproval: {},
    restructured: false,
    arriving: {},
    counters: { person: 0, team: 0, project: 0, hire: 0, moment: 0 },
  };
  let sim = lineSim;
  const teamId = line.teamId;
  let leadId: string;

  if (choice === 'hire') {
    const hire = generateManager(level, sim, { skill: randomInt(level, 40, 59), trust: 50 });
    leadId = hire.id;
    sim = apply(sim, [
      { type: 'hire', teamId, person: hire, cause: HANDOVER },
      { type: 'setLeader', teamId, leader: { kind: 'person', id: hire.id }, cause: HANDOVER },
    ]);
  } else {
    const lead = engineers.find((p) => p.id === choice)!;
    const grows = lead.trust >= SENIOR_TUNING.growingManagerTrust && lead.want === 'growth';
    // A strong engineer is not thereby a good manager: management skill starts again.
    const skill = grows ? randomInt(level, 20, 39) : randomInt(level, 5, 19);
    leadId = lead.id;
    sim = apply(sim, [
      { type: 'setLeader', teamId, leader: { kind: 'person', id: lead.id }, cause: HANDOVER },
      { type: 'value', target: { kind: 'person', id: lead.id }, field: 'skill', amount: skill - lead.skill, cause: HANDOVER },
    ]);
    level.backfills.push({ teamId, since: lineSim.week, months: 0 });
  }
  sim = aggregateTeam(sim, teamId, HANDOVER).state;
  if (choice === 'hire') {
    const before = summarizeTeam(lineSim, teamId);
    const raised = Math.min(100, before.stress + SENIOR_TUNING.hireStress);
    sim = apply(sim, [{ type: 'value', target: { kind: 'team', id: teamId }, field: 'stress', amount: raised - sim.teams[teamId]!.aggregate!.stress, cause: HANDOVER }]);
  }

  const managers = [leadId];
  for (let i = 0; i < 2; i++) {
    const id = nextId(level, 'team', 't', sim.teams);
    const manager = generateManager(level, sim);
    const added = addTeam(
      sim,
      {
        team: {
          id,
          name: unusedName(level, NAMES.teams, Object.values(sim.teams).map((t) => t.name)),
          aggregate: {
            headcount: randomInt(level, SENIOR_TUNING.teamSize[0], SENIOR_TUNING.teamSize[1]),
            skill: randomInt(level, 35, 75),
            motivation: randomInt(level, 40, 75),
            stress: randomInt(level, 20, 55),
          },
        },
        manager,
      },
      HANDOVER,
    );
    if (!added.ok) throw new Error(`handover: ${added.error}`);
    sim = added.state;
    const projects: NewProject[] = Array.from({ length: randomInt(level, 1, 2) }, () => ({
      id: nextId(level, 'project', 'pr', sim.projects),
      name: unusedName(level, NAMES.projects, Object.values(sim.projects).map((p) => p.name)),
      teamId: id,
      scope: randomInt(level, 80, 140),
      risk: randomInt(level, 10, 70),
      techDebt: randomInt(level, 10, 50),
      deadlineWeek: sim.week + randomInt(level, 20, 32),
    }));
    for (const project of projects) sim = apply(sim, [{ type: 'startProject', project, cause: HANDOVER }]);
    level.teamIds.push(id);
    managers.push(manager.id);
  }
  for (const m of managers) {
    level.leniency[m] = randomInt(level, 0, 2);
    level.habits.oversight[m] = 'coaching';
  }
  remember(level, sim);
  level.periodStart = periodSnapshot(level, sim);
  return { ok: true, sim, level };
}
