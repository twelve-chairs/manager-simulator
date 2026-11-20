import { applyEffects, behindScheduleProjects, overdueProjects, type Effect, type SimState } from '../../sim';
import { action, band, calmRisk, generatePerson, generateProject, isEngineer, peopleNames, personEffect, playerEffect, projectEffect, projectNames, subjectValid, teamEngineers, teamProjects } from './core';
import { reaction } from './reactions';
import { ACCEPT_INTAKE, CHECK_IN, DECLINE_INTAKE, DELEGATE, DO_IT_YOURSELF, INTERVIEW, LINE_TUNING, MOMENT_KINDS, ON_CALL } from './tuning';
import { FELL_SHORT, WORK_LABELS, consequence, workChoices } from './work';
import type { ChoiceResult, LevelMoment, LevelResult, LineState, MomentChoice, WorkItem } from './types';

/** The engineer the night pages habit puts on call this week, if any. */
// @spec LINE-HABIT-011
export function onCallEngineer(level: LineState, sim: SimState): string | undefined {
  const people = teamEngineers(level, sim);
  if (people.length === 0 || level.habits.nightPages === 'me') return undefined;
  if (level.habits.nightPages === 'rotation') return people[sim.week % people.length];
  return [...people].sort((a, b) => sim.people[b]!.skill - sim.people[a]!.skill || (a < b ? -1 : 1))[0];
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
export function addMoments(s: LineState, sim: SimState) {
  const week = sim.week;
  s.moments = s.moments.filter((m) => m.week === week);
  const covered = new Set(s.moments.map((m) => m.ref));
  let room = LINE_TUNING.levelMomentCap - s.moments.length;
  const make = (m: Omit<LevelMoment, 'id' | 'week' | 'status'>) => {
    s.counters.moment += 1;
    s.moments.push({ id: `m${s.counters.moment}`, week, status: 'open', ...m });
    covered.add(m.ref);
    room -= 1;
  };
  const open = (kinds: readonly string[]) => s.items.filter((i) => kinds.includes(i.kind) && !covered.has(i.id) && subjectValid(s, sim, i));

  // Night pages first: they cannot wait for another week.
  const onCall = onCallEngineer(s, sim);
  if (onCall) {
    for (const [i, item] of open(['onCall']).entries()) {
      if (room <= 0) break;
      make({ kind: 'onCall', ref: item.id, personId: onCall, day: i % 5, time: 'night', choices: structuredClone(ON_CALL_CHOICES) });
    }
  }
  // @spec LINE-CHECK-002
  for (const id of dueCheckIns(s, sim).filter((p) => !covered.has(p))) {
    if (room <= 0) break;
    make({ kind: 'checkIn', ref: id, day: 0, time: 'morning', choices: structuredClone(CHECK_IN_CHOICES) });
    s.checkIns[id] = week;
  }
  for (const vacancy of s.vacancies.filter((v) => !covered.has(v.id))) {
    if (room <= 0) break;
    make({ kind: 'interview', ref: vacancy.id, day: 2, time: 'afternoon', choices: interviewChoices(s, sim) });
  }
  // Closest to expiring first; the sort is stable, so equal deadlines keep their arrival order.
  const work = open(MOMENT_KINDS).sort((a, b) => a.lastWeek - b.lastWeek).slice(0, Math.max(0, room));
  work.forEach((item, i) => {
    const day = Math.min(4, Math.floor((i * 5) / work.length));
    const firstThatDay = i === 0 || Math.floor(((i - 1) * 5) / work.length) !== day;
    make({ kind: 'work', ref: item.id, day, time: firstThatDay ? 'morning' : 'afternoon', choices: workChoices(s, sim, item) });
  });
}

/** Removes a resolved item. */
const resolve = (s: LineState, item: WorkItem) => (s.items = s.items.filter((i) => i.id !== item.id));

/** Applies one choice for an open level moment at once and closes the moment. */
// @spec LINE-MOMENT-003, LINE-WORK-003, LINE-WORK-004, LINE-WORK-005
// @spec LINE-INBOX-004, LINE-INBOX-005, LINE-INBOX-006, LINE-INBOX-007, LINE-INBOX-011, LINE-INBOX-012
// @spec LINE-HIRE-003, LINE-HIRE-004, LINE-CHECK-003, LINE-CHECK-004, LINE-CHECK-005, LINE-CHECK-006
export function chooseMoment(level: LineState, sim: SimState, momentId: string, choiceId: string): LevelResult<ChoiceResult> {
  if (typeof momentId !== 'string' || typeof choiceId !== 'string') return { ok: false, error: 'a moment choice names a moment and a choice' };
  const found = level.moments.find((m) => m.id === momentId);
  if (!found) return { ok: false, error: `no moment ${momentId} this week` };
  if (found.status !== 'open') return { ok: false, error: `moment ${momentId} is already closed` };
  if (!found.choices.some((c) => c.id === choiceId)) return { ok: false, error: `moment ${momentId} does not offer ${choiceId}` };

  const s = structuredClone(level);
  const moment = s.moments.find((m) => m.id === momentId)!;
  const effects: Effect[] = [];
  let text: string;
  const engineer = (id: string) => sim.people[id]!;
  const gone = (id: string) => `${sim.people[id]?.name ?? id} is no longer on the team`;

  if (moment.kind === 'checkIn') {
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
    text = reaction(choiceId as 'replan' | 'cutScope' | 'moveDeadline' | 'pushOn', p.name);
  } else if (moment.kind === 'interview') {
    const vacancy = s.vacancies.find((v) => v.id === moment.ref);
    if (!vacancy) return { ok: false, error: `vacancy ${moment.ref} is no longer open` };
    if (choiceId === 'skip') text = reaction('skip', 'interview');
    else if (choiceId === 'self') {
      vacancy.interviews += 1;
      effects.push(playerEffect('stress', LINE_TUNING.work.interviewStress, action(INTERVIEW)));
      text = reaction('interview', 'interview');
    } else {
      const id = choiceId.slice('ask:'.length);
      if (!isEngineer(s, sim, id)) return { ok: false, error: gone(id) };
      vacancy.interviews += 1;
      effects.push(
        personEffect(id, 'stress', LINE_TUNING.work.interviewerStress, action(INTERVIEW)),
        personEffect(id, 'motivation', LINE_TUNING.work.interviewerMotivation, action(INTERVIEW), { serves: ['recognition'], note: 'Interviewed a candidate' }),
      );
      text = reaction('ask', 'interview', engineer(id));
    }
    if (vacancy.interviews >= LINE_TUNING.interviewsPerHire) {
      const hire = generatePerson(s, peopleNames(sim));
      effects.push({ type: 'hire', teamId: s.teamId, person: hire, cause: action(INTERVIEW) });
      s.vacancies = s.vacancies.filter((v) => v !== vacancy);
      text += ` After the last interview you make an offer, and ${hire.name} accepts.`;
    }
  } else {
    const item = s.items.find((i) => i.id === moment.ref);
    if (!item || !subjectValid(s, sim, item)) return { ok: false, error: `the work for moment ${momentId} is no longer there` };
    const thing = WORK_LABELS[item.kind];
    if (moment.kind === 'onCall') {
      const id = moment.personId!;
      if (choiceId !== 'takeOver' && !isEngineer(s, sim, id)) return { ok: false, error: gone(id) };
      const short = isEngineer(s, sim, id) && item.difficulty > engineer(id).skill;
      const cause = action(ON_CALL);
      if (choiceId === 'takeOver') {
        effects.push(playerEffect('stress', item.size, cause));
        text = reaction('takeOver', thing, sim.people[id]);
      } else if (choiceId === 'backUp') {
        effects.push(playerEffect('stress', LINE_TUNING.work.backUpStress, cause), personEffect(id, 'stress', LINE_TUNING.work.delegateStress, cause, { note: 'Handled a night page with you' }));
        if (short) effects.push(personEffect(id, 'skill', LINE_TUNING.work.stretchSkill, cause), ...consequence(item, LINE_TUNING.reducedConsequence, FELL_SHORT));
        text = reaction('backUp', thing, engineer(id));
      } else {
        effects.push(personEffect(id, 'stress', LINE_TUNING.work.delegateStress, cause, { note: 'Handled a night page alone' }));
        if (short) effects.push(...consequence(item, 1, FELL_SHORT));
        text = reaction(short ? 'leaveShort' : 'leave', thing, engineer(id));
      }
      resolve(s, item);
    } else if (choiceId === 'pushBack') {
      text = reaction('pushBack', thing);
    } else if (choiceId === 'self') {
      effects.push(playerEffect('stress', Math.round(item.size * LINE_TUNING.work.selfStressPerSize), action(DO_IT_YOURSELF)));
      text = reaction('self', thing);
      resolve(s, item);
    } else if (choiceId === 'take') {
      const started = generateProject(s, projectNames(sim), s.teamId, sim.week, calmRisk(s));
      effects.push({ type: 'startProject', project: started, cause: action(ACCEPT_INTAKE) }, playerEffect('stress', item.size, action(ACCEPT_INTAKE)));
      text = `${reaction('take', thing)} It’s called ${started.name}.`;
      resolve(s, item);
    } else if (choiceId === 'decline') {
      effects.push(playerEffect('reputation', LINE_TUNING.work.declineIntakeReputation, action(DECLINE_INTAKE)));
      text = reaction('decline', thing);
      resolve(s, item);
    } else {
      const id = choiceId.slice('give:'.length);
      if (!isEngineer(s, sim, id)) return { ok: false, error: gone(id) };
      const stretch = item.difficulty > engineer(id).skill;
      effects.push(personEffect(id, 'stress', LINE_TUNING.work.delegateStress, action(DELEGATE), { serves: ['growth', 'autonomy'], note: `Took on a ${thing}` }));
      if (stretch) effects.push(personEffect(id, 'skill', LINE_TUNING.work.stretchSkill, action(DELEGATE)), ...consequence(item, LINE_TUNING.reducedConsequence, FELL_SHORT));
      text = reaction(stretch ? 'stretch' : 'give', thing, engineer(id));
      resolve(s, item);
    }
  }

  const applied = applyEffects(sim, effects);
  if (!applied.ok) return { ok: false, error: `the simulation rejected the choice: ${applied.error.message}` };
  moment.status = 'answered';
  moment.outcome = text;
  return { ok: true, level: s, sim: applied.state, log: applied.log, reaction: text };
}
