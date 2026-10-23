import { describe, expect, it } from 'vitest';
import type { Article, Story } from './index.ts';
import { rankStoriesLatestFirst } from './ranking.ts';

/**
 * The « En direct » ranking key (ADR-0029): founding instant desc, then the
 * newest Article desc, then the whole-life Coverage desc — distinct
 * reporting Outlets, Opinion included (ADR-0011) — then id asc. The one
 * window ordered by "when", not "how much": Coverage never decides before
 * recency has.
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
  storyDay = '2026-10-06',
): Story {
  return { id, slug: id, title: 'Sujet', createdAt, storyDay, articles };
}

const ranked = (stories: Story[]) =>
  rankStoriesLatestFirst(stories).map((s) => s.id);

describe('rankStoriesLatestFirst', () => {
  it('orders by founding instant desc, ahead of any Coverage', () => {
    // 'wide' was founded two hours earlier but gathered five Outlets; the
    // latest-first window ranks the narrow scoop first — the break with
    // the Coverage keys (rankStories, rankStoriesInWindow).
    const wide = story('wide', [
      article('w0', { publishedAt: '2026-10-06T08:00:00Z' }),
      ...['b', 'c', 'd', 'e'].map((o) =>
        article(`w-${o}`, { outletId: o, publishedAt: '2026-10-06T08:30:00Z' }),
      ),
    ]);
    const narrow = story('narrow', [
      article('n0', { publishedAt: '2026-10-06T09:30:00Z' }),
    ]);
    expect(ranked([wide, narrow])).toEqual(['narrow', 'wide']);
  });

  it('breaks a founding tie by the newest Article', () => {
    const fresh = story('fresh', [
      article('f0', { publishedAt: '2026-10-06T09:00:00Z' }),
      article('f1', { outletId: 'b', publishedAt: '2026-10-06T09:40:00Z' }),
    ]);
    const stale = story('stale', [
      article('s0', { publishedAt: '2026-10-06T09:00:00Z' }),
      article('s1', { outletId: 'b', publishedAt: '2026-10-06T09:10:00Z' }),
    ]);
    expect(ranked([stale, fresh])).toEqual(['fresh', 'stale']);
  });

  it('breaks a full recency tie by whole-life Coverage — distinct reporting Outlets', () => {
    const founded = '2026-10-06T09:00:00Z';
    const wide = story('wide', [
      article('1', { publishedAt: founded }),
      article('2', { outletId: 'b', publishedAt: founded }),
      article('3', { outletId: 'c', publishedAt: founded }),
    ]);
    const narrow = story('narrow', [
      article('4', { publishedAt: founded }),
      article('5', { outletId: 'b', publishedAt: founded }),
    ]);
    expect(ranked([narrow, wide])).toEqual(['wide', 'narrow']);
  });

  it('counts an Opinion piece toward the Coverage tiebreak (ADR-0011)', () => {
    const founded = '2026-10-06T09:00:00Z';
    // The third reporting Outlet exists only through its Opinion piece;
    // ADR-0011 counts it, so the Story outranks a two-Outlet peer.
    const thirdOutletIsOpinion = story('op', [
      article('1', { publishedAt: founded }),
      article('2', { outletId: 'b', publishedAt: founded }),
      article('3', { outletId: 'c', kind: 'opinion', publishedAt: founded }),
    ]);
    const onlyTwoOutlets = story('two', [
      article('4', { publishedAt: founded }),
      article('5', { outletId: 'b', publishedAt: founded }),
    ]);
    expect(ranked([onlyTwoOutlets, thirdOutletIsOpinion])).toEqual([
      'op',
      'two',
    ]);
  });

  it('never counts not_news or unclassified Articles toward the Coverage tiebreak', () => {
    const founded = '2026-10-06T09:00:00Z';
    const junk = story('junk', [
      article('1', { publishedAt: founded }),
      article('2', { outletId: 'b', kind: 'not_news', publishedAt: founded }),
      article('3', { outletId: 'c', kind: undefined, publishedAt: founded }),
    ]);
    // Two reporting Outlets beat three raw Articles: only 'junk''s first
    // Article reports. Were junk classified, its three Outlets would win.
    const two = story('two', [
      article('4', { publishedAt: founded }),
      article('5', { outletId: 'b', publishedAt: founded }),
    ]);
    expect(ranked([junk, two])).toEqual(['two', 'junk']);
  });

  it('breaks full ties by id asc, whatever the input order', () => {
    const founded = '2026-10-06T09:00:00Z';
    const b = story('b', [article('1', { publishedAt: founded })]);
    const a = story('a', [article('2', { publishedAt: founded })]);
    expect(ranked([b, a])).toEqual(['a', 'b']);
    expect(ranked([a, b])).toEqual(['a', 'b']);
  });

  it('is deterministic across rebuilds: same Stories, same order', () => {
    const stories = [
      story('s1', [article('1', { publishedAt: '2026-10-06T08:00:00Z' })]),
      story('s2', [
        article('2', { publishedAt: '2026-10-06T09:00:00Z' }),
        article('3', { outletId: 'b', publishedAt: '2026-10-06T09:30:00Z' }),
      ]),
      story('s3', [article('4', { publishedAt: '2026-10-06T09:00:00Z' })]),
    ];
    const first = ranked(stories);
    expect(ranked([...stories].reverse())).toEqual(first);
    expect(first).toEqual(['s2', 's3', 's1']);
  });

  it('sorts a Story with no dated Article last, deterministically', () => {
    const undated = story('undated', [article('1', { publishedAt: 'x' })]);
    const dated = story('dated', [
      article('2', { publishedAt: '2026-10-06T08:00:00Z' }),
    ]);
    expect(ranked([undated, dated])).toEqual(['dated', 'undated']);
  });
});
