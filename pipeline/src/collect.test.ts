import type { Outlet } from '@prisme/domain';
import { describe, expect, it } from 'vitest';
import { collect, type Fetcher } from './collect.ts';

const NOW = new Date('2026-10-07T14:00:00Z');

const outlet = (feeds: Outlet['feeds']): Outlet => ({
  id: 'le-parisien',
  name: 'Le Parisien',
  leaning: 'centre',
  paywall: 'partial',
  site: 'https://www.leparisien.fr',
  feeds,
});

const fetcher =
  (feeds: Record<string, string>): Fetcher =>
  async (url) => {
    const xml = feeds[url];
    if (xml == null) throw new Error(`unexpected fetch: ${url}`);
    return xml;
  };

let counter = 0;

/** An undated RSS channel: title and link only, like Le Parisien's feeds. */
const undatedFeed = (
  urls: string[],
  lastBuildDate?: string,
): string => `<?xml version="1.0"?>
  <rss version="2.0"><channel>
    ${lastBuildDate ? `<lastBuildDate>${lastBuildDate}</lastBuildDate>` : ''}
    ${urls
      .map(
        (url) =>
          `<item><title>Titre ${++counter}</title><link>${url}</link></item>`,
      )
      .join('\n    ')}
  </channel></rss>`;

const LATEST = 'https://feeds.leparisien.fr/leparisien/rss';
const UNE = 'https://feeds.leparisien.fr/leparisien/rss/une';

const parisienUrl = (day: string, n: number) =>
  `https://www.leparisien.fr/section/histoire-${day}-ABC${String(n).padStart(3, '0')}.php`;

describe('collect — Undated Articles (ADR-0007)', () => {
  it('collects undated articles dated to their Publication day from the URL', async () => {
    const feed = undatedFeed([
      parisienUrl('07-10-2026', 1),
      parisienUrl('07-10-2026', 2),
    ]);

    const { articles } = await collect(
      [outlet({ latest: LATEST })],
      fetcher({ [LATEST]: feed }),
      NOW,
    );

    expect(articles).toHaveLength(2);
    expect(articles[0].publishedAt).toBe('2026-10-07T21:59:59.000Z');
    expect(articles[0].dayPrecision).toBe(true);
  });

  it('caps the latest feed at the 20 most recent items, in feed order for undated feeds', async () => {
    const urls = Array.from({ length: 25 }, (_, i) =>
      parisienUrl('07-10-2026', i),
    );
    const { articles } = await collect(
      [outlet({ latest: LATEST })],
      fetcher({
        [LATEST]: undatedFeed(urls, 'Wed, 07 Oct 2026 13:00:00 +0200'),
      }),
      NOW,
    );

    expect(articles).toHaveLength(20);
    const kept = new Set(articles.map((a) => a.url));
    // The first 20 feed items survive; the tail does not.
    expect(kept.has(urls[0])).toBe(true);
    expect(kept.has(urls[19])).toBe(true);
    expect(kept.has(urls[20])).toBe(false);
  });

  it('drops articles whose Publication day is outside the 24h window', async () => {
    const { articles } = await collect(
      [outlet({ latest: LATEST })],
      fetcher({
        [LATEST]: undatedFeed([
          parisienUrl('07-10-2026', 1),
          parisienUrl('04-10-2026', 2),
        ]),
      }),
      NOW,
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe(parisienUrl('07-10-2026', 1));
  });

  it('dates URL-less undated items at collection time while the feed is fresh', async () => {
    const { articles } = await collect(
      [outlet({ latest: LATEST })],
      fetcher({
        [LATEST]: undatedFeed(
          ['https://www.leparisien.fr/etudiant/histoire-ABC123.php'],
          'Wed, 07 Oct 2026 13:00:00 +0200',
        ),
      }),
      NOW,
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].publishedAt).toBe('2026-10-07T14:00:00.000Z');
    expect(articles[0].dayPrecision).toBe(true);
  });

  it('drops undated items when the feed is stale, and logs a failure', async () => {
    const { articles, failures } = await collect(
      [outlet({ latest: LATEST })],
      fetcher({
        [LATEST]: undatedFeed(
          ['https://www.leparisien.fr/etudiant/histoire-ABC123.php'],
          'Sun, 04 Oct 2026 13:00:00 +0200',
        ),
      }),
      NOW,
    );

    expect(articles).toHaveLength(0);
    expect(failures).toHaveLength(1);
    expect(failures[0].outletId).toBe('le-parisien');
  });

  it('keeps URL-dated articles even when the feed is stale', async () => {
    const { articles, failures } = await collect(
      [outlet({ latest: LATEST })],
      fetcher({
        [LATEST]: undatedFeed(
          [parisienUrl('07-10-2026', 1)],
          'Sun, 04 Oct 2026 13:00:00 +0200',
        ),
      }),
      NOW,
    );

    expect(failures).toHaveLength(0);
    expect(articles).toHaveLength(1);
  });
});

describe('collect — Front page is declared, never inferred (ADR-0008)', () => {
  it('marks front page only for une-feed articles; latest-feed articles stay unflagged', async () => {
    const { articles } = await collect(
      [outlet({ une: UNE, latest: LATEST })],
      fetcher({
        [UNE]: undatedFeed([parisienUrl('07-10-2026', 1)]),
        [LATEST]: undatedFeed([parisienUrl('07-10-2026', 2)]),
      }),
      NOW,
    );

    const byUrl = new Map(articles.map((a) => [a.url, a]));
    expect(byUrl.get(parisienUrl('07-10-2026', 1))?.frontPage).toBe(true);
    expect(byUrl.get(parisienUrl('07-10-2026', 2))?.frontPage).toBe(false);
  });

  it('prefers the une-feed copy when an article appears in both feeds', async () => {
    const url = parisienUrl('07-10-2026', 1);
    const { articles } = await collect(
      [outlet({ une: UNE, latest: LATEST })],
      fetcher({
        [UNE]: undatedFeed([url]),
        [LATEST]: undatedFeed([url]),
      }),
      NOW,
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].frontPage).toBe(true);
  });
});
