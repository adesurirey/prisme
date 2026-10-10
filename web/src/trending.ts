/**
 * Trending Stories ("En hausse", issue-less design session): a Story in the
 * Edition is flagged for a returning reader when it has gained ground since
 * *that reader's* last visit — its Coverage grew past the delta, or it newly
 * entered the Edition. The signal is per-user, client-side (localStorage);
 * the prerendered HTML carries each card's story id and Coverage as data
 * attributes and the script below decides.
 *
 * Rules settled in the design session:
 * - Baseline: a snapshot of every Edition story's Coverage, written on every
 *   Edition-page visit, pruned to that visit's ids.
 * - Coverage delta ≥ 2 outlets (one more outlet is noise), or the story is in
 *   the Edition now and was absent from the reader's last visit.
 * - A baseline older than BASELINE_TTL_MS (48h) never generates a badge — a
 *   long-absent reader sees "everything changed", not a wall of badges.
 * - A badge fires once: this visit's snapshot erases it on the next render.
 */

export const SEEN_KEY = 'prisme.seenStories';

/** Coverage gain, in distinct Outlets, past which a Story trends. */
export const TRENDING_COVERAGE_DELTA = 2;

/** A stored baseline older than this never generates a badge. */
export const BASELINE_TTL_MS = 48 * 3_600_000;

export interface SeenEntry {
  coverage: number;
  seenAt: number;
}

export interface SeenBlob {
  version: 1;
  stories: Record<string, SeenEntry>;
}

export interface TrendingStory {
  id: string;
  coverage: number;
}

export interface TrendingResult {
  /** Ids of trending Stories, in Edition order. */
  trendingIds: string[];
  /** The snapshot to write for this visit, pruned to the current ids. */
  next: SeenBlob;
}

function fresh(entry: SeenEntry | undefined, now: number): boolean {
  return entry != null && now - entry.seenAt <= BASELINE_TTL_MS;
}

export function markTrending(
  current: TrendingStory[],
  now: number,
  seen: SeenBlob | null,
): TrendingResult {
  const next: SeenBlob = {
    version: 1,
    stories: Object.fromEntries(
      current.map((s) => [s.id, { coverage: s.coverage, seenAt: now }]),
    ),
  };
  if (seen == null) return { trendingIds: [], next };

  // A returning reader has at least one usable (fresh) baseline entry; a
  // stale blob means the reader was away too long — no badges at all.
  const returning = Object.values(seen.stories).some((e) => fresh(e, now));
  if (!returning) return { trendingIds: [], next };

  const trendingIds = current
    .filter(({ id, coverage }) => {
      const entry = seen.stories[id];
      if (entry == null) return true; // newly entered the Edition
      return (
        fresh(entry, now) &&
        coverage - entry.coverage >= TRENDING_COVERAGE_DELTA
      );
    })
    .map(({ id }) => id);
  return { trendingIds, next };
}

export function readSeen(storage: Storage): SeenBlob | null {
  const raw = storage.getItem(SEEN_KEY);
  if (raw == null) return null;
  try {
    const blob = JSON.parse(raw) as SeenBlob;
    if (blob?.version !== 1 || typeof blob.stories !== 'object') return null;
    return blob;
  } catch {
    return null;
  }
}

export function writeSeen(storage: Storage, blob: SeenBlob): void {
  try {
    storage.setItem(SEEN_KEY, JSON.stringify(blob));
  } catch {
    // Private mode or full quota: trending silently degrades to nothing.
  }
}

function trendingBadge(): HTMLElement {
  const span = document.createElement('span');
  span.dataset.trendingBadge = '';
  span.className =
    'inline-flex items-center rounded-full border border-line bg-hover px-2 py-0.5 font-medium normal-case text-ink';
  span.textContent = 'En hausse';
  return span;
}

/**
 * Wire the Edition index: read each card's data attributes, decide trending
 * from the stored snapshot, reveal badges, write the new snapshot. Runs on
 * any page; only cards on the Edition index are affected.
 */
export function installTrending(
  doc: Document = document,
  storage: Storage = localStorage,
  now: Date = new Date(),
): void {
  const cards = doc.querySelectorAll<HTMLElement>('[data-story-id]');
  if (cards.length === 0) return;
  const current: TrendingStory[] = [...cards].map((el) => ({
    id: el.dataset.storyId!,
    coverage: Number(el.dataset.coverage ?? 0),
  }));

  const { trendingIds, next } = markTrending(
    current,
    now.getTime(),
    readSeen(storage),
  );
  const trending = new Set(trendingIds);
  for (const el of cards) {
    if (!trending.has(el.dataset.storyId!)) continue;
    const h2 = el.querySelector('h2');
    const badge = trendingBadge();
    if (h2) el.insertBefore(badge, h2);
    else el.append(badge);
  }
  writeSeen(storage, next);
}
