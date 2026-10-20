/**
 * One-off generator for the site-wide fallback OG image (1200×630), committed
 * to web/public/og-default.png. It rasterizes a hand-authored SVG card whose
 * wordmark comes from the mark's single source —
 * src/assets/brand/prisme-wordmark-nav.svg, the navbar wordmark — with sharp.
 * Run manually whenever the brand ever changes:
 *
 *   pnpm --filter @prisme/web generate:og-image
 *
 * Design (agreed in review): light card, no Leaning colors, no subtitle —
 * the shared-title/description already carries the mission. The catchline is
 * SVG <text> in the system sans stack (the same stack global.css declares), so
 * no font files ship; regenerating on another OS shifts its glyphs slightly,
 * accepted for one fixed line.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** The generated wordmark asset is the single source of the geometry; this
 * script runs under tsx (no Vite ?raw loader), so it reads the file and
 * re-applies the same color transform as generate-icons.ts. */
const ASSET = path.resolve(
  import.meta.dirname,
  '../src/assets/brand/prisme-wordmark-nav.svg',
);

const WIDTH = 1200;
const HEIGHT = 630;

const INK = '#1b1b1f';
const MUTED = '#6c6c75';
const CANVAS = '#fcfcfc';

/** The system sans stack, as global.css declares it (no webfont downloads). */
const SANS = "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";

const LAYOUT = {
  /** Left margin, shared by every element. */
  x: 84,
  /** Wordmark top. The wordmark is a wide, low box (its height is ~16% of
   *  its width), so 150px puts its visual mass in the upper third. */
  wordmarkY: 150,
  /** Wordmark width — sized to dominate the top half without crowding
   *  the margins (700 read as a poster; 440 as an afterthought). */
  wordmarkWidth: 520,
  /** Catchline baseline — centered between wordmark and URL. */
  catchlineY: 402,
  catchlineSize: 58,
  /** URL baseline — its descender leaves ~66px, matching the top margin. */
  urlY: 564,
  urlSize: 26,
};

async function ogImageSvg(): Promise<string> {
  const svg = await readFile(ASSET, 'utf8');
  const [x, y, w, h] = svg
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  const scale = LAYOUT.wordmarkWidth / w;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${CANVAS}"/>
  <g transform="translate(${LAYOUT.x} ${LAYOUT.wordmarkY}) scale(${scale})" fill="${INK}">
    ${svg.match(/<path[^>]*\/>/)![0].replaceAll('currentColor', INK)}
  </g>
  <text x="${LAYOUT.x}" y="${LAYOUT.catchlineY}" font-family="${SANS}" font-size="${LAYOUT.catchlineSize}" font-weight="700" fill="${INK}">L'actualité, décomposée</text>
  <text x="${LAYOUT.x}" y="${LAYOUT.urlY}" font-family="${SANS}" font-size="${LAYOUT.urlSize}" font-weight="600" fill="${MUTED}">leprisme.info</text>
</svg>`;
}

const png = await sharp(Buffer.from(await ogImageSvg()))
  .png()
  .toFile(path.resolve(import.meta.dirname, '../public/og-default.png'));
console.log(
  `wrote public/og-default.png (${WIDTH}×${HEIGHT}, ${png.size} bytes)`,
);
