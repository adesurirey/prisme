import type { Article, Outlet } from '@prisme/domain';
import { formatArticleDate } from '../article-date';

/**
 * One Article's text column inside the clickable Article card (issue #27):
 * the headline is the card's title — it must read as the main element, ahead
 * of the Outlet name, which sits in the muted meta line below with the
 * build-time Paris date. The headline is omitted when it repeats the Story
 * title (split Stories take the founding headline; showing it twice adds
 * nothing). The link, hover surface and image live on the card itself —
 * see ArticleList; the paywall notice is a hover chip on the image.
 */
export default function ArticleRow({
  article,
  outlet,
  headline,
}: {
  article: Article;
  outlet?: Outlet;
  /** The headline to show, or undefined when it repeats the Story title. */
  headline?: string;
}) {
  const name = outlet?.name ?? article.outletId;
  const date = formatArticleDate(article.publishedAt);
  return (
    <div className="min-w-0 flex-1">
      {headline && (
        <p className="text-[15px] font-medium leading-snug tracking-[-0.01em]">
          {headline}
        </p>
      )}
      <p
        className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[13px] text-muted ${
          headline ? 'mt-1' : ''
        }`}
      >
        <span>{name}</span>
        {date && <span>{date}</span>}
      </p>
    </div>
  );
}
