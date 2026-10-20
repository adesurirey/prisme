import type { RedirectEntry, RedirectRegistry, Story } from '@prisme/domain';

/**
 * The manual merge (merge-stories.ts): the Base Story survives whole — its
 * slug, id, title, Summaries, Topic and summarizedArticleCount stay — and
 * the absorbed Story's Articles move in as the unseen prefix (ADR-0006:
 * append-only, newest first), so the next build's Summaries step re-reads
 * exactly the incoming Articles and re-synthesizes from the whole set.
 * Pure decision: two Stories and a clock in, a plan out — the CLI owns the
 * I/O (story files, edition.json, the redirect registry).
 */
import { isLive } from './liveness.ts';

export interface MergeStoriesOptions {
  now: Date;
  /** Allow merging Stories of different storyDays (ADR-0017's rule is for
   * the Grouping model's future assignments, not a human's judged merge). */
  allowCrossDay?: boolean;
  /** Allow merging into a frozen Base — the Articles join the file but no
   * Summaries call will ever rewrite them (the build never edits a frozen
   * Story, ADR-0005). */
  allowFrozenBase?: boolean;
}

export type MergeStoriesResult =
  | { ok: true; merged: Story; redirect?: RedirectEntry; warnings: string[] }
  | { ok: false; refusal: string };

function byNewestFirst(a: { publishedAt: string }, b: { publishedAt: string }) {
  return b.publishedAt.localeCompare(a.publishedAt);
}

export function mergeStories(
  base: Story,
  absorbed: Story,
  options: MergeStoriesOptions,
): MergeStoriesResult {
  if (base.id === absorbed.id || base.slug === absorbed.slug) {
    return { ok: false, refusal: 'The two slugs point at the same Story.' };
  }
  if (base.storyDay !== absorbed.storyDay && !options.allowCrossDay) {
    return {
      ok: false,
      refusal:
        `Cross-day merge refused: base ${base.slug} (${base.storyDay}) vs ` +
        `${absorbed.slug} (${absorbed.storyDay}) — pass --force to override.`,
    };
  }
  if (!isLive(base, options.now) && !options.allowFrozenBase) {
    return {
      ok: false,
      refusal:
        `Base ${base.slug} is frozen: the next build never re-summarizes a ` +
        'frozen Story (ADR-0005), so the merged Articles would never reach ' +
        'the Summaries — pass --force to keep the Articles-only merge.',
    };
  }

  const warnings: string[] = [];
  const baseIds = new Set(base.articles.map((a) => a.id));
  const incoming = absorbed.articles.filter((a) => {
    if (!baseIds.has(a.id)) return true;
    warnings.push(
      `Article ${a.id} already in the Base — dropped: ${a.headline}`,
    );
    return false;
  });

  if (
    base.topicId !== absorbed.topicId &&
    absorbed.topicId != null &&
    base.topicId != null
  ) {
    warnings.push(
      `Topic mismatch: absorbed Story keeps nothing — its Topic ` +
        `(${absorbed.topicId}) is dropped, the merged Story stays in the ` +
        `Base's Topic (${base.topicId}).`,
    );
  }

  const merged: Story = {
    ...base,
    articles: [...incoming].sort(byNewestFirst).concat(base.articles),
  };

  // A redirect only matters for a URL that was ever published (issue #75:
  // everInEdition is sticky, set the moment a Story ranked into the
  // Edition) — a never-published Story leaves no link behind.
  const redirect =
    absorbed.everInEdition === true
      ? {
          from: { day: absorbed.storyDay, slug: absorbed.slug },
          to: { day: base.storyDay, slug: base.slug },
          createdAt: options.now.toISOString(),
        }
      : undefined;

  return { ok: true, merged, redirect, warnings };
}

/**
 * The registry merge: append the entry — replacing any entry with the same
 * `from` — and repoint every entry that redirects into the absorbed Story,
 * so a chain of merges stays one hop long. Pure: registry and entry in, a
 * new registry out (never mutates the input).
 */
export function mergeRedirectRegistry(
  registry: RedirectRegistry,
  entry: RedirectEntry,
): { registry: RedirectRegistry; repointed: number } {
  let repointed = 0;
  const redirects = registry.redirects.map((r) => {
    if (r.to.slug === entry.from.slug && r.to.day === entry.from.day) {
      repointed += 1;
      return { ...r, to: entry.to };
    }
    return r;
  });
  const sameFrom = redirects.findIndex(
    (r) => r.from.slug === entry.from.slug && r.from.day === entry.from.day,
  );
  if (sameFrom >= 0) redirects[sameFrom] = { ...redirects[sameFrom], ...entry };
  else redirects.push(entry);
  return { registry: { redirects }, repointed };
}
