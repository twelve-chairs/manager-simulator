import { apply, newRun, weeksToReview, type AnyLevel, type Command, type Dependencies, type Run } from '../loop';
import type { ContentError, Situation } from '../situations';
import { bandWord } from './bands';
import { h, type Child } from './dom';
import { lineManagerPanels } from './line-manager';
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
}

export type AppState = { screen: 'start'; seed: number } | { screen: 'run'; run: Run };

/** What a screen needs from the app: the run, a way to send a command, and the error for a control. */
export interface ScreenContext {
  run: Run;
  deps: Dependencies;
  /** The active level's view of the run with the week's plan, computed once per redraw. */
  view: unknown;
  /**
   * Sends a command; `control` names where to show an error if the loop refuses it. `onApplied` runs only when the
   * command applies, before the redraw, so editing state is kept when a command is refused.
   */
  send: (command: Command, control: string, onApplied?: () => void) => void;
  /** The error message for a control, if its last command was refused. */
  errorFor: (control: string) => Child;
  /** Re-renders without sending a command, for form controls the player is still filling in. */
  redraw: () => void;
  /** Editing state that survives a redraw, by key. */
  drafts: Map<string, Record<string, string>>;
}

/** Panels a career level contributes to the week screen. */
const LEVEL_PANELS: Record<string, (ctx: ScreenContext) => Child> = { 'line-manager': lineManagerPanels };

const OUTCOMES = {
  continue: 'You are continuing in your role.',
  promote: 'You are being promoted.',
  managedOut: 'You are being managed out.',
} as const;

const ENDINGS = {
  burnout: 'You burned out. Four weeks at the edge was too long.',
  managedOut: 'You were managed out after failing your improvement plan.',
  completed: 'You were promoted past the top of the ladder the game has so far. You won.',
} as const;

