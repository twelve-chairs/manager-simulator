import { NAMES, band } from '../line-manager';
import { addTeam, applyEffects, behindScheduleProjects, type ChangeLogEntry, type Effect, type SimState } from '../../sim';
import { generateManager, leadOf, nextId, randomInt, rule, unusedName } from './core';
import { acceptRemaining, calibrationEntries } from './calibration';
import { snapshotMonth } from './recap';
import { monthOf, periodEndsThisMonth, remember } from './review';
import { SENIOR_TUNING } from './tuning';
import type { SeniorMoment, SeniorMomentKind, SeniorState } from './types';

const T = SENIOR_TUNING;
type Result<X> = ({ ok: true } & X) | { ok: false; error: string };
type Draft = Omit<SeniorMoment, 'id' | 'week' | 'day' | 'time' | 'status'>;

const CHOICES: Record<SeniorMomentKind, { id: string; label: string }[]> = {
  finalEvaluation: [
    { id: 'letGo', label: 'Let them go' },
    { id: 'oneMorePeriod', label: 'Give them one more period' },
  ],
  replaceManager: [
    { id: 'promoteFromTeam', label: 'Promote someone from the team' },
    { id: 'hire', label: 'Hire a manager from outside' },
  ],
  calibration: [{ id: 'acceptAll', label: 'Accept every proposal' }],
  surfaced: [
    { id: 'coach', label: 'Raise it with the manager and coach them through it' },
    { id: 'stepIn', label: 'Fix it yourself' },
    { id: 'letThem', label: 'Leave it with the manager' },
  ],
  escalation: [
    { id: 'coach', label: 'Coach them through it' },
    { id: 'stepIn', label: 'Step in and fix it yourself' },
    { id: 'letThem', label: 'Let them handle it' },
  ],
  staffing: [
    { id: 'move', label: 'Move someone across' },
    { id: 'hire', label: 'Backfill with a hire' },
    { id: 'decline', label: 'Decline' },
  ],
  dispute: [
    { id: 'agree', label: 'Get the two managers to agree a plan' },
    { id: 'decide', label: 'Decide it yourself' },
    { id: 'letRun', label: 'Let it run' },
  ],
  approval: [
    { id: 'approve', label: 'Approve it' },
    { id: 'evidence', label: 'Ask for the evidence first' },
    { id: 'refuse', label: 'Refuse' },
  ],
  newWork: [
    { id: 'give', label: 'Give it to a team with room' },
    { id: 'decline', label: 'Decline it' },
    { id: 'spread', label: 'Take it, and spread it across every team' },
  ],
  restructuring: [
    { id: 'promoteFromTeam', label: 'Promote its manager from one of your teams' },
    { id: 'hire', label: 'Hire its manager from outside' },
  ],
};

const name = (sim: SimState, teamId: string) => sim.teams[teamId]?.name ?? teamId;
const managerName = (level: SeniorState, sim: SimState, teamId: string) => {
  const m = leadOf(level, sim, teamId);
  return m ? sim.people[m]!.name : `${name(sim, teamId)}'s team`;
};
const activeProjects = (sim: SimState, teamId: string) =>
  Object.values(sim.projects)
    .filter((p) => p.teamId === teamId && p.status === 'active')
    .sort((a, b) => b.risk - a.risk || (a.id < b.id ? -1 : 1));

/** What a team's engineers raise at a skip-level, from the team as it really is: the most pressing of its troubles. */
// @spec SENIOR-HABIT-008
function surfacedIssue(sim: SimState, teamId: string, behind: ReadonlySet<string>): string {
  const slipping = activeProjects(sim, teamId).find((p) => behind.has(p.id));
  if (slipping) return `${slipping.name} has been slipping for weeks, and nobody upstream seems to know`;
  const a = sim.teams[teamId]!.aggregate!;
  if (band(a.stress) >= T.strainedBand) return 'on-call and late nights are wearing everyone down';
  if (band(a.attritionRisk) >= 2) return 'a couple of people have started looking around';
  if (band(a.motivation) <= 1) return 'nobody can say any more why the work matters';
  // Nothing badly wrong: one of the everyday frictions, a different one month to month and team to team.
  return EVERYDAY_ISSUES[(Math.floor(sim.week / T.weeksPerMonth) + Number(teamId.replace(/\D/g, '') || 0)) % EVERYDAY_ISSUES.length]!;
}

