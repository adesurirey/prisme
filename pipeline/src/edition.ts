import type { Article, Edition, Story } from '@prisme/domain';

/**
 * Temporary story logic for the tracer bullet (issue #3): each Article is its
 * own Story. Real grouping arrives in a later issue.
 */
export function buildEdition(articles: Article[], builtAt: Date): Edition {
  const used = new Set<string>();
  const stories: Story[] = articles.map((article) => {
    const base = slugify(article.headline) || 'sujet';
    const slug = used.has(base) ? `${base}-${article.id.slice(0, 6)}` : base;
    used.add(slug);
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
