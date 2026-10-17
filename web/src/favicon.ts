import prismeMarkAsset from './assets/brand/prisme-mark.svg?raw';

/**
 * The Prisme mark — the E at the wordmark's angle (+20°, top leans left),
 * Prisme's brand icon (docs/research/logo/recette-finale.md, "Favicon &
 * icônes d'app"). Derived from the generated asset
 * src/assets/brand/prisme-mark.svg (the single source; regenerating it via
 * web/scripts/generate-brand-svg.py updates everything that reads this).
 * The favicon data URIs below and the PNG icons from generate-icons.ts
 * rasterize from it as-is, with no CSS, so the color is baked in.
 */

/** The mark's viewBox, made SQUARE around the glyph with `pad` (a fraction
 * of the glyph height per side) as breathing room. A favicon is displayed
 * in a square, and the pinched E is wider than tall — a non-square viewBox
 * made the browser scale the glyph down by its width. Centering a square
 * side (max dimension + 2·pad) keeps the glyph at full size.
 * pad 0.10 compensates the pinch's extra width: the old 0.18 (sized for the
 * straight E) read as a smaller glyph (see recette-finale.md, révision 3). */
function paddedViewBox(pad: number): string {
  const [x, y, w, h] = prismeMarkAsset
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  const p = pad * h;
  const side = Math.max(w, h) + 2 * p;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return `${cx - side / 2} ${cy - side / 2} ${side} ${side}`;
}

/** The mark as an SVG string in `color` (hex). */
export function prismeMarkSvg(color: string, pad = 0): string {
  return prismeMarkAsset
    .replace(/viewBox="[^"]+"/, `viewBox="${paddedViewBox(pad)}"`)
    .replace(/ role="img" aria-label="Prisme"/, '')
    .replaceAll('currentColor', color);
}

/** Favicon data URIs, one per theme (the media attribute on <link> makes the
 * browser pick — and live-swap — the right one). Colors match the --ink
 * tokens in global.css. Favicons must be self-contained URLs, hence the
 * data-URI wrapping. */
const URI = (svg: string): string =>
  `data:image/svg+xml,${encodeURIComponent(svg)}`;

export const PRISME_MARK_LIGHT = URI(prismeMarkSvg('#1b1b1f', 0.1));
export const PRISME_MARK_DARK = URI(prismeMarkSvg('#e6e6ea', 0.1));
