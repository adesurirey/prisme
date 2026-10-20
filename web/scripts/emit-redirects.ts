/**
 * Post-build step for the redirect stub pages (data/redirects.json,
 * written by the manual-merge CLI): for every registry entry whose dead
 * URL has no Story file, write a 0-second meta-refresh page at the old
 * `/<day>/<slug>/` path. GitHub Pages has no server-side redirects — the
 * stub page is the stand-in for a 301 (see web/src/redirect-stub.ts).
 *
 * Runs after `astro build` (see package.json), so the files land in dist/
 * and ship with the deploy artifact. Idempotent: an entry whose stub
 * already exists is simply rewritten.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import astroConfig from '../astro.config.mjs';
import { loadAllStoryFiles, loadRedirects } from '../src/data';
import { redirectStubHtml, stubsToEmit } from '../src/redirect-stub';

async function main(): Promise<void> {
  const [registry, stories] = await Promise.all([
    loadRedirects(),
    loadAllStoryFiles(),
  ]);
  const slugs = new Set(stories.map((s) => s.slug));
  const entries = stubsToEmit(registry, slugs);
  if (entries.length === 0) return;

  const site =
    typeof astroConfig.site === 'string' && astroConfig.site !== ''
      ? astroConfig.site
      : undefined;
  if (site == null) throw new Error('astro.config.mjs has no site URL');

  const dist = path.resolve(import.meta.dirname, '../dist');
  for (const entry of entries) {
    const dir = path.join(dist, entry.from.day, entry.from.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'index.html'),
      redirectStubHtml(entry, site),
    );
    console.log(
      `Redirect stub: /${entry.from.day}/${entry.from.slug}/ -> ` +
        `/${entry.to.day}/${entry.to.slug}/`,
    );
  }
}

main().catch((reason) => {
  console.error(reason);
  process.exit(1);
});
