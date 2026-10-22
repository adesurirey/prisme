import type { Story } from '@prisme/domain';

/**
 * The 24h window (ADR-0009 × ADR-0026): how long a build collects, how long
 * a Story ingests, and how long it stays Live — one product decision, one
 * constant. `collect.ts`/`feeds.ts` (what a build collects) and
 * `grouping.ts` (what ingests) must agree on it by construction. The
 * Edition's rolling windows (ADR-0027) no longer read liveness: ranking.ts
 * owns their lengths as its own constants.
 *
 * The Ingestion window (ADR-0026, superseding ADR-0017's Publication-day +
 * 06:00 grace window) is `[founding, founding + 24h]` in instant arithmetic,
 * where the founding instant is the earliest `publishedAt` among the Story's
 * Articles — derived on demand, never stored. No civil-date logic remains in
 * the window rule, so DST transitions cannot mis-time it; the Story day
 * itself stays a Europe/Paris day (paris-day.ts), fixed at creation for
 * URLs, archive pages and the Episode age window.
 */
export const LIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

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
 * The instant the Ingestion window founded at `founding` closes:
 * founding + 24h, instant arithmetic.
 */
export function ingestionWindowClosesAt(founding: number): number {
  return founding + LIVE_WINDOW_MS;
}

/**
 * True while the Story founded at `founding` still accepts Articles:
 * `founding ≤ now ≤ founding + 24h` — open at birth, sharp exit at the
 * close (a Story can never sit on la Une beyond 24 hours of age).
 */
export function ingestionIsOpen(founding: number, now: Date): boolean {
  const t = now.getTime();
  return t >= founding && t <= ingestionWindowClosesAt(founding);
}

/**
 * The belonging rule (ADR-0026): an Article may join the Story founded at
 * `founding` iff its `publishedAt` falls inside the window — strictly, with
 * no pre-founding Articles.
 */
export function joinsIngestionWindow(
  founding: number,
  publishedAt: string,
): boolean {
  const t = parseInstant(publishedAt);
  return t != null && t >= founding && t <= ingestionWindowClosesAt(founding);
}

/**
 * True when the Story is Live (GLOSSARY): its Ingestion window is open.
 * A window-open Story's Articles are all less than 24 hours old by
 * construction — none precedes the founding, which is itself at most 24
 * hours old — so the two formulations of the Live Story definition agree.
 */
export function isLive(story: Story, now: Date): boolean {
  const founding = foundingInstant(story);
  return founding != null && ingestionIsOpen(founding, now);
}
