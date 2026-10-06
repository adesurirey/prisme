import type { Outlet, Story } from '@prisme/domain';
import LeaningBadge from './LeaningBadge';
import PaywallBadge from './PaywallBadge';
import { withBase } from '../data';

/**
 * One Story in the Edition list: title, Outlets, Leanings and a link out.
 * React component rendered at build time by Astro (ADR-0004).
 */
export default function StoryCard({ story, outlets }: { story: Story; outlets: Outlet[] }) {
  const byId = new Map(outlets.map((o) => [o.id, o]));
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold leading-snug">
        <a href={withBase(`/sujet/${story.slug}/`)} className="hover:text-blue-700">
          {story.title}
        </a>
      </h2>
      <ul className="mt-3 flex flex-col gap-2">
        {story.articles.map((article) => {
          const outlet = byId.get(article.outletId);
          return (
            <li key={article.id} className="flex flex-wrap items-center gap-2 text-sm">
              <LeaningBadge leaning={outlet?.leaning ?? 'centre'} />
              <span className="font-medium">{outlet?.name ?? article.outletId}</span>
              <PaywallBadge paywall={outlet?.paywall ?? 'none'} />
              <a
                href={article.url}
                rel="noopener noreferrer"
                target="_blank"
                className="ml-auto text-blue-700 underline-offset-2 hover:underline"
              >
                Lire sur {outlet?.name ?? article.outletId}
              </a>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
