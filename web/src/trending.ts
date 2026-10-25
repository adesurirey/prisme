/**
 * Trending Stories ("En hausse", ADR-0029): a Story in the Edition is
 * flagged for a returning reader when it **materially changed** since
 * *that reader's* last visit — its Article count grew ≥ 25 % past the
 * stored baseline, the very ADR-0027 gate that re-fires a Summaries pass,
 * imported from the domain package so the badge can never drift from what
 * the pipeline re-synthesized. A Story absent from the reader's baseline
 * never badges, whatever its Article count: the badge means "you saw this
 * Story before, it grew since", never "this is new" (newness is the En
 * direct page's job, ADR-0029 — « Nouveau » is gone). The signal is
 * per-user, client-side (localStorage); the prerendered HTML carries each
 * card's story id and Article count as data attributes and the script
 * below decides.
 *
 * Rules:
 * - Eligibility, per Story: a baseline entry (it was on a page the reader
 *   visited) that is fresh — younger than BASELINE_TTL_MS (4h) — and
 *   grewAtLeast(entry.articleCount, current count). Uncapped (ADR-0029
 *   removed the cap of three and the max(2, …) Outlet floor): every
 *   eligible Story on the page badges, in page order; the 25 % gate is
 *   the scarcity mechanism.
 * - Merge (ADR-0029): the visited page's cards overwrite their entries
 *   (count + now), every other entry persists with its original seen-at,
 *   pruned lazily by the TTL — the baseline means "everything I've seen",
 *   not "the last page I opened".
 * - Session: the badge ids and their computation time live in sessionStorage
 *   ({v, ids, lastComputeAt}). Within RECOMPUTE_WINDOW_MS (15 min) of the
 *   computation — a click-through or reload inside the same visit — the
 *   stored ids are shown again as-is (pruned to the current cards), with no
 *   recompute, no snapshot write and no window extension. Past that window
 *   the ids are recomputed and REPLACE the stored ones (never merged, so a
 *   day-long tab cannot accumulate badges), and the visit is recorded.
 */

import { grewAtLeast } from '@prisme/domain';

export const SEEN_KEY = 'prisme.seenStories';

/** sessionStorage key holding this visit's badge ids and computation time. */
export const SESSION_KEY = 'prisme.trendingSession';

const SEEN_VERSION = 2;
const SESSION_VERSION = 3;

/** A stored baseline older than this never generates a signal (ADR-0020's
 *  TTL, kept by ADR-0029): the window is the hour-to-hour or
 *  evening-to-morning gap of a reader who checks in nearly every Edition —
 *  past it that Story's entry is stale, and a stale entry never badges. */
export const BASELINE_TTL_MS = 4 * 3_600_000;

/**
 * Recompute window: a re-render within this delay of the last computation
 * is the same visit (click-through, reload) — the stored badge ids are
 * shown again unchanged.
 */
export const RECOMPUTE_WINDOW_MS = 15 * 60_000;

export interface SeenEntry {
  articleCount: number;
  seenAt: number;
}

export interface SeenBlob {
  version: 2;
  stories: Record<string, SeenEntry>;
}

export interface TrendingStory {
  id: string;
  articleCount: number;
}

export interface TrendingResult {
  /** Ids of trending Stories, in page order. */
  trendingIds: string[];
  /** The snapshot to write for this visit: the merged baseline. */
  next: SeenBlob;
}

export interface TrendingSession {
  v: 3;
  /** This visit's trending badge ids, in page order. */
  trendingIds: string[];
  /** When the ids were computed; guards re-renders within one visit. */
  lastComputeAt: number;
}

function fresh(entry: SeenEntry, now: number): boolean {
  return now - entry.seenAt <= BASELINE_TTL_MS;
}

