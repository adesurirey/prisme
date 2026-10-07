import { newestFirst } from './coverage.ts';
import type { Article } from './index.ts';

/**
 * The Story page's per-Leaning list, one row per Outlet (issue #27): each
 * Outlet shows its freshest Article — whatever its Kind, as today's list
 * shows every Article — and the Outlet's remaining Articles are the
 * follow-ups revealed by "Voir les N autres articles de ces médias". Both
 * lists share the recency order (newestFirst, ties by id).
 */
export interface OutletSplit {
  /** The freshest Article of each Outlet, newest first. */
  head: Article[];
  /** Every other Article, newest first. */
  followUps: Article[];
}

/** Freshest Article per Outlet vs. the rest, both newest first. */
export function splitPerOutlet(articles: Article[]): OutletSplit {
  const sorted = [...articles].sort(newestFirst);
  const head: Article[] = [];
  const seen = new Set<string>();
  const followUps: Article[] = [];
  for (const article of sorted) {
    if (seen.has(article.outletId)) {
      followUps.push(article);
    } else {
      seen.add(article.outletId);
      head.push(article);
    }
  }
  return { head, followUps };
}
