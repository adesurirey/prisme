// @vitest-environment jsdom
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
  { id: 'a', coverage: 5 },
  { id: 'b', coverage: 3 },
  { id: 'c', coverage: 1 },
];

describe('markTrending', () => {
  it('marks nothing on a first visit (no stored blob)', () => {
    const { trendingIds, next } = markTrending(CURRENT, NOW, null);
    expect(trendingIds).toEqual([]);
    // The visit itself is recorded for next time.
    expect(next.stories).toEqual({
      a: { coverage: 5, seenAt: NOW },
      b: { coverage: 3, seenAt: NOW },
      c: { coverage: 1, seenAt: NOW },
    });
  });

  it('marks nothing when every baseline is older than the TTL (badge wall for a long-absent reader)', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: { a: { coverage: 1, seenAt: NOW - BASELINE_TTL_MS - 1 } },
    };
    const { trendingIds } = markTrending(CURRENT, NOW, blob);
    expect(trendingIds).toEqual([]);
  });

  it('never marks a story absent from the baseline, whatever its Coverage', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: { b: { coverage: 1, seenAt: NOW - 24 * HOUR } },
    };
    // c entered the Edition since the last visit — a new Story is not a
    // gain: the badge means "you saw it before, it now covers more".
    const { trendingIds } = markTrending(
      [{ id: 'c', coverage: 30 }],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual([]);
  });

  it('marks a story whose Coverage grew past the delta since the last fresh visit', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: {
        a: { coverage: 3, seenAt: NOW - 24 * HOUR },
        b: { coverage: 3, seenAt: NOW - 24 * HOUR },
      },
    };
    const { trendingIds } = markTrending(
      [
        { id: 'a', coverage: 5 },
        { id: 'b', coverage: 3 },
      ],
      NOW,
      blob,
    );
    // a: +2 outlets → trending. b: unchanged → not.
    expect(trendingIds).toEqual(['a']);
  });

  it('scales the delta with baseline Coverage, with a floor of two', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: {
        // Baseline 2: floor governs — +2 wins, +1 does not.
        small: { coverage: 2, seenAt: NOW - 24 * HOUR },
        // Baseline 25: 25 × 0.25 → 7 — +6 misses, +7 clears.
        large: { coverage: 25, seenAt: NOW - 24 * HOUR },
      },
    };
    const { trendingIds } = markTrending(
      [
        { id: 'small', coverage: 4 },
        { id: 'large', coverage: 32 },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['small', 'large']);
  });

  it('does not mark sub-threshold gains on large-baseline stories', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: {
        // 25 → 26 was the old flat-delta badge; now far below the +7 bar.
        large: { coverage: 25, seenAt: NOW - 24 * HOUR },
        // ceil(13 × 0.25) = 4: 13 → 16 misses the bar.
        boundary: { coverage: 13, seenAt: NOW - 24 * HOUR },
      },
    };
    const { trendingIds } = markTrending(
      [
        { id: 'large', coverage: 26 },
        { id: 'boundary', coverage: 16 },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual([]);
  });

  it('marks a gain that exactly clears the scaled threshold', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: {
        // ceil(13 × 0.25) = 4: 13 → 17 crosses.
        boundary: { coverage: 13, seenAt: NOW - 24 * HOUR },
      },
    };
    const { trendingIds } = markTrending(
      [{ id: 'boundary', coverage: 17 }],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['boundary']);
  });

  it('does not mark a Coverage gain of one outlet', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: { a: { coverage: 4, seenAt: NOW - 24 * HOUR } },
    };
    const { trendingIds } = markTrending([{ id: 'a', coverage: 5 }], NOW, blob);
    expect(trendingIds).toEqual([]);
  });

  it('does not mark a Coverage drop', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: { a: { coverage: 8, seenAt: NOW - 24 * HOUR } },
    };
    const { trendingIds } = markTrending([{ id: 'a', coverage: 5 }], NOW, blob);
    expect(trendingIds).toEqual([]);
  });

  it('caps the badges to the three biggest gainers, kept in Edition order', () => {
    // Five eligible stories, gains 10, 9, 11, 8, 18 — only the top three
    // gainers survive the cap, re-sorted back to Edition order.
    const entries = [
      { id: 'e1', baseline: 2, coverage: 12 },
      { id: 'e2', baseline: 2, coverage: 11 },
      { id: 'e3', baseline: 2, coverage: 13 },
      { id: 'e4', baseline: 2, coverage: 10 },
      { id: 'e5', baseline: 2, coverage: 20 },
    ];
    const blob: SeenBlob = {
      version: 1,
      stories: Object.fromEntries(
        entries.map(({ id, baseline }) => [
          id,
          { coverage: baseline, seenAt: NOW - 24 * HOUR },
        ]),
      ),
    };
    const { trendingIds } = markTrending(
      entries.map(({ id, coverage }) => ({ id, coverage })),
      NOW,
      blob,
    );
    // Top gains: e5 (+18), e3 (+11), e1 (+10) → back in Edition order.
    expect(trendingIds).toEqual(['e1', 'e3', 'e5']);
  });

  it('breaks gain ties by Edition order', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: {
        x: { coverage: 3, seenAt: NOW - 24 * HOUR },
        y: { coverage: 3, seenAt: NOW - 24 * HOUR },
      },
    };
    // Same +2 gain for both; y comes first in the Edition.
    const { trendingIds } = markTrending(
      [
        { id: 'y', coverage: 5 },
        { id: 'x', coverage: 5 },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['y', 'x']);
  });

  it('keeps every eligible story when fewer than three, in Edition order', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: {
        a: { coverage: 2, seenAt: NOW - 24 * HOUR },
        c: { coverage: 1, seenAt: NOW - 24 * HOUR },
      },
    };
    // a: +3, c: +4 — both eligible, cap not reached.
    const { trendingIds } = markTrending(
      [
        { id: 'a', coverage: 5 },
        { id: 'c', coverage: 5 },
      ],
      NOW,
      blob,
    );
    expect(trendingIds).toEqual(['a', 'c']);
  });

  it('prunes the next snapshot to the current Edition ids', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: { gone: { coverage: 7, seenAt: NOW - HOUR } },
    };
    const { next } = markTrending(CURRENT, NOW, blob);
    expect(Object.keys(next.stories).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('readSeen / writeSeen', () => {
  it('round-trips a blob through localStorage', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: { a: { coverage: 2, seenAt: NOW } },
    };
    writeSeen(localStorage, blob);
    expect(readSeen(localStorage)).toEqual(blob);
  });

  it('reads null from nothing stored and from malformed JSON', () => {
    expect(readSeen(localStorage)).toEqual(null);
    localStorage.setItem(SEEN_KEY, '{not json');
    expect(readSeen(localStorage)).toEqual(null);
  });
});

