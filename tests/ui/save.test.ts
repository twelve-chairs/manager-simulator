// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { contentFingerprint, toSave } from '../../src/save';
import { createApp } from '../../src/ui/app';
import { $, $$, CONTENT, DEPS, click, endWeeks, run, step, text } from './fixtures';

const KEY = 'manager-simulator.save';
const FP = contentFingerprint(CONTENT);

/** A storage that behaves like localStorage, and can be told to throw on everything or only on writes. */
function memoryStorage(initial: Record<string, string> = {}, broken = false) {
  const data = new Map(Object.entries(initial));
  const failing = { all: broken, writes: false };
  const guard = (write = false) => {
    if (failing.all || (write && failing.writes)) throw new Error('storage unavailable');
  };
  return {
    data,
    failing,
    getItem: (k: string) => (guard(), data.get(k) ?? null),
    setItem: (k: string, v: string) => (guard(true), void data.set(k, v)),
    removeItem: (k: string) => (guard(), void data.delete(k)),
  };
}

function app(storage: ReturnType<typeof memoryStorage>, seeds = [42, 43]) {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const a = createApp(root, { content: CONTENT, contentErrors: [], showContentErrors: false, deps: DEPS, newSeed: () => seeds.shift() ?? 99, version: 'v0.0.1 (0000000)', storage });
  return { root, app: a };
}

const saved = (storage: ReturnType<typeof memoryStorage>) => JSON.parse(storage.data.get(KEY)!);

afterEach(() => vi.restoreAllMocks());

/** Ends the week from the scene the page opens on: past Before Monday or the recap, which have no End the week beside them. */
function endTheWeek(root: ParentNode) {
  for (const opener of ['[data-action=start-week]', '[data-action=close-recap]']) if (root.querySelector(opener)) click(root, opener);
  click(root, '[data-action=end-week]');
}

