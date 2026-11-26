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

const WORSE_MOTIVATION = new Set(['struggling', 'flat']);
const WORSE_STRESS = new Set(['strained', 'overwhelmed']);
const AT_RISK = new Set(['elevated', 'high', 'severe']);
const TIRED = new Set(['tired', 'running on fumes']);
const LOW_RATINGS = new Set(['partial', 'below']);
const RATING_SCORES: Record<string, number> = { below: 0, partial: 1, meets: 2, exceeds: 3, outstanding: 4 };

/**
 * The titles of the line manager's own moments; any other moment there is a situation. A moment's kind is its title
 * before the colon, and work items are titled by their kind in lower case ("release approval").
 */
export const LINE_TITLES = /^(Check-in|Night page|Interview|Design review|Customer request|New work|Final evaluation|Onboarding|release approval|expense approval|work intake|Work$)/i;
/** The senior manager's own moments, by kind, recognised from the fixed wording around the names their titles carry. */
export const SENIOR_TITLES: readonly (readonly [string, RegExp])[] = [
  ['Escalation', / needs help$/],
  ['Staffing request', /^A staffing request$/],
  ['Dispute', / disagree$/],
  ['Approval', / asks for an approval$/],
  ['New work', /^New work for the group/],
  ['A fourth team', /^A fourth team$/],
  ['Replacing a manager', / needs a manager$/],
  ['Calibration', /^Calibration$/],
  ['Skip-level problem', /^What .+ told you$/],
  ['Final evaluation', /^Final evaluation: /],
];
/** The director's own moments, by kind, recognised in the same way. */
export const DIRECTOR_TITLES: readonly (readonly [string, RegExp])[] = [
  ['Final evaluation', /^Final evaluation: /],
  ['New senior manager', / needs a senior manager$/],
  ['Headcount', /^Headcount for the quarter$/],
  ['Strategy bets', /^Strategy bets$/],
  ['Listening-tour problem', /^What .+ told you$/],
  ['Group in trouble', / is in trouble$/],
  ['Peer ask', / needs something$/],
  ['Org design', / is small$| has grown large$/],
  ['Quarterly review', /^The quarterly review$/],
];

export const VP_TITLES: readonly (readonly [string, RegExp])[] = [
  ['Final evaluation', /^Final evaluation: /],
  ['New director', / needs a director$/],
  ['Annual planning', /^Annual planning$/],
  ['Company priority', /^The company priority$/],
  ['Cuts', /^The company asks for cuts$/],
  ['Leadership dispute', / disagrees$/],
  ['Directors at odds', /^Two directors at odds$/],
  ['All-hands', /^The all-hands$/],
];

/** The career level a screen belongs to, as the playtests tell them apart. */
export type Level = 'line' | 'senior' | 'director' | 'vp';
export const LEVEL_NAMES: Record<Level, string> = { line: 'line manager', senior: 'senior manager', director: 'director', vp: 'VP' };

/** A moment's kind, if it is one of the career level's own moments, or null for a situation. */
// @spec PLAY-SHAPE-002
export function momentKind(title: string, level: Level): string | null {
  if (level === 'senior') return SENIOR_TITLES.find(([, re]) => re.test(title))?.[0] ?? null;
  if (level === 'director') return DIRECTOR_TITLES.find(([, re]) => re.test(title))?.[0] ?? null;
  if (level === 'vp') return VP_TITLES.find(([, re]) => re.test(title))?.[0] ?? null;
  return LINE_TITLES.test(title) ? title.split(':')[0]! : null;
}

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
  | { kind: 'moment'; week: number; title: string; level: Level }
  /** The panels a week showed beside the scene, by heading, and the habits it offered, by label without a person's name. */
  | { kind: 'layout'; level: Level; panels: string[]; habits: string[] }
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
  /** For a run promoted into a second career level: what stopped appearing at the promotion, and what started. */
  jobs: Job[];
}

/** What a promotion changed: what the level left showed and the level reached did not, and the other way round. */
export interface Job {
  from: Level;
  to: Level;
  gone: JobParts;
  came: JobParts;
}

export interface JobParts {
  panels: string[];
  habits: string[];
  moments: string[];
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
  jobs: { from: Level; to: Level; runs: number; gone: JobCounts; came: JobCounts }[];
  checks: Check[];
}

