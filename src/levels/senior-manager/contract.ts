import type { LineState } from '../line-manager';
import type { CareerLevel } from '../../loop/types';
import type { SimState } from '../../sim';
import { RATINGS } from '../../sim';
import { acceptRemaining, calibrateTeam, overCurveLine, type CalibrationMove } from './calibration';
import { handoverChoices, takeOver } from './handover';
import { setSeniorHabit, endMonth } from './month';
import { beginMonth, chooseSenior } from './moments';
import { SENIOR_LEVEL, afterAdvanceSenior, assessSenior, seniorScorecard } from './review';
import type { SeniorState } from './types';
import { seniorView } from './view';

type Choose = ReturnType<CareerLevel<SeniorState>['choose']>;

/** Whether a moment can still be answered: what it is about is still there for its choices to act on. */
function answerable(level: SeniorState, sim: SimState, m: SeniorState['moments'][number]): boolean {
  if (m.status !== 'open') return false;
  const team = m.teamId ? sim.teams[m.teamId] : undefined;
  switch (m.kind) {
    case 'approval': {
      const r = team?.aggregate?.ratings;
      return m.detail === 'promote' ? (r?.exceeds ?? 0) > 0 : (team?.aggregate?.headcount ?? 0) > 1;
    }
    case 'dispute':
      return [m.projectId, m.otherProjectId].every((id) => sim.projects[id!]?.status === 'active');
    case 'finalEvaluation':
      return sim.people[m.managerId!]?.status === 'active';
    case 'replaceManager':
      return team?.leader === null;
    case 'staffing':
      return (sim.teams[m.otherTeamId!]?.aggregate?.headcount ?? 0) > 1;
    default:
      return true;
  }
}

/** Settles a calibration moment as a whole: each team's moves from `settle:{…}`, any team it leaves out as proposed. */
function settle(level: SeniorState, sim: SimState, momentId: string, json: string): Choose {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'calibration moves must be JSON' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ok: false, error: 'calibration moves must name teams' };
  const moment = level.moments.find((m) => m.id === momentId && m.kind === 'calibration');
  if (!moment) return { ok: false, error: `moment ${momentId} is not a calibration` };
  const teams = new Set(moment.calibration!.map((c) => c.teamId));
  let l = level;
  let s = sim;
  const log = [];
  for (const [teamId, moves] of Object.entries(parsed as Record<string, unknown>)) {
    if (!teams.has(teamId)) return { ok: false, error: `${teamId} is not in the calibration` };
    if (!Array.isArray(moves) || !moves.every((m) => typeof m === 'object' && m !== null && RATINGS.includes((m as CalibrationMove).from))) return { ok: false, error: `the moves for ${teamId} are not a list of moves` };
    const r = calibrateTeam(l, s, momentId, teamId, moves as CalibrationMove[]);
    if (!r.ok) return r;
    l = r.level;
    s = r.sim;
    log.push(...r.log);
  }
  const rest = acceptRemaining(l, s, momentId);
  if (!rest.ok) return rest;
  const over = overCurveLine(rest.level, momentId);
  return { ok: true, level: rest.level, sim: rest.sim, log: [...log, ...rest.log], reaction: over ? `Each team is settled.${over}` : 'Calibration is done. Each manager takes the ratings back to their team.' };
}

/** The senior manager level as the turn loop sees it. */
// @spec SENIOR-CONTRACT-001
export const seniorManagerLevel: CareerLevel<SeniorState> = {
  params: SENIOR_LEVEL,
  start() {
    throw new Error('the senior manager level is reached by promotion, not started');
  },
  beginWeek: beginMonth,
  moments: (level, sim) => level.moments.map((m) => ({ id: m.id, day: m.week * 5 + m.day, time: m.time, open: answerable(level, sim, m), title: m.title })),
  plan(level, sim, command) {
    if (typeof command !== 'object' || command === null || Array.isArray(command)) return { ok: false, error: 'a planning command must be an object' };
    const { kind, ...habit } = command as { kind?: unknown };
    if (kind !== 'habit') return { ok: false, error: `unknown planning command ${String(kind)}` };
    return setSeniorHabit(level, sim, habit);
  },
  choose(level, sim, momentId, choiceId) {
    if (typeof choiceId === 'string' && choiceId.startsWith('settle:')) return settle(level, sim, momentId, choiceId.slice('settle:'.length));
    return chooseSenior(level, sim, momentId, choiceId);
  },
  endWeek: endMonth,
  afterAdvance: afterAdvanceSenior,
  scorecard: seniorScorecard,
  assess: assessSenior,
  view: seniorView,
  handoverChoices: (previous, sim) => handoverChoices(previous as LineState, sim),
  takeOver: (previous, sim, choice) => takeOver(previous as LineState, sim, choice),
};
