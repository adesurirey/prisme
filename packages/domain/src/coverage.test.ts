import { describe, expect, it } from 'vitest';
import type { Article, Outlet, Story } from './index.ts';
import {
  blindspots,
  coverageCounts,
  countedArticles,
  frontPageOutlets,
  isReporting,
  newestFirst,
  pickStoryImage,
  reportingOutletIds,
} from './coverage.ts';

/**
 * The Coverage and Blindspot rules (issue #6): Coverage counts distinct
 * reporting Outlets per Leaning — never Articles, never Opinion pieces — and
 * a Blindspot is a Leaning with no reporting Outlet on a Story reported by
 * three or more Outlets. The image rule prefers Centre, then the Leaning with
 * the most Coverage, ties left to recency.
 */

function outlet(id: string, leaning: Outlet['leaning']): Outlet {
  return {
    id,
    name: id,
    leaning,
    paywall: 'none',
    site: `https://${id}.fr`,
    feeds: { latest: `https://${id}.fr/rss` },
  };
}

function article(id: string, overrides: Partial<Article> = {}): Article {
  return {
    id,
    outletId: 'lemonde',
    headline: `Titre ${id}`,
    url: `https://lemonde.fr/a/${id}`,
    publishedAt: '2026-10-06T10:00:00Z',
    frontPage: false,
    ...overrides,
  };
}

const outlets: Outlet[] = [
  outlet('gauche-1', 'gauche'),
  outlet('centre-1', 'centre'),
  outlet('centre-2', 'centre'),
  outlet('droite-1', 'droite'),
];
const byId = new Map(outlets.map((o) => [o.id, o]));

describe('isReporting', () => {
  it('counts news and live Articles as reporting', () => {
    expect(isReporting(article('a', { kind: 'news' }))).toBe(true);
    expect(isReporting(article('a', { kind: 'live' }))).toBe(true);
  });

  it('never counts Opinion pieces, not_news or unclassified Articles', () => {
    expect(isReporting(article('a', { kind: 'opinion' }))).toBe(false);
    expect(isReporting(article('a', { kind: 'not_news' }))).toBe(false);
    expect(isReporting(article('a'))).toBe(false);
  });
});

describe('coverageCounts', () => {
  it('counts distinct Outlets per Leaning, not Articles', () => {
    const articles = [
      article('a', { outletId: 'centre-1', kind: 'news' }),
      article('b', { outletId: 'centre-1', kind: 'news' }),
      article('c', { outletId: 'centre-2', kind: 'live' }),
      article('d', { outletId: 'droite-1', kind: 'news' }),
    ];
    expect(coverageCounts(articles, byId)).toEqual({ gauche: 0, centre: 2, droite: 1 });
  });

  it('excludes Opinion pieces from the counts', () => {
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'opinion' }),
      article('b', { outletId: 'centre-1', kind: 'news' }),
    ];
    expect(coverageCounts(articles, byId)).toEqual({ gauche: 0, centre: 1, droite: 0 });
  });

  it('ignores Outlets missing from the config rather than guessing a Leaning', () => {
    const articles = [article('a', { outletId: 'inconnu', kind: 'news' })];
    expect(coverageCounts(articles, byId)).toEqual({ gauche: 0, centre: 0, droite: 0 });
  });

  it('reports the distinct Outlet ids, whatever their Leaning', () => {
    const articles = [
      article('a', { outletId: 'centre-1', kind: 'news' }),
      article('b', { outletId: 'centre-1', kind: 'opinion' }),
      article('c', { outletId: 'droite-1', kind: 'news' }),
    ];
    expect(reportingOutletIds(articles)).toEqual(new Set(['centre-1', 'droite-1']));
  });
});

describe('blindspots', () => {
  it('is empty below three reporting Outlets', () => {
    expect(blindspots({ gauche: 1, centre: 1, droite: 0 })).toEqual([]);
  });

  it('flags every Leaning with no reporting Outlet once the Story reaches three', () => {
    expect(blindspots({ gauche: 0, centre: 3, droite: 0 })).toEqual(['gauche', 'droite']);
  });

  it('is empty when all three Leanings report the Story', () => {
    expect(blindspots({ gauche: 1, centre: 1, droite: 1 })).toEqual([]);
  });

  it('counts only configured Outlets — the same basis as the counts', () => {
    // Two configured Outlets plus one unknown: no Blindspot, the threshold
    // counts Outlets that have a Leaning, like the counts do.
    expect(blindspots({ gauche: 0, centre: 2, droite: 0 })).toEqual([]);
  });
});

describe('countedArticles', () => {
  it('counts every Article except Opinion pieces', () => {
    const articles = [
      article('a', { kind: 'news' }),
      article('b', { kind: 'opinion' }),
      article('c', { kind: 'live' }),
      article('d'),
    ];
    expect(countedArticles(articles)).toBe(3);
  });
});

