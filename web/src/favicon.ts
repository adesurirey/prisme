import prismeMarkAsset from './assets/brand/prisme-mark.svg?raw';

/**
 * The Prisme mark — the P at the wordmark's angle (+20°, top leans left),
 * Prisme's brand icon (docs/research/logo/recette-finale.md, "Favicon &
 * icônes d'app"). Derived from the generated asset
 * src/assets/brand/prisme-mark.svg (the single source; regenerating it via
 * web/scripts/generate-brand-svg.py updates everything that reads this).
 * The favicon data URIs below and the PNG icons from generate-icons.ts
 * rasterize from it as-is, with no CSS, so the color is baked in.
 */

/** The mark's viewBox, re-padded around the glyph by `pad` (a fraction of
 * the glyph height per side; 0 = the glyph fills the viewBox — favicons
 * sit at ~0.18, matching how other sites' icons breathe in a browser tab). */
function paddedViewBox(pad: number): string {
  const [x, y, w, h] = prismeMarkAsset
    .match(/viewBox="([^"]+)"/)![1]
    .split(' ')
    .map(Number);
  const p = pad * h;
  return `${x - p} ${y - p} ${w + 2 * p} ${h + 2 * p}`;
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

export const PRISME_MARK_LIGHT = URI(prismeMarkSvg('#1b1b1f', 0.18));
export const PRISME_MARK_DARK = URI(prismeMarkSvg('#e6e6ea', 0.18));
