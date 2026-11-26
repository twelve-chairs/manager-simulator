import { callBack } from './callbacks';
import { applyEffects, behindScheduleProjects, overdueProjects, type Effect, type Rating, type SimState } from '../../sim';
import { RATING_WORDS, action, band, calmRisk, generatePerson, generateProject, isEngineer, peopleNames, personEffect, playerEffect, projectEffect, projectNames, subjectValid, teamEngineers, teamProjects } from './core';
import { reaction } from './reactions';
import { ACCEPT_INTAKE, CHECK_IN, DECLINE_INTAKE, DELEGATE, DO_IT_YOURSELF, FINAL_EVALUATION, INTERVIEW, LINE_TUNING, MOMENT_KINDS, ON_CALL, PAY_DOWN, ROLL_BACK, SMALLER_CHANGE } from './tuning';
import { FELL_SHORT, WORK_LABELS, consequence, tallyProgress, workChoices } from './work';
import type { ChoiceResult, LevelMoment, LevelResult, LineState, MomentChoice, WorkItem } from './types';

/** The engineer the night pages habit puts on call this week, if any. */
// @spec LINE-HABIT-011
export function onCallEngineer(level: LineState, sim: SimState): string | undefined {
  const people = teamEngineers(level, sim);
  if (people.length === 0 || level.habits.nightPages === 'me') return undefined;
  if (level.habits.nightPages === 'rotation' || level.habits.nightPages === 'backup') return people[sim.week % people.length];
  return [...people].sort((a, b) => sim.people[b]!.skill - sim.people[a]!.skill || (a < b ? -1 : 1))[0];
}

/** Under a backup, the most skilled engineer other than the one on call, if any. */
// @spec LINE-HABIT-011
export function backupEngineer(level: LineState, sim: SimState, onCall: string): string | undefined {
  if (level.habits.nightPages !== 'backup') return undefined;
  return teamEngineers(level, sim)
    .filter((id) => id !== onCall)
    .sort((a, b) => sim.people[b]!.skill - sim.people[a]!.skill || (a < b ? -1 : 1))[0];
}

const CHECK_IN_CHOICES: MomentChoice[] = [
  { id: 'replan', label: 'Re-plan it with the team' },
  { id: 'cutScope', label: 'Cut scope' },
  { id: 'moveDeadline', label: 'Move the deadline' },
  { id: 'pushOn', label: 'Push on' },
];

/** Projects due a check-in this week: active, in trouble or at high risk, and past the cooldown since their last one. */
// @spec LINE-CHECK-001
function dueCheckIns(level: LineState, sim: SimState): string[] {
  const troubled = new Set([...overdueProjects(sim), ...behindScheduleProjects(sim)].map((p) => p.id));
  const c = LINE_TUNING.checkIn;
  return teamProjects(level, sim).filter((id) => {
    const last = level.checkIns[id];
    if (last !== undefined && sim.week - last < c.cooldownWeeks) return false;
    return troubled.has(id) || band(sim.projects[id]!.risk) >= c.band;
  });
}

const ON_CALL_CHOICES: MomentChoice[] = [
  { id: 'rollBack', label: 'Roll the change back' },
  { id: 'backUp', label: 'Back them up' },
  { id: 'takeOver', label: 'Take over' },
  { id: 'leave', label: 'Leave it to them' },
];

function interviewChoices(level: LineState, sim: SimState): MomentChoice[] {
  return [
    { id: 'self', label: 'Interview yourself' },
    ...teamEngineers(level, sim).map((id) => ({ id: `ask:${id}`, label: `Ask ${sim.people[id]!.name}` })),
    { id: 'skip', label: 'Skip this week' },
  ];
}

/** Adds this week's level moments, up to the cap, for work, vacancies and night pages that have none yet this week. Mutates `s`. */
// @spec LINE-MOMENT-001, LINE-MOMENT-002, LINE-WEEK-002, LINE-WORK-001, LINE-HABIT-010
/** Ratings that count toward an improvement plan. */
export const LOW: readonly Rating[] = ['below', 'partial'];

const STRAINED = LINE_TUNING.strainedBand;

