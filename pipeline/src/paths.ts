import { readdir, readFile } from 'node:fs/promises';
import type { Story } from '@prisme/domain';

/**
 * data/ lives at the repo root: resolving `../../data/` from this file
 * (pipeline/src/) points at the repo root, so the pipeline runs the same from
 * anywhere (root, CI, editor).
 */
export const DATA_DIR = new URL('../../data/', import.meta.url);
export const CLASSIFICATIONS_PATH = new URL('classifications.json', DATA_DIR);
export const STORIES_DIR = new URL('stories/', DATA_DIR);

/**
 * The private teaser cache (ADR-0027, amending ADR-0003): at the repo root,
 * deliberately OUTSIDE the published data/ — it accumulates Outlet-written
 * teaser text, which must never be committed or rendered. Gitignored from its
 * first commit; CI round-trips it through the Actions cache.
 */
export const TEASER_CACHE_PATH = new URL(
  '../../.cache/teasers.json',
  import.meta.url,
);

export async function readStories(): Promise<Story[]> {
  const files = (await readdir(STORIES_DIR)).filter((f) => f.endsWith('.json'));
  return Promise.all(
    files.map(
      async (f) =>
        JSON.parse(await readFile(new URL(f, STORIES_DIR), 'utf8')) as Story,
    ),
  );
}