describe('readSession / writeSession', () => {
  it('round-trips a session through sessionStorage', () => {
    writeSession(sessionStorage, {
      v: 1,
      ids: ['a', 'b'],
      lastComputeAt: NOW,
    });
    expect(readSession(sessionStorage)).toEqual({
      v: 1,
      ids: ['a', 'b'],
      lastComputeAt: NOW,
    });
  });

  it('reads null from nothing stored, malformed JSON, or a wrong shape', () => {
    expect(readSession(sessionStorage)).toEqual(null);
    sessionStorage.setItem(SESSION_KEY, '{not json');
    expect(readSession(sessionStorage)).toEqual(null);
    // Old plain-array shape: no compat shims, it is just no session.
    sessionStorage.setItem(SESSION_KEY, '["a","b"]');
    expect(readSession(sessionStorage)).toEqual(null);
    sessionStorage.setItem(SESSION_KEY, '{"v":1,"ids":"a","lastComputeAt":1}');
    expect(readSession(sessionStorage)).toEqual(null);
    sessionStorage.setItem(SESSION_KEY, '{"v":1,"ids":["a"]}');
    expect(readSession(sessionStorage)).toEqual(null);
    sessionStorage.setItem(
      SESSION_KEY,
      '{"v":1,"ids":["a"],"lastComputeAt":"nope"}',
    );
    expect(readSession(sessionStorage)).toEqual(null);
  });

  it('drops non-string ids', () => {
    sessionStorage.setItem(
      SESSION_KEY,
      `{"v":1,"ids":["a",1,null],"lastComputeAt":${NOW}}`,
    );
    expect(readSession(sessionStorage)).toEqual({
      v: 1,
      ids: ['a'],
      lastComputeAt: NOW,
    });
  });
});

