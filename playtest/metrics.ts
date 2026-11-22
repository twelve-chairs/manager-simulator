/**
 * The success-metric playtests' scoring (docs/intent/playtest): turns the event log a scripted player records from
 * the screen into a run's measures, and a player's runs into a scorecard. Pure, so it is tested with made-up logs.
 */

/** The session clock's constants: how long a person takes to read and to decide. */
export const CLOCK = { wordsPerMinute: 230, decisionSeconds: 4, clickSeconds: 1 };
/** The HLD's longest session, and the share of first-timer runs that should reach a promotion within one. */
export const SESSION_MINUTES = 60;
export const TARGET_PROMOTED_SHARE = 0.5;
/** A bad event's window: its own week and the three before it. */
const WINDOW_WEEKS = 4;
/** How many weeks later a choice's note should still be on the card. */
const NOTE_WEEKS_LATER = 2;
/** A situation shown again within this many weeks of last being shown counts as a repeat. */
const REPEAT_WEEKS = 13;

const WORSE_MOTIVATION = ['struggling', 'flat'];
const WORSE_STRESS = ['strained', 'overwhelmed'];
const AT_RISK = ['elevated', 'high', 'severe'];
const TIRED = ['tired', 'running on fumes'];
const LOW_RATINGS = ['partial', 'below'];
const RATING_SCORES: Record<string, number> = { below: 0, partial: 1, meets: 2, exceeds: 3, outstanding: 4 };

/** What the screen showed of the team, the projects and the player while a week was on screen. */
export interface Look {
  kind: 'look';
  week: number;
  people: { name: string; motivation: string; stress: string; memory: string[] }[];
  projects: { name: string; schedule: string; risk: string }[];
  energy: string;
  burnout: boolean;
}

export type PlayEvent =
  | { kind: 'read'; words: number }
  | { kind: 'click'; decision: boolean }
  | Look
  | { kind: 'moment'; week: number; title: string; situation: boolean }
  | { kind: 'answer'; week: number; title: string; reaction: string | null; chips: string[]; notes: { name: string; note: string }[] }
  | { kind: 'wait'; week: number }
  | { kind: 'review'; week: number; rating: string; promoted: boolean }
  | { kind: 'ended'; ending: string; left: { name: string; reason: string }[] };

export interface RunCard {
  seed: number;
  ending: string | null;
  weeks: number;
  minutes: number;
  promotedAtMinutes: number | null;
  trace: {
    quits: { name: string; warned: boolean }[];
    lowRatings: { week: number; warned: boolean }[];
    overdue: { name: string; week: number; warned: boolean }[];
    burnout: { week: number; warned: boolean } | null;
  };
  choices: { answered: number; withChip: number | null; notesKept: number | null; unanswered: { week: number; title: string }[] };
  shape: {
    decisions: { mean: number; fewest: number; most: number; weeksWithNone: number };
    longestSameKind: number;
    situationRepeats: number;
    distinctReactions: number | null;
  };
  ratings: number[];
}

export interface Check {
  id: 'PLAY-CHOICE-001';
  name: string;
  passed: boolean;
  failures: string[];
}

export interface Scorecard {
  player: string;
  runs: RunCard[];
  promotion: { withinSession: number; target: number; sessionMinutes: number };
  trace: { quits: number | null; lowRatings: number | null; overdue: number | null; burnout: number | null };
  averageRating: number | null;
  checks: Check[];
}

const share = (part: number, whole: number) => (whole ? part / whole : null);
const isLook = (e: PlayEvent): e is Look => e.kind === 'look';
const worse = (p: Look['people'][number]) => WORSE_MOTIVATION.includes(p.motivation) || WORSE_STRESS.includes(p.stress);
/** A memory line without the count the card adds to a repeated note ("Took on a design review, twice"). */
const uncounted = (line: string) => line.replace(/, (twice|\d+ times)$/, '');
/** A moment's kind: a career level's moment by its title before the colon; each situation a kind of its own. */
const kindOf = (title: string, situation: boolean) => (situation ? `situation:${title}` : title.split(':')[0]!);

/** The looks recorded before event `index`, in its window ending at `week`. */
function windowBefore(events: PlayEvent[], index: number, week: number): Look[] {
  return events.slice(0, index).filter(isLook).filter((l) => l.week > week - WINDOW_WEEKS && l.week <= week);
}

