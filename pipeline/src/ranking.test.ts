import { describe, expect, it } from 'vitest';
import type { Article, Outlet, Story } from '@prisme/domain';
import { EDITION_SIZE, rankStories } from './ranking.ts';

/**
 * The Edition ranking (issue #6): Stories order by the number of Outlets
 * currently on their Front page, then by Coverage (reporting Outlets),
 * then by the newest Article, then deterministically. The Edition keeps the
 * top EDITION_SIZE.
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

const outlets = [outlet('a', 'gauche'), outlet('b', 'centre'), outlet('c', 'droite')];
const byId = new Map(outlets.map((o) => [o.id, o]));

function article(id: string, overrides: Partial<Article> = {}): Article {
  return {
    id,
    outletId: 'a',
    headline: `Titre ${id}`,
    url: `https://a.fr/${id}`,
    publishedAt: '2026-10-06T10:00:00Z',
    frontPage: false,
    kind: 'news',
    ...overrides,
  };
}

function story(id: string, articles: Article[], createdAt = '2026-10-06T10:00:00Z'): Story {
  return { id, slug: id, title: 'Sujet', createdAt, articles };
}

const ranked = (stories: Story[]) => rankStories(stories, byId).map((s) => s.id);

describe('rankStories', () => {
  it('orders by the number of Outlets currently on the Front page', () => {
    const few = story('few', [article('1', { frontPage: true })]);
    const many = story('many', [
      article('2', { frontPage: true }),
      article('3', { frontPage: true, outletId: 'b' }),
      article('4', { frontPage: false, outletId: 'b' }),
    ]);
    expect(ranked([few, many])).toEqual(['many', 'few']);
  });

  it('counts an Outlet once however many of its Articles are on the Front page', () => {
    const one = story('one', [article('1', { frontPage: true })]);
    const same = story('same', [
      article('2', { frontPage: true }),
      article('3', { frontPage: true }),
    ]);
    expect(ranked([same, one])).toEqual(['one', 'same']);
  });

  it('uses Coverage — reporting Outlets — as the second key', () => {
    const one = story('one', [article('1')]);
    const two = story('two', [article('2'), article('3', { outletId: 'b' })]);
    expect(ranked([one, two])).toEqual(['two', 'one']);
  });

  it('never lets Opinion pieces count toward Coverage', () => {
    const news = story('news', [article('1')]);
    const opinion = story('op', [
      article('2'),
      article('3', { outletId: 'b', kind: 'opinion' }),
      article('4', { kind: 'opinion' }),
    ]);
    expect(ranked([opinion, news])).toEqual(['news', 'op']);
  });

  it('breaks Coverage ties by the newest Article', () => {
    const older = story('older', [article('1', { publishedAt: '2026-10-06T09:00:00Z' })]);
    const newer = story('newer', [article('2', { publishedAt: '2026-10-06T11:00:00Z' })]);
    expect(ranked([newer, older])).toEqual(['newer', 'older']);
  });

  it('breaks full ties by createdAt, then by id', () => {
    const early = story('early', [article('1')], '2026-10-06T08:00:00Z');
    const late = story('late', [article('2')], '2026-10-06T09:00:00Z');
    expect(ranked([late, early])).toEqual(['early', 'late']);
    expect(ranked([story('b', [article('1')]), story('a', [article('2')])])).toEqual(['a', 'b']);
  });

  it('keeps the top EDITION_SIZE in the Edition', () => {
    expect(EDITION_SIZE).toBe(20);
  });
});