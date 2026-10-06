import { createHash } from 'node:crypto';
import type { Article, Outlet } from '@prisme/domain';
import { parseFeed } from './feeds.ts';

/** The 24h window of Articles an Edition keeps. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;

/** How many Articles from a latest feed count as the Front page. */
const FRONT_PAGE_FALLBACK = 10;

export type Fetcher = (url: string) => Promise<string>;

export interface CollectedArticles {
  articles: Article[];
  /** Outlets whose feeds could not be fetched or parsed. */
  failures: { outletId: string; feed: string; reason: string }[];
}

/**
 * Fetch every Outlet's feeds and collect the last-24h Articles, marking the
 * Front page (une feed, otherwise the 10 most recent). One failing feed is
 * logged and skipped — it must not fail the collection (issue #3).
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
  return {
    articles: results.flat().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    failures,
  };
}

async function collectOutlet(
  outlet: Outlet,
  fetcher: Fetcher,
  now: Date,
  failures: CollectedArticles['failures'],
): Promise<Article[]> {
  const articles: Article[] = [];
  if (outlet.feeds.une) {
    const parsed = await fetchAndParse(outlet, outlet.feeds.une, fetcher, failures);
    articles.push(...parsed.map((item) => toArticle(item, outlet, true)));
  }
  if (outlet.feeds.latest) {
    const parsed = await fetchAndParse(outlet, outlet.feeds.latest, fetcher, failures);
    const recent = [...parsed]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, FRONT_PAGE_FALLBACK);
    articles.push(...recent.map((item) => toArticle(item, outlet, outlet.feeds.une == null)));
  }
  // An Article can appear in both feeds: keep one, preferring Front-page.
  const byId = new Map<string, Article>();
  for (const article of articles) {
    const kept = byId.get(article.id);
    if (!kept || (!kept.frontPage && article.frontPage)) byId.set(article.id, article);
  }
  return [...byId.values()].filter((article) => {
    if (article.publishedAt === '') return false;
    return now.getTime() - Date.parse(article.publishedAt) <= WINDOW_MS;
  });
}

async function fetchAndParse(
  outlet: Outlet,
  feed: string,
  fetcher: Fetcher,
  failures: CollectedArticles['failures'],
) {
  try {
    return parseFeed(await fetcher(feed));
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.warn(`Feed failed: ${outlet.id} ${feed} — ${message}`);
    failures.push({ outletId: outlet.id, feed, reason: message });
    return [];
  }
}

function toArticle(
  item: { headline: string; url: string; publishedAt: string; imageUrl?: string },
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
  };
}

/** Stable across editions: a hash of the canonical URL. */
export function articleId(url: string): string {
  return createHash('sha1').update(url).digest('hex').slice(0, 12);
}
