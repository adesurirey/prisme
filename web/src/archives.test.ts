import { isStoryDayKey, type Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { archiveDays, archiveUrl, frenchArchiveDate } from './archives';

/**
 * The archive selection (issue #99, ADR-0017): one day per storyDay among
 * the everInEdition Stories, each day's list ranked by the ADR-0009 key
 * (Coverage desc, newest Article desc, createdAt asc, id asc) with no
 * top-20 cut, days newest first.
 */

function story(overrides: Partial<Story> & Pick<Story, 'id'>): Story {
  return {
    slug: `s-${overrides.id}`,
    title: 'Un sujet',
    createdAt: '2026-10-13T10:00:00Z',
    storyDay: '2026-10-13',
    articles: [],
    ...overrides,
  } as Story;
}

describe('archiveDays', () => {
  it('keeps only everInEdition Stories', () => {
    const days = archiveDays([
      story({ id: 'a', everInEdition: true }),
      story({ id: 'b' }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0].stories.map((s) => s.id)).toEqual(['a']);
  });

  it('groups by storyDay and sorts the days newest first', () => {
    const days = archiveDays([
      story({ id: 'a', storyDay: '2026-10-12', everInEdition: true }),
      story({ id: 'b', storyDay: '2026-10-13', everInEdition: true }),
    ]);
    expect(days.map((d) => d.day)).toEqual(['2026-10-13', '2026-10-12']);
  });

  it('ranks each day by the ADR-0009 key: coverage, then newest article, then creation, then id', () => {
    // b has more reporting Outlets → first despite being older.
    const days = archiveDays([
      story({
        id: 'a',
        storyDay: '2026-10-13',
        createdAt: '2026-10-13T09:00:00Z',
        everInEdition: true,
        articles: [
          {
            id: 'x1',
            outletId: 'le-monde',
            publishedAt: '2026-10-13T12:00:00Z',
          } as Story['articles'][number],
        ],
      }),
      story({
        id: 'b',
        storyDay: '2026-10-13',
        createdAt: '2026-10-13T08:00:00Z',
        everInEdition: true,
        articles: [
          {
            id: 'x2',
            outletId: 'le-monde',
            publishedAt: '2026-10-13T12:00:00Z',
          } as Story['articles'][number],
          {
            id: 'x3',
            outletId: 'le-figaro',
            publishedAt: '2026-10-13T12:30:00Z',
          } as Story['articles'][number],
        ],
      }),
    ]);
    expect(days[0].stories.map((s) => s.id)).toEqual(['b', 'a']);
  });

  it('does not cut the day list at the Edition size', () => {
    const stories = Array.from({ length: 25 }, (_, i) =>
      story({ id: `s${i}`, storyDay: '2026-10-13', everInEdition: true }),
    );
    const days = archiveDays(stories);
    expect(days[0].stories).toHaveLength(25);
  });
});

describe('frenchArchiveDate', () => {
  it('formats the Paris-day date with a capital initial', () => {
    expect(frenchArchiveDate('2026-10-13')).toBe('Mardi 13 octobre 2026');
  });

  it('stays inside the Paris day across a UTC-day boundary', () => {
    // 2026-10-14 01:00 Paris = 2026-10-13 23:00 UTC: the day key wins.
    expect(frenchArchiveDate('2026-10-14')).toBe('Mercredi 14 octobre 2026');
  });
});

describe('archiveUrl and isStoryDayKey', () => {
  it('builds the /archives/<day>/ URL', () => {
    expect(archiveUrl('2026-10-13')).toBe('/archives/2026-10-13/');
  });

  it('accepts only ISO YYYY-MM-DD keys', () => {
    expect(isStoryDayKey('2026-10-13')).toBe(true);
    expect(isStoryDayKey('13/10/2026')).toBe(false);
    expect(isStoryDayKey('')).toBe(false);
  });
});
