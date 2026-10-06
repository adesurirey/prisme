import type { Article, Leaning, Outlet, Story } from '@prisme/domain';
import { leaningOrder } from './CoverageBar';

const leaningRank: Record<Leaning, number> = { centre: 0, gauche: 1, droite: 2 };

/**
 * The image shown for a Story: prefer a Centre Outlet's Article, otherwise
 * the Leaning with the most Coverage (PRD). Ties keep the earliest Article.
 * The image is hotlinked from the Outlet — never stored (ADR-0003).
 */
export function pickStoryImage(story: Story, leaningOf: (outletId: string) => Leaning | undefined) {
  const withImage = story.articles.filter((a) => a.imageUrl);
  if (withImage.length === 0) return undefined;
  const score = (a: Article) => {
    const leaning = leaningOf(a.outletId);
    return leaning ? leaningRank[leaning] : 3;
  };
  return withImage.reduce((best, a) => (score(a) < score(best) ? a : best), withImage[0]);
}

export default function StoryImage({
  article,
  outlet,
  className,
  sizes,
}: {
  article?: Article;
  outlet?: Outlet;
  className?: string;
  sizes?: string;
}) {
  const frame = className ?? '';
  if (!article?.imageUrl) {
    // Quiet placeholder so rows without an image keep the same shape.
    return (
      <span className={`flex items-center justify-center bg-line ${frame}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 22 21H2Z" fill="var(--faint)" opacity=".45" />
        </svg>
      </span>
    );
  }
  return (
    <img
      src={article.imageUrl}
      alt=""
      loading="lazy"
      decoding="async"
      sizes={sizes}
      className={`bg-line object-cover ${frame}`}
    />
  );
}