import type { Article, Outlet } from '@prisme/domain';
import { useId, useState } from 'react';
import ArticleRow from './ArticleRow';
import PaywallBadge from './PaywallBadge';
import StoryImage from './StoryImage';

/**
 * One Leaning group’s Article list (issue #27): the head — each Outlet’s
 * freshest Article — is always visible; the Outlet’s follow-ups are
 * prerendered into the HTML but hidden until the disclosure row reveals them
 * (same pattern as PrismTabs: indexable without JavaScript). Each row is a
 * whole-card link, styled like the Edition’s Story cards (hover surface,
 * slight scale, image zoom): headline as title, muted meta line, image on
 * the right.
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
            className="-mx-5 flex w-[calc(100%+2.5rem)] cursor-pointer items-center gap-2 rounded-md px-5 py-2.5 text-left text-[13px] text-muted transition-colors hover:bg-hover hover:text-ink"
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
                  ? 'Voir l’autre article de ces médias'
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
        const headline =
          article.headline !== storyTitle ? article.headline : undefined;
        return (
          <li key={article.id} className="-mx-5">
            <a
              href={article.url}
              rel="noopener noreferrer"
              target="_blank"
              className="group/article flex items-center gap-4 rounded-xl border border-transparent px-5 py-5 transition-all duration-200 ease-out hover:scale-[1.01] hover:border-line hover:bg-hover"
            >
              <ArticleRow
                article={article}
                headline={headline}
                outlet={outlet}
              />
              <div className="relative shrink-0 self-center">
                <StoryImage
                  article={article}
                  outlet={outlet}
                  className="h-14 w-24 rounded-md transition-transform duration-300 ease-out group-hover/article:scale-[1.04]"
                  sizes="96px"
                />
                {outlet && (
                  <PaywallBadge paywall={outlet.paywall} variant="chip" />
                )}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
