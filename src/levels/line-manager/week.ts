import { STARTING_ORGANIZATION_RULE, applyEffects, correspondingRating, planOf, type Effect, type HistoryEntry, type SimState } from '../../sim';
import { RATING_WORDS, action, band, calmRisk, generateProject, isEngineer, nameOf, personEffect, playerEffect, projectNames, reconcileVacancies, rule, subjectValid, teamEngineers, teamProjects } from './core';
import { setGoals, goalStatus } from './goals';
import { fallBack, habitEffects } from './habits';
import { LOW, addMoments, oneMoreQuarter } from './moments';
import { DELEGATE, HABIT_CAUSE, LINE_TUNING, ROUTINE_KINDS } from './tuning';
import { EXPIRED, arriveWork, consequence, intakeWaiting, tallyProgress, teamStretched } from './work';
import type { LevelResult, LineState, Recap, WeekResult } from './types';

/** Starts a week: work arrives, the period's goals are set if it is new, and the week's moments are made. */
// @spec LINE-MOMENT-001, LINE-GOAL-001, LINE-HIRE-002, LINE-HABIT-004
export function beginWeek(level: LineState, sim: SimState): LineState {
  const s = structuredClone(level);
  reconcileVacancies(s, sim);
  // Someone who left between weeks stops being named at once, so the habits shown are the habits that apply.
  s.habitNotes = fallBack(s, sim);
  arriveWork(s, sim);
  setGoals(s, sim);
  s.weekStart = {
    week: sim.week,
    people: Object.fromEntries(teamEngineers(s, sim).map((id) => [id, { motivation: sim.people[id]!.motivation, stress: sim.people[id]!.stress, skill: sim.people[id]!.skill }])),
    projects: Object.fromEntries(teamProjects(s, sim).map((id) => [id, sim.projects[id]!.progress])),
    causes: {},
  };
  addMoments(s, sim);
  return s;
}

/** Makes the week's moments for the work, vacancies and pages already open, without new arrivals. */
export function openMoments(level: LineState, sim: SimState): LineState {
  const s = structuredClone(level);
  addMoments(s, sim);
  return s;
}

const EVALUATION = 'line-manager.evaluation';
const ASSIGNED = 'line-manager.assigned-project';
const REST = 'line-manager.rest';


/** Each distinct note once, in order, with how many times it recurred when more than once. */
function counted(notes: string[]): string[] {
  const times = new Map<string, number>();
  for (const n of notes) times.set(n, (times.get(n) ?? 0) + 1);
  return [...times].map(([n, k]) => (k === 1 ? n : `${n}, ${k === 2 ? 'twice' : `${k} times`}`));
}

