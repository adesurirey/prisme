/**
 * One-off generator for the PWA icon PNGs (issue #64), committed to
 * web/public/icons/ and served at /prisme/icons/*.png. It rasterizes the
 * Prisme mark's single source — src/assets/brand/prisme-mark.svg, the E at
 * the wordmark's angle — with sharp. Run manually whenever the mark ever
 * changes:
 *
 *   pnpm --filter @prisme/web generate:icons
 *
 * Every output is a size×size square (the mark is composited onto a square
 * canvas, never resized alone — an SVG rasterized alone keeps its glyph
 * aspect and lands non-square). Two families: manifest "any" icons on a
 * transparent square, maskable on a #ededf0 square (mark shrunk inside the
 * safe zone). Apple needs an opaque, non-alpha-cropped icon: apple-touch-
 * icon.png is the maskable treatment at 180px with less padding, on the
 * INVERTED palette (dark field, light glyph — see the comment below).
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
const PAPER = '#ededf0';

/** The mark centered on a `size`×`size` square. `fit` is the side of the
 * square the (pad-expanded) viewBox box is scaled into — BOTH dimensions
 * are constrained: the pinched E is wider than tall, so width, not height,
 * is the binding dimension, and fitting by height alone let the glyph hit
 * (and overflow) the canvas edges. */
async function markSquare(
  size: number,
  svg: string,
  fit: number,
  background: string | { r: number; g: number; b: number; alpha: number },
): Promise<Buffer> {
  const [, , w, h] = svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  const scale = Math.min(fit / w, fit / h);
  const mark = await sharp(Buffer.from(svg))
    .resize(Math.round(w * scale), Math.round(h * scale), { fit: 'fill' })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

// Plain "any" icons: transparent background, 0.17 pad baked into the
// viewBox — the pad-expanded box is fitted into the full canvas square, so
// the glyph lands at ~77% of the canvas and never hits the edges. (The
// pinch widened the glyph; 0.12 — sized for the straight P — let it grow
// to ~83% and read as edge-to-edge.)
const PAD = 0.17;

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
  // Maskable safe zone: content must fit a circle of 80% diameter. The
  // pinched mark is wider than tall — the WIDTH is the binding dimension.
  // No baked pad: the fit does the padding (0.6 of the canvas leaves the
  // glyph inside the safe circle even at its widest).
  [
    'maskable-192.png',
    await markSquare(
      192,
      await prismeMarkSvg(INK),
      Math.round(192 * 0.6),
      PAPER,
    ),
  ],
  [
    'maskable-512.png',
    await markSquare(
      512,
      await prismeMarkSvg(INK),
      Math.round(512 * 0.6),
      PAPER,
    ),
  ],
  // Apple re-composites the icon with its own white→transparent overlay on
  // the top third (undisableable); on a light background it reads as a dirty
  // band, on the dark background as a plausible sheen. Hence the inverted
  // palette: dark field, light glyph.
  [
    'apple-touch-icon.png',
    await markSquare(
      180,
      await prismeMarkSvg(PAPER),
      Math.round(180 * 0.8),
      INK,
    ),
  ],
];

await mkdir(OUT_DIR, { recursive: true });
for (const [name, buffer] of icons) {
  await writeFile(path.join(OUT_DIR, name), buffer);
  console.log(`wrote public/icons/${name} (${buffer.length} bytes)`);
}
