/**
 * One-off generator for the PWA icon PNGs (issue #64), committed to
 * web/public/icons/ and served at /prisme/icons/*.png. It rasterizes the
 * aurora dot's single source — auroraBallSvg() in web/src/favicon.ts, the
 * same string the favicons come from — with sharp. Run manually whenever
 * the dot ever changes:
 *
 *   pnpm --filter @prisme/web generate:icons
 *
 * Two variants per size: plain (transparent background, for the manifest
 * "any" icons) and maskable (the dot shrunk inside a #fcfcfc square so it
 * stays inside every platform's safe zone). Apple needs an opaque, non-
 * alpha-cropped icon: apple-touch-icon.png is the maskable treatment at
 * 180px, without extra padding.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { auroraBallSvg } from '../src/favicon';

const OUT_DIR = path.resolve(import.meta.dirname, '../public/icons');

/** Light-theme gradient stops — same tokens as the favicon's light variant. */
const BALL = auroraBallSvg(['#dfa414', '#e0415e', '#2e7ce4']);
const BACKGROUND = '#fcfcfc';

async function png(svg: string, size: number): Promise<Buffer> {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

/** Dot centered on an opaque square, at `scale` of the full canvas. */
async function onBackground(size: number, scale: number): Promise<Buffer> {
  const inner = Math.round(size * scale);
  const dot = await png(BALL, inner);
  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([
      {
        input: dot,
        top: Math.round((size - inner) / 2),
        left: Math.round((size - inner) / 2),
      },
    ])
    .png()
    .toBuffer();
}

const icons: Array<[string, Buffer]> = [
  ['icon-192.png', await png(BALL, 192)],
  ['icon-512.png', await png(BALL, 512)],
  ['maskable-192.png', await onBackground(192, 0.7)],
  ['maskable-512.png', await onBackground(512, 0.7)],
  ['apple-touch-icon.png', await onBackground(180, 0.83)],
];

await mkdir(OUT_DIR, { recursive: true });
for (const [name, buffer] of icons) {
  await writeFile(path.join(OUT_DIR, name), buffer);
  console.log(`wrote public/icons/${name} (${buffer.length} bytes)`);
}
