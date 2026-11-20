import { compareCodeUnits } from '../sim';
import { apply, newRun, type Command, type Dependencies, type Run } from '../loop';
import type { Situation } from '../situations';

export const SAVE_FORMAT = 'manager-simulator-save';
/** Version 2 records the week as a sequence of moments, answered by `momentId`. */
export const SAVE_VERSION = 2;
/** The largest save accepted, as text or as a file. */
export const MAX_SAVE_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = MAX_SAVE_BYTES;
/** About ten years of play; replaying this many takes well under a second, so a tampered save cannot freeze the page. */
const MAX_COMMANDS = 10_000;
const MAX_CONTENT = 64;
const MAX_SEED = 0xffffffff;
/** Twenty years, far past any real run. One command can be a whole week, so only a week limit bounds replay's work. */
export const MAX_REPLAY_WEEK = 1040;

export interface Save {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  seed: number;
  /** Fingerprint of the content the run was played with. */
  content: string;
  commands: Command[];
}

/** 32-bit FNV-1a over UTF-8 bytes, in hexadecimal. A change detector, not a security measure. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(text)) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

// @spec SAVE-FORMAT-002
export const contentFingerprint = (situations: Situation[]): string => fnv1a(JSON.stringify(situations));

// @spec SAVE-FORMAT-001
export function toSave(run: Run, fingerprint: string): Save {
  // Callers serialize the save straight away, so the command list is shared rather than copied on every save.
  return { format: SAVE_FORMAT, version: SAVE_VERSION, seed: run.seed, content: fingerprint, commands: run.commands };
}

type Obj = Record<string, unknown>;
const isObject = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
/** Whether an object has exactly these own keys; a `__proto__` key from JSON is an own key and fails this. */
const hasExactly = (o: Obj, keys: string[]) => {
  const own = Object.keys(o).sort(compareCodeUnits);
  return own.length === keys.length && [...keys].sort(compareCodeUnits).every((k, i) => k === own[i]);
};

function commandError(c: unknown, i: number): string | undefined {
  const where = `command ${i + 1}`;
  if (!isObject(c)) return `${where} is not an object`;
  switch (c.kind) {
    case 'endWeek':
    case 'wait':
    case 'acknowledge':
      return hasExactly(c, ['kind']) ? undefined : `${where} has unexpected fields`;
    case 'answer':
      return hasExactly(c, ['kind', 'momentId', 'choiceId']) && typeof c.momentId === 'string' && typeof c.choiceId === 'string'
        ? undefined
        : `${where} is not a valid answer`;
    case 'plan':
      // The inner command is the career level's to check when it is replayed.
      return hasExactly(c, ['kind', 'command']) ? undefined : `${where} is not a valid plan command`;
    default:
      return `${where} has an unknown kind`;
  }
}

/** Parses and checks a save's text. Never throws; stored game state is never read from it. */
// @spec SAVE-PARSE-001, SAVE-PARSE-002, SAVE-PARSE-003, SAVE-PARSE-004
export function parseSave(text: string): { ok: true; save: Save } | { ok: false; error: string } {
  if (typeof text !== 'string' || text.length > MAX_TEXT) return { ok: false, error: 'the save is too large' };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'the save is not valid JSON' };
  }
  if (!isObject(value) || !hasExactly(value, ['format', 'version', 'seed', 'content', 'commands'])) return { ok: false, error: 'this is not a Manager Simulator save' };
  if (value.format !== SAVE_FORMAT) return { ok: false, error: 'this is not a Manager Simulator save' };
  if (value.version !== SAVE_VERSION) return { ok: false, error: `save version ${String(value.version)} is not supported` };
  const seed = value.seed;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) return { ok: false, error: 'the save has an invalid seed' };
  if (typeof value.content !== 'string' || value.content.length > MAX_CONTENT) return { ok: false, error: 'the save has an invalid content fingerprint' };
  const commands = value.commands;
  if (!Array.isArray(commands) || commands.length > MAX_COMMANDS) return { ok: false, error: 'the save has an invalid command list' };
  for (let i = 0; i < commands.length; i++) {
    const error = commandError(commands[i], i);
    if (error) return { ok: false, error };
  }
  return { ok: true, save: { format: SAVE_FORMAT, version: SAVE_VERSION, seed, content: value.content, commands: commands as Command[] } };
}

export interface Restored {
  run: Run;
  applied: number;
  total: number;
  /** True when the content changed since the save or not every command applied. */
  rebuilt: boolean;
}

/**
 * Rebuilds a run by replaying a save's commands from its seed, stopping at the first command the turn loop refuses
 * or throws on, so a tampered save can shorten a run but never crash the game, and at the week limit, so it cannot
 * freeze the page either.
 */
// @spec SAVE-RESTORE-001, SAVE-RESTORE-002, SAVE-RESTORE-003, SAVE-RESTORE-004
export function restore(save: Save, content: Situation[], deps: Dependencies, fingerprint: string): Restored {
  // Each command is applied to the run without its history, which is kept here instead, so replay does not copy a
  // growing list on every command.
  let run: Run = { ...newRun(save.seed, content, deps), commands: [] };
  const applied: Command[] = [];
  for (const command of save.commands) {
    if (run.sim.week >= MAX_REPLAY_WEEK) break;
    let result: ReturnType<typeof apply>;
    try {
      result = apply(run, command, content, deps);
    } catch {
      break;
    }
    if (!result.ok) break;
    run = { ...result.run, commands: [] };
    applied.push(command);
  }
  const total = save.commands.length;
  return { run: { ...run, commands: structuredClone(applied) }, applied: applied.length, total, rebuilt: fingerprint !== save.content || applied.length < total };
}
