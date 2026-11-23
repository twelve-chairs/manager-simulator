import { band } from '../line-manager';
import { deliveredRatings, meanStep } from '../senior-manager';
import { applyEffects, attritionRiskOf, behindScheduleProjects, overdueProjects, planOf, PERFORMANCE_LEVELS, RATINGS, type ChangeLogEntry, type Effect, type SimState } from '../../sim';
import { generateSeniorManager, leaderOf, quarterOf, randomInt, rule } from './core';
import { periodEndsThisQuarter, quartersPlayed } from './review';
import { takeSurvey } from './survey';
import { DIRECTOR_TUNING as T } from './tuning';
import type { DirectorHabits, DirectorState } from './types';

type Result<X> = ({ ok: true } & X) | { ok: false; error: string };

const OPTIONS: { [K in keyof DirectorHabits]: readonly DirectorHabits[K][] } = {
  time: ['organization', 'balanced', 'upward'],
  staffMeeting: ['weekly', 'fortnightly'],
  listeningTour: ['none', 'quarterly'],
};

/** Changes a standing habit; it applies from this quarter's end. */
// @spec DIR-HABIT-002, DIR-HABIT-003
export function setDirectorHabit(level: DirectorState, _sim: SimState, command: unknown): Result<{ level: DirectorState }> {
  if (typeof command !== 'object' || command === null) return { ok: false, error: 'a habit change must be an object' };
  const c = command as { habit?: unknown; value?: unknown };
  if (typeof c.habit !== 'string' || !Object.hasOwn(OPTIONS, c.habit)) return { ok: false, error: `unknown habit ${String(c.habit)}` };
  const habit = c.habit as keyof DirectorHabits;
  if (!(OPTIONS[habit] as readonly unknown[]).includes(c.value)) return { ok: false, error: `unknown option ${String(c.value)} for ${habit}` };
  const s = structuredClone(level);
  (s.habits as unknown as Record<string, unknown>)[habit] = c.value;
  return { ok: true, level: s };
}

const energyless = (field: 'reputation', amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'player' }, field, amount, cause: rule(ruleId) });
const value = (kind: 'person' | 'team' | 'project', id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind, id }, field, amount, cause: rule(ruleId) });
const energy = (amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'player' }, field: 'stress', amount, cause: rule(ruleId) });

function apply(sim: SimState, effects: Effect[], log: ChangeLogEntry[]): SimState {
  if (!effects.length) return sim;
  const r = applyEffects(sim, effects);
  if (!r.ok) throw new Error(`end of quarter: ${r.error.message}`);
  log.push(...r.log);
  return r.state;
}

/** Whether a quarter with these habits gives a senior manager what they want from the job. */
function served(want: string, habits: DirectorHabits, groupStress: number): boolean {
  switch (want) {
    case 'growth':
      return habits.time !== 'upward';
    case 'autonomy':
      return habits.time !== 'organization';
    case 'recognition':
      return habits.staffMeeting === 'weekly';
    default:
      return band(groupStress) < 3;
  }
}

/** Re-rate effects that turn a group's ratings now into the target ones. */
function reRates(sim: SimState, groupId: string, target: Record<(typeof PERFORMANCE_LEVELS)[number], number>): Effect[] {
  const now = { ...sim.teams[groupId]!.aggregate!.ratings };
  const effects: Effect[] = [];
  for (const from of PERFORMANCE_LEVELS) {
    for (const to of RATINGS) {
      if (from === to) continue;
      const count = Math.min(now[from] - (from === 'unrated' ? 0 : target[from]), target[to] - now[to]);
      if (count <= 0) continue;
      effects.push({ type: 'reRate', teamId: groupId, from, to, count, cause: rule('director.calibration') });
      now[from] -= count;
      now[to] += count;
    }
  }
  return effects;
}

/**
 * What the quarter's end settles before the habits act: moments left waiting, senior managers arriving, bets moving,
 * landing or failing, what a quarterly review left out coming to light, and peers going to the executive.
 */
