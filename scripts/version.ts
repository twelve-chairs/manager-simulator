/// <reference types="node" />
import { execFileSync } from 'node:child_process';

/** Runs git with the given arguments and returns its output; throws when git is missing or fails. */
export type Git = (args: string[]) => string;

/** The real git, run in `cwd`. */
export const git = (cwd: string): Git => (args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/**
 * The version a build is stamped with: `v<major>.<minor>.<commit count> (<short hash>)`, `unversioned` when git or
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
    count = run(['rev-list', '--count', 'HEAD']).trim();
    hash = run(['rev-parse', '--short', 'HEAD']).trim();
  } catch {
    return 'unversioned';
  }
  if (!/^\d+$/.test(count) || !/^[0-9a-f]+$/.test(hash)) return 'unversioned';
  return `v${match[1]}.${match[2]}.${count} (${hash})`;
}