/** What engineers raise at a skip-level when nothing is badly wrong. */
const EVERYDAY_ISSUES = [
  "the team's priorities keep changing with no explanation",
  'the build has got slow enough that people batch their changes to avoid it',
  'there are too many meetings to get a run of focused work in',
  'nobody is sure who decides on the shared service the team depends on',
  'on-call handovers keep dropping things between shifts',
  'reviews wait days for the one person who knows the old code',
] as const;

/** Begins a month: makes its moments from the group's state, up to the cap, in order, and sets them through the month. */
// @spec SENIOR-MOMENT-001, SENIOR-MOMENT-002, SENIOR-MOMENT-003, SENIOR-MOMENT-005, SENIOR-MOMENT-006, SENIOR-MOMENT-007, SENIOR-MOMENT-008, SENIOR-MOMENT-009, SENIOR-PLAN-002, SENIOR-CAL-001
export function beginMonth(level: SeniorState, sim: SimState): SeniorState {
  const s = structuredClone(level);
  for (const [t, week] of Object.entries(s.arriving)) if (week <= sim.week) delete s.arriving[t];
  const drafts: Draft[] = [];
  const health = (t: string) => sim.teams[t]!.aggregate!;
  const behind = new Set(behindScheduleProjects(sim).map((p) => p.id));

  // Managers on a plan whose third low rating is due.
  for (const managerId of s.heldEvaluations) {
    const teamId = s.teamIds.find((t) => leadOf(s, sim, t) === managerId);
    if (!teamId || sim.people[managerId]?.status !== 'active') continue;
    const who = sim.people[managerId].name;
    drafts.push({ kind: 'finalEvaluation', teamId, managerId, title: `Final evaluation: ${who}`, text: `${who} is on an improvement plan, and ${name(sim, teamId)} is still struggling under them. A third low rating ends the plan. It's your call.`, choices: CHOICES.finalEvaluation });
  }
  // Teams with no manager and none on the way, whether theirs was let go or quit.
  for (const teamId of s.teamIds) {
    if (sim.teams[teamId]?.leader || s.arriving[teamId] !== undefined) continue;
    drafts.push({ kind: 'replaceManager', teamId, title: `${name(sim, teamId)} needs a manager`, text: `${name(sim, teamId)} has no manager. Who leads it now?`, choices: CHOICES.replaceManager });
  }
  // Calibration, in the last month before a review.
  if (periodEndsThisMonth(s, sim)) {
    drafts.push({ kind: 'calibration', title: 'Calibration', text: 'Your managers bring their proposed ratings for the period. Set each team’s beside what it delivered.', calibration: calibrationEntries(s, sim), choices: CHOICES.calibration });
  }

  // Problems skip-level listening surfaced last month.
  const surfaced = new Set(s.surfaced.map((x) => x.teamId));
  for (const t of surfaced) {
    drafts.push({ kind: 'surfaced', teamId: t, title: `What ${name(sim, t)} told you`, text: `At last month's skip-level, ${name(sim, t)}'s engineers told you ${surfacedIssue(sim, t, behind)}. ${managerName(s, sim, t)} hasn't mentioned it to you.`, choices: CHOICES.surfaced });
  }
  // Escalations from teams under strain, at risk of losing people, or with a project behind.
  for (const t of s.teamIds) {
    if (surfaced.has(t)) continue;
    const a = health(t);
    const slipping = activeProjects(sim, t).some((p) => behind.has(p.id));
    if (band(a.stress) >= 3 || band(a.attritionRisk) >= 3 || slipping) {
      const why = band(a.stress) >= 3 ? 'their team is stretched thin' : band(a.attritionRisk) >= 3 ? 'they think people are about to leave' : 'a project is slipping';
      drafts.push({ kind: 'escalation', teamId: t, title: `${managerName(s, sim, t)} needs help`, text: `${managerName(s, sim, t)} comes to you: ${why}.`, choices: CHOICES.escalation });
    }
  }
  // A staffing request from the most strained team, while another is calm.
  const byStress = [...s.teamIds].sort((x, y) => health(y).stress - health(x).stress);
  const strained = byStress.find((t) => band(health(t).stress) >= 3);
  const roomy = [...byStress].reverse().find((t) => band(health(t).stress) <= 1);
  if (strained && roomy && strained !== roomy) {
    drafts.push({ kind: 'staffing', teamId: strained, otherTeamId: roomy, title: 'A staffing request', text: `${managerName(s, sim, strained)} asks for another pair of hands. ${name(sim, roomy)} has some room.`, choices: CHOICES.staffing });
  }
  // A dispute between the two teams whose projects are most at risk.
  const atRisk = s.teamIds.filter((t) => activeProjects(sim, t)[0]?.risk !== undefined && activeProjects(sim, t)[0]!.risk >= T.atRiskProject).sort((x, y) => activeProjects(sim, y)[0]!.risk - activeProjects(sim, x)[0]!.risk);
  if (atRisk.length >= 2) {
    const [a, b] = atRisk as [string, string];
    drafts.push({
      kind: 'dispute',
      teamId: a,
      otherTeamId: b,
      projectId: activeProjects(sim, a)[0]!.id,
      otherProjectId: activeProjects(sim, b)[0]!.id,
      title: `${name(sim, a)} and ${name(sim, b)} disagree`,
      text: `${managerName(s, sim, a)} and ${managerName(s, sim, b)} both need the same shared work done first, and both projects are at risk.`,
      choices: CHOICES.dispute,
    });
  }
  // Approvals, from the teams' own ratings, at most once every three months a team.
  for (const t of s.teamIds) {
    const m = leadOf(s, sim, t);
    const last = s.lastApproval[t];
    if (!m || (last !== undefined && sim.week - last < T.approvalCooldownWeeks)) continue;
    const r = health(t).ratings;
    const detail = r.exceeds > 0 ? 'promote' : r.below > 0 ? 'letGo' : null;
    if (!detail) continue;
    s.lastApproval[t] = sim.week;
    const what = detail === 'promote' ? 'promote one of their engineers' : 'let one of their engineers go';
    drafts.push({ kind: 'approval', teamId: t, detail, title: `${managerName(s, sim, t)} asks for an approval`, text: `${managerName(s, sim, t)} wants to ${what}, and needs your sign-off.`, choices: CHOICES.approval });
  }
  // New work, while a team has none.
  // Under the habit of giving work to teams with room, only a strained team makes it the player's call; one with room is
  // given it at the month's end (SENIOR-MOMENT-013).
  const idle = s.teamIds.find((t) => activeProjects(sim, t).length === 0 && (s.habits.newWork === 'ask' || band(sim.teams[t]!.aggregate!.stress) >= T.strainedBand));
  if (idle) {
    const team = name(sim, idle);
    drafts.push({
      kind: 'newWork',
      teamId: idle,
      title: 'New work for the group',
      text: `Your manager has a new project for the group. ${team} has nothing on.`,
      choices: [
        { id: 'give', label: `Give it to ${team}` },
        { id: 'giveAlways', label: `Give it to ${team}, and hand new work to a team with room from now on` },
        ...CHOICES.newWork.filter((c) => c.id !== 'give'),
      ],
    });
  }
  // The fourth team, once the group has run a year.
  if (!s.restructured && s.teamIds.length === 3 && monthOf(s, sim) >= T.restructureMonth) {
    drafts.push({ kind: 'restructuring', title: 'A fourth team', text: 'Your manager wants your group to take on a fourth team. It needs a manager.', choices: CHOICES.restructuring });
  }

  const kept = drafts.slice(0, T.momentCap);
  s.moments = kept.map((d, i) => {
    // Spread through the month's twenty working days, in order.
    const slot = Math.floor((i * 20) / kept.length);
    s.counters.moment += 1;
    return { ...d, id: `sm${s.counters.moment}`, week: Math.floor(slot / 5), day: slot % 5, time: i % 2 ? 'afternoon' : 'morning', status: 'open' };
  });
  s.monthStart = snapshotMonth(s, sim);
  return s;
}

