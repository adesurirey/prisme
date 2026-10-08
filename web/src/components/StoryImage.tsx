import type { Article, Outlet } from '@prisme/domain';

/**
 * The Story image: hotlinked from the Outlet's feed — never stored (ADR-0003).
 * Which Article supplies it is decided by pickStoryImage (@prisme/domain).
 *
 * Static fallback (issue #6): the page is never hydrated, so a dead hotlink
 * cannot be handled in JS. The placeholder shape sits behind the image and
 * shows through when it fails to load — the row keeps its form.
 */
export default function StoryImage({
  article,
  outlet,
  className,
  sizes,
  eager,
}: {
  article?: Article;
  outlet?: Outlet;
  className?: string;
  sizes?: string;
  /** Hero usage: load without lazy-loading (above the fold). */
  eager?: boolean;
}) {
  const frame = className ?? '';
  if (!article?.imageUrl) {
    return (
      <span
        className={`@container flex items-center justify-center bg-line ${frame}`}
      >
        <PlaceholderMark />
      </span>
    );
  }
  const caption = outlet ? `Photo : ${outlet.name}` : undefined;
  return (
    <span
      className={`@container relative block overflow-hidden bg-line ${frame}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
      >
        <PlaceholderMark />
      </span>
      <img
        src={article.imageUrl}
        alt=""
        title={caption}
        sizes={sizes}
        className="relative h-full w-full object-cover"
        loading={eager ? 'eager' : 'lazy'}
        {...(eager ? { fetchpriority: 'high' } : {})}
      />
    </span>
  );
}

/**
 * The static mark shown while (or after) the hotlinked image fails: the
 * serif P from the wordmark (docs/brand.md) — bold, like the wordmark, and
 * small enough to read as a mark rather than a letter — in the faint token
 * at the triangle's former opacity. Sized in container-query units so the
 * same component reads right from the 96px card thumbnails to the
 * full-width Story hero.
 */
function PlaceholderMark() {
  return (
    <span
      aria-hidden="true"
      className="font-serif font-bold text-[var(--faint)] opacity-45"
      style={{ fontSize: '17cqw' }}
    >
      P
    </span>
  );
}
