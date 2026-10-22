import type { Story } from '@prisme/domain';

/**
 * The windows (ADR-0027, superseding ADR-0026's one-constant rule): what a
 * build collects from the feeds and how long a Story ingests are separate
 * product decisions, each with its own constant — the « one product
 * decision, one constant » equation of ADR-0026's era is gone.
 * `collect.ts`/`feeds.ts` (what a build collects) and `grouping.ts` (what
 * ingests) agree with this module by construction. The Edition's rolling
 * windows (ADR-0027) no longer read liveness: ranking.ts owns their lengths
 * as its own constants.
 *
 * The Ingestion window (ADR-0027, superseding ADR-0026's
 * `[founding, founding + 24h]`, itself superseding ADR-0017's
 * Publication-day + 06:00 grace window) is
 * `[founding, max(founding + 24h, newest + 12h)]` in instant arithmetic:
 * the founding instant is the earliest `publishedAt` among the Story's
 * Articles and the newest its latest — both derived on demand, never
 * stored. The floor term keeps ADR-0026's guarantee — every Story at least
 * one full day, evening Stories their overnight cycle; the silence term
 * extends the Story while coverage continues — each new Article buys
 * INGESTION_SILENCE_MS more hours — and a silence longer than that closes
 * the Story, permanently (ADR-0005): later coverage of the same event
 * births its Episode instead. No civil-date logic remains in the window
 * rule, so DST transitions cannot mis-time it; the Story day itself stays
 * a Europe/Paris day (paris-day.ts), fixed at creation for URLs, archive
 * pages and the Episode age window.
 */

/**
 * The collection window (ADR-0027): what a build gathers from the feeds —
 * the last 24 hours of Articles. `collect.ts`, `feeds.ts` and the grouping
 * resolver's fresh pool must agree on it by construction; it is decoupled
 * from the Ingestion window, which it fed by accident when one constant
 * served both.
 */
export const COLLECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * The Ingestion window's floor (ADR-0027): the window is never shorter
 * than `founding + INGESTION_FLOOR_MS` — ADR-0026's guarantee that every
 * Story keeps at least one full day. The pure-rolling alternative (12h
 * from the newest alone) was measured and rejected: it froze 252 of 339
 * Stories earlier than the capped rule it replaced.
 */
export const INGESTION_FLOOR_MS = 24 * 60 * 60 * 1000;

/**
 * The silence term (ADR-0027): each Article that joins keeps the window
 * open until `newest + INGESTION_SILENCE_MS` — coverage extends the
 * Story; a silence longer than that closes it (ADR-0005).
 */
export const INGESTION_SILENCE_MS = 12 * 60 * 60 * 1000;

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

/**
 * The instant the Ingestion window of `story` closes (ADR-0027):
 * `max(founding + INGESTION_FLOOR_MS, newest + INGESTION_SILENCE_MS)`, in
 * instant arithmetic — never shorter than founding + 24h. undefined when
 * the Story has no founding (no dated Article): no window at all.
 */
export function ingestionWindowClosesAt(
  story: Pick<Story, 'articles'>,
): number | undefined {
  const founding = foundingInstant(story);
  if (founding == null) return undefined;
  // The founding is the earliest of the dated instants, so at least one
  // dated Article exists and the newest instant is defined whenever the
  // founding is.
  const newest = newestInstant(story)!;
  return Math.max(founding + INGESTION_FLOOR_MS, newest + INGESTION_SILENCE_MS);
}

/**
 * True while the Story still accepts Articles (ADR-0027):
 * `founding ≤ now ≤ max(founding + 24h, newest + 12h)` — open at birth,
 * sharp exit at the close.
 */
export function ingestionIsOpen(
  story: Pick<Story, 'articles'>,
  now: Date,
): boolean {
  const founding = foundingInstant(story);
  const close = ingestionWindowClosesAt(story);
  if (founding == null || close == null) return false;
  const t = now.getTime();
  return t >= founding && t <= close;
}

/**
 * The belonging rule (ADR-0026, extended by ADR-0027): an Article may join
 * the Story iff its `publishedAt` falls inside the Story's Ingestion
 * window — strictly, with no pre-founding Articles, up to the close
 * `max(founding + 24h, newest + 12h)`; an Article that joins in the
 * silence regime extends the window 12 hours past itself.
 */
export function joinsIngestionWindow(
  story: Pick<Story, 'articles'>,
  publishedAt: string,
): boolean {
  const founding = foundingInstant(story);
  const close = ingestionWindowClosesAt(story);
  if (founding == null || close == null) return false;
  const t = parseInstant(publishedAt);
  return t != null && t >= founding && t <= close;
}

/**
 * True when the Story is Live (GLOSSARY): its Ingestion window is open —
 * at most 12 hours since its newest Article, once that is later than 24
 * hours from the founding (ADR-0027).
 */
export function isLive(story: Story, now: Date): boolean {
  return ingestionIsOpen(story, now);
}
