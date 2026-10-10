/**
 * Build-output tests (issue #64): they assert on what the build actually
 * ships, not on source — the manifest must be copied to dist/ with the
 * agreed fields, the PNG icons must land in dist/icons/, and the rendered
 * HTML must reference them. `astro build` runs once in beforeAll against
 * the committed data/ snapshot (ADR-0002).
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const WEB_DIR = path.resolve(import.meta.dirname, '..');

let dist: string;

beforeAll(() => {
  // Strip a stray BASE_URL from the environment: some shells (agents, CI
  // wrappers) export one, and the child build would otherwise pick it up
  // instead of the configured /prisme base.
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
    expect(manifest.start_url).toBe('/prisme/');
    expect(manifest.scope).toBe('/prisme/');
    expect(manifest.theme_color).toBe('#fcfcfc');
    expect(manifest.background_color).toBe('#fcfcfc');
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: '/prisme/icons/icon-192.png' }),
        expect.objectContaining({ src: '/prisme/icons/icon-512.png' }),
        expect.objectContaining({
          src: '/prisme/icons/maskable-512.png',
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
      const file = path.join(dist, icon.src.replace(/^\/prisme\//, ''));
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

/**
 * The bundled service worker (src/sw.ts) is emitted and its registration
 * is correctly scoped to the /prisme base (the GitHub Pages footgun). The
 * behavioral caching strategy is verified manually per release on a
 * deployed build (spec #63); here we assert on what the build produces:
 * route ordering is semantic — Story navigations must reach the
 * stale-while-revalidate route before the catch-all NavigationRoute
 * (which would otherwise answer every Story with the home page).
 */
describe('service worker', () => {
  let sw: string;

  beforeAll(() => {
    sw = readFileSync(path.join(dist, 'sw.js'), 'utf8');
  });

  it('is emitted with its workbox runtime and registered under /prisme', async () => {
    expect((await stat(path.join(dist, 'sw.js'))).isFile()).toBe(true);
    const distFiles = await readdir(dist);
    // The Workbox runtime is inlined into the bundled worker; a separate
    // workbox-*.js would mean a generateSW build slipped through.
    expect(distFiles.some((f) => /^workbox-.*\.js$/.test(f))).toBe(false);
    // The registration must use the /prisme-prefixed SW path and scope,
    // or the GitHub Pages project site never installs the worker. The
    // plugin's auto-injection never reaches prerendered Astro HTML, so
    // Base.astro registers by hand (paths on <html> data attributes).
    const html = await readFile(path.join(dist, 'index.html'), 'utf8');
    expect(html).toContain('data-sw-path="/prisme/sw.js"');
    expect(html).toContain('data-scope="/prisme/"');
    expect(html).toContain('serviceWorker');
  });

  it('precaches the app shell and never precaches Story pages', () => {
    // App shell: home page, classement, assets, icons, manifest.
    expect(sw).toContain('"/prisme"');
    expect(sw).toContain('classement-politique-des-medias');
    expect(sw).toContain('_astro/');
    expect(sw).toContain('icons/icon-512.png');
    // Story pages grow unbounded (ADR-0005) — none may be precached.
    expect(sw).not.toMatch(/url:"[^"]*sujet[^"]*"/);
  });

  it('falls back to the precached home page for offline navigations', () => {
    // The fallback URL must be a precache key: the home page is
    // precached as "/prisme" (directory entry), and createHandlerBoundToURL
    // throws at runtime if its key is missing from the manifest. The
    // bundle is minified, so assert on the shape right after the precache
    // manifest: handler bound to the "/prisme" key.
    expect(sw).toMatch(
      /\}\],\{directoryIndex:"index\.html"\}\);const \w+=\w+\("\/prisme"\)/,
    );
    expect(sw).toContain('NavigationRoute');
  });

  it('routes Story navigations through SWR before the navigation fallback', () => {
    // Route ordering is semantic: the catch-all NavigationRoute is
    // registered first in generated SWs and would hijack every Story
    // navigation, so the SWR Story route must be registered before the
    // fallback route (identifiable in the minified bundle by its
    // denylist option). Class names are minified away, hence the
    // minification-aware anchors.
    expect(sw).toContain('/prisme/sujet/');
    expect(sw).toContain('prisme-stories');
    // The NavigationRoute registration (minified: registerRoute(new X(H,{denylist:[…]))
    const fallbackRoute = sw.search(/\);M\(new \w+\(\w+,\{denylist:\[/);
    expect(fallbackRoute).toBeGreaterThan(-1);
    expect(sw.indexOf('/prisme/sujet/')).toBeLessThan(fallbackRoute);
    // SWR: the Story handler must fall back to the bound home handler on
    // failure (offline, never-visited Story) — the home handler is the
    // identifier bound to "/prisme" right after the precache manifest.
    const home = sw.match(
      /\}\],\{directoryIndex:"index\.html"\}\);const (\w+)=/,
    )?.[1];
    expect(home).toBeTruthy();
    expect(sw).toContain(`catch{return ${home}(`);
  });
});

describe('page head tags', () => {
  it('references the manifest and the apple-touch-icon', async () => {
    const html = await readFile(path.join(dist, 'index.html'), 'utf8');
    expect(html).toContain(
      'rel="manifest" href="/prisme/manifest.webmanifest"',
    );
    expect(html).toContain(
      'rel="apple-touch-icon" href="/prisme/icons/apple-touch-icon.png"',
    );
    expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(html).toContain(
      'name="apple-mobile-web-app-title" content="Prisme"',
    );
  });
});
