import { applyEffects, type Effect, type HistoryEntry, type SimState } from '../../sim';
import { action, band, nameOf, personEffect, playerEffect, reconcileVacancies, subjectValid, teamEngineers } from './core';
import { setGoals, goalStatus } from './goals';
import { fallBack, habitEffects } from './habits';
import { addMoments } from './moments';
import { HABIT_CAUSE, LINE_TUNING, ROUTINE_KINDS } from './tuning';
import { EXPIRED, arriveWork, consequence } from './work';
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
    people: Object.fromEntries(teamEngineers(s, sim).map((id) => [id, { motivation: sim.people[id]!.motivation, stress: sim.people[id]!.stress }])),
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

/** Ends the week: unanswered moments wait, the habits act, expired work lands, all as one batch, and the recap is written. */
// @spec LINE-MOMENT-004, LINE-HABIT-004, LINE-HABIT-005, LINE-HABIT-010, LINE-HABIT-013, LINE-HABIT-014
// @spec LINE-INBOX-009, LINE-INBOX-010, LINE-RECAP-001, LINE-RECAP-002, LINE-GOAL-003
export function endWeek(level: LineState, sim: SimState): LevelResult<WeekResult> {
  const s = structuredClone(level);
  const week = sim.week;
  const t = LINE_TUNING.habits;
  const effects: Effect[] = [];
  const recap: Recap = { habits: [], habitChanges: [], moments: [], expired: [], goals: [], people: [] };
  reconcileVacancies(s, sim);
  recap.habitChanges.push(...s.habitNotes, ...fallBack(s, sim));
  s.habitNotes = [];
  s.items = s.items.filter((i) => subjectValid(s, sim, i));

  // Unanswered moments are let wait: work stays open, an interview is skipped, a night page expires.
  const expireNow = new Set<string>();
  for (const m of s.moments.filter((x) => x.week === week)) {
    if (m.status === 'open') {
      m.status = 'waited';
      m.outcome = m.kind === 'onCall' ? 'Nobody picked up the page.' : m.kind === 'interview' ? 'No interview this week.' : 'It waits for another week.';
      if (m.kind === 'onCall') expireNow.add(m.ref);
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
  const mine = signer ? routine.filter(own) : routine;
  if (mine.length) {
    for (const item of mine) signed.add(item.id);
    effects.push(playerEffect('stress', mine.length * t.approvalStress, approvals));
    recap.habits.push(`You signed ${mine.length} routine approval${mine.length === 1 ? '' : 's'}.`);
  }
  if (signer) {
    const theirs = routine.filter((i) => !own(i));
    const able = theirs.filter((i) => i.difficulty <= sim.people[signer]!.skill);
    for (const item of able) {
      effects.push(personEffect(signer, 'stress', t.signerStress, approvals, { serves: ['autonomy'] }));
      signed.add(item.id);
    }
    if (theirs.length) recap.habits.push(`${nameOf(sim, signer)} signed ${able.length} of ${theirs.length} routine approvals.`);
  }

  // Night pages with no moment this week (you take pages, they arrived while you did, or nobody could be on call) are yours.
  const covered = new Set(s.moments.filter((m) => m.week === week).map((m) => m.ref));
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
  }
  const gone = new Set(recap.expired.map((e) => e.itemId));
  s.items = s.items.filter((i) => !gone.has(i.id));

  const applied = applyEffects(sim, effects);
  if (!applied.ok) return { ok: false, error: `the simulation rejected the week: ${applied.error.message}` };
  const after = applied.state;

  for (const goal of s.goals) {
    const status = goalStatus(goal, s, after);
    recap.goals.push({ id: goal.id, text: `${status.text}: ${status.progress}.` });
  }

  // Who changed band this week, against how they started it, or gained a note from something other than a habit.
  const start = s.weekStart.week === week ? s.weekStart.people : {};
  const habitCauses = new Set<string>(Object.values(HABIT_CAUSE));
  const fromHabit = (h: HistoryEntry) => h.cause.kind === 'action' && habitCauses.has(h.cause.actionId);
  for (const id of teamEngineers(s, after)) {
    const p = after.people[id]!;
    const was = start[id] ?? { motivation: sim.people[id]!.motivation, stress: sim.people[id]!.stress };
    const changes: string[] = [];
    if (band(p.motivation) !== band(was.motivation)) changes.push(band(p.motivation) > band(was.motivation) ? 'more motivated' : 'less motivated');
    if (band(p.stress) !== band(was.stress)) changes.push(band(p.stress) > band(was.stress) ? 'more stressed' : 'less stressed');
    const thisWeek = p.history.filter((h) => h.week === week && h.note);
    if (changes.length || thisWeek.some((h) => !fromHabit(h))) recap.people.push({ personId: id, name: p.name, changes, notes: thisWeek.map((h) => h.note!) });
  }
  return { ok: true, level: s, sim: after, log: applied.log, recap };
}
