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
 * The toggle is a plain disclosure row in the skills.sh style: muted text —
 * the follow-up count plus the Outlet it comes from, or "ces médias" when
 * several Outlets share the group — with a chevron after the label that
 * flips when open, and no hover surface at all.
 * Revealing the follow-ups fades and slides them in (@starting-style, no
 * JS timing).
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
  const followUpFrom = [
    ...new Set(followUps.map((a) => byId.get(a.outletId)?.name ?? a.outletId)),
  ];
  const from = followUpFrom.length === 1 ? followUpFrom[0] : 'ces médias';
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
            className="-mx-5 flex w-[calc(100%+2.5rem)] cursor-pointer items-center gap-1.5 px-5 py-2.5 text-left text-[13px] text-muted"
          >
            <span>
              {open
                ? 'Réduire'
                : `+${followUps.length} autre${followUps.length > 1 ? 's' : ''} de ${from}`}
            </span>
            <svg
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
              className={`size-3 shrink-0 transition-transform duration-150 ${
                open ? 'rotate-180' : ''
              }`}
            >
              <path
                d="M3.5 6 8 10.5 12.5 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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
              className="group/article flex items-center gap-4 rounded-xl border border-transparent px-5 py-5 transition-colors duration-200 ease-out hover:border-line hover:bg-hover"
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
                  className="h-14 w-24 rounded-md"
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
