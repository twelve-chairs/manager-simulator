/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SITE = 'https://www.manager-simulator.io/';
const root = (path: string) => new URL(`../../${path}`, import.meta.url);
const head = readFileSync(root('index.html'), 'utf8').split('</head>')[0]!;
/** A meta tag's content, by its name or property. */
const meta = (key: string) => new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`).exec(head)?.[1];
/** A PNG's width and height, from its header. */
const size = (path: string) => {
  const png = readFileSync(root(path));
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
};

describe('sharing and search', () => {
  // @spec UI-SHARE-001
  it('describes the game, names its canonical address, and gives Open Graph its title, description, URL and image', () => {
    expect(meta('description')).toMatch(/^You just got promoted\./);
    expect(head).toContain(`<link rel="canonical" href="${SITE}" />`);
    expect(meta('og:type')).toBe('website');
    expect(meta('og:title')).toBe('Manager Simulator');
    expect(meta('og:description')?.length).toBeGreaterThan(50);
    expect(meta('og:url')).toBe(SITE);
    expect(meta('og:image')).toBe(`${SITE}og-image.png`);
    expect([meta('og:image:width'), meta('og:image:height')]).toEqual(['1200', '630']);
    expect(meta('og:image:alt')?.length).toBeGreaterThan(20);
  });

  // @spec UI-SHARE-002
  it('gives a large-image Twitter card and a theme colour', () => {
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('twitter:title')).toBe('Manager Simulator');
    expect(meta('twitter:description')?.length).toBeGreaterThan(20);
    expect(meta('twitter:image')).toBe(`${SITE}og-image.png`);
    expect(meta('theme-color')).toMatch(/^#[0-9a-f]{6}$/);
  });

  // @spec UI-SHARE-003
  it('ships the preview image and the icons at their sizes, each linked from the head or the manifest', () => {
    expect(size('public/og-image.png')).toEqual({ width: 1200, height: 630 });
    expect(size('public/favicon-32.png')).toEqual({ width: 32, height: 32 });
    expect(size('public/apple-touch-icon.png')).toEqual({ width: 180, height: 180 });
    expect(readFileSync(root('public/favicon.svg'), 'utf8')).toMatch(/^<svg /);
    for (const link of ['<link rel="icon" href="/favicon.svg" type="image/svg+xml" />', '<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />', '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />', '<link rel="manifest" href="/site.webmanifest" />']) expect(head).toContain(link);
    const manifest = JSON.parse(readFileSync(root('public/site.webmanifest'), 'utf8')) as { icons: { src: string; sizes: string }[] };
    for (const icon of manifest.icons) {
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(size(`public${icon.src}`)).toEqual({ width: w, height: h });
    }
    expect(manifest.icons.map((i) => i.sizes)).toEqual(['192x192', '512x512']);
  });

  // @spec UI-SHARE-004
  it('lets every crawler in and names the sitemap, which lists the game’s address', () => {
    const robots = readFileSync(root('public/robots.txt'), 'utf8');
    expect(robots).toMatch(/^User-agent: \*\nAllow: \/\n/);
    expect(robots).toContain(`Sitemap: ${SITE}sitemap.xml`);
    expect(readFileSync(root('public/sitemap.xml'), 'utf8')).toContain(`<loc>${SITE}</loc>`);
  });

  // @spec UI-SHARE-005
  it('loads nothing from another origin and holds no inline script', () => {
    for (const [, url] of head.matchAll(/(?:href|src)="([^"]+)"/g)) expect(url!.startsWith('/') || url!.startsWith(SITE), url).toBe(true);
    for (const [, url] of head.matchAll(/content="(https?:[^"]+)"/g)) expect(url!.startsWith(SITE), url).toBe(true);
    expect(head).not.toMatch(/<script/);
  });
});
