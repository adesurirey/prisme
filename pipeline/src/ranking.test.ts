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

// Noon Paris on day D+1 (10:00 UTC, CEST): Stories founded up to 24h ago
// are open — the ordinary in-day view of the Edition.
const DAY_NOON = new Date('2026-10-06T10:00:00Z');
// 00:30 Paris of day D+1 (22:30 UTC of D): the post-midnight view where the
// midnight gap appeared — an evening Story's window runs to the next
// evening.
const NEXT_DAY_EARLY = new Date('2026-10-05T22:30:00Z');
// 06:30 Paris of day D+1 (04:30 UTC): an early-morning Story of day D is
// just past its window close; an evening one is not.
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
 * The dated Edition assembly (ADR-0026): the live pool — Stories whose
 * Ingestion window `[founding, founding + 24h]` is open — ranked by
 * ADR-0009, uncapped, with a sharp exit at the window close. No backfill:
 * closed Stories are the archive pages' business.
 */
describe('assembleEdition', () => {
  const today = '2026-10-06';

  it('is uncapped: every live Story ranks in (ADR-0022)', () => {
    const stories = Array.from({ length: 60 }, (_, i) =>
      story(`s${String(i).padStart(2, '0')}`, [article(`a${i}`)]),
    );
    expect(assembleEdition(stories, DAY_NOON)).toHaveLength(60);
  });

  it('drops Stories whose Ingestion window has closed: no backfill (ADR-0022, ADR-0026)', () => {
    // Founded 2026-10-04 10:00Z (window closed 2026-10-05 10:00Z) and
    // 2026-10-05 09:00Z (closed 09:00Z of the Edition instant): both left.
    const j2 = {
      ...story(
        'j2',
        [article('1', { publishedAt: '2026-10-04T10:00:00Z' })],
        undefined,
        '2026-10-04',
      ),
      everInEdition: true,
    };
    const j1 = {
      ...story(
        'j1',
        [article('2', { publishedAt: '2026-10-05T09:00:00Z' })],
        undefined,
        '2026-10-05',
      ),
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
    // Yesterday's Story, founded 22:00 Paris on day D: 2.5h old at 00:30
    // of D+1 — its window runs until 22:00 Paris of D+1.
    const yesterday = {
      ...story(
        'd',
        [article('1', { publishedAt: '2026-10-05T20:00:00Z' })],
        undefined,
        '2026-10-05',
      ),
      everInEdition: true,
    };
    // The day has rolled over but the window stays open: the Story ranks
    // in the live pool, not as backfill.
    expect(
      assembleEdition([yesterday], NEXT_DAY_EARLY).map((s) => s.id),
    ).toEqual(['d']);
  });

  it('midnight gap fix: a Story born right after midnight still ranks at 00:30 (issue #75)', () => {
    // Born right after midnight (the 2026-10-13 22:01 UTC build shape):
    // founded 00:01 Paris, never shown, structurally invisible to the old
    // current-day tier — born doomed to the never-in-Edition deletion rule
    // (issue #75). Its window is open: it ranks.
    const lateBorn = {
      ...story(
        'late-born',
        [article('1', { publishedAt: '2026-10-05T22:01:00Z' })],
        '2026-10-05T22:01:00Z',
        '2026-10-06',
      ),
      everInEdition: false,
    };
    expect(
      assembleEdition([lateBorn], NEXT_DAY_EARLY).map((s) => s.id),
    ).toEqual(['late-born']);
  });

  it('an evening Story keeps ranking into the night while an old one has left (ADR-0026, issue #116)', () => {
    // At 06:30 of D+1 (the old 06:00 close had just passed): a Story
    // founded 04:00Z of day D (24.5h old) has left the Edition at its
    // window close + ε, while the evening Story founded 21:00Z of day D
    // (the Trump/Zelensky shape) is only 7.5h old and stays.
    const early = {
      ...story(
        'early',
        [article('1', { publishedAt: '2026-10-05T04:00:00Z' })],
        '2026-10-05T04:00:00Z',
        '2026-10-05',
      ),
      everInEdition: true,
    };
    const evening = {
      ...story(
        'evening',
        [article('2', { publishedAt: '2026-10-05T21:00:00Z' })],
        '2026-10-05T21:00:00Z',
        '2026-10-05',
      ),
      everInEdition: true,
    };
    expect(
      assembleEdition([early, evening], NEXT_DAY_AFTER_WINDOW).map((s) => s.id),
    ).toEqual(['evening']);
  });

  it('the evening Story leaves at its own window close + ε (sharp exit, ADR-0026)', () => {
    // Founded 21:00Z of day D: the window closes 21:00Z of D+1 — one
    // second later the Story is off la Une, however important.
    const evening = {
      ...story(
        'evening',
        [article('2', { publishedAt: '2026-10-05T21:00:00Z' })],
        '2026-10-05T21:00:00Z',
        '2026-10-05',
      ),
      everInEdition: true,
    };
    expect(
      assembleEdition([evening], new Date('2026-10-06T20:59:59Z')).map(
        (s) => s.id,
      ),
    ).toEqual(['evening']);
    expect(
      assembleEdition([evening], new Date('2026-10-06T21:00:01Z')),
    ).toEqual([]);
  });

  it('ranks window-open Stories of two days together by the ADR-0009 key', () => {
    // At 00:30 of D+1 both Stories' windows are open: one ranked live pool.
    const wideYesterday = {
      ...story(
        'wide-d',
        [
          article('1', { publishedAt: '2026-10-05T20:00:00Z' }),
          article('2', { outletId: 'b', publishedAt: '2026-10-05T21:00:00Z' }),
        ],
        '2026-10-05T20:00:00Z',
        '2026-10-05',
      ),
      everInEdition: false,
    };
    const narrowToday = story(
      'narrow-d1',
      [article('3', { publishedAt: '2026-10-05T22:10:00Z' })],
      '2026-10-05T22:10:00Z',
      '2026-10-06',
    );
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
