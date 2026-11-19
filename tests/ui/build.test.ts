/// <reference types="node" />
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '../..');

function build(outDir: string, situationsDir?: string) {
  return execFileSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], {
    cwd: ROOT,
    env: { ...process.env, ...(situationsDir && { SITUATIONS_DIR: situationsDir }) },
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]));

describe('the build', () => {
  // @spec UI-BUILD-001
  it('compiles content into static files with no inline script', { timeout: 60_000 }, () => {
    const out = mkdtempSync(join(tmpdir(), 'build-'));
    build(out);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, body] of scripts) expect(body!.trim()).toBe('');
    expect(html).not.toMatch(/\son[a-z]+=/i);
    const js = files(out).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(js).toContain('flight-risk-1on1');
    expect(files(out).some((f) => f.endsWith('.map'))).toBe(false);
  });

  // @spec UI-BUILD-001
  it('fails on an invalid situation', { timeout: 60_000 }, () => {
    const bad = mkdtempSync(join(tmpdir(), 'situations-'));
    writeFileSync(join(bad, 'bad.md'), '---\nid: bad\npriority: sometimes\n---\nText\n');
    expect(() => build(mkdtempSync(join(tmpdir(), 'build-')), bad)).toThrow();
  });
});
