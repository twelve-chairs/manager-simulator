/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const page = (name: string) => readFileSync(new URL(`../../redirect/${name}`, import.meta.url), 'utf8');
const workflow = parse(readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8')) as { jobs: Record<string, { steps: { uses?: string; with?: Record<string, string>; run?: string }[] }> };

describe('the old address', () => {
  // @spec UI-HOST-007
  it('publishes to GitHub Pages only a page with no script that sends the browser to the domain and links there', () => {
    for (const name of ['index.html', '404.html']) {
      const html = page(name);
      expect(html).not.toMatch(/<script/i);
      expect(html).toContain('<meta http-equiv="refresh" content="0; url=https://www.manager-simulator.io/">');
      expect(html).toContain('<a href="https://www.manager-simulator.io/">');
      expect(html).toContain("default-src 'none'");
    }
    const upload = workflow.jobs.build!.steps.find((s) => s.uses?.startsWith('actions/upload-pages-artifact@'));
    expect(upload?.with?.path).toBe('redirect');
    expect(workflow.jobs.build!.steps.some((s) => s.run?.includes('--base=/manager-simulator/'))).toBe(false);
  });
});
