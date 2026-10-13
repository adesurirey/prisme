/**
 * One-off generator for the PWA icon PNGs (issue #64), committed to
 * web/public/icons/ and served at /prisme/icons/*.png. It rasterizes the
 * Prisme mark's single source — prismeMarkSvg() in web/src/favicon.ts, the
 * upright P — with sharp. Run manually whenever the mark ever changes:
 *
 *   pnpm --filter @prisme/web generate:icons
 *
 * Two variants per size: plain (transparent background, for the manifest
 * "any" icons) and maskable (the mark shrunk inside a #fcfcfc square so it
 * stays inside every platform's safe zone). Apple needs an opaque, non-
 * alpha-cropped icon: apple-touch-icon.png is the maskable treatment at
 * 180px, with less padding.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prismeMarkSvg } from '../src/favicon';

const OUT_DIR = path.resolve(import.meta.dirname, '../public/icons');

const INK = '#1b1b1f';
const BACKGROUND = '#fcfcfc';

/** The mark's aspect: viewBox 1153.3 wide × 1490 tall. */
const RATIO = 1153.3 / 1490;

async function png(svg: string, height: number): Promise<Buffer> {
  return sharp(Buffer.from(svg))
    .resize(Math.round(height * RATIO), height)
    .png()
    .toBuffer();
}

/** Mark centered on an opaque square, at `scale` of the full canvas height. */
async function onBackground(size: number, scale: number): Promise<Buffer> {
  const inner = Math.round(size * scale);
  const mark = await png(prismeMarkSvg(INK), inner);
  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([
      {
        input: mark,
        top: Math.round((size - inner) / 2),
        left: Math.round((size - Math.round(inner * RATIO)) / 2),
      },
    ])
    .png()
    .toBuffer();
}

const icons: Array<[string, Buffer]> = [
  ['icon-192.png', await png(prismeMarkSvg(INK), 192)],
  ['icon-512.png', await png(prismeMarkSvg(INK), 512)],
  // Maskable safe zone: content must fit a circle of 80% diameter. The mark
  // is a tall narrow glyph — height is the binding dimension.
  ['maskable-192.png', await onBackground(192, 0.63)],
  ['maskable-512.png', await onBackground(512, 0.63)],
  ['apple-touch-icon.png', await onBackground(180, 0.7)],
];

await mkdir(OUT_DIR, { recursive: true });
for (const [name, buffer] of icons) {
  await writeFile(path.join(OUT_DIR, name), buffer);
  console.log(`wrote public/icons/${name} (${buffer.length} bytes)`);
}
