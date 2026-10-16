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
const SESSION_VERSION = 2;

/** Minimum Coverage gain, in distinct Outlets, past which a Story trends. */
export const TRENDING_COVERAGE_DELTA_MIN = 2;

/** Relative gain (fraction of baseline Coverage) past which a Story trends. */
export const TRENDING_COVERAGE_RATIO = 0.25;

/** At most this many trending badges per computation, the top gainers. */
export const TRENDING_CAP = 3;

/** A stored baseline older than this never generates a signal of either
 *  kind (ADR-0020): the window is the hour-to-hour or evening-to-morning
 *  gap of a reader who checks in nearly every Edition — past it the
 *  Edition has turned over and the reader scans it themselves. */
export const BASELINE_TTL_MS = 4 * 3_600_000;

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
  /** Ids of Stories new since the reader's last visit, in Edition order. */
  newIds: string[];
  /** The snapshot to write for this visit, pruned to the current ids. */
  next: SeenBlob;
}

export interface TrendingSession {
  v: 2;
  /** This visit's trending badge ids, in Edition order. */
  trendingIds: string[];
  /** This visit's new-Story ids, in Edition order (ADR-0020). */
  newIds: string[];
  /** Whether the count pill is still up: false once clicked — the pill
   *  does not survive its own click, the badges do. */
  pillVisible: boolean;
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
  if (seen == null) return { trendingIds: [], newIds: [], next };

  // A returning reader has at least one usable (fresh) baseline entry; a
  // stale blob means the reader was away too long — no signal at all.
  const returning = Object.values(seen.stories).some((e) => fresh(e, now));
  if (!returning) return { trendingIds: [], newIds: [], next };

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

  // New Stories (ADR-0020): absent from the reader's baseline, uncapped —
  // their pool is bounded by Story creation between visits, not by how
  // much happened. In Edition order, like every id list here.
  const newIds = current
    .filter((story) => seen.stories[story.id] == null)
    .map(({ id }) => id);

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
    newIds,
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
    const { v, trendingIds, newIds, pillVisible, lastComputeAt } =
      parsed as Record<string, unknown>;
    if (v !== SESSION_VERSION || !Array.isArray(trendingIds)) return null;
    if (!Array.isArray(newIds) || typeof pillVisible !== 'boolean') return null;
    if (typeof lastComputeAt !== 'number') return null;
    const ids = (list: unknown[]): string[] =>
      list.filter((id): id is string => typeof id === 'string');
    return {
      v: SESSION_VERSION,
      trendingIds: ids(trendingIds),
      newIds: ids(newIds),
      pillVisible,
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

/** One per-visitor badge (ADR-0020): both signals share the sarcelle
 *  slot styling and the "since when" tooltip; marker, label and title
 *  carry the distinction. The meta line's own span carries a -1px
 *  optical nudge (CoverageMeta) — the badge takes the same one, or it
 *  reads a pixel low next to "x articles". */
function badge(marker: string, label: string, title: string): HTMLElement {
  const span = document.createElement('span');
  span.dataset[marker] = '';
  span.className = 'inline-flex items-center font-medium text-trending';
  span.title = title;
  span.textContent = label;
  return span;
}

const trendingBadge = () =>
  badge(
    'trendingBadge',
    '\u2197\u2009en hausse',
    'Gagné en couverture depuis votre dernière visite',
  );

const newBadge = () =>
  badge('newBadge', 'Nouveau', 'Nouveau depuis votre dernière visite');

/**
 * Wire the Edition index: read each card's data attributes, decide the
 * per-visitor signals from the stored snapshot, reveal badges, fill the
 * count pill, write the new snapshot. Runs on any page; only cards on the
 * Edition index are affected, and only that page has the pill.
 *
 * Both signals are one genus (ADR-0020): « en hausse » for a Coverage gain
 * since the reader's last visit, « nouveau » for a Story absent from it.
 * Badges survive within a visit: a re-render within RECOMPUTE_WINDOW_MS of
 * the last computation — clicking a story and coming back, reloading —
 * shows the stored ids again without recomputing or rewriting anything.
 * Past that window the ids are recomputed and replace the stored ones, so
 * a tab left open all day never accumulates badges. The pill is the one
 * signal that does not survive its own click: its visibility rides in the
 * session and goes false when clicked.
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

  const currentIds = new Set(current.map(({ id }) => id));
  let trendingIds: string[];
  let newIds: string[];
  let pillVisible: boolean;
  if (
    seenSession != null &&
    nowMs - seenSession.lastComputeAt < RECOMPUTE_WINDOW_MS
  ) {
    // Same visit, re-render: show this visit's ids and pill state, pruned
    // to the current cards. No recompute, no snapshot write, no extension.
    const prune = (ids: string[]) => ids.filter((id) => currentIds.has(id));
    trendingIds = prune(seenSession.trendingIds);
    newIds = prune(seenSession.newIds);
    pillVisible = seenSession.pillVisible;
  } else {
    // A real new visit: compute both signal sets, record the visit and
    // replace the session set with the fresh ids.
    const result = markTrending(current, nowMs, readSeen(storage));
    trendingIds = result.trendingIds;
    newIds = result.newIds;
    pillVisible = newIds.length > 0;
    writeSession(session, {
      v: SESSION_VERSION,
      trendingIds,
      newIds,
      pillVisible,
      lastComputeAt: nowMs,
    });
    writeSeen(storage, result.next);
  }

  const trending = new Set(trendingIds);
  const newSet = new Set(newIds);
  for (const el of cards) {
    const id = el.dataset.storyId!;
    if (!trending.has(id) && !newSet.has(id)) continue;
    // The badge lands in the slot at the end of the Coverage meta line
    // (StoryCard's data-trending-slot); fall back to the card root.
    const badge = trending.has(id) ? trendingBadge() : newBadge();
    (el.querySelector('[data-trending-slot]') ?? el).append(badge);
  }

  // The count pill (ADR-0020): counts every new Story, locates the first
  // one on click, and does not survive that click — its visibility rides
  // in the session so re-renders keep it hidden.
  const pill = doc.querySelector<HTMLElement>('[data-new-pill]');
  if (pill == null || !pillVisible || newIds.length === 0) return;
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'cursor-pointer font-medium text-trending text-[13px]';
  button.textContent =
    newIds.length === 1 ? '1 nouveau' : `${newIds.length} nouveaux`;
  button.addEventListener('click', () => {
    // Unconditional: even if the session read fails at click time, the
    // written pillVisible: false keeps a later re-render from restoring
    // the pill within the visit.
    const base = readSession(session) ?? {
      v: SESSION_VERSION,
      trendingIds,
      newIds,
      pillVisible: false,
      lastComputeAt: nowMs,
    };
    writeSession(session, { ...base, pillVisible: false });
    pill.replaceChildren();
    const target = doc.querySelector(`[data-story-id="${newIds[0]}"]`);
    if (target == null) return;
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  pill.replaceChildren(button);
}
