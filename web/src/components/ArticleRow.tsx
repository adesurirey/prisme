import type { Article, Outlet } from '@prisme/domain';
import { LEANING_LABELS } from '@prisme/domain';
import { formatArticleDate } from '../article-date';
import PaywallBadge from './PaywallBadge';

/**
 * One Article's meta line: the Leaning as a bare colored dot (the group
 * heading already names the Leaning — the dot only keeps the color coding),
 * the Outlet name and the build-time Paris date (issue #27) — kept together
 * — and, right-aligned, the paywall badge next to the "Lire sur" link —
 * muted, with a hairline underline and a small ↗ that brighten on hover.
 *
 * When the Outlet is unknown (missing from the Outlet config) nothing is
 * inferred: the raw outlet id is shown without a dot rather than a guessed
 * Leaning.
 */
export default function ArticleRow({
  article,
  outlet,
}: {
  article: Article;
  outlet?: Outlet;
}) {
  const name = outlet?.name ?? article.outletId;
  const date = formatArticleDate(article.publishedAt);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {outlet && (
        <span
          aria-label={LEANING_LABELS[outlet.leaning]}
          className="inline-block size-2 self-center rounded-full"
          role="img"
          style={{ background: `var(--${outlet.leaning})` }}
          title={LEANING_LABELS[outlet.leaning]}
        />
      )}
      <span className="text-[14px] font-medium">{name}</span>
      {date && <span className="text-[13px] text-muted">{date}</span>}
      <span className="ml-auto flex items-baseline gap-3">
        {outlet && <PaywallBadge paywall={outlet.paywall} />}
        <a
          href={article.url}
          rel="noopener noreferrer"
          target="_blank"
          className="text-[13px] text-muted transition-colors hover:text-ink"
        >
          Lire
          <span aria-hidden="true" className="text-[11px]">
            {'\u00a0'}↗
          </span>
        </a>
      </span>
    </div>
  );
}
