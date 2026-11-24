/// <reference types="node" />
import { execFileSync } from 'node:child_process';

/** Runs git with the given arguments and returns its output; throws when git is missing or fails. */
export type Git = (args: string[]) => string;

/** The real git, run in `cwd`. */
export const git = (cwd: string): Git => (args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/** The major and minor of a package.json's version, or null when it has none. */
function majorMinor(packageJson: string): string | null {
  try {
    const version: unknown = (JSON.parse(packageJson) as { version?: unknown }).version;
    return typeof version === 'string' ? (/^(\d+\.\d+)\./.exec(version)?.[1] ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * The commits since the one that set `current` (major.minor) in package.json, counting that one: of the commits that
 * changed the version line, newest first, the oldest of those at the head of the list with this major and minor.
 * None yet when the newest committed version is another; every commit when no commit ever set a version.
 */
function commitsSince(run: Git, current: string): string {
  const changes = run(['log', '--format=%H', '-G"version"', '--', 'package.json']).split('\n').filter(Boolean);
  let set: string | null = null;
  for (const commit of changes) {
    if (majorMinor(run(['show', `${commit}:package.json`])) !== current) break;
    set = commit;
  }
  if (set) return String(Number(run(['rev-list', '--count', `${set}..HEAD`]).trim()) + 1);
  return changes.length ? '0' : run(['rev-list', '--count', 'HEAD']).trim();
}

/**
 * The version a build is stamped with: `v<major>.<minor>.<commits since major.minor was set> (<short hash>)`, `unversioned` when git or
 * the whole history is not there (a shallow clone would count too few commits), and `development` on the dev server.
 */
// @spec UI-BUILD-004, UI-BUILD-005, UI-BUILD-006
export function buildVersion(command: 'serve' | 'build', packageVersion: string, run: Git): string {
  if (command === 'serve') return 'development';
  const match = /^(\d+)\.(\d+)\.\d+/.exec(packageVersion);
  // A malformed version is a typo in package.json, not a missing history, so the build fails rather than hiding it.
  if (!match) throw new Error(`package.json version "${packageVersion}" is not major.minor.patch`);
  let count: string;
  let hash: string;
  try {
    if (run(['rev-parse', '--is-shallow-repository']).trim() !== 'false') return 'unversioned';
    count = commitsSince(run, `${match[1]}.${match[2]}`);
    hash = run(['rev-parse', '--short', 'HEAD']).trim();
  } catch {
    return 'unversioned';
  }
  if (!/^\d+$/.test(count) || !/^[0-9a-f]+$/.test(hash)) return 'unversioned';
  return `v${match[1]}.${match[2]}.${count} (${hash})`;
}
