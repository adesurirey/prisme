/**
 * The aurora ball as an SVG markup string — the single source for every
 * rasterization of the mark: the favicon data URIs below, and the PNG icons
 * the one-off script (web/scripts/generate-icons.ts) generates for the PWA
 * manifest and apple-touch-icon. Same gradients, same geometry as the
 * AuroraBall component; the hex values match the --aurora-* tokens in
 * global.css, one color set per theme.
 */
export function auroraBallSvg(stops: [string, string, string]): string {
  // Raw '#' here: the SVG is rasterized as-is (icons) and only gets
  // percent-encoded when wrapped into a data URI below.
  const [from, mid, to] = stops;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><defs><linearGradient id="s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset=".5" stop-color="${mid}"/><stop offset="1" stop-color="${to}"/></linearGradient><radialGradient id="h" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient><radialGradient id="d" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".25"/></radialGradient></defs><circle cx="16" cy="16" r="15" fill="url(#s)"/><circle cx="16" cy="16" r="15" fill="url(#d)"/><ellipse cx="11" cy="9.5" rx="6.5" ry="5" fill="url(#h)"/></svg>`;
}

/** The aurora ball as favicon data URIs, one per theme (the media attribute
 * on <link> makes the browser pick, and live-swap, the right one). Favicons
 * must be self-contained URLs, hence the data-URI wrapping. */
const BALL = (svg: string): string =>
  `data:image/svg+xml,${encodeURIComponent(svg)}`;

export const AURORA_BALL_LIGHT = BALL(
  auroraBallSvg(['#dfa414', '#e0415e', '#2e7ce4']),
);
export const AURORA_BALL_DARK = BALL(
  auroraBallSvg(['#f6c65b', '#f28498', '#63a8ea']),
);