export type JobCounts = Record<keyof JobParts, { name: string; runs: number }[]>;

const share = (part: number, whole: number) => (whole ? part / whole : null);
const isLook = (e: PlayEvent): e is Look => e.kind === 'look';
const worse = (p: Look['people'][number]) => WORSE_MOTIVATION.has(p.motivation) || WORSE_STRESS.has(p.stress);
/** A memory line without the count the card adds to a repeated note ("Took on a design review, twice"). */
const uncounted = (line: string) => line.replace(/, (twice|\d+ times)$/, '');
/** A moment's kind for a run of moments: the level's own kind, or each situation a kind of its own. */
const kindOf = (m: { title: string; level: Level }) => momentKind(m.title, m.level) ?? `situation:${m.title}`;
const isSituation = (m: { title: string; level: Level }) => momentKind(m.title, m.level) === null;
const PARTS = ['panels', 'habits', 'moments'] as const;
const PROMOTIONS: [Level, Level][] = [['line', 'senior'], ['senior', 'director'], ['director', 'vp']];
const byCodeUnits = (a: string, b: string) => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};
const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort(byCodeUnits);

/** What the page showed at each level, and for each promotion the run reached, the difference between the two levels. */
// @spec PLAY-JOB-001
function jobsOf(events: PlayEvent[]): Job[] {
  const at = (level: Level): JobParts => {
    const layouts = events.filter((e) => e.kind === 'layout' && e.level === level) as Extract<PlayEvent, { kind: 'layout' }>[];
    const moments = events.filter((e) => e.kind === 'moment' && e.level === level) as Extract<PlayEvent, { kind: 'moment' }>[];
    return {
      panels: sorted(layouts.flatMap((l) => l.panels)),
      habits: sorted(layouts.flatMap((l) => l.habits)),
      moments: sorted(moments.map((m) => momentKind(m.title, m.level)).filter((k): k is string => k !== null)),
    };
  };
  // The levels in the order the run reached them.
  const levels: Level[] = [];
  for (const e of events) if (e.kind === 'layout' && levels.at(-1) !== e.level) levels.push(e.level);
  const minus = (a: JobParts, b: JobParts): JobParts => ({ panels: a.panels.filter((x) => !b.panels.includes(x)), habits: a.habits.filter((x) => !b.habits.includes(x)), moments: a.moments.filter((x) => !b.moments.includes(x)) });
  return levels.slice(1).map((to, i) => {
    const from = levels[i]!;
    const [before, after] = [at(from), at(to)];
    return { from, to, gone: minus(before, after), came: minus(after, before) };
  });
}

/** The looks recorded before event `index`, in its window ending at `week`. */
function windowBefore(events: PlayEvent[], index: number, week: number): Look[] {
  return events.slice(0, index).filter(isLook).filter((l) => l.week > week - WINDOW_WEEKS && l.week <= week);
}

/** What scoreRun gathers from the events in one pass, in the order they were recorded. */
interface Tally {
  seconds: number;
  promotedAtMinutes: number | null;
  ending: string | null;
  left: { name: string; reason: string }[];
  weeks: number;
  lowRatings: RunCard['trace']['lowRatings'];
  overdue: RunCard['trace']['overdue'];
  burnout: RunCard['trace']['burnout'];
  ratings: number[];
}

type EventOf<K extends PlayEvent['kind']> = Extract<PlayEvent, { kind: K }>;

/** A review: when the run was first promoted, its score, and whether a low rating had a warning in the window before it. */
function tallyReview(t: Tally, events: PlayEvent[], e: EventOf<'review'>, i: number) {
  if (e.promoted && t.promotedAtMinutes === null) t.promotedAtMinutes = t.seconds / 60;
  const score = RATING_SCORES[e.rating];
  if (score !== undefined) t.ratings.push(score);
  if (!LOW_RATINGS.has(e.rating)) return;
  const warned = windowBefore(events, i, e.week).some((l) => l.projects.some((p) => p.schedule === 'behind' || p.schedule === 'overdue') || l.people.some(worse));
  t.lowRatings.push({ week: e.week, warned });
}

/** A look: each project's first week overdue and the run's first burnout warning, each with whether it was warned of. */
function tallyLook(t: Tally, events: PlayEvent[], e: EventOf<'look'>, i: number) {
  for (const project of e.projects) {
    if (project.schedule !== 'overdue' || t.overdue.some((o) => o.name === project.name)) continue;
    const earlier = windowBefore(events, i, e.week).flatMap((l) => l.projects.filter((p) => p.name === project.name));
    t.overdue.push({ name: project.name, week: e.week, warned: earlier.some((p) => p.schedule === 'behind' || AT_RISK.has(p.risk)) });
  }
  if (e.burnout && !t.burnout) t.burnout = { week: e.week, warned: windowBefore(events, i, e.week).some((l) => TIRED.has(l.energy)) };
}

function tallyEvent(t: Tally, events: PlayEvent[], e: PlayEvent, i: number) {
  if ('week' in e) t.weeks = Math.max(t.weeks, e.week);
  switch (e.kind) {
    case 'read':
      t.seconds += (e.words / CLOCK.wordsPerMinute) * 60;
      break;
    case 'click':
      t.seconds += e.decision ? CLOCK.decisionSeconds : CLOCK.clickSeconds;
      break;
    case 'review':
      tallyReview(t, events, e, i);
      break;
    case 'look':
      tallyLook(t, events, e, i);
      break;
    case 'ended':
      t.ending = e.ending;
      t.left = e.left;
      break;
  }
}

/** Of the notes answers left on a card, how many were on screen two weeks later, and how many of those the card still showed. */
function notesKeptOf(notes: { name: string; note: string; week: number }[], looks: Look[]) {
  let notesSeen = 0;
  let notesKept = 0;
  for (const note of notes) {
    const later = looks.filter((l) => l.week === note.week).flatMap((l) => l.people.filter((p) => p.name === note.name));
    if (!later.length) continue;
    notesSeen++;
    if (later.some((p) => p.memory.some((line) => uncounted(line) === note.note))) notesKept++;
  }
  return { notesSeen, notesKept };
}

// @spec PLAY-CLOCK-001, PLAY-CLOCK-002, PLAY-CLOCK-003, PLAY-PROMO-001, PLAY-PROMO-002, PLAY-TRACE-001, PLAY-TRACE-002
// @spec PLAY-TRACE-003, PLAY-TRACE-004, PLAY-CHOICE-001, PLAY-CHOICE-002, PLAY-CHOICE-003, PLAY-SHAPE-001
// @spec PLAY-SHAPE-002, PLAY-SHAPE-003, PLAY-SHAPE-004
export function scoreRun(seed: number, events: PlayEvent[]): RunCard {
  const t: Tally = { seconds: 0, promotedAtMinutes: null, ending: null, left: [], weeks: 0, lowRatings: [], overdue: [], burnout: null, ratings: [] };
  events.forEach((e, i) => tallyEvent(t, events, e, i));
  const { seconds, promotedAtMinutes, ending, left, weeks, lowRatings, overdue, burnout, ratings } = t;

  const looks = events.filter(isLook);
  const quits = left
    .filter((p) => p.reason === 'quit')
    .map(({ name }) => {
      const seen = looks.filter((l) => l.people.some((p) => p.name === name));
      const lastWeeks = new Set([...new Set(seen.map((l) => l.week))].slice(-WINDOW_WEEKS));
      const warned = seen.filter((l) => lastWeeks.has(l.week)).some((l) => l.people.some((p) => p.name === name && worse(p)));
      return { name, warned };
    });

  const answers = events.filter((e) => e.kind === 'answer');
  const unanswered = answers.filter((a) => !a.reaction?.trim()).map((a) => ({ week: a.week, title: a.title }));
  const notes = answers.flatMap((a) => a.notes.map((n) => ({ ...n, week: a.week + NOTE_WEEKS_LATER })));
  const { notesSeen, notesKept } = notesKeptOf(notes, looks);

  const perWeek = Array.from({ length: weeks }, () => 0);
  for (const e of events) if ((e.kind === 'answer' || e.kind === 'wait') && e.week >= 1 && e.week <= weeks) perWeek[e.week - 1]!++;
  const decided = perWeek.reduce((a, b) => a + b, 0);

  const moments = events.filter((e) => e.kind === 'moment');
  let longestSameKind = 0;
  let streak = 0;
  moments.forEach((m, i) => {
    const prev = moments[i - 1];
    streak = prev && kindOf(prev) === kindOf(m) ? streak + 1 : 1;
    longestSameKind = Math.max(longestSameKind, streak);
  });
  const lastShown = new Map<string, number>();
  let situationRepeats = 0;
  for (const m of moments) {
    if (!isSituation(m)) continue;
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
    jobs: jobsOf(events),
  };
}

