/**
 * Build-output tests (issue #64): they assert on what the build actually
 * ships, not on source — the manifest must be copied to dist/ with the
 * agreed fields, the PNG icons must land in dist/icons/, and the rendered
 * HTML must reference them. `astro build` runs once in beforeAll against
 * the committed data/ snapshot (ADR-0002).
 */
import { execSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
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
