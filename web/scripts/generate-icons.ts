/**
 * One-off generator for the PWA icon PNGs (issue #64), committed to
 * web/public/icons/ and served at /prisme/icons/*.png. It rasterizes the
 * Prisme mark's single source — src/assets/brand/prisme-mark.svg, the P at
 * the wordmark's angle — with sharp. Run manually whenever the mark ever
 * changes:
 *
 *   pnpm --filter @prisme/web generate:icons
 *
 * Every output is a size×size square (the mark is composited onto a square
 * canvas, never resized alone — an SVG rasterized alone keeps its glyph
 * aspect and lands non-square). Two variants per size: plain (transparent
 * background, for the manifest "any" icons) and maskable (the mark shrunk
 * inside a #fcfcfc square so it stays inside every platform's safe zone).
 * Apple needs an opaque, non-alpha-cropped icon: apple-touch-icon.png is
 * the maskable treatment at 180px, with less padding.
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
  const [x, y, w, h] = svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  const p = pad * h;
  return svg
    .replace(
      /viewBox="[^"]+"/,
      `viewBox="${x - p} ${y - p} ${w + 2 * p} ${h + 2 * p}"`,
    )
    .replace(/ role="img" aria-label="Prisme"/, '')
    .replaceAll('currentColor', color);
}

const OUT_DIR = path.resolve(import.meta.dirname, '../public/icons');

const INK = '#1b1b1f';
const BACKGROUND = '#fcfcfc';

/** Rasterize the mark at `height` px. The width comes from the SVG's own
 * viewBox (no duplicated ratio constant), and fit:'fill' replaces sharp's
 * default 'cover' — cover crops whenever the rounding of the two dims
 * disagrees with the exact aspect, which clipped the glyph. */
async function markPng(svg: string, height: number): Promise<Buffer> {
  const [, , w, h] = svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  return sharp(Buffer.from(svg))
    .resize(Math.round((height * w) / h), height, { fit: 'fill' })
    .png()
    .toBuffer();
}

/** The mark centered on a `size`×`size` square. `markHeight` is the max
 * height of the (pad-expanded) viewBox box — for glyphs wider than tall
 * (Fraunces' P) the box is scaled down so its WIDTH fits instead, keeping
 * the mark fully inside the canvas. */
async function markSquare(
  size: number,
  svg: string,
  markHeight: number,
  background: string | { r: number; g: number; b: number; alpha: number },
): Promise<Buffer> {
  const [, , w, h] = svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  const mark = await markPng(
    svg,
    Math.round(Math.min(markHeight, (size * h) / w)),
  );
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

// Plain "any" icons: transparent background, 0.12 pad baked into the
// viewBox on a full-canvas box — the glyph lands at 1/(1+2·0.12) ≈ 81% of
// the canvas, so the mark never hits the edges.
const PAD = 0.12;

const icons: Array<[string, Buffer]> = [
  [
    'icon-192.png',
    await markSquare(192, await prismeMarkSvg(INK, PAD), 192, {
      r: 0,
      g: 0,
      b: 0,
      alpha: 0,
    }),
  ],
  [
    'icon-512.png',
    await markSquare(512, await prismeMarkSvg(INK, PAD), 512, {
      r: 0,
      g: 0,
      b: 0,
      alpha: 0,
    }),
  ],
  // Maskable safe zone: content must fit a circle of 80% diameter. The mark
  // is a tall narrow glyph — height is the binding dimension. No baked pad:
  // the scale does the padding.
  [
    'maskable-192.png',
    await markSquare(
      192,
      await prismeMarkSvg(INK),
      Math.round(192 * 0.63),
      BACKGROUND,
    ),
  ],
  [
    'maskable-512.png',
    await markSquare(
      512,
      await prismeMarkSvg(INK),
      Math.round(512 * 0.63),
      BACKGROUND,
    ),
  ],
  [
    'apple-touch-icon.png',
    await markSquare(
      180,
      await prismeMarkSvg(INK),
      Math.round(180 * 0.7),
      BACKGROUND,
    ),
  ],
];

await mkdir(OUT_DIR, { recursive: true });
for (const [name, buffer] of icons) {
  await writeFile(path.join(OUT_DIR, name), buffer);
  console.log(`wrote public/icons/${name} (${buffer.length} bytes)`);
}
