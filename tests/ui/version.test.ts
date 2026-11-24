import { describe, expect, it } from 'vitest';
import { buildVersion, type Git } from '../../scripts/version';

/**
 * A git that answers the build's questions as a repository would whose commits that changed package.json's version
 * line are `bumps`, newest first, and where `since[c]` commits are reachable from HEAD and not from `c`.
 */
interface Repo {
  shallow?: boolean;
  count?: string;
  hash?: string;
  bumps?: { commit: string; version: string }[];
  since?: Record<string, number>;
}
const repo = ({ shallow = false, count = '142', hash = '93face2', bumps = [], since = {} }: Repo = {}): Git => (args) => {
  const key = args.join(' ');
  if (key === 'rev-parse --is-shallow-repository') return `${shallow}\n`;
  if (key === 'rev-list --count HEAD') return `${count}\n`;
  if (key === 'rev-parse --short HEAD') return `${hash}\n`;
  if (key === 'log --format=%H -G"version" -- package.json') return bumps.map((b) => b.commit).join('\n') + '\n';
  const show = /^show (\w+):package\.json$/.exec(key);
  if (show) return JSON.stringify({ name: 'x', version: bumps.find((b) => b.commit === show[1])!.version });
  const range = /^rev-list --count (\w+)\.\.HEAD$/.exec(key);
  if (range) return `${since[range[1]!]}\n`;
  throw new Error(`unexpected git ${key}`);
};

describe('the version', () => {
  // @spec UI-BUILD-004
  it('is the major and minor from package.json, the commits since they were set and the short hash', () => {
    const history = [
      { commit: 'c4', version: '0.2.1' },
      { commit: 'c3', version: '0.2.0' },
      { commit: 'c2', version: '0.1.0' },
    ];
    // c3 set 0.2 (c4 only changed the patch), and four commits came after it
    expect(buildVersion('build', '0.2.1', repo({ bumps: history, since: { c3: 4 } }))).toBe('v0.2.5 (93face2)');
    // the commit that sets it is 1
    expect(buildVersion('build', '2.7.0', repo({ hash: 'abc1234', bumps: [{ commit: 'c9', version: '2.7.0' }], since: { c9: 0 } }))).toBe('v2.7.1 (abc1234)');
    // a bump not yet committed counts nothing yet
    expect(buildVersion('build', '0.3.0', repo({ bumps: history, since: { c3: 4 } }))).toBe('v0.3.0 (93face2)');
    // no commit ever set a version: every commit counts
    expect(buildVersion('build', '0.1.0', repo())).toBe('v0.1.142 (93face2)');
  });

  // @spec UI-BUILD-005
  it('is unversioned when the history is shallow', () => {
    expect(buildVersion('build', '0.1.0', repo({ shallow: true }))).toBe('unversioned');
  });

  // @spec UI-BUILD-005
  it('is unversioned when git is not available', () => {
    const missing: Git = () => {
      throw new Error('spawn git ENOENT');
    };
    expect(buildVersion('build', '0.1.0', missing)).toBe('unversioned');
  });

  // @spec UI-BUILD-006
  it('is development on the development server, without asking git', () => {
    const untouched: Git = () => {
      throw new Error('git should not be asked');
    };
    expect(buildVersion('serve', '0.1.0', untouched)).toBe('development');
  });
});
