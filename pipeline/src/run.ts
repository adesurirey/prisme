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
import { collect, contributionSummary } from './collect.ts';
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
  await saveCache(cache, CLASSIFICATIONS_PATH);
  const classified = Object.keys(cache.entries).length;

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
  // Experiment lever: PRISME_MAX_CHECKS=all lifts the per-build Membership
  // budget; a number overrides the default (ADR-0005's 20). The Membership
  // checker is either live or the declared fail-when-pending adapter.
  const maxChecks = models.maxChecks;
  const outcome = await groupStories({
    articles: kept,
    teasers,
    existing,
    now,
    makeId: () => randomBytes(6).toString('hex'),
    maxChecks,
    clients: { grouping: models.grouping, membership: models.membership },
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

  // The Edition is the ranked top EDITION_SIZE (issue #37, ADR-0009): Stories
  // order by Coverage, then recency — deterministically. Live Stories below
  // the cut keep updating outside it and may return on a later build; only a
  // Story with no live Articles freezes.
  const outletById = new Map(outlets.map((o) => [o.id, o]));
  const edition: Edition = {
    builtAt: now.toISOString(),
    stories: rankStories(
      frontpage.stories.filter((s) => liveIds.has(s.id)),
    ).slice(0, EDITION_SIZE),
  };

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
