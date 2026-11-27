import { apply, newRun, weeksToReview, type AnyLevel, type Command, type Dependencies, type Run, type WeekMoment } from '../loop';
import { promisesAt } from '../levels/promises';
import { MAX_SAVE_BYTES, contentFingerprint, parseSave, restore, toSave } from '../save';
import type { ContentError, Situation } from '../situations';
import type { Standing, TowardPromotion } from '../review';
import { bandWord } from './bands';
import { h, type Child } from './dom';
import { HELP_OPEN_THROUGH_WEEK } from './help';
import { lineManagerRenderer } from './line-manager';
import { seniorManagerRenderer } from './senior-manager';
import { directorRenderer } from './director';
import { vpRenderer } from './vp';
import { band } from '../levels/line-manager';
import { emphasis } from './text';

export interface AppOptions {
  content: Situation[];
  contentErrors: ContentError[];
  /** True in the development build, so authors see content errors and players do not. */
  showContentErrors: boolean;
  deps: Dependencies;
  newSeed: () => number;
  /** The version the build stamped, shown on the start screen. */
  version: string;
  /** Start on an existing run instead of the start screen. */
  run?: Run;
  /** Where the run is saved (the browser's localStorage in the game). Without it, the game plays without saving. */
  storage?: SaveStorage;
  /** Calls back with the key when another tab changes storage (null when it cleared everything); the browser's storage event in the game. */
  watchStorage?: (listener: (key: string | null) => void) => void;
}

/** The part of the browser's Storage the app uses. */
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const SAVE_KEY = 'manager-simulator.save';

/** The start screen's pitch: the whole climb, not only the level that can be played today. */
const PITCH =
  'Start with a team of five engineers and a pager. Earn your way to managing managers, then a whole organization, and learn a new job at every step.';

/** A rung of the start screen's career ladder, and the level modules it stands for (none listed: any other level). */
interface Rung {
  level: string;
  manages: string;
  turn: string;
  levels?: string[];
}

/** The career ladder, from where a run starts upward (the HLD's career levels). */
const LADDER: Rung[] = [
  { level: 'Line manager', manages: 'a team of five engineers', turn: 'a week', levels: ['line-manager'] },
  { level: 'Senior manager', manages: 'several teams, through their managers', turn: 'a month', levels: ['senior-manager'] },
  // Director and above may span several levels (director, VP): any level module the lower rungs don't name.
  { level: 'Director and above', manages: 'an organization', turn: 'a quarter' },
];
const LOWER_RUNG_LEVELS = new Set(LADDER.flatMap((r) => r.levels ?? []));

/** The game is not open source: the year is that of first publication. */
const COPYRIGHT = '© 2026 Twelve Chairs Software. All rights reserved.';

/** What the start screen says the game is not (the HLD's non-goals, on the page). */
export const DISCLAIMER =
  "Manager Simulator is a game. Its people, companies and situations are fictional, and its outcomes are simplified for play. It is not management, career, legal or HR advice; don't use it to make real decisions about real people.";

export type AppState = { screen: 'start'; seed: number } | { screen: 'run'; run: Run };

/** How a send is followed up: whether focus stays on the control, and what to do once the command applies. */
export interface SendOptions {
  /** Keep focus on the control that sent it, rather than moving it to the scene (a habit change). */
  keepFocus?: boolean;
  onApplied?: () => void;
}

/** What a screen needs from the app: the run, a way to send a command, and the error for a control. */
export interface ScreenContext {
  run: Run;
  deps: Dependencies;
  /** The active level's view of the run, computed once per redraw. */
  view: unknown;
  /** Sends a command; `control` names where to show an error if the loop refuses it. */
  send: (command: Command, control: string, options?: SendOptions) => void;
  /** The error message for a control, if its last command was refused. */
  errorFor: (control: string) => Child;
  /** Page state that survives a redraw, by key. */
  drafts: Map<string, Record<string, string>>;
  /** Redraws the page, for a control that changes only page state (a calibration move). */
  refresh: () => void;
}