/** Design reviews piling up: each choice applies to every review in turn. */
const PILING_CHOICES: MomentChoice[] = [
  { id: 'self', label: 'Do them all yourself' },
  { id: 'spread', label: 'Hand each to whoever can handle it, stretched as they are' },
  { id: 'pushBack', label: 'Push them all back' },
];

/** Design reviews piling up: the same choice in each review's own moment, in turn. */
// @spec LINE-WORK-017
function choosePiling(level: LineState, sim: SimState, momentId: string, choiceId: string): LevelResult<ChoiceResult> {
  const batch = level.moments.find((m) => m.id === momentId)!;
  let l = structuredClone(level);
  let s = sim;
  const log: ChoiceResult['log'] = [];
  const said: string[] = [];
  for (const ref of batch.refs!) {
    const item = l.items.find((i) => i.id === ref);
    if (!item) continue;
    const choices = workChoices(l, s, item);
    // The first give: offered is the least stressed engineer whose skill reaches the review.
    const safe = choices.find((c) => c.id.startsWith('give:') && band(s.people[c.id.slice('give:'.length)]!.skill) >= band(item.difficulty));
    const choice = choiceId === 'spread' ? (safe?.id ?? 'pushBack') : choiceId;
    const one: LevelMoment = { id: `${momentId}:${ref}`, kind: 'work', ref, week: batch.week, day: batch.day, time: batch.time, choices, status: 'open' };
    l.moments.push(one);
    const r = chooseMoment(l, s, one.id, choice);
    if (!r.ok) return r;
    l = r.level;
    s = r.sim;
    log.push(...r.log);
    said.push(r.reaction);
  }
  l.moments = l.moments.filter((m) => !m.id.startsWith(`${momentId}:`));
  const done = l.moments.find((m) => m.id === momentId)!;
  done.status = 'answered';
  done.outcome = said.join(' ');
  return { ok: true, level: l, sim: s, log, reaction: said.join(' ') };
}

/** Keeping someone for another quarter: no rating, and a note that says so. */
export const oneMoreQuarter = (id: string): Effect => personEffect(id, 'motivation', 0, action(FINAL_EVALUATION), { note: 'Given one more quarter' });

/** A final evaluation's choices: rate them on what they delivered and let them go, or one more quarter. */
function finalEvaluationChoices(sim: SimState, id: string, rating: Rating): MomentChoice[] {
  const name = sim.people[id]!.name;
  return [
    { id: 'letGo', label: `Rate ${name} ${RATING_WORDS[rating]} on what they delivered, and let them go` },
    { id: 'oneMoreQuarter', label: `Give ${name} one more quarter` },
  ];
}

/** The week's moments as they are made: what is covered already, the room left under the cap, and a maker. */
interface WeekBuilder {
  s: LineState;
  sim: SimState;
  week: number;
  covered: Set<string>;
  room: number;
  make(m: Omit<LevelMoment, 'id' | 'week' | 'status'>): void;
  /** Open items of these kinds with no moment yet whose subject is still there. */
  open(kinds: readonly string[]): WorkItem[];
}

function weekBuilder(s: LineState, sim: SimState): WeekBuilder {
  const week = sim.week;
  s.moments = s.moments.filter((m) => m.week === week);
  const b: WeekBuilder = {
    s,
    sim,
    week,
    covered: new Set(s.moments.map((m) => m.ref)),
    room: LINE_TUNING.levelMomentCap - s.moments.length,
    make(m) {
      s.counters.moment += 1;
      s.moments.push({ id: `m${s.counters.moment}`, week, status: 'open', ...m });
      b.covered.add(m.ref);
      b.room -= 1;
    },
    open: (kinds) => s.items.filter((i) => kinds.includes(i.kind) && !b.covered.has(i.id) && subjectValid(s, sim, i)),
  };
  return b;
}

/** Final evaluations first: someone's job depends on them. */
// @spec LINE-EVAL-003
function addFinalEvaluations(b: WeekBuilder) {
  const { s, sim } = b;
  for (const held of s.heldEvaluations.filter((h) => !b.covered.has(h.personId) && sim.people[h.personId]?.status === 'active')) {
    if (b.room <= 0) break;
    b.make({ kind: 'finalEvaluation', ref: held.personId, day: 0, time: 'afternoon', choices: finalEvaluationChoices(sim, held.personId, held.rating) });
  }
}

