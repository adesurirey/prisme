import { describe, expect, it } from 'vitest';
import {
  blindspots,
  countedArticles,
  coverageCounts,
  coverageGroup,
  frontPageOutlets,
  isReporting,
  newestFirst,
  reportingOutletIds,
} from './coverage.ts';
import type { Article, Leaning, Outlet, Story } from './index.ts';

/**
 * The Coverage and Blindspot rules (issue #6, revised — see ADR-0011):
 * Coverage counts distinct Outlets per Coverage group from any Article they
 * published on the Story — news, live or Opinion — because an Opinion piece
 * shapes the Outlet's readers just as much as a straight report. A Blindspot
 * is a group with no Outlet at all on a Story reported by three or more
 * Outlets. The five Leaning bands fold into the three groups (issue #46):
 * centre-gauche → gauche, centre-droite → droite. The image rule lives in
 * cover.ts: URL quality and freshness, no Leaning involved.
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

describe('coverageGroup', () => {
  it('folds centre-gauche into gauche and centre-droite into droite (issue #46)', () => {
    const bands: Record<Leaning, string> = {
      gauche: 'gauche',
      'centre-gauche': 'gauche',
      centre: 'centre',
      'centre-droite': 'droite',
      droite: 'droite',
    };
    for (const [leaning, group] of Object.entries(bands)) {
      expect(coverageGroup(leaning as Leaning)).toBe(group);
    }
  });

  it('counts a centre-gauche Outlet under gauche and a centre-droite one under droite', () => {
    const five: Outlet[] = [
      outlet('cg-1', 'centre-gauche'),
      outlet('centre-1', 'centre'),
      outlet('cd-1', 'centre-droite'),
    ];
    const byId = new Map(five.map((o) => [o.id, o]));
    const articles = [
      article('a', { outletId: 'cg-1', kind: 'news' }),
      article('b', { outletId: 'centre-1', kind: 'news' }),
      article('c', { outletId: 'cd-1', kind: 'news' }),
    ];
    expect(coverageCounts(articles, byId)).toEqual({
      gauche: 1,
      centre: 1,
      droite: 1,
    });
  });
});

describe('isReporting', () => {
  it('counts news, live and Opinion Articles as reporting (ADR-0011)', () => {
    expect(isReporting(article('a', { kind: 'news' }))).toBe(true);
    expect(isReporting(article('a', { kind: 'live' }))).toBe(true);
    expect(isReporting(article('a', { kind: 'opinion' }))).toBe(true);
  });

  it('never counts not_news or unclassified Articles', () => {
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
    expect(coverageCounts(articles, byId)).toEqual({
      gauche: 0,
      centre: 2,
      droite: 1,
    });
  });

  it('counts an Outlet present only through an Opinion piece (ADR-0011)', () => {
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'opinion' }),
      article('b', { outletId: 'centre-1', kind: 'news' }),
    ];
    expect(coverageCounts(articles, byId)).toEqual({
      gauche: 1,
      centre: 1,
      droite: 0,
    });
  });

  it('an Opinion-only Outlet erases its group Blindspot while the others report', () => {
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'opinion' }),
      article('b', { outletId: 'centre-1', kind: 'news' }),
      article('c', { outletId: 'droite-1', kind: 'news' }),
    ];
    expect(blindspots(coverageCounts(articles, byId))).toEqual([]);
  });

  it('a Story covered solely by Opinion pieces has non-zero Coverage', () => {
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'opinion' }),
      article('b', { outletId: 'droite-1', kind: 'opinion' }),
    ];
    expect(coverageCounts(articles, byId)).toEqual({
      gauche: 1,
      centre: 0,
      droite: 1,
    });
  });

  it('ignores Outlets missing from the config rather than guessing a Leaning', () => {
    const articles = [article('a', { outletId: 'inconnu', kind: 'news' })];
    expect(coverageCounts(articles, byId)).toEqual({
      gauche: 0,
      centre: 0,
      droite: 0,
    });
  });

  it('reports the distinct Outlet ids, whatever their Leaning', () => {
    const articles = [
      article('a', { outletId: 'centre-1', kind: 'news' }),
      article('b', { outletId: 'centre-1', kind: 'opinion' }),
      article('c', { outletId: 'droite-1', kind: 'news' }),
    ];
    expect(reportingOutletIds(articles)).toEqual(
      new Set(['centre-1', 'droite-1']),
    );
  });

  it('reports an Outlet whose only Article is an Opinion piece', () => {
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'opinion' }),
      article('b', { outletId: 'centre-1', kind: 'news' }),
    ];
    expect(reportingOutletIds(articles)).toEqual(
      new Set(['gauche-1', 'centre-1']),
    );
  });
});

describe('blindspots', () => {
  it('flags a Leaning absent while both others report the Story', () => {
    expect(blindspots({ gauche: 0, centre: 2, droite: 1 })).toEqual(['gauche']);
  });

  it('stays quiet when two Leanings are absent — an all-Centre Story is not news', () => {
    expect(blindspots({ gauche: 0, centre: 4, droite: 0 })).toEqual([]);
  });

  it('is empty when all three Leanings report the Story', () => {
    expect(blindspots({ gauche: 1, centre: 1, droite: 1 })).toEqual([]);
  });

  it('is empty with no reporting Outlet at all', () => {
    expect(blindspots({ gauche: 0, centre: 0, droite: 0 })).toEqual([]);
  });
});

describe('countedArticles', () => {
  it('counts every Article, Opinion pieces included (ADR-0011)', () => {
    const articles = [
      article('a', { kind: 'news' }),
      article('b', { kind: 'opinion' }),
      article('c', { kind: 'live' }),
      article('d', { kind: 'not_news' }),
    ];
    expect(countedArticles(articles)).toBe(4);
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
    expect(frontPageOutlets(articles, outlets).map((o) => o.id)).toEqual([
      'centre-1',
    ]);
  });
});
