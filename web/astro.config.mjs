import { readdirSync, readFileSync } from 'node:fs';
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
// PRISME_DATA_DIR (web/src/data.ts): the fixture build reads the
// fixture's data — its registry is normally absent, so no redirects.
const dataDir =
  process.env.PRISME_DATA_DIR != null ? process.env.PRISME_DATA_DIR : '../data';

let redirects = {};
try {
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

// The once-in-Edition Story URLs (ADR-0042): a Story page is indexed —
// here in the sitemap, on the page itself via noindex
// ([date]/[slug].astro) — only once the Story has entered the Edition
// (`everInEdition`, sticky, ADR-0005 as amended by issue #75). Those
// pages are permanent; every other Story page is a transient the
// end-of-run cleanup deletes within ~72 h of birth, and the sitemap
// must not advertise URLs we plan to 404. Merge-redirect stubs (dead
// absorbed-Story URLs) match the day pattern but have no Story file,
// so they stay out too — a sitemap lists destinations, not signposts.
const indexableStoryPaths = new Set();
try {
  const storiesDir = path.resolve(dataDir, 'stories');
  for (const name of readdirSync(storiesDir)) {
    if (!name.endsWith('.json')) continue;
    try {
      const story = JSON.parse(
        readFileSync(path.resolve(storiesDir, name), 'utf8'),
      );
      if (
        story.everInEdition === true &&
        typeof story.storyDay === 'string' &&
        typeof story.slug === 'string'
      ) {
        indexableStoryPaths.add(`/${story.storyDay}/${story.slug}`);
      }
    } catch {
      // Unreadable file: skip, like loadAllStoryFiles (web/src/data.ts).
    }
  }
} catch {
  // Absent stories dir: no Story pages exist in that build anyway.
}

// Custom domain: https://leprisme.info/
export default defineConfig({
  site: 'https://leprisme.info',
  base: '/',
  redirects,
  // Sitemap (robots.txt points at /sitemap-index.xml): the home Edition
  // (Brûlant), the classement page, and only the once-in-Edition Story
  // pages — the permanent set (ADR-0005), since every other Story page
  // is a transient the cleanup deletes (ADR-0042); old day pages have
  // no inlinks once they roll off the homepage. The alternate sorts
  // stay out: they are noindexed near-duplicates of the home (ADR-0028,
  // ADR-0039) — append each new sort's path here when it ships.
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/$/, '');
        // A Story page — /<day>/<slug>/ — is sitemapped only in the
        // once-in-Edition set; every other page ships, minus the
        // noindexed alternate sorts.
        if (/^\/\d{4}-\d{2}-\d{2}\//.test(pathname))
          return indexableStoryPaths.has(pathname);
        return !['/nouveau', '/top'].includes(pathname);
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