describe('frontPageOutlets', () => {
  it('lists each Outlet ever on the Front page, by Leaning then config order', () => {
    const articles = [
      article('a', { outletId: 'droite-1', everFrontPage: true }),
      article('b', { outletId: 'centre-2', everFrontPage: true }),
      article('c', { outletId: 'centre-1', everFrontPage: true }),
      article('d', { outletId: 'gauche-1', everFrontPage: false }),
    ];
    expect(frontPageOutlets(articles, outlets).map((o) => o.id)).toEqual([
      'centre-1',
      'centre-2',
      'droite-1',
    ]);
  });

  it('lists an Outlet once even with several Front-page Articles', () => {
    const articles = [
      article('a', { outletId: 'centre-1', everFrontPage: true }),
      article('b', { outletId: 'centre-1', everFrontPage: true }),
    ];
    expect(frontPageOutlets(articles, outlets).map((o) => o.id)).toEqual(['centre-1']);
  });
});

describe('pickStoryImage', () => {
  function story(articles: Article[]): Story {
    return {
      id: 'story1',
      slug: 'sujet',
      title: 'Sujet',
      createdAt: '2026-10-06T10:00:00Z',
      articles,
    };
  }

  const at = (hour: number) => `2026-10-06T${String(hour).padStart(2, '0')}:00:00Z`;

  it('prefers the newest Centre Article with an image', () => {
    const articles = [
      article('gauche', { outletId: 'gauche-1', kind: 'news', publishedAt: at(12), imageUrl: 'g.jpg' }),
      article('centre-vieux', { outletId: 'centre-1', kind: 'news', publishedAt: at(9), imageUrl: 'cv.jpg' }),
      article('centre-rec', { outletId: 'centre-2', kind: 'news', publishedAt: at(14), imageUrl: 'cr.jpg' }),
    ];
    expect(pickStoryImage(story(articles), byId)?.imageUrl).toBe('cr.jpg');
  });

  it('without Centre, picks the Leaning with the most Coverage', () => {
    const articles = [
      article('gauche', { outletId: 'gauche-1', kind: 'news', publishedAt: at(12), imageUrl: 'g.jpg' }),
      article('droite', { outletId: 'droite-1', kind: 'news', publishedAt: at(14), imageUrl: 'd.jpg' }),
      article('centre', { outletId: 'centre-1', kind: 'news', publishedAt: at(15), imageUrl: 'c.jpg' }),
    ];
    // Droite has 1 reporting Outlet, Gauche 1, Centre 1 — recency breaks it.
    expect(pickStoryImage(story(articles), byId)?.imageUrl).toBe('c.jpg');
  });

  it('on a Gauche/Droite tie, recency wins regardless of Leaning', () => {
    const articles = [
      article('gauche', { outletId: 'gauche-1', kind: 'news', publishedAt: at(9), imageUrl: 'g.jpg' }),
      article('droite', { outletId: 'droite-1', kind: 'news', publishedAt: at(14), imageUrl: 'd.jpg' }),
    ];
    expect(pickStoryImage(story(articles), byId)?.imageUrl).toBe('d.jpg');
  });

  it('follows Coverage order when the top Leaning has no image', () => {
    const articles = [
      article('centre-sans', { outletId: 'centre-1', kind: 'news', publishedAt: at(15) }),
      article('centre-2', { outletId: 'centre-2', kind: 'news', publishedAt: at(16) }),
      article('gauche', { outletId: 'gauche-1', kind: 'news', publishedAt: at(12), imageUrl: 'g.jpg' }),
    ];
    // Centre has the most Coverage (2 Outlets) but no image; Gauche follows.
    expect(pickStoryImage(story(articles), byId)?.imageUrl).toBe('g.jpg');
  });

  it('within a Leaning, takes the newest Article with an image', () => {
    const articles = [
      article('g-rec', { outletId: 'gauche-1', kind: 'news', publishedAt: at(12), imageUrl: 'g2.jpg' }),
      article('g-vieux', { outletId: 'gauche-1', kind: 'news', publishedAt: at(9), imageUrl: 'g1.jpg' }),
    ];
    expect(pickStoryImage(story(articles), byId)?.imageUrl).toBe('g2.jpg');
  });

  it('returns undefined when no Article has an image', () => {
    expect(pickStoryImage(story([article('a', { kind: 'news' })]), byId)).toBeUndefined();
  });

  it('ties are broken by id for determinism', () => {
    const articles = [
      article('b', { outletId: 'centre-1', kind: 'news', publishedAt: at(12), imageUrl: 'b.jpg' }),
      article('a', { outletId: 'centre-2', kind: 'news', publishedAt: at(12), imageUrl: 'a.jpg' }),
    ];
    expect(pickStoryImage(story(articles), byId)?.imageUrl).toBe('a.jpg');
  });

  it('orders Articles by publication time descending, ties by id', () => {
    const articles = [
      article('old', { publishedAt: '2026-10-06T09:00:00Z' }),
      article('new', { publishedAt: '2026-10-06T11:00:00Z' }),
      article('mid', { publishedAt: '2026-10-06T10:00:00Z' }),
      article('mid-tie', { publishedAt: '2026-10-06T10:00:00Z' }),
    ];
    expect([...articles].sort(newestFirst).map((a) => a.id)).toEqual([
      'new',
      'mid',
      'mid-tie',
      'old',
    ]);
  });
});