/** Night pages next, as they cannot wait: the engineer on call, with a backup if any, handles what they can reach with no moment. */
// @spec LINE-HABIT-011
function addNightPages(b: WeekBuilder) {
  const { s, sim, week } = b;
  const onCall = onCallEngineer(s, sim);
  if (!onCall) return;
  s.routinePages = Object.fromEntries(Object.entries(s.routinePages).filter(([id]) => s.items.some((i) => i.id === id && i.lastWeek >= week)));
  s.backedPages = Object.fromEntries(Object.entries(s.backedPages).filter(([id]) => Object.hasOwn(s.routinePages, id)));
  const pages = b.open(['onCall']).filter((item) => !Object.hasOwn(s.routinePages, item.id));
  const backup = backupEngineer(s, sim, onCall);
  for (const item of pages) {
    const alone = band(sim.people[onCall]!.skill) >= band(item.difficulty);
    // A page beyond the engineer on call that the backup can reach is the two of theirs.
    const backed = !alone && backup !== undefined && band(sim.people[backup]!.skill) >= band(item.difficulty);
    if (!alone && !backed) continue;
    s.routinePages[item.id] = onCall;
    if (backed) s.backedPages[item.id] = backup;
    b.covered.add(item.id);
  }
  for (const [i, item] of pages.filter((p) => !b.covered.has(p.id)).entries()) {
    if (b.room <= 0) break;
    b.make({ kind: 'onCall', ref: item.id, personId: onCall, day: i % 5, time: 'night', choices: structuredClone(ON_CALL_CHOICES) });
  }
}

/** Check-ins for projects due one, then interviews for open vacancies. */
// @spec LINE-CHECK-002
function addCheckInsAndInterviews(b: WeekBuilder) {
  const { s, sim, week } = b;
  for (const id of dueCheckIns(s, sim).filter((p) => !b.covered.has(p))) {
    if (b.room <= 0) break;
    b.make({ kind: 'checkIn', ref: id, day: 0, time: 'morning', choices: structuredClone(CHECK_IN_CHOICES) });
    s.checkIns[id] = week;
  }
  for (const vacancy of s.vacancies.filter((v) => !b.covered.has(v.id))) {
    if (b.room <= 0) break;
    b.make({ kind: 'interview', ref: vacancy.id, day: 2, time: 'afternoon', choices: interviewChoices(s, sim) });
  }
}

/** Whether a design review's project has no debt worth paying down, so the team can take it as routine. */
const routineReview = (sim: SimState, item: WorkItem) => {
  const p = item.subject.kind === 'project' ? sim.projects[item.subject.id] : undefined;
  return p !== undefined && band(p.techDebt) <= LINE_TUNING.payDown.band;
};

/**
 * Work someone can handle unstrained is the team's, with no moment: a customer request, or a design review on a project
 * with no debt worth paying down.
 */
// @spec LINE-WORK-013, LINE-WORK-015
function assignRoutineWork(b: WeekBuilder) {
  const { s, sim } = b;
  s.routineWork = Object.fromEntries(Object.entries(s.routineWork).filter(([id, who]) => s.items.some((i) => i.id === id) && isEngineer(s, sim, who)));
  for (const item of b.open(['designReview', 'customerRequest']).filter((i) => !Object.hasOwn(s.routineWork, i.id))) {
    if (item.kind === 'designReview' && !routineReview(sim, item)) continue;
    const margin = item.kind === 'customerRequest' ? 1 : 0;
    const able = teamEngineers(s, sim)
      .filter((id) => band(sim.people[id]!.skill) >= band(item.difficulty) + margin && band(sim.people[id]!.stress) < STRAINED)
      .sort((x, y) => sim.people[x]!.stress - sim.people[y]!.stress || (x < y ? -1 : 1));
    if (able[0]) s.routineWork[item.id] = able[0];
  }
  for (const id of Object.keys(s.routineWork)) b.covered.add(id);
}

