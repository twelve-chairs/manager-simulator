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
    // Tag names are case-insensitive in HTML, and browsers end a script at </script followed by anything up to >.
    const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, body] of scripts) expect(body!.trim()).toBe('');
    expect(html).not.toMatch(/\son[a-z]+=/i);
    const js = files(out).filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(js).toContain('flight-risk-1on1');
    expect(files(out).some((f) => f.endsWith('.map'))).toBe(false);
  });

  // @spec UI-BUILD-002
  it('carries a strict Content-Security-Policy in the page', { timeout: 60_000 }, () => {
    const out = mkdtempSync(join(tmpdir(), 'build-'));
    build(out);
    const html = readFileSync(join(out, 'index.html'), 'utf8');
    const meta = html.match(/<head>\s*<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
    expect(meta).not.toBeNull();
    // Read the attribute as a browser does: the build escapes quotes as entities.
    const content = meta![1]!.replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
    const policy = new Map(content.split(';').map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name!, values]));
    expect(policy.get('default-src')).toEqual(["'self'"]);
    expect(policy.get('script-src')).toEqual(["'self'"]);
    expect(policy.get('style-src')).toEqual(["'self'"]);
    expect(policy.get('connect-src')).toEqual(["'none'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'none'"]);
    expect(policy.get('form-action')).toEqual(["'none'"]);
    expect(content).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  // @spec UI-BUILD-003
  it('ships images as files, never inlined as data: URLs the policy would block', { timeout: 60_000 }, () => {
    const out = mkdtempSync(join(tmpdir(), 'build-'));
    build(out);
    const built = files(out);
    for (const f of built.filter((x) => /\.(html|css|js)$/.test(x))) expect({ file: f, inlined: /data:image\//.test(readFileSync(f, 'utf8')) }).toEqual({ file: f, inlined: false });
    const css = built.filter((f) => f.endsWith('.css')).map((f) => readFileSync(f, 'utf8')).join('\n');
    const images = [...css.matchAll(/url\(\s*["']?([^"')]+\.svg)["']?\s*\)/g)].map((m) => m[1]!);
    expect(images.length).toBeGreaterThan(0);
    for (const url of images) expect(built.some((f) => f.endsWith(url.replace(/^.*\//, '')))).toBe(true);
  });

  // @spec UI-BUILD-001
  it('fails on an invalid situation', { timeout: 60_000 }, () => {
    const bad = mkdtempSync(join(tmpdir(), 'situations-'));
    writeFileSync(join(bad, 'bad.md'), '---\nid: bad\npriority: sometimes\n---\nText\n');
    expect(() => build(mkdtempSync(join(tmpdir(), 'build-')), bad)).toThrow();
  });
});
