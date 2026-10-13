/**
 * One-off generator for the PWA icon PNGs (issue #64), committed to
 * web/public/icons/ and served at /prisme/icons/*.png. It rasterizes the
 * Prisme mark's single source — src/assets/brand/prisme-mark.svg, the P at
 * the wordmark's angle — with sharp. Run manually whenever the mark ever changes:
 *
 *   pnpm --filter @prisme/web generate:icons
 *
 * Two variants per size: plain (transparent background, for the manifest
 * "any" icons) and maskable (the mark shrunk inside a #fcfcfc square so it
 * stays inside every platform's safe zone). Apple needs an opaque, non-
 * alpha-cropped icon: apple-touch-icon.png is the maskable treatment at
 * 180px, with less padding.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** The generated mark asset is the single source of the geometry; this
 * script runs under tsx (no Vite ?raw loader), so it reads the file and
 * re-applies the same pad + color transform as favicon.ts. */
const ASSET = path.resolve(
  import.meta.dirname,
  '../src/assets/brand/prisme-mark.svg',
);

async function prismeMarkSvg(color: string, pad = 0): Promise<string> {
  const svg = await readFile(ASSET, 'utf8');
  const [, , w, h] = svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  const p = pad * h;
  return svg
    .replace(
      /viewBox="[^"]+"/,
      `viewBox="${parseFloat(svg.match(/viewBox="([^"]+)"/)![1].split(' ')[0]) - p} ${parseFloat(svg.match(/viewBox="([^"]+)"/)![1].split(' ')[1]) - p} ${w + 2 * p} ${h + 2 * p}"`,
    )
    .replace(/ role="img" aria-label="Prisme"/, '')
    .replaceAll('currentColor', color);
}

const OUT_DIR = path.resolve(import.meta.dirname, '../public/icons');

const INK = '#1b1b1f';
const BACKGROUND = '#fcfcfc';

/** The mark's glyph: 1153.3 wide × 1490 tall (font units). */
const GLYPH_W = 1153.3,
  GLYPH_H = 1490;

/** Rasterize the mark at `height` px for a viewBox with `pad` (fraction of
 * the glyph height per side — must match the pad baked into `svg`). */
async function png(svg: string, height: number, pad: number): Promise<Buffer> {
  const ratio = (GLYPH_W + 2 * pad * GLYPH_H) / (GLYPH_H + 2 * pad * GLYPH_H);
  return sharp(Buffer.from(svg))
    .resize(Math.round(height * ratio), height)
    .png()
    .toBuffer();
}

/** Mark centered on an opaque square, at `scale` of the full canvas height
 * (no baked pad — the scale does the padding for maskable/apple). */
async function onBackground(size: number, scale: number): Promise<Buffer> {
  const inner = Math.round(size * scale);
  const mark = await png(await prismeMarkSvg(INK), inner, 0);
  return sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([
      {
        input: mark,
        top: Math.round((size - inner) / 2),
        left: Math.round((size - Math.round(inner * (GLYPH_W / GLYPH_H))) / 2),
      },
    ])
    .png()
    .toBuffer();
}

// Plain "any" icons: transparent background, glyph at ~88% height with
// 0.12 pad baked into the viewBox — the mark shouldn't hit the edges.
const PAD = 0.12;
const anyHeight = (size: number) => Math.round(size * 0.88 * (1 + 2 * PAD));

const icons: Array<[string, Buffer]> = [
  [
    'icon-192.png',
    await png(await prismeMarkSvg(INK, PAD), anyHeight(192), PAD),
  ],
  [
    'icon-512.png',
    await png(await prismeMarkSvg(INK, PAD), anyHeight(512), PAD),
  ],
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