const person = (id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'person', id }, field, amount, cause: { kind: 'action', actionId: ruleId } });
const team = (id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'team', id }, field, amount, cause: { kind: 'action', actionId: ruleId } });
const project = (id: string, field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'project', id }, field, amount, cause: { kind: 'action', actionId: ruleId } });
const player = (field: string, amount: number, ruleId: string): Effect => ({ type: 'value', target: { kind: 'player' }, field, amount, cause: { kind: 'action', actionId: ruleId } });

/** Adds the fourth team to the group, with its first project. */
function addFourthTeam(s: SeniorState, sim: SimState, manager: ReturnType<typeof generateManager>, startsWeek: number | null): SimState {
  const id = nextId(s, 'team', 't', sim.teams);
  const added = addTeam(
    sim,
    {
      team: {
        id,
        name: unusedName(s, NAMES.teams, Object.values(sim.teams).map((t) => t.name)),
        aggregate: { headcount: randomInt(s, T.teamSize[0], T.teamSize[1]), skill: randomInt(s, 35, 70), motivation: randomInt(s, 45, 70), stress: randomInt(s, 25, 50) },
      },
      manager,
    },
    rule('senior.restructuring'),
  );
  if (!added.ok) throw new Error(`restructuring: ${added.error}`);
  s.teamIds.push(id);
  s.joinedManagers.push(manager.id);
  s.leniency[manager.id] = randomInt(s, 0, 2);
  s.habits.oversight[manager.id] = 'coaching';
  if (startsWeek !== null) s.arriving[id] = startsWeek;
  return added.state;
}

