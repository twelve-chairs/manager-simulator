import { apply, newRun, weeksToReview, type AnyLevel, type Command, type Dependencies, type Run, type WeekMoment } from '../loop';
import { MAX_SAVE_BYTES, contentFingerprint, parseSave, restore, toSave } from '../save';
import type { ContentError, Situation } from '../situations';
import { bandWord } from './bands';
import { h, type Child } from './dom';
import { HELP_OPEN_THROUGH_WEEK, HELP_TOPICS } from './help';
import { lineManagerRenderer } from './line-manager';
import { emphasis } from './text';

export interface AppOptions {
  content: Situation[];
  contentErrors: ContentError[];
  /** True in the development build, so authors see content errors and players do not. */
  showContentErrors: boolean;
  deps: Dependencies;
  newSeed: () => number;
  /** Start on an existing run instead of the start screen. */
  run?: Run;
  /** Where the run is saved (the browser's localStorage in the game). Without it, the game plays without saving. */
  storage?: SaveStorage;
}

/** The part of the browser's Storage the app uses. */
export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const SAVE_KEY = 'manager-simulator.save';

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
  chips(before: unknown, after: unknown): Chip[];
  recap(run: Run, recap: unknown): Child;
  status(view: unknown): { energy: number; reputation: number; goals: { id: string; text: string; progress: string }[]; edge?: { at: boolean; weeks: number; limit: number } };
  /** A measure's name on the review screen, when the level names it (a goal by its text). */
  measureName(view: unknown, id: string): string | undefined;
  /** A measure's value in words on the review screen, when the level knows the measure. */
  measureValue(view: unknown, id: string, value: number): string | undefined;
  /** The level's lines of the career summary at the end of a run. */
  career(view: unknown): Child;
}

const RENDERERS: Record<string, LevelRenderer> = { 'line-manager': lineManagerRenderer };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const when = (m: { day: number; time: string }) => `${DAYS[m.day] ?? ''} ${m.time}`;

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
  stayed: 'This was your last review as a line manager. Three years in, the promotion never came.',
} as const;

const VERDICTS = { above: 'above target', at: 'on target', below: 'below target' } as const;

/** What happened to a situation, in the words the recap uses. */
const DEBRIEF_STATUS = { resolved: 'You dealt with it', ignored: 'You let it wait', expired: 'It passed before you got to it' } as const;

const ENDINGS = {
  burnout: 'You burned out. Four weeks at the edge was too long.',
  managedOut: 'You were managed out after failing your improvement plan.',
  stayed: 'You stayed a line manager. Three years went by without the promotion.',
  completed: 'You were promoted past the top of the ladder the game has so far. You won.',
} as const;

