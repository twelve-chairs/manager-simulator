import { describe, expect, it } from 'vitest';
import { buildVersion, type Git } from '../../scripts/version';

/** A git that answers the three questions the build asks, as a repository with this history would. */
const repo = ({ shallow = false, count = '142', hash = '93face2' } = {}): Git => (args) => {
  const key = args.join(' ');
  if (key === 'rev-parse --is-shallow-repository') return `${shallow}\n`;
  if (key === 'rev-list --count HEAD') return `${count}\n`;
  if (key === 'rev-parse --short HEAD') return `${hash}\n`;
  throw new Error(`unexpected git ${key}`);
};

describe('the version', () => {
  // @spec UI-BUILD-004
  it('is the major and minor from package.json, the commit count and the short hash', () => {
    expect(buildVersion('build', '0.1.0', repo())).toBe('v0.1.142 (93face2)');
    expect(buildVersion('build', '2.7.9', repo({ count: '5', hash: 'abc1234' }))).toBe('v2.7.5 (abc1234)');
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