/** Routine reviews left only because everyone who could take them is strained are one problem, and one moment. */
// @spec LINE-WORK-017
function addPilingReviews(b: WeekBuilder) {
  const { s, sim } = b;
  const piling = b.open(['designReview']).filter((item) => {
    if (!routineReview(sim, item)) return false;
    const able = teamEngineers(s, sim).filter((id) => band(sim.people[id]!.skill) >= band(item.difficulty));
    return able.length > 0 && able.every((id) => band(sim.people[id]!.stress) >= STRAINED);
  });
  if (piling.length < 2 || b.room <= 0) return;
  b.make({ kind: 'work', ref: piling[0]!.id, refs: piling.map((i) => i.id), day: 0, time: 'morning', choices: structuredClone(PILING_CHOICES) });
  for (const item of piling) b.covered.add(item.id);
}

/** The rest of the work, closest to expiring first, spread through the week; the sort is stable, so equal deadlines keep their arrival order. */
function addWork(b: WeekBuilder) {
  const work = b.open(MOMENT_KINDS).sort((x, y) => x.lastWeek - y.lastWeek).slice(0, Math.max(0, b.room));
  work.forEach((item, i) => {
    const day = Math.min(4, Math.floor((i * 5) / work.length));
    const firstThatDay = i === 0 || Math.floor(((i - 1) * 5) / work.length) !== day;
    b.make({ kind: 'work', ref: item.id, day, time: firstThatDay ? 'morning' : 'afternoon', choices: workChoices(b.s, b.sim, item) });
  });
}

export function addMoments(s: LineState, sim: SimState) {
  const b = weekBuilder(s, sim);
  addFinalEvaluations(b);
  addNightPages(b);
  addCheckInsAndInterviews(b);
  assignRoutineWork(b);
  addPilingReviews(b);
  addWork(b);
}

/** Removes a resolved item. */
const resolve = (s: LineState, item: WorkItem) => (s.items = s.items.filter((i) => i.id !== item.id));

/** What a choice handler works on: the copied level, the simulation, the moment and the effects it collects. */
interface Pick {
  s: LineState;
  sim: SimState;
  moment: LevelMoment;
  choiceId: string;
  effects: Effect[];
}

/** A handler's result: the reaction text and the engineer it involved, or why the choice no longer applies. */
type Picked = { ok: false; error: string } | { ok: true; text: string; involved?: string };

const gone = (sim: SimState, id: string): Picked => ({ ok: false, error: `${sim.people[id]?.name ?? id} is no longer on the team` });
const said = (text: string, involved?: string): Picked => ({ ok: true, text, involved });

function pickFinalEvaluation({ s, sim, moment, choiceId, effects }: Pick): Picked {
  const id = moment.ref;
  const held = s.heldEvaluations.find((h) => h.personId === id);
  if (!held || !isEngineer(s, sim, id)) return gone(sim, id);
  let text: string;
  if (choiceId === 'letGo') {
    // The third low rating in a row: the simulation ends their plan and they leave.
    effects.push({ type: 'rate', target: { kind: 'person', id }, rating: held.rating, cause: action(FINAL_EVALUATION), historyNote: `Rated ${RATING_WORDS[held.rating]} on what they delivered` });
    text = `You rate ${sim.people[id]!.name} ${RATING_WORDS[held.rating]} and let them go. It's a short, hard conversation.`;
  } else {
    effects.push(oneMoreQuarter(id));
    text = `You give ${sim.people[id]!.name} one more quarter. They know what it means.`;
  }
  s.heldEvaluations = s.heldEvaluations.filter((h) => h.personId !== id);
  return said(text);
}

function pickCheckIn({ s, sim, moment, choiceId, effects }: Pick): Picked {
  const p = sim.projects[moment.ref];
  if (!p || !teamProjects(s, sim).includes(moment.ref)) return { ok: false, error: `project ${moment.ref} is no longer active` };
  const c = LINE_TUNING.checkIn;
  const cause = action(CHECK_IN);
  if (choiceId === 'replan') effects.push(playerEffect('stress', c.replanStress, cause), projectEffect(p.id, 'risk', -c.replanRisk, cause));
  else if (choiceId === 'cutScope') {
    // A share of what is left, at least 1, and never below what is already done; scope is kept in whole points.
    const left = Math.floor(p.scope - p.progress);
    const cut = Math.min(Math.max(1, Math.round(c.scopeShare * left)), left);
    if (cut > 0) effects.push(projectEffect(p.id, 'scope', -cut, cause));
    effects.push(playerEffect('reputation', c.scopeReputation, cause));
  } else if (choiceId === 'moveDeadline') effects.push(projectEffect(p.id, 'deadlineWeek', c.deadlineWeeks, cause), playerEffect('reputation', c.deadlineReputation, cause));
  return said(reaction(choiceId as 'replan' | 'cutScope' | 'moveDeadline' | 'pushOn', p.name));
}