export function markTrending(
  current: TrendingStory[],
  now: number,
  seen: SeenBlob | null,
): TrendingResult {
  // The merged baseline: everything the reader ever saw, stale entries
  // pruned lazily by the TTL (a stale entry can never badge again; if the
  // Story reappears on a visited page, the overwrite re-freshens it).
  const merged: Record<string, SeenEntry> = {};
  if (seen != null) {
    for (const [id, entry] of Object.entries(seen.stories)) {
      if (fresh(entry, now)) merged[id] = entry;
    }
  }
  // Visited cards overwrite their entries: count + now.
  for (const story of current) {
    merged[story.id] = { articleCount: story.articleCount, seenAt: now };
  }
  const next: SeenBlob = { version: SEEN_VERSION, stories: merged };

  // Eligibility, in page order: seen before, entry still fresh, and the
  // shared growth gate says the Story materially changed. Absence from
  // the baseline is not growth — a Story the reader never saw gets no
  // badge here (an absent entry means gate input "no baseline", not the
  // pass's "births always pass").
  const trendingIds = current.flatMap((story) => {
    const entry = seen?.stories[story.id];
    if (entry == null || !fresh(entry, now)) return [];
    if (!grewAtLeast(entry.articleCount, story.articleCount)) return [];
    return [story.id];
  });
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

export function readSession(storage: Storage): TrendingSession | null {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed == null) return null;
    const { v, trendingIds, lastComputeAt } = parsed as Record<string, unknown>;
    if (v !== SESSION_VERSION || !Array.isArray(trendingIds)) return null;
    if (typeof lastComputeAt !== 'number') return null;
    return {
      v: SESSION_VERSION,
      trendingIds: trendingIds.filter(
        (id): id is string => typeof id === 'string',
      ),
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

/** The per-visitor badge (ADR-0029): sarcelle (ADR-0014) means one thing —
 *  "this grew since your last visit". The meta line's own span carries a
 *  -1px optical nudge (CoverageMeta) — the badge takes the same one, or
 *  it reads a pixel low next to "x articles". */
function trendingBadge(): HTMLElement {
  const span = document.createElement('span');
  span.dataset.trendingBadge = '';
  span.className = 'inline-flex items-center font-medium text-trending';
  span.title = 'Couverture et résumé enrichis depuis votre dernière visite';
  span.textContent = '\u2197\u2009en hausse';
  return span;
}

/**
 * Wire the Edition index: read each card's data attributes, decide the
 * per-visitor signal from the stored snapshot, reveal badges, write the
 * merged baseline. Runs on any page; only cards on a page that runs it
 * are affected. « 7 jours » never runs it — badge-free by ADR-0029.
 *
 * Badges survive within a visit: a re-render within RECOMPUTE_WINDOW_MS
 * of the last computation — clicking a story and coming back, reloading —
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
    articleCount: Number(el.dataset.articleCount ?? 0),
  }));
  const nowMs = now.getTime();
  const seenSession = readSession(session);

  const currentIds = new Set(current.map(({ id }) => id));
  let trendingIds: string[];
  if (
    seenSession != null &&
    nowMs - seenSession.lastComputeAt < RECOMPUTE_WINDOW_MS
  ) {
    // Same visit, re-render: show this visit's ids, pruned to the current
    // cards. No recompute, no snapshot write, no extension.
    trendingIds = seenSession.trendingIds.filter((id) => currentIds.has(id));
  } else {
    // A real new visit: compute the badge set, record the visit (merged
    // baseline) and replace the session set with the fresh ids.
    const result = markTrending(current, nowMs, readSeen(storage));
    trendingIds = result.trendingIds;
    writeSession(session, {
      v: SESSION_VERSION,
      trendingIds,
      lastComputeAt: nowMs,
    });
    writeSeen(storage, result.next);
  }

  const trending = new Set(trendingIds);
  for (const el of cards) {
    if (!trending.has(el.dataset.storyId!)) continue;
    // The badge lands in the slot at the end of the Coverage meta line
    // (StoryCard's data-trending-slot); fall back to the card root.
    (el.querySelector('[data-trending-slot]') ?? el).append(trendingBadge());
  }
}
