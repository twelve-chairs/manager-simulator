import { STARTING_ORGANIZATION_RULE, applyEffects, correspondingRating, planOf, type ChangeLogEntry, type Effect, type HistoryEntry, type SimState } from '../../sim';
import { RATING_WORDS, action, band, calmRisk, generateProject, isEngineer, nameOf, personEffect, playerEffect, projectNames, reconcileVacancies, rule, subjectValid, teamEngineers, teamProjects, withCount } from './core';
import { recallInRecap } from './callbacks';
import { setGoals, goalStatus } from './goals';
import { fallBack, habitEffects } from './habits';
import { LOW, addMoments, backupEngineer, oneMoreQuarter } from './moments';
import { DELEGATE, HABIT_CAUSE, LINE_TUNING, ROUTINE_KINDS } from './tuning';
import { EXPIRED, WORK_LABELS, arriveWork, consequence, intakeWaiting, tallyProgress, teamStretched } from './work';
import type { LevelResult, LineState, Recap, StressCause, WeekResult } from './types';

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
    stress: {},
  };
  addMoments(s, sim);
  return s;
}

/** How the recap names the level's causes of an engineer's stress. */
export const STRESS_CAUSE_WORDS: Record<StressCause, string> = {
  approvals: 'signing approvals',
  nightPages: 'night pages',
  work: 'work you gave them',
  newWork: 'new work',
  rollBack: 'a rollback',
  coaching: 'coaching',
};

/** "more stressed", with up to two of the week's own causes, largest first. */
function moreStressed(causes: Partial<Record<StressCause, number>> | undefined): string {
  const named = Object.entries(causes ?? {})
    .sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1))
    .slice(0, 2)
    .map(([c]) => STRESS_CAUSE_WORDS[c as StressCause]);
  return named.length ? `more stressed (${named.join(', ')})` : 'more stressed';
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
  return [...times].map(([n, k]) => withCount(n, k));
}