/** Who sits in on the interview: nobody, the player, or an engineer the player asks. */
function interviewer({ s, sim, choiceId, effects }: Pick, vacancy: { interviews: number }): Picked {
  if (choiceId === 'skip') return said(reaction('skip', 'interview'));
  if (choiceId === 'self') {
    vacancy.interviews += 1;
    effects.push(playerEffect('stress', LINE_TUNING.work.interviewStress, action(INTERVIEW)));
    return said(reaction('interview', 'interview'));
  }
  const id = choiceId.slice('ask:'.length);
  if (!isEngineer(s, sim, id)) return gone(sim, id);
  vacancy.interviews += 1;
  effects.push(
    personEffect(id, 'stress', LINE_TUNING.work.interviewerStress, action(INTERVIEW)),
    personEffect(id, 'motivation', LINE_TUNING.work.interviewerMotivation, action(INTERVIEW), { serves: ['recognition'], note: 'Interviewed a candidate' }),
  );
  return said(reaction('ask', 'interview', sim.people[id]), id);
}

function pickInterview(c: Pick): Picked {
  const { s, sim, moment, effects } = c;
  const vacancy = s.vacancies.find((v) => v.id === moment.ref);
  if (!vacancy) return { ok: false, error: `vacancy ${moment.ref} is no longer open` };
  const picked = interviewer(c, vacancy);
  if (!picked.ok || vacancy.interviews < LINE_TUNING.interviewsPerHire) return picked;
  const hire = generatePerson(s, peopleNames(sim));
  effects.push({ type: 'hire', teamId: s.teamId, person: hire, cause: action(INTERVIEW) });
  s.vacancies = s.vacancies.filter((v) => v !== vacancy);
  return said(`${picked.text} After the last interview you make an offer, and ${hire.name} accepts.`, picked.involved);
}

/** Rolls the change back: the project slips by at most what is done, and the on-call engineer, if still here, feels it. */
function rollBack(sim: SimState, effects: Effect[], item: WorkItem, thing: string, onCall: string | undefined): Picked {
  const R = LINE_TUNING.rollBack;
  const p = item.subject.kind === 'project' ? sim.projects[item.subject.id] : undefined;
  const slip = p ? Math.min(R.progress, Math.floor(p.progress)) : 0;
  if (p && slip > 0) effects.push(projectEffect(p.id, 'progress', -slip, action(ROLL_BACK)));
  if (onCall) effects.push(personEffect(onCall, 'stress', R.stress, action(ROLL_BACK)));
  return said(reaction('rollBack', p?.name ?? thing));
}

/** A night page: roll back, take it over, back the on-call engineer up, or leave it with them. */
function pickOnCall({ s, sim, moment, choiceId, effects }: Pick, item: WorkItem, thing: string): Picked {
  const id = moment.personId!;
  const present = isEngineer(s, sim, id);
  if (choiceId !== 'takeOver' && !present) return gone(sim, id);
  const short = present && item.difficulty > sim.people[id]!.skill;
  const cause = action(ON_CALL);
  const W = LINE_TUNING.work;
  if (choiceId === 'rollBack') return rollBack(sim, effects, item, thing, present ? id : undefined);
  if (choiceId === 'takeOver') {
    effects.push(playerEffect('stress', item.size, cause));
    return said(reaction('takeOver', thing, sim.people[id]));
  }
  if (choiceId === 'backUp') {
    effects.push(playerEffect('stress', W.backUpStress, cause), personEffect(id, 'stress', W.delegateStress, cause, { note: 'Handled a night page with you' }));
    if (short) effects.push(personEffect(id, 'skill', W.stretchSkill, cause), ...consequence(item, LINE_TUNING.reducedConsequence, FELL_SHORT));
    return said(reaction('backUp', thing, sim.people[id]), id);
  }
  effects.push(personEffect(id, 'stress', W.delegateStress, cause, { note: 'Handled a night page alone' }));
  if (short) effects.push(...consequence(item, 1, FELL_SHORT));
  return said(reaction(short ? 'leaveShort' : 'leave', thing, sim.people[id]), id);
}