// @spec PLAY-CLOCK-001, PLAY-CLOCK-002, PLAY-CLOCK-003, PLAY-PROMO-001, PLAY-PROMO-002, PLAY-TRACE-001, PLAY-TRACE-002
// @spec PLAY-TRACE-003, PLAY-TRACE-004, PLAY-CHOICE-001, PLAY-CHOICE-002, PLAY-CHOICE-003, PLAY-SHAPE-001
// @spec PLAY-SHAPE-002, PLAY-SHAPE-003, PLAY-SHAPE-004
export function scoreRun(seed: number, events: PlayEvent[]): RunCard {
  let seconds = 0;
  let promotedAtMinutes: number | null = null;
  let ending: string | null = null;
  let left: { name: string; reason: string }[] = [];
  let weeks = 0;
  const lowRatings: RunCard['trace']['lowRatings'] = [];
  const overdue: RunCard['trace']['overdue'] = [];
  let burnout: RunCard['trace']['burnout'] = null;
  const ratings: number[] = [];

  events.forEach((e, i) => {
    if ('week' in e) weeks = Math.max(weeks, e.week);
    switch (e.kind) {
      case 'read':
        seconds += (e.words / CLOCK.wordsPerMinute) * 60;
        break;
      case 'click':
        seconds += e.decision ? CLOCK.decisionSeconds : CLOCK.clickSeconds;
        break;
      case 'review': {
        if (e.promoted && promotedAtMinutes === null) promotedAtMinutes = seconds / 60;
        const score = RATING_SCORES[e.rating];
        if (score !== undefined) ratings.push(score);
        if (LOW_RATINGS.includes(e.rating)) {
          const warned = windowBefore(events, i, e.week).some((l) => l.projects.some((p) => p.schedule === 'behind' || p.schedule === 'overdue') || l.people.some(worse));
          lowRatings.push({ week: e.week, warned });
        }
        break;
      }
      case 'look': {
        for (const project of e.projects) {
          if (project.schedule !== 'overdue' || overdue.some((o) => o.name === project.name)) continue;
          const earlier = windowBefore(events, i, e.week).flatMap((l) => l.projects.filter((p) => p.name === project.name));
          overdue.push({ name: project.name, week: e.week, warned: earlier.some((p) => p.schedule === 'behind' || AT_RISK.includes(p.risk)) });
        }
        if (e.burnout && !burnout) burnout = { week: e.week, warned: windowBefore(events, i, e.week).some((l) => TIRED.includes(l.energy)) };
        break;
      }
      case 'ended':
        ending = e.ending;
        left = e.left;
        break;
    }
  });

  const looks = events.filter(isLook);
  const quits = left
    .filter((p) => p.reason === 'quit')
    .map(({ name }) => {
      const seen = looks.filter((l) => l.people.some((p) => p.name === name));
      const lastWeeks = [...new Set(seen.map((l) => l.week))].slice(-WINDOW_WEEKS);
      const warned = seen.filter((l) => lastWeeks.includes(l.week)).some((l) => l.people.some((p) => p.name === name && worse(p)));
      return { name, warned };
    });

  const answers = events.filter((e) => e.kind === 'answer');
  const unanswered = answers.filter((a) => !a.reaction?.trim()).map((a) => ({ week: a.week, title: a.title }));
  const notes = answers.flatMap((a) => a.notes.map((n) => ({ ...n, week: a.week + NOTE_WEEKS_LATER })));
  let notesSeen = 0;
  let notesKept = 0;
  for (const note of notes) {
    const later = looks.filter((l) => l.week === note.week).flatMap((l) => l.people.filter((p) => p.name === note.name));
    if (!later.length) continue;
    notesSeen++;
    if (later.some((p) => p.memory.some((line) => uncounted(line) === note.note))) notesKept++;
  }

  const perWeek = Array.from({ length: weeks }, () => 0);
  for (const e of events) if ((e.kind === 'answer' || e.kind === 'wait') && e.week >= 1 && e.week <= weeks) perWeek[e.week - 1]!++;
  const decided = perWeek.reduce((a, b) => a + b, 0);

  const moments = events.filter((e) => e.kind === 'moment');
  let longestSameKind = 0;
  let streak = 0;
  moments.forEach((m, i) => {
    const prev = moments[i - 1];
    streak = prev && kindOf(prev.title, prev.situation) === kindOf(m.title, m.situation) ? streak + 1 : 1;
    longestSameKind = Math.max(longestSameKind, streak);
  });
  const lastShown = new Map<string, number>();
  let situationRepeats = 0;
  for (const m of moments) {
    if (!m.situation) continue;
    const last = lastShown.get(m.title);
    if (last !== undefined && m.week - last <= REPEAT_WEEKS) situationRepeats++;
    lastShown.set(m.title, m.week);
  }
  const reactions = answers.map((a) => a.reaction?.trim() ?? '').filter(Boolean);

  return {
    seed,
    ending,
    weeks,
    minutes: seconds / 60,
    promotedAtMinutes,
    trace: { quits, lowRatings, overdue, burnout },
    choices: { answered: answers.length, withChip: share(answers.filter((a) => a.chips.length).length, answers.length), notesKept: share(notesKept, notesSeen), unanswered },
    shape: {
      decisions: { mean: weeks ? decided / weeks : 0, fewest: weeks ? Math.min(...perWeek) : 0, most: weeks ? Math.max(...perWeek) : 0, weeksWithNone: weeks ? perWeek.filter((n) => !n).length / weeks : 0 },
      longestSameKind,
      situationRepeats,
      distinctReactions: share(new Set(reactions).size, reactions.length),
    },
    ratings,
  };
}

