/**
 * Grouping-benchmark fixtures (issue #41): a snapshot of a real build's
 * incremental grouping step, rebuilt from data/ on every run.
 *
 * Two fixtures, both pinned to the latest Edition's builtAt:
 * - from-empty: every Article of the snapshot as fresh Articles, no live
 *   Stories — the post-reset rebuild shape (the #36 session's 456-article
 *   from-empty rebuild).
 * - long-context: the ~thousand-Stories steady state — live Stories as of
 *   builtAt minus the Stories holding the fresh Articles, plus the fresh
 *   batch (Articles under an hour old at builtAt). The fresh batch's
 *   original Stories are the pseudo-ground-truth: same-event Articles the
 *   last real build grouped together.
 *
 * Headlines and titles only: ADR-0003 forbids teasers on disk, and grouping
 * runs fine without them (verified by the #38 replay).
 */
import { readFile } from 'node:fs/promises';
import type { Story } from '@prisme/domain';
import type { GroupingInputArticle, GroupingInputStory } from '../gemini.ts';
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
  name: 'from-empty' | 'long-context';
  /** Story ids of the fresh batch, by Article id — the pseudo-ground-truth. */
  groundTruth: Record<string, string>;
  liveStories: FixtureStory[];
  freshArticles: GroupingInputArticle[];
}

export interface FixtureSet {
  builtAt: string;
  fixtures: GroupingFixture[];
}

function ts(date: string): number {
  return Date.parse(date);
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
  const freshInputs: GroupingInputArticle[] = fresh.map((a) => ({
    id: a.id,
    headline: a.headline,
    teaser: '',
    ...(a.section ? { section: a.section } : {}),
  }));
  const groundTruth: Record<string, string> = {};
  for (const story of stories) {
    for (const a of story.articles) {
      if (freshIds.has(a.id)) groundTruth[a.id] = story.id;
    }
  }
  const allInputs: GroupingInputArticle[] = stories
    .flatMap((s) => s.articles)
    .map((a) => ({
      id: a.id,
      headline: a.headline,
      teaser: '',
      ...(a.section ? { section: a.section } : {}),
    }));

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
  return buildFixtures(await readStories(), edition.builtAt);
}
