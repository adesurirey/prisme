import type { Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { mergeRedirectRegistry, mergeStories } from './merge.ts';

const NOW = new Date('2026-10-18T12:00:00Z');

/**
 * The manual merge CLI (merge-stories.ts): the Base Story survives — its
 * slug, id, title, Summaries and Topic stay, its summarizedArticleCount is
 * untouched so the next build re-summarizes the whole set — and the absorbed
 * Story's Articles move in as the unseen prefix (ADR-0006: append-only,
 * newest first), deduplicated by Article id.
 */

function story(id: string, slug: string, hoursAgo: number): Story {
  return {
    id,
    slug,
    title: `Sujet ${id}`,
    createdAt: '2026-10-18T04:00:00Z',
    storyDay: '2026-10-18',
    articles: [
      {
        id: `${id}-a1`,
        outletId: 'lemonde',
        headline: `Titre ${id} a1`,
        url: `https://lemonde.fr/a/${id}-a1`,
        publishedAt: new Date(
          NOW.getTime() - hoursAgo * 60 * 60 * 1000,
        ).toISOString(),
        frontPage: false,
      },
    ],
    summarizedArticleCount: 1,
  };
}

function article(id: string, hoursAgo: number) {
  return {
    id,
    outletId: 'lefigaro',
    headline: `Titre ${id}`,
    url: `https://lefigaro.fr/a/${id}`,
    publishedAt: new Date(
      NOW.getTime() - hoursAgo * 60 * 60 * 1000,
    ).toISOString(),
    frontPage: false,
  };
}

describe('mergeStories', () => {
  it('refuses merging a Story into itself', () => {
    const s = story('base-id', 'sujet-base', 5);
    expect(mergeStories(s, s, { now: NOW })).toEqual({
      ok: false,
      refusal: 'The two slugs point at the same Story.',
    });
  });

  it('refuses a cross-day merge unless forced', () => {
    const base = story('base-id', 'sujet-base', 5);
    const absorbed = story('abs-id', 'sujet-abs', 3);
    absorbed.storyDay = '2026-10-17';
    expect(mergeStories(base, absorbed, { now: NOW }).ok).toBe(false);
    const forced = mergeStories(base, absorbed, {
      now: NOW,
      allowCrossDay: true,
    });
    expect(forced.ok).toBe(true);
    if (forced.ok) expect(forced.merged.storyDay).toBe('2026-10-18');
  });

  it('refuses a frozen Base unless forced', () => {
    const base = story('base-id', 'sujet-base', 30);
    const absorbed = story('abs-id', 'sujet-abs', 3);
    expect(mergeStories(base, absorbed, { now: NOW }).ok).toBe(false);
    const forced = mergeStories(base, absorbed, {
      now: NOW,
      allowFrozenBase: true,
    });
    expect(forced.ok).toBe(true);
    if (forced.ok) expect(forced.merged.articles.length).toBe(2);
  });

  it('writes a redirect entry only for a Story that ever entered the Edition', () => {
    const base = story('base-id', 'sujet-base', 5);
    const absorbed = story('abs-id', 'sujet-abs', 3);
    const unmerged = mergeStories(base, absorbed, { now: NOW });
    expect(unmerged.ok).toBe(true);
    if (!unmerged.ok) return;
    expect(unmerged.redirect).toBeUndefined();
    absorbed.everInEdition = true;
    const redirected = mergeStories(base, absorbed, { now: NOW });
    expect(redirected.ok).toBe(true);
    if (!redirected.ok) return;
    expect(redirected.redirect).toEqual({
      from: { day: '2026-10-18', slug: 'sujet-abs' },
      to: { day: '2026-10-18', slug: 'sujet-base' },
      createdAt: NOW.toISOString(),
    });
  });

  it('prepends the absorbed Articles as the unseen prefix and keeps the Base fields', () => {
    const base = story('base-id', 'sujet-base', 5);
    const absorbed = story('abs-id', 'sujet-abs', 3);
    absorbed.articles = [
      article('abs-new-1', 2),
      article('abs-new-2', 7),
      article('abs-new-3', 4),
    ];
    absorbed.summarizedArticleCount = 3;

    const result = mergeStories(base, absorbed, { now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.merged.slug).toBe('sujet-base');
    expect(result.merged.id).toBe('base-id');
    expect(result.merged.title).toBe('Sujet base-id');
    expect(result.merged.summarizedArticleCount).toBe(1);
    expect(result.merged.articles.map((a) => a.id)).toEqual([
      'abs-new-1',
      'abs-new-3',
      'abs-new-2',
      'base-id-a1',
    ]);
  });

  it('drops absorbed Articles already in the Base and warns', () => {
    const base = story('base-id', 'sujet-base', 5);
    const absorbed = story('abs-id', 'sujet-abs', 3);
    absorbed.articles = [article('base-id-a1', 2), article('abs-new-1', 6)];

    const result = mergeStories(base, absorbed, { now: NOW });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.merged.articles.map((a) => a.id)).toEqual([
      'abs-new-1',
      'base-id-a1',
    ]);
    expect(result.warnings.some((w) => w.includes('base-id-a1'))).toBe(true);
  });
});

describe('mergeRedirectRegistry', () => {
  const entry = {
    from: { day: '2026-10-18', slug: 'sujet-abs' },
    to: { day: '2026-10-18', slug: 'sujet-base' },
    createdAt: NOW.toISOString(),
  };

  it('appends the entry to an empty registry', () => {
    const { registry, repointed } = mergeRedirectRegistry(
      { redirects: [] },
      entry,
    );
    expect(repointed).toBe(0);
    expect(registry.redirects).toEqual([entry]);
  });

  it('repoints existing entries that redirect into the absorbed Story', () => {
    const older = {
      from: { day: '2026-10-17', slug: 'sujet-ancien' },
      to: { day: '2026-10-18', slug: 'sujet-abs' },
      createdAt: '2026-10-17T10:00:00Z',
    };
    const { registry, repointed } = mergeRedirectRegistry(
      { redirects: [older] },
      entry,
    );
    expect(repointed).toBe(1);
    expect(registry.redirects).toEqual([
      {
        from: { day: '2026-10-17', slug: 'sujet-ancien' },
        to: { day: '2026-10-18', slug: 'sujet-base' },
        createdAt: '2026-10-17T10:00:00Z',
      },
      entry,
    ]);
  });

  it('replaces an existing entry with the same from', () => {
    const stale = {
      from: { day: '2026-10-18', slug: 'sujet-abs' },
      to: { day: '2026-10-18', slug: 'sujet-autre' },
      createdAt: '2026-10-17T10:00:00Z',
    };
    const { registry, repointed } = mergeRedirectRegistry(
      { redirects: [stale] },
      entry,
    );
    expect(repointed).toBe(0);
    expect(registry.redirects).toEqual([entry]);
  });
});
