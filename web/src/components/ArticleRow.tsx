import type { Article, Outlet } from '@prisme/domain';
import { LEANING_LABELS } from '@prisme/domain';
import PaywallBadge from './PaywallBadge';

/**
 * One Article's meta line: the Leaning as a bare colored dot (the group
 * heading already names the Leaning — the dot only keeps the color coding),
 * the Outlet name and the paywall badge. The headline carries the link (see
 * the Story page): the whole row points to the Article.
 *
 * When the Outlet is unknown (missing from the Outlet config) nothing is
 * inferred: the raw outlet id is shown without a dot rather than a guessed
 * Leaning.
 */
export default function ArticleRow({ article, outlet }: { article: Article; outlet?: Outlet }) {
  const name = outlet?.name ?? article.outletId;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {outlet && (
        <span
          aria-label={LEANING_LABELS[outlet.leaning]}
          aria-hidden="false"
          className="inline-block size-2 self-center rounded-full"
          role="img"
          style={{ background: `var(--${outlet.leaning})` }}
          title={LEANING_LABELS[outlet.leaning]}
        />
      )}
      <span className="text-[14px] font-medium">{name}</span>
      {outlet && <PaywallBadge paywall={outlet.paywall} />}
    </div>
  );
}