/** Applies the player's choice for one of the month's open moments, and closes it. */
// @spec SENIOR-MOMENT-004, SENIOR-MOMENT-005, SENIOR-MOMENT-006, SENIOR-MOMENT-007, SENIOR-MOMENT-008, SENIOR-MOMENT-009, SENIOR-MOMENT-010, SENIOR-PLAN-003
export function chooseSenior(level: SeniorState, sim: SimState, momentId: string, choiceId: string): Result<{ level: SeniorState; sim: SimState; log: ChangeLogEntry[]; reaction: string }> {
  const found = level.moments.find((m) => m.id === momentId);
  if (!found || found.status !== 'open') return { ok: false, error: `moment ${momentId} is not open` };
  if (!found.choices.some((c) => c.id === choiceId)) return { ok: false, error: `moment ${momentId} does not offer ${choiceId}` };
  const s = structuredClone(level);
  const moment = s.moments.find((m) => m.id === momentId)!;
  const effects: Effect[] = [];
  const t = moment.teamId!;
  const m = moment.teamId ? leadOf(s, sim, t) : null;
  const who = moment.teamId ? managerName(s, sim, t) : '';
  let reaction = '';
  let next = sim;

  switch (moment.kind) {
    case 'calibration': {
      const r = acceptRemaining(level, sim, momentId);
      if (!r.ok) return r;
      const done = structuredClone(r.level);
      return { ok: true, level: done, sim: r.sim, log: r.log, reaction: 'You accept every proposal. Your managers are pleased; the ratings say what they say.' };
    }
    case 'finalEvaluation': {
      const id = moment.managerId!;
      s.heldEvaluations = s.heldEvaluations.filter((x) => x !== id);
      if (choiceId === 'letGo') {
        // A third low rating ends the plan: the simulation lets them go, and the team waits for a new manager.
        effects.push({ type: 'rate', target: { kind: 'person', id }, rating: 'below', cause: { kind: 'action', actionId: 'senior.finalEvaluation' } });
        s.letGoManagers.push(id);
        reaction = `You let ${sim.people[id]!.name} go. ${name(sim, t)} is without a manager for now.`;
      } else reaction = `${sim.people[id]!.name} gets one more period. They know what it means.`;
      break;
    }
    case 'replaceManager': {
      const promote = choiceId === 'promoteFromTeam';
      const manager = generateManager(s, sim, promote ? { skill: randomInt(s, ...T.promotedSkill), trust: T.promotedTrust } : { skill: randomInt(s, 40, 59), trust: 50 });
      if (promote) effects.push(team(t, 'skill', -T.promoteSkill, 'senior.replaceManager'), team(t, 'headcount', -1, 'senior.replaceManager'));
      effects.push({ type: 'hire', teamId: t, person: manager, cause: { kind: 'action', actionId: 'senior.replaceManager' } });
      s.leniency[manager.id] = randomInt(s, 0, 2);
      s.habits.oversight[manager.id] = 'coaching';
      s.joinedManagers.push(manager.id);
      if (!promote) s.arriving[t] = sim.week + T.weeksPerMonth;
      reaction = promote ? `${manager.name} steps up from inside ${name(sim, t)}.` : `${manager.name} accepts, and starts next month.`;
      break;
    }
    case 'surfaced':
    case 'escalation': {
      const skill = m ? band(sim.people[m]!.skill) : 0;
      if (choiceId === 'stepIn') {
        effects.push(team(t, 'stress', -T.stepInFix, 'senior.stepIn'), player('stress', T.stepInEnergy, 'senior.stepIn'));
        reaction = `You sort it out yourself. ${who} watches, and next time will come to you again.`;
      } else if (choiceId === 'coach') {
        effects.push(player('stress', T.coachEnergy, 'senior.coach'));
        if (m) effects.push(person(m, 'skill', T.coachGrowth, 'senior.coach'));
        if (skill >= 1) {
          effects.push(team(t, 'stress', -T.coachFix, 'senior.coach'));
          reaction = `You talk it through with ${who}. They take it from there, and it holds.`;
        } else reaction = `You talk it through with ${who}. They learn something, but the problem is still there.`;
      } else if (skill >= 2) {
        effects.push(team(t, 'stress', -T.coachFix, 'senior.letThem'));
        reaction = `${who} handles it without you.`;
      } else reaction = `You leave it with ${who}. Nothing much changes.`;
      break;
    }
    case 'staffing': {
      const giver = moment.otherTeamId!;
      if (choiceId === 'move') {
        effects.push(team(t, 'headcount', 1, 'senior.staffing'), team(giver, 'headcount', -1, 'senior.staffing'), team(t, 'stress', -T.moveRelief, 'senior.staffing'), team(giver, 'stress', T.moveStress, 'senior.staffing'));
        const giverManager = leadOf(s, sim, giver);
        const after = sim.teams[giver]!.aggregate!.stress + T.moveStress;
        if (giverManager && band(after) >= 2) effects.push(person(giverManager, 'trust', -T.moveTrust, 'senior.staffing'));
        reaction = `Someone from ${name(sim, giver)} moves across to ${name(sim, t)}.`;
      } else if (choiceId === 'hire') {
        s.backfills.push({ teamId: t, since: sim.week, months: 0 });
        reaction = `You open a role on ${name(sim, t)}. Help is on the way, not here yet.`;
      } else reaction = `${who} goes back to a team that's still stretched.`;
      break;
    }
    case 'dispute': {
      const other = moment.otherTeamId!;
      const otherManager = leadOf(s, sim, other);
      if (choiceId === 'agree') {
        effects.push(player('stress', T.agreeEnergy, 'senior.dispute'));
        for (const x of [m, otherManager]) if (x) effects.push(person(x, 'skill', T.agreeGrowth, 'senior.dispute'));
        reaction = `It takes an hour, but ${who} and ${managerName(s, sim, other)} leave with a plan they both own.`;
      } else if (choiceId === 'decide') {
        effects.push(project(moment.projectId!, 'risk', -T.decideRelief, 'senior.dispute'));
        if (otherManager) effects.push(person(otherManager, 'trust', -T.decideTrust, 'senior.dispute'));
        reaction = `You call it for ${name(sim, t)}. ${managerName(s, sim, other)} accepts it, without enthusiasm.`;
      } else {
        effects.push(project(moment.projectId!, 'risk', T.letRunRisk, 'senior.dispute'), project(moment.otherProjectId!, 'risk', T.letRunRisk, 'senior.dispute'));
        reaction = 'Both teams wait on each other, and both projects slip.';
      }
      break;
    }
    case 'approval': {
      const apply = () => {
        if (moment.detail === 'promote') effects.push({ type: 'reRate', teamId: t, from: 'exceeds', to: 'outstanding', count: 1, cause: { kind: 'action', actionId: 'senior.approval' } });
        else effects.push(team(t, 'headcount', -1, 'senior.approval'));
      };
      const lenient = m ? (s.leniency[m] ?? 0) > 0 : false;
      if (choiceId === 'approve') {
        apply();
        if (lenient) effects.push(team(t, 'motivation', -T.approvalDip, 'senior.approval'));
        reaction = lenient ? `You sign it. Some of ${name(sim, t)} wonder what it took.` : 'You sign it.';
      } else if (choiceId === 'evidence') {
        if (m) effects.push(person(m, 'trust', -T.evidenceTrust, 'senior.approval'));
        if (!lenient) apply();
        const evidence = moment.detail === 'promote' ? 'a half-year rated exceeds, and a design the team still builds on' : "two low ratings in a row, and a plan that was followed but didn't take";
        reaction = lenient ? `${who} comes back with less than they thought they had: a good month, not a case. It doesn't go ahead.` : `${who} brings the evidence: ${evidence}. It holds up, and you sign it.`;
      } else {
        if (m) effects.push(person(m, 'trust', -T.refuseTrust, 'senior.approval'));
        reaction = `${who} takes the no back to their team.`;
      }
      break;
    }
    case 'newWork': {
      if (choiceId === 'decline') effects.push(player('reputation', -T.declineWork, 'senior.newWork'));
      else {
        const pr = nextId(s, 'project', 'pr', sim.projects);
        effects.push({
          type: 'startProject',
          project: { id: pr, name: unusedName(s, NAMES.projects, Object.values(sim.projects).map((p) => p.name)), teamId: t, scope: randomInt(s, 80, 140), risk: randomInt(s, 10, 40), techDebt: randomInt(s, 10, 40), deadlineWeek: sim.week + randomInt(s, 20, 32) },
          cause: { kind: 'action', actionId: 'senior.newWork' },
        });
        if (choiceId === 'spread') for (const id of s.teamIds) effects.push(team(id, 'stress', T.spreadStress, 'senior.newWork'));
        if (choiceId === 'giveAlways') s.habits.newWork = 'assign';
      }
      reaction = choiceId === 'decline' ? 'Your manager takes it elsewhere, and remembers.' : choiceId === 'spread' ? 'Everyone takes a slice. Everyone is a little busier.' : choiceId === 'giveAlways' ? `${name(sim, t)} takes it on. From now on, new work goes to a team with room unless one is strained.` : `${name(sim, t)} takes it on.`;
      break;
    }
    case 'restructuring': {
      if (choiceId === 'promoteFromTeam') {
        const source = s.teamIds.slice(1).reduce((x, y) => (sim.teams[x]!.aggregate!.skill >= sim.teams[y]!.aggregate!.skill ? x : y), s.teamIds[0]!);
        const r = applyEffects(sim, [team(source, 'skill', -T.restructureSkill, 'senior.restructuring'), team(source, 'headcount', -1, 'senior.restructuring')]);
        if (!r.ok) throw new Error(r.error.message);
        next = addFourthTeam(s, r.state, generateManager(s, r.state, { skill: randomInt(s, 20, 39) }), null);
        reaction = `One of ${name(sim, source)}'s strongest engineers steps up to lead the new team.`;
      } else {
        next = addFourthTeam(s, sim, generateManager(s, sim, { skill: randomInt(s, 40, 59), trust: 50 }), sim.week + T.weeksPerMonth);
        reaction = 'You start looking. The new team waits a month for its manager.';
      }
      s.restructured = true;
      break;
    }
  }

  let log: ChangeLogEntry[] = [];
  if (effects.length) {
    const r = applyEffects(next, effects);
    if (!r.ok) return { ok: false, error: r.error.message };
    next = r.state;
    log = r.log;
  }
  // Heads moved or let go by a choice are not lost to attrition: remember the teams as they are now.
  remember(s, next);
  moment.status = 'answered';
  return { ok: true, level: s, sim: next, log, reaction };
}
