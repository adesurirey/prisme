import type { Article, Leaning, Outlet, Story } from './index.ts';

/**
 * The Coverage and Blindspot rules (issue #6, glossary): Coverage counts
 * distinct reporting Outlets per Leaning — never Articles, never Opinion
 * pieces — and a Blindspot is a Leaning with no reporting Outlet on a Story
 * reported by three or more Outlets. Code and data keys are English; French
 * UI labels live with the UI.
 */

/** Leanings in their fixed display order (Gauche, Centre, Droite). */
export const leaningOrder: Leaning[] = ['gauche', 'centre', 'droite'];
/** A Story is reported by Articles of these Kinds; Opinion pieces never count. */
export function isReporting(article: Article): boolean {
  return article.kind === 'news' || article.kind === 'live';
}

/** The distinct Outlets reporting the Story, as ids — the Coverage basis. */
export function reportingOutletIds(articles: Article[]): Set<string> {
  const ids = new Set<string>();
  for (const article of articles) {
    if (isReporting(article)) ids.add(article.outletId);
  }
  return ids;
}

/** Coverage per Leaning: distinct reporting Outlets, unknown Outlets ignored. */
export function coverageCounts(
  articles: Article[],
  outletById: Map<string, Outlet>,
): Record<Leaning, number> {
  const counts: Record<Leaning, number> = { gauche: 0, centre: 0, droite: 0 };
  for (const id of reportingOutletIds(articles)) {
    const leaning = outletById.get(id)?.leaning;
    if (leaning) counts[leaning] += 1;
  }
  return counts;
}

/** A Leaning counts as a Blindspot only while both other Leanings report the Story. */
export function blindspots(counts: Record<Leaning, number>): Leaning[] {
  // No threshold on Outlets: what carries the signal is the two other
  // Leanings both being present — "tout le monde en parle sauf X". An
  // all-Centre Story gets no badges; Gauche and Droite being absent is not
  // news.
  return leaningOrder.filter(
    (leaning) =>
      counts[leaning] === 0 &&
      leaningOrder.every((other) => other === leaning || counts[other] > 0),
  );
}

/** The Article count shown as secondary detail: every Article but Opinion. */
export function countedArticles(articles: Article[]): number {
  return articles.filter((article) => article.kind !== 'opinion').length;
}

/** Outlets ever on the Front page for a Story: once per Outlet, Leaning then config order. */
export function frontPageOutlets(articles: Article[], outlets: Outlet[]): Outlet[] {
  const ever = new Set(articles.filter((a) => a.everFrontPage).map((a) => a.outletId));
  const configOrder = new Map(outlets.map((o, i) => [o.id, i]));
  return outlets
    .filter((o) => ever.has(o.id))
    .sort(
      (a, b) =>
        leaningOrder.indexOf(a.leaning) - leaningOrder.indexOf(b.leaning) ||
        (configOrder.get(a.id) ?? 0) - (configOrder.get(b.id) ?? 0),
    );
}

function newestFirstTie(a: Article, b: Article): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Articles sorted by publication time descending, ties by id — the shared
 * recency order for display and image picking.
 */
export function newestFirst(a: Article, b: Article): number {
  const ta = Date.parse(a.publishedAt) || 0;
  const tb = Date.parse(b.publishedAt) || 0;
  return tb - ta || newestFirstTie(a, b);
}

/**
 * The image shown for a Story: prefer a Centre Outlet's Article, otherwise the
 * Leaning with the most Coverage, walking Coverage tiers in order; a
 * Gauche/Droite tie is left to recency, whatever the Leaning. Within a
 * Leaning, the newest Article with an image wins; ties break by id. The image
 * is hotlinked from the Outlet — never stored (ADR-0003).
 */
export function pickStoryImage(
  story: Story,
  outletById: Map<string, Outlet>,
): Article | undefined {
  const candidates = story.articles.filter((a) => a.imageUrl).sort(newestFirst);
  if (candidates.length === 0) return undefined;

  const centre = candidates.find((a) => outletById.get(a.outletId)?.leaning === 'centre');
  if (centre) return centre;

  // Coverage tiers, highest first; the first tier with an image candidate wins.
  const counts = coverageCounts(story.articles, outletById);
  const tiers = [...new Set(leaningOrder.map((l) => counts[l]))].sort((a, b) => b - a);
  for (const tier of tiers) {
    const leanings = leaningOrder.filter((l) => counts[l] === tier);
    const inTier = candidates.filter((a) => {
      const leaning = outletById.get(a.outletId)?.leaning;
      return leaning != null && leanings.includes(leaning);
    });
    // A tie between Leanings is left to recency: the newest candidate wins.
    if (inTier.length > 0) return inTier[0];
  }
  // No configured Leaning carries an image (only unknown Outlets do).
  return candidates[0];
}