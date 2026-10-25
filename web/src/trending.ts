/**
 * Trending Stories ("Faits nouveaux", ADR-0029 as amended by ADR-0031): a
 * Story in the Edition is flagged for a returning reader when the
 * pipeline's Summaries pass re-synthesized it — the recorded fact
 * (`summarizedAt` on the Story) — AFTER *that reader's* last sight of
 * it. Not an approximation by Article counts: the badge fires exactly
 * when the résumé the reader is about to read was rewritten since they
 * last saw the Story, however long the gap — a reader gone for days
 * sees every Story re-summarized in their absence (ADR-0020's 4 h TTL,
 * the last remnant, is gone). A Story absent from the reader's baseline
 * never badges, whatever happened to it: the badge means "you saw this
 * Story before, its résumé changed since", never "this is new" (newness
 * is the En direct page's job, ADR-0029). The signal is per-user,
 * client-side (localStorage); the prerendered HTML carries each card's
 * story id and summarizedAt as data attributes and the script below
 * decides.
 *
 * Rules:
 * - Eligibility, per Story: a baseline entry (it was on a page the
 *   reader visited) whose seenAt predates the Story's summarizedAt.
 *   Uncapped (ADR-0029 removed the cap of three): every eligible Story
 *   on the page badges, in page order; a re-summarization is the
 *   scarcity mechanism.
 * - Merge (ADR-0029): the visited page's cards overwrite their entries
 *   (now), every other entry persists with its original seen-at, pruned
 *   lazily by the retention horizon — the baseline means "everything
 *   I've seen", not "the last page I opened".
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

const SEEN_VERSION = 3;
const SESSION_VERSION = 3;

/**
 * Baseline retention horizon: entries older than this are pruned on the
 * next visit's merge write. A bound on localStorage growth, never an
 * eligibility rule (ADR-0031) — summarizedAt comparisons stay exact at
 * any age, but the oldest window the signal runs on is Aujourd'hui's
 * 24 h, so a week-old entry is dead weight either way.
 */
export const BASELINE_RETENTION_MS = 7 * 24 * 3_600_000;

/**
 * Recompute window: a re-render within this delay of the last computation
 * is the same visit (click-through, reload) — the stored badge ids are
 * shown again unchanged.
 */
export const RECOMPUTE_WINDOW_MS = 15 * 60_000;

export interface SeenEntry {
  seenAt: number;
}

export interface SeenBlob {
  version: 3;
  stories: Record<string, SeenEntry>;
}

export interface TrendingStory {
  id: string;
  /** Epoch ms of the Story's last Summaries pass, or null when it has
   *  none (never summarized, or not re-summarized since the field
   *  exists — ADR-0031 ships without backfill): never badges. */
  summarizedAt: number | null;
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

export function markTrending(
  current: TrendingStory[],
  now: number,
  seen: SeenBlob | null,
): TrendingResult {
  // The merged baseline: everything the reader ever saw, old entries
  // pruned lazily by the retention horizon (a storage bound, never an
  // eligibility rule — a Story reappearing on a visited page is
  // re-recorded by the overwrite below anyway).
  const merged: Record<string, SeenEntry> = {};
  if (seen != null) {
    for (const [id, entry] of Object.entries(seen.stories)) {
      if (now - entry.seenAt <= BASELINE_RETENTION_MS) merged[id] = entry;
    }
  }
  // Visited cards overwrite their entries: now.
  for (const story of current) {
    merged[story.id] = { seenAt: now };
  }
  const next: SeenBlob = { version: SEEN_VERSION, stories: merged };

  // Eligibility, in page order: seen before, and the pipeline rewrote
  // the Summaries after that sight. Absence from the baseline is not
  // change — a Story the reader never saw gets no badge here (that is
  // En direct's job); neither does a Story with no summarizedAt.
  const trendingIds = current.flatMap((story) => {
    if (story.summarizedAt == null) return [];
    const entry = seen?.stories[story.id];
    if (entry == null) return [];
    if (story.summarizedAt <= entry.seenAt) return [];
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
 *  "its résumé was rewritten since your last visit". The meta line's own
 *  span carries a -1px optical nudge (CoverageMeta) — the badge takes the
 *  same one, or it reads a pixel low next to "x articles". */
function trendingBadge(): HTMLElement {
  const span = document.createElement('span');
  span.dataset.trendingBadge = '';
  span.className = 'inline-flex items-center gap-1.5 font-medium text-trending';
  span.title = 'Couverture et résumé enrichis depuis votre dernière visite';
  span.textContent = 'Faits nouveaux';
  const dot = document.createElement('span');
  dot.setAttribute('aria-hidden', 'true');
  dot.className = 'inline-block size-1.5 rounded-full bg-current';
  span.prepend(dot);
  return span;
}

/** A card's data-summarized-at as epoch ms; missing/empty → null (never
 *  badges) — the attribute is '' for every Story not re-summarized since
 *  ADR-0031. Malformed values are browser-hardening only: our own build
 *  stamps now.toISOString(), but a NaN slipping through must read as
 *  "no pass", never as a badge (NaN compares false against seenAt). */
function parseSummarizedAt(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
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
    summarizedAt: parseSummarizedAt(el.dataset.summarizedAt),
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
