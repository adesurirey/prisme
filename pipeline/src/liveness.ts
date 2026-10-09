import type { Story } from '@prisme/domain';

/**
 * The 24h window (ADR-0009): how long an Edition keeps collecting Articles,
 * and how long a Story stays Live. One product decision, one constant —
 * `collect.ts` (what a build collects) and `grouping.ts`/`frontpage.ts`
 * (what stays publishable) must agree on it by construction.
 */
export const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

function published(date: string): number {
  const t = Date.parse(date);
  return Number.isNaN(t) ? 0 : t;
}

/** True when the Story still has an Article inside the 24h window. */
export function isLive(story: Story, now: Date): boolean {
  const cutoff = now.getTime() - LIVE_WINDOW_MS;
  return story.articles.some((a) => published(a.publishedAt) > cutoff);
}