// @spec DIR-MOMENT-006, DIR-BET-003, DIR-BET-004, DIR-QBR-003, DIR-PEER-002, DIR-PLAN-003
function settleQuarter(s: DirectorState, sim0: SimState, log: ChangeLogEntry[]): SimState {
  let sim = sim0;
  const effects: Effect[] = [];
  const executive = s.executiveId;
  // Moments left waiting: heads held back, no bet funded, the review told straight, one more period for a plan.
  for (const m of s.moments) {
    if (m.status !== 'open') continue;
    if (m.kind === 'headcount' && m.heads) effects.push(value('person', executive, 'trust', -m.heads * T.head.heldTrust, 'director.headcount'));
    if (m.kind === 'finalEvaluation') s.heldEvaluations = s.heldEvaluations.filter((id) => id !== m.personId);
    if (m.kind === 'review') {
      const troubled = troubledIds(s, sim);
      effects.push(value('person', executive, 'trust', T.review.straightTrust, 'director.review'), energyless('reputation', -troubled.length * T.review.troubleReputation, 'director.review'));
    }
    m.status = 'waited';
  }
  // Senior managers hired from outside arrive.
  for (const [g, since] of Object.entries(s.arriving)) {
    if (since > sim.week) continue;
    delete s.arriving[g];
    if (!sim.teams[g] || leaderOf(sim, g)) continue;
    const hire = generateSeniorManager(s, sim, { skill: randomInt(s, [40, 59]), trust: 50 });
    s.leniency[hire.id] = randomInt(s, [0, 2]);
    effects.push({ type: 'hire', teamId: g, person: hire, cause: rule('director.newSenior') });
  }
  sim = apply(sim, effects.splice(0), log);

  // Bets: slowed by a strained group, sped by a trusting peer, then landed or failed.
  const b = T.bets;
  for (const bet of s.bets) {
    const p = sim.projects[bet.projectId];
    const a = sim.teams[bet.groupId]?.aggregate;
    if (!p || p.status !== 'active' || !a) continue;
    if (band(a.stress) >= 3) effects.push(value('project', p.id, 'progress', -b.strainedSlow, 'director.bets'));
    if (bet.peerId && (sim.people[bet.peerId]?.trust ?? 0) >= b.peerTrust) effects.push(value('project', p.id, 'progress', b.peerSpeed, 'director.bets'));
  }
  sim = apply(sim, effects.splice(0), log);
  for (const g of s.groupIds) s.leaderlessEnds[g] = sim.teams[g] && !leaderOf(sim, g) ? (s.leaderlessEnds[g] ?? 0) + 1 : 0;
  const kept = [];
  for (const bet of s.bets) {
    const p = sim.projects[bet.projectId];
    const landed = p?.status === 'completed' && (s.completions[bet.projectId] ?? sim.week) <= p.deadlineWeek;
    const failed =
      !p || p.status === 'cancelled' || (p.status === 'completed' && !landed) || (p.status === 'active' && sim.week > p.deadlineWeek + b.grace) || !sim.teams[bet.groupId] || (s.leaderlessEnds[bet.groupId] ?? 0) >= 2;
    if (landed) effects.push(energyless('reputation', bet.landing, 'director.bets'), value('person', executive, 'trust', bet.landing, 'director.bets'));
    else if (failed) {
      effects.push(energyless('reputation', -bet.failing, 'director.bets'), value('person', executive, 'trust', -bet.failing, 'director.bets'));
      if (p?.status === 'active') effects.push({ type: 'cancelProject', projectId: p.id, cause: rule('director.bets') });
    } else kept.push(bet);
  }
  s.bets = kept;

  // What a quarterly review left out, still in trouble a quarter on, costs more than the truth would have.
  const troubled = new Set([...overdueProjects(sim), ...behindScheduleProjects(sim)].map((p) => p.id));
  const stillOut = [];
  for (const x of s.leftOut) {
    if (x.week >= sim.week) {
      stillOut.push(x);
      continue;
    }
    const p = sim.projects[x.id];
    if (!p || p.status === 'cancelled' || troubled.has(x.id)) effects.push(value('person', executive, 'trust', -T.review.caughtTrust, 'director.review'), energyless('reputation', -T.review.caughtReputation, 'director.review'));
  }
  s.leftOut = stillOut;

  // A peer who distrusts the player takes it to the executive, once a period.
  const period = Math.floor(quartersPlayed(s, sim) / T.reviewEveryQuarters);
  for (const peer of s.peerIds) {
    const p = sim.people[peer];
    if (!p || p.status !== 'active' || p.trust >= T.peer.escalateBelow || s.escalated[peer] === period) continue;
    s.escalated[peer] = period;
    effects.push(
      { type: 'value', target: { kind: 'person', id: executive }, field: 'trust', amount: -T.peer.escalateTrust, cause: rule('director.peer'), historyNote: 'Heard a peer’s complaint about you' },
      { type: 'value', target: { kind: 'person', id: peer }, field: 'trust', amount: 0, cause: rule('director.peer'), historyNote: 'Took a complaint about you to the executive' },
    );
  }
  return apply(sim, effects, log);
}

function troubledIds(s: DirectorState, sim: SimState): string[] {
  const troubled = new Set([...overdueProjects(sim), ...behindScheduleProjects(sim)].map((p) => p.id));
  return Object.values(sim.projects).filter((p) => p.status === 'active' && s.groupIds.includes(p.teamId) && troubled.has(p.id)).map((p) => p.id);
}

/**
 * Ends the quarter: the habits act, the listening tour visits, each group and senior manager drift, and at a period's
 * end the survey is taken, the groups are calibrated and the senior managers rated.
 */