// @spec PLAY-PROMO-003, PLAY-TRACE-005, PLAY-CHOICE-001, PLAY-SKILL-001
export function scorecard(player: string, runs: RunCard[]): Scorecard {
  const events = <T extends { warned: boolean }>(pick: (r: RunCard) => T[]) => {
    const all = runs.flatMap(pick);
    return share(all.filter((x) => x.warned).length, all.length);
  };
  const ratings = runs.flatMap((r) => r.ratings);
  const reactionFailures = runs.flatMap((r) => r.choices.unanswered.map((u) => `seed ${r.seed}, week ${u.week}: ${u.title} had no reaction`));
  return {
    player,
    runs,
    promotion: {
      withinSession: share(runs.filter((r) => r.promotedAtMinutes !== null && r.promotedAtMinutes <= SESSION_MINUTES).length, runs.length) ?? 0,
      target: TARGET_PROMOTED_SHARE,
      sessionMinutes: SESSION_MINUTES,
    },
    trace: {
      quits: events((r) => r.trace.quits),
      lowRatings: events((r) => r.trace.lowRatings),
      overdue: events((r) => r.trace.overdue),
      burnout: events((r) => (r.trace.burnout ? [r.trace.burnout] : [])),
    },
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    checks: [
      { id: 'PLAY-CHOICE-001', name: 'Every answered moment had a reaction at once', passed: !reactionFailures.length, failures: reactionFailures },
    ],
  };
}

const pct = (x: number | null) => (x === null ? 'n/a' : `${Math.round(x * 100)}%`);
const num = (x: number | null, digits = 1) => (x === null ? 'n/a' : x.toFixed(digits));

/** The scorecard as a table for the terminal, under the HLD's success-metric headings. */
// @spec PLAY-CARD-001
export function formatScorecard(card: Scorecard): string {
  const out: string[] = [`Success metrics: ${card.player}, ${card.runs.length} runs`];
  for (const r of card.runs) out.push(`  seed ${r.seed}  ${r.ending ?? 'no ending'}  ${r.weeks} weeks, ${num(r.minutes, 0)} estimated minutes`);
  out.push('', 'A promotion in the first session');
  out.push(`  promoted within ${card.promotion.sessionMinutes} minutes: ${pct(card.promotion.withinSession)} of runs (target ${pct(card.promotion.target)})`);
  for (const r of card.runs) out.push(`  seed ${r.seed}: ${r.promotedAtMinutes === null ? 'not promoted' : `promoted at ${num(r.promotedAtMinutes, 0)} minutes`}`);
  out.push('', 'Bad outcomes can be traced');
  const quits = card.runs.flatMap((r) => r.trace.quits);
  out.push(`  quits with a warning: ${quits.filter((q) => q.warned).length} of ${quits.length} (${pct(card.trace.quits)})`);
  for (const r of card.runs) for (const q of r.trace.quits.filter((x) => !x.warned)) out.push(`    seed ${r.seed}: ${q.name} quit with no warning on their card`);
  out.push(`  low ratings with a warning: ${pct(card.trace.lowRatings)}; overdue projects: ${pct(card.trace.overdue)}; burnout warnings: ${pct(card.trace.burnout)}`);
  out.push('', 'Choices feel consequential');
  for (const r of card.runs) out.push(`  seed ${r.seed}: ${r.choices.answered} answered, ${pct(r.choices.withChip)} with a chip, ${pct(r.choices.notesKept)} of notes still on the card two weeks later`);
  out.push('', 'The shape of a session');
  for (const r of card.runs) {
    const d = r.shape.decisions;
    out.push(`  seed ${r.seed}: ${num(d.mean)} decisions a week (${d.fewest} to ${d.most}), ${pct(d.weeksWithNone)} of weeks with none, longest run of one kind ${r.shape.longestSameKind}, ${r.shape.situationRepeats} situation repeats within ${REPEAT_WEEKS} weeks, ${pct(r.shape.distinctReactions)} distinct reactions`);
  }
  out.push('', 'Skill can be learned', `  average review rating: ${num(card.averageRating, 2)} (below 0 to outstanding 4)`);
  out.push('', 'Hard checks');
  for (const c of card.checks) {
    out.push(`  ${c.id.padEnd(16)}${c.passed ? 'passed' : 'FAILED'}  ${c.name}`);
    for (const f of c.failures) out.push(`    ${f}`);
  }
  return out.join('\n');
}
