import { TUNING, behindScheduleProjects, compareCodeUnits, overdueProjects, type SimState, type Want } from '../../sim';
import { band, teamEngineers, teamProjects } from './core';
import { LEVEL } from './start';
import { LINE_TUNING } from './tuning';
import { STRESS_CAUSE_WORDS } from './week';
import type { LineState, StressCause, Watch, WatchCause } from './types';

/** Weeks within which the same warning about the same subject is not repeated. */
const REPEAT_WEEKS = 3;

/** What each want is, as the watch line says someone has gone without it. */
const WANT_WORDS: Record<Want, string> = {
  growth: 'a chance to grow',
  recognition: 'recognition for their work',
  stability: 'a steady week',
  autonomy: 'room to work their own way',
};

const weeksWord = (n: number) => (n === 1 ? '1 week' : `${n} weeks`);

/** The habits behind the level's own stress causes, as the habits panel names them. */
const HABIT_OF: Partial<Record<StressCause, string>> = { nightPages: 'night pages', approvals: 'routine approvals', coaching: 'growth focus' };

/** The largest of the level's own causes of an engineer's stress over the recent weeks, if any. */
function stressCause(level: LineState, id: string): WatchCause | undefined {
  const totals: Partial<Record<StressCause, number>> = {};
  for (const w of level.recentWeeks) for (const [c, n] of Object.entries(w.stress[id] ?? {})) totals[c as StressCause] = (totals[c as StressCause] ?? 0) + n;
  const [top] = Object.entries(totals)
    .filter(([, n]) => n > 0)
    .sort(([a, x], [b, y]) => y - x || compareCodeUnits(a, b));
  return top ? { kind: 'stress', stress: top[0] as StressCause } : undefined;
}

/** For motivation: a learned want gone unserved past the drift threshold, or that the player does not know what they want. */
function motivationCause(level: LineState, sim: SimState, id: string): WatchCause | undefined {
  const p = sim.people[id]!;
  const learned = level.learnedWants[id];
  if (!learned || learned.want !== p.want) return { kind: 'unknownWant' };
  const weeks = sim.week - p.wantServedWeek;
  return weeks > TUNING.wantDriftThresholdWeeks ? { kind: 'want', want: p.want, weeks } : undefined;
}

const causeOf = (level: LineState, sim: SimState, id: string, line: 'stress' | 'motivation') => (line === 'stress' ? stressCause(level, id) : motivationCause(level, sim, id));

/** Every warning that holds, in the order the watch line weighs them. */
function candidates(level: LineState, sim: SimState): Omit<Watch, 'text'>[] {
  const out: Omit<Watch, 'text'>[] = [];
  // The player's own energy at the edge.
  if (sim.player.stress >= LINE_TUNING.burnoutThreshold) {
    out.push({ kind: 'edge', subject: 'player', weeks: level.burnoutWeeks, weeksLeft: LINE_TUNING.burnoutWeeks - level.burnoutWeeks });
  }
  const people = teamEngineers(level, sim);
  // Engineers over a departure line, longest over first.
  const overs = people
    .map((id) => {
      const p = sim.people[id]!;
      const stress = p.stress > TUNING.highStressLine ? p.highStressWeeks : -1;
      const motivation = p.motivation < TUNING.lowMotivationLine ? p.lowMotivationWeeks : -1;
      if (stress < 0 && motivation < 0) return undefined;
      const line = stress >= motivation ? ('stress' as const) : ('motivation' as const);
      return { id, line, weeks: Math.max(stress, motivation) };
    })
    .filter((o) => o !== undefined)
    .sort((a, b) => b.weeks - a.weeks || compareCodeUnits(a.id, b.id));
  for (const o of overs) out.push({ kind: 'over', subject: o.id, line: o.line, weeks: o.weeks, ...withCause(causeOf(level, sim, o.id, o.line)) });
  // Engineers who moved this week into the band that holds a line, without crossing it.
  const start = level.weekStart.week === sim.week - LEVEL.weeksPerStep ? level.weekStart.people : {};
  const highBand = band(TUNING.highStressLine);
  const lowBand = band(TUNING.lowMotivationLine);
  const nearStress = (stress: number) => band(stress) === highBand && stress <= TUNING.highStressLine;
  const nearMotivation = (motivation: number) => band(motivation) === lowBand && motivation >= TUNING.lowMotivationLine;
  // Started each of the last `watchWeeks` weeks in the band, and still there.
  const stayed = (id: string, near: (x: { stress: number; motivation: number }) => boolean) =>
    level.recentWeeks.length >= LINE_TUNING.watchWeeks && level.recentWeeks.every((w) => w.people[id] !== undefined && near(w.people[id]!));
  for (const id of people) {
    const p = sim.people[id]!;
    const was = start[id];
    if (!was) continue;
    const line =
      nearStress(p.stress) && (band(was.stress) < highBand || stayed(id, (x) => nearStress(x.stress)))
        ? ('stress' as const)
        : nearMotivation(p.motivation) && (band(was.motivation) > lowBand || stayed(id, (x) => nearMotivation(x.motivation)))
          ? ('motivation' as const)
          : undefined;
    if (line) out.push({ kind: 'nearing', subject: id, line, ...withCause(causeOf(level, sim, id, line)) });
  }
  // Projects: overdue, then behind schedule, then due soon at a pace that will not finish them; soonest deadline first.
  const mine = new Set(teamProjects(level, sim));
  const byDeadline = (ids: string[]) => ids.filter((id) => mine.has(id)).sort((a, b) => sim.projects[a]!.deadlineWeek - sim.projects[b]!.deadlineWeek || compareCodeUnits(a, b));
  const overdue = byDeadline(overdueProjects(sim).map((p) => p.id));
  const behind = byDeadline(behindScheduleProjects(sim).map((p) => p.id)).filter((id) => !overdue.includes(id));
  const slow = byDeadline([...mine].filter((id) => !overdue.includes(id) && !behind.includes(id) && wontFinish(level, sim, id)));
  for (const id of [...overdue, ...behind, ...slow]) out.push({ kind: 'project', subject: id });
  return out;
}

