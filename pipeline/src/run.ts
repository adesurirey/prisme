import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { Edition, TopicRegistry } from '@prisme/domain';
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
import {
  CLASSIFICATIONS_PATH,
  DATA_DIR,
  REFUSAL_CACHE_PATH,
  STORIES_DIR,
  TEASER_CACHE_PATH,
} from './paths.ts';
import { resolveModels } from './policy.ts';
import { assembleEdition } from './ranking.ts';
import {
  loadRefusalCache,
  mergeRefusals,
  saveRefusalCache,
} from './refusal-cache.ts';
import {
  SUMMARIES_BUDGET,
  SUMMARIES_PROMPT_VERSION,
  updateSummaries,
} from './summarize.ts';
import {
  loadTeaserCache,
  mergeTeasers,
  saveTeaserCache,
} from './teaser-cache.ts';
import { mergeTopicRegistry } from './topic-registry.ts';

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
  // Private teaser cache (ADR-0027, amending ADR-0003): the collector's
  // in-memory teasers are merged into the cache — never overwriting an
  // existing entry — so a multi-day Story re-Summary still receives the
  // teasers of Articles that rotated out of the feeds. The cache lives at
  // .cache/teasers.json, outside the published data/, gitignored; CI
  // round-trips it through the Actions cache. A missing or corrupt file
  // degrades to headline-only input and never fails a build.
  const teaserCache = await loadTeaserCache(TEASER_CACHE_PATH);
  const {
    articles,
    teasers: collectedTeasers,
    failures,
  } = await collect(outlets, fetchFeed, now);
  const teasers = new Map(
    Object.entries(mergeTeasers(teaserCache, collectedTeasers)),
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
  // The refusal cache (issue #148) rides along: prior-build Membership
  // refusals answer an identical (Article, Story) pair without a paid
  // check. Ids and instants only, TTL 48 h; a missing or corrupt file
  // degrades to an empty ledger with a warning and never fails the build.
  const priorRefusals = await loadRefusalCache(REFUSAL_CACHE_PATH, now);
  const existing = await loadStories(STORIES_DIR);
  const outcome = await groupStories({
    articles: kept,
    teasers,
    existing,
    now,
    makeId: () => randomBytes(6).toString('hex'),
    priorRefusals: new Set(Object.keys(priorRefusals)),
    clients: {
      grouping: models.grouping,
      membership: models.membership,
      titles: models.titles,
    },
  });
  if (outcome.topics.length > 0)
    console.log(
      `Topics: ${outcome.topics.length} confirmed this build (reached two Episodes, ADR-0024).`,
    );

  // Topic registry (ADR-0024): data/topics.json gains the Topics confirmed
  // this build — a topic exists from two Episodes, like a Story from two
  // Articles (ADR-0015) — and never changes otherwise: Stories never leave
  // their Topic, and a Topic's entry is written once, from its founding
  // Story. The registry module owns the merge and the public-slug minting.
  // An absent file (first Topics build) means an empty registry.
  const topicsPath = new URL('topics.json', DATA_DIR);
  if (outcome.topics.length > 0) {
    let registry: TopicRegistry = { topics: [] };
    try {
      registry = JSON.parse(
        await readFile(topicsPath, 'utf8'),
      ) as TopicRegistry;
    } catch (error) {
      // Absent file: first build that confirms a Topic. Any other read or
      // parse failure propagates and fails the build (ADR-0005) — a corrupt
      // registry is never silently reset and overwritten.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const { registry: merged, added } = mergeTopicRegistry(
      registry,
      outcome.topics,
    );
    if (added > 0)
      await writeFile(topicsPath, `${JSON.stringify(merged, null, 2)}\n`);
  }

  // Front-page history (issue #6): reconcile the flags of every live Story
  // with today's collection — `frontPage` is the current snapshot,
  // `everFrontPage` sticky. Frozen Stories are untouched (ADR-0005). Stories
  // whose flags changed join the changed set, so their files are rewritten.
  const liveIds = new Set(outcome.live.map((s) => s.id));
  const frontpage = updateFrontPageHistory(outcome.stories, kept, now);

  // The Edition (ADR-0027, amended by ADR-0029's third window;
  // superseding ADR-0022/0026's live pool): rolling windows over ALL
  // Stories — frozen ones included. « En direct » (the last 12 hours by
  // founding instant, ranked latest-first) is by construction a subset of
  // « Aujourd'hui » (the last 24 hours), which stays uncapped and keeps
  // feeding the home; the Summaries budget below takes its top-20 in this
  // ranked order. « 7 jours » (the last 7 days) is floored to Stories
  // covered by ≥ 10 Outlets in the window. A Story leaves la Une by decay
  // — no Outlet reporting it inside the window — never at a clock edge;
  // overnight coverage is still on la Une in the morning.
  const outletById = new Map(outlets.map((o) => [o.id, o]));
  const ranked = assembleEdition(frontpage.stories, now);

  // Edition history (issue #75): `everInEdition` is sticky — set the moment
  // a Story ranks into either Edition window, frozen members included
  // (ADR-0027: the windows span frozen Stories, and an unstamped member
  // would be deleted by the cleanup below while still linked on « 7 jours »),
  // so the flag survives its freezing and the never-entered deletion rule
  // below keeps working. Changed files are rewritten.
  const editionHistory = updateEditionHistory(
    frontpage.stories,
    new Set([...ranked.day, ...ranked.week].map((s) => s.id)),
    now,
  );
  // Re-map the ranked windows onto the reconciled Stories by id: the flags
  // above may replace flag-changed Stories with new objects, and the
  // Summaries step below mutates the Edition Stories in place — they must
  // be the same objects that get written to disk, or fresh Summaries
  // would be lost.
  const reconciledById = new Map(editionHistory.stories.map((s) => [s.id, s]));
  const edition: Edition = {
    builtAt: now.toISOString(),
    latestStories: ranked.latest.map((s) => reconciledById.get(s.id) ?? s),
    stories: ranked.day.map((s) => reconciledById.get(s.id) ?? s),
    weekStories: ranked.week.map((s) => reconciledById.get(s.id) ?? s),
  };
  const changed = new Set([
    ...outcome.changed,
    ...frontpage.changed,
    ...editionHistory.changed,
  ]);

  // Summaries & Differences (issue #7, ADR-0006, budgeted by ADR-0022):
  // one Flash-Lite call per Story that gained Articles since its last
  // Summaries run — unchanged Stories make zero calls — capped at the top
  // SUMMARIES_BUDGET ranked Stories per build, in the 24-hour window's
  // ranked order (the derivation lives with the constant in
  // summarize.ts). Stories beyond the budget keep their existing summary,
  // shown as-is, until a later build re-ranks them into the top-20.
  // Nothing is hidden from readers for budget reasons.
  const summaries = models.summaries;
  const summaryOutcome = await updateSummaries({
    stories: edition.stories,
    now,
    teasers,
    outletById,
    model: summaries,
    promptVersion: SUMMARIES_PROMPT_VERSION,
    budget: SUMMARIES_BUDGET,
  });
  for (const slug of summaryOutcome.changed) changed.add(slug);

  // Save the cache with this build's accumulation (ADR-0027): after the
  // model passes so a Story that re-Summarized this build had the aged
  // entries available, and so a clean build persists them for the next one.
  // `teasers` is already the merged map (cache + collection, above); no pass
  // mutates it.
  await saveTeaserCache(Object.fromEntries(teasers), TEASER_CACHE_PATH);

  // Refusal cache (issue #148): merged and saved here — after every model
  // pass succeeded, like the teaser cache, so a failed build writes nothing
  // and its refusals are simply re-paid next build (ADR-0005
  // retry-ability). The merge prunes against the build instant, keeping the
  // ledger bounded to ~2 days of pairs.
  await saveRefusalCache(
    mergeRefusals(priorRefusals, outcome.refusals, now),
    REFUSAL_CACHE_PATH,
  );

  const filesToWrite = changed.size;
  section('📰', 'Edition');
  console.log(
    `${edition.latestStories.length} in « En direct », ` +
      `${edition.stories.length} ranked stories in « Aujourd'hui » (of ${liveIds.size} live), ` +
      `${edition.weekStories.length} in « 7 jours » — from ${kept.length} articles; ` +
      `${existing.length} on disk, ${filesToWrite} file(s) to write, ${summaryOutcome.calls} summaries call(s).`,
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
