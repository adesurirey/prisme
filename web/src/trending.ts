/**
 * Trending Stories ("En hausse", issue #102): a Story in the Edition is
 * flagged for a returning reader when it gained ground since *that reader's*
 * last visit — its Coverage grew past the delta. A Story absent from the
 * reader's baseline never badges, whatever its Coverage: the badge means
 * "you saw this Story before, it now covers more", never "this is new".
 * The signal is per-user, client-side (localStorage); the prerendered HTML
 * carries each card's story id and Coverage as data attributes and the
 * script below decides.
 *
 * Rules (scarcity session, issue #102):
 * - Eligibility: the Story has a baseline entry (it was in the Edition at
 *   the reader's last visit) that is fresh — younger than BASELINE_TTL_MS
 *   (48h) — and its Coverage gain ≥ max(DELTA_MIN, ceil(baseline × RATIO)).
 *   +2 outlets is a real move for a story covered by two, noise for one
 *   already covered by 25.
 * - Cap: at most TRENDING_CAP (3) badges per computation, the top absolute
 *   gainers; ties break by Edition order. The cap is a maximum, not a
 *   quota: fewer eligible stories, fewer badges.
 * - Session: the badge ids and their computation time live in sessionStorage
 *   ({v, ids, lastComputeAt}). Within RECOMPUTE_WINDOW_MS (15 min) of the
 *   computation — a click-through or reload inside the same visit — the
 *   stored ids are shown again as-is (pruned to the current cards), with no
 *   recompute, no snapshot write and no window extension. Past that window
 *   the ids are recomputed and REPLACE the stored ones (never merged, so a
 *   day-long tab cannot accumulate badges), and the visit is recorded.
 */

export const SEEN_KEY = 'prisme.seenStories';

/** sessionStorage key holding this visit's badge ids and computation time. */
export const SESSION_KEY = 'prisme.trendingSession';

const SEEN_VERSION = 1;
const SESSION_VERSION = 1;

/** Minimum Coverage gain, in distinct Outlets, past which a Story trends. */
export const TRENDING_COVERAGE_DELTA_MIN = 2;

/** Relative gain (fraction of baseline Coverage) past which a Story trends. */
export const TRENDING_COVERAGE_RATIO = 0.25;

/** At most this many trending badges per computation, the top gainers. */
export const TRENDING_CAP = 3;

/** A stored baseline older than this never generates a badge. */
export const BASELINE_TTL_MS = 48 * 3_600_000;

/**
 * Recompute window: a re-render within this delay of the last computation
 * is the same visit (click-through, reload) — the stored badge ids are
 * shown again unchanged.
 */
export const RECOMPUTE_WINDOW_MS = 15 * 60_000;

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

export interface TrendingSession {
  v: 1;
  /** This visit's badge ids, in Edition order. */
  ids: string[];
  /** When the ids were computed; guards re-renders within one visit. */
  lastComputeAt: number;
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

  // Eligibility, in Edition order: seen before (a Story absent from the
  // baseline is a new Story, not a gain) and past the scaled delta.
  const eligible = current.flatMap((story, order) => {
    const entry = seen.stories[story.id];
    if (entry == null || !fresh(entry, now)) return [];
    const gain = story.coverage - entry.coverage;
    if (
      gain <
      Math.max(
        TRENDING_COVERAGE_DELTA_MIN,
        Math.ceil(entry.coverage * TRENDING_COVERAGE_RATIO),
      )
    ) {
      return [];
    }
    return [{ id: story.id, gain, order }];
  });

  // Scarcity: keep the top gainers only, ties by Edition order, then
  // return the kept ids back in Edition order.
  const kept = new Set(
    eligible
      .sort((x, y) => y.gain - x.gain || x.order - y.order)
      .slice(0, TRENDING_CAP)
      .map(({ id }) => id),
  );
  return {
    trendingIds: current.map(({ id }) => id).filter((id) => kept.has(id)),
    next,
  };
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

export function readSession(storage: Storage): TrendingSession | null {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed == null) return null;
    const { v, ids, lastComputeAt } = parsed as {
      v?: unknown;
      ids?: unknown;
      lastComputeAt?: unknown;
    };
    if (v !== SESSION_VERSION || !Array.isArray(ids)) return null;
    if (typeof lastComputeAt !== 'number') return null;
    return {
      v: SESSION_VERSION,
      ids: ids.filter((id): id is string => typeof id === 'string'),
      lastComputeAt,
    };
  } catch {
    return null;
  }
}

export function writeSession(storage: Storage, session: TrendingSession): void {
  try {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Private mode or full quota: badges just fall back to per-visit.
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
  span.title = 'Gagné en couverture depuis votre dernière visite';
  span.textContent = '\u2197\u2009en hausse';
  return span;
}

/**
 * Wire the Edition index: read each card's data attributes, decide trending
 * from the stored snapshot, reveal badges, write the new snapshot. Runs on
 * any page; only cards on the Edition index are affected.
 *
 * Badges survive within a visit: a re-render within RECOMPUTE_WINDOW_MS of
 * the last computation — clicking a story and coming back, reloading —
 * shows the stored ids again without recomputing or rewriting anything.
 * Past that window the ids are recomputed and replace the stored ones, so
 * a tab left open all day never accumulates badges.
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
  const nowMs = now.getTime();
  const seenSession = readSession(session);

  let badgeIds: string[];
  if (
    seenSession != null &&
    nowMs - seenSession.lastComputeAt < RECOMPUTE_WINDOW_MS
  ) {
    // Same visit, re-render: show this visit's ids, pruned to the current
    // cards. No recompute, no snapshot write, no window extension.
    badgeIds = seenSession.ids.filter((id) =>
      current.some(({ id: currentId }) => currentId === id),
    );
  } else {
    // A real new visit: compute the top movers, record the visit and
    // replace the session set with the fresh ids.
    const { trendingIds, next } = markTrending(
      current,
      nowMs,
      readSeen(storage),
    );
    writeSession(session, {
      v: SESSION_VERSION,
      ids: trendingIds,
      lastComputeAt: nowMs,
    });
    writeSeen(storage, next);
    badgeIds = trendingIds;
  }

  const trending = new Set(badgeIds);
  for (const el of cards) {
    if (!trending.has(el.dataset.storyId!)) continue;
    // The badge lands in the slot at the end of the Coverage meta line
    // (StoryCard's data-trending-slot); fall back to the card root.
    const badge = trendingBadge();
    (el.querySelector('[data-trending-slot]') ?? el).append(badge);
  }
}
