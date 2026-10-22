import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * The private teaser cache (ADR-0027, amending ADR-0003): article id → teaser,
 * accumulated across builds so a multi-day Story re-Summary still receives the
 * teasers of Articles that rotated out of the feeds. Stored at
 * `.cache/teasers.json` (see TEASER_CACHE_PATH in paths.ts) — outside the
 * published data/, gitignored, round-tripped by CI through the Actions cache.
 * Outlet-written text is never committed or rendered; a missing or corrupt
 * cache degrades to headline-only input and never fails a build.
 */

export type TeaserCache = Record<string, string>;

/**
 * Tolerant read (prior art: classify.ts loadCache): a missing, corrupt or
 * wrongly-shaped file yields an empty cache — the build proceeds with
 * headline-only input for the affected Articles.
 */
export async function loadTeaserCache(path: URL): Promise<TeaserCache> {
  try {
    const cache = JSON.parse(await readFile(path, 'utf8')) as TeaserCache;
    if (cache == null || typeof cache !== 'object' || Array.isArray(cache))
      return {};
    return cache;
  } catch {
    return {};
  }
}

/**
 * Accumulation, never overwrite (ADR-0027): an entry seen once stays readable
 * for a Story pass days later — the current collection's teaser for an id the
 * cache already holds is discarded. Aged entries the current collection no
 * longer sees are kept. Pure: the inputs are not mutated.
 */
export function mergeTeasers(
  cache: TeaserCache,
  teasers: Map<string, string>,
): TeaserCache {
  const merged: TeaserCache = { ...cache };
  for (const [id, teaser] of teasers) {
    if (merged[id] == null) merged[id] = teaser;
  }
  return merged;
}

export async function saveTeaserCache(
  cache: TeaserCache,
  path: URL,
): Promise<void> {
  await mkdir(dirname(path.pathname), { recursive: true });
  await writeFile(path, `${JSON.stringify(cache, null, 2)}\n`);
}
