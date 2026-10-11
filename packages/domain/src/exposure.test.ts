import { describe, expect, it } from 'vitest';
import { EXPOSURE_COMPRESSION_EXPONENT, exposureShares } from './exposure.ts';
import type { Article, Leaning, OutletConfig } from './index.ts';

/**
 * The Exposure rules (issue #88, spec #86): a Story's Reach-weighted share
 * per Coverage group — each distinct reporting Outlet weighs the square root
 * of its Reach, once whatever its number of Articles; a group's Exposition
 * is its sum over the Story's total. A Story with no reporting Outlet has
 * all-zero shares: it reuses the existing "not covered" bar state upstream,
 * with no special branch here.
 */

function outlet(id: string, leaning: Leaning, reach: number): OutletConfig {
  return {
    id,
    name: id,
    leaning,
    paywall: 'none',
    site: `https://${id}.fr`,
    feeds: { latest: `https://${id}.fr/rss` },
    leaningSources: [],
    leaningNote: '',
    readership: { evidence: '' },
    audience: { reach, unit: 'visits', source: 'test', asOf: '2026-08' },
    feedChecks: [],
    tdm: { reserved: false, checkedAt: '2026-08-01' },
  };
}

function article(id: string, overrides: Partial<Article> = {}): Article {
  return {
    id,
    outletId: 'gauche-1',
    headline: `Titre ${id}`,
    url: `https://gauche-1.fr/a/${id}`,
    publishedAt: '2026-10-06T10:00:00Z',
    frontPage: false,
    ...overrides,
  };
}

const outlets: OutletConfig[] = [
  outlet('gauche-1', 'gauche', 100),
  outlet('centre-1', 'centre', 25),
  outlet('centre-2', 'centre', 9),
  outlet('droite-1', 'droite', 25),
];
const byId = new Map(outlets.map((o) => [o.id, o]));

describe('EXPOSURE_COMPRESSION_EXPONENT', () => {
  it('is the sqrt compression of the first cut (spec #86)', () => {
    expect(EXPOSURE_COMPRESSION_EXPONENT).toBe(0.5);
  });
});

describe('exposureShares', () => {
  it('gives a mono-group Story the full share for its group', () => {
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'news' }),
      article('b', { outletId: 'centre-1', kind: 'news' }),
    ];
    const shares = exposureShares(
      articles.filter((a) => a.outletId === 'gauche-1'),
      byId,
    );
    expect(shares).toEqual({ gauche: 1, centre: 0, droite: 0 });
  });

  it('weights each distinct Outlet by √reach, not raw reach', () => {
    // √100 = 10 and √25 = 5, so gauche takes 10/15 = 2/3 — raw reach would
    // give 100/125 = 4/5, which distinguishes the two weightings.
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'news' }),
      article('b', { outletId: 'droite-1', kind: 'news' }),
    ];
    expect(exposureShares(articles, byId)).toEqual({
      gauche: 2 / 3,
      centre: 0,
      droite: 1 / 3,
    });
  });

  it('counts the Story total across groups as the shares’ sum', () => {
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'news' }),
      article('b', { outletId: 'centre-1', kind: 'news' }),
      article('c', { outletId: 'centre-2', kind: 'news' }),
      article('d', { outletId: 'droite-1', kind: 'news' }),
    ];
    const shares = exposureShares(articles, byId);
    const sum = shares.gauche + shares.centre + shares.droite;
    expect(sum).toBeCloseTo(1, 12);
  });

  it('weighs an Outlet with several Articles once, not once per Article', () => {
    const single = [article('a', { outletId: 'centre-1', kind: 'news' })];
    const several = [
      article('a', { outletId: 'centre-1', kind: 'news' }),
      article('b', { outletId: 'centre-1', kind: 'live' }),
      article('c', { outletId: 'centre-1', kind: 'opinion' }),
    ];
    expect(exposureShares(several, byId)).toEqual(exposureShares(single, byId));
  });

  it('counts an Outlet present only through an Opinion piece (ADR-0011)', () => {
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'opinion' }),
      article('b', { outletId: 'centre-1', kind: 'news' }),
    ];
    expect(exposureShares(articles, byId)).toEqual({
      gauche: 10 / 15,
      centre: 5 / 15,
      droite: 0,
    });
  });

  it('never counts not_news or unclassified Articles', () => {
    const articles = [
      article('a', { outletId: 'gauche-1', kind: 'not_news' }),
      article('b', { outletId: 'centre-1' }),
    ];
    expect(exposureShares(articles, byId)).toEqual({
      gauche: 0,
      centre: 0,
      droite: 0,
    });
  });

  it('returns all-zero shares on a Story with no reporting Outlet — the "not covered" state', () => {
    expect(exposureShares([], byId)).toEqual({
      gauche: 0,
      centre: 0,
      droite: 0,
    });
  });

  it('ignores Outlets missing from the config rather than guessing a weight', () => {
    const articles = [
      article('a', { outletId: 'inconnu', kind: 'news' }),
      article('b', { outletId: 'gauche-1', kind: 'news' }),
    ];
    expect(exposureShares(articles, byId)).toEqual({
      gauche: 1,
      centre: 0,
      droite: 0,
    });
  });
});