const withCause = (cause: WatchCause | undefined) => (cause ? { cause } : {});

/** Whether a project due within `watchWeeks` has more left than its recent pace will cover in the weeks left. */
function wontFinish(level: LineState, sim: SimState, id: string): boolean {
  const p = sim.projects[id]!;
  const left = p.deadlineWeek - sim.week;
  if (left <= 0 || left > LINE_TUNING.watchWeeks) return false;
  const from = level.recentWeeks.find((w) => Object.hasOwn(w.projects, id));
  if (!from) return false;
  const pace = (p.progress - from.projects[id]!) / (sim.week - from.week);
  return p.scope - p.progress > pace * left;
}

/** Whether the same warning about the same subject was reported within the last few weeks, and has not moved up since. */
function heldBack(level: LineState, played: number, w: Omit<Watch, 'text'>): boolean {
  if (w.kind === 'edge' && w.weeksLeft === 1) return false;
  return level.watched.some((x) => x.subject === w.subject && x.kind === w.kind && x.week > played - REPEAT_WEEKS);
}

/** The watch line in words: who, what is close, and the lever where the level knows it. */
function textOf(level: LineState, sim: SimState, w: Omit<Watch, 'text'>): string {
  if (w.kind === 'edge') {
    return w.weeksLeft === 1
      ? `You're running on fumes: ${weeksWord(w.weeks!)} at the edge. One more week like this and you burn out.`
      : `You're running on fumes: ${weeksWord(w.weeks!)} at the edge. ${w.weeksLeft} more and you burn out.`;
  }
  if (w.kind === 'project') {
    const p = sim.projects[w.subject]!;
    if (p.deadlineWeek < sim.week) return `${p.name} is past its deadline, and every week late counts against the team.`;
    if (p.deadlineWeek - sim.week > LINE_TUNING.watchWeeks || behindScheduleProjects(sim).some((x) => x.id === p.id)) return `${p.name} is falling behind schedule.`;
    return `${p.name} is due in ${weeksWord(p.deadlineWeek - sim.week)}, and at this pace it won't make it.`;
  }
  const name = sim.people[w.subject]!.name;
  const cause = w.cause;
  // A habit repeats every week until it is changed: name it, and how often it has landed on them lately.
  const habit = cause?.kind === 'stress' ? HABIT_OF[cause.stress] : undefined;
  const habitLine = habit
    ? ` The ${habit} habit has added to their load in ${level.recentWeeks.filter((x) => (x.stress[w.subject]?.[(cause as { stress: StressCause }).stress] ?? 0) > 0).length} of the last ${LINE_TUNING.watchWeeks} weeks.`
    : '';
  const because =
    cause?.kind === 'stress'
      ? `, mostly from ${STRESS_CAUSE_WORDS[cause.stress]}`
      : cause?.kind === 'want'
        ? `, and it's been ${weeksWord(cause.weeks)} since they had ${WANT_WORDS[cause.want]}`
        : cause?.kind === 'unknownWant'
          ? `, and you don't know what they want`
          : '';
  if (w.kind === 'over') {
    return w.line === 'stress'
      ? `${name} looks worn through: ${weeksWord(w.weeks!)} over the line${because}.${habitLine} Every week like this makes leaving likelier.`
      : `${name} has gone flat: ${weeksWord(w.weeks!)} of low motivation${because}. Every week like this makes leaving likelier.`;
  }
  return w.line === 'stress' ? `${name} is getting stretched thin${because}.${habitLine}` : `${name} seems to be losing interest${because}.`;
}

/**
 * Picks the week's watch line after an advance and records it: the first warning that holds and is not held back.
 * Keeps the played week's start, for the causes and pace of the weeks after.
 */
// @spec LINE-RECAP-007, LINE-RECAP-008, LINE-RECAP-009
export function watchAfterAdvance(level: LineState, sim: SimState, burnedOut: boolean): void {
  const played = sim.week - LEVEL.weeksPerStep;
  if (level.weekStart.week === played) {
    const people = Object.fromEntries(Object.entries(level.weekStart.people).map(([id, p]) => [id, { stress: p.stress, motivation: p.motivation }]));
    level.recentWeeks.push({ week: played, stress: structuredClone(level.weekStart.stress), projects: { ...level.weekStart.projects }, people });
  }
  level.recentWeeks = level.recentWeeks.filter((w) => w.week > played - LINE_TUNING.watchWeeks);
  level.watched = level.watched.filter((w) => w.week > played - REPEAT_WEEKS);
  const pick = burnedOut ? undefined : candidates(level, sim).find((w) => !heldBack(level, played, w));
  level.watch = pick ? { week: played, line: { ...pick, text: textOf(level, sim, pick) } } : { week: played };
  if (pick) level.watched.push({ week: played, kind: pick.kind, subject: pick.subject });
}

/** The watch line for the week just played, if there was one. */
// @spec LINE-RECAP-007
export function watchLastWeek(level: LineState, sim: SimState): Watch | undefined {
  return level.watch.week === sim.week - LEVEL.weeksPerStep ? level.watch.line : undefined;
}