/** What the week's end works on: the level's copy, the simulation as the week leaves it, and what the steps gather. */
type WeekEnd = {
  s: LineState;
  sim: SimState;
  week: number;
  effects: Effect[];
  recap: Recap;
  /** Items dealt with this week, removed before expiries. */
  signed: Set<string>;
  /** Night pages whose moment was let wait: they expire now. */
  expireNow: Set<string>;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What the recap says of a moment let wait, by kind; anything else waits for another week. */
const WAITED: Partial<Record<LineState['moments'][number]['kind'], string>> = {
  onCall: 'Nobody picked up the page.',
  interview: 'No interview this week.',
  finalEvaluation: 'They get one more quarter.',
};

/** Unanswered moments are let wait: work stays open, an interview is skipped, a night page expires. */
function waitMoments(w: WeekEnd) {
  for (const m of w.s.moments.filter((x) => x.week === w.week)) {
    if (m.status === 'open') {
      m.status = 'waited';
      m.outcome = WAITED[m.kind] ?? 'It waits for another week.';
      if (m.kind === 'onCall') w.expireNow.add(m.ref);
      // A final evaluation left unanswered gives them one more quarter.
      if (m.kind === 'finalEvaluation' && w.sim.people[m.ref]?.status === 'active') w.effects.push(oneMoreQuarter(m.ref));
    }
    w.recap.moments.push({ momentId: m.id, ref: m.ref, text: m.outcome ?? '' });
  }
}

/** Routine approvals, signed by the player or by the engineer the habit names. */
function signApprovals({ s, sim, effects, recap, signed }: WeekEnd) {
  const t = LINE_TUNING.habits;
  const routine = s.items.filter((i) => ROUTINE_KINDS.includes(i.kind));
  const approvals = action(HABIT_CAUSE.approvals);
  const signer = s.habits.approvals === 'me' ? undefined : s.habits.approvals;
  // A signer never approves their own expenses; those come to the player with everything else when no one is named.
  const own = (i: (typeof routine)[number]) => i.subject.kind === 'person' && i.subject.id === signer;
  const theirs = signer ? routine.filter((i) => !own(i)) : [];
  // What the signer's skill band reaches, as their card shows it; what is beyond them comes to the player.
  const able = signer ? theirs.filter((i) => band(sim.people[signer]!.skill) >= band(i.difficulty)) : [];
  const beyond = theirs.filter((i) => !able.includes(i));
  const mine = signer ? routine.filter(own) : routine;
  if (mine.length) recap.habits.push(`You signed ${plural(mine.length, 'routine approval')}.`);
  if (mine.length + beyond.length) {
    for (const item of [...mine, ...beyond]) signed.add(item.id);
    effects.push(playerEffect('stress', (mine.length + beyond.length) * t.approvalStress, approvals));
  }
  if (!signer) return;
  for (const item of able) {
    effects.push(personEffect(signer, 'stress', t.signerStress, approvals, { serves: ['autonomy'] }));
    signed.add(item.id);
  }
  const n = beyond.length;
  const beyondThem = n === 1 ? 'was beyond them, so you signed it' : 'were beyond them, so you signed them';
  const rest = n ? ` ${n} ${beyondThem}.` : '';
  if (theirs.length) recap.habits.push(`${nameOf(sim, signer)} signed ${plural(able.length, 'routine approval')}.${rest}`);
}

// @spec LINE-HABIT-017
// Night pages the engineer on call could handle are theirs, as if the player had left the page to them.
// @spec LINE-HABIT-018
// Under a backup, a page beyond the engineer on call is the two of theirs, and costs the backup their sleep too.
function routineNightPages({ s, sim, effects, recap, signed }: WeekEnd) {
  const handled = new Map<string, number>();
  const together = new Map<string, number>();
  const cause = action(HABIT_CAUSE.nightPages);
  for (const item of s.items.filter((i) => i.kind === 'onCall' && Object.hasOwn(s.routinePages, i.id))) {
    const id = s.routinePages[item.id]!;
    const backup = s.backedPages[item.id];
    signed.add(item.id);
    if (!isEngineer(s, sim, id)) continue;
    if (backup !== undefined && isEngineer(s, sim, backup)) {
      effects.push(
        personEffect(id, 'stress', LINE_TUNING.work.delegateStress, cause, { note: 'Handled a night page with a backup' }),
        personEffect(backup, 'stress', LINE_TUNING.work.backUpStress, cause, { note: 'Backed up a night page' }),
      );
      const pair = `${id} ${backup}`;
      together.set(pair, (together.get(pair) ?? 0) + 1);
      continue;
    }
    // With a backup behind them, the engineer on call is not on their own, even on a page they handle themselves.
    const behind = backupEngineer(s, sim, id);
    effects.push(personEffect(id, 'stress', LINE_TUNING.work.delegateStress, cause, { note: behind ? 'Handled a night page with a backup' : 'Handled a night page alone' }));
    handled.set(id, (handled.get(id) ?? 0) + 1);
  }
  for (const [id, n] of handled) {
    const behind = backupEngineer(s, sim, id);
    const pages = plural(n, 'night page');
    recap.habits.push(behind ? `${nameOf(sim, id)} handled ${pages}, with ${nameOf(sim, behind)} as backup.` : `${nameOf(sim, id)} handled ${pages} on their own.`);
  }
  for (const [pair, n] of together) {
    const [id, backup] = pair.split(' ');
    recap.habits.push(`${nameOf(sim, id!)} and ${nameOf(sim, backup!)} handled ${plural(n, 'night page')} together.`);
  }
  s.routinePages = {};
  s.backedPages = {};
}

// @spec LINE-WORK-014
// Work the team took, as if the player had given each item to its engineer; one whose engineer left stays open.
function routineWork({ s, sim, effects, recap, signed }: WeekEnd) {
  for (const kind of ['designReview', 'customerRequest'] as const) {
    const label = WORK_LABELS[kind];
    const took = new Map<string, number>();
    for (const item of s.items.filter((i) => i.kind === kind && Object.hasOwn(s.routineWork, i.id))) {
      const id = s.routineWork[item.id]!;
      if (!isEngineer(s, sim, id)) continue;
      signed.add(item.id);
      effects.push(personEffect(id, 'stress', LINE_TUNING.work.delegateStress, action(DELEGATE), { serves: ['growth', 'autonomy'], note: `Took on a ${label}` }));
      took.set(id, (took.get(id) ?? 0) + 1);
    }
    for (const [id, n] of took) recap.habits.push(`${nameOf(sim, id)} took ${plural(n, label)}.`);
  }
  s.routineWork = {};
}

/** Night pages with no moment this week (the player takes pages, they arrived while the player did, or nobody could be on call) are the player's. */
function playerPages({ s, week, effects, recap, signed }: WeekEnd) {
  const covered = new Set([...s.moments.filter((m) => m.week === week).map((m) => m.ref), ...signed]);
  const pages = s.items.filter((i) => i.kind === 'onCall' && !covered.has(i.id));
  for (const item of pages) {
    effects.push(playerEffect('stress', item.size * LINE_TUNING.habits.pageStressPerSize, action(HABIT_CAUSE.nightPages)));
    signed.add(item.id);
  }
  if (pages.length) recap.habits.push(`You took ${plural(pages.length, 'night page')} yourself.`);
}

/** Work past its last week, or a night page let wait, lands with its consequence. */
function expire({ s, week, effects, recap, expireNow }: WeekEnd) {
  for (const item of s.items.filter((i) => i.lastWeek <= week || expireNow.has(i.id))) {
    effects.push(...consequence(item, 1, EXPIRED));
    recap.expired.push({ itemId: item.id, kind: item.kind, subject: { ...item.subject } });
    if (item.kind === 'workIntake') s.intakeDeclinedWeek = week;
  }
  const gone = new Set(recap.expired.map((e) => e.itemId));
  s.items = s.items.filter((i) => !gone.has(i.id));
}

/** The last week of a review period: everyone not yet rated this period is rated on what they delivered. */
function periodRatings({ s, sim, week, effects, recap }: WeekEnd) {
  if ((week + 1) % LINE_TUNING.reviewEveryWeeks !== 0) return;
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

type Assigned = { ok: true; sim: SimState } | { ok: false; error: string };

/** The player's manager starts a new project for the team. */
function assignProject(s: LineState, sim: SimState, week: number, log: ChangeLogEntry[], recap: Recap): Assigned {
  const project = generateProject(s, projectNames(sim), s.teamId, week, calmRisk(s));
  const started = applyEffects(sim, [{ type: 'startProject', project, cause: rule(ASSIGNED) }]);
  if (!started.ok) return { ok: false, error: `the simulation rejected the assigned project: ${started.error.message}` };
  log.push(...started.log);
  recap.assigned.push({ projectId: project.id, name: project.name });
  return { ok: true, sim: started.state };
}

/** Weeks the team ends with no active project; after a run of them, or with room and nothing offered, the player's manager assigns one. */
function assignIdleWork(s: LineState, sim: SimState, week: number, log: ChangeLogEntry[], recap: Recap): Assigned {
  let after = sim;
  if (week % LINE_TUNING.reviewEveryWeeks === 0) s.idleWeeks = 0;
  if (teamProjects(s, after).length === 0) {
    s.idleWeeks++;
    s.idleStreak++;
  } else s.idleStreak = 0;
  if (s.idleStreak >= LINE_TUNING.assignAfterIdleWeeks) {
    const r = assignProject(s, after, week, log, recap);
    if (!r.ok) return r;
    after = r.sim;
    s.idleStreak = 0;
  }
  // The week counts as idle above; then, with room on the team and nothing offered or recently declined, the
  // player's manager assigns new work itself, one project a week.
  // @spec LINE-INBOX-014
  if (recap.assigned.length === 0 && teamProjects(s, after).length < 2 && !teamStretched(s, after) && !intakeWaiting(s, week) && !s.items.some((i) => i.kind === 'workIntake')) return assignProject(s, after, week, log, recap);
  return { ok: true, sim: after };
}

type Bands = { motivation: number; stress: number; skill: number };

/** The bands a person moved through this week, in words; `stressed` says what made them more stressed. */
function bandChanges(p: Bands, was: Bands, stressed: () => string): string[] {
  const changes: string[] = [];
  if (band(p.motivation) !== band(was.motivation)) changes.push(band(p.motivation) > band(was.motivation) ? 'more motivated' : 'less motivated');
  if (band(p.stress) > band(was.stress)) changes.push(stressed());
  else if (band(p.stress) < band(was.stress)) changes.push('less stressed');
  if (band(p.skill) > band(was.skill)) changes.push('grown in skill');
  return changes;
}

/** Who changed band this week, against how they started it, or gained a note from something other than a habit. */
function peopleRecap(s: LineState, sim: SimState, after: SimState, week: number, recap: Recap) {
  const start = s.weekStart.week === week ? s.weekStart.people : {};
  const habitCauses = new Set<string>(Object.values(HABIT_CAUSE));
  const fromHabit = (h: HistoryEntry) => h.cause.kind === 'action' && habitCauses.has(h.cause.actionId);
  // The evaluations have their own list in the recap.
  const fromEvaluation = (h: HistoryEntry) => h.cause.kind === 'rule' && h.cause.ruleId === EVALUATION;
  for (const id of teamEngineers(s, after)) {
    const p = after.people[id]!;
    const was = start[id] ?? { motivation: sim.people[id]!.motivation, stress: sim.people[id]!.stress, skill: sim.people[id]!.skill };
    const changes = bandChanges(p, was, () => moreStressed(s.weekStart.week === week ? s.weekStart.stress[id] : undefined));
    const thisWeek = p.history.filter((h) => h.week === week && h.note && !fromEvaluation(h));
    if (changes.length || thisWeek.some((h) => !fromHabit(h))) recap.people.push({ personId: id, name: p.name, changes, notes: counted(thisWeek.map((h) => h.note!)) });
  }
}

/** Ends the week: unanswered moments wait, the habits act, expired work lands, all as one batch, and the recap is written. */
// @spec LINE-MOMENT-004, LINE-HABIT-004, LINE-HABIT-005, LINE-HABIT-010, LINE-HABIT-013, LINE-HABIT-014, LINE-HABIT-017, LINE-WORK-014
// @spec LINE-INBOX-009, LINE-INBOX-010, LINE-RECAP-001, LINE-RECAP-002, LINE-GOAL-003, LINE-EVAL-001, LINE-EVAL-002, LINE-EVAL-004, LINE-EVAL-005, LINE-END-010, LINE-END-012, LINE-END-013, LINE-INBOX-002, LINE-INBOX-013
export function endWeek(level: LineState, sim: SimState): LevelResult<WeekResult> {
  const s = structuredClone(level);
  const week = sim.week;
  const recap: Recap = { habits: [], habitChanges: [], moments: [], expired: [], goals: [], people: [], evaluations: [], assigned: [], held: [] };
  reconcileVacancies(s, sim);
  recap.habitChanges.push(...s.habitNotes, ...fallBack(s, sim));
  s.habitNotes = [];
  s.items = s.items.filter((i) => subjectValid(s, sim, i));

  // In this order: each step sees the items the one before dealt with, and the effects apply as one batch.
  const w: WeekEnd = { s, sim, week, effects: [], recap, signed: new Set(), expireNow: new Set() };
  waitMoments(w);
  signApprovals(w);
  routineNightPages(w);
  routineWork(w);
  playerPages(w);
  s.items = s.items.filter((i) => !w.signed.has(i.id));
  const habits = habitEffects(s, sim);
  w.effects.push(...habits.effects);
  recap.habits.push(...habits.recap);
  expire(w);
  periodRatings(w);
  // A quiet week, with no choice that raised the player's stress, lets them recover.
  if (s.energySpent === 0) w.effects.push(playerEffect('stress', -LINE_TUNING.restRecovery, rule(REST)));
  s.energySpent = 0;

  const applied = applyEffects(sim, w.effects);
  if (!applied.ok) return { ok: false, error: `the simulation rejected the week: ${applied.error.message}` };
  const log = [...applied.log];
  tallyProgress(s, log);

  // Final evaluations from last period are settled this week, answered or not.
  s.heldEvaluations = s.heldEvaluations.filter((h) => !s.moments.some((m) => m.week === week && m.kind === 'finalEvaluation' && m.ref === h.personId));

  const assigned = assignIdleWork(s, applied.state, week, log, recap);
  if (!assigned.ok) return assigned;
  const after = assigned.sim;

  // Weeks the team ends overwhelmed, counted afresh each review period.
  const team = teamEngineers(s, after);
  const teamStress = team.length ? team.reduce((sum, id) => sum + after.people[id]!.stress, 0) / team.length : 0;
  if (week % LINE_TUNING.reviewEveryWeeks === 0) s.overwhelmedWeeks = 0;
  if (band(teamStress) >= LINE_TUNING.stretchedTeamBand) s.overwhelmedWeeks++;

  for (const goal of s.goals) {
    const status = goalStatus(goal, s, after);
    recap.goals.push({ id: goal.id, text: `${status.text}: ${status.progress}.` });
  }
  peopleRecap(s, sim, after, week, recap);
  const recalled = recallInRecap(s, after, teamEngineers(s, after));
  if (recalled) recap.recalled = recalled;
  return { ok: true, level: s, sim: after, log, recap };
}
