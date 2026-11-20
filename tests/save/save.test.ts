import { describe, expect, it } from 'vitest';
import { lineManagerLevel } from '../../src/levels/line-manager';
import { newRun, type Dependencies, type Run } from '../../src/loop';
import { conductReview } from '../../src/review';
import { contentFingerprint, parseSave, restore, toSave, type Save } from '../../src/save';
import { realContent } from '../balance/harness';
import { CONTENT, answerCurrent, step } from '../loop/fixtures';

const DEPS: Dependencies = { levels: [lineManagerLevel], review: conductReview };
const run = (seed: number) => newRun(seed, CONTENT, DEPS);

const FP = contentFingerprint(CONTENT);

/** An independent FNV-1a so the test does not trust the code it checks. */
function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) h = Math.imul(h ^ byte, 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** A run with a few weeks of mixed commands. */
function played(): Run {
  let r = run(5);
  for (let week = 0; week < 4; week++) {
    if (week === 1) r = step(r, { kind: 'plan', command: { kind: 'habit', habit: 'ceremonies', value: 'light' } }, DEPS);
    r = answerCurrent(r, week, DEPS);
    r = step(r, { kind: 'wait' }, DEPS);
    r = step(r, { kind: 'endWeek' }, DEPS);
  }
  return r;
}

const valid = (): Save => toSave(played(), FP);
const reject = (value: unknown) => {
  const result = parseSave(typeof value === 'string' ? value : JSON.stringify(value));
  expect(result.ok).toBe(false);
};

describe('the save', () => {
  // @spec SAVE-FORMAT-001
  it('holds the format, version, seed, fingerprint and commands', () => {
    const r = played();
    expect(toSave(r, FP)).toEqual({ format: 'manager-simulator-save', version: 2, seed: 5, content: FP, commands: r.commands });
  });

  // @spec SAVE-FORMAT-002
  it('fingerprints content with FNV-1a over its JSON', () => {
    expect(contentFingerprint(CONTENT)).toBe(fnv1a(JSON.stringify(CONTENT)));
    expect(contentFingerprint([])).toBe(fnv1a('[]'));
    const edited = structuredClone(CONTENT);
    edited[0]!.text = 'Something else happens.';
    expect(contentFingerprint(edited)).not.toBe(FP);
  });
});

describe('parsing', () => {
  // @spec SAVE-PARSE-001
  it('rejects text over 5 MB before parsing it', () => {
    const huge = `{"x": "${'a'.repeat(5 * 1024 * 1024)}"}`;
    const result = parseSave(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/large|size/i);
  });

  // @spec SAVE-PARSE-002
  it('rejects invalid JSON without throwing', () => {
    for (const text of ['', 'not json', '{', '[1,', 'undefined']) expect(() => reject(text)).not.toThrow();
  });

  // @spec SAVE-PARSE-003
  it('rejects saves with the wrong fields, format, version, seed, content or commands', () => {
    const s = valid();
    expect(parseSave(JSON.stringify(s))).toEqual({ ok: true, save: s });
    reject(null);
    reject([s]);
    reject(42);
    const { commands: _c, ...missing } = s;
    reject(missing);
    reject({ ...s, extra: 1 });
    reject(`{"__proto__": {"polluted": true}, ${JSON.stringify(s).slice(1)}`);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    reject({ ...s, format: 'something-else' });
    reject({ ...s, version: 1 });
    reject({ ...s, version: 3 });
    for (const seed of [-1, 1.5, 4294967296, '5', null]) reject({ ...s, seed });
    reject({ ...s, content: 'x'.repeat(65) });
    reject({ ...s, content: 7 });
    reject({ ...s, commands: 'endWeek' });
    reject({ ...s, commands: Array.from({ length: 10_001 }, () => ({ kind: 'endWeek' })) });
    expect(parseSave(JSON.stringify({ ...s, commands: Array.from({ length: 10_000 }, () => ({ kind: 'endWeek' })) })).ok).toBe(true);
    expect(parseSave(JSON.stringify({ ...s, seed: 4294967295 })).ok).toBe(true);
  });

  // @spec SAVE-PARSE-004
  it('rejects commands of unknown kinds or the wrong shape', () => {
    const s = valid();
    const withCommand = (command: unknown) => ({ ...s, commands: [command] });
    for (const bad of [
      null,
      'endWeek',
      { kind: 'cheat' },
      { kind: 'endWeek', extra: true },
      { kind: 'answer', momentId: 1, choiceId: 'x' },
      { kind: 'answer', momentId: 'p' },
      { kind: 'answer', presentationId: 'p', choiceId: 'c' },
      { kind: 'wait', extra: 1 },
      { kind: 'plan' },
      JSON.parse('{"kind": "acknowledge", "__proto__": {}}'),
    ]) reject(withCommand(bad));
    for (const ok of [{ kind: 'endWeek' }, { kind: 'acknowledge' }, { kind: 'answer', momentId: 'p', choiceId: 'c' }, { kind: 'wait' }, { kind: 'plan', command: { anything: [1, 2] } }, { kind: 'plan', command: null }]) {
      expect(parseSave(JSON.stringify(withCommand(ok))).ok).toBe(true);
    }
  });
});

describe('restoring', () => {
  // @spec SAVE-RESTORE-001, SAVE-RESTORE-002
  it('replays commands until the first refusal and reports a rebuild', () => {
    const s = valid();
    const bad = { ...s, commands: [...s.commands.slice(0, 3), { kind: 'acknowledge' as const }, ...s.commands.slice(3)] };
    const result = restore(bad, CONTENT, DEPS, FP);
    expect(result.applied).toBe(3);
    expect(result.total).toBe(bad.commands.length);
    expect(result.rebuilt).toBe(true);
    expect(result.run.commands).toEqual(s.commands.slice(0, 3));

    const clean = restore(s, CONTENT, DEPS, FP);
    expect(clean).toMatchObject({ applied: s.commands.length, total: s.commands.length, rebuilt: false });
    expect(restore(s, CONTENT, DEPS, 'different').rebuilt).toBe(true);
  });

  // @spec SAVE-RESTORE-001, SAVE-RESTORE-002
  it('stops replaying at week 1,040, so a crafted save cannot freeze the page', { timeout: 30_000 }, () => {
    // 13 weeks then an acknowledge, over and over: a run that only idles can last far past any real one
    const commands: Save['commands'] = [];
    while (commands.length < 10_000) {
      for (let i = 0; i < 13; i++) commands.push({ kind: 'endWeek' });
      commands.push({ kind: 'acknowledge' });
    }
    // the real content: with it, this seed's idle run keeps going for thousands of weeks
    const content = realContent();
    const fingerprint = contentFingerprint(content);
    const long: Save = { ...valid(), seed: 1, content: fingerprint, commands: commands.slice(0, 10_000) };
    const started = performance.now();
    const result = restore(long, content, DEPS, fingerprint);
    const took = performance.now() - started;
    expect(result.run.sim.week).toBe(1040);
    expect(result.applied).toBeLessThan(long.commands.length);
    expect(result.rebuilt).toBe(true);
    // a guard against the multi-second freeze coming back, loose enough for a slow machine
    expect(took).toBeLessThan(5_000);
  });

  // @spec SAVE-RESTORE-003
  it('rebuilds the identical run with the same content', () => {
    const r = played();
    expect(restore(toSave(r, FP), CONTENT, DEPS, FP).run).toEqual(r);
    const parsed = parseSave(JSON.stringify(toSave(r, FP)));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(restore(parsed.save, CONTENT, DEPS, FP).run).toEqual(r);
  });

  // @spec SAVE-RESTORE-004, LINE-CONTRACT-005
  it('never throws, whatever the commands were edited to', () => {
    const s = valid();
    const nasty: unknown[] = [
      { kind: 'habit' },
      { kind: 'habit', habit: 'growth', value: null },
      { kind: 'habit', habit: '__proto__', value: 'x' },
      { kind: 'habit', habit: 'toString', value: 'me' },
      { kind: 'habit', habit: ['growth'], value: 'nobody' },
      { kind: 'calendar', add: [{ action: 'line-manager.coaching', target: null, cadence: 'once' }] },
      [],
      'text',
      42,
    ];
    for (const command of nasty) {
      const save = { ...s, commands: [{ kind: 'plan' as const, command }, ...s.commands] };
      expect(() => restore(save, CONTENT, DEPS, FP)).not.toThrow();
    }
    // even a level that throws stops the replay rather than the game
    const throwing: Dependencies = { ...DEPS, levels: [{ ...lineManagerLevel, plan: () => { throw new Error('boom'); } }] };
    const save = { ...s, commands: [{ kind: 'plan' as const, command: {} }, ...s.commands] };
    const result = restore(save, CONTENT, throwing, FP);
    expect(result).toMatchObject({ applied: 0, rebuilt: true });
  });
});
