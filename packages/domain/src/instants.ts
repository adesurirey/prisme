import type { Story } from './index.ts';

/** The UTC instant of an ISO date, or undefined when it does not parse —
 * the one parse-and-guard every instant computation goes through. */
export function parseInstant(iso: string): number | undefined {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : t;
}

/**
 * The founding instant of a Story (ADR-0026): the earliest `publishedAt`
 * among its Articles. Under the strict membership rule no Article precedes
 * it, so it equals the founding (seed) Article's instant and is stable for
 * the Story's life. Returns undefined when the Story holds no dated Article
 * (an empty or undated file): an undefined founding has no window — nothing
 * is live, nothing may join.
 */
export function foundingInstant(
  story: Pick<Story, 'articles'>,
): number | undefined {
  let min: number | undefined;
  for (const article of story.articles) {
    const t = parseInstant(article.publishedAt);
    if (t != null && (min === undefined || t < min)) min = t;
  }
  return min;
}

/**
 * The newest instant of a Story (ADR-0027): the latest `publishedAt` among
 * its Articles — the instant the silence term runs from. Derived on
 * demand, never stored, like the founding instant. Returns undefined when
 * the Story holds no dated Article.
 */
export function newestInstant(
  story: Pick<Story, 'articles'>,
): number | undefined {
  let max: number | undefined;
  for (const article of story.articles) {
    const t = parseInstant(article.publishedAt);
    if (t != null && (max === undefined || t > max)) max = t;
  }
  return max;
}
