import { lineManagerLevel, type LineState } from '../../src/levels/line-manager';
import { apply, newRun, type Command, type Dependencies, type Run } from '../../src/loop';
import { conductReview } from '../../src/review';
import type { ContentError, Situation } from '../../src/situations';
import { createApp } from '../../src/ui/app';
import { CONTENT } from '../loop/fixtures';

export { CONTENT };

export const DEPS: Dependencies = { levels: [lineManagerLevel], review: conductReview };

export function makeApp(options: { run?: Run; seeds?: number[]; content?: Situation[]; contentErrors?: ContentError[]; showContentErrors?: boolean; deps?: Dependencies; attach?: boolean; version?: string } = {}) {
  const root = document.createElement('div');
  if (options.attach) document.body.replaceChildren(root);
  const seeds = [...(options.seeds ?? [42, 43, 44])];
  const app = createApp(root, {
    content: options.content ?? CONTENT,
    contentErrors: options.contentErrors ?? [],
    showContentErrors: options.showContentErrors ?? false,
    deps: options.deps ?? DEPS,
    newSeed: () => seeds.shift() ?? 99,
    version: options.version ?? 'v0.0.1 (0000000)',
    ...(options.run && { run: options.run }),
  });
  return { root, app };
}

export const $ = (root: ParentNode, selector: string) => {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`no element ${selector}`);
  return el;
};
export const $$ = (root: ParentNode, selector: string) => [...root.querySelectorAll<HTMLElement>(selector)];
export const text = (root: ParentNode, selector: string) => $(root, selector).textContent ?? '';
export const click = (root: ParentNode, selector: string) => $(root, selector).click();

export function select(root: ParentNode, selector: string, value: string) {
  const el = $(root, selector) as unknown as HTMLSelectElement;
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export const run = (seed = 1) => newRun(seed, CONTENT, DEPS);

export function step(r: Run, command: Command): Run {
  const result = apply(r, command, CONTENT, DEPS);
  if (!result.ok) throw new Error(result.error);
  return result.run;
}

export const level = (r: Run) => r.level as LineState;

/** Ends weeks until the run leaves the week phase or `n` weeks have passed. */
export function endWeeks(r: Run, n: number): Run {
  let x = r;
  for (let i = 0; i < n && x.phase === 'week'; i++) x = step(x, { kind: 'endWeek' });
  return x;
}
