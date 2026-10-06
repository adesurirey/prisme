import type { Article, Outlet } from '@prisme/domain';

/**
 * The Story image: hotlinked from the Outlet's feed — never stored (ADR-0003).
 * Which Article supplies it is decided by pickStoryImage (@prisme/domain).
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
    // Quiet placeholder so rows without an image keep the same shape.
    return (
      <span className={`flex items-center justify-center bg-line ${frame}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3 22 21H2Z" fill="var(--faint)" opacity=".45" />
        </svg>
      </span>
    );
  }
  const caption = outlet ? `Photo : ${outlet.name}` : undefined;
  return (
    <img
      src={article.imageUrl}
      alt={caption ?? ''}
      title={caption}
      sizes={sizes}
      className={`object-cover ${frame}`}
      loading="lazy"
      onError={(event) => {
        // A dead hotlink falls back cleanly to the placeholder shape.
        const img = event.currentTarget;
        const placeholder = document.createElement('span');
        placeholder.className = `flex items-center justify-center bg-line ${frame}`;
        placeholder.setAttribute('aria-hidden', 'true');
        img.replaceWith(placeholder);
      }}
    />
  );
}