/** Each item that stopped or started appearing at one promotion across the runs, with the number of runs, most first. */
// @spec PLAY-JOB-002
function jobCounts(jobs: Job[], side: 'gone' | 'came'): JobCounts {
  const count = (part: keyof JobParts) => {
    const n = new Map<string, number>();
    for (const j of jobs) for (const x of j[side][part]) n.set(x, (n.get(x) ?? 0) + 1);
    return [...n].map(([name, runs]) => ({ name, runs })).sort((a, b) => b.runs - a.runs);
  };
  return { panels: count('panels'), habits: count('habits'), moments: count('moments') };
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
    jobs: PROMOTIONS.flatMap(([from, to]) => {
      const jobs = runs.flatMap((r) => r.jobs.filter((j) => j.from === from && j.to === to));
      return jobs.length ? [{ from, to, runs: jobs.length, gone: jobCounts(jobs, 'gone'), came: jobCounts(jobs, 'came') }] : [];
    }),
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
  const promoted = (r: RunCard) => (r.promotedAtMinutes === null ? 'not promoted' : 'promoted at ' + num(r.promotedAtMinutes, 0) + ' minutes');
  out.push(
    '',
    'A promotion in the first session',
    `  promoted within ${card.promotion.sessionMinutes} minutes: ${pct(card.promotion.withinSession)} of runs (target ${pct(card.promotion.target)})`,
    ...card.runs.map((r) => `  seed ${r.seed}: ${promoted(r)}`),
  );
  const quits = card.runs.flatMap((r) => r.trace.quits);
  out.push('', 'Bad outcomes can be traced', `  quits with a warning: ${quits.filter((q) => q.warned).length} of ${quits.length} (${pct(card.trace.quits)})`);
  for (const r of card.runs) for (const q of r.trace.quits.filter((x) => !x.warned)) out.push(`    seed ${r.seed}: ${q.name} quit with no warning on their card`);
  out.push(`  low ratings with a warning: ${pct(card.trace.lowRatings)}; overdue projects: ${pct(card.trace.overdue)}; burnout warnings: ${pct(card.trace.burnout)}`, '', 'Choices feel consequential');
  for (const r of card.runs) out.push(`  seed ${r.seed}: ${r.choices.answered} answered, ${pct(r.choices.withChip)} with a chip, ${pct(r.choices.notesKept)} of notes still on the card two weeks later`);
  out.push('', 'The shape of a session');
  for (const r of card.runs) {
    const d = r.shape.decisions;
    out.push(`  seed ${r.seed}: ${num(d.mean)} decisions a week (${d.fewest} to ${d.most}), ${pct(d.weeksWithNone)} of weeks with none, longest run of one kind ${r.shape.longestSameKind}, ${r.shape.situationRepeats} situation repeats within ${REPEAT_WEEKS} weeks, ${pct(r.shape.distinctReactions)} distinct reactions`);
  }
  out.push('', 'Promotion changes the job', ...jobLines(card), '', 'Skill can be learned', `  average review rating: ${num(card.averageRating, 2)} (below 0 to outstanding 4)`, '', 'Hard checks');
  for (const c of card.checks) out.push(`  ${c.id.padEnd(16)}${c.passed ? 'passed' : 'FAILED'}  ${c.name}`, ...c.failures.map((f) => `    ${f}`));
  return out.join('\n');
}

/** For each promotion the runs made, the panels, habits and moments that went and came, with how many runs saw each. */
function jobLines(card: Scorecard): string[] {
  const items = (xs: { name: string; runs: number }[]) => (xs.length ? xs.map((x) => `${x.name} (${x.runs})`).join(', ') : 'none');
  if (!card.jobs.length) return ['  no run was promoted'];
  return card.jobs.flatMap((j) => [
    `  ${LEVEL_NAMES[j.from]} to ${LEVEL_NAMES[j.to]}: ${j.runs} of ${card.runs.length} runs`,
    ...PARTS.flatMap((part) => [`    ${part}, no longer: ${items(j.gone[part])}`, `    ${part}, new: ${items(j.came[part])}`]),
  ]);
}
