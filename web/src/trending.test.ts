// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  BASELINE_TTL_MS,
  installTrending,
  markTrending,
  readSeen,
  SEEN_KEY,
  type SeenBlob,
  writeSeen,
} from './trending';

const HOUR = 3_600_000;
const NOW = 1_800_000_000_000;

afterEach(() => {
  localStorage.clear();
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

  it('does not mark a Coverage gain of one outlet', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: { a: { coverage: 4, seenAt: NOW - 24 * HOUR } },
    };
    const { trendingIds } = markTrending([{ id: 'a', coverage: 5 }], NOW, blob);
    expect(trendingIds).toEqual([]);
  });

  it('marks a story that newly entered the Edition for a returning reader', () => {
    const blob: SeenBlob = {
      version: 1,
      // b seen before (at coverage 1), c never seen.
      stories: { b: { coverage: 1, seenAt: NOW - 24 * HOUR } },
    };
    const { trendingIds } = markTrending(
      [
        { id: 'b', coverage: 3 },
        { id: 'c', coverage: 1 },
      ],
      NOW,
      blob,
    );
    // c is in the Edition now and was absent from the last visit; b also
    // qualifies the ordinary way (Coverage 1 → 3 crosses the delta).
    expect(trendingIds).toEqual(['b', 'c']);
  });

  it('does not mark a story absent from a stale blob as newly entered', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: { b: { coverage: 1, seenAt: NOW - BASELINE_TTL_MS - HOUR } },
    };
    const { trendingIds } = markTrending(CURRENT, NOW, blob);
    expect(trendingIds).toEqual([]);
  });

  it('marks both a Coverage climb and a new entry, deterministically ordered by Edition rank', () => {
    const blob: SeenBlob = {
      version: 1,
      stories: {
        a: { coverage: 1, seenAt: NOW - 24 * HOUR },
        b: { coverage: 3, seenAt: NOW - 24 * HOUR },
      },
    };
    const { trendingIds } = markTrending(CURRENT, NOW, blob);
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

describe('installTrending', () => {
  const card = (id: string, coverage: number) => {
    const el = document.createElement('article');
    el.dataset.storyId = id;
    el.dataset.coverage = String(coverage);
    const h2 = document.createElement('h2');
    h2.textContent = 'Titre';
    el.append(h2);
    document.body.append(el);
  };

  const expectBadge = (id: string, present: boolean) => {
    const el = document.querySelector(`[data-story-id="${id}"]`)!;
    expect(el.querySelector('[data-trending-badge]') !== null).toBe(present);
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
});