/** Mounts the game in `root` and redraws it from the run after every command. */
// @spec UI-SHELL-001, UI-SHELL-002, UI-SHELL-003, UI-SHELL-004, UI-CONTENT-001
export function createApp(root: HTMLElement, options: AppOptions) {
  let state: AppState = options.run ? { screen: 'run', run: options.run } : { screen: 'start', seed: options.newSeed() };
  let error: { control: string; message: string } | null = null;
  const drafts = new Map<string, Record<string, string>>();
  const titles = new Map(options.content.map((s) => [s.id, s.title]));

  function send(command: Command, control: string, onApplied?: () => void) {
    if (state.screen !== 'run') return;
    const result = apply(state.run, command, options.content, options.deps);
    if (result.ok) {
      state = { screen: 'run', run: result.run };
      error = null;
      onApplied?.();
    } else {
      error = { control, message: result.error };
    }
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
        render();
      } }, 'Begin'),
    );
  }

  // @spec UI-WEEK-001, UI-WEEK-003
  function weekScreen(ctx: ScreenContext) {
    const { run } = ctx;
    const view = ctx.view as { player: { reputation: number; stress: number }; plannedHours: number; overtime: number };
    return h(
      'section',
      { 'data-screen': 'week', class: 'week' },
      h(
        'header',
        { class: 'status' },
        h('span', {}, 'Week ', h('strong', { 'data-field': 'week' }, run.sim.week)),
        h('span', {}, 'Review in ', h('strong', { 'data-field': 'weeks-to-review' }, weeksToReview(run, options.deps) ?? '?'), ' weeks'),
        h('span', {}, 'Reputation: ', h('strong', { 'data-field': 'reputation' }, bandWord('reputation', view.player.reputation))),
        h('span', {}, 'Your stress: ', h('strong', { 'data-field': 'stress' }, bandWord('stress', view.player.stress))),
        h('span', {}, 'Hours planned: ', h('strong', { 'data-field': 'planned-hours' }, view.plannedHours), ' (overtime ', h('strong', { 'data-field': 'overtime' }, view.overtime), ')'),
      ),
      situations(ctx),
      LEVEL_PANELS[run.levelId]?.(ctx),
      lastWeek(run),
      h('div', { class: 'end-week' }, h('button', { 'data-action': 'end-week', onClick: () => send({ kind: 'endWeek' }, 'end-week') }, 'End week'), errorFor('end-week')),
    );
  }

  // @spec UI-WEEK-002
  function situations(ctx: ScreenContext) {
    return h(
      'section',
      { 'data-panel': 'situations' },
      h('h2', {}, 'This week'),
      ctx.run.presented.length === 0 ? h('p', {}, 'A quiet week.') : null,
      ctx.run.presented.map(({ presentation: p, status, aftermath }) =>
        h(
          'article',
          { 'data-situation': p.id, 'data-status': status, class: 'situation' },
          h('h3', {}, titles.get(p.situationId) ?? p.situationId),
          h('p', { 'data-part': 'text' }, emphasis(p.text)),
          status === 'open'
            ? h('div', { class: 'choices' }, p.choices.map((c) => h('button', { 'data-choice': c.id, onClick: () => ctx.send({ kind: 'answer', presentationId: p.id, choiceId: c.id }, `situation:${p.id}`) }, c.label)))
            : status === 'answered'
              ? h('p', { 'data-part': 'aftermath', class: 'aftermath' }, aftermath ?? '')
              : h('p', { class: 'aftermath' }, 'This no longer applies: someone involved has gone.'),
          ctx.errorFor(`situation:${p.id}`),
        ),
      ),
    );
  }

  // @spec UI-REVIEW-001
  function reviewScreen(ctx: ScreenContext) {
    const review = ctx.run.review!;
    return h(
      'section',
      { 'data-screen': 'review', class: 'review' },
      h('h1', {}, `Week ${ctx.run.sim.week} review`),
      h('p', { class: 'outcome' }, h('strong', { 'data-field': 'outcome' }, OUTCOMES[review.outcome])),
      h('p', {}, 'Rating: ', h('strong', { 'data-field': 'rating' }, review.rating), ' (score ', h('span', { 'data-field': 'score' }, review.score.toFixed(2)), ')'),
      h(
        'table',
        { class: 'measures' },
        h('tr', {}, h('th', {}, 'Measure'), h('th', {}, 'Value'), h('th', {}, 'Target'), h('th', {}, 'Verdict')),
        review.measures.map((m) =>
          h(
            'tr',
            { 'data-measure': m.id },
            h('td', {}, m.id),
            h('td', { 'data-field': 'value' }, round(m.value)),
            h('td', { 'data-field': 'target' }, `${round(m.target)} ± ${round(m.tolerance)} (${m.better} is better)`),
            h('td', { 'data-field': 'verdict' }, m.verdict),
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
            h('span', { 'data-field': 'status' }, d.status),
            d.status === 'resolved' ? h('p', { 'data-field': 'text' }, d.debrief ?? '') : null,
          ),
        ),
      ),
      h('div', {}, h('button', { 'data-action': 'acknowledge', onClick: () => ctx.send({ kind: 'acknowledge' }, 'acknowledge') }, 'Acknowledge'), ctx.errorFor('acknowledge')),
    );
  }

  // @spec UI-END-001
  function endedScreen(run: Run) {
    return h(
      'section',
      { 'data-screen': 'ended', class: 'ended' },
      h('h1', {}, 'The end'),
      h('p', { 'data-field': 'ending' }, run.ending ? ENDINGS[run.ending] : ''),
      h('p', {}, `Week ${run.sim.week}, seed ${run.seed}.`),
      h('button', { 'data-action': 'new-run', onClick: () => {
        state = { screen: 'start', seed: options.newSeed() };
        error = null;
        drafts.clear();
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
      const level: AnyLevel | undefined = options.deps.levels.find((l) => l.params.id === run.levelId);
      if (!level) screen = unavailableScreen(run);
      else {
        const ctx: ScreenContext = { run, deps: options.deps, view: level.view(run.level, run.sim, run.plan), send, errorFor, redraw: render, drafts };
        screen = run.phase === 'planning' ? weekScreen(ctx) : run.phase === 'review' ? reviewScreen(ctx) : endedScreen(run);
      }
    }
    root.replaceChildren();
    const errors = contentErrors();
    if (errors) root.append(errors as Node);
    root.append(screen as Node);
    restoreFocus(root, focus);
  }

  render();
  return { state: (): AppState => structuredClone(state) };
}

const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** The data attributes that identify a control and the row it sits in, so it can be found again after a redraw. */
const CONTROL_KEYS = ['data-input', 'data-action', 'data-choice'];
const ROW_KEYS = ['data-demand', 'data-entry', 'data-situation', 'data-form', 'data-person', 'data-project'];

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

/** The level's report from the week just ended, and the situations' aftermath lines. */
// @spec UI-WEEK-004
function lastWeek(run: Run): Child {
  if (!run.lastWeek) return null;
  const report = run.lastWeek.report as {
    dropped: { reason: string }[];
    delegations: { demandId: string; to: string; succeeded: boolean }[];
    undelegated: { demandId: string; reason: string }[];
    voided: { demandId: string; reason: string }[];
    expired: string[];
    demands?: Record<string, { type: string; subject: { kind: string; id: string } }>;
  };
  const name = (id: string) => run.sim.people[id]?.name ?? id;
  const subjectName = ({ kind, id }: { kind: string; id: string }) =>
    kind === 'person' ? name(id) : kind === 'project' ? (run.sim.projects[id]?.name ?? id) : (run.sim.teams[id]?.name ?? id);
  // A reported demand has left the inbox, so it is named by what it was, not its id.
  const demand = (id: string) => {
    const d = report.demands?.[id];
    return d ? `${d.type} for ${subjectName(d.subject)}` : id;
  };
  const list = (part: string, title: string, items: string[]) =>
    h('div', { 'data-part': part }, items.length ? [h('h3', {}, title), h('ul', {}, items.map((i) => h('li', {}, i)))] : null);
  return h(
    'section',
    { 'data-panel': 'last-week', class: 'last-week' },
    h('h2', {}, 'Last week'),
    list('aftermaths', 'How it went', run.lastWeek.aftermaths),
    list('delegations', 'Delegated', report.delegations.map((d) => `${demand(d.demandId)} to ${name(d.to)}: ${d.succeeded ? 'handled' : 'a stretch, with some fallout'}`)),
    list('undelegated', 'Not delegated', report.undelegated.map((d) => `${demand(d.demandId)}: ${d.reason}`)),
    list('voided', 'Decisions with nothing to act on', report.voided.map((d) => `${demand(d.demandId)}: ${d.reason}`)),
    list('dropped', 'Calendar entries dropped', report.dropped.map((d) => d.reason)),
    list('expired', 'Left too long', report.expired.map(demand)),
  );
}
