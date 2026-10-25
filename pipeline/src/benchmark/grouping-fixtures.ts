/**
 * Grouping-benchmark fixtures (issue #41): a snapshot of a real build's
 * incremental grouping step, rebuilt from data/ on every run.
 *
 * Three fixtures — the first two pinned to the latest Edition's builtAt:
 * - from-empty: every Article of the snapshot as fresh Articles, no live
 *   Stories — the post-reset rebuild shape (the #36 session's 456-article
 *   from-empty rebuild).
 * - long-context: the ~thousand-Stories steady state — live Stories as of
 *   builtAt minus the Stories holding the fresh Articles, plus the fresh
 *   batch (Articles under an hour old at builtAt). The fresh batch's
 *   original Stories are the pseudo-ground-truth: same-event Articles the
 *   last real build grouped together.
 * - deadlock (issue #149): the 2026-10-24 grouping deadlock reconstructed
 *   from the archive at a pinned historical build — see
 *   buildDeadlockFixture.
 *
 * Headlines and titles only: ADR-0003 forbids teasers on disk, and since
 * #154 the production grouping input is headline-only too — fixture and
 * production inputs are the same shape by construction.
 */
import { readFile } from 'node:fs/promises';
import type { Article, Story } from '@prisme/domain';
import { newestFirst, parseInstant } from '@prisme/domain';
import type { GroupingInputArticle, GroupingInputStory } from '../gemini.ts';
import { byNewestArticle, latestHeadlines } from '../grouping.ts';
import { COLLECTION_WINDOW_MS, ingestionIsOpen } from '../liveness.ts';
import { DATA_DIR, readStories } from '../paths.ts';

/** How far before builtAt the fresh batch reaches (one incremental build). */
export const FRESH_WINDOW_MS = 60 * 60 * 1000;

export interface FixtureStory extends GroupingInputStory {
  /**
   * Headlines of the Story's non-fresh Articles — never sent to the model,
   * only scored against proposed seeds by the dup-seed detector (the
   * Maricarmen detector of the #38 measurements).
   */
  headlines: string[];
}

export interface GroupingFixture {
  name: 'from-empty' | 'long-context' | 'deadlock';
  /** Story ids of the fresh batch, by Article id — the pseudo-ground-truth. */
  groundTruth: Record<string, string>;
  liveStories: FixtureStory[];
  freshArticles: GroupingInputArticle[];
  /** The deadlock fixture only (issue #149): the magnet Story the loop
   * shape is graded against — the re-assignment target the model kept
   * proposing and the Membership check kept refusing, hour after hour. */
  deadlock?: { magnetStoryId: string };
}

export interface FixtureSet {
  builtAt: string;
  fixtures: GroupingFixture[];
}

function ts(date: string): number {
  return Date.parse(date);
}

/** A snapshot Article as the Grouping model sees it: id, headline, Section.
 * Teasers never reach the benchmark fixtures (ADR-0003) — and since #154,
 * the production grouping input is the same headline-only shape. */
function toInputArticle(a: Article): GroupingInputArticle {
  return {
    id: a.id,
    headline: a.headline,
    ...(a.section ? { section: a.section } : {}),
  };
}

/** Build both fixtures from the Story files + Edition snapshot. */
export function buildFixtures(stories: Story[], builtAt: string): FixtureSet {
  const cutoff = ts(builtAt) - FRESH_WINDOW_MS;
  // The fresh batch: the Articles the latest build was still assigning —
  // under an hour old at builtAt. The from-empty fixture widens it to every
  // Article in the snapshot (the post-reset rebuild shape).
  const fresh = stories.flatMap((s) =>
    s.articles.filter((a) => ts(a.publishedAt) > cutoff),
  );
  const freshIds = new Set(fresh.map((a) => a.id));

  // Fresh Articles keep the Section the Decision model gave them — part of
  // the grouping prompt in production.
  const freshInputs: GroupingInputArticle[] = fresh.map(toInputArticle);
  const groundTruth: Record<string, string> = {};
  for (const story of stories) {
    for (const a of story.articles) {
      if (freshIds.has(a.id)) groundTruth[a.id] = story.id;
    }
  }
  const allInputs: GroupingInputArticle[] = stories
    .flatMap((s) => s.articles)
    .map(toInputArticle);

  // Live Stories as of builtAt that hold no fresh Article: in a real build
  // the fresh batch is not yet claimed by any Story, so Stories holding the
  // fresh batch drop out of the prompt (their Articles become the fresh
  // batch's new-Story candidates) while the rest stay as merge targets.
  const liveStories: FixtureStory[] = stories
    .filter((s) => s.articles.every((a) => !freshIds.has(a.id)))
    .map((s) => ({
      id: s.id,
      title: s.title,
      ...(s.section ? { section: s.section } : {}),
      headlines: s.articles.map((a) => a.headline),
      // The same member-headline context the production prompt gets
      // (ADR-0018) — the replay must exercise what production sends.
      latestHeadlines: latestHeadlines(s.articles),
    }));

  // from-empty keeps the same ground truth: the snapshot's own clustering,
  // the reference the no-cap rebuild (#36) was cross-checked against.
  return {
    builtAt,
    fixtures: [
      {
        name: 'from-empty',
        groundTruth,
        liveStories: [],
        freshArticles: allInputs,
      },
      {
        name: 'long-context',
        groundTruth,
        liveStories,
        freshArticles: freshInputs,
      },
    ],
  };
}