type WorkPick = (c: Pick, item: WorkItem, thing: string) => Picked;

const pickSelf: WorkPick = ({ effects }, item, thing) => {
  effects.push(playerEffect('stress', Math.round(item.size * LINE_TUNING.work.selfStressPerSize), action(DO_IT_YOURSELF)));
  return said(reaction('self', thing));
};

const pickSmaller: WorkPick = ({ effects }, _item, thing) => {
  effects.push(playerEffect('reputation', -LINE_TUNING.smallerChange.reputation, action(SMALLER_CHANGE)));
  return said(reaction('smaller', thing));
};

/** Hands the work to an engineer, a stretch when it is harder than their skill. */
const pickGive: WorkPick = ({ s, sim, choiceId, effects }, item, thing) => {
  const id = choiceId.slice('give:'.length);
  if (!isEngineer(s, sim, id)) return gone(sim, id);
  const stretch = item.difficulty > sim.people[id]!.skill;
  effects.push(personEffect(id, 'stress', LINE_TUNING.work.delegateStress, action(DELEGATE), { serves: ['growth', 'autonomy'], note: `Took on a ${thing}` }));
  if (stretch) effects.push(personEffect(id, 'skill', LINE_TUNING.work.stretchSkill, action(DELEGATE)), ...consequence(item, LINE_TUNING.reducedConsequence, FELL_SHORT));
  return said(reaction(stretch ? 'stretch' : 'give', thing, sim.people[id]), id);
};

/** Pays down tech debt on a project; on other work the choice id is read as a hand-off, as before. */
const pickPayDown: WorkPick = (c, item, thing) => {
  if (item.subject.kind !== 'project') return pickGive(c, item, thing);
  const P = LINE_TUNING.payDown;
  const p = c.sim.projects[item.subject.id]!;
  // The slip is at most what is done, so progress never goes below zero.
  const slip = Math.min(P.progress, Math.floor(p.progress));
  if (slip > 0) c.effects.push(projectEffect(p.id, 'progress', -slip, action(PAY_DOWN)));
  c.effects.push(projectEffect(p.id, 'techDebt', -P.techDebt, action(PAY_DOWN)), playerEffect('stress', P.stress, action(PAY_DOWN)));
  return said(reaction('payDown', p.name));
};

// @spec LINE-INBOX-016
const pickTake: WorkPick = ({ s, sim, effects }, item, thing) => {
  const W = LINE_TUNING.work;
  const offer = item.offer ?? { kind: 'launch' };
  const started = generateProject(s, projectNames(sim), s.teamId, sim.week, calmRisk(s));
  if (offer.kind === 'handover') started.techDebt = W.handoverTechDebt;
  effects.push({ type: 'startProject', project: started, cause: action(ACCEPT_INTAKE) }, playerEffect('stress', item.size, action(ACCEPT_INTAKE)));
  if (offer.kind === 'launch') effects.push(playerEffect('reputation', W.launchReputation, action(ACCEPT_INTAKE)));
  if (offer.kind === 'rewrite' && offer.engineerId && isEngineer(s, sim, offer.engineerId)) {
    effects.push(personEffect(offer.engineerId, 'motivation', W.rewriteMotivation, action(ACCEPT_INTAKE), { serves: ['growth', 'autonomy'], note: 'Got the rewrite they wanted' }));
  }
  // Offered only while someone is strained, so the whole team feels it.
  for (const id of teamEngineers(s, sim)) effects.push(personEffect(id, 'stress', W.intakeTeamStress, action(ACCEPT_INTAKE), { note: 'Took on new work while stretched' }));
  return said(`${reaction('take', thing)} It’s called ${started.name}.`);
};

