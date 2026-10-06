import type { Article, Edition, Story } from '@prisme/domain';

/**
 * Temporary story logic for the tracer bullet (issue #3): each Article is its
 * own Story. Real grouping arrives in a later issue.
 */
export function buildEdition(articles: Article[], builtAt: Date): Edition {
  // Slugs must be stable across editions: never depend on article order.
  // Any base slug claimed by more than one article is suffixed (with the
  // article's stable id) for ALL of them, so a rerun cannot reshuffle which
  // article keeps the bare slug.
  const count = new Map<string, number>();
  for (const article of articles) {
    const base = slugify(article.headline) || 'sujet';
    count.set(base, (count.get(base) ?? 0) + 1);
  }
  const stories: Story[] = articles.map((article) => {
    const base = slugify(article.headline) || 'sujet';
    const slug = (count.get(base) ?? 0) > 1 ? `${base}-${article.id.slice(0, 6)}` : base;
    return { id: article.id, slug, title: article.headline, articles: [article] };
  });
  return { builtAt: builtAt.toISOString(), stories };
}

/**
 * Stable, readable slug for /sujet/<slug>: ASCII, lowercase, dashed.
 * Collision fallback appends a short, stable Article id.
 */
export function slugify(headline: string): string {
  return headline
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}