/** Read data/ (the repo is the database, ADR-0002) and build the fixture set. */
export async function fixturesFromData(): Promise<FixtureSet> {
  const edition = JSON.parse(
    await readFile(new URL('edition.json', DATA_DIR), 'utf8'),
  ) as { builtAt: string };
  const stories = await readStories();
  return {
    builtAt: edition.builtAt,
    fixtures: [
      ...buildFixtures(stories, edition.builtAt).fixtures,
      buildDeadlockFixture(stories),
    ],
  };
}

/**
 * The 2026-10-24 grouping deadlock (issues #147, #149), pinned to the last
 * hourly build of the day — edition builtAt 2026-10-24T23:01:20.223Z
 * (commit 6a460674). All day, the live magnet Story (the tribunal ruling
 * on the Paris march route) pulled the new march Articles and the
 * Membership check refused each merge, so the Articles stayed Unassigned
 * and were re-presented — the loop the refusal feedback (issue #150) must
 * break. The fixture reconstructs that build's shape from the archive:
 *
 * - live Stories: every archive Story that existed at the pin (createdAt
 *   ≤ pin) with its members cut at the pin (publishedAt ≤ pin) and its
 *   Ingestion window open there (ADR-0027) — the full field the model
 *   saw, the magnet among it. Reconstruction approximations, accepted:
 *   story titles are the archive's final ones (historical titles are not
 *   recoverable), members joined-after-the-pin are included when their
 *   publishedAt precedes it, and Stories later merged away (one, that
 *   day) are absent — none of which touches the magnet–march pair.
 * - fresh Articles: the march Story's Articles published inside the
 *   pin's 24 h collection window — exactly the day's march Articles,
 *   which sat Unassigned through every build and birthed the march Story
 *   at 01:01 the next night (61 of them at once). The rest of the day's
 *   300+ Unassigned pool left no archive trace and is not reconstructible.
 * - ground truth: each fresh Article → the march Story it eventually
 *   founded.
 *
 * The pinned Story ids are archive facts; a wipe-and-rebuild of data/
 * re-rolls them, and this builder then throws — re-pin deliberately
 * (the no-compat rule: prefer an explicit update over tolerant readers).
 */
export const DEADLOCK_INSTANT = '2026-10-24T23:01:20.223Z';
/** The magnet: the administrative-court ruling on the Paris march route,
 * born 2026-10-22, its window held open by each join until 00:53 the next
 * night — the re-assignment target of the loop. */
export const DEADLOCK_MAGNET_STORY_ID = '3bca5d1e9243';
/** The march Story the day's fresh Articles eventually founded — born
 * 2026-10-25T01:01:18Z with 61 of them, ranked #2 of the Edition from its
 * first build. */
export const DEADLOCK_MARCH_STORY_ID = 'aad46e9502ca';

/** Rebuild the 2026-10-24 deadlock fixture from the archive. */
export function buildDeadlockFixture(stories: Story[]): GroupingFixture {
  const pin = parseInstant(DEADLOCK_INSTANT)!;
  const now = new Date(pin);
  // Existence check first — the re-pin instruction beats a confusing
  // absence downstream (the magnet's members flow from the live pipeline).
  requireDeadlockStory(stories, DEADLOCK_MAGNET_STORY_ID, 'magnet');
  const march = requireDeadlockStory(stories, DEADLOCK_MARCH_STORY_ID, 'march');

  // The live field as of the pin: Stories that existed, their members cut
  // at the pin, window still open — in the production prompt's order
  // (newest member first, ties by id).
  const liveStories: FixtureStory[] = stories
    .filter((s) => {
      const created = parseInstant(s.createdAt);
      return created != null && created <= pin;
    })
    .map((s) => ({
      id: s.id,
      title: s.title,
      ...(s.section ? { section: s.section } : {}),
      articles: s.articles.filter((a) => {
        const published = parseInstant(a.publishedAt);
        return published != null && published <= pin;
      }),
    }))
    .filter((s) => s.articles.length > 0 && ingestionIsOpen(s, now))
    .sort(byNewestArticle)
    .map(({ articles, ...story }) => ({
      ...story,
      headlines: articles.map((a) => a.headline),
      latestHeadlines: latestHeadlines(articles),
    }));
  if (!liveStories.some((s) => s.id === DEADLOCK_MAGNET_STORY_ID)) {
    throw new Error(
      `deadlock fixture: the magnet Story is not live at ${DEADLOCK_INSTANT} — the pin itself is wrong (issue #149)`,
    );
  }

  // The day's fresh march Articles: the march Story's members inside the
  // pin's collection window — newest first, like the production fresh pool.
  const cutoff = pin - COLLECTION_WINDOW_MS;
  const fresh = march.articles
    .filter((a) => {
      const published = parseInstant(a.publishedAt);
      return published != null && published > cutoff && published <= pin;
    })
    .sort(newestFirst);

  return {
    name: 'deadlock',
    groundTruth: Object.fromEntries(
      fresh.map((a) => [a.id, DEADLOCK_MARCH_STORY_ID]),
    ),
    liveStories,
    freshArticles: fresh.map(toInputArticle),
    deadlock: { magnetStoryId: DEADLOCK_MAGNET_STORY_ID },
  };
}

/** A pinned deadlock Story, or a re-pin instruction: the pinned ids are
 * archive facts, and a missing one means the archive was rebuilt. */
function requireDeadlockStory(
  stories: Story[],
  id: string,
  which: 'magnet' | 'march',
): Story {
  const story = stories.find((s) => s.id === id);
  if (story == null) {
    throw new Error(
      `deadlock fixture: ${which} Story ${id} is not in data/stories — the archive was rebuilt and the ids re-rolled; re-pin the fixture's constants (issue #149)`,
    );
  }
  return story;
}
