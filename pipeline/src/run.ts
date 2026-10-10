import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import type { Edition } from '@prisme/domain';
import { outlets, publicOutlets } from '@prisme/domain';
import {
  type ClassificationCache,
  classifyNewArticles,
  dropNotNews,
  loadCache,
  pruneCache,
  saveCache,
} from './classify.ts';
import { slugsToDelete } from './cleanup.ts';
import { collect, contributionSummary } from './collect.ts';
import { updateEditionHistory } from './edition-history.ts';
import { updateFrontPageHistory } from './frontpage.ts';
import { groupStories, loadStories } from './grouping.ts';
import { fetchFeed } from './http.ts';
import { CLASSIFICATIONS_PATH, DATA_DIR, STORIES_DIR } from './paths.ts';
import { resolveModels } from './policy.ts';
import { EDITION_SIZE, rankStories } from './ranking.ts';
import { SUMMARIES_PROMPT_VERSION, updateSummaries } from './summarize.ts';

export async function runEdition(): Promise<Edition> {
  // Model policy (ADR-0005, as amended in issue #40): resolveModels decides
  // what is live, what degrades, and what fails — see policy.ts. Failing the
  // build up front happens here, before anything is collected or written —
  // the old degrade-to-singletons path corrupted the archive permanently
  // (membership is sticky, singletons never re-merge).
  const models = resolveModels();

  const now = new Date();
  const { articles, teasers, failures } = await collect(
    outlets,
    fetchFeed,
    now,
  );

  // Incremental classification (issue #4): only new ids hit the model; the
  // winner comes from OPENROUTER_API_KEY. Without the key, Articles stay
  // unclassified — a safe, retried degrade. With the key, a build where
  // every fresh classification fails throws (ADR-0005, as amended).
  const model = models.decision.model;
  if (model == null) {
    console.warn(models.decision.note);
  }
  const cache: ClassificationCache = await loadCache(CLASSIFICATIONS_PATH);
  const before = Object.keys(cache.entries).length;
  await classifyNewArticles(articles, teasers, cache, model);
  const classified = Object.keys(cache.entries).length;
  const pruned = pruneCache(cache, new Set(articles.map((a) => a.id)));
  const prunedCount = classified - Object.keys(pruned.entries).length;
  await saveCache(pruned, CLASSIFICATIONS_PATH);

  const kept = dropNotNews(articles, cache).map((article) => ({
    ...article,
    kind: cache.entries[article.id]?.kind,
    section: cache.entries[article.id]?.section ?? undefined,
  }));

  // Incremental grouping (issue #5): the Story files on disk are the record;
  // only fresh Articles are assigned. A failed Grouping call throws inside
  // groupStories — nothing is written, and the build fails (ADR-0005, as
  // amended in issue #40).
  const existing = await loadStories(STORIES_DIR);
  const outcome = await groupStories({
    articles: kept,
    teasers,
    existing,
    now,
    makeId: () => randomBytes(6).toString('hex'),
    clients: { grouping: models.grouping, membership: models.membership },
  });

  // Front-page history (issue #6): reconcile the flags of every live Story
  // with today's collection — `frontPage` is the current snapshot,
  // `everFrontPage` sticky. Frozen Stories are untouched (ADR-0005). Stories
  // whose flags changed join the changed set, so their files are rewritten.
  const liveIds = new Set(outcome.live.map((s) => s.id));
  const frontpage = updateFrontPageHistory(outcome.stories, kept, now);

  // The Edition is the ranked top EDITION_SIZE (issue #37, ADR-0009): Stories
  // order by Coverage, then recency — deterministically. Live Stories below
  // the cut keep updating outside it and may return on a later build; only a
  // Story with no live Articles freezes.
  const outletById = new Map(outlets.map((o) => [o.id, o]));
  const ranked = rankStories(
    frontpage.stories.filter((s) => liveIds.has(s.id)),
  ).slice(0, EDITION_SIZE);

  // Edition history (issue #75): `everInEdition` is sticky — set the moment
  // a Story ranks into the Edition, so the flag survives its freezing. Like
  // the front-page flags, only live Stories are touched; changed files are
  // rewritten.
  const editionHistory = updateEditionHistory(
    frontpage.stories,
    new Set(ranked.map((s) => s.id)),
    now,
  );
  // Re-map the ranked Edition onto the reconciled Stories by id: the flags
  // above may replace flag-changed Stories with new objects, and the Summaries
  // step below mutates the Edition Stories in place — they must be the same
  // objects that get written to disk, or fresh Summaries would be lost.
  const reconciledById = new Map(editionHistory.stories.map((s) => [s.id, s]));
  const edition: Edition = {
    builtAt: now.toISOString(),
    stories: ranked.map((s) => reconciledById.get(s.id) ?? s),
  };
  const changed = new Set([
    ...outcome.changed,
    ...frontpage.changed,
    ...editionHistory.changed,
  ]);

  // Summaries & Differences (issue #7, ADR-0006): one Flash-Lite call per
  // live Edition Story that gained Articles since its last Summaries run —
  // unchanged Stories make zero calls. Only Edition Stories are summarized;
  // a Story below the cut picks its Summaries up when it returns. Without
  // Summaries are always live (resolveModels); unchanged Stories make zero
  // calls.
  const summaries = models.summaries;
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

  // Per-outlet contribution line (issue #35): an Outlet contributing zero
  // Articles — typically a feed blocked from CI egress — must be visible in
  // the build log, not only in `pnpm verify` which runs locally.
  const contribution = contributionSummary(outlets, kept);
  console.log(`Contribution: ${contribution.line}`);
  if (contribution.zero.length > 0)
    console.warn(
      `Zero contribution: ${contribution.zero.join(', ')} — check the feed failures above.`,
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
  for (const story of editionHistory.stories) {
    if (!changed.has(story.slug)) continue;
    await writeFile(
      new URL(`${story.slug}.json`, STORIES_DIR),
      `${JSON.stringify(story, null, 2)}\n`,
    );
  }
  console.log(`Wrote ${DATA_DIR.pathname}`);

  // End-of-run cleanup (issue #75): after all writes succeeded, delete the
  // Story files that are frozen and never entered the Edition — they were
  // never linked, so no published URL breaks. A live Story below the cut is
  // never deleted (it may return on a later build); a Story that once
  // entered the Edition keeps its file and page forever. Deletion I/O errors
  // fail the build.
  const toDelete = slugsToDelete(editionHistory.stories, now);
  for (const slug of toDelete) {
    await unlink(new URL(`${slug}.json`, STORIES_DIR));
  }
  if (toDelete.size > 0) {
    console.log(
      `Cleanup: deleted ${toDelete.size} never-in-Edition frozen Story files ` +
        `(${editionHistory.stories.length - toDelete.size} remain).`,
    );
  }
  if (prunedCount > 0) {
    console.log(
      `Cleanup: pruned ${prunedCount} classification-cache entries ` +
        `(${Object.keys(pruned.entries).length} remain).`,
    );
  }
  return edition;
}

runEdition().catch((error) => {
  console.error(error);
  process.exit(1);
});
