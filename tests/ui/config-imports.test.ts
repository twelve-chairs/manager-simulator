/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '../..'));
/** Every relative module specifier a file imports or re-exports, type-only ones included. */
const specifiers = (file: string) => [...readFileSync(join(ROOT, file), 'utf8').matchAll(/\bfrom\s+['"](\.[^'"]*)['"]/g)].map((m) => m[1]!);

describe('the build configuration', () => {
  // @spec UI-BUILD-007
  it('names the file of every relative import in what Vite\'s configuration loads', () => {
    const seen = new Set<string>();
    const bare: string[] = [];
    const queue = ['vite.config.ts'];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of specifiers(file)) {
        const target = normalize(join(dirname(file), spec));
        if (!/\.(ts|json)$/.test(spec) || !existsSync(join(ROOT, target))) bare.push(`${file}: ${spec}`);
        else if (target.endsWith('.ts')) queue.push(target);
      }
    }
    expect(seen.size).toBeGreaterThan(10);
    expect(bare).toEqual([]);
  });
});
