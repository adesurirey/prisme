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
}: {
  article?: Article;
  outlet?: Outlet;
  className?: string;
  sizes?: string;
}) {
  const frame = className ?? '';
  if (!article?.imageUrl) {
    return (
      <span className={`flex items-center justify-center bg-line ${frame}`}>
        <PlaceholderMark />
      </span>
    );
  }
  const caption = outlet ? `Photo : ${outlet.name}` : undefined;
  return (
    <span className={`relative block overflow-hidden bg-line ${frame}`}>
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        <PlaceholderMark />
      </span>
      <img
        src={article.imageUrl}
        alt=""
        title={caption}
        sizes={sizes}
        className="relative h-full w-full object-cover"
        loading="lazy"
      />
    </span>
  );
}

function PlaceholderMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 22 21H2Z" fill="var(--faint)" opacity=".45" />
    </svg>
  );
}