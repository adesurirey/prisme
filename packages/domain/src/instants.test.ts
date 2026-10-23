import { describe, expect, it } from 'vitest';
import type { Article, Story } from './index.ts';
import { foundingInstant, newestInstant } from './instants.ts';

const article = (publishedAt: string, id = 'a1'): Article => ({
  id,
  outletId: 'le-parisien',
  headline: 'T',
  url: `https://www.leparisien.fr/${id}`,
  publishedAt,
  frontPage: false,
});

const story = (articles: Article[], id = 's1'): Story => ({
  id,
  slug: id,
  title: 'T',
  createdAt: '2026-10-07T14:00:00Z',
  storyDay: '2026-10-06',
  articles,
});

describe('foundingInstant (ADR-0026)', () => {
  it('is the earliest publishedAt among the Story’s Articles', () => {
    expect(
      foundingInstant(
        story([
          article('2026-10-06T12:00:00Z', 'a2'),
          article('2026-10-06T10:00:00Z', 'a1'),
          article('2026-10-06T11:00:00Z', 'a3'),
        ]),
      ),
    ).toBe(Date.parse('2026-10-06T10:00:00Z'));
  });

  it('is derived on demand, never stored: no field carries it', () => {
    const s = story([article('2026-10-06T10:00:00Z')]);
    expect(Object.keys(s)).not.toContain('founding');
    expect(Object.keys(s)).not.toContain('newest');
  });

  it('is undefined for an empty or all-undated Story', () => {
    expect(foundingInstant(story([]))).toBeUndefined();
    expect(foundingInstant(story([article('not-a-date')]))).toBeUndefined();
  });

  it('ignores an unparseable date among dated ones', () => {
    expect(
      foundingInstant(
        story([article('not-a-date', 'a0'), article('2026-10-06T10:00:00Z')]),
      ),
    ).toBe(Date.parse('2026-10-06T10:00:00Z'));
  });
});

describe('newestInstant (ADR-0027)', () => {
  it('is the latest publishedAt among the Story’s Articles', () => {
    expect(
      newestInstant(
        story([
          article('2026-10-06T12:00:00Z', 'a2'),
          article('2026-10-06T10:00:00Z', 'a1'),
          article('2026-10-06T11:00:00Z', 'a3'),
        ]),
      ),
    ).toBe(Date.parse('2026-10-06T12:00:00Z'));
  });

  it('is undefined for an empty or all-undated Story', () => {
    expect(newestInstant(story([]))).toBeUndefined();
    expect(newestInstant(story([article('not-a-date')]))).toBeUndefined();
  });

  it('ignores an unparseable date among dated ones', () => {
    expect(
      newestInstant(
        story([article('not-a-date', 'a0'), article('2026-10-06T10:00:00Z')]),
      ),
    ).toBe(Date.parse('2026-10-06T10:00:00Z'));
  });
});
