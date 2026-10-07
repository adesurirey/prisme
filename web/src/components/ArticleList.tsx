import type { Article, Outlet } from '@prisme/domain';
import { useId, useState } from 'react';
import ArticleRow from './ArticleRow';
import StoryImage from './StoryImage';

/**
 * One Leaning group's Article list (issue #27): the head — each Outlet's
 * freshest Article — is always visible; the Outlet's follow-ups are
 * prerendered into the HTML but hidden until the disclosure row reveals them
 * (same pattern as PrismTabs: indexable without JavaScript). Both rows keep
 * the page's layout: image, meta line, headline — unless the headline repeats
 * the Story title (split Stories take the founding headline; showing it
 * twice adds nothing).
 *
 * The toggle is a full-width disclosure row in the list chrome (Linear-style):
 * a chevron that rotates when open, a rounded hover surface that bleeds
 * slightly past the text gutter, and the follow-up count spelled out in the
 * row itself. The list carries no hairlines at all — rows separate by
 * whitespace, the only line of a Leaning group sits under its heading in
 * the page. Revealing the follow-ups fades and slides them in
 * (@starting-style, no JS timing).
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
  const followUpsId = useId();
  return (
    <div>
      <List articles={head} byId={byId} storyTitle={storyTitle} />
      {followUps.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={followUpsId}
            onClick={() => setOpen(!open)}
            className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-2 rounded-md px-2 py-2.5 text-left text-[13px] text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className={`size-3 shrink-0 transition-transform duration-150 ${
                open ? 'rotate-90' : ''
              }`}
            >
              <path
                d="M6 3.5 10.5 8 6 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              {open
                ? 'Réduire'
                : followUps.length === 1
                  ? "Voir l'autre article de ces médias"
                  : `Voir les ${followUps.length} autres articles de ces médias`}
            </span>
          </button>
          <List
            articles={followUps}
            byId={byId}
            storyTitle={storyTitle}
            hidden={!open}
            reveal
            id={followUpsId}
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
  reveal = false,
  id,
}: {
  articles: Article[];
  byId: Map<string, Outlet>;
  storyTitle: string;
  hidden?: boolean;
  /** Opt the list into the reveal animation (follow-ups only). */
  reveal?: boolean;
  id?: string;
}) {
  return (
    <ul id={id} hidden={hidden} className={reveal ? 'reveal' : undefined}>
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