describe('saving', () => {
  // @spec UI-SHELL-001, UI-SAVE-001
  it('resumes a saved run on load, and shows the start screen without one', () => {
    expect($(app(memoryStorage()).root, '[data-screen]').dataset.screen).toBe('start');
    const r = endWeeks(run(3), 2);
    const { root } = app(memoryStorage({ [KEY]: JSON.stringify(toSave(r, FP)) }));
    expect($(root, '[data-screen]').dataset.screen).toBe('week');
    expect(text(root, '[data-field=week]')).toBe('2');
  });

  // @spec UI-SAVE-002
  it('saves when a run begins and after every command', () => {
    const storage = memoryStorage();
    const { root } = app(storage);
    click(root, '[data-action=begin]');
    expect(saved(storage)).toMatchObject({ seed: 42, content: FP, commands: [] });
    endTheWeek(root);
    expect(saved(storage).commands).toEqual([{ kind: 'endWeek' }]);
  });

  // @spec UI-SAVE-003
  it('says a run was rebuilt until the next command', () => {
    const r = endWeeks(run(3), 2);
    const stale = { ...toSave(r, 'not-this-content'), commands: [...r.commands, { kind: 'acknowledge' }] };
    const { root } = app(memoryStorage({ [KEY]: JSON.stringify(stale) }));
    expect(text(root, '[data-notice]')).toMatch(/2 of 3/);
    endTheWeek(root);
    expect(root.querySelector('[data-notice]')).toBeNull();
  });

  // @spec UI-SAVE-004
  it('shows the start screen with a message when a stored save fails, keeping it', () => {
    const storage = memoryStorage({ [KEY]: '{"format": "nonsense"}' });
    const { root } = app(storage);
    expect($(root, '[data-screen]').dataset.screen).toBe('start');
    expect(text(root, '[data-notice]')).toMatch(/could not/i);
    expect(storage.data.get(KEY)).toBe('{"format": "nonsense"}');
  });

  // @spec UI-SAVE-005
  it('keeps playing without saving when storage fails, saying so once', () => {
    const { root } = app(memoryStorage({}, true));
    click(root, '[data-action=begin]');
    expect(text(root, '[data-notice]')).toMatch(/not be saved/i);
    endTheWeek(root);
    expect(text(root, '[data-field=week]')).toBe('1');
    expect(root.querySelector('[data-notice]')).toBeNull();
  });

  // @spec UI-SAVE-005
  it('removes the stored save when a write fails, so a reload cannot resume a stale run', () => {
    const storage = memoryStorage({ [KEY]: JSON.stringify(toSave(endWeeks(run(3), 2), FP)) });
    const { root } = app(storage);
    storage.failing.writes = true;
    endTheWeek(root);
    expect(storage.data.has(KEY)).toBe(false);
    expect(text(root, '[data-notice]')).toMatch(/not be saved/i);
  });

  // @spec UI-SAVE-006
  it('exports the save as a named JSON file and revokes the object URL', async () => {
    const r = endWeeks(run(3), 2);
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fake');
    const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    const { root } = app(memoryStorage({ [KEY]: JSON.stringify(toSave(r, FP)) }));
    click(root, '[data-action=export]');
    expect(created).toHaveBeenCalledTimes(1);
    // on the recap of the second week, the header shows week 2
    expect(clicked[0]!.download).toBe('manager-simulator-3-week-2.json');
    expect(clicked[0]!.getAttribute('href')).toBe('blob:fake');
    await vi.waitFor(() => expect(revoked).toHaveBeenCalledWith('blob:fake'));
    // once the third week starts, the header and the file name both say week 3
    click(root, '[data-action=close-recap]');
    expect(text(root, '[data-field=week]')).toBe('3');
    click(root, '[data-action=export]');
    expect(clicked[1]!.download).toBe('manager-simulator-3-week-3.json');
    expect(document.body.querySelector('a[download]')).toBeNull();
  });

  // @spec UI-SAVE-009
  it('offers loading a saved game from a run screen as a button beside export and discard', () => {
    const { root } = app(memoryStorage({ [KEY]: JSON.stringify(toSave(run(2), FP)) }));
    expect($(root, '[data-screen]').dataset.screen).toBe('week');
    const panel = $(root, '[data-panel=save]');
    expect($$(panel, 'button').map((b) => b.textContent)).toEqual(['Export save', 'Load a saved game', 'Discard and start over']);
    const input = $(panel, '[data-input=import]') as HTMLInputElement;
    expect(input.hidden).toBe(true);
    let opened = 0;
    input.click = () => void opened++;
    click(panel, '[data-action=load]');
    expect(opened).toBe(1);
  });

  // @spec UI-SAVE-007
  it('imports a save file, replacing the run, or explains why not', async () => {
    const storage = memoryStorage();
    const { root, app: a } = app(storage);
    const r = endWeeks(run(9), 3);
    const choose = async (contents: string) => {
      const input = $(root, '[data-input=import]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [new File([contents], 'save.json', { type: 'application/json' })], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await vi.waitFor(() => expect(root.querySelector('[data-notice]') ?? root.querySelector('[data-screen=week]')).not.toBeNull());
    };
    await choose(JSON.stringify(toSave(r, FP)));
    const state = a.state();
    expect(state.screen === 'run' && state.run).toEqual(r);
    expect(saved(storage).seed).toBe(9);

    // over a run in progress, nothing is replaced until the player confirms
    const other = endWeeks(run(4), 1);
    const pick = (contents: string) => {
      const input = $(root, '[data-input=import]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [new File([contents], 'save.json')], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    pick(JSON.stringify(toSave(other, FP)));
    expect(a.state()).toEqual(state);
    click(root, '[data-action=cancel-import]');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(a.state()).toEqual(state);
    pick(JSON.stringify(toSave(other, FP)));
    click(root, '[data-action=confirm-import]');
    await vi.waitFor(() => expect((a.state() as { run: { seed: number } }).run.seed).toBe(4));
    await choose(JSON.stringify(toSave(r, FP)));
    click(root, '[data-action=confirm-import]');
    await vi.waitFor(() => expect((a.state() as { run: { seed: number } }).run.seed).toBe(9));

    const before = a.state();
    await choose('{"not": "a save"}');
    click(root, '[data-action=confirm-import]');
    await vi.waitFor(() => expect(root.querySelector('[data-notice]')).not.toBeNull());
    expect(text(root, '[data-notice]')).toMatch(/could not/i);
    expect(a.state()).toEqual(before);

    // a file too large to be a save is refused before it is read
    const input = $(root, '[data-input=import]') as HTMLInputElement;
    const huge = { size: 6 * 1024 * 1024, text: vi.fn() };
    Object.defineProperty(input, 'files', { value: [huge], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    click(root, '[data-action=confirm-import]');
    expect(huge.text).not.toHaveBeenCalled();
    expect(text(root, '[data-notice]')).toMatch(/too large/i);

    // a file that cannot be read says so
    const unreadable = { size: 10, text: () => Promise.reject(new Error('gone')) };
    Object.defineProperty($(root, '[data-input=import]'), 'files', { value: [unreadable], configurable: true });
    $(root, '[data-input=import]').dispatchEvent(new Event('change', { bubbles: true }));
    click(root, '[data-action=confirm-import]');
    await vi.waitFor(() => expect(text(root, '[data-notice]')).toMatch(/could not be read/i));

    // when two files are chosen in a row, the later choice wins even if the earlier one finishes reading last
    let finishSlow: (text: string) => void = () => {};
    const slow = { size: 10, text: () => new Promise<string>((resolve) => (finishSlow = resolve)) };
    const fast = { size: 10, text: () => Promise.resolve(JSON.stringify(toSave(endWeeks(run(4), 1), FP))) };
    Object.defineProperty($(root, '[data-input=import]'), 'files', { value: [slow], configurable: true });
    $(root, '[data-input=import]').dispatchEvent(new Event('change', { bubbles: true }));
    click(root, '[data-action=confirm-import]');
    Object.defineProperty($(root, '[data-input=import]'), 'files', { value: [fast], configurable: true });
    $(root, '[data-input=import]').dispatchEvent(new Event('change', { bubbles: true }));
    click(root, '[data-action=confirm-import]');
    await vi.waitFor(() => expect(a.state().screen === 'run' && (a.state() as { run: { seed: number } }).run.seed).toBe(4));
    finishSlow(JSON.stringify(toSave(r, FP)));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((a.state() as { run: { seed: number } }).run.seed).toBe(4);
  });

  // @spec UI-SAVE-008
  it('discards the saved run after confirmation and returns to the start screen', () => {
    const r = step(run(3), { kind: 'endWeek' });
    const storage = memoryStorage({ [KEY]: JSON.stringify(toSave(r, FP)) });
    const { root, app: a } = app(storage, [77]);
    click(root, '[data-action=discard]');
    expect($(root, '[data-screen]').dataset.screen).toBe('week');
    expect(storage.data.has(KEY)).toBe(true);
    click(root, '[data-action=cancel-discard]');
    expect(root.querySelector('[data-action=confirm-discard]')).toBeNull();
    expect(storage.data.has(KEY)).toBe(true);
    click(root, '[data-action=discard]');
    click(root, '[data-action=confirm-discard]');
    expect(storage.data.has(KEY)).toBe(false);
    expect($(root, '[data-screen]').dataset.screen).toBe('start');
    click(root, '[data-action=begin]');
    const state = a.state();
    expect(state.screen === 'run' && state.run.seed).toBe(77);
  });
});
