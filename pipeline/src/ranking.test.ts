import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { assembleEdition, rankStories } from './ranking.ts';

/**
 * The Edition ranking (issue #37, ADR-0009 as amended by ADR-0011): Stories
 * order by Coverage — distinct Outlets with any Article on the Story, Opinion
 * pieces included — then by the newest Article, then deterministically. The
 * Edition is uncapped (ADR-0022).
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

// Noon Paris on day D (10:00 UTC, CEST): D's window is open, D-1's and
// earlier are closed — the ordinary in-day view of the Edition.
const DAY_NOON = new Date('2026-10-06T10:00:00Z');
// 00:30 Paris of day D+1 (22:30 UTC of D): D's window is still open until
// 06:00 Paris — the post-midnight view where the midnight gap appeared.
const NEXT_DAY_EARLY = new Date('2026-10-05T22:30:00Z');
// 06:30 Paris of day D+1 (04:30 UTC): D's window has just closed.
const NEXT_DAY_AFTER_WINDOW = new Date('2026-10-06T04:30:00Z');

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

  it('counts Opinion pieces toward Coverage (ADR-0011)', () => {
    const news = story('news', [article('1')]);
    const opinion = story('op', [
      article('2'),
      article('3', { outletId: 'b', kind: 'opinion' }),
      article('4', { kind: 'opinion' }),
    ]);
    expect(ranked([opinion, news])).toEqual(['op', 'news']);
  });

  it('still never counts not_news or unclassified Articles toward Coverage', () => {
    const news = story('news', [article('1')]);
    const junk = story('junk', [
      article('2', { kind: 'not_news' }),
      article('3', { outletId: 'b', kind: undefined }),
    ]);
    expect(ranked([junk, news])).toEqual(['news', 'junk']);
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
});

/**
 * The dated Edition assembly (ADR-0022): the live pool — window-open
 * Stories — ranked by ADR-0009, uncapped. No backfill: closed previous
 * days' Stories are the archive pages' business.
 */
describe('assembleEdition', () => {
  const today = '2026-10-06';

  it('is uncapped: every live Story ranks in (ADR-0022)', () => {
    const stories = Array.from({ length: 60 }, (_, i) =>
      story(`s${String(i).padStart(2, '0')}`, [article(`a${i}`)]),
    );
    expect(assembleEdition(stories, DAY_NOON)).toHaveLength(60);
  });

  it('drops closed previous days Stories: no backfill (ADR-0022)', () => {
    const j2 = {
      ...story('j2', [article('1')], undefined, '2026-10-04'),
      everInEdition: true,
    };
    const j1 = {
      ...story('j1', [article('2')], undefined, '2026-10-05'),
      everInEdition: true,
    };
    const current = story('cur', [article('3')], undefined, today);
    expect(
      assembleEdition([j2, j1, current], DAY_NOON).map((s) => s.id),
    ).toEqual(['cur']);
  });

  it('does not need everInEdition to rank in: every live Story is Edition material', () => {
    const never = story('never', [article('2')], undefined, today);
    expect(assembleEdition([never], DAY_NOON).map((s) => s.id)).toEqual([
      'never',
    ]);
  });

  it('is smooth at midnight: a day-D Story still ranks at 00:30 of D+1 (window open)', () => {
    // Yesterday's Story (day D), already in the Edition during D.
    const yesterday = {
      ...story('d', [article('1')], undefined, '2026-10-05'),
      everInEdition: true,
    };
    // The day has rolled over but D's ingestion window stays open until
    // 06:00: the Story ranks in the live pool, not as backfill.
    expect(
      assembleEdition([yesterday], NEXT_DAY_EARLY).map((s) => s.id),
    ).toEqual(['d']);
  });

  it('midnight gap fix: a day-D Story never in the Edition still ranks at 00:30 of D+1', () => {
    // Born right after midnight (the 2026-10-13 22:01 UTC build): day D,
    // never shown, structurally invisible to the old current-day tier —
    // born doomed to the never-in-Edition deletion rule (issue #75).
    const lateBorn = {
      ...story(
        'late-born',
        [article('1', { publishedAt: '2026-10-05T23:50:00Z' })],
        '2026-10-05T22:10:00Z',
        '2026-10-05',
      ),
      everInEdition: false,
    };
    expect(
      assembleEdition([lateBorn], NEXT_DAY_EARLY).map((s) => s.id),
    ).toEqual(['late-born']);
  });

  it('after the window closes: yesterday’s Stories leave the Edition, no backfill (ADR-0022)', () => {
    const shown = {
      ...story('shown', [article('1')], '2026-10-05T20:00:00Z', '2026-10-05'),
      everInEdition: true,
    };
    const never = {
      ...story(
        'never',
        [article('2', { publishedAt: '2026-10-05T23:50:00Z' })],
        '2026-10-05T22:10:00Z',
        '2026-10-05',
      ),
      everInEdition: false,
    };
    expect(
      assembleEdition([shown, never], NEXT_DAY_AFTER_WINDOW).map((s) => s.id),
    ).toEqual([]);
  });

  it('ranks window-open Stories of two days together by the ADR-0009 key', () => {
    // At 00:30 of D+1 both days' windows are open: one ranked live pool.
    const wideYesterday = {
      ...story(
        'wide-d',
        [article('1'), article('2', { outletId: 'b' })],
        '2026-10-05T21:00:00Z',
        '2026-10-05',
      ),
      everInEdition: false,
    };
    const narrowToday = story('narrow-d1', [article('3')], undefined, today);
    expect(
      assembleEdition([narrowToday, wideYesterday], NEXT_DAY_EARLY).map(
        (s) => s.id,
      ),
    ).toEqual(['wide-d', 'narrow-d1']);
  });

  it('drops Stories from a future day (defensive, should not happen)', () => {
    const future = story('future', [article('1')], undefined, '2026-10-07');
    expect(assembleEdition([future], DAY_NOON)).toEqual([]);
  });
});
