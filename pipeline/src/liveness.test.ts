import type { Article, Story } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { isLive, LIVE_WINDOW_MS } from './liveness.ts';

const NOW = new Date('2026-10-07T14:00:00Z');

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
  createdAt: NOW.toISOString(),
  articles,
});

describe('LIVE_WINDOW_MS', () => {
  it('is exactly 24 hours', () => {
    expect(LIVE_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe('isLive', () => {
  it('is true for a Story with an Article just inside the window', () => {
    const fresh = new Date(NOW.getTime() - LIVE_WINDOW_MS + 1000);
    expect(isLive(story([article(fresh.toISOString())]), NOW)).toBe(true);
  });

  it('is false for a Story whose newest Article is just outside the window', () => {
    const stale = new Date(NOW.getTime() - LIVE_WINDOW_MS - 1000);
    expect(isLive(story([article(stale.toISOString())]), NOW)).toBe(false);
  });

  it('is true when any one Article is inside the window', () => {
    const stale = new Date(NOW.getTime() - LIVE_WINDOW_MS - 1000);
    const fresh = new Date(NOW.getTime() - 60_000);
    expect(
      isLive(
        story([
          article(stale.toISOString()),
          article(fresh.toISOString(), 'a2'),
        ]),
        NOW,
      ),
    ).toBe(true);
  });

  it('is false for an empty Story', () => {
    expect(isLive(story([]), NOW)).toBe(false);
  });

  it('is false for an unparseable date', () => {
    expect(isLive(story([article('not-a-date')]), NOW)).toBe(false);
  });
});
