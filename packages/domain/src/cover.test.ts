import { describe, expect, it } from 'vitest';
import { pickStoryImage } from './cover.ts';
import type { Article, Outlet, Story } from './index.ts';

/**
 * The cover rule (cover.ts): the freshest news/live Article with an image
 * wins, ties by id. No Leaning, no quality rating.
 */

function article(id: string, overrides: Partial<Article> = {}): Article {
  return {
    id,
    outletId: 'lemonde',
    headline: `Titre ${id}`,
    url: `https://lemonde.fr/a/${id}`,
    publishedAt: '2026-10-06T10:00:00Z',
    frontPage: false,
    kind: 'news',
    ...overrides,
  };
}

const outlets: Outlet[] = [];
const byId = new Map(outlets.map((o) => [o.id, o]));

function story(articles: Article[]): Story {
  return {
    id: 'story1',
    slug: 'sujet',
    title: 'Sujet',
    createdAt: '2026-10-06T10:00:00Z',
    articles,
  };
}

const at = (hour: number) =>
  `2026-10-06T${String(hour).padStart(2, '0')}:00:00Z`;

describe('pickStoryImage', () => {
  it('the newest candidate wins, whatever its URL', () => {
    const articles = [
      article('old', {
        imageUrl: 'https://x.fr/a.jpg',
        publishedAt: at(9),
      }),
      article('new', {
        imageUrl: 'https://x.fr/b.jpg',
        publishedAt: at(14),
      }),
    ];
    expect(pickStoryImage(story(articles), byId)?.id).toBe('new');
  });

  it('a poor-image Outlet is last resort, whatever its freshness', () => {
    const articles = [
      article('tv-new', {
        outletId: 'bfmtv',
        imageUrl: 'https://x.fr/still.jpg',
        publishedAt: at(14),
      }),
      article('print-old', {
        imageUrl: 'https://x.fr/a.jpg',
        publishedAt: at(2),
      }),
    ];
    expect(pickStoryImage(story(articles), byId)?.id).toBe('print-old');
  });

  it('a poor-image Outlet wins when nothing else offers an image', () => {
    const articles = [
      article('tv-only', {
        outletId: 'bfmtv',
        imageUrl: 'https://x.fr/still.jpg',
        publishedAt: at(14),
      }),
    ];
    expect(pickStoryImage(story(articles), byId)?.id).toBe('tv-only');
  });

  it('an editorial never supplies the image (ADR-0011)', () => {
    const articles = [
      article('opinion', {
        kind: 'opinion',
        imageUrl: 'https://x.fr/op.jpg',
        publishedAt: at(14),
      }),
      article('news', {
        imageUrl: 'https://x.fr/news.jpg',
        publishedAt: at(10),
      }),
    ];
    expect(pickStoryImage(story(articles), byId)?.id).toBe('news');
  });

  it('not_news Articles are never candidates', () => {
    const articles = [
      article('not-news', {
        kind: 'not_news',
        imageUrl: 'https://x.fr/n.jpg',
        publishedAt: at(14),
      }),
      article('plain', {
        imageUrl: 'https://x.fr/y.jpg',
        publishedAt: at(12),
      }),
    ];
    expect(pickStoryImage(story(articles), byId)?.id).toBe('plain');
  });

  it('returns undefined when no Article has an image', () => {
    expect(pickStoryImage(story([article('a')]), byId)).toBeUndefined();
  });

  it('same-time ties break by id', () => {
    const articles = [
      article('zz', { imageUrl: 'https://x.fr/z.jpg', publishedAt: at(10) }),
      article('aa', { imageUrl: 'https://x.fr/a.jpg', publishedAt: at(10) }),
    ];
    expect(pickStoryImage(story(articles), byId)?.id).toBe('aa');
  });
});
