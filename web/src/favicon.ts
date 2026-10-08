/**
 * The aurora ball as favicon data URIs, one per theme (the media attribute
 * on <link> makes the browser pick, and live-swap, the right one). This
 * mirrors the AuroraBall component mark — same gradients, same geometry;
 * the hex values match the --aurora-* tokens in global.css. Favicons must
 * be self-contained URLs, hence the duplication that the component avoids.
 */
const BALL = (stops: [string, string, string]): string =>
  `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='s' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='${stops[0]}'/%3E%3Cstop offset='.5' stop-color='${stops[1]}'/%3E%3Cstop offset='1' stop-color='${stops[2]}'/%3E%3C/linearGradient%3E%3CradialGradient id='h' cx='.5' cy='.5' r='.5'%3E%3Cstop offset='0' stop-color='%23ffffff' stop-opacity='.9'/%3E%3Cstop offset='1' stop-color='%23ffffff' stop-opacity='0'/%3E%3C/radialGradient%3E%3CradialGradient id='d' cx='.5' cy='.5' r='.5'%3E%3Cstop offset='.7' stop-color='%23000000' stop-opacity='0'/%3E%3Cstop offset='1' stop-color='%23000000' stop-opacity='.25'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='16' cy='16' r='15' fill='url(%23s)'/%3E%3Ccircle cx='16' cy='16' r='15' fill='url(%23d)'/%3E%3Cellipse cx='11' cy='9.5' rx='6.5' ry='5' fill='url(%23h)'/%3E%3C/svg%3E`;

export const AURORA_BALL_LIGHT = BALL(['%23dfa414', '%23e0415e', '%232e7ce4']);
export const AURORA_BALL_DARK = BALL(['%23f6c65b', '%23f28498', '%2363a8ea']);
