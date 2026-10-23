// @vitest-environment jsdom
import { grewAtLeast } from '@prisme/domain';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BASELINE_TTL_MS,
  installTrending,
  markTrending,
  RECOMPUTE_WINDOW_MS,
  readSeen,
  readSession,
  SEEN_KEY,
  SESSION_KEY,
  type SeenBlob,
  writeSeen,
  writeSession,
} from './trending';

const HOUR = 3_600_000;
const MINUTE = 60_000;
const NOW = 1_800_000_000_000;

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.body.innerHTML = '';
});

const CURRENT = [
  { id: 'a', articleCount: 8 },
  { id: 'b', articleCount: 3 },
  { id: 'c', articleCount: 1 },
];

describe('markTrending', () => {
  it('marks nothing on a first visit (no stored blob)', () => {
    const { trendingIds, next } = markTrending(CURRENT, NOW, null);
    expect(trendingIds).toEqual([]);
    // The visit itself is recorded for next time.
    expect(next.stories).toEqual({
      a: { articleCount: 8, seenAt: NOW },
      b: { articleCount: 3, seenAt: NOW },
      c: { articleCount: 1, seenAt: NOW },
    });
  });

  it('never marks a story absent from the baseline, whatever its Article count', () => {
    const blob: SeenBlob = {
      version: 2,
      stories: { b: { articleCount: 1, seenAt: NOW - HOUR } },
    };
    // c entered the Edition since the last visit — absence is not growth:
    // the badge means "you saw this Story before, it grew since".
    const { trendingIds } = markTrending(
      [{ id: 'c', articleCount: 30 }],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual([]);
  });

  it('never marks a stale entry, but fresh entries still badge beside it', () => {
    const blob: SeenBlob = {
      version: 2,
      stories: {
        a: { articleCount: 2, seenAt: NOW - BASELINE_TTL_MS - 1 },
        b: { articleCount: 2, seenAt: NOW - HOUR },
      },
    };
    // a's entry is past the 4 h TTL — that Story gets no badge. The
    // freshness is per Story (the baseline means "everything I've seen",
    // ADR-0029): b's fresh entry with 100 % growth still badges.
    const { trendingIds } = markTrending(
      [
        { id: 'a', articleCount: 8 },
        { id: 'b', articleCount: 4 },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['b']);
  });

  it('gates on the domain growth gate: exactly 25 % growth passes', () => {
    const blob: SeenBlob = {
      version: 2,
      stories: {
        exact: { articleCount: 8, seenAt: NOW - HOUR },
        short: { articleCount: 8, seenAt: NOW - HOUR },
        dropped: { articleCount: 8, seenAt: NOW - HOUR },
      },
    };
    const { trendingIds } = markTrending(
      [
        // 8 → 10 is exactly +25 % — the gate is « at least ».
        { id: 'exact', articleCount: 10 },
        // 8 → 9 is ≈ 12.5 % — below the gate.
        { id: 'short', articleCount: 9 },
        // A drop is not growth.
        { id: 'dropped', articleCount: 7 },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['exact']);
    // The badge can never drift from what the pipeline re-synthesized:
    // the eligibility arithmetic IS the domain gate (ADR-0027, ADR-0029).
    expect(grewAtLeast(8, 10)).toBe(true);
    expect(grewAtLeast(8, 9)).toBe(false);
  });

  it('does not mark a story whose Article count is unchanged', () => {
    const blob: SeenBlob = {
      version: 2,
      stories: { a: { articleCount: 8, seenAt: NOW - HOUR } },
    };
    const { trendingIds } = markTrending(
      [{ id: 'a', articleCount: 8 }],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual([]);
  });

  it('badges every eligible story, uncapped, in page order', () => {
    // Five Stories past the gate: all five badge (ADR-0029 removed the
    // cap of three), returned in page order.
    const entries = [
      { id: 'e1', baseline: 2, count: 4 },
      { id: 'e2', baseline: 4, count: 8 },
      { id: 'e3', baseline: 10, count: 13 },
      { id: 'e4', baseline: 1, count: 2 },
      { id: 'e5', baseline: 20, count: 26 },
    ];
    const blob: SeenBlob = {
      version: 2,
      stories: Object.fromEntries(
        entries.map(({ id, baseline }) => [
          id,
          { articleCount: baseline, seenAt: NOW - HOUR },
        ]),
      ),
    };
    const { trendingIds } = markTrending(
      entries.map(({ id, count }) => ({ id, articleCount: count })),
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
  });

  it('merges the baseline: visited cards overwrite, absent entries persist, stale prune', () => {
    const goneSeenAt = NOW - 2 * HOUR;
    const blob: SeenBlob = {
      version: 2,
      stories: {
        // Fresh when this page renders, but the card is absent — the
        // entry persists with its ORIGINAL seen-at.
        gone: { articleCount: 7, seenAt: goneSeenAt },
        // Past the TTL — pruned lazily by the merge write.
        stale: { articleCount: 5, seenAt: NOW - BASELINE_TTL_MS - 1 },
        // Fresh and on the page — overwritten with the new count + now.
        a: { articleCount: 2, seenAt: NOW - HOUR },
      },
    };
    const { trendingIds, next } = markTrending(
      [
        // 2 → 4 is +100 % — badges.
        { id: 'a', articleCount: 4 },
        { id: 'b', articleCount: 1 },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['a']);
    expect(next.stories).toEqual({
      // Visited cards overwrite their entries: count + now.
      a: { articleCount: 4, seenAt: NOW },
      b: { articleCount: 1, seenAt: NOW },
      // Everything else persists, original seen-at untouched — the
      // baseline means "everything I've seen", not "the last page".
      gone: { articleCount: 7, seenAt: goneSeenAt },
      // 'stale' is gone: the TTL pruned it.
    });
  });

  it('records the snapshot even when the page renders no cards', () => {
    const blob: SeenBlob = {
      version: 2,
      stories: { gone: { articleCount: 7, seenAt: NOW - HOUR } },
    };
    const { next } = markTrending([], NOW, blob);
    // gone is still fresh: the merge keeps it even with no card rendered.
    expect(next.stories).toEqual({
      gone: { articleCount: 7, seenAt: NOW - HOUR },
    });
  });
});

describe('readSeen / writeSeen', () => {
  it('round-trips a blob through localStorage', () => {
    const blob: SeenBlob = {
      version: 2,
      stories: { a: { articleCount: 2, seenAt: NOW } },
    };
    writeSeen(localStorage, blob);
    expect(readSeen(localStorage)).toEqual(blob);
  });

  it('reads null from nothing stored and from malformed JSON', () => {
    expect(readSeen(localStorage)).toEqual(null);
    localStorage.setItem(SEEN_KEY, '{not json');
    expect(readSeen(localStorage)).toEqual(null);
  });

  it('reads null from the old v1 shape — no compatibility code', () => {
    localStorage.setItem(
      SEEN_KEY,
      '{"version":1,"stories":{"a":{"coverage":2,"seenAt":1}}}',
    );
    expect(readSeen(localStorage)).toEqual(null);
  });
});

describe('readSession / writeSession', () => {
  it('round-trips a session through sessionStorage', () => {
    writeSession(sessionStorage, {
      v: 3,
      trendingIds: ['a', 'b'],
      lastComputeAt: NOW,
    });
    expect(readSession(sessionStorage)).toEqual({
      v: 3,
      trendingIds: ['a', 'b'],
      lastComputeAt: NOW,
    });
  });

  it('reads null from nothing stored, malformed JSON, or a wrong shape', () => {
    expect(readSession(sessionStorage)).toEqual(null);
    sessionStorage.setItem(SESSION_KEY, '{not json');
    expect(readSession(sessionStorage)).toEqual(null);
    // The v2 shape (newIds + pillVisible) and the old plain array: no
    // compat shims, they are just no session.
    sessionStorage.setItem(SESSION_KEY, '["a","b"]');
    expect(readSession(sessionStorage)).toEqual(null);
    sessionStorage.setItem(
      SESSION_KEY,
      '{"v":2,"trendingIds":["a"],"newIds":[],"pillVisible":true,"lastComputeAt":1}',
    );
    expect(readSession(sessionStorage)).toEqual(null);
    sessionStorage.setItem(
      SESSION_KEY,
      '{"v":3,"trendingIds":"a","lastComputeAt":1}',
    );
    expect(readSession(sessionStorage)).toEqual(null);
    sessionStorage.setItem(SESSION_KEY, '{"v":3,"trendingIds":["a"]}');
    expect(readSession(sessionStorage)).toEqual(null);
    sessionStorage.setItem(
      SESSION_KEY,
      '{"v":3,"trendingIds":["a"],"lastComputeAt":"nope"}',
    );
    expect(readSession(sessionStorage)).toEqual(null);
  });

  it('drops non-string ids', () => {
    sessionStorage.setItem(
      SESSION_KEY,
      `{"v":3,"trendingIds":["a",1,null],"lastComputeAt":${NOW}}`,
    );
    expect(readSession(sessionStorage)).toEqual({
      v: 3,
      trendingIds: ['a'],
      lastComputeAt: NOW,
    });
  });
});

describe('installTrending', () => {
  // Mirrors the real StoryCard markup: article > a > div > h2 with a
  // data-trending-slot — the shape this fixture guards against (appending
  // against the card root would misplace the badge; it must land in the
  // slot). Cards ship the Article count the script reads.
  const card = (id: string, articleCount: number) => {
    const el = document.createElement('article');
    el.dataset.storyId = id;
    el.dataset.articleCount = String(articleCount);
    const a = document.createElement('a');
    const div = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.textContent = 'Titre';
    const slot = document.createElement('span');
    slot.dataset.trendingSlot = '';
    div.append(h2, slot);
    a.append(div);
    el.append(a);
    document.body.append(el);
  };

  const expectBadge = (id: string, present: boolean) => {
    const el = document.querySelector(`[data-story-id="${id}"]`)!;
    expect(el.querySelector('[data-trending-badge]') !== null).toBe(present);
    if (present) {
      // The badge lands inside the slot, next to the meta line — not loose
      // on the card, and not on a separate floating row.
      const badge = el.querySelector(
        '[data-trending-slot] [data-trending-badge]',
      )!;
      expect(badge != null).toBe(true);
      expect(badge.textContent).toBe('\u2197\u2009en hausse');
      expect((badge as HTMLElement).title).toBe(
        'Couverture et résumé enrichis depuis votre dernière visite',
      );
    }
  };

  it('reveals the badge on grown cards and records the visit', () => {
    card('a', 4);
    const blob: SeenBlob = {
      version: 2,
      stories: {
        a: { articleCount: 2, seenAt: NOW - HOUR },
        b: { articleCount: 2, seenAt: NOW - HOUR },
      },
    };
    card('b', 2);
    writeSeen(localStorage, blob);

    installTrending(document, localStorage, new Date(NOW));

    expectBadge('a', true);
    expectBadge('b', false);
    // The visit is recorded: a second install on identical data marks nothing.
    const next = readSeen(localStorage)!;
    expect(next.stories.a).toEqual({ articleCount: 4, seenAt: NOW });
  });

  it('marks nothing on a first visit and still records the snapshot', () => {
    card('a', 4);
    installTrending(document, localStorage, new Date(NOW));
    expectBadge('a', false);
    expect(readSeen(localStorage)!.stories.a).toEqual({
      articleCount: 4,
      seenAt: NOW,
    });
  });

  it('never fills the count pill — the hook is gone (ADR-0029)', () => {
    card('a', 4);
    const pillEl = document.createElement('div');
    pillEl.dataset.newPill = '';
    document.body.append(pillEl);
    writeSeen(localStorage, {
      version: 2,
      stories: { a: { articleCount: 1, seenAt: NOW - HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // The badge itself renders; the pill stays empty, whatever the visit.
    expectBadge('a', true);
    expect(pillEl.childElementCount).toBe(0);
  });

  it('merges the baseline across pages: absent entries keep their seen-at', () => {
    card('a', 4);
    card('b', 2);
    installTrending(document, localStorage, new Date(NOW));
    // Page 1 seen: a and b recorded at NOW.

    // The reader moves to another page (a different build's cards) two
    // hours later: b is overwritten, c joins, a persists untouched.
    document.body.innerHTML = '';
    card('b', 2);
    card('c', 3);
    installTrending(document, localStorage, new Date(NOW + 2 * HOUR));

    const stories = readSeen(localStorage)!.stories;
    expect(stories.a).toEqual({ articleCount: 4, seenAt: NOW });
    expect(stories.b).toEqual({ articleCount: 2, seenAt: NOW + 2 * HOUR });
    expect(stories.c).toEqual({ articleCount: 3, seenAt: NOW + 2 * HOUR });
  });

  it('keeps the badges visible on a re-render within the same visit', () => {
    card('a', 4);
    writeSeen(localStorage, {
      version: 2,
      stories: { a: { articleCount: 2, seenAt: NOW - HOUR } },
    });
    installTrending(document, localStorage, new Date(NOW));
    expectBadge('a', true);

    // The reader clicks the story and comes back minutes later: the
    // snapshot erased the growth, but the session (fresh within the
    // recompute window) keeps the badge scannable.
    document.body.innerHTML = '';
    card('a', 4);
    installTrending(document, localStorage, new Date(NOW + 5 * MINUTE));
    expectBadge('a', true);
  });

  it('does not rewrite anything on a re-render inside the recompute window', () => {
    card('a', 4);
    const lastComputeAt = NOW - 5 * MINUTE;
    writeSession(sessionStorage, {
      v: 3,
      trendingIds: ['a', 'gone'],
      lastComputeAt,
    });
    writeSeen(localStorage, {
      version: 2,
      // a's count already recorded at 4 — no growth to show, so the badge
      // can only come from the session set.
      stories: { a: { articleCount: 4, seenAt: NOW - HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // Session ids displayed, pruned to the current cards ('gone' dropped).
    expectBadge('a', true);
    // The visit is NOT re-recorded: the baseline stays as-is and the
    // recompute window is not extended.
    expect(readSeen(localStorage)!.stories.a.seenAt).toBe(NOW - HOUR);
    expect(readSession(sessionStorage)!.lastComputeAt).toBe(lastComputeAt);
  });

  it('replaces the session ids on a visit past the recompute window', () => {
    card('a', 4);
    card('b', 2);
    writeSession(sessionStorage, {
      v: 3,
      trendingIds: ['old1', 'old2', 'old3'],
      lastComputeAt: NOW - 16 * MINUTE,
    });
    writeSeen(localStorage, {
      version: 2,
      stories: { a: { articleCount: 2, seenAt: NOW - HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // a grew +100 % → trending; b is absent from the baseline → nothing.
    // The fresh ids REPLACE the old session set instead of merging with it.
    expect(readSession(sessionStorage)).toEqual({
      v: 3,
      trendingIds: ['a'],
      lastComputeAt: NOW,
    });
    expectBadge('a', true);
    expectBadge('b', false);
    // The snapshot is written on the recompute.
    expect(readSeen(localStorage)!.stories.a).toEqual({
      articleCount: 4,
      seenAt: NOW,
    });
  });

  it('recomputes when the recompute window has exactly elapsed', () => {
    card('a', 4);
    writeSeen(localStorage, {
      version: 2,
      stories: { a: { articleCount: 2, seenAt: NOW - HOUR } },
    });
    writeSession(sessionStorage, {
      v: 3,
      trendingIds: [],
      lastComputeAt: NOW - RECOMPUTE_WINDOW_MS,
    });

    installTrending(document, localStorage, new Date(NOW));

    // Exactly 15 min old → a real new visit: recomputed (growth wins).
    expect(readSession(sessionStorage)!.trendingIds).toEqual(['a']);
    expect(readSession(sessionStorage)!.lastComputeAt).toBe(NOW);
    expectBadge('a', true);
  });

  it('clears badges in a new session (empty sessionStorage)', () => {
    card('a', 4);
    writeSeen(localStorage, {
      version: 2,
      stories: { a: { articleCount: 4, seenAt: NOW - HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // Same count as the baseline: no growth, no badge.
    expectBadge('a', false);
  });
});
