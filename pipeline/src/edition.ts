import type { Article, Edition, Section, Story } from '@prisme/domain';

/**
 * Temporary story logic for the tracer bullet (issue #3): each Article is its
 * own Story. Real grouping arrives in a later issue.
 *
 * `sectionOf` supplies each Article's Section (from the classification cache);
 * the Story's Section is the majority of its Articles' Sections, ties broken
 * deterministically by Article id — never by article order.
 */
export function buildEdition(
  articles: Article[],
  builtAt: Date,
  sectionOf?: (articleId: string) => Section | undefined,
): Edition {
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
    return {
      id: article.id,
      slug,
      title: article.headline,
      articles: [article],
      ...(sectionOf ? { section: storySection([article], sectionOf) } : {}),
    };
  });
  return { builtAt: builtAt.toISOString(), stories };
}

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
    if (
      best == null ||
      n > best.n ||
      (n === best.n && minId < best.minId)
    ) {
      best = { section, n, minId };
    }
  }
  return best?.section;
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
