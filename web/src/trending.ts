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
 * - A badge fires once per browser session: this visit's snapshot erases it
 *   on the next render, but the badge ids are kept in sessionStorage so the
 *   reader can click through stories and come back without the badges
 *   vanishing mid-scan. A new session (or tab) recomputes from the snapshot.
 */

export const SEEN_KEY = 'prisme.seenStories';

/** sessionStorage key holding this session's badge ids (JSON array). */
export const SESSION_KEY = 'prisme.trendingSession';

const SEEN_VERSION = 1;

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
    version: SEEN_VERSION,
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
    if (blob?.version !== SEEN_VERSION || typeof blob.stories !== 'object')
      return null;
    return blob;
  } catch {
    return null;
  }
}

export function readSession(storage: Storage): string[] {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (raw == null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function writeSession(storage: Storage, ids: string[]): void {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(ids));
  } catch {
    // Private mode or full quota: badges just fall back to per-render.
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
  // Preview-settled design: sarcelle (--trending, ADR-0014) so the signal
  // catches the eye while staying outside the three Leaning colors, and a
  // hover tooltip for the "since when" (docs/brand.md voice). The meta
  // line's own span carries a -1px optical nudge (CoverageMeta) — the badge
  // takes the same one, or it reads a pixel low next to "x articles".
  span.className = 'inline-flex items-center font-medium text-trending';
  span.title = 'Nouveau ou gagné en couverture depuis votre dernière visite';
  span.textContent = '\u2197\u2009en hausse';
  return span;
}

/**
 * Wire the Edition index: read each card's data attributes, decide trending
 * from the stored snapshot, reveal badges, write the new snapshot. Runs on
 * any page; only cards on the Edition index are affected.
 *
 * Badges survive within the browser session: the ids computed this render
 * are merged with the ones already recorded in sessionStorage (pruned to
 * the current Edition), so clicking a story and coming back — or reloading
 * — keeps the whole list scannable. Only a new session clears them.
 */
export function installTrending(
  doc: Document = document,
  storage: Storage = localStorage,
  now: Date = new Date(),
  session: Storage = sessionStorage,
): void {
  const cards = doc.querySelectorAll<HTMLElement>('[data-story-id]');
  const current: TrendingStory[] = [...cards].map((el) => ({
    id: el.dataset.storyId!,
    coverage: Number(el.dataset.coverage ?? 0),
  }));

  const { trendingIds, next } = markTrending(
    current,
    now.getTime(),
    readSeen(storage),
  );
  // The snapshot erases each badge on the next render; the session set
  // keeps them visible for the whole session so the reader can scan every
  // trending story (click through, come back, reload).
  const sessionIds = readSession(session).filter((id) =>
    current.some(({ id: currentId }) => currentId === id),
  );
  const badgeIds = current
    .map(({ id }) => id)
    .filter((id) => trendingIds.includes(id) || sessionIds.includes(id));
  const trending = new Set(badgeIds);
  writeSession(session, badgeIds);
  for (const el of cards) {
    if (!trending.has(el.dataset.storyId!)) continue;
    // The badge lands in the slot at the end of the Coverage meta line
    // (StoryCard's data-trending-slot); fall back to the card root.
    const badge = trendingBadge();
    (el.querySelector('[data-trending-slot]') ?? el).append(badge);
  }
  writeSeen(storage, next);
}
