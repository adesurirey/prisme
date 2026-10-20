import { readFileSync } from 'node:fs';
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
  const raw = JSON.parse(
    readFileSync(new URL('../data/redirects.json', import.meta.url), 'utf8'),
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
  // the Edition index and the classement page, since old day pages have no
  // inlinks once they roll off the homepage.
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
