/// <reference types="node" />
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { compileSituations } from './scripts/compile-situations';

/** Where situation files live; the build test points this elsewhere to check that invalid content fails the build. */
// Resolved from this file, not the working directory, so the build finds content however Vite is started.
const SITUATIONS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), process.env.SITUATIONS_DIR ?? 'content/situations');
const VIRTUAL = 'virtual:situations';

/** Compiles the situation files into the bundle the page imports, failing the build on any invalid situation. */
// @spec UI-BUILD-001
function situations(): Plugin {
  return {
    name: 'situations',
    resolveId: (id) => (id === VIRTUAL ? `\0${VIRTUAL}` : undefined),
    // In development, a situation file added or removed reloads the page with a freshly compiled bundle.
    configureServer(server) {
      server.watcher.add(SITUATIONS_DIR);
      const reload = (path: string) => {
        if (!path.startsWith(SITUATIONS_DIR) || !path.endsWith('.md')) return;
        const module = server.moduleGraph.getModuleById(`\0${VIRTUAL}`);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
    load(id) {
      if (id !== `\0${VIRTUAL}`) return undefined;
      const paths = readdirSync(SITUATIONS_DIR).filter((f) => f.endsWith('.md')).sort().map((f) => join(SITUATIONS_DIR, f));
      for (const path of paths) this.addWatchFile(path);
      const result = compileSituations(paths.map((path) => ({ path, text: readFileSync(path, 'utf8') })));
      if (!result.ok) throw new Error(`invalid situations:\n${result.errors.map((e) => `${e.path}: ${e.message}`).join('\n')}`);
      return `export default ${JSON.stringify(result.bundle)};`;
    },
  };
}

/**
 * The Content-Security-Policy the game runs under, carried in the page so it applies on hosts that cannot send
 * headers. No inline script, no eval, and no network connections at all. Production only: the development server
 * injects styles inline for live reloading.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// @spec UI-BUILD-002
function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  plugins: [situations(), contentSecurityPolicy()],
  // Assets are never inlined as data: URLs, which the policy's img-src 'self' would block.
  // @spec UI-BUILD-003
  build: { sourcemap: false, modulePreload: { polyfill: false }, assetsInlineLimit: 0 },
});
