import type { Article, Leaning, Outlet, Story } from './index.ts';
import { leaningOrder } from './index.ts';

/**
 * The Coverage and Blindspot rules (issue #6, revised by ADR-0011): Coverage
 * counts distinct Outlets per Coverage group from any Article they published
 * on the Story — news, live or Opinion. An Opinion piece shapes the Outlet's
 * readers just as much as a straight report, so it counts toward the
 * influence footprint; only not_news and unclassified Articles never count.
 * A Blindspot is a group with no Outlet at all on a Story reported by three
 * or more Outlets. Code and data keys are English; French UI labels live
 * with the UI.
 */

/**
 * The three buckets Coverage and Summaries work in, into which the five
 * Leaning bands are folded (issue #46, option B): centre-gauche counts as
 * gauche and centre-droite as droite. This fold is the grouping policy —
 * changing how Leanings regroup for Coverage and Summaries means changing
 * this one function and nothing else.
 */
export type CoverageGroup = 'gauche' | 'centre' | 'droite';

/** Coverage groups in their fixed display order (Gauche, Centre, Droite). */
export const coverageOrder: CoverageGroup[] = ['gauche', 'centre', 'droite'];

/** The fold from the five Leaning bands to the three Coverage groups. */
export function coverageGroup(leaning: Leaning): CoverageGroup {
  switch (leaning) {
    case 'gauche':
    case 'centre-gauche':
      return 'gauche';
    case 'centre':
      return 'centre';
    case 'centre-droite':
    case 'droite':
      return 'droite';
  }
}
/**
 * A Story is reported by Articles of these Kinds: news, live and Opinion
 * (ADR-0011). Only not_news and unclassified Articles never count.
 */
export function isReporting(article: Article): boolean {
  return (
    article.kind === 'news' ||
    article.kind === 'live' ||
    article.kind === 'opinion'
  );
}

/** The distinct Outlets reporting the Story, as ids — the Coverage basis. */
export function reportingOutletIds(articles: Article[]): Set<string> {
  const ids = new Set<string>();
  for (const article of articles) {
    if (isReporting(article)) ids.add(article.outletId);
  }
  return ids;
}

/** Coverage per group: distinct reporting Outlets, unknown Outlets ignored. */
export function coverageCounts(
  articles: Article[],
  outletById: Map<string, Outlet>,
): Record<CoverageGroup, number> {
  const counts: Record<CoverageGroup, number> = {
    gauche: 0,
    centre: 0,
    droite: 0,
  };
  for (const id of reportingOutletIds(articles)) {
    const leaning = outletById.get(id)?.leaning;
    if (leaning) counts[coverageGroup(leaning)] += 1;
  }
  return counts;
}

/** A group counts as a Blindspot only while both other groups report the Story. */
export function blindspots(
  counts: Record<CoverageGroup, number>,
): CoverageGroup[] {
  // No threshold on Outlets: what carries the signal is the two other
  // groups both being present — "tout le monde en parle sauf X". An
  // all-Centre Story gets no badges; Gauche and Droite being absent is not
  // news.
  return coverageOrder.filter(
    (leaning) =>
      counts[leaning] === 0 &&
      coverageOrder.every((other) => other === leaning || counts[other] > 0),
  );
}

/** The Article count shown as secondary detail: every Article (ADR-0011). */
export function countedArticles(articles: Article[]): number {
  return articles.length;
}

/** Outlets ever on the Front page for a Story: once per Outlet, Leaning band then config order. */
export function frontPageOutlets(
  articles: Article[],
  outlets: Outlet[],
): Outlet[] {
  const ever = new Set(
    articles.filter((a) => a.everFrontPage).map((a) => a.outletId),
  );
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
