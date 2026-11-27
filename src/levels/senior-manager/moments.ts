import { NAMES, band } from '../line-manager';
import { addTeam, applyEffects, behindScheduleProjects, type ChangeLogEntry, type Effect, type SimState } from '../../sim';
import { generateManager, leadOf, nextId, randomInt, rule, unusedName } from './core';
import { restlessLeaders, stayAnswer, stayDraft } from '../org';
import { acceptRemaining, calibrationEntries, curveOf, overCurveLine, settleCurve } from './calibration';
import { snapshotMonth } from './recap';
import { monthOf, periodEndsThisMonth, remember } from './review';
import { SENIOR_TUNING } from './tuning';
import type { SeniorMoment, SeniorMomentKind, SeniorState } from './types';

const T = SENIOR_TUNING;
type Result<X> = ({ ok: true } & X) | { ok: false; error: string };
type Draft = Omit<SeniorMoment, 'id' | 'week' | 'day' | 'time' | 'status'>;

const CHOICES: Record<Exclude<SeniorMomentKind, 'stay'>, { id: string; label: string }[]> = {
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

/**
 * What a team's engineers raise at a skip-level, from the team as it really is: the most pressing of its troubles, else
 * an everyday friction: one raised before and left unsettled, else the first in turn not settled lately; none when every
 * friction has been settled lately.
 */
// @spec SENIOR-HABIT-008
function surfacedIssue(level: SeniorState, sim: SimState, teamId: string, behind: ReadonlySet<string>): { key: string; text: string } | undefined {
  const slipping = activeProjects(sim, teamId).find((p) => behind.has(p.id));
  if (slipping) return { key: `slipping:${slipping.id}`, text: `${slipping.name} has been slipping for weeks, and nobody upstream seems to know` };
  const a = sim.teams[teamId]!.aggregate!;
  if (band(a.stress) >= T.strainedBand) return { key: 'stress', text: 'on-call and late nights are wearing everyone down' };
  if (band(a.attritionRisk) >= 2) return { key: 'attrition', text: 'a couple of people have started looking around' };
  if (band(a.motivation) <= 1) return { key: 'motivation', text: 'nobody can say any more why the work matters' };
  const record = level.issues[teamId] ?? {};
  const keys = EVERYDAY_ISSUES.map((_, i) => `everyday:${i}`);
  const unsettled = keys.find((k) => record[k]?.settled === false);
  const start = (Math.floor(sim.week / T.weeksPerMonth) + Number(teamId.replace(/\D/g, '') || 0)) % EVERYDAY_ISSUES.length;
  const fresh = keys.map((_, i) => keys[(start + i) % keys.length]!).find((k) => {
    const r = record[k];
    return !(r?.settled && sim.week - r.week < T.issueSettledWeeks);
  });
  const key = unsettled ?? fresh;
  return key === undefined ? undefined : { key, text: EVERYDAY_ISSUES[Number(key.slice('everyday:'.length))]! };
}

/** What giving and declining each kind of new work gains or costs, as its choices say it. */
// @spec SENIOR-MOMENT-015
const OFFER_LABELS = {
  launch: { give: (team: string) => `Give the launch to ${team}: your standing rises, and ${team} carries it`, decline: () => 'Decline the launch: your manager will notice, and your standing drops' },
  handover: { give: (team: string) => `Give the handover to ${team}: they inherit old code and its tech debt`, decline: () => 'Decline the handover: it costs you a little standing' },
  own: { give: (team: string) => `Give ${team} their own project: their motivation lifts`, decline: (team: string) => `Decline it: ${team} hears no to the project they asked for` },
} as const;

/** What a choice about new work did, by the kind of offer. */
function newWorkReaction(offer: 'launch' | 'handover' | 'own', choiceId: string, team: string, manager: string): string {
  if (choiceId === 'decline') {
    if (offer === 'launch') return 'Your manager takes the launch elsewhere, and remembers you passed on it.';
    if (offer === 'handover') return 'The other group finds someone else for its old system, a little put out.';
    return `${manager} takes the no back to ${team}. It lands badly.`;
  }
  if (choiceId === 'spread') return 'Everyone takes a slice. Everyone is a little busier.';
  const taken = { launch: `${team} takes on the launch, and your manager notices.`, handover: `${team} inherits the old system, debt and all.`, own: `${team} gets the project they asked for. ${manager} is delighted.` }[offer];
  return choiceId === 'giveAlways' ? `${taken} From now on, new work goes to a team with room unless one is strained.` : taken;
}

/** How the player answered a problem last time, as the engineers' second telling puts it. */
const LAST_TIME: Record<'coach' | 'stepIn' | 'letThem', (manager: string) => string> = {
  coach: (manager) => `coached ${manager} through it`,
  stepIn: () => 'fixed it yourself',
  letThem: (manager) => `left it with ${manager}`,
};

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
/** Managers on a plan whose third low rating is due. */
function finalEvaluationDrafts(s: SeniorState, sim: SimState): Draft[] {
  const drafts: Draft[] = [];
  for (const managerId of s.heldEvaluations) {
    const teamId = s.teamIds.find((t) => leadOf(s, sim, t) === managerId);
    if (!teamId || sim.people[managerId]?.status !== 'active') continue;
    const who = sim.people[managerId].name;
    drafts.push({ kind: 'finalEvaluation', teamId, managerId, title: `Final evaluation: ${who}`, text: `${who} is on an improvement plan, and ${name(sim, teamId)} is still struggling under them. A third low rating ends the plan. It's your call.`, choices: CHOICES.finalEvaluation });
  }
  return drafts;
}

/** Teams with no manager and none on the way, whether theirs was let go or quit; then calibration, in the last month before a review. */
function leadershipDrafts(s: SeniorState, sim: SimState): Draft[] {
  const drafts: Draft[] = s.teamIds
    .filter((teamId) => !sim.teams[teamId]?.leader && s.arriving[teamId] === undefined)
    .map((teamId) => ({ kind: 'replaceManager', teamId, title: `${name(sim, teamId)} needs a manager`, text: `${name(sim, teamId)} has no manager. Who leads it now?`, choices: CHOICES.replaceManager }));
  if (periodEndsThisMonth(s, sim)) {
    drafts.push({ kind: 'calibration', title: 'Calibration', text: 'Your managers bring their proposed ratings for the period. Set each team’s beside what it delivered.', calibration: calibrationEntries(s, sim), curve: curveOf(s, sim), choices: CHOICES.calibration });
  }
  return drafts;
}

/** A stay conversation with each restless manager, who says what would keep them: the player now knows their want. */
// @spec SENIOR-MOMENT-018
function stayDrafts(s: SeniorState, sim: SimState): Draft[] {
  return restlessLeaders(sim, s.teamIds.map((t) => leadOf(s, sim, t))).map((id) => {
    s.learnedWants[id] = true;
    return { kind: 'stay', teamId: sim.people[id]!.teamId!, managerId: id, ...stayDraft(sim, id) };
  });
}

/** Problems skip-level listening surfaced last month, told again with how the player answered when they come back unsettled. */
function surfacedDrafts(s: SeniorState, sim: SimState, surfaced: ReadonlySet<string>, behind: ReadonlySet<string>): Draft[] {
  const drafts: Draft[] = [];
  for (const t of surfaced) {
    const issue = surfacedIssue(s, sim, t, behind);
    // A healthy team whose frictions are all settled has nothing new to raise.
    if (!issue) continue;
    // @spec SENIOR-HABIT-011
    const before = s.issues[t]?.[issue.key];
    const manager = managerName(s, sim, t);
    const again = before !== undefined && !before.settled;
    drafts.push({
      kind: 'surfaced',
      teamId: t,
      issue: issue.key,
      title: again ? `What ${name(sim, t)} told you again` : `What ${name(sim, t)} told you`,
      text: again
        ? `At last month's skip-level, ${name(sim, t)}'s engineers told you again that ${issue.text.replace(/^that /, '')}. Last time you ${LAST_TIME[before.answer](manager)}, and it didn't hold.`
        : `At last month's skip-level, ${name(sim, t)}'s engineers told you ${issue.text}. ${manager} hasn't mentioned it to you.`,
      choices: CHOICES.surfaced,
    });
  }
  return drafts;
}

/** Why a team's manager escalates: strain, people about to leave, or a project slipping; none when nothing is wrong. */
function escalationReason(sim: SimState, t: string, behind: ReadonlySet<string>): string | undefined {
  const a = sim.teams[t]!.aggregate!;
  if (band(a.stress) >= 3) return 'their team is stretched thin';
  if (band(a.attritionRisk) >= 3) return 'they think people are about to leave';
  return activeProjects(sim, t).some((p) => behind.has(p.id)) ? 'a project is slipping' : undefined;
}

/** Escalations from teams under strain, at risk of losing people, or with a project behind; then a staffing request from the most strained team while another is calm. */
function escalationDrafts(s: SeniorState, sim: SimState, surfaced: ReadonlySet<string>, behind: ReadonlySet<string>): Draft[] {
  const drafts: Draft[] = [];
  for (const t of s.teamIds.filter((x) => !surfaced.has(x))) {
    const why = escalationReason(sim, t, behind);
    if (why) drafts.push({ kind: 'escalation', teamId: t, title: `${managerName(s, sim, t)} needs help`, text: `${managerName(s, sim, t)} comes to you: ${why}.`, choices: CHOICES.escalation });
  }
  const health = (t: string) => sim.teams[t]!.aggregate!;
  const byStress = [...s.teamIds].sort((x, y) => health(y).stress - health(x).stress);
  const strained = byStress.find((t) => band(health(t).stress) >= 3);
  const roomy = [...byStress].reverse().find((t) => band(health(t).stress) <= 1);
  if (strained && roomy && strained !== roomy) {
    drafts.push({ kind: 'staffing', teamId: strained, otherTeamId: roomy, title: 'A staffing request', text: `${managerName(s, sim, strained)} asks for another pair of hands. ${name(sim, roomy)} has some room.`, choices: CHOICES.staffing });
  }
  return drafts;
}

/** A dispute between the two teams whose projects are most at risk, skipping pairs whose dispute is settled. */
// @spec SENIOR-MOMENT-014
function disputeDrafts(s: SeniorState, sim: SimState): Draft[] {
  s.settledDisputes = s.settledDisputes.filter((d) => sim.week - d.week < T.disputeSettledWeeks);
  const settled = (x: string, y: string) => s.settledDisputes.some((d) => d.teams.includes(x) && d.teams.includes(y));
  const risk = (t: string) => activeProjects(sim, t)[0]?.risk;
  const atRisk = s.teamIds.filter((t) => (risk(t) ?? -1) >= T.atRiskProject).sort((x, y) => risk(y)! - risk(x)!);
  const disputing = atRisk.flatMap((x, i) => atRisk.slice(i + 1).map((y) => [x, y] as const)).find(([x, y]) => !settled(x, y));
  if (!disputing) return [];
  const [a, b] = disputing;
  return [
    {
      kind: 'dispute',
      teamId: a,
      otherTeamId: b,
      projectId: activeProjects(sim, a)[0]!.id,
      otherProjectId: activeProjects(sim, b)[0]!.id,
      title: `${name(sim, a)} and ${name(sim, b)} disagree`,
      text: `${managerName(s, sim, a)} and ${managerName(s, sim, b)} both need the same shared work done first, and both projects are at risk.`,
      choices: CHOICES.dispute,
    },
  ];
}

/** Approvals, from the teams' own ratings, at most once every three months a team. */
function approvalDrafts(s: SeniorState, sim: SimState): Draft[] {
  const drafts: Draft[] = [];
  for (const t of s.teamIds) {
    const m = leadOf(s, sim, t);
    const last = s.lastApproval[t];
    if (!m || (last !== undefined && sim.week - last < T.approvalCooldownWeeks)) continue;
    const r = sim.teams[t]!.aggregate!.ratings;
    if (r.exceeds <= 0 && r.below <= 0) continue;
    const detail = r.exceeds > 0 ? ('promote' as const) : ('letGo' as const);
    s.lastApproval[t] = sim.week;
    const what = detail === 'promote' ? 'promote one of their engineers' : 'let one of their engineers go';
    drafts.push({ kind: 'approval', teamId: t, detail, title: `${managerName(s, sim, t)} asks for an approval`, text: `${managerName(s, sim, t)} wants to ${what}, and needs your sign-off.`, choices: CHOICES.approval });
  }
  return drafts;
}

/**
 * New work, while a team has none, of a different kind month to month. Under the habit of giving work to teams with room,
 * only a strained team makes it the player's call; one with room is given it at the month's end (SENIOR-MOMENT-013).
 */
// @spec SENIOR-MOMENT-015
function newWorkDrafts(s: SeniorState, sim: SimState): Draft[] {
  const idle = s.teamIds.find((t) => activeProjects(sim, t).length === 0 && (s.habits.newWork === 'ask' || band(sim.teams[t]!.aggregate!.stress) >= T.strainedBand));
  if (!idle) return [];
  // @spec SENIOR-MOMENT-017
  // Deciding each offer, a team with room gets one a quarter; a strained team's is always the player's call.
  const strained = band(sim.teams[idle]!.aggregate!.stress) >= T.strainedBand;
  if (!strained && sim.week - s.lastNewWorkOffer < T.newWorkOfferWeeks) return [];
  s.lastNewWorkOffer = sim.week;
  const team = name(sim, idle);
  const offer = (['launch', 'handover', 'own'] as const)[monthOf(s, sim) % 3]!;
  const OFFER_TEXT = {
    launch: { title: 'New work for the group: a launch', text: `Your manager has a launch for the group, one the whole company will see. ${team} has nothing on. Taking it lifts your standing; turning it down will be noticed.` },
    handover: { title: 'New work for the group: a handover', text: `Another group wants to hand yours a system it can no longer keep up, old code and heavy tech debt. ${team} has nothing on. Nobody will mind much if you say no.` },
    own: { title: `New work for the group: ${team}'s own project`, text: `${managerName(s, sim, idle)} has been pushing for a project of ${team}'s own, and your manager has finally offered it. ${team} has nothing on. Saying no is saying no to them.` },
  } as const;
  return [
    {
      kind: 'newWork',
      teamId: idle,
      offer,
      title: OFFER_TEXT[offer].title,
      text: OFFER_TEXT[offer].text,
      choices: [
        { id: 'give', label: OFFER_LABELS[offer].give(team) },
        { id: 'giveAlways', label: `Give it to ${team}, and from now on let your manager give new work straight to a team with room (you still decide when that team is strained)` },
        { id: 'decline', label: OFFER_LABELS[offer].decline(team) },
        ...CHOICES.newWork.filter((c) => c.id !== 'give' && c.id !== 'decline'),
      ],
    },
  ];
}

export function beginMonth(level: SeniorState, sim: SimState): SeniorState {
  const s = structuredClone(level);
  for (const [t, week] of Object.entries(s.arriving)) if (week <= sim.week) delete s.arriving[t];
  const behind = new Set(behindScheduleProjects(sim).map((p) => p.id));
  const surfaced = new Set(s.surfaced.map((x) => x.teamId));
  const drafts: Draft[] = [
    ...finalEvaluationDrafts(s, sim),
    ...leadershipDrafts(s, sim),
    ...stayDrafts(s, sim),
    ...surfacedDrafts(s, sim, surfaced, behind),
    ...escalationDrafts(s, sim, surfaced, behind),
    ...disputeDrafts(s, sim),
    ...approvalDrafts(s, sim),
    ...newWorkDrafts(s, sim),
  ];
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

/** What a choice handler works on: the copied level, the simulation, the moment, its team and manager, and the effects it collects. */
interface Pick {
  s: SeniorState;
  sim: SimState;
  moment: SeniorMoment;
  choiceId: string;
  effects: Effect[];
  /** The moment's team. */
  t: string;
  /** The team's manager, if it has one. */
  m: string | null;
  /** How the reaction names that manager. */
  who: string;
}

/** A handler's result: the reaction, and the simulation the effects apply to when the handler already changed it. */
type Picked = { reaction: string; next?: SimState };

function pickFinalEvaluation({ s, sim, moment, choiceId, effects, t }: Pick): Picked {
  const id = moment.managerId!;
  s.heldEvaluations = s.heldEvaluations.filter((x) => x !== id);
  if (choiceId !== 'letGo') return { reaction: `${sim.people[id]!.name} gets one more period. They know what it means.` };
  // A third low rating ends the plan: the simulation lets them go, and the team waits for a new manager.
  effects.push({ type: 'rate', target: { kind: 'person', id }, rating: 'below', cause: { kind: 'action', actionId: 'senior.finalEvaluation' } });
  s.letGoManagers.push(id);
  return { reaction: `You let ${sim.people[id]!.name} go. ${name(sim, t)} is without a manager for now.` };
}

function pickReplaceManager({ s, sim, choiceId, effects, t }: Pick): Picked {
  const promote = choiceId === 'promoteFromTeam';
  const manager = generateManager(s, sim, promote ? { skill: randomInt(s, ...T.promotedSkill), trust: T.promotedTrust } : { skill: randomInt(s, 40, 59), trust: 50 });
  if (promote) effects.push(team(t, 'skill', -T.promoteSkill, 'senior.replaceManager'), team(t, 'headcount', -1, 'senior.replaceManager'));
  effects.push({ type: 'hire', teamId: t, person: manager, cause: { kind: 'action', actionId: 'senior.replaceManager' } });
  s.leniency[manager.id] = randomInt(s, 0, 2);
  s.habits.oversight[manager.id] = 'coaching';
  s.joinedManagers.push(manager.id);
  if (!promote) s.arriving[t] = sim.week + T.weeksPerMonth;
  return { reaction: promote ? `${manager.name} steps up from inside ${name(sim, t)}.` : `${manager.name} accepts, and starts next month.` };
}

/** A surfaced problem is settled when the answer fixed it, and remembered either way. */
// @spec SENIOR-HABIT-011
function rememberIssue({ s, sim, moment, choiceId, t }: Pick, skill: number) {
  if (moment.kind !== 'surfaced' || !moment.issue) return;
  const answer = choiceId as 'coach' | 'stepIn' | 'letThem';
  const settled = answer === 'stepIn' || (answer === 'coach' && skill >= 1) || (answer === 'letThem' && skill >= 2);
  const record = s.issues[t] ?? {};
  record[moment.issue] = { week: sim.week, settled, answer };
  s.issues[t] = record;
}

/** A surfaced problem or an escalation: step in, coach the manager, or leave it with them. */
function pickTrouble(c: Pick): Picked {
  const { sim, choiceId, effects, t, m, who } = c;
  const skill = m ? band(sim.people[m]!.skill) : 0;
  rememberIssue(c, skill);
  if (choiceId === 'stepIn') {
    effects.push(team(t, 'stress', -T.stepInFix, 'senior.stepIn'), player('stress', T.stepInEnergy, 'senior.stepIn'));
    return { reaction: `You sort it out yourself. ${who} watches, and next time will come to you again.` };
  }
  if (choiceId === 'coach') {
    effects.push(player('stress', T.coachEnergy, 'senior.coach'));
    if (m) effects.push(person(m, 'skill', T.coachGrowth, 'senior.coach'));
    if (skill < 1) return { reaction: `You talk it through with ${who}. They learn something, but the problem is still there.` };
    effects.push(team(t, 'stress', -T.coachFix, 'senior.coach'));
    return { reaction: `You talk it through with ${who}. They take it from there, and it holds.` };
  }
  if (skill < 2) return { reaction: `You leave it with ${who}. Nothing much changes.` };
  effects.push(team(t, 'stress', -T.coachFix, 'senior.letThem'));
  return { reaction: `${who} handles it without you.` };
}

function pickStaffing({ s, sim, moment, choiceId, effects, t, who }: Pick): Picked {
  const giver = moment.otherTeamId!;
  if (choiceId === 'hire') {
    s.backfills.push({ teamId: t, since: sim.week, months: 0 });
    return { reaction: `You open a role on ${name(sim, t)}. Help is on the way, not here yet.` };
  }
  if (choiceId !== 'move') return { reaction: `${who} goes back to a team that's still stretched.` };
  effects.push(team(t, 'headcount', 1, 'senior.staffing'), team(giver, 'headcount', -1, 'senior.staffing'), team(t, 'stress', -T.moveRelief, 'senior.staffing'), team(giver, 'stress', T.moveStress, 'senior.staffing'));
  const giverManager = leadOf(s, sim, giver);
  const after = sim.teams[giver]!.aggregate!.stress + T.moveStress;
  if (giverManager && band(after) >= 2) effects.push(person(giverManager, 'trust', -T.moveTrust, 'senior.staffing'));
  return { reaction: `Someone from ${name(sim, giver)} moves across to ${name(sim, t)}.` };
}

function pickDispute({ s, sim, moment, choiceId, effects, t, m, who }: Pick): Picked {
  const other = moment.otherTeamId!;
  const otherManager = leadOf(s, sim, other);
  if (choiceId === 'agree') {
    effects.push(player('stress', T.agreeEnergy, 'senior.dispute'));
    for (const x of [m, otherManager]) if (x) effects.push(person(x, 'skill', T.agreeGrowth, 'senior.dispute'));
    effects.push(project(moment.projectId!, 'risk', -T.agreeRelief, 'senior.dispute'), project(moment.otherProjectId!, 'risk', -T.agreeRelief, 'senior.dispute'));
    s.settledDisputes.push({ teams: [t, other], week: sim.week });
    return { reaction: `It takes an hour, but ${who} and ${managerName(s, sim, other)} leave with a plan they both own, and the shared work is no longer a race.` };
  }
  if (choiceId === 'decide') {
    effects.push(project(moment.projectId!, 'risk', -T.decideRelief, 'senior.dispute'));
    if (otherManager) effects.push(person(otherManager, 'trust', -T.decideTrust, 'senior.dispute'));
    s.settledDisputes.push({ teams: [t, other], week: sim.week });
    return { reaction: `You call it for ${name(sim, t)}. ${managerName(s, sim, other)} accepts it, without enthusiasm.` };
  }
  effects.push(project(moment.projectId!, 'risk', T.letRunRisk, 'senior.dispute'), project(moment.otherProjectId!, 'risk', T.letRunRisk, 'senior.dispute'));
  return { reaction: 'Both teams wait on each other, and both projects slip.' };
}

function pickApproval({ s, sim, moment, choiceId, effects, t, m, who }: Pick): Picked {
  const apply = () => {
    if (moment.detail === 'promote') effects.push({ type: 'reRate', teamId: t, from: 'exceeds', to: 'outstanding', count: 1, cause: { kind: 'action', actionId: 'senior.approval' } });
    else effects.push(team(t, 'headcount', -1, 'senior.approval'));
  };
  const lenient = m ? (s.leniency[m] ?? 0) > 0 : false;
  if (choiceId === 'approve') {
    apply();
    if (lenient) effects.push(team(t, 'motivation', -T.approvalDip, 'senior.approval'));
    return { reaction: lenient ? `You sign it. Some of ${name(sim, t)} wonder what it took.` : 'You sign it.' };
  }
  if (choiceId !== 'evidence') {
    if (m) effects.push(person(m, 'trust', -T.refuseTrust, 'senior.approval'));
    return { reaction: `${who} takes the no back to their team.` };
  }
  if (m) effects.push(person(m, 'trust', -T.evidenceTrust, 'senior.approval'));
  if (lenient) return { reaction: `${who} comes back with less than they thought they had: a good month, not a case. It doesn't go ahead.` };
  apply();
  const evidence = moment.detail === 'promote' ? 'a half-year rated exceeds, and a design the team still builds on' : "two low ratings in a row, and a plan that was followed but didn't take";
  return { reaction: `${who} brings the evidence: ${evidence}. It holds up, and you sign it.` };
}

/** Takes the new work on: starts the project, then the offer's and the choice's side effects. */
function startNewWork({ s, sim, choiceId, effects, t }: Pick, offer: 'launch' | 'handover' | 'own') {
  const pr = nextId(s, 'project', 'pr', sim.projects);
  // Drawn even for a handover, whose debt is fixed, so every offer draws the same numbers in the same order.
  const techDebt = randomInt(s, 10, 40);
  effects.push({
    type: 'startProject',
    project: { id: pr, name: unusedName(s, NAMES.projects, Object.values(sim.projects).map((p) => p.name)), teamId: t, scope: randomInt(s, 80, 140), risk: randomInt(s, 10, 40), techDebt: offer === 'handover' ? T.handoverTechDebt : techDebt, deadlineWeek: sim.week + randomInt(s, 20, 32) },
    cause: { kind: 'action', actionId: 'senior.newWork' },
  });
  if (offer === 'launch') effects.push(player('reputation', T.launchReputation, 'senior.newWork'));
  if (offer === 'own') effects.push(team(t, 'motivation', T.ownProjectMotivation, 'senior.newWork'));
  if (choiceId === 'spread') for (const id of s.teamIds) effects.push(team(id, 'stress', T.spreadStress, 'senior.newWork'));
  if (choiceId === 'giveAlways') s.habits.newWork = 'assign';
}

// @spec SENIOR-MOMENT-016
function pickNewWork(c: Pick): Picked {
  const { sim, moment, choiceId, effects, t, who } = c;
  const offer = moment.offer ?? 'launch';
  if (choiceId === 'decline') {
    const declineCost = { launch: T.launchDecline, handover: T.handoverDecline, own: T.declineWork }[offer];
    effects.push(player('reputation', -declineCost, 'senior.newWork'));
    if (offer === 'own') effects.push(team(t, 'motivation', -T.ownProjectDeclineMotivation, 'senior.newWork'));
  } else startNewWork(c, offer);
  return { reaction: newWorkReaction(offer, choiceId, name(sim, t), who) };
}

function pickRestructuring({ s, sim, choiceId }: Pick): Picked {
  s.restructured = true;
  if (choiceId !== 'promoteFromTeam') {
    const next = addFourthTeam(s, sim, generateManager(s, sim, { skill: randomInt(s, 40, 59), trust: 50 }), sim.week + T.weeksPerMonth);
    return { next, reaction: 'You start looking. The new team waits a month for its manager.' };
  }
  const source = s.teamIds.slice(1).reduce((x, y) => (sim.teams[x]!.aggregate!.skill >= sim.teams[y]!.aggregate!.skill ? x : y), s.teamIds[0]!);
  const r = applyEffects(sim, [team(source, 'skill', -T.restructureSkill, 'senior.restructuring'), team(source, 'headcount', -1, 'senior.restructuring')]);
  if (!r.ok) throw new Error(r.error.message);
  const next = addFourthTeam(s, r.state, generateManager(s, r.state, { skill: randomInt(s, 20, 39) }), null);
  return { next, reaction: `One of ${name(sim, source)}'s strongest engineers steps up to lead the new team.` };
}

/** A stay conversation: keep the manager by giving them what they want, or wish them well. */
// @spec SENIOR-MOMENT-019
function pickStay({ sim, moment, choiceId, effects }: Pick): Picked {
  const r = stayAnswer(sim, moment.managerId!, choiceId, T.stay, 'senior.stay');
  effects.push(...r.effects);
  return { reaction: r.reaction };
}

const PICKS: Record<Exclude<SeniorMomentKind, 'calibration'>, (c: Pick) => Picked> = {
  finalEvaluation: pickFinalEvaluation,
  replaceManager: pickReplaceManager,
  surfaced: pickTrouble,
  escalation: pickTrouble,
  staffing: pickStaffing,
  dispute: pickDispute,
  approval: pickApproval,
  newWork: pickNewWork,
  restructuring: pickRestructuring,
  stay: pickStay,
};

type Chosen = Result<{ level: SeniorState; sim: SimState; log: ChangeLogEntry[]; reaction: string }>;

/** Calibration choices settle through the calibration module: argue or trim one proposal, or accept the rest. */
function chooseCalibration(level: SeniorState, sim: SimState, momentId: string, choiceId: string): Chosen {
  if (choiceId === 'argue' || choiceId === 'trim') return settleCurve(level, sim, momentId, choiceId);
  const r = acceptRemaining(level, sim, momentId);
  if (!r.ok) return r;
  const done = structuredClone(r.level);
  return { ok: true, level: done, sim: r.sim, log: r.log, reaction: `You accept every proposal. Your managers are pleased; the ratings say what they say.${overCurveLine(done, momentId)}` };
}

/** Applies the player's choice for one of the month's open moments, and closes it. */
// @spec SENIOR-MOMENT-004, SENIOR-MOMENT-005, SENIOR-MOMENT-006, SENIOR-MOMENT-007, SENIOR-MOMENT-008, SENIOR-MOMENT-009, SENIOR-MOMENT-010, SENIOR-MOMENT-014, SENIOR-PLAN-003
export function chooseSenior(level: SeniorState, sim: SimState, momentId: string, choiceId: string): Chosen {
  const found = level.moments.find((m) => m.id === momentId);
  if (found?.status !== 'open') return { ok: false, error: `moment ${momentId} is not open` };
  if (!found.choices.some((c) => c.id === choiceId)) return { ok: false, error: `moment ${momentId} does not offer ${choiceId}` };
  if (found.kind === 'calibration') return chooseCalibration(level, sim, momentId, choiceId);
  const s = structuredClone(level);
  const moment = s.moments.find((m) => m.id === momentId)!;
  const effects: Effect[] = [];
  const t = moment.teamId!;
  const m = moment.teamId ? leadOf(s, sim, t) : null;
  const who = moment.teamId ? managerName(s, sim, t) : '';
  const picked = PICKS[moment.kind as Exclude<SeniorMomentKind, 'calibration'>]({ s, sim, moment, choiceId, effects, t, m, who });

  let next = picked.next ?? sim;
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
  return { ok: true, level: s, sim: next, log, reaction: picked.reaction };
}