// @spec LINE-INBOX-017
const pickDecline: WorkPick = ({ s, sim, effects }, item, thing) => {
  const W = LINE_TUNING.work;
  const offer = item.offer ?? { kind: 'launch' };
  const lost = { launch: W.launchDeclineReputation, handover: W.handoverDeclineReputation, rewrite: W.declineIntakeReputation }[offer.kind];
  effects.push(playerEffect('reputation', lost, action(DECLINE_INTAKE)));
  if (offer.kind === 'rewrite' && offer.engineerId && isEngineer(s, sim, offer.engineerId)) {
    effects.push(personEffect(offer.engineerId, 'motivation', -W.rewriteDeclineMotivation, action(DECLINE_INTAKE), { note: 'Saw the rewrite they wanted turned down' }));
  }
  s.intakeDeclinedWeek = sim.week;
  return said(reaction('decline', thing));
};

/** Choices on a work item, by choice id; any other id hands the work to an engineer. Every one but pushing back resolves the item. */
const WORK_PICKS: Record<string, WorkPick> = { self: pickSelf, payDown: pickPayDown, smaller: pickSmaller, take: pickTake, decline: pickDecline };

function pickWork(c: Pick, momentId: string): Picked {
  const { s, sim, moment, choiceId } = c;
  const item = s.items.find((i) => i.id === moment.ref);
  if (!item || !subjectValid(s, sim, item)) return { ok: false, error: `the work for moment ${momentId} is no longer there` };
  const thing = WORK_LABELS[item.kind];
  if (moment.kind !== 'onCall' && choiceId === 'pushBack') return said(reaction('pushBack', thing));
  const pick = moment.kind === 'onCall' ? pickOnCall : (WORK_PICKS[choiceId] ?? pickGive);
  const picked = pick(c, item, thing);
  if (picked.ok) resolve(s, item);
  return picked;
}

const PICKS: Partial<Record<LevelMoment['kind'], (c: Pick) => Picked>> = { finalEvaluation: pickFinalEvaluation, checkIn: pickCheckIn, interview: pickInterview };

/** Applies one choice for an open level moment at once and closes the moment. */
// @spec LINE-MOMENT-003, LINE-WORK-003, LINE-WORK-004, LINE-WORK-005, LINE-WORK-009, LINE-WORK-011, LINE-WORK-012, LINE-WORK-016
// @spec LINE-INBOX-004, LINE-INBOX-005, LINE-INBOX-006, LINE-INBOX-007, LINE-INBOX-011, LINE-INBOX-012
// @spec LINE-HIRE-003, LINE-HIRE-004, LINE-CHECK-003, LINE-CHECK-004, LINE-CHECK-005, LINE-CHECK-006
export function chooseMoment(level: LineState, sim: SimState, momentId: string, choiceId: string): LevelResult<ChoiceResult> {
  if (typeof momentId !== 'string' || typeof choiceId !== 'string') return { ok: false, error: 'a moment choice names a moment and a choice' };
  const found = level.moments.find((m) => m.id === momentId);
  if (!found) return { ok: false, error: `no moment ${momentId} this week` };
  if (found.status !== 'open') return { ok: false, error: `moment ${momentId} is already closed` };
  if (!found.choices.some((c) => c.id === choiceId)) return { ok: false, error: `moment ${momentId} does not offer ${choiceId}` };

  if (found.refs) return choosePiling(level, sim, momentId, choiceId);
  const s = structuredClone(level);
  const moment = s.moments.find((m) => m.id === momentId)!;
  const effects: Effect[] = [];
  const c: Pick = { s, sim, moment, choiceId, effects };
  const handler = PICKS[moment.kind];
  const picked = handler ? handler(c) : pickWork(c, momentId);
  if (!picked.ok) return picked;

  const applied = applyEffects(sim, effects);
  if (!applied.ok) return { ok: false, error: `the simulation rejected the choice: ${applied.error.message}` };
  tallyProgress(s, applied.log);
  // The engineer the choice involves can bring up a memory in its reaction.
  // @spec LINE-WORK-006
  const recalled = picked.involved !== undefined ? callBack(s, sim, picked.involved, moment.kind === 'onCall') : null;
  const text = recalled ? `${picked.text} ${recalled}` : picked.text;
  // A choice that costs the player energy ends the week's chance of being quiet.
  // @spec LINE-END-013
  if (effects.some((e) => e.type === 'value' && e.target.kind === 'player' && e.field === 'stress' && e.amount > 0)) s.energySpent += 1;
  moment.status = 'answered';
  moment.outcome = text;
  return { ok: true, level: s, sim: applied.state, log: applied.log, reaction: text };
}