/** A change chip: what moved, said in words, and whether it is good or bad for the player. */
export interface Chip {
  key: string;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

/** A level's moment as the scene shows it. */
export interface MomentDetails {
  title: string;
  text: string;
  /** Anything the level shows under the text, such as the work's difficulty. */
  detail?: Child;
  choices: { id: string; label: string; note?: string }[];
}

/** What a career level contributes to the week screen. */
export interface LevelRenderer {
  panels(ctx: ScreenContext): Child;
  /** The habit controls for Before Monday, each with a line on what it does. */
  habits(ctx: ScreenContext): Child;
  moment(ctx: ScreenContext, momentId: string): MomentDetails | undefined;
  /** Chips for a choice's effects, from the level's view before and after; `rose` says whether a person's stress rose under the bands. */
  chips(before: unknown, after: unknown, rose?: (personId: string) => boolean): Chip[];
  /** The level's part of the recap: what changed, shown at once, and the routine, folded into The whole week. */
  recap(run: Run, recap: unknown): { changes: Child; routine: Child };
  status(view: unknown): { energy: number; reputation: number; goals: { id: string; text: string; progress: string }[]; edge?: { at: boolean; weeks: number; limit: number } };
  /** A measure's name on the review screen, when the level names it (a goal by its text). */
  measureName(view: unknown, id: string): string | undefined;
  /** A measure's value in words on the review screen, when the level knows the measure. */
  measureValue(view: unknown, id: string, value: number): string | undefined;
  /** What moves one of the level's measures, for the review to say beside a measure that held the rating back. */
  measureLever(id: string): string | undefined;
  /** The level's lines of the career summary at the end of a run. */
  career(view: unknown): Child;
  /** The level's turn: a week, a month or a quarter. */
  turn: Turn;
  /** For a level reached by promotion: the handover's question and how it describes the outside hire. */
  handover?: { question: (team: string) => string; hire: string; trade: string };
  /** The level's How to play topics. */
  help: readonly { id: string; title: string; text: string }[];
  /** The scene before the level's first turn: where it is set, its heading and its line. */
  firstTurn: { where: string; heading: string; intro: string };
  /** The review's outcome and the run's ending for staying at the level. */
  stayed: { outcome: string; ending: string };
}

export type Turn = 'week' | 'month' | 'quarter';
/** Weeks in each kind of turn. */
const STEP: Record<Turn, number> = { week: 1, month: 4, quarter: 13 };

const RENDERERS: Record<string, LevelRenderer> = { 'line-manager': lineManagerRenderer, 'senior-manager': seniorManagerRenderer, director: directorRenderer, vp: vpRenderer };

/** What the handover screen calls the level a promotion leads to. */
const LEVEL_NAMES: Record<string, string> = { 'line-manager': 'line manager', 'senior-manager': 'senior manager', director: 'director', vp: 'VP' };
/** The run's current level by name. */
const levelName = (run: Run) => LEVEL_NAMES[run.levelId] ?? run.levelId;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
/** Where in the turn a moment falls: its day and time, and in a month or a quarter its week (UI-WEEK-016). */
const when = (m: { day: number; time: string }, turn: Turn = 'week') =>
  turn !== 'week' ? `Week ${Math.floor(m.day / 5) + 1}, ${DAYS[m.day % 5] ?? ''} ${m.time}` : `${DAYS[m.day] ?? ''} ${m.time}`;
const capital = (word: string) => word[0]!.toUpperCase() + word.slice(1);
const NUMBER_WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six' };

/** The reaction to the player's last choice, waiting to be read; only the page remembers it. */
interface Reaction {
  momentId: string;
  chips: Chip[];
  passed: WeekMoment[];
}

const OUTCOMES = {
  continue: 'You are continuing in your role.',
  promote: 'You are being promoted.',
  managedOut: 'You are being managed out.',
} as const;

const VERDICTS = { above: 'above target', at: 'on target', below: 'below target' } as const;

/** Where the player stands toward promotion, in words; nothing once the review promotes or ends the run. */
const COUNTS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const TOWARD_PROMOTION: Record<'oneMore' | 'twoInARow' | 'outOfTime', (reviewsLeft: number) => string> = {
  oneMore: (left) => `One more review rated exceeds or better and you'll be promoted.${left === 1 ? " It's your last review at this level." : ''}`,
  twoInARow: (left) => `Promotion takes two reviews in a row rated exceeds or better, and ${COUNTS[left] ?? left} are left at this level.`,
  outOfTime: () => "There aren't enough reviews left at this level for a promotion.",
};
/** Where the player stands toward promotion, as the review screen and the header say it. */
function towardPromotionLine(p: TowardPromotion): string | null {
  if (p.kind === 'notOpenYet') return `Promotion opens in ${p.reviews} reviews, then takes two in a row rated exceeds or better.`;
  if (p.kind === 'promoted' || p.kind === 'ended') return null;
  return TOWARD_PROMOTION[p.kind]('reviewsLeft' in p ? p.reviewsLeft : 0);
}

/** What each kind of handover choice costs the team the player leaves as a line manager. */
const HANDOVER_TRADE =
  'Someone from the team leaves it an engineer short, and starts out learning the job unless they trust you and want to grow. An outside hire keeps every engineer, but a stranger in charge unsettles the team at first.';

const PLAN_NEXT = {
  coaching: 'One more review rated partial or below puts you on an improvement plan.',
  pip: "One more review rated partial or below and you'll be managed out.",
} as const;

/** Names joined as a sentence lists them: "a", "a and b", "a, b and c". */
const listed = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

/** What kept a rating from exceeds, or that nothing was below target. */
function heldBackLine(ids: string[], name: (id: string) => string): string {
  if (ids.length === 0) return 'Every measure was on target or better; exceeds takes more of them above target.';
  return `What kept this from exceeds: ${listed(ids.map(name))}.`;
}

/** The standing's words: margins, the way to promotion, what held the rating back and what moves it, and the plan's next step. */
// @spec UI-REVIEW-002, UI-REVIEW-003
function standingLines(s: Standing, name: (id: string) => string, lever: (id: string) => string | undefined): Child[] {
  const p = s.promotion;
  const toward = towardPromotionLine(p);
  const held = s.heldBack ? heldBackLine(s.heldBack, name) : null;
  const levers = (s.heldBack ?? []).flatMap((id) => {
    const what = lever(id);
    return what ? [h('li', { 'data-lever': id }, `${name(id)}: ${what}.`)] : [];
  });
  return [
    s.marginUp ? h('p', { class: 'margin', 'data-field': 'margin' }, `One measure a step better would have made it ${s.marginUp}.`) : null,
    s.marginDown ? h('p', { class: 'margin', 'data-field': 'margin' }, `One measure a step worse would have made it ${s.marginDown}.`) : null,
    toward ? h('p', { class: 'standing', 'data-field': 'promotion' }, toward) : null,
    held ? h('p', { class: 'standing', 'data-field': 'held-back' }, held) : null,
    levers.length ? h('ul', { class: 'standing', 'data-field': 'levers' }, levers) : null,
    s.plan ? h('p', { class: 'standing plan', 'data-field': 'plan' }, PLAN_NEXT[s.plan]) : null,
  ];
}

/** What happened to a situation, in the words the recap uses. */
const DEBRIEF_STATUS = { resolved: 'You dealt with it', ignored: 'You let it wait', expired: 'It passed before you got to it' } as const;

/** What happened to a moment that was not answered, as the recap says it. */
const MOMENT_OUTCOMES: Partial<Record<WeekMoment['status'], string>> = { waited: 'You let it wait.', expired: 'It passed.' };

/** A debrief's lesson: the situation's own when it was dealt with, its lesson for waiting when it was let wait and has one. */
function debriefLesson(d: { status: string; situationId: string; debrief?: string }, waitDebriefs: ReadonlyMap<string, string>): Child {
  if (d.status === 'resolved') return h('p', { 'data-field': 'text' }, d.debrief ?? '');
  return d.status === 'ignored' && waitDebriefs.has(d.situationId) ? h('p', { 'data-field': 'text' }, waitDebriefs.get(d.situationId)) : null;
}

const ENDINGS = {
  managedOut: 'You were managed out after failing your improvement plan.',
  completed: 'You were promoted past the top of the ladder. You won.',
} as const;

/** How the run ended, in a sentence: staying at the level, burning out after so many turns at the edge, or the other endings. */
function endingLine(run: Run, renderer: LevelRenderer, view: unknown): string {
  if (run.ending === 'stayed') return renderer.stayed.ending;
  if (run.ending === 'burnout') return `You burned out. ${capital(NUMBER_WORDS[renderer.status(view).edge?.limit ?? 4] ?? 'Too many')} ${renderer.turn}s at the edge was too long.`;
  return run.ending ? ENDINGS[run.ending] : '';
}

/** Mounts the game in `root` and redraws it from the run after every command. */
// @spec UI-SHELL-001, UI-SHELL-002, UI-SHELL-003, UI-SHELL-004, UI-CONTENT-001
export function createApp(root: HTMLElement, options: AppOptions) {
  // The start screen's seed is drawn only once it is known no saved run will be resumed.
  let state: AppState = options.run ? { screen: 'run', run: options.run } : { screen: 'start', seed: 0 };
  let error: { control: string; message: string } | null = null;
  /** A message about saving or loading, shown until the player's next command. */
  let notice: string | null = null;
  let warnedStorage = false;
  /** Another tab has written or removed the save since this tab last did: this tab's run is no longer the saved one. */
  let otherTab = false;
  const drafts = new Map<string, Record<string, string>>();
  // Where the player is looking, kept only on the page (UI-WEEK-009): a reload never shows a reaction again.
  let reaction: Reaction | null = null;
  /** The level start week of the first turn the player has started from its opening scene. */
  let startedFirstTurn: number | null = null;
  let closedRecapWeek: number | null = null;
  /** Whether the player last left the recap's The whole week open; unset until they open or close it. Page state, never saved. */
  let wholeWeekOpen: boolean | undefined;
  let focusScene = false;
  /** Forgets where the player was looking, for a run that has just begun or been loaded. */
  const resetPage = () => {
    reaction = null;
    startedFirstTurn = null;
    closedRecapWeek = null;
    drafts.clear();
  };
  const titles = new Map(options.content.map((s) => [s.id, s.title]));
  const waitDebriefs = new Map(options.content.flatMap((s) => (s.waitDebrief ? [[s.id, s.waitDebrief] as const] : [])));
  const fingerprint = contentFingerprint(options.content);

  /** Writes the run's save; a storage failure is reported once, and the game plays on unsaved. */
  // @spec UI-SAVE-002, UI-SAVE-005
  function save(run: Run) {
    if (!options.storage || otherTab) return;
    try {
      options.storage.setItem(SAVE_KEY, JSON.stringify(toSave(run, fingerprint)));
    } catch {
      // An older save left in place would be resumed on reload as if nothing had happened since.
      try {
        options.storage.removeItem(SAVE_KEY);
      } catch {
        // storage is entirely unavailable; there is nothing to remove
      }
      if (!warnedStorage) notice = 'Your progress cannot be saved in this browser, so this run will not be saved.';
      warnedStorage = true;
    }
  }

  /** Restores a save's text as the current run, or explains why not, leaving the current run as it was. */
  // @spec UI-SAVE-001, UI-SAVE-003, UI-SAVE-004, UI-SAVE-007
  function load(text: string, from: 'storage' | 'file'): boolean {
    const parsed = parseSave(text);
    if (!parsed.ok) {
      notice = from === 'storage' ? `Your saved run could not be loaded: ${parsed.error}.` : `That file could not be loaded: ${parsed.error}.`;
      return false;
    }
    // Restoring never throws by design (SAVE-RESTORE-004); this backstop keeps an unforeseen error from leaving the
    // page blank at startup or an imported file failing with no message.
    let restored: ReturnType<typeof restore>;
    try {
      restored = restore(parsed.save, options.content, options.deps, fingerprint);
    } catch {
      notice = from === 'storage' ? 'Your saved run could not be loaded: it could not be replayed.' : 'That file could not be loaded: it could not be replayed.';
      return false;
    }
    state = { screen: 'run', run: restored.run };
    error = null;
    resetPage();
    notice = restored.rebuilt
      ? `This run was rebuilt with the current version of the game: ${restored.applied} of ${restored.total} of its commands still applied.`
      : null;
    return true;
  }

  if (!options.run && options.storage) {
    let stored: string | null = null;
    try {
      stored = options.storage.getItem(SAVE_KEY);
    } catch {
      stored = null; // reported when the game first tries to save
    }
    if (stored !== null) load(stored, 'storage');
  }
  if (state.screen === 'start') state = { screen: 'start', seed: options.newSeed() };

  // Another tab saved over this one's run: stop here, so this tab neither overwrites the newer run nor plays on unsaved.
  // @spec UI-SAVE-010
  options.watchStorage?.((key) => {
    if (key !== null && key !== SAVE_KEY) return;
    otherTab = true;
    render();
  });

  /** Picks up the run as the other tab left it, or the start screen when it removed the save. */
  // @spec UI-SAVE-010
  function continueHere() {
    otherTab = false;
    notice = null;
    let stored: string | null = null;
    try {
      stored = options.storage?.getItem(SAVE_KEY) ?? null;
    } catch {
      stored = null;
    }
    if (stored === null || !load(stored, 'storage')) {
      state = { screen: 'start', seed: options.newSeed() };
      resetPage();
    }
    focusScene = true;
    render();
  }

  // @spec UI-SAVE-010
  const otherTabScreen = (): Child =>
    h(
      'section',
      { 'data-part': 'other-tab', 'data-screen': 'other-tab', class: 'start' },
      h('h1', { 'data-part': 'heading', tabindex: '-1' }, 'Playing in another tab'),
      h('p', { role: 'status' }, 'This run was played on in another tab, so this tab stopped saving to keep from overwriting it.'),
      h('button', { 'data-action': 'continue-here', class: 'primary', onClick: continueHere }, 'Continue here'),
    );

  // @spec UI-SAVE-006
  function exportSave(run: Run) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(toSave(run, fingerprint), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `manager-simulator-${run.seed}-week-${weekOnScreen(run)}.json`;
    // Some browsers start the download only once the link is in the document, and after click() returns, so the
    // URL is revoked on the next task rather than straight away.
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  /** Counts imports, so a file that finishes reading after a later choice does not replace it. */
  let importCount = 0;
  /** A file chosen over a run in progress, waiting for the player to confirm replacing the run. */
  let pendingImport: Pick<File, 'size' | 'text'> | null = null;
  let confirmingDiscard = false;

  /** Load a saved game: a button that opens the picker of a file input hidden behind it, the same on every screen. */
  // @spec UI-SAVE-009
  function loadControl(className?: string): Child {
    const input = h('input', {
      type: 'file',
      accept: '.json,application/json',
      hidden: true,
      'data-input': 'import',
      onChange: (e: Event) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (state.screen === 'run') {
          pendingImport = file;
          confirmingDiscard = false;
          render();
        } else startImport(file);
      },
    });
    return [h('button', { 'data-action': 'load', class: className, onClick: () => input.click() }, 'Load a saved game'), input];
  }

  function startImport(file: Pick<File, 'size' | 'text'>) {
    const thisImport = ++importCount;
    if (file.size > MAX_SAVE_BYTES) {
      notice = 'That file could not be loaded: it is too large to be a save.';
      render();
      return;
    }
    file.text().then(
      (text) => {
        if (thisImport !== importCount) return;
        if (load(text, 'file') && state.screen === 'run') save(state.run);
        render();
      },
      () => {
        if (thisImport !== importCount) return;
        notice = 'That file could not be read.';
        render();
      },
    );
  }

  // @spec UI-SAVE-008
  function saveArea(run: Run): Child {
    const discard = () => {
      try {
        options.storage?.removeItem(SAVE_KEY);
      } catch {
        // nothing stored to remove
      }
      state = { screen: 'start', seed: options.newSeed() };
      error = null;
      notice = null;
      confirmingDiscard = false;
      pendingImport = null;
      resetPage();
      render();
    };
    // Discarding and importing over a run each destroy its only saved copy, so both ask first.
    const confirmation = (): Child => {
      if (pendingImport) return h(
          'p',
          { class: 'confirm' },
          'Replace your current run with the imported file? ',
          h('button', { 'data-action': 'confirm-import', onClick: () => {
            const file = pendingImport!;
            pendingImport = null;
            startImport(file);
            render();
          } }, 'Yes, replace it'),
          h('button', { 'data-action': 'cancel-import', onClick: () => {
            pendingImport = null;
            render();
          } }, 'Cancel'),
        );
      if (!confirmingDiscard) return null;
      return h(
        'p',
        { class: 'confirm' },
        'Discard this run? It cannot be recovered unless you exported it. ',
        h('button', { 'data-action': 'confirm-discard', onClick: discard }, 'Yes, discard it'),
        h('button', { 'data-action': 'cancel-discard', onClick: () => {
          confirmingDiscard = false;
          render();
        } }, 'Cancel'),
      );
    };
    return h(
      'section',
      { 'data-panel': 'save', class: 'save' },
      h('button', { 'data-action': 'export', onClick: () => exportSave(run) }, 'Export save'),
      loadControl(),
      h('button', { 'data-action': 'discard', onClick: () => {
        confirmingDiscard = true;
        pendingImport = null;
        render();
      } }, 'Discard and start over'),
      confirmation(),
    );
  }

  /** The level and its renderer for the current run, if the game has them. */
  const levelOf = (run: Run) => {
    const level: AnyLevel | undefined = options.deps.levels.find((l) => l.params.id === run.levelId);
    const renderer = RENDERERS[run.levelId];
    return level && renderer ? { level, renderer } : undefined;
  };

  // @spec UI-WEEK-006, UI-WEEK-008
  function send(command: Command, control: string, sendOptions: SendOptions = {}) {
    if (state.screen !== 'run') return;
    const before = state.run;
    const result = apply(before, command, options.content, options.deps);
    if (result.ok) {
      state = { screen: 'run', run: result.run };
      error = null;
      notice = null;
      const found = levelOf(result.run);
      if (command.kind === 'answer' && found) {
        const after = result.run;
        const passed = after.week.filter((m) => m.status === 'expired' && m.id !== command.momentId && before.week.find((x) => x.id === m.id)?.status === 'open');
        // @spec UI-WEEK-019
        const rose = (id: string) => (after.sim.people[id]?.stress ?? 0) > (before.sim.people[id]?.stress ?? Number.POSITIVE_INFINITY);
        const chips = found.renderer.chips(found.level.view(before.level, before.sim), found.level.view(after.level, after.sim), rose);
        // @spec UI-WEEK-018
        // One choice rarely moves a band of energy; without this, doing it yourself would look free, at every level and in situations.
        if (after.sim.player.stress > before.sim.player.stress && !chips.some((c) => c.key === 'player:energy')) chips.push({ key: 'player:energy-spent', text: 'You: energy spent', tone: 'bad' });
        reaction = { momentId: command.momentId, chips, passed };
      } else if (command.kind !== 'plan') reaction = null;
      focusScene = !sendOptions.keepFocus;
      sendOptions.onApplied?.();
      save(result.run);
    } else {
      error = { control, message: result.error };
    }
    render();
  }

  /** Moves on without a command (Continue, Start the week, closing the recap), focusing the next scene. */
  function moveOn(change: () => void) {
    change();
    error = null;
    focusScene = true;
    render();
  }

  const errorFor = (control: string): Child =>
    error?.control === control ? h('p', { 'data-error': true, role: 'alert', class: 'error' }, error.message) : null;

  function contentErrors(): Child {
    // Checked at build time too, so the production bundle drops the panel rather than only switching it off.
    if (!import.meta.env.DEV || !options.showContentErrors || options.contentErrors.length === 0) return null;
    return h(
      'section',
      { 'data-panel': 'content-errors', class: 'content-errors' },
      h('h2', {}, 'Content errors'),
      h('ul', {}, options.contentErrors.map((e) => h('li', {}, `${e.situationId ?? '#' + String(e.index ?? '?')}: ${e.message}`))),
    );
  }

  /** The start screen. The seed is drawn here but never shown: it means nothing to a player, and travels in the save. */
  // @spec UI-SHELL-006, UI-SHELL-007, UI-SHELL-008, UI-SHELL-009, UI-SHELL-010, UI-SHELL-011, UI-SHELL-012
  function startScreen(seed: number) {
    const has = new Set(options.deps.levels.map((l) => l.params.id));
    const playable = (rung: Rung) => (rung.levels ? rung.levels.some((id) => has.has(id)) : [...has].some((id) => !LOWER_RUNG_LEVELS.has(id)));
    return h(
      'section',
      { 'data-screen': 'start', class: 'start' },
      h(
        'div',
        { class: 'start-pitch' },
        h('h1', {}, 'Manager Simulator'),
        h('p', { 'data-part': 'tagline', class: 'tagline' }, 'Every promotion is a new job.'),
        h('p', { 'data-part': 'pitch', class: 'pitch' }, PITCH),
        h('div', { class: 'start-actions' }, startButton(seed), loadControl('secondary')),
      ),
      h(
        'ol',
        { 'data-part': 'ladder', class: 'ladder', 'aria-label': 'The career ladder' },
        LADDER.map((rung) => {
          const open = playable(rung);
          return h(
            'li',
            { 'data-state': open ? 'playable' : 'coming' },
            h('span', { class: 'rung-node', 'aria-hidden': 'true' }),
            h(
              'div',
              { class: 'rung' },
              h('h2', { 'data-field': 'level' }, rung.level),
              h('p', { 'data-part': 'rung-text' }, `You manage ${rung.manages}. Each turn is ${rung.turn}.`),
              h('p', { 'data-field': 'status', class: 'status-tag' }, open ? 'Playable now' : 'Coming later'),
            ),
          );
        }),
      ),
      h(
        'footer',
        { class: 'start-print' },
        h('p', { 'data-part': 'disclaimer', class: 'disclaimer' }, DISCLAIMER),
        h('p', { 'data-field': 'version', class: 'version' }, `Version ${options.version}`),
        h('p', { 'data-part': 'copyright', class: 'version' }, COPYRIGHT),
      ),
    );
  }

  function startButton(seed: number) {
    return h('button', { 'data-action': 'begin', class: 'primary', onClick: () => {
        state = { screen: 'run', run: newRun(seed, options.content, options.deps) };
        error = null;
        notice = null;
        resetPage();
        save(state.run);
        render();
      } }, 'Start a new game');
  }

  /** The day the strip marks as now: the moment's or the reaction's day, past Friday once the turn is done, before Monday otherwise. */
  function stripDay(run: Run, kind: ReturnType<typeof sceneKind>, turn: LevelRenderer['turn']): number {
    if (kind === 'done') return 5;
    let day = -1;
    if (kind === 'moment') day = currentMoment(run)!.day;
    else if (kind === 'reaction') day = run.week.find((m) => m.id === reaction!.momentId)?.day ?? -1;
    // A month's or a quarter's strip shows the current week's five days.
    return turn !== 'week' && day >= 0 ? day % 5 : day;
  }

  /** The header: the week, the review, the days, energy, reputation and goals. */
  // @spec UI-WEEK-001, UI-WEEK-003, UI-WEEK-011, UI-WEEK-012, UI-WEEK-013, UI-WEEK-014
  function weekScreen(ctx: ScreenContext, renderer: LevelRenderer) {
    const { run } = ctx;
    const status = renderer.status(ctx.view);
    const kind = sceneKind(run);
    const step = STEP[renderer.turn];
    // While the recap shows, the header is about the turn it recaps, the one before the run's.
    const turnNumber = turnOf(run, renderer, kind === 'recap' ? run.sim.week - step : run.sim.week);
    const now = stripDay(run, kind, renderer.turn);
    const toReview = weeksToReview(run, options.deps);
    const promotion = run.towardPromotion ? towardPromotionLine(run.towardPromotion) : 'Promotion opens at your third review, then takes two reviews in a row rated exceeds or better.';
    return h(
      'section',
      { 'data-screen': 'week', class: 'week' },
      // @spec UI-A11Y-001: the header shows the level and turn visually; the screen's top heading says them for screen readers
      h('h1', { class: 'visually-hidden' }, `${capital(levelName(ctx.run))}, ${renderer.turn} ${turnNumber}`),
      h(
        'header',
        { class: 'status' },
        h('div', { class: 'week-number' }, `${capital(renderer.turn)} `, h('strong', { 'data-field': 'week' }, turnNumber), ' · review in ', h('strong', { 'data-field': 'weeks-to-review' }, toReview === undefined ? '?' : toReview / step), ` ${renderer.turn}s`),
        h('ol', { 'data-panel': 'days', class: 'days' }, DAYS.map((d, i) => h('li', { 'data-day': i, 'data-state': dayState(i, now) }, d.slice(0, 3)))),
        h('div', { class: 'energy' }, 'Energy ', meter(status.energy, 4), ' ', h('strong', { 'data-field': 'energy' }, status.edge?.at ? 'at the edge' : bandWord('energy', status.energy)),
          ' · reputation ', h('strong', { 'data-field': 'reputation' }, bandWord('reputation', status.reputation))),
        edgeWarning(status, renderer.turn),
        // @spec UI-WEEK-017: the rule toward the player's own promotion stays in view between reviews
        promotion ? h('p', { class: 'promotion', 'data-field': 'promotion' }, promotion) : null,
        h('ul', { 'data-panel': 'goals', class: 'goals' }, status.goals.map((g) => h('li', { 'data-goal': g.id }, h('span', { 'data-field': 'text' }, g.text), ': ', h('span', { 'data-field': 'progress' }, g.progress)))),
      ),
      h(
        'div',
        { class: 'layout' },
        h('div', { class: 'stage' },
          scene(ctx, renderer, kind),
          kind === 'moment' || kind === 'reaction'
            ? h('div', { class: 'end-week' }, h('button', { 'data-action': 'end-week', onClick: () => ctx.send({ kind: 'endWeek' }, 'end-week') }, 'End the week'), errorFor('end-week'))
            : null,
          kind === 'before-monday' ? null : help(ctx, renderer)),
        h('aside', { class: 'side' }, renderer.panels(ctx)),
      ),
    );
  }

  /** Which scene the week screen shows, read from the run where it can be (UI-WEEK-004, UI-WEEK-005). */
  function sceneKind(run: Run): 'before-monday' | 'recap' | 'reaction' | 'moment' | 'done' {
    const played = run.week.some((m) => m.status !== 'open');
    if (reaction && run.week.some((m) => m.id === reaction!.momentId)) return 'reaction';
    // A level's first turn opens on its own scene; the recap that follows is of a turn played at this level.
    if (run.sim.week === run.levelStartWeek && !played && startedFirstTurn !== run.levelStartWeek) return 'before-monday';
    if (run.lastWeek && run.sim.week > run.levelStartWeek && !played && closedRecapWeek !== run.sim.week) return 'recap';
    return currentMoment(run) ? 'moment' : 'done';
  }

  const currentMoment = (run: Run) => run.week.find((m) => m.status === 'open');

  /** The week the screen shows: the header's week, or the week a recap, review or ended screen is about. */
  const weekOnScreen = (run: Run) => shownWeek(run.phase === 'week' && sceneKind(run) !== 'recap' ? run.sim.week : run.sim.week - 1);

  /** A game week as the player counts it, from 1. */
  // @spec UI-WEEK-011
  const shownWeek = (gameWeek: number) => gameWeek + 1;

  /** The turn a game week falls in, as the player counts it from 1: a week of the run, or a month of the level. */
  // @spec UI-WEEK-011, UI-WEEK-016
  const turnOf = (run: Run, renderer: LevelRenderer, gameWeek: number) => (renderer.turn === 'week' ? shownWeek(gameWeek) : Math.floor((gameWeek - run.levelStartWeek) / STEP[renderer.turn]) + 1);

  const heading = (text: Child) => h('h2', { 'data-part': 'heading', tabindex: -1 }, text);

  // @spec UI-WEEK-002, UI-WEEK-004, UI-WEEK-005, UI-WEEK-006, UI-WEEK-007, UI-WEEK-009
  function scene(ctx: ScreenContext, renderer: LevelRenderer, kind: ReturnType<typeof sceneKind>): Child {
    const { run } = ctx;
    switch (kind) {
      case 'before-monday':
        return h(
          'section',
          { 'data-scene': 'before-monday', class: 'scene' },
          h('p', { class: 'where' }, renderer.firstTurn.where),
          heading(renderer.firstTurn.heading),
          h('p', {}, renderer.firstTurn.intro),
          renderer.habits(ctx),
          help(ctx, renderer, true),
          h('button', { 'data-action': 'start-week', class: 'primary', onClick: () => moveOn(() => (startedFirstTurn = run.levelStartWeek)) }, renderer.turn === 'week' ? 'Start the week' : `Start ${renderer.turn} 1`),
        );
      case 'recap':
        return h(
          'section',
          { 'data-scene': 'recap', class: 'scene recap' },
          h('p', { class: 'where' }, 'The weekend'),
          heading(`How ${renderer.turn} ${turnOf(run, renderer, run.sim.week - STEP[renderer.turn])} went`),
          recapView(run, renderer, wholeWeekOpen ?? false),
          h('button', { 'data-action': 'close-recap', class: 'primary', onClick: () => moveOn(() => (closedRecapWeek = run.sim.week)) }, `Start ${renderer.turn} ${turnOf(run, renderer, run.sim.week)}`),
        );
      case 'reaction': {
        const m = run.week.find((x) => x.id === reaction!.momentId)!;
        return h(
          'section',
          { 'data-scene': 'reaction', 'data-moment': m.id, class: 'scene' },
          h('p', { class: 'where' }, when(m, renderer.turn)),
          heading(m.title),
          h('p', { 'data-part': 'reaction', class: 'reaction' }, m.status === 'expired' ? 'This passed: something changed before you got to it.' : emphasis(m.text ?? '')),
          reaction!.chips.length ? h('ul', { class: 'chips' }, reaction!.chips.map((c) => h('li', { 'data-chip': c.key, 'data-tone': c.tone, class: `chip ${c.tone}` }, c.text))) : null,
          reaction!.passed.length ? h('ul', { 'data-part': 'passed', class: 'passed' }, reaction!.passed.map((p) => h('li', { 'data-moment': p.id }, `${when(p, renderer.turn)}: ${p.title} has passed.`))) : null,
          h('button', { 'data-action': 'continue', class: 'primary', onClick: () => moveOn(() => (reaction = null)) }, 'Continue'),
        );
      }
      case 'moment': {
        const m = currentMoment(run)!;
        const control = `moment:${m.id}`;
        const details: MomentDetails | undefined =
          m.source === 'level'
            ? renderer.moment(ctx, m.id)
            : (() => {
                const p = run.presented.find((x) => x.id === m.id)!;
                return { title: m.title, text: p.text, choices: p.choices };
              })();
        return h(
          'section',
          { 'data-scene': 'moment', 'data-moment': m.id, class: 'scene' },
          h('p', { class: 'where', 'data-field': 'when' }, when(m, renderer.turn)),
          heading(details?.title ?? m.title),
          h('p', { 'data-part': 'text' }, emphasis(details?.text ?? '')),
          details?.detail ?? null,
          h(
            'div',
            { class: 'choices' },
            (details?.choices ?? []).map((c) =>
              h('button', { 'data-choice': c.id, class: 'choice', onClick: () => ctx.send({ kind: 'answer', momentId: m.id, choiceId: c.id }, control) },
                c.label, c.note ? h('small', { 'data-part': 'who' }, c.note) : null),
            ),
            ctx.errorFor(control),
          ),
          h('button', { 'data-action': 'wait', class: 'quiet', onClick: () => ctx.send({ kind: 'wait' }, control) }, 'Let it wait'),
        );
      }
      case 'done':
        return h(
          'section',
          { 'data-scene': 'done', class: 'scene' },
          h('p', { class: 'where' }, 'The weekend'),
          heading("That's the week"),
          h('p', {}, 'Nothing else needs you this week.'),
          h('button', { 'data-action': 'finish-week', class: 'primary', onClick: () => ctx.send({ kind: 'endWeek' }, 'finish-week') }, 'End the week'),
          errorFor('finish-week'),
        );
    }
  }

  /**
   * The recap of the week just ended: what changed first, then The whole week, a disclosure holding every moment in
   * order and the level's routine part, which the player has mostly seen already.
   */
  // @spec UI-WEEK-004, UI-WEEK-015
  function recapView(run: Run, renderer: LevelRenderer, open: boolean): Child {
    if (!run.lastWeek) return null;
    const outcome = (m: WeekMoment) => (m.status === 'answered' ? (m.text ?? '') : (MOMENT_OUTCOMES[m.status] ?? ''));
    const part = renderer.recap(run, run.lastWeek.recap);
    const promises = promisesPart(run, renderer);
    // A promise kept or broken is something that changed, so the turn is not quiet.
    const changes = promises.answered ? [part.changes].flat(3).filter((c) => !(c instanceof HTMLElement && c.dataset.part === 'recap-quiet')) : part.changes;
    return h(
      'div',
      { 'data-part': 'recap', class: 'recap' },
      h('div', { 'data-part': 'recap-changes' }, changes, promises.part),
      h(
        'details',
        {
          'data-part': 'recap-whole-week',
          class: 'whole-week',
          open,
          onToggle: (e: Event) => {
            // The ended screen always opens it; only the week screen's recap remembers the player's choice.
            if (run.phase !== 'ended') wholeWeekOpen = (e.target as HTMLDetailsElement).open;
          },
        },
        h('summary', {}, `The whole ${renderer.turn}`),
        h('h3', {}, 'The week'),
        h('ul', { 'data-part': 'recap-moments' }, run.lastWeek.moments.map((m) => h('li', { 'data-moment': m.id }, h('strong', {}, `${when(m, renderer.turn)} · ${m.title}: `), outcome(m)))),
        part.routine,
      ),
    );
  }

  /** What the player has promised people and not yet kept, and what was kept or broken in the turn just played. */
  // @spec UI-PROMISE-001, UI-PROMISE-002
  function promisesPart(run: Run, renderer: LevelRenderer): { part: Child; answered: boolean } {
    const p = promisesAt(run.sim, run.sim.week - STEP[renderer.turn]);
    const weeks = (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`;
    const items = [
      ...p.kept.map((x) => h('li', { 'data-promise': 'kept', 'data-person': x.personId }, `Kept: ${x.promise}, to ${x.name}.`)),
      ...p.broken.map((x) => h('li', { 'data-promise': 'broken', 'data-person': x.personId }, `Broken: ${x.promise}, to ${x.name}${x.restless ? ', who is restless again' : ''}.`)),
      ...p.open.map((x) => h('li', { 'data-promise': 'open', 'data-person': x.personId }, `${x.name}: ${x.promise}, promised ${weeks(x.weeksAgo)} ago.`)),
    ];
    return { part: items.length ? h('div', { 'data-part': 'recap-promises' }, h('h3', {}, 'Your promises'), h('ul', {}, items)) : null, answered: p.kept.length + p.broken.length > 0 };
  }

  /** How to play, open in the first weeks; once the player opens or closes it, their choice holds across redraws. */
  // @spec UI-HELP-001
  function help(ctx: ScreenContext, renderer: LevelRenderer, open?: boolean) {
    const chosen = ctx.drafts.get('help')?.open;
    // Open in the level's first three turns.
    const turnsIn = (ctx.run.sim.week - ctx.run.levelStartWeek) / STEP[renderer.turn];
    const isOpen = open ?? (chosen === undefined ? turnsIn <= HELP_OPEN_THROUGH_WEEK : chosen === 'true');
    return h(
      'details',
      { 'data-panel': 'help', class: 'help', open: isOpen, onToggle: (e: Event) => ctx.drafts.set('help', { open: String((e.target as HTMLDetailsElement).open) }) },
      h('summary', {}, 'How to play'),
      renderer.help.map((t) => h('p', { 'data-topic': t.id }, h('strong', {}, `${t.title}. `), t.text)),
    );
  }

  // @spec UI-REVIEW-001
  function reviewScreen(ctx: ScreenContext, renderer: LevelRenderer) {
    const review = ctx.run.review!;
    return h(
      'section',
      { 'data-screen': 'review', class: 'review' },
      h('h1', { 'data-part': 'heading', tabindex: -1 }, `${capital(renderer.turn)} ${turnOf(ctx.run, renderer, ctx.run.sim.week - STEP[renderer.turn])} review`),
      h('p', { class: 'outcome' }, h('strong', { 'data-field': 'outcome' }, review.outcome === 'stayed' ? renderer.stayed.outcome : OUTCOMES[review.outcome])),
      h('p', {}, 'Rating: ', h('strong', { 'data-field': 'rating' }, review.rating), ' ', h('small', { class: 'numbers', 'data-field': 'score' }, `score ${review.score.toFixed(2)}, from −1 to 1`)),
      review.ceilingReason ? h('p', { class: 'ceiling', 'data-field': 'ceiling' }, review.ceilingReason) : null,
      standingLines(review.standing, (id) => renderer.measureName(ctx.view, id) ?? id, (id) => renderer.measureLever(id)),
      h(
        'table',
        { class: 'measures' },
        h('tr', {}, h('th', {}, 'Measure'), h('th', {}, 'Result'), h('th', {}, 'Verdict')),
        review.measures.map((m) =>
          h(
            'tr',
            { 'data-measure': m.id },
            h('td', { 'data-field': 'name' }, renderer.measureName(ctx.view, m.id) ?? m.id),
            h('td', {},
              h('span', { 'data-field': 'value' }, renderer.measureValue(ctx.view, m.id, m.value) ?? round(m.value)),
              h('small', { 'data-field': 'numbers', class: 'numbers' }, `${round(m.value)}; aim ${round(m.target)} ± ${round(m.tolerance)}, ${m.better} is better`)),
            h('td', { 'data-field': 'verdict' }, VERDICTS[m.verdict]),
          ),
        ),
      ),
      h('h2', {}, 'What shaped the quarter'),
      h(
        'ul',
        { class: 'debriefs' },
        review.debriefs.map((d) =>
          h(
            'li',
            { 'data-debrief': true },
            h('strong', { 'data-field': 'title' }, titles.get(d.situationId) ?? d.situationId),
            ' — ',
            h('span', { 'data-field': 'status' }, DEBRIEF_STATUS[d.status]),
            debriefLesson(d, waitDebriefs),
          ),
        ),
      ),
      h('div', {}, h('button', { 'data-action': 'acknowledge', onClick: () => ctx.send({ kind: 'acknowledge' }, 'acknowledge') }, 'Acknowledge'), ctx.errorFor('acknowledge')),
    );
  }

  /** The run's story at its end: weeks played, each review's rating, and the level's part. */
  // @spec UI-END-002
  function careerSummary(run: Run, view: unknown, renderer: LevelRenderer): Child {
    const ratings = run.sim.player.ratingHistory.filter((r) => r.cause.kind === 'rule' && r.cause.ruleId === 'review.quarterly').map((r) => r.rating);
    return h(
      'div',
      { 'data-part': 'career', class: 'career' },
      h('h2', {}, 'Your career'),
      h('ul', {},
        h('li', {}, 'Weeks played: ', h('span', { 'data-field': 'weeks' }, shownWeek(run.sim.week - 1))),
        h('li', {}, 'Reviews: ', h('span', { 'data-field': 'ratings' }, ratings.length ? ratings.join(', ') : 'none yet')),
        // Each level the run left by promotion tells its part, then the level it ended at.
        run.earlierLevels.map((e) => {
          const lvl = options.deps.levels.find((l) => l.params.id === e.levelId);
          const r = RENDERERS[e.levelId];
          // As that level saw the run when it left it, before the next level reshaped the organization.
          return lvl && r ? r.career(lvl.view(e.level, e.sim)) : null;
        }),
        renderer.career(view)),
    );
  }

  // @spec UI-END-001
  function endedScreen(run: Run, renderer: LevelRenderer, view: unknown) {
    return h(
      'section',
      { 'data-screen': 'ended', class: 'ended' },
      h('h1', { 'data-part': 'heading', tabindex: -1 }, 'The end'),
      h('p', { 'data-field': 'ending' }, endingLine(run, renderer, view)),
      careerSummary(run, view, renderer),
      // The final week's moments are what explain the ending, so The whole week is open here. A run that ended before
      // its level played a turn has only the level below's recap, which this level's renderer cannot tell.
      run.sim.week > run.levelStartWeek ? recapView(run, renderer, true) : null,
      h('button', { 'data-action': 'new-run', onClick: () => {
        state = { screen: 'start', seed: options.newSeed() };
        error = null;
        resetPage();
        render();
      } }, 'Start a new run'),
    );
  }

  /** The promotion, and the one call the player makes as they leave their team: who leads it now. */
  // @spec UI-HAND-001, UI-HAND-002
  function handoverScreen(ctx: ScreenContext) {
    const { run } = ctx;
    const next = options.deps.levels[options.deps.levels.findIndex((l) => l.params.id === run.levelId) + 1];
    const name = next ? (LEVEL_NAMES[next.params.id] ?? next.params.id) : 'the next level';
    const team = Object.values(run.sim.teams).find((t) => t.leader?.kind === 'player');
    const words = next ? RENDERERS[next.params.id]?.handover : undefined;
    // What the player knows of each person's want, from the level they are leaving: its engineers or its managers.
    const view = ctx.view as { people?: { id: string; want: string }[]; managers?: { id: string; want: string }[] };
    const known = new Map((view.people ?? view.managers ?? []).map((p) => [p.id, p.want]));
    return h(
      'section',
      { 'data-screen': 'handover', class: 'handover' },
      h('h1', { 'data-part': 'heading', tabindex: -1 }, `You've been promoted to ${name}`),
      h('p', { 'data-part': 'question' }, words ? words.question(team?.name ?? 'your team') : `Who leads ${team?.name ?? 'your team'} now?`),
      h('p', { 'data-part': 'trade' }, words?.trade ?? HANDOVER_TRADE),
      h(
        'div',
        { class: 'choices' },
        (run.handoverChoices ?? []).map((c) => {
          const want = known.get(c.id);
          return h(
            'button',
            { 'data-handover': c.id, class: 'choice', onClick: () => ctx.send({ kind: 'handover', choice: c.id }, 'handover') },
            c.id === 'hire'
              ? (words?.hire ?? 'An outside hire: a capable manager you don\'t know yet')
              : [
                  h('strong', {}, c.name),
                  h('small', {}, 'Skill ', h('span', { 'data-field': 'skill' }, bandWord('skill', band(c.skill ?? 0))), ' · ', h('span', { 'data-field': 'trust' }, bandWord('trust', band(c.trust ?? 0))),
                    want && want !== 'unknown' ? [' · wants ', h('span', { 'data-field': 'want' }, want)] : null),
                ],
          );
        }),
        ctx.errorFor('handover'),
      ),
    );
  }

  function unavailableScreen(run: Run) {
    return h(
      'section',
      { 'data-screen': 'unavailable' },
      h('p', {}, `This run is at a career level the game does not have: ${run.levelId}.`),
      h('button', { 'data-action': 'new-run', onClick: () => {
        state = { screen: 'start', seed: options.newSeed() };
        render();
      } }, 'Start a new run'),
    );
  }

  /** The screen for a run's phase, or the unavailable screen for a level the game does not have. */
  function runScreen(run: Run): HTMLElement {
    const found = levelOf(run);
    if (!found) return unavailableScreen(run);
    const ctx: ScreenContext = { run, deps: options.deps, view: found.level.view(run.level, run.sim), send, errorFor, drafts, refresh: render };
    switch (run.phase) {
      case 'week':
        return weekScreen(ctx, found.renderer);
      case 'review':
        return reviewScreen(ctx, found.renderer);
      case 'handover':
        return handoverScreen(ctx);
      default:
        return endedScreen(run, found.renderer, ctx.view);
    }
  }

  function render() {
    if (otherTab) {
      root.replaceChildren(otherTabScreen() as Node);
      return;
    }
    const focus = focusKey(root);
    const screen = state.screen === 'start' ? startScreen(state.seed) : runScreen(state.run);
    root.replaceChildren();
    const errors = contentErrors();
    if (errors) root.append(errors as Node);
    if (notice) root.append(h('p', { 'data-notice': true, role: 'status', class: 'notice' }, notice));
    root.append(screen);
    if (state.screen === 'run') root.append(saveArea(state.run) as Node);
    // @spec UI-SHELL-005
    if (focusScene) root.querySelector<HTMLElement>('[data-scene] [data-part=heading], [data-screen] > [data-part=heading]')?.focus();
    else restoreFocus(root, focus);
    focusScene = false;
  }

  render();
  return { state: (): AppState => structuredClone(state) };
}

const dayState = (i: number, now: number) => {
  if (i < now) return 'past';
  return i === now ? 'now' : 'ahead';
};

/** The burnout warning: how many turns the player has ended at the edge, or that they are close to it. */
function edgeWarning(status: ReturnType<LevelRenderer['status']>, turn: LevelRenderer['turn']): HTMLElement | null {
  const edge = status.edge;
  if (edge && edge.weeks > 0) return h('p', { class: 'burnout', 'data-field': 'burnout' }, `You've ended ${edge.weeks} ${edge.weeks === 1 ? turn : turn + 's'} at the edge. ${edge.limit} in a row and you burn out.`);
  if (edge && status.energy === 0) return h('p', { class: 'burnout', 'data-field': 'burnout' }, "You're close to the edge. Take something off your plate.");
  return null;
}

/** A meter from 0 to `max`; its range is set as properties, which every DOM honours, before its value. */
function meter(value: number, max: number): HTMLElement {
  const m = h('meter', { 'data-meter': 'energy' }) as HTMLMeterElement;
  m.min = 0;
  m.max = max;
  m.value = value;
  return m;
}

const round = (n: number) => String(Math.round(n * 100) / 100);

/** The data attributes that identify a control and the row it sits in, so it can be found again after a redraw. */
const CONTROL_KEYS = ['data-input', 'data-action', 'data-choice', 'data-habit'];
const ROW_KEYS = ['data-scene', 'data-panel', 'data-person', 'data-project'];

function selectorFor(el: Element, keys: string[]): string | undefined {
  const key = keys.find((k) => el.hasAttribute(k));
  return key ? `[${key}="${CSS.escape(el.getAttribute(key)!)}"]` : undefined;
}

/** A selector for the focused control, if focus is inside the app. Redraws replace every element, so focus is kept by key. */
function focusKey(root: HTMLElement): string | undefined {
  const active = root.ownerDocument.activeElement;
  if (!active || !root.contains(active)) return undefined;
  const control = selectorFor(active, CONTROL_KEYS);
  if (!control) return undefined;
  const row = active.parentElement?.closest(ROW_KEYS.map((k) => `[${k}]`).join(','));
  const rowSelector = row ? selectorFor(row, ROW_KEYS) : undefined;
  return rowSelector ? `${rowSelector} ${control}` : control;
}

function restoreFocus(root: HTMLElement, key: string | undefined) {
  if (key) root.querySelector<HTMLElement>(key)?.focus();
}
