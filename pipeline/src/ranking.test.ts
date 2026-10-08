import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { EDITION_SIZE, rankStories } from './ranking.ts';

/**
 * The Edition ranking (issue #37, ADR-0009): Stories order by Coverage
 * (reporting Outlets, Opinion excluded), then by the newest Article, then
 * deterministically. The Edition keeps the top EDITION_SIZE.
 */

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

function story(
  id: string,
  articles: Article[],
  createdAt = '2026-10-06T10:00:00Z',
): Story {
  return { id, slug: id, title: 'Sujet', createdAt, articles };
}

const ranked = (stories: Story[]) => rankStories(stories).map((s) => s.id);

describe('rankStories', () => {
  it('orders by Coverage — reporting Outlets — regardless of Front-page flags', () => {
    const wide = story('wide', [
      article('1'),
      article('2', { outletId: 'b' }),
      article('3', { outletId: 'c' }),
    ]);
    const flagged = story('flagged', [
      article('4', { frontPage: true }),
      article('5', { frontPage: true }),
    ]);
    expect(ranked([flagged, wide])).toEqual(['wide', 'flagged']);
  });

  it('puts a wide Story with no Front-page Articles above fresh une-feed singletons (issue #37)', () => {
    const wide = story('wide', [
      article('1'),
      ...Array.from({ length: 14 }, (_, i) =>
        article(`w${i}`, { outletId: `o${i}` }),
      ),
    ]);
    const singletons = Array.from({ length: 19 }, (_, i) =>
      story(`s${i}`, [article(`a${i}`, { frontPage: true })]),
    );
    const rankedIds = ranked([wide, ...singletons]);
    expect(rankedIds[0]).toBe('wide');
    expect(rankedIds.slice(1)).toEqual(singletons.map((s) => s.id).sort());
  });

  it('uses Coverage — reporting Outlets', () => {
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
    const older = story('older', [
      article('1', { publishedAt: '2026-10-06T09:00:00Z' }),
    ]);
    const newer = story('newer', [
      article('2', { publishedAt: '2026-10-06T11:00:00Z' }),
    ]);
    expect(ranked([newer, older])).toEqual(['newer', 'older']);
  });

  it('breaks full ties by createdAt, then by id', () => {
    const early = story('early', [article('1')], '2026-10-06T08:00:00Z');
    const late = story('late', [article('2')], '2026-10-06T09:00:00Z');
    expect(ranked([late, early])).toEqual(['early', 'late']);
    expect(
      ranked([story('b', [article('1')]), story('a', [article('2')])]),
    ).toEqual(['a', 'b']);
  });

  it('keeps the top EDITION_SIZE in the Edition', () => {
    expect(EDITION_SIZE).toBe(20);
  });
});
