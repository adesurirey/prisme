import type { Article, Outlet } from '@prisme/domain';
import { LEANING_LABELS } from '@prisme/domain';
import PaywallBadge from './PaywallBadge';

/**
 * One Article's meta line: the Leaning as a bare colored dot (the group
 * heading already names the Leaning — the dot only keeps the color coding),
 * the Outlet name, the paywall badge and the "Lire sur" link — muted, with a
 * hairline underline and a small ↗ that brighten on hover.
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
      {outlet && <PaywallBadge paywall={outlet.paywall} />}
      <a
        href={article.url}
        rel="noopener noreferrer"
        target="_blank"
        className="ml-auto text-[13px] text-muted transition-colors hover:text-ink"
      >
        Lire
        <span aria-hidden="true" className="text-[11px]">
          {'\u00a0'}↗
        </span>
      </a>
    </div>
  );
}
