import { createHash } from 'node:crypto';
import type { Article, Outlet } from '@prisme/domain';
import { type ParsedFeed, type ParsedItem, parseFeed } from './feeds.ts';

/** The 24h window of Articles an Edition keeps. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * How many of the most recent Articles a latest feed may contribute — a cost
 * knob on classification and grouping, not a Front-page claim (ADR-0008).
 */
export const MAX_LATEST_ARTICLES = 20;

export type Fetcher = (url: string) => Promise<string>;

export interface CollectedArticles {
  articles: Article[];
  /**
   * article id → teaser, in memory only (ADR-0003): the Decision model reads
   * the teaser at classification time; it is never serialized or written.
   */
  teasers: Map<string, string>;
  /** Outlets whose feeds could not be fetched or parsed. */
  failures: { outletId: string; feed: string; reason: string }[];
}

/**
 * Fetch every Outlet's feeds and collect the last-24h Articles, marking the
 * Front page — only from a une feed, never inferred (ADR-0008). One failing
 * feed is logged and skipped — it must not fail the collection (issue #3).
 */
export async function collect(
  outlets: Outlet[],
  fetcher: Fetcher,
  now: Date,
): Promise<CollectedArticles> {
  const failures: CollectedArticles['failures'] = [];
  const results = await Promise.all(
    outlets.map((outlet) => collectOutlet(outlet, fetcher, now, failures)),
  );
  const teasers = new Map<string, string>();
  for (const { articles, teasers: outletTeasers } of results) {
    for (const article of articles) {
      const teaser = outletTeasers.get(article.id);
      if (teaser != null && !teasers.has(article.id))
        teasers.set(article.id, teaser);
    }
  }
  return {
    articles: results
      .flatMap((r) => r.articles)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    teasers,
    failures,
  };
}

async function collectOutlet(
  outlet: Outlet,
  fetcher: Fetcher,
  now: Date,
  failures: CollectedArticles['failures'],
): Promise<{ articles: Article[]; teasers: Map<string, string> }> {
  const teasers = new Map<string, string>();
  const articles: Article[] = [];
  if (outlet.feeds.une) {
    const { items, updatedAt } = await fetchAndParse(
      outlet,
      outlet.feeds.une,
      fetcher,
      failures,
    );
    const dated = dateUndatedItems(
      outlet,
      outlet.feeds.une,
      items,
      updatedAt,
      now,
      failures,
    );
    for (const item of dated) {
      const article = toArticle(item, outlet, true);
      articles.push(article);
      teasers.set(article.id, item.teaser);
    }
  }
  if (outlet.feeds.latest) {
    const { items, updatedAt } = await fetchAndParse(
      outlet,
      outlet.feeds.latest,
      fetcher,
      failures,
    );
    const dated = dateUndatedItems(
      outlet,
      outlet.feeds.latest,
      items,
      updatedAt,
      now,
      failures,
    );
    const recent = [...dated]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, MAX_LATEST_ARTICLES);
    for (const item of recent) {
      const article = toArticle(item, outlet, false);
      articles.push(article);
      teasers.set(article.id, item.teaser);
    }
  }
  // An Article can appear in both feeds: keep one, preferring Front-page.
  const byId = new Map<string, Article>();
  for (const article of articles) {
    const kept = byId.get(article.id);
    if (!kept || (!kept.frontPage && article.frontPage))
      byId.set(article.id, article);
  }
  const keptArticles = [...byId.values()].filter(
    (article) => now.getTime() - Date.parse(article.publishedAt) <= WINDOW_MS,
  );
  const keptIds = new Set(keptArticles.map((a) => a.id));
  const keptTeasers = new Map([...teasers].filter(([id]) => keptIds.has(id)));
  return { articles: keptArticles, teasers: keptTeasers };
}

async function fetchAndParse(
  outlet: Outlet,
  feed: string,
  fetcher: Fetcher,
  failures: CollectedArticles['failures'],
): Promise<ParsedFeed> {
  try {
    return parseFeed(await fetcher(feed));
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.warn(`Feed failed: ${outlet.id} ${feed} — ${message}`);
    failures.push({ outletId: outlet.id, feed, reason: message });
    return { items: [], updatedAt: '' };
  }
}

/**
 * Undated Articles the parser could not even day-date (ADR-0007): date them
 * at collection time while the feed itself is fresh; once the feed is stale,
 * that guess would freeze old headlines into the Edition, so drop them.
 */
function dateUndatedItems(
  outlet: Outlet,
  feed: string,
  items: ParsedItem[],
  updatedAt: string,
  now: Date,
  failures: CollectedArticles['failures'],
): ParsedItem[] {
  const fresh =
    updatedAt !== '' && now.getTime() - Date.parse(updatedAt) <= WINDOW_MS;
  const undated = items.filter((item) => item.publishedAt === '').length;
  if (undated === 0) return items;
  if (!fresh) {
    failures.push({
      outletId: outlet.id,
      feed,
      reason: `Stale feed (${updatedAt || 'no build date'}): ${undated} undated article(s) dropped`,
    });
    return items.filter((item) => item.publishedAt !== '');
  }
  return items.map((item) =>
    item.publishedAt !== ''
      ? item
      : {
          ...item,
          publishedAt: now.toISOString(),
          dayPrecision: true as const,
        },
  );
}

function toArticle(
  item: ParsedItem,
  outlet: Outlet,
  frontPage: boolean,
): Article {
  return {
    id: articleId(item.url),
    outletId: outlet.id,
    headline: item.headline,
    url: item.url,
    publishedAt: item.publishedAt,
    imageUrl: item.imageUrl,
    frontPage,
    ...(item.dayPrecision ? { dayPrecision: true as const } : {}),
  };
}

/** Stable across editions: a hash of the canonical URL. */
export function articleId(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 12);
}