// @spec DIR-MOMENT-006, DIR-HABIT-004, DIR-HABIT-005, DIR-HABIT-006, DIR-DRIFT-001, DIR-DRIFT-002, DIR-DRIFT-003, DIR-DRIFT-004, DIR-PLAN-001, DIR-PLAN-002
export function endQuarter(level: DirectorState, sim0: SimState): Result<{ level: DirectorState; sim: SimState; log: ChangeLogEntry[] }> {
  const s = structuredClone(level);
  const log: ChangeLogEntry[] = [];
  let sim = settleQuarter(s, sim0, log);
  const effects: Effect[] = [];
  const leads = s.groupIds.map((g) => ({ groupId: g, id: leaderOf(sim, g) }));
  const above = [s.executiveId, ...s.peerIds].filter((id) => sim.people[id]?.status === 'active');

  // Where the time goes.
  const t = T.time;
  if (s.habits.time === 'upward') {
    for (const id of above) effects.push(value('person', id, 'trust', t.aboveTrust, 'director.time'));
    for (const g of s.groupIds) effects.push(value('team', g, 'motivation', -t.groupMotivation, 'director.time'));
  } else if (s.habits.time === 'organization') {
    for (const id of above) effects.push(value('person', id, 'trust', -t.aboveTrust, 'director.time'));
    for (const g of s.groupIds) effects.push(value('team', g, 'motivation', t.groupMotivation, 'director.time'));
    for (const { id } of leads) if (id) effects.push(value('person', id, 'trust', t.seniorTrust, 'director.time'));
  }

  // Staff meetings.
  const meeting = T.staffMeeting[s.habits.staffMeeting];
  effects.push(energy(meeting.energy, 'director.staffMeeting'));
  for (const { id } of leads) {
    if (!id) continue;
    effects.push(value('person', id, 'trust', meeting.trust, 'director.staffMeeting'));
    s.learnedWants[id] = true;
  }

  // The listening tour.
  s.surfaced = [];
  if (s.habits.listeningTour === 'quarterly' && s.groupIds.length) {
    const g = s.groupIds[s.tourRotation % s.groupIds.length]!;
    s.tourRotation += 1;
    s.visited = { groupId: g, quarter: quarterOf(s, sim) + 1 };
    s.surfaced = [{ groupId: g, week: sim.week }];
    effects.push(energy(T.tourEnergy, 'director.listeningTour'));
  }

  // Groups drift toward what their senior managers sustain; senior managers toward their wants and their groups.
  for (const { groupId, id } of leads) {
    const a = sim.teams[groupId]!.aggregate!;
    const skill = id ? sim.people[id]!.skill : T.leaderlessSkill;
    const motivation = T.sustains.motivationBase + skill * T.sustains.motivationPerSkill;
    const stress = T.sustains.stressBase - skill * T.sustains.stressPerSkill;
    effects.push(value('team', groupId, 'motivation', Math.round((motivation - a.motivation) * T.driftShare), 'director.drift'), value('team', groupId, 'stress', Math.round((stress - a.stress) * T.driftShare), 'director.drift'));
    if (id) {
      const m = sim.people[id]!;
      effects.push(
        value('person', id, 'motivation', served(m.want, s.habits, a.stress) ? T.wantServed : T.wantUnserved, 'director.drift'),
        value('person', id, 'stress', Math.round((a.stress - m.stress) * T.seniorStressShare), 'director.drift'),
      );
    }
  }
  sim = apply(sim, effects, log);
  sim = apply(sim, s.groupIds.map((g) => {
    const a = sim.teams[g]!.aggregate!;
    return value('team', g, 'attritionRisk', attritionRiskOf(a.motivation, a.stress) - a.attritionRisk, 'director.drift');
  }), log);

  if (periodEndsThisQuarter(s, sim)) {
    // Each senior manager calibrates their group: its delivery, raised by their leniency.
    const gaps: number[] = [];
    for (const g of s.groupIds) {
      const delivered = deliveredRatings(sim, g);
      const lead = leaderOf(sim, g);
      const lenient = lead ? (s.leniency[lead] ?? 0) : 0;
      const target = { unrated: 0, below: 0, partial: 0, meets: 0, exceeds: 0, outstanding: 0 };
      RATINGS.forEach((r, i) => (target[RATINGS[Math.min(4, i + lenient)]!] += delivered[r]));
      sim = apply(sim, reRates(sim, g, target), log);
      gaps.push(Math.abs(meanStep(sim.teams[g]!.aggregate!.ratings) - meanStep(delivered)));
    }
    s.calibrations.push({ week: sim.week, gap: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0 });

    // Each senior manager is rated on how their group delivered and fared under them.
    const ratings: Effect[] = [];
    for (const g of s.groupIds) {
      const id = leaderOf(sim, g);
      if (!id) continue;
      const a = sim.teams[g]!.aggregate!;
      const step = Math.round(meanStep(deliveredRatings(sim, g))) - (band(a.stress) >= 3 || band(a.motivation) <= 1 ? 1 : 0);
      const rating = RATINGS[Math.max(0, Math.min(4, step))]!;
      if ((rating === 'below' || rating === 'partial') && planOf(sim, { kind: 'person', id }) === 'pip') {
        if (!s.heldEvaluations.includes(id)) s.heldEvaluations.push(id);
      } else ratings.push({ type: 'rate', target: { kind: 'person', id }, rating, cause: rule('director.seniorRating') });
    }
    sim = apply(sim, ratings, log);
    // The engagement survey, in the last quarter before the review.
    s.survey = takeSurvey(s, sim);
  }
  return { ok: true, level: s, sim, log };
}