describe('installTrending', () => {
  // Mirrors the real StoryCard markup: article > a > div > h2 with a
  // data-trending-slot at the end of the Coverage meta line — the shape
  // this fixture guards against (insertBefore against the card root would
  // throw; the badge must land in the slot).
  const card = (id: string, coverage: number) => {
    const el = document.createElement('article');
    el.dataset.storyId = id;
    el.dataset.coverage = String(coverage);
    const a = document.createElement('a');
    const div = document.createElement('div');
    const h2 = document.createElement('h2');
    h2.textContent = 'Titre';
    const meta = document.createElement('p');
    const slot = document.createElement('span');
    slot.dataset.trendingSlot = '';
    meta.append(slot);
    div.append(h2, meta);
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
        'Gagné en couverture depuis votre dernière visite',
      );
    }
  };

  it('reveals the badge on trending cards and records the visit', () => {
    card('a', 5);
    const blob: SeenBlob = {
      version: 1,
      stories: {
        a: { coverage: 3, seenAt: NOW - 24 * HOUR },
        b: { coverage: 3, seenAt: NOW - 24 * HOUR },
      },
    };
    card('b', 3);
    writeSeen(localStorage, blob);

    installTrending(document, localStorage, new Date(NOW));

    expectBadge('a', true);
    expectBadge('b', false);
    // The visit is recorded: a second install on identical data marks nothing.
    const next = readSeen(localStorage)!;
    expect(next.stories.a.coverage).toBe(5);
    expect(next.stories.a.seenAt).toBe(NOW);
  });

  it('marks nothing on a first visit and still records the snapshot', () => {
    card('a', 5);
    installTrending(document, localStorage, new Date(NOW));
    expectBadge('a', false);
    expect(readSeen(localStorage)!.stories.a).toEqual({
      coverage: 5,
      seenAt: NOW,
    });
  });

  it('records the snapshot even when the Edition renders no cards', () => {
    installTrending(document, localStorage, new Date(NOW));
    expect(readSeen(localStorage)).toEqual({ version: 1, stories: {} });
  });

  it('keeps the badges visible on a re-render within the same visit', () => {
    card('a', 5);
    writeSeen(localStorage, {
      version: 1,
      stories: { a: { coverage: 3, seenAt: NOW - 24 * HOUR } },
    });
    installTrending(document, localStorage, new Date(NOW));
    expectBadge('a', true);

    // The reader clicks the story and comes back minutes later: the
    // snapshot erased the delta, but the session (fresh within the
    // recompute window) keeps the badge scannable.
    document.body.innerHTML = '';
    card('a', 5);
    installTrending(document, localStorage, new Date(NOW + 5 * MINUTE));
    expectBadge('a', true);
  });

  it('does not rewrite anything on a re-render inside the recompute window', () => {
    card('a', 5);
    const lastComputeAt = NOW - 5 * MINUTE;
    writeSession(sessionStorage, { v: 1, ids: ['a', 'gone'], lastComputeAt });
    writeSeen(localStorage, {
      version: 1,
      // a's Coverage already recorded at 5 — no gain to show, so the badge
      // can only come from the session set.
      stories: { a: { coverage: 5, seenAt: NOW - 24 * HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // Session ids displayed, pruned to the current cards ('gone' dropped).
    expectBadge('a', true);
    // The visit is NOT re-recorded: the baseline stays as-is and the
    // recompute window is not extended.
    expect(readSeen(localStorage)!.stories.a.seenAt).toBe(NOW - 24 * HOUR);
    expect(readSession(sessionStorage)!.lastComputeAt).toBe(lastComputeAt);
  });

  it('replaces the session ids on a visit past the recompute window', () => {
    card('a', 5);
    card('b', 3);
    writeSession(sessionStorage, {
      v: 1,
      ids: ['old1', 'old2', 'old3'],
      lastComputeAt: NOW - 16 * MINUTE,
    });
    writeSeen(localStorage, {
      version: 1,
      stories: { a: { coverage: 3, seenAt: NOW - 24 * HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    // a gained +2 → the only eligible story; the new ids REPLACE the old
    // session set instead of merging with it.
    expect(readSession(sessionStorage)).toEqual({
      v: 1,
      ids: ['a'],
      lastComputeAt: NOW,
    });
    expectBadge('a', true);
    expectBadge('b', false);
    // The snapshot is written on the recompute.
    expect(readSeen(localStorage)!.stories.a).toEqual({
      coverage: 5,
      seenAt: NOW,
    });
  });

  it('recomputes when the recompute window has exactly elapsed', () => {
    card('a', 5);
    writeSeen(localStorage, {
      version: 1,
      stories: { a: { coverage: 3, seenAt: NOW - 24 * HOUR } },
    });
    writeSession(sessionStorage, {
      v: 1,
      ids: [],
      lastComputeAt: NOW - RECOMPUTE_WINDOW_MS,
    });

    installTrending(document, localStorage, new Date(NOW));

    // Exactly 15 min old → a real new visit: recomputed (+2 gain wins).
    expect(readSession(sessionStorage)!.ids).toEqual(['a']);
    expect(readSession(sessionStorage)!.lastComputeAt).toBe(NOW);
    expectBadge('a', true);
  });

  it('clears badges in a new session (empty sessionStorage)', () => {
    card('a', 5);
    writeSeen(localStorage, {
      version: 1,
      stories: { a: { coverage: 5, seenAt: NOW - 24 * HOUR } },
    });

    installTrending(document, localStorage, new Date(NOW));

    expectBadge('a', false);
  });
});
