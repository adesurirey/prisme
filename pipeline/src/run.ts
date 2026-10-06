import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Edition } from '@prisme/domain';
import { outlets, publicOutlets } from '@prisme/domain';
import { classifyNewArticles, dropNotNews, loadCache, saveCache, type ClassificationCache } from './classify.ts';
import { collect } from './collect.ts';
import { groupingModelFromEnv } from './gemini.ts';
import { groupStories, loadStories } from './grouping.ts';
import { fetchFeed } from './http.ts';
import { membershipModelFromEnv } from './decision-model.ts';
import { winnerModelFromEnv } from './decision-model.ts';

/**
 * data/ lives at the repo root: resolving `../../data/` from this file
 * (pipeline/src/) points at the repo root, so the pipeline runs the same from
 * anywhere (root, CI, editor).
 */
const DATA_DIR = new URL('../../data/', import.meta.url);
const CLASSIFICATIONS_PATH = new URL('classifications.json', DATA_DIR);
const STORIES_DIR = new URL('stories/', DATA_DIR);

export async function runEdition(): Promise<Edition> {
  const now = new Date();
  const { articles, teasers, failures } = await collect(outlets, fetchFeed, now);

  // Incremental classification (issue #4): only new ids hit the model; the
  // winner (Clef-flash via OpenRouter) comes from OPENROUTER_API_KEY. Without
  // the key, Articles stay unclassified — the build must not fail on it.
  const model = winnerModelFromEnv();
  if (model == null) {
    console.warn('OPENROUTER_API_KEY not set — Articles are kept unclassified (no kind).');
  }
  const cache: ClassificationCache = await loadCache(CLASSIFICATIONS_PATH);
  const before = Object.keys(cache.entries).length;
  await classifyNewArticles(articles, teasers, cache, model);
  await saveCache(cache, CLASSIFICATIONS_PATH);
  const classified = Object.keys(cache.entries).length;

  const kept = dropNotNews(articles, cache)
    .map((article) => ({
      ...article,
      kind: cache.entries[article.id]?.kind,
      section: cache.entries[article.id]?.section ?? undefined,
    }));

  // Incremental grouping (issue #5): the Story files on disk are the record;
  // only fresh Articles are assigned. Without GEMINI_API_KEY the build still
  // succeeds — each new Article becomes its own Story (ADR-0005).
  const grouping = groupingModelFromEnv();
  if (grouping == null) {
    console.warn('GEMINI_API_KEY not set — Articles are not grouped; each new Article becomes its own Story.');
  }
  const existing = await loadStories(STORIES_DIR);
  const outcome = await groupStories({
    articles: kept,
    teasers,
    existing,
    now,
    makeId: () => randomBytes(6).toString('hex'),
    clients: { grouping, membership: membershipModelFromEnv() },
  });
  const edition: Edition = { builtAt: now.toISOString(), stories: outcome.live };

  const filesToWrite = outcome.changed.size;
  console.log(
    `Edition: ${edition.stories.length} live stories from ${kept.length} articles ` +
      `(${existing.length} on disk, ${filesToWrite} files to write, ` +
      `${articles.length - kept.length} not_news dropped, ${classified - before} newly classified, ` +
      `${failures.length} feed failures).`,
  );

  await mkdir(STORIES_DIR, { recursive: true });
  // Outlet config snapshot (identity and feeds only): the sourced config lives
  // in @prisme/domain and is imported by the pipeline and the site.
  await writeFile(new URL('outlets.json', DATA_DIR), JSON.stringify(publicOutlets(), null, 2) + '\n');
  await writeFile(new URL('edition.json', DATA_DIR), JSON.stringify(edition, null, 2) + '\n');
  for (const story of outcome.stories) {
    if (!outcome.changed.has(story.slug)) continue;
    await writeFile(new URL(`${story.slug}.json`, STORIES_DIR), JSON.stringify(story, null, 2) + '\n');
  }
  console.log(`Wrote ${DATA_DIR.pathname}`);
  return edition;
}

runEdition().catch((error) => {
  console.error(error);
  process.exit(1);
});
