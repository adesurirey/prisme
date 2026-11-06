/**
 * One-off generator for the classement page's OG image (1200×630), committed
 * to web/public/og-classement.png. It rasterizes the same logo chart the
 * page renders — placement comes from src/lib/leaning-chart.ts (shared code,
 * not a copy) and the logos from src/assets/outlets (the directory manifest).
 * Run manually whenever the Outlet set, a Leaning or a logo changes:
 *
 *   pnpm --filter @prisme/web generate:og-classement
 *
 * Design follows og-default.png: light card, ink title, muted footer. Zones
 * tint with the three camp colors (the site's public language), logos sit on
 * white plates so black wordmarks survive the light canvas. Each logo is
 * pre-rasterized by sharp at ~2× its slot before embedding, so the final
 * render keeps crisp edges.
 */

import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { coverageGroup, LEANING_LABELS, outlets } from '@prisme/domain';
import sharp from 'sharp';
import { leaningChartZones, logoId } from '../src/leaning-chart';

const ASSETS_DIR = path.resolve(import.meta.dirname, '../src/assets/outlets');
const OUT = path.resolve(import.meta.dirname, '../public/og-classement.png');

const WIDTH = 1200;
const HEIGHT = 630;

const INK = '#1b1b1f';
const MUTED = '#6c6c75';
const CANVAS = '#fcfcfc';
const CAMP_COLORS = { gauche: '#e0415e', centre: '#dfa414', droite: '#2e7ce4' };
const SANS = "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Card layout, tuned around the tallest zone (centre: 9 outlets). */
const LAYOUT = {
  margin: 56,
  titleY: 108,
  titleSize: 46,
  zonesY: 168,
  zonesHeight: 386,
  zoneGap: 14,
  zoneLabelSize: 21,
  plate: { w: 92, h: 58, gapX: 8, gapY: 8, padTop: 52 },
  logo: { w: 76, h: 34 },
  footerY: 574,
};

/** Fit each logo into its slot: SVGs render at density, PNGs as-is,
 *  both contained into the 2×-sized raster the card embeds. */
async function logoDataUri(file: string): Promise<{
  href: string;
  w: number;
  h: number;
}> {
  const buf = await readFile(path.join(ASSETS_DIR, file));
  const input = file.endsWith('.png')
    ? sharp(buf)
    : sharp(buf, { density: 300 });
  const meta = await input.metadata();
  const w = meta.width ?? 200;
  const h = meta.height ?? 60;
  const scale = Math.min((LAYOUT.logo.w * 2) / w, (LAYOUT.logo.h * 2) / h);
  const png = await input
    .resize(
      Math.max(1, Math.round(w * scale)),
      Math.max(1, Math.round(h * scale)),
    )
    .png()
    .toBuffer();
  return {
    href: `data:image/png;base64,${png.toString('base64')}`,
    w: Math.round(w * scale) / 2,
    h: Math.round(h * scale) / 2,
  };
}

async function cardSvg(): Promise<string> {
  const files = readdirSync(ASSETS_DIR).filter((f) => /\.(svg|png)$/.test(f));
  // The manifest lookup, shared with the page: the file's name is the id,
  // so `logoSrc` carries the filename this script rasterizes.
  const logoFor = (id: string) => files.find((f) => logoId(f) === id);
  const zones = leaningChartZones(outlets, logoFor);

  const zoneW = (WIDTH - 2 * LAYOUT.margin - 4 * LAYOUT.zoneGap) / 5;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="${CANVAS}"/>`,
    `<text x="${LAYOUT.margin}" y="${LAYOUT.titleY}" font-family="${SANS}" font-size="${LAYOUT.titleSize}" font-weight="700" fill="${INK}">Classement politique des médias</text>`,
  ];

  for (let zi = 0; zi < zones.length; zi++) {
    const zone = zones[zi];
    const camp = CAMP_COLORS[coverageGroup(zone.leaning)];
    const x = LAYOUT.margin + zi * (zoneW + LAYOUT.zoneGap);
    const y = LAYOUT.zonesY;
    parts.push(
      `<rect x="${x}" y="${y}" width="${zoneW}" height="${LAYOUT.zonesHeight}" rx="14" fill="${camp}" fill-opacity="0.06"/>`,
      `<circle cx="${x + 16}" cy="${y + 27}" r="5" fill="${camp}"/>`,
      `<text x="${x + 28}" y="${y + 34}" font-family="${SANS}" font-size="${LAYOUT.zoneLabelSize}" font-weight="600" fill="${INK}">${LEANING_LABELS[zone.leaning]}</text>`,
      `<text x="${x + zoneW - 14}" y="${y + 34}" font-family="${SANS}" font-size="${LAYOUT.zoneLabelSize}" fill="${MUTED}" text-anchor="end">${zone.entries.length}</text>`,
    );

    for (let ei = 0; ei < zone.entries.length; ei++) {
      const { outlet, logoSrc: file } = zone.entries[ei];
      const col = ei % 2;
      const row = Math.floor(ei / 2);
      const px = x + 10 + col * (LAYOUT.plate.w + LAYOUT.plate.gapX);
      const py =
        y + LAYOUT.plate.padTop + row * (LAYOUT.plate.h + LAYOUT.plate.gapY);
      parts.push(
        `<rect x="${px}" y="${py}" width="${LAYOUT.plate.w}" height="${LAYOUT.plate.h}" rx="8" fill="#ffffff" stroke="#e4e4e7"/>`,
      );
      if (file) {
        const { href, w, h } = await logoDataUri(file);
        parts.push(
          `<image href="${href}" x="${px + (LAYOUT.plate.w - w) / 2}" y="${py + (LAYOUT.plate.h - h) / 2}" width="${w}" height="${h}"/>`,
        );
      } else {
        parts.push(
          `<text x="${px + LAYOUT.plate.w / 2}" y="${py + LAYOUT.plate.h / 2 + 6}" font-family="${SANS}" font-size="15" font-weight="600" fill="${INK}" text-anchor="middle">${outlet.name}</text>`,
        );
      }
    }
  }

  parts.push(
    `<text x="${LAYOUT.margin}" y="${LAYOUT.footerY}" font-family="${SANS}" font-size="30" font-weight="600" fill="${MUTED}">leprisme.info</text>`,
    `</svg>`,
  );
  return parts.join('\n');
}

const png = await sharp(Buffer.from(await cardSvg()))
  .png()
  .toFile(OUT);
console.log(
  `wrote public/og-classement.png (${WIDTH}×${HEIGHT}, ${png.size} bytes)`,
);
