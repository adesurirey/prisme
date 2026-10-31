import { readFileSync } from 'node:fs';
import path from 'node:path';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

/**
 * Redirects between Story URLs (data/redirects.json, written by the
 * manual-merge CLI): Astro's built-in redirects, so the dev server honors
 * them and `astro build` emits the meta-refresh stub pages itself. A real
 * Story page always wins over a redirect (file routes take precedence), so
 * no filtering here. Absent file: no redirects yet — the first merge writes
 * the registry.
 */
let redirects = {};
try {
  // PRISME_DATA_DIR (web/src/data.ts): the fixture build reads the
  // fixture's registry — normally absent, so no redirects.
  const dataDir =
    process.env.PRISME_DATA_DIR != null
      ? process.env.PRISME_DATA_DIR
      : '../data';
  const raw = JSON.parse(
    readFileSync(path.resolve(dataDir, 'redirects.json'), 'utf8'),
  );
  redirects = Object.fromEntries(
    raw.redirects.map((r) => [
      `/${r.from.day}/${r.from.slug}`,
      `/${r.to.day}/${r.to.slug}`,
    ]),
  );
} catch {
  // Absent registry: nothing to redirect.
}

// Custom domain: https://leprisme.info/
export default defineConfig({
  site: 'https://leprisme.info',
  base: '/',
  redirects,
  // Sitemap (robots.txt points at /sitemap-index.xml): every built Story,
  // the home Edition and the classement page, since old day pages have no
  // inlinks once they roll off the homepage. The windowed editions stay
  // out: they are noindexed near-duplicates of la Une (ADR-0028) —
  // append each new edition's path here when it ships.
  integrations: [
    react(),
    sitemap({
      filter: (page) =>
        !['/en-direct/', '/le-fil/'].includes(new URL(page).pathname),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
