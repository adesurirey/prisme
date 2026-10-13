import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
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
import { parisDayKey } from './paris-day.ts';
import { CLASSIFICATIONS_PATH, DATA_DIR, STORIES_DIR } from './paths.ts';
import { resolveModels } from './policy.ts';
import { assembleEdition } from './ranking.ts';
import { SUMMARIES_PROMPT_VERSION, updateSummaries } from './summarize.ts';

// Build-log section headers: one emoji-prefixed line per pipeline step, so a
// scrolling CI log reads as a sequence of labeled blocks instead of one dense
// paragraph. A blank line opens each block.
function section(emoji: string, title: string): void {
  console.log(`\n${emoji} ${title}`);
}

export async function runEdition(): Promise<Edition> {
  // Model policy (ADR-0005, as amended in issue #40): resolveModels decides
  // what is live, what degrades, and what fails — see policy.ts. Failing the
  // build up front happens here, before anything is collected or written —
  // the old degrade-to-singletons path corrupted the archive permanently;
  // since ADR-0015 a Story is never born from fewer than two Articles.
  const models = resolveModels();

  section('📡', 'Collect');
  const now = new Date();
  const { articles, teasers, failures } = await collect(
    outlets,
    fetchFeed,
    now,
  );
  console.log(
    `${articles.length} articles from ${outlets.length} outlets` +
      `${failures.length > 0 ? `, ${failures.length} feed failure(s)` : ''}.`,
  );

  // Incremental classification (issue #4): only new ids hit the model; the
  // winner comes from OPENROUTER_API_KEY. Without the key, Articles stay
  // unclassified — a safe, retried degrade. With the key, a build where
  // every fresh classification fails throws (ADR-0005, as amended).
  const model = models.decision.model;
  if (model == null) {
    console.warn(models.decision.note);
  }
  section('🏷️', 'Classify');
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
  console.log(
    `${classified - before} newly classified, ${articles.length - kept.length} not_news dropped — ` +
      `${kept.length} kept (cache: ${Object.keys(pruned.entries).length} entries` +
      `${prunedCount > 0 ? `, ${prunedCount} pruned` : ''}).`,
  );

  // Incremental grouping (issue #5): the Story files on disk are the record;
  // only fresh Articles are assigned. A failed Grouping call throws inside
  // groupStories — nothing is written, and the build fails (ADR-0005, as
  // amended in issue #40).
  section('🧩', 'Group');
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

  // The Edition (issue #98, ADR-0017): current-day Stories ranked by the
  // ADR-0009 key first, then backfill — previous days' everInEdition Stories
  // (frozen included), newest day first, each day ranked the same way —
  // capped at EDITION_SIZE. Live Stories below the cut keep updating outside
  // it and may return on a later build; only a Story with no live Articles
  // freezes.
  const outletById = new Map(outlets.map((o) => [o.id, o]));
  const ranked = assembleEdition(
    frontpage.stories,
    parisDayKey(now.toISOString()),
  );

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
    now,
    teasers,
    outletById,
    model: summaries,
    promptVersion: SUMMARIES_PROMPT_VERSION,
  });
  for (const slug of summaryOutcome.changed) changed.add(slug);

  const filesToWrite = changed.size;
  section('📰', 'Edition');
  console.log(
    `${edition.stories.length} ranked stories (of ${liveIds.size} live) ` +
      `from ${kept.length} articles; ${existing.length} on disk, ` +
      `${filesToWrite} file(s) to write, ${summaryOutcome.calls} summaries call(s).`,
  );

  // Per-outlet contribution grid (issue #35): an Outlet contributing zero
  // Articles — typically a feed blocked from CI egress — must be visible in
  // the build log, not only in `pnpm verify` which runs locally. Sorted by
  // count descending so the strongest and silent Outlets bracket the list.
  const contribution = contributionSummary(outlets, kept);
  section('📊', 'Contribution');
  const width = Math.max(...contribution.counts.map(([id]) => id.length));
  const cells = [...contribution.counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, count]) => {
      const flag = count === 0 ? ' ⚠' : '';
      return `${id.padEnd(width)}  ${String(count).padStart(3)}${flag}`;
    });
  for (let i = 0; i < cells.length; i += 4) {
    console.log(`  ${cells.slice(i, i + 4).join('    ')}`);
  }
  if (contribution.zero.length > 0)
    console.warn(
      `⚠️ Zero contribution: ${contribution.zero.join(', ')} — check the feed failure(s) above.`,
    );

  await mkdir(STORIES_DIR, { recursive: true });
  // Outlet config snapshot (identity, feeds and the Reach figure — issue #89):
  // the sourced config lives in @prisme/domain and is imported by the
  // pipeline and the site.
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
  section('💾', 'Write');
  console.log(
    `Wrote ${fileURLToPath(DATA_DIR)} ` +
      `(${filesToWrite} story file(s), edition.json, outlets.json).`,
  );

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
      `Cleanup: deleted ${toDelete.size} never-in-Edition frozen Story file(s) — ` +
        `${editionHistory.stories.length - toDelete.size} remain.`,
    );
  }
  return edition;
}

runEdition().catch((error) => {
  console.error(error);
  process.exit(1);
});