/** Mounts the game in `root` and redraws it from the run after every command. */
// @spec UI-SHELL-001, UI-SHELL-002, UI-SHELL-003, UI-SHELL-004, UI-CONTENT-001
export function createApp(root: HTMLElement, options: AppOptions) {
  // The start screen's seed is drawn only once it is known no saved run will be resumed.
  let state: AppState = options.run ? { screen: 'run', run: options.run } : { screen: 'start', seed: 0 };
  let error: { control: string; message: string } | null = null;
  /** A message about saving or loading, shown until the player's next command. */
  let notice: string | null = null;
  let warnedStorage = false;
  const drafts = new Map<string, Record<string, string>>();
  // Where the player is looking, kept only on the page (UI-WEEK-009): a reload never shows a reaction again.
  let reaction: Reaction | null = null;
  let startedWeek0 = false;
  let closedRecapWeek: number | null = null;
  let focusScene = false;
  /** Forgets where the player was looking, for a run that has just begun or been loaded. */
  const resetPage = () => {
    reaction = null;
    startedWeek0 = false;
    closedRecapWeek = null;
    drafts.clear();
  };
  const titles = new Map(options.content.map((s) => [s.id, s.title]));
  const waitDebriefs = new Map(options.content.flatMap((s) => (s.waitDebrief ? [[s.id, s.waitDebrief] as const] : [])));
  const fingerprint = contentFingerprint(options.content);

  /** Writes the run's save; a storage failure is reported once, and the game plays on unsaved. */
  // @spec UI-SAVE-002, UI-SAVE-005
  function save(run: Run) {
    if (!options.storage) return;
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
    const restored = restore(parsed.save, options.content, options.deps, fingerprint);
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

  function importControl(): Child {
    return h('label', { class: 'import' }, 'Import a save: ', h('input', {
      type: 'file',
      accept: '.json,application/json',
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
    }));
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
    const confirmation = pendingImport
      ? h(
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
        )
      : confirmingDiscard
        ? h(
            'p',
            { class: 'confirm' },
            'Discard this run? It cannot be recovered unless you exported it. ',
            h('button', { 'data-action': 'confirm-discard', onClick: discard }, 'Yes, discard it'),
            h('button', { 'data-action': 'cancel-discard', onClick: () => {
              confirmingDiscard = false;
              render();
            } }, 'Cancel'),
          )
        : null;
    return h(
      'section',
      { 'data-panel': 'save', class: 'save' },
      h('button', { 'data-action': 'export', onClick: () => exportSave(run) }, 'Export save'),
      importControl(),
      h('button', { 'data-action': 'discard', onClick: () => {
        confirmingDiscard = true;
        pendingImport = null;
        render();
      } }, 'Discard and start over'),
      confirmation,
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
        const chips = found.renderer.chips(found.level.view(before.level, before.sim), found.level.view(after.level, after.sim));
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
    error && error.control === control ? h('p', { 'data-error': true, role: 'alert', class: 'error' }, error.message) : null;

  function contentErrors(): Child {
    if (!options.showContentErrors || options.contentErrors.length === 0) return null;
    return h(
      'section',
      { 'data-panel': 'content-errors', class: 'content-errors' },
      h('h2', {}, 'Content errors'),
      h('ul', {}, options.contentErrors.map((e) => h('li', {}, `${e.situationId ?? `#${e.index ?? '?'}`}: ${e.message}`))),
    );
  }

  function startScreen(seed: number) {
    return h(
      'section',
      { 'data-screen': 'start', class: 'start' },
      h('h1', {}, 'Manager Simulator'),
      h('p', {}, 'You lead a team of five engineers. Keep them, keep your projects on track, and earn your promotion.'),
      h('p', {}, 'Seed: ', h('span', { 'data-field': 'seed' }, seed)),
      h('button', { 'data-action': 'begin', onClick: () => {
        state = { screen: 'run', run: newRun(seed, options.content, options.deps) };
        error = null;
        notice = null;
        resetPage();
        save(state.run);
        render();
      } }, 'Begin'),
      importControl(),
    );
  }

  /** The header: the week, the review, the days, energy, reputation and goals. */
  // @spec UI-WEEK-001, UI-WEEK-003, UI-WEEK-011, UI-WEEK-012, UI-WEEK-013
  function weekScreen(ctx: ScreenContext, renderer: LevelRenderer) {
    const { run } = ctx;
    const status = renderer.status(ctx.view);
    const kind = sceneKind(run);
    // While the recap shows, the header is about the week it recaps, the game week before the run's.
    const week = shownWeek(kind === 'recap' ? run.sim.week - 1 : run.sim.week);
    const now = kind === 'moment' ? currentMoment(run)!.day : kind === 'reaction' ? (run.week.find((m) => m.id === reaction!.momentId)?.day ?? -1) : kind === 'done' ? 5 : -1;
    return h(
      'section',
      { 'data-screen': 'week', class: 'week' },
      h(
        'header',
        { class: 'status' },
        h('div', { class: 'week-number' }, 'Week ', h('strong', { 'data-field': 'week' }, week), ' · review in ', h('strong', { 'data-field': 'weeks-to-review' }, weeksToReview(run, options.deps) ?? '?'), ' weeks'),
        h('ol', { 'data-panel': 'days', class: 'days' }, DAYS.map((d, i) => h('li', { 'data-day': i, 'data-state': i < now ? 'past' : i === now ? 'now' : 'ahead' }, d.slice(0, 3)))),
        h('div', { class: 'energy' }, 'Energy ', meter(status.energy, 4), ' ', h('strong', { 'data-field': 'energy' }, status.edge?.at ? 'at the edge' : bandWord('energy', status.energy)),
          ' · reputation ', h('strong', { 'data-field': 'reputation' }, bandWord('reputation', status.reputation))),
        status.edge && status.edge.weeks > 0
          ? h('p', { class: 'burnout', 'data-field': 'burnout' }, `You've ended ${status.edge.weeks} ${status.edge.weeks === 1 ? 'week' : 'weeks'} at the edge. ${status.edge.limit} in a row and you burn out.`)
          : null,
        h('ul', { 'data-panel': 'goals', class: 'goals' }, status.goals.map((g) => h('li', { 'data-goal': g.id }, h('span', { 'data-field': 'text' }, g.text), ': ', h('span', { 'data-field': 'progress' }, g.progress)))),
      ),
      h(
        'div',
        { class: 'layout' },
        h('main', { class: 'stage' },
          scene(ctx, renderer, kind),
          kind === 'moment' || kind === 'reaction'
            ? h('div', { class: 'end-week' }, h('button', { 'data-action': 'end-week', onClick: () => ctx.send({ kind: 'endWeek' }, 'end-week') }, 'End the week'), errorFor('end-week'))
            : null,
          kind === 'before-monday' ? null : help(ctx)),
        h('aside', { class: 'side' }, renderer.panels(ctx)),
      ),
    );
  }

  /** Which scene the week screen shows, read from the run where it can be (UI-WEEK-004, UI-WEEK-005). */
  function sceneKind(run: Run): 'before-monday' | 'recap' | 'reaction' | 'moment' | 'done' {
    const played = run.week.some((m) => m.status !== 'open');
    if (reaction && run.week.some((m) => m.id === reaction!.momentId)) return 'reaction';
    if (run.sim.week === 0 && !run.lastWeek && !played && !startedWeek0) return 'before-monday';
    if (run.lastWeek && !played && closedRecapWeek !== run.sim.week) return 'recap';
    return currentMoment(run) ? 'moment' : 'done';
  }

  const currentMoment = (run: Run) => run.week.find((m) => m.status === 'open');

  /** The week the screen shows: the header's week, or the week a recap, review or ended screen is about. */
  const weekOnScreen = (run: Run) => shownWeek(run.phase === 'week' && sceneKind(run) !== 'recap' ? run.sim.week : run.sim.week - 1);

  /** A game week as the player counts it, from 1. */
  // @spec UI-WEEK-011
  const shownWeek = (gameWeek: number) => gameWeek + 1;

  const heading = (text: Child) => h('h2', { 'data-part': 'heading', tabindex: -1 }, text);

  // @spec UI-WEEK-002, UI-WEEK-004, UI-WEEK-005, UI-WEEK-006, UI-WEEK-007, UI-WEEK-009
  function scene(ctx: ScreenContext, renderer: LevelRenderer, kind: ReturnType<typeof sceneKind>): Child {
    const { run } = ctx;
    switch (kind) {
      case 'before-monday':
        return h(
          'section',
          { 'data-scene': 'before-monday', class: 'scene' },
          h('p', { class: 'where' }, 'Before Monday'),
          heading('How you run your team'),
          h('p', {}, 'Your habits handle the routine, so the week can be about the moments that matter. You can change them any time.'),
          renderer.habits(ctx),
          help(ctx, true),
          h('button', { 'data-action': 'start-week', class: 'primary', onClick: () => moveOn(() => (startedWeek0 = true)) }, 'Start the week'),
        );
      case 'recap':
        return h(
          'section',
          { 'data-scene': 'recap', class: 'scene recap' },
          h('p', { class: 'where' }, 'The weekend'),
          heading(`How week ${shownWeek(run.sim.week - 1)} went`),
          recapView(run, renderer),
          h('button', { 'data-action': 'close-recap', class: 'primary', onClick: () => moveOn(() => (closedRecapWeek = run.sim.week)) }, `Start week ${shownWeek(run.sim.week)}`),
        );
      case 'reaction': {
        const m = run.week.find((x) => x.id === reaction!.momentId)!;
        return h(
          'section',
          { 'data-scene': 'reaction', 'data-moment': m.id, class: 'scene' },
          h('p', { class: 'where' }, when(m)),
          heading(m.title),
          h('p', { 'data-part': 'reaction', class: 'reaction' }, m.status === 'expired' ? 'This passed: something changed before you got to it.' : emphasis(m.text ?? '')),
          reaction!.chips.length ? h('ul', { class: 'chips' }, reaction!.chips.map((c) => h('li', { 'data-chip': c.key, 'data-tone': c.tone, class: `chip ${c.tone}` }, c.text))) : null,
          reaction!.passed.length ? h('ul', { 'data-part': 'passed', class: 'passed' }, reaction!.passed.map((p) => h('li', { 'data-moment': p.id }, `${when(p)}: ${p.title} has passed.`))) : null,
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
          h('p', { class: 'where', 'data-field': 'when' }, when(m)),
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

  /** The recap of the week just ended: every moment in order, then the level's part. */
  function recapView(run: Run, renderer: LevelRenderer): Child {
    if (!run.lastWeek) return null;
    const outcome = (m: WeekMoment) =>
      m.status === 'answered' ? (m.text ?? '') : m.status === 'waited' ? 'You let it wait.' : m.status === 'expired' ? 'It passed.' : '';
    return h(
      'div',
      { 'data-part': 'recap', class: 'recap' },
      h('h3', {}, 'The week'),
      h('ul', { 'data-part': 'recap-moments' }, run.lastWeek.moments.map((m) => h('li', { 'data-moment': m.id }, h('strong', {}, `${when(m)} · ${m.title}: `), outcome(m)))),
      renderer.recap(run, run.lastWeek.recap),
    );
  }

  /** How to play, open in the first weeks; once the player opens or closes it, their choice holds across redraws. */
  // @spec UI-HELP-001
  function help(ctx: ScreenContext, open?: boolean) {
    const chosen = ctx.drafts.get('help')?.open;
    const isOpen = open ?? (chosen === undefined ? ctx.run.sim.week <= HELP_OPEN_THROUGH_WEEK : chosen === 'true');
    return h(
      'details',
      { 'data-panel': 'help', class: 'help', open: isOpen, onToggle: (e: Event) => ctx.drafts.set('help', { open: String((e.target as HTMLDetailsElement).open) }) },
      h('summary', {}, 'How to play'),
      HELP_TOPICS.map((t) => h('p', { 'data-topic': t.id }, h('strong', {}, `${t.title}. `), t.text)),
    );
  }

  // @spec UI-REVIEW-001
  function reviewScreen(ctx: ScreenContext, renderer: LevelRenderer) {
    const review = ctx.run.review!;
    return h(
      'section',
      { 'data-screen': 'review', class: 'review' },
      h('h1', { 'data-part': 'heading', tabindex: -1 }, `Week ${shownWeek(ctx.run.sim.week - 1)} review`),
      h('p', { class: 'outcome' }, h('strong', { 'data-field': 'outcome' }, OUTCOMES[review.outcome])),
      h('p', {}, 'Rating: ', h('strong', { 'data-field': 'rating' }, review.rating), ' (score ', h('span', { 'data-field': 'score' }, review.score.toFixed(2)), ')'),
      review.ceilingReason ? h('p', { class: 'ceiling', 'data-field': 'ceiling' }, review.ceilingReason) : null,
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
            d.status === 'resolved'
              ? h('p', { 'data-field': 'text' }, d.debrief ?? '')
              : d.status === 'ignored' && waitDebriefs.has(d.situationId)
                ? h('p', { 'data-field': 'text' }, waitDebriefs.get(d.situationId))
                : null,
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
        renderer.career(view)),
    );
  }

  // @spec UI-END-001
  function endedScreen(run: Run, renderer: LevelRenderer, view: unknown) {
    return h(
      'section',
      { 'data-screen': 'ended', class: 'ended' },
      h('h1', { 'data-part': 'heading', tabindex: -1 }, 'The end'),
      h('p', { 'data-field': 'ending' }, run.ending ? ENDINGS[run.ending] : ''),
      h('p', {}, `Week ${shownWeek(run.sim.week - 1)}, seed ${run.seed}.`),
      careerSummary(run, view, renderer),
      recapView(run, renderer),
      h('button', { 'data-action': 'new-run', onClick: () => {
        state = { screen: 'start', seed: options.newSeed() };
        error = null;
        resetPage();
        render();
      } }, 'Start a new run'),
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

  function render() {
    const focus = focusKey(root);
    let screen: Child;
    if (state.screen === 'start') screen = startScreen(state.seed);
    else {
      const run = state.run;
      const found = levelOf(run);
      if (!found) screen = unavailableScreen(run);
      else {
        const ctx: ScreenContext = { run, deps: options.deps, view: found.level.view(run.level, run.sim), send, errorFor, drafts };
        screen = run.phase === 'week' ? weekScreen(ctx, found.renderer) : run.phase === 'review' ? reviewScreen(ctx, found.renderer) : endedScreen(run, found.renderer, ctx.view);
      }
    }
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
