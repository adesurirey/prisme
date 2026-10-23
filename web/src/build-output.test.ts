/**
 * Build-output tests (issue #64): they assert on what the build actually
 * ships, not on source — the manifest must be copied to dist/ with the
 * agreed fields, the PNG icons must land in dist/icons/, and the rendered
 * HTML must reference them. `astro build` runs once in beforeAll against
 * the committed data/ snapshot (ADR-0002).
 */
import { execSync } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const WEB_DIR = path.resolve(import.meta.dirname, '..');

let dist: string;

beforeAll(() => {
  // Strip a stray BASE_URL from the environment: some shells (agents, CI
  // wrappers) export one, and the child build would otherwise pick it up
  // instead of the configured / base.
  const env = { ...process.env };
  delete env.BASE_URL;
  execSync('node_modules/.bin/astro build', {
    cwd: WEB_DIR,
    stdio: 'pipe',
    env,
  });
  dist = path.join(WEB_DIR, 'dist');
});

describe('PWA manifest', () => {
  it('is served from the build output and parses', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(dist, 'manifest.webmanifest'), 'utf8'),
    );
    expect(manifest.name).toBe('Prisme');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.theme_color).toBe('#fcfcfc');
    expect(manifest.background_color).toBe('#fcfcfc');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/icons/icon-192.png' }),
        expect.objectContaining({ src: '/icons/icon-512.png' }),
        expect.objectContaining({
          src: '/icons/maskable-512.png',
          purpose: 'maskable',
        }),
      ]),
    );
  });

  it('references the icon PNGs that are actually built', async () => {
    const manifest = JSON.parse(
      await readFile(path.join(dist, 'manifest.webmanifest'), 'utf8'),
    );
    for (const icon of manifest.icons) {
      const file = path.join(dist, icon.src.replace(/^\//, ''));
      const bytes = await readFile(file);
      // PNG magic number.
      expect([...bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
    for (const name of [
      'icons/apple-touch-icon.png',
      'icons/maskable-192.png',
    ]) {
      expect((await stat(path.join(dist, name))).isFile()).toBe(true);
    }
  });
});

describe('page head tags', () => {
  it('references the manifest and the apple-touch-icon', async () => {
    const html = await readFile(path.join(dist, 'index.html'), 'utf8');
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain(
      'rel="apple-touch-icon" href="/icons/apple-touch-icon.png"',
    );
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain(
      'name="apple-mobile-web-app-title" content="Prisme"',
    );
  });
});

describe('« 7 jours » edition (issue #128, ADR-0027)', () => {
  it('prerenders /7-jours/ with a canonical and both edition names', async () => {
    const html = await readFile(
      path.join(dist, '7-jours', 'index.html'),
      'utf8',
    );
    expect(html).toContain(
      '<link rel="canonical" href="https://leprisme.info/7-jours/">',
    );
    // The editions header: the page's own edition is the h1, the other
    // a link back home (exactly one h1 per page).
    expect(html).toMatch(/<h1[^>]*>\s*7 jours\s*<\/h1>/);
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>\s*Aujourd'hui\s*<\/a>/);
    expect(html).not.toContain('installTrending');
    // No per-reader daily-visit semantics on the weekly page: no
    // trending script, no badge text, no "Nouveau" pill hook.
    expect(html).not.toContain('En hausse');
    expect(html).not.toContain('data-new-pill');
  });

  it('links the home to the weekly edition under its new name', async () => {
    const home = await readFile(path.join(dist, 'index.html'), 'utf8');
    // The toggle: the home's own name is the h1, « 7 jours » links out.
    expect(home).toMatch(/<h1[^>]*>\s*Aujourd'hui\s*<\/h1>/);
    expect(home).toMatch(/<a[^>]*href="\/7-jours\/"[^>]*>\s*7 jours\s*<\/a>/);
    // The h1 moved from « À la une » to « Aujourd'hui » — the old name
    // survives in the sub-page back links, not here.
    expect(home).not.toContain('À la une');
    // The per-reader pill hook stays on the home.
    expect(home).toContain('data-new-pill');
  });

  it('lists /7-jours/ in the sitemap', async () => {
    const sitemap = await readFile(path.join(dist, 'sitemap-0.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://leprisme.info/7-jours/</loc>');
  });
});

describe('SEO head tags (robots, sitemap, canonical, OG/Twitter, JSON-LD)', () => {
  it('ships robots.txt pointing at the sitemap', async () => {
    const robots = await readFile(path.join(dist, 'robots.txt'), 'utf8');
    expect(robots).toContain(
      'Sitemap: https://leprisme.info/sitemap-index.xml',
    );
  });

  it('emits sitemap-index.xml with the Edition and Story URLs', async () => {
    const index = await readFile(path.join(dist, 'sitemap-index.xml'), 'utf8');
    expect(index).toContain('/sitemap-0.xml');
    const sitemap = await readFile(path.join(dist, 'sitemap-0.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://leprisme.info/</loc>');
    expect(sitemap).toContain(
      '<loc>https://leprisme.info/classement-politique-des-medias/</loc>',
    );
    expect(sitemap).toContain('<loc>https://leprisme.info/methode/</loc>');
    // At least one Story URL under its own day.
    expect(sitemap).toMatch(/<loc>https:\/\/leprisme.info\/20\d\d-\d\d-\d\d\//);
  });

  it('gives every page a canonical, og:url and Twitter card', async () => {
    const home = await readFile(path.join(dist, 'index.html'), 'utf8');
    expect(home).toContain(
      '<link rel="canonical" href="https://leprisme.info/">',
    );
    expect(home).toContain(
      '<meta property="og:url" content="https://leprisme.info/">',
    );
    expect(home).toContain('property="og:site_name" content="Prisme"');
    // No ogImage passed → the site-wide fallback brand card.
    expect(home).toContain(
      'property="og:image" content="https://leprisme.info/og-default.png"',
    );
    expect(home).toContain('name="twitter:card" content="summary_large_image"');

    const classement = await readFile(
      path.join(dist, 'classement-politique-des-medias/index.html'),
      'utf8',
    );
    expect(classement).toContain(
      '<link rel="canonical" href="https://leprisme.info/classement-politique-des-medias/">',
    );
  });

  it('emits NewsArticle JSON-LD with isBasedOn on a Story page', async () => {
    const storyDir = (await readdir(path.join(dist, '2026-10-20'))).find(
      (name) => !name.startsWith('.'),
    );
    expect(storyDir).toBeDefined();
    const html = await readFile(
      path.join(dist, '2026-10-20', storyDir!, 'index.html'),
      'utf8',
    );
    expect(html).toContain('"@type":"NewsArticle"');
    expect(html).toContain('"isBasedOn":');
    expect(html).toContain('property="article:published_time"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    // Site-wide identity JSON-LD is also present.
    expect(html).toContain('"@type":"WebSite"');
  });

  it('ships the branded French 404 page', async () => {
    const html = await readFile(path.join(dist, '404.html'), 'utf8');
    expect(html).toContain("Cette page n'existe pas");
    // The Story-page back link is the way home — no separate CTA style.
    expect(html).toContain('À la une');
  });
});
