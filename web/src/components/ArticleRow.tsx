import type { Article, Outlet } from '@prisme/domain';
import LeaningBadge from './LeaningBadge';
import PaywallBadge from './PaywallBadge';

/**
 * One Article row: Outlet name, Leaning, paywall, link out.
 * When the Outlet is unknown (missing from outlets.json) nothing is inferred:
 * the raw outlet id is shown without a Leaning rather than a guessed one.
 */
export default function ArticleRow({ article, outlet }: { article: Article; outlet?: Outlet }) {
  const name = outlet?.name ?? article.outletId;
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      {outlet && <LeaningBadge leaning={outlet.leaning} />}
      <span className="text-[14px] font-medium">{name}</span>
      {outlet && <PaywallBadge paywall={outlet.paywall} />}
      <a
        href={article.url}
        rel="noopener noreferrer"
        target="_blank"
        className="ml-auto text-[13px] text-muted transition-colors hover:text-ink"
      >
        Lire sur {name}
      </a>
    </div>
  );
}