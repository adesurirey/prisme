import type { Article, Section } from '@prisme/domain';

/**
 * The majority Section of a Story's Articles. Ties (equal counts) are broken
 * by the smallest Article id carrying the Section, so the result is stable
 * across builds regardless of article order.
 */
export function storySection(
  articles: Article[],
  sectionOf: (articleId: string) => Section | undefined,
): Section | undefined {
  const counts = new Map<Section, { n: number; minId: string }>();
  for (const article of articles) {
    const section = sectionOf(article.id);
    if (section == null) continue;
    const entry = counts.get(section);
    if (entry) {
      entry.n++;
      if (article.id < entry.minId) entry.minId = article.id;
    } else {
      counts.set(section, { n: 1, minId: article.id });
    }
  }
  let best: { section: Section; n: number; minId: string } | null = null;
  for (const [section, { n, minId }] of counts) {
    if (best == null || n > best.n || (n === best.n && minId < best.minId)) {
      best = { section, n, minId };
    }
  }
  return best?.section;
}

/**
 * Stable, readable slug for /sujet/<slug>: ASCII, lowercase, dashed.
 * Collision fallback appends a short, stable Story id (see grouping.ts).
 */
export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}
