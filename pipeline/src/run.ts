import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Edition } from '@prisme/domain';
import { outlets, publicOutlets } from '@prisme/domain';
import {
  type ClassificationCache,
  classifyNewArticles,
  dropNotNews,
  loadCache,
  saveCache,
} from './classify.ts';
import { collect } from './collect.ts';
import {
  membershipModelFromEnv,
  winnerModelFromEnv,
} from './decision-model.ts';
import { updateFrontPageHistory } from './frontpage.ts';
import { groupingModelFromEnv } from './gemini.ts';
import { groupStories, loadStories } from './grouping.ts';
import { fetchFeed } from './http.ts';
import { EDITION_SIZE, rankStories } from './ranking.ts';
import {
  SUMMARIES_PROMPT_VERSION,
  summariesModelFromEnv,
  updateSummaries,
} from './summarize.ts';

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
  const { articles, teasers, failures } = await collect(
    outlets,
    fetchFeed,
    now,
  );

  // Incremental classification (issue #4): only new ids hit the model; the
  // winner (Clef-flash via OpenRouter) comes from OPENROUTER_API_KEY. Without
  // the key, Articles stay unclassified — the build must not fail on it.
  const model = winnerModelFromEnv();
  if (model == null) {
    console.warn(
      'OPENROUTER_API_KEY not set — Articles are kept unclassified (no kind).',
    );
  }
  const cache: ClassificationCache = await loadCache(CLASSIFICATIONS_PATH);
  const before = Object.keys(cache.entries).length;
  await classifyNewArticles(articles, teasers, cache, model);
  await saveCache(cache, CLASSIFICATIONS_PATH);
  const classified = Object.keys(cache.entries).length;

  const kept = dropNotNews(articles, cache).map((article) => ({
    ...article,
    kind: cache.entries[article.id]?.kind,
    section: cache.entries[article.id]?.section ?? undefined,
  }));

  // Incremental grouping (issue #5): the Story files on disk are the record;
  // only fresh Articles are assigned. Without GEMINI_API_KEY the build still
  // succeeds — each new Article becomes its own Story (ADR-0005).
  const grouping = groupingModelFromEnv();
  if (grouping == null) {
    console.warn(
      'GEMINI_API_KEY not set — Articles are not grouped; each new Article becomes its own Story.',
    );
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

  // Front-page history (issue #6): reconcile the flags of every live Story
  // with today's collection — `frontPage` is the current snapshot,
  // `everFrontPage` sticky. Frozen Stories are untouched (ADR-0005). Stories
  // whose flags changed join the changed set, so their files are rewritten.
  const liveIds = new Set(outcome.live.map((s) => s.id));
  const frontpage = updateFrontPageHistory(outcome.stories, kept, (s) =>
    liveIds.has(s.id),
  );
  const changed = new Set([...outcome.changed, ...frontpage.changed]);

  // The Edition is the ranked top EDITION_SIZE (issue #6): Stories order by
  // the Outlets currently on their Front page, then Coverage, then recency —
  // deterministically. Live Stories below the cut keep updating outside it and
  // may return on a later build; only a Story with no live Articles freezes.
  const outletById = new Map(outlets.map((o) => [o.id, o]));
  const edition: Edition = {
    builtAt: now.toISOString(),
    stories: rankStories(
      frontpage.stories.filter((s) => liveIds.has(s.id)),
      outletById,
    ).slice(0, EDITION_SIZE),
  };

  // Summaries & Differences (issue #7, ADR-0006): one Flash-Lite call per
  // live Edition Story that gained Articles since its last Summaries run —
  // unchanged Stories make zero calls. Only Edition Stories are summarized;
  // a Story below the cut picks its Summaries up when it returns. Without
  // GEMINI_API_KEY the build still succeeds — Story pages just lack tabs.
  const summaries = summariesModelFromEnv();
  if (summaries == null) {
    console.warn('GEMINI_API_KEY not set — no Summaries this build.');
  }
  const summaryOutcome = await updateSummaries({
    stories: edition.stories,
    teasers,
    outletById,
    model: summaries,
    promptVersion: SUMMARIES_PROMPT_VERSION,
  });
  for (const slug of summaryOutcome.changed) changed.add(slug);

  const filesToWrite = changed.size;
  console.log(
    `Edition: ${edition.stories.length} ranked stories (of ${liveIds.size} live) from ${kept.length} articles ` +
      `(${existing.length} on disk, ${filesToWrite} files to write, ` +
      `${articles.length - kept.length} not_news dropped, ${classified - before} newly classified, ` +
      `${summaryOutcome.calls} summaries calls, ${failures.length} feed failures).`,
  );

  await mkdir(STORIES_DIR, { recursive: true });
  // Outlet config snapshot (identity and feeds only): the sourced config lives
  // in @prisme/domain and is imported by the pipeline and the site.
  await writeFile(
    new URL('outlets.json', DATA_DIR),
    `${JSON.stringify(publicOutlets(), null, 2)}\n`,
  );
  await writeFile(
    new URL('edition.json', DATA_DIR),
    `${JSON.stringify(edition, null, 2)}\n`,
  );
  for (const story of frontpage.stories) {
    if (!changed.has(story.slug)) continue;
    await writeFile(
      new URL(`${story.slug}.json`, STORIES_DIR),
      `${JSON.stringify(story, null, 2)}\n`,
    );
  }
  console.log(`Wrote ${DATA_DIR.pathname}`);
  return edition;
}

runEdition().catch((error) => {
  console.error(error);
  process.exit(1);
});
