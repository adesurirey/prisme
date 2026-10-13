import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { assembleEdition, EDITION_SIZE, rankStories } from './ranking.ts';

/**
 * The Edition ranking (issue #37, ADR-0009 as amended by ADR-0011): Stories
 * order by Coverage — distinct Outlets with any Article on the Story, Opinion
 * pieces included — then by the newest Article, then deterministically. The
 * Edition keeps the top EDITION_SIZE.
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

  it('keeps the top EDITION_SIZE in the Edition', () => {
    expect(EDITION_SIZE).toBe(20);
  });
});

/**
 * The dated Edition assembly (issue #98, ADR-0017): current-day Stories
 * ranked by ADR-0009 first, then backfill — previous days' everInEdition
 * Stories, newest day first, each day ranked by the same key — capped at
 * EDITION_SIZE.
 */
describe('assembleEdition', () => {
  const today = '2026-10-06';

  it('puts current-day Stories above backfill days, J-1 before J-2', () => {
    const j2 = story('j2', [article('1')], undefined, '2026-10-04');
    const j1 = story('j1', [article('2')], undefined, '2026-10-05');
    const current = story('cur', [article('3')], undefined, today);
    expect(
      assembleEdition(
        [j2, j1, current].map((s) => ({ ...s, everInEdition: true })),
        today,
      ).map((s) => s.id),
    ).toEqual(['cur', 'j1', 'j2']);
  });

  it('ranks each backfill day by Coverage, independently', () => {
    const j1 = [
      story(
        'j1-wide',
        [article('1'), article('2', { outletId: 'b' })],
        undefined,
        '2026-10-05',
      ),
      story('j1-narrow', [article('3')], undefined, '2026-10-05'),
    ];
    const j2 = [
      story(
        'j2-wide',
        [article('4'), article('5', { outletId: 'b' })],
        undefined,
        '2026-10-04',
      ),
      story('j2-narrow', [article('6')], undefined, '2026-10-04'),
    ];
    expect(
      assembleEdition(
        [...j1, ...j2].map((s) => ({ ...s, everInEdition: true })),
        today,
      ).map((s) => s.id),
    ).toEqual(['j1-wide', 'j1-narrow', 'j2-wide', 'j2-narrow']);
  });

  it('draws backfill only from everInEdition Stories', () => {
    const flagged = story('flagged', [article('1')], undefined, '2026-10-05');
    const never = story('never', [article('2')], undefined, '2026-10-05');
    expect(
      assembleEdition(
        [
          { ...flagged, everInEdition: true },
          { ...never, everInEdition: false },
        ],
        today,
      ).map((s) => s.id),
    ).toEqual(['flagged']);
  });

  it('caps the Edition at EDITION_SIZE, current-day first', () => {
    const stories = [
      story('cur', [article('0')], undefined, today),
      ...Array.from({ length: EDITION_SIZE }, (_, i) =>
        story(
          `j1-${String(i).padStart(2, '0')}`,
          [article(`a${i}`)],
          undefined,
          '2026-10-05',
        ),
      ),
    ].map((s) => ({ ...s, everInEdition: true }));
    const edition = assembleEdition(stories, today);
    expect(edition).toHaveLength(EDITION_SIZE);
    expect(edition[0]!.id).toBe('cur');
    expect(edition.map((s) => s.id)).not.toContain('j1-19');
  });

  it('erodes: new current-day Stories displace backfill downward', () => {
    const backfill = Array.from({ length: EDITION_SIZE }, (_, i) =>
      story(
        `j1-${String(i).padStart(2, '0')}`,
        [article(`a${i}`)],
        undefined,
        '2026-10-05',
      ),
    ).map((s) => ({ ...s, everInEdition: true }));
    const before = assembleEdition(backfill, today);
    expect(before[0]!.storyDay).toBe('2026-10-05');
    // One current-day Story enters: the last backfill Story falls off.
    const after = assembleEdition(
      [...backfill, story('cur', [article('z')], undefined, today)],
      today,
    );
    expect(after).toHaveLength(EDITION_SIZE);
    expect(after[0]!.id).toBe('cur');
    expect(after.map((s) => s.id)).not.toContain('j1-19');
    expect(after[1]!.id).toBe(before[0]!.id);
  });

  it('is smooth at midnight: a Story of day D ranks as backfill at 00:30 of D+1', () => {
    // Yesterday's Story (day D), already in the Edition during D.
    const yesterday = {
      ...story('d', [article('1')], undefined, '2026-10-05'),
      everInEdition: true,
    };
    // The day has rolled over: the same pool seen from D+1 early morning.
    expect(assembleEdition([yesterday], '2026-10-06').map((s) => s.id)).toEqual(
      ['d'],
    );
  });

  it('drops Stories from a future day (defensive, should not happen)', () => {
    const future = story('future', [article('1')], undefined, '2026-10-07');
    expect(assembleEdition([future], today)).toEqual([]);
  });
});
