import type { Article, Outlet } from '@prisme/domain';
import LeaningBadge from './LeaningBadge';
import PaywallBadge from './PaywallBadge';

/**
 * One Article row: Outlet name, Leaning and paywall badges, link out.
 * When the Outlet is unknown (missing from outlets.json) nothing is inferred:
 * the raw outlet id is shown without badges rather than a guessed Leaning.
 */
export default function ArticleRow({ article, outlet }: { article: Article; outlet?: Outlet }) {
  const name = outlet?.name ?? article.outletId;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {outlet && <LeaningBadge leaning={outlet.leaning} />}
      <span className="font-medium">{name}</span>
      {outlet && <PaywallBadge paywall={outlet.paywall} />}
      <a
        href={article.url}
        rel="noopener noreferrer"
        target="_blank"
        className="ml-auto text-blue-700 underline-offset-2 hover:underline"
      >
        Lire sur {name}
      </a>
    </div>
  );
}
