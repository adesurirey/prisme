import { describe, expect, it } from 'vitest';
import type { Article, Story } from './index.ts';
import {
  FEED_FOUNDING_HALF_LIFE_MS,
  FEED_HALF_LIFE_MS,
  rankStoriesFeed,
  rankStoriesLatestFirst,
} from './ranking.ts';

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

/**
 * The Brûlant ranking key (spec #158, extending ADR-0036's « Le fil »
 * key): in-window Coverage — distinct reporting Outlets (Opinion
 * included, ADR-0011) — times an exponential silence decay, halved every
 * FEED_HALF_LIFE_MS since the newest in-window Article, times an
 * exponential founding decay, halved every FEED_FOUNDING_HALF_LIFE_MS
 * since the founding instant — a clock that never resets. Ties fall to
 * newest desc, founding desc, id asc.
 */
describe('rankStoriesFeed', () => {
  const NOW = new Date('2026-10-06T10:00:00Z');
  const DAY = 24 * 60 * 60 * 1000;
  const feed = (stories: Story[]) =>
    rankStoriesFeed(stories, DAY, NOW).map((s) => s.id);

  it('weighs Coverage against silence: a widely covered Story outlasts a fresh scoop', () => {
    // 8 Outlets silent for one half-life score 4 — still above a fresh
    // 3-Outlet scoop (~2.7)…
    const big = story('big', [
      article('b0', { publishedAt: '2026-10-06T04:00:00Z' }),
      ...['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((o) =>
        article(`b-${o}`, { outletId: o, publishedAt: '2026-10-06T04:00:00Z' }),
      ),
    ]);
    const scoop = story('scoop', [
      article('s0', { publishedAt: '2026-10-06T09:30:00Z' }),
      article('s1', { outletId: 'b', publishedAt: '2026-10-06T09:30:00Z' }),
      article('s2', { outletId: 'c', publishedAt: '2026-10-06T09:30:00Z' }),
    ]);
    expect(feed([scoop, big])).toEqual(['big', 'scoop']);
    // …but two half-lives of silence (score 2) and the scoop passes it.
    const quieter = story('big', [
      article('b0', { publishedAt: '2026-10-05T22:00:00Z' }),
      ...['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((o) =>
        article(`b-${o}`, { outletId: o, publishedAt: '2026-10-05T22:00:00Z' }),
      ),
    ]);
    expect(feed([scoop, quieter])).toEqual(['scoop', 'big']);
  });

  it('halves exactly at FEED_HALF_LIFE_MS: the score tie falls to recency', () => {
    expect(FEED_HALF_LIFE_MS).toBe(6 * 3_600_000); // ADR-0036's one knob
    // 4 Outlets silent for one half-life weigh 2 — exactly the weight of
    // a fresh 2-Outlet Story; the tie-break (newest desc) takes over.
    const quiet = story('quiet', [
      article('q0', { publishedAt: '2026-10-06T04:00:00Z' }),
      article('q1', { outletId: 'b', publishedAt: '2026-10-06T04:00:00Z' }),
      article('q2', { outletId: 'c', publishedAt: '2026-10-06T04:00:00Z' }),
      article('q3', { outletId: 'd', publishedAt: '2026-10-06T04:00:00Z' }),
    ]);
    const fresh = story('fresh', [
      article('f0', { publishedAt: '2026-10-06T10:00:00Z' }),
      article('f1', { outletId: 'b', publishedAt: '2026-10-06T10:00:00Z' }),
    ]);
    expect(feed([quiet, fresh])).toEqual(['fresh', 'quiet']);
  });

  it('breaks score and recency ties by founding desc, then id asc', () => {
    const foundedOlder = story('older', [
      article('o0', { publishedAt: '2026-10-05T20:00:00Z' }),
      article('o1', { outletId: 'b', publishedAt: '2026-10-06T09:00:00Z' }),
    ]);
    const foundedNewer = story('newer', [
      article('n0', { publishedAt: '2026-10-06T06:00:00Z' }),
      article('n1', { outletId: 'b', publishedAt: '2026-10-06T09:00:00Z' }),
    ]);
    expect(feed([foundedOlder, foundedNewer])).toEqual(['newer', 'older']);
    const a = story(
      'a',
      [article('a0', { publishedAt: '2026-10-06T09:00:00Z' })],
      '2026-10-05T20:00:00Z',
    );
    const b = story(
      'b',
      [article('b0', { publishedAt: '2026-10-06T09:00:00Z' })],
      '2026-10-05T20:00:00Z',
    );
    expect(feed([b, a])).toEqual(['a', 'b']);
  });

  it('counts distinct reporting Outlets in the window — Opinion in, not_news out', () => {
    const reporting = story('reporting', [
      article('r0', { publishedAt: '2026-10-06T09:00:00Z' }),
      article('r1', {
        outletId: 'b',
        kind: 'opinion',
        publishedAt: '2026-10-06T09:00:00Z',
      }),
    ]);
    const flat = story('flat', [
      article('f0', { publishedAt: '2026-10-06T09:00:00Z' }),
      article('f1', {
        outletId: 'b',
        kind: 'not_news',
        publishedAt: '2026-10-06T09:00:00Z',
      }),
    ]);
    expect(feed([flat, reporting])).toEqual(['reporting', 'flat']);
  });

  it('adds the founding clock: an old-but-covered Story sinks below a fresh less-covered one', () => {
    // The counter-example of the silence-only key (spec #158): 'squatter'
    // was founded 20 h ago, carries four reporting Outlets and was heard
    // from again half an hour ago — under ADR-0036's key it outweighs the
    // three-Outlet scoop (3.8 vs 2.7) and squats the top while coverage
    // keeps flowing. The founding clock (× 2^(−20/18) ≈ 0.46) sinks it
    // below the scoop (1.7 vs 2.6): however loud the coverage, weight
    // decays with the Story's age.
    const squatter = story('squatter', [
      article('sq-old', { outletId: 'a', publishedAt: '2026-10-05T14:00:00Z' }),
      ...['b', 'c', 'd'].map((o) =>
        article(`sq-${o}`, {
          outletId: o,
          publishedAt: '2026-10-06T09:30:00Z',
        }),
      ),
    ]);
    const scoop = story('scoop', [
      article('sc-a', { publishedAt: '2026-10-06T09:00:00Z' }),
      article('sc-b', { outletId: 'b', publishedAt: '2026-10-06T09:00:00Z' }),
      article('sc-c', { outletId: 'c', publishedAt: '2026-10-06T09:00:00Z' }),
    ]);
    expect(feed([scoop, squatter])).toEqual(['scoop', 'squatter']);
  });

  it('never resets the founding clock on new coverage — it runs from the founding, not the newest Article', () => {
    // The silence clock resets on every new in-window Article; the
    // founding clock does not. 'still' reports again one minute ago
    // (silence ≈ 0, weight 4.0 under the silence-only key) — founded
    // 20 h ago it still weighs 1.9, under the fresh scoop's 2.6.
    const still = story('still', [
      article('st-old', { outletId: 'a', publishedAt: '2026-10-05T14:00:00Z' }),
      ...['b', 'c', 'd'].map((o) =>
        article(`st-${o}`, {
          outletId: o,
          publishedAt: '2026-10-06T09:59:00Z',
        }),
      ),
    ]);
    const scoop = story('scoop', [
      article('sc-a', { publishedAt: '2026-10-06T09:00:00Z' }),
      article('sc-b', { outletId: 'b', publishedAt: '2026-10-06T09:00:00Z' }),
      article('sc-c', { outletId: 'c', publishedAt: '2026-10-06T09:00:00Z' }),
    ]);
    expect(feed([scoop, still])).toEqual(['scoop', 'still']);
  });

  it('halves the founding factor exactly at FEED_FOUNDING_HALF_LIFE_MS', () => {
    expect(FEED_FOUNDING_HALF_LIFE_MS).toBe(18 * 3_600_000); // spec #158
    // Four Outlets, silent for nothing, founded two founding half-lives
    // ago (36 h — the founding Article itself outside the window) weigh
    // 4 × 2^(−2) = 1 — exactly the weight of a fresh one-Outlet Story;
    // the tie falls to founding desc. One hour younger (35 h) and the
    // aged Story passes the scoop again: 4 × 2^(−35/18) ≈ 1.04 > 1.
    const aged = (id: string, founding: string) =>
      story(id, [
        article(`${id}-old`, { outletId: 'a', publishedAt: founding }),
        ...['a', 'b', 'c', 'd'].map((o) =>
          article(`${id}-${o}`, {
            outletId: o,
            publishedAt: NOW.toISOString(),
          }),
        ),
      ]);
    const fresh = story('fresh', [
      article('f', { publishedAt: NOW.toISOString() }),
    ]);
    expect(feed([aged('aged', '2026-10-04T22:00:00Z'), fresh])).toEqual([
      'fresh',
      'aged',
    ]);
    expect(feed([aged('younger', '2026-10-04T23:00:00Z'), fresh])).toEqual([
      'younger',
      'fresh',
    ]);
  });

  it('keeps a total order: a Story with no Article in the window sorts last', () => {
    // The pipeline cuts membership before ranking; the key stays total
    // for safety, like every Edition key.
    const member = story('member', [
      article('m0', { publishedAt: '2026-10-06T09:00:00Z' }),
    ]);
    const outsider = story('outsider', [
      article('x0', { publishedAt: '2026-10-01T09:00:00Z' }),
    ]);
    expect(feed([outsider, member])).toEqual(['member', 'outsider']);
  });
});