/** Ends the week: unanswered moments wait, the habits act, expired work lands, all as one batch, and the recap is written. */
// @spec LINE-MOMENT-004, LINE-HABIT-004, LINE-HABIT-005, LINE-HABIT-010, LINE-HABIT-013, LINE-HABIT-014, LINE-HABIT-017, LINE-WORK-014
// @spec LINE-INBOX-009, LINE-INBOX-010, LINE-RECAP-001, LINE-RECAP-002, LINE-GOAL-003, LINE-EVAL-001, LINE-EVAL-002, LINE-EVAL-004, LINE-EVAL-005, LINE-END-010, LINE-END-012, LINE-END-013, LINE-INBOX-002, LINE-INBOX-013
export function endWeek(level: LineState, sim: SimState): LevelResult<WeekResult> {
  const s = structuredClone(level);
  const week = sim.week;
  const t = LINE_TUNING.habits;
  const effects: Effect[] = [];
  const recap: Recap = { habits: [], habitChanges: [], moments: [], expired: [], goals: [], people: [], evaluations: [], assigned: [], held: [] };
  reconcileVacancies(s, sim);
  recap.habitChanges.push(...s.habitNotes, ...fallBack(s, sim));
  s.habitNotes = [];
  s.items = s.items.filter((i) => subjectValid(s, sim, i));

  // Unanswered moments are let wait: work stays open, an interview is skipped, a night page expires.
  const expireNow = new Set<string>();
  for (const m of s.moments.filter((x) => x.week === week)) {
    if (m.status === 'open') {
      m.status = 'waited';
      m.outcome = m.kind === 'onCall' ? 'Nobody picked up the page.' : m.kind === 'interview' ? 'No interview this week.' : m.kind === 'finalEvaluation' ? 'They get one more quarter.' : 'It waits for another week.';
      if (m.kind === 'onCall') expireNow.add(m.ref);
      // A final evaluation left unanswered gives them one more quarter.
      if (m.kind === 'finalEvaluation' && sim.people[m.ref]?.status === 'active') effects.push(oneMoreQuarter(m.ref));
    }
    recap.moments.push({ momentId: m.id, ref: m.ref, text: m.outcome ?? '' });
  }

  // Routine approvals, signed by you or by the engineer the habit names.
  const routine = s.items.filter((i) => ROUTINE_KINDS.includes(i.kind));
  const approvals = action(HABIT_CAUSE.approvals);
  const signed = new Set<string>();
  const signer = s.habits.approvals === 'me' ? undefined : s.habits.approvals;
  // A signer never approves their own expenses; those come to the player with everything else when no one is named.
  const own = (i: (typeof routine)[number]) => i.subject.kind === 'person' && i.subject.id === signer;
  const theirs = signer ? routine.filter((i) => !own(i)) : [];
  // What the signer's skill band reaches, as their card shows it; what is beyond them comes to the player.
  const able = signer ? theirs.filter((i) => band(sim.people[signer]!.skill) >= band(i.difficulty)) : [];
  const beyond = theirs.filter((i) => !able.includes(i));
  const mine = signer ? routine.filter(own) : routine;
  if (mine.length) recap.habits.push(`You signed ${mine.length} routine approval${mine.length === 1 ? '' : 's'}.`);
  if (mine.length + beyond.length) {
    for (const item of [...mine, ...beyond]) signed.add(item.id);
    effects.push(playerEffect('stress', (mine.length + beyond.length) * t.approvalStress, approvals));
  }
  if (signer) {
    for (const item of able) {
      effects.push(personEffect(signer, 'stress', t.signerStress, approvals, { serves: ['autonomy'] }));
      signed.add(item.id);
    }
    const n = beyond.length;
    const rest = n ? ` ${n} ${n === 1 ? 'was beyond them, so you signed it' : 'were beyond them, so you signed them'}.` : '';
    if (theirs.length) recap.habits.push(`${nameOf(sim, signer)} signed ${able.length} routine approval${able.length === 1 ? '' : 's'}.${rest}`);
  }

  // @spec LINE-HABIT-017
  // Night pages the engineer on call could handle are theirs, as if the player had left the page to them.
  const handled = new Map<string, number>();
  for (const item of s.items.filter((i) => i.kind === 'onCall' && Object.hasOwn(s.routinePages, i.id))) {
    const id = s.routinePages[item.id]!;
    signed.add(item.id);
    if (!isEngineer(s, sim, id)) continue;
    effects.push(personEffect(id, 'stress', LINE_TUNING.work.delegateStress, action(HABIT_CAUSE.nightPages), { note: 'Handled a night page alone' }));
    handled.set(id, (handled.get(id) ?? 0) + 1);
  }
  for (const [id, n] of handled) recap.habits.push(`${nameOf(sim, id)} handled ${n} night page${n === 1 ? '' : 's'} on their own.`);
  s.routinePages = {};

  // @spec LINE-WORK-014
  // Design reviews the team took, as if the player had given each to its engineer; one whose engineer left stays open.
  const reviewed = new Map<string, number>();
  for (const item of s.items.filter((i) => i.kind === 'designReview' && Object.hasOwn(s.routineReviews, i.id))) {
    const id = s.routineReviews[item.id]!;
    if (!isEngineer(s, sim, id)) continue;
    signed.add(item.id);
    effects.push(personEffect(id, 'stress', LINE_TUNING.work.delegateStress, action(DELEGATE), { serves: ['growth', 'autonomy'], note: 'Took on a design review' }));
    reviewed.set(id, (reviewed.get(id) ?? 0) + 1);
  }
  for (const [id, n] of reviewed) recap.habits.push(`${nameOf(sim, id)} took ${n} design review${n === 1 ? '' : 's'}.`);
  s.routineReviews = {};

  // Night pages with no moment this week (you take pages, they arrived while you did, or nobody could be on call) are yours.
  const covered = new Set([...s.moments.filter((m) => m.week === week).map((m) => m.ref), ...signed]);
  const pages = s.items.filter((i) => i.kind === 'onCall' && !covered.has(i.id));
  for (const item of pages) {
    effects.push(playerEffect('stress', item.size * t.pageStressPerSize, action(HABIT_CAUSE.nightPages)));
    signed.add(item.id);
  }
  if (pages.length) recap.habits.push(`You took ${pages.length} night page${pages.length === 1 ? '' : 's'} yourself.`);
  s.items = s.items.filter((i) => !signed.has(i.id));

  const habits = habitEffects(s, sim);
  effects.push(...habits.effects);
  recap.habits.push(...habits.recap);

  // Expiries
  for (const item of s.items.filter((i) => i.lastWeek <= week || expireNow.has(i.id))) {
    effects.push(...consequence(item, 1, EXPIRED));
    recap.expired.push({ itemId: item.id, kind: item.kind, subject: { ...item.subject } });
    if (item.kind === 'workIntake') s.intakeDeclinedWeek = week;
  }
  const gone = new Set(recap.expired.map((e) => e.itemId));
  s.items = s.items.filter((i) => !gone.has(i.id));

  // The last week of a review period: everyone not yet rated this period is rated on what they delivered.
  if ((week + 1) % LINE_TUNING.reviewEveryWeeks === 0) {
    const periodStart = week + 1 - LINE_TUNING.reviewEveryWeeks;
    for (const id of teamEngineers(s, sim)) {
      const p = sim.people[id]!;
      const ratedThisPeriod = p.history.some((h) => h.rating && h.week >= periodStart && !(h.cause.kind === 'rule' && h.cause.ruleId === STARTING_ORGANIZATION_RULE));
      const rating = correspondingRating(sim, id);
      if (p.joinedWeek > periodStart || ratedThisPeriod || !rating) continue;
      // A third low rating in a row would let them go: that is the player's decision, in a final evaluation.
      if (planOf(sim, { kind: 'person', id }) === 'pip' && LOW.includes(rating)) {
        s.heldEvaluations.push({ personId: id, rating });
        recap.held.push({ personId: id, name: p.name });
        continue;
      }
      effects.push({ type: 'rate', target: { kind: 'person', id }, rating, cause: rule(EVALUATION), historyNote: `Rated ${RATING_WORDS[rating]} on what they delivered` });
      recap.evaluations.push({ personId: id, name: p.name, rating });
    }
  }

  // A quiet week, with no choice that raised the player's stress, lets them recover.
  if (!s.tookOnWork) effects.push(playerEffect('stress', -LINE_TUNING.restRecovery, rule(REST)));
  s.tookOnWork = false;

  const applied = applyEffects(sim, effects);
  if (!applied.ok) return { ok: false, error: `the simulation rejected the week: ${applied.error.message}` };
  let after = applied.state;
  const log = [...applied.log];
  tallyProgress(s, log);

  // Final evaluations from last period are settled this week, answered or not.
  s.heldEvaluations = s.heldEvaluations.filter((h) => !s.moments.some((m) => m.week === week && m.kind === 'finalEvaluation' && m.ref === h.personId));

  // Weeks the team ends with no active project; after a run of them, the player's manager assigns one.
  if (week % LINE_TUNING.reviewEveryWeeks === 0) s.idleWeeks = 0;
  if (teamProjects(s, after).length === 0) {
    s.idleWeeks++;
    s.idleStreak++;
  } else s.idleStreak = 0;
  if (s.idleStreak >= LINE_TUNING.assignAfterIdleWeeks) {
    const project = generateProject(s, projectNames(after), s.teamId, week, calmRisk(s));
    const started = applyEffects(after, [{ type: 'startProject', project, cause: rule(ASSIGNED) }]);
    if (!started.ok) return { ok: false, error: `the simulation rejected the assigned project: ${started.error.message}` };
    after = started.state;
    log.push(...started.log);
    recap.assigned.push({ projectId: project.id, name: project.name });
    s.idleStreak = 0;
  }

  // The week counts as idle above; then, with room on the team and nothing offered or recently declined, the
  // player's manager assigns new work itself, one project a week.
  // @spec LINE-INBOX-014
  if (recap.assigned.length === 0 && teamProjects(s, after).length < 2 && !teamStretched(s, after) && !intakeWaiting(s, week) && !s.items.some((i) => i.kind === 'workIntake')) {
    const project = generateProject(s, projectNames(after), s.teamId, week, calmRisk(s));
    const started = applyEffects(after, [{ type: 'startProject', project, cause: rule(ASSIGNED) }]);
    if (!started.ok) return { ok: false, error: `the simulation rejected the assigned project: ${started.error.message}` };
    after = started.state;
    log.push(...started.log);
    recap.assigned.push({ projectId: project.id, name: project.name });
  }

  // Weeks the team ends overwhelmed, counted afresh each review period.
  const team = teamEngineers(s, after);
  const teamStress = team.length ? team.reduce((sum, id) => sum + after.people[id]!.stress, 0) / team.length : 0;
  if (week % LINE_TUNING.reviewEveryWeeks === 0) s.overwhelmedWeeks = 0;
  if (band(teamStress) >= LINE_TUNING.stretchedTeamBand) s.overwhelmedWeeks++;

  for (const goal of s.goals) {
    const status = goalStatus(goal, s, after);
    recap.goals.push({ id: goal.id, text: `${status.text}: ${status.progress}.` });
  }

  // Who changed band this week, against how they started it, or gained a note from something other than a habit.
  const start = s.weekStart.week === week ? s.weekStart.people : {};
  const habitCauses = new Set<string>(Object.values(HABIT_CAUSE));
  const fromHabit = (h: HistoryEntry) => h.cause.kind === 'action' && habitCauses.has(h.cause.actionId);
  // The evaluations have their own list in the recap.
  const fromEvaluation = (h: HistoryEntry) => h.cause.kind === 'rule' && h.cause.ruleId === EVALUATION;
  for (const id of teamEngineers(s, after)) {
    const p = after.people[id]!;
    const was = start[id] ?? { motivation: sim.people[id]!.motivation, stress: sim.people[id]!.stress, skill: sim.people[id]!.skill };
    const changes: string[] = [];
    if (band(p.motivation) !== band(was.motivation)) changes.push(band(p.motivation) > band(was.motivation) ? 'more motivated' : 'less motivated');
    if (band(p.stress) !== band(was.stress)) changes.push(band(p.stress) > band(was.stress) ? 'more stressed' : 'less stressed');
    if (band(p.skill) > band(was.skill)) changes.push('grown in skill');
    const thisWeek = p.history.filter((h) => h.week === week && h.note && !fromEvaluation(h));
    if (changes.length || thisWeek.some((h) => !fromHabit(h))) recap.people.push({ personId: id, name: p.name, changes, notes: counted(thisWeek.map((h) => h.note!)) });
  }
  return { ok: true, level: s, sim: after, log, recap };
}
