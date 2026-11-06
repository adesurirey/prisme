import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { outlets } from '@prisme/domain';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

/**
 * The logo directory is the manifest (see SOURCES.md beside the files), so
 * the directory itself is what needs guarding: no orphan file, no format
 * outside the convention, and raster files meeting the quality bar agreed
 * for the classement illustration.
 */

const DIR = path.resolve(import.meta.dirname, './assets/outlets');
const ALLOWED = new Set(['.svg', '.png']);
const outletIds = new Set(outlets.map((o) => o.id));

const imageFiles = readdirSync(DIR).filter((f) => ALLOWED.has(path.extname(f)));

describe('outlet logo assets', () => {
  it('has the SOURCES.md provenance file, with a row for every logo', () => {
    const sources = readFileSync(path.join(DIR, 'SOURCES.md'), 'utf8');
    expect(sources).toContain('Outlet | File | Source');
    for (const f of imageFiles) {
      expect(sources, `${f} must have a SOURCES.md row`).toContain(f);
    }
  });

  it('holds only .svg and .png files — no JPEG (no transparency), nothing else', () => {
    const offenders = readdirSync(DIR).filter(
      (f) => f !== 'SOURCES.md' && !ALLOWED.has(path.extname(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('maps every file to a real Outlet id — no orphans left by renamed or removed outlets', () => {
    const orphans = imageFiles
      .map((f) => path.basename(f, path.extname(f)))
      .filter((id) => !outletIds.has(id));
    expect(orphans).toEqual([]);
  });

  it('never ships both an SVG and a PNG for the same Outlet — SVG wins by convention', () => {
    const ids = imageFiles.map((f) => path.basename(f, path.extname(f)));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps raster logos at the quality bar: at least 400 px wide, actually transparent', async () => {
    const pngs = imageFiles.filter((f) => f.endsWith('.png'));
    for (const f of pngs) {
      const image = sharp(path.join(DIR, f));
      const meta = await image.metadata();
      expect(meta.width, `${f} width`).toBeGreaterThanOrEqual(400);
      expect(meta.hasAlpha, `${f} has an alpha channel`).toBe(true);
      // An alpha channel can still be fully opaque (a logo flattened onto a
      // solid background); the channel stats catch that.
      const stats = await image.stats();
      const alpha = stats.channels[stats.channels.length - 1];
      expect(alpha.min, `${f} has real transparency`).toBeLessThan(255);
    }
  });
});
