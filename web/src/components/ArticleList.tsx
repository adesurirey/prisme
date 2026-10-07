import type { Article, Outlet } from '@prisme/domain';
import { useState } from 'react';
import ArticleRow from './ArticleRow';
import StoryImage from './StoryImage';

/**
 * One Leaning group's Article list (issue #27): the head — each Outlet's
 * freshest Article — is always visible; the Outlet's follow-ups are
 * prerendered into the HTML but hidden until "Voir les N autres articles de
 * ces médias" reveals them (same pattern as PrismTabs: indexable without
 * JavaScript). Both rows keep the page's layout: image, meta line, headline
 * — unless the headline repeats the Story title (split Stories take the
 * founding headline; showing it twice adds nothing).
 */
export default function ArticleList({
  head,
  followUps,
  outlets,
  storyTitle,
}: {
  head: Article[];
  followUps: Article[];
  outlets: Outlet[];
  storyTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const byId = new Map(outlets.map((o) => [o.id, o]));
  return (
    <div>
      <List articles={head} byId={byId} storyTitle={storyTitle} />
      {followUps.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[13px] text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            {open
              ? 'Réduire'
              : followUps.length === 1
                ? "Voir l'autre article de ces médias"
                : `Voir les ${followUps.length} autres articles de ces médias`}
            <Chevron open={open} />
          </button>
          <List
            articles={followUps}
            byId={byId}
            storyTitle={storyTitle}
            hidden={!open}
            className="mt-2.5"
          />
        </>
      )}
    </div>
  );
}

function List({
  articles,
  byId,
  storyTitle,
  hidden = false,
  className,
}: {
  articles: Article[];
  byId: Map<string, Outlet>;
  storyTitle: string;
  hidden?: boolean;
  className?: string;
}) {
  return (
    <ul
      hidden={hidden}
      className={`flex flex-col divide-y divide-line border-y border-line ${className ?? ''}`}
    >
      {articles.map((article) => {
        const outlet = byId.get(article.outletId);
        return (
          <li key={article.id} className="flex gap-4 py-4">
            <StoryImage
              article={article}
              outlet={outlet}
              className="h-14 w-24 shrink-0 rounded-md"
              sizes="96px"
            />
            <div className="min-w-0 flex-1">
              <ArticleRow article={article} outlet={outlet} />
              {article.headline !== storyTitle && (
                <p className="mt-1.5 text-[14px] text-muted">
                  {article.headline}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The toggle's state, as motion that answers the click: it turns over when
    the list opens. Reduced-motion users get the state change without the
    rotation (global CSS kills transitions). */
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`size-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
