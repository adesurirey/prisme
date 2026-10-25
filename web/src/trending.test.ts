// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  BASELINE_RETENTION_MS,
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
  { id: 'a', summarizedAt: NOW - 30 * MINUTE },
  { id: 'b', summarizedAt: null },
  { id: 'c', summarizedAt: NOW - 2 * HOUR },
];

describe('markTrending', () => {
  it('marks nothing on a first visit (no stored blob)', () => {
    const { trendingIds, next } = markTrending(CURRENT, NOW, null);
    expect(trendingIds).toEqual([]);
    // The visit itself is recorded for next time.
    expect(next.stories).toEqual({
      a: { seenAt: NOW },
      b: { seenAt: NOW },
      c: { seenAt: NOW },
    });
  });

  it('never marks a story absent from the baseline, even freshly re-summarized', () => {
    const blob: SeenBlob = {
      version: 3,
      stories: { b: { seenAt: NOW - HOUR } },
    };
    // c entered the Edition and was re-summarized since the last visit —
    // absence is not change: the badge means "you saw this Story before,
    // its résumé changed since" (newness is En direct's job, ADR-0029).
    const { trendingIds } = markTrending(
      [{ id: 'c', summarizedAt: NOW - MINUTE }],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual([]);
  });

  it('badges however long the gap — the 4 h TTL is gone (ADR-0031)', () => {
    // A reader gone three days: the entry survives, and a Story
    // re-summarized two days into their absence still badges. The
    // comparison of two recorded instants has no staleness.
    const blob: SeenBlob = {
      version: 3,
      stories: {
        a: { seenAt: NOW - 72 * HOUR },
        b: { seenAt: NOW - 72 * HOUR },
      },
    };
    const { trendingIds } = markTrending(
      [
        { id: 'a', summarizedAt: NOW - 48 * HOUR },
        { id: 'b', summarizedAt: NOW - 96 * HOUR },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['a']);
  });

  it('badges exactly when the pass ran after the sight — and only then', () => {
    const blob: SeenBlob = {
      version: 3,
      stories: {
        after: { seenAt: NOW - HOUR },
        sameInstant: { seenAt: NOW - HOUR },
        before: { seenAt: NOW - HOUR },
        never: { seenAt: NOW - HOUR },
      },
    };
    const { trendingIds } = markTrending(
      [
        // Rewritten 30 min after the sight — badges.
        { id: 'after', summarizedAt: NOW - 30 * MINUTE },
        // Rewritten at the very instant of the sight — the reader is
        // about to read that rewrite already, no badge.
        { id: 'sameInstant', summarizedAt: NOW - HOUR },
        // Last rewritten before the sight — the reader saw the latest.
        { id: 'before', summarizedAt: NOW - 2 * HOUR },
        // No recorded pass (never summarized, or not since ADR-0031).
        { id: 'never', summarizedAt: null },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['after']);
  });

  it('badges every eligible story, uncapped, in page order', () => {
    // Five re-summarized Stories: all five badge (ADR-0029 removed the
    // cap of three), returned in page order.
    const ids = ['e1', 'e2', 'e3', 'e4', 'e5'];
    const blob: SeenBlob = {
      version: 3,
      stories: Object.fromEntries(
        ids.map((id) => [id, { seenAt: NOW - HOUR }]),
      ),
    };
    const { trendingIds } = markTrending(
      ids.map((id) => ({ id, summarizedAt: NOW - MINUTE })),
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(ids);
  });

  it('merges the baseline: visited cards overwrite, absent entries persist, ancient ones prune', () => {
    const goneSeenAt = NOW - 2 * HOUR;
    const blob: SeenBlob = {
      version: 3,
      stories: {
        // On no card this render, seen well within the horizon — the
        // entry persists with its ORIGINAL seen-at.
        gone: { seenAt: goneSeenAt },
        // Past the retention horizon — pruned lazily by the merge write
        // (a storage bound, never an eligibility rule).
        ancient: { seenAt: NOW - BASELINE_RETENTION_MS - 1 },
        // On the page — overwritten with now.
        a: { seenAt: NOW - HOUR },
      },
    };
    const { trendingIds, next } = markTrending(
      [
        // Re-summarized after the sight — badges.
        { id: 'a', summarizedAt: NOW - 30 * MINUTE },
        { id: 'b', summarizedAt: NOW - MINUTE },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['a']);
    expect(next.stories).toEqual({
      // Visited cards overwrite their entries: now.
      a: { seenAt: NOW },
      b: { seenAt: NOW },
      // Everything else persists, original seen-at untouched — the
      // baseline means "everything I've seen", not "the last page".
      gone: { seenAt: goneSeenAt },
      // 'ancient' is gone: the retention horizon pruned it.
    });
  });

  it('records the snapshot even when the page renders no cards', () => {
    const blob: SeenBlob = {
      version: 3,
      stories: { gone: { seenAt: NOW - HOUR } },
    };
    const { next } = markTrending([], NOW, blob);
    // gone is well within the horizon: the merge keeps it even with no
    // card rendered.
    expect(next.stories).toEqual({
      gone: { seenAt: NOW - HOUR },
    });
  });
});

describe('readSeen / writeSeen', () => {
  it('round-trips a blob through localStorage', () => {
    const blob: SeenBlob = {
      version: 3,
      stories: { a: { seenAt: NOW } },
    };
    writeSeen(localStorage, blob);
    expect(readSeen(localStorage)).toEqual(blob);
  });

  it('reads null from nothing stored and from malformed JSON', () => {
    expect(readSeen(localStorage)).toEqual(null);
    localStorage.setItem(SEEN_KEY, '{not json');
    expect(readSeen(localStorage)).toEqual(null);
  });

  it('reads null from the old v2 shape (count-based) — no compatibility code', () => {
    localStorage.setItem(
      SEEN_KEY,
      '{"version":2,"stories":{"a":{"articleCount":4,"seenAt":1}}}',
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
  // slot). Cards ship the pass's recorded instant ('' when there is none).
  const card = (id: string, summarizedAt: string) => {
    const el = document.createElement('article');
    el.dataset.storyId = id;
    el.dataset.summarizedAt = summarizedAt;
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

  const iso = (ms: number) => new Date(ms).toISOString();

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
      expect(badge.textContent).toBe('Faits nouveaux');
      expect((badge as HTMLElement).title).toBe(
        'Couverture et résumé enrichis depuis votre dernière visite',
      );
    }
  };

  it('reveals the badge on re-summarized cards and records the visit', () => {
    card('a', iso(NOW - 30 * MINUTE));
    card('b', iso(NOW - 2 * HOUR));
    writeSeen(localStorage, {
      version: 3,
      stories: {
        a: { seenAt: NOW - HOUR },
        b: { seenAt: NOW - HOUR },
      },
    });

    installTrending(document, localStorage, new Date(NOW));

    // a was re-summarized after the sight → badge; b's last rewrite is
    // older than the sight → none.
    expectBadge('a', true);
    expectBadge('b', false);
    // The visit is recorded: a second install on identical data marks
    // nothing (the sight now postdates the pass).
    const next = readSeen(localStorage)!;
    expect(next.stories.a).toEqual({ seenAt: NOW });
    expect(next.stories.b).toEqual({ seenAt: NOW });
  });

  it('never badges a card with no recorded pass, seen or not', () => {
    card('a', ''); // never (re-)summarized since the field exists
    card('b', ''); // never seen either
    writeSeen(localStorage, {
      version: 3,
      stories: { a: { seenAt: NOW - HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    expectBadge('a', false);
    expectBadge('b', false);
  });

  it('marks nothing on a first visit and still records the snapshot', () => {
    card('a', iso(NOW - MINUTE));
    installTrending(document, localStorage, new Date(NOW));
    expectBadge('a', false);
    expect(readSeen(localStorage)!.stories.a).toEqual({ seenAt: NOW });
  });

  it('never fills the count pill — the hook is gone (ADR-0029)', () => {
    card('a', iso(NOW - MINUTE));
    const pillEl = document.createElement('div');
    pillEl.dataset.newPill = '';
    document.body.append(pillEl);
    writeSeen(localStorage, {
      version: 3,
      stories: { a: { seenAt: NOW - HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // The badge itself renders; the pill stays empty, whatever the visit.
    expectBadge('a', true);
    expect(pillEl.childElementCount).toBe(0);
  });

  it('merges the baseline across pages: absent entries keep their seen-at', () => {
    card('a', iso(NOW - MINUTE));
    card('b', iso(NOW - MINUTE));
    installTrending(document, localStorage, new Date(NOW));
    // Page 1 seen: a and b recorded at NOW.

    // The reader moves to another page (a different build's cards) two
    // hours later: b is overwritten, c joins, a persists untouched.
    document.body.innerHTML = '';
    card('b', iso(NOW + 2 * HOUR - MINUTE));
    card('c', iso(NOW + 2 * HOUR - MINUTE));
    installTrending(document, localStorage, new Date(NOW + 2 * HOUR));

    const stories = readSeen(localStorage)!.stories;
    expect(stories.a).toEqual({ seenAt: NOW });
    expect(stories.b).toEqual({ seenAt: NOW + 2 * HOUR });
    expect(stories.c).toEqual({ seenAt: NOW + 2 * HOUR });
  });

  it('keeps the badges visible on a re-render within the same visit', () => {
    card('a', iso(NOW - 30 * MINUTE));
    writeSeen(localStorage, {
      version: 3,
      stories: { a: { seenAt: NOW - HOUR } },
    });
    installTrending(document, localStorage, new Date(NOW));
    expectBadge('a', true);

    // The reader clicks the story and comes back minutes later: the
    // snapshot moved the sight past the pass, but the session (fresh
    // within the recompute window) keeps the badge scannable.
    document.body.innerHTML = '';
    card('a', iso(NOW - 30 * MINUTE));
    installTrending(document, localStorage, new Date(NOW + 5 * MINUTE));
    expectBadge('a', true);
  });

  it('does not rewrite anything on a re-render inside the recompute window', () => {
    card('a', iso(NOW - 30 * MINUTE));
    const lastComputeAt = NOW - 5 * MINUTE;
    writeSession(sessionStorage, {
      v: 3,
      trendingIds: ['a', 'gone'],
      lastComputeAt,
    });
    writeSeen(localStorage, {
      version: 3,
      // a's sight already postdates the pass — no badge to show, so it
      // can only come from the session set.
      stories: { a: { seenAt: NOW - MINUTE } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // Session ids displayed, pruned to the current cards ('gone' dropped).
    expectBadge('a', true);
    // The visit is NOT re-recorded: the baseline stays as-is and the
    // recompute window is not extended.
    expect(readSeen(localStorage)!.stories.a.seenAt).toBe(NOW - MINUTE);
    expect(readSession(sessionStorage)!.lastComputeAt).toBe(lastComputeAt);
  });

  it('replaces the session ids on a visit past the recompute window', () => {
    card('a', iso(NOW - 30 * MINUTE));
    card('b', iso(NOW - MINUTE));
    writeSession(sessionStorage, {
      v: 3,
      trendingIds: ['old1', 'old2', 'old3'],
      lastComputeAt: NOW - 16 * MINUTE,
    });
    writeSeen(localStorage, {
      version: 3,
      stories: { a: { seenAt: NOW - HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // a was re-summarized after the sight → trending; b is absent from
    // the baseline → nothing. The fresh ids REPLACE the old session set
    // instead of merging with it.
    expect(readSession(sessionStorage)).toEqual({
      v: 3,
      trendingIds: ['a'],
      lastComputeAt: NOW,
    });
    expectBadge('a', true);
    expectBadge('b', false);
    // The snapshot is written on the recompute.
    expect(readSeen(localStorage)!.stories.a).toEqual({ seenAt: NOW });
  });

  it('recomputes when the recompute window has exactly elapsed', () => {
    card('a', iso(NOW - 30 * MINUTE));
    writeSeen(localStorage, {
      version: 3,
      stories: { a: { seenAt: NOW - HOUR } },
    });
    writeSession(sessionStorage, {
      v: 3,
      trendingIds: [],
      lastComputeAt: NOW - RECOMPUTE_WINDOW_MS,
    });

    installTrending(document, localStorage, new Date(NOW));

    // Exactly 15 min old → a real new visit: recomputed (the pass won).
    expect(readSession(sessionStorage)!.trendingIds).toEqual(['a']);
    expect(readSession(sessionStorage)!.lastComputeAt).toBe(NOW);
    expectBadge('a', true);
  });

  it('shows no badge in a new session when nothing was re-summarized', () => {
    card('a', iso(NOW - 2 * HOUR));
    writeSeen(localStorage, {
      version: 3,
      stories: { a: { seenAt: NOW - HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // The last pass predates the sight: no change to show, no badge.
    expectBadge('a', false);
  });
});
