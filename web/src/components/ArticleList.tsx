import { type Article, newestFirst, type Outlet } from '@prisme/domain';
import { Fragment, useId, useState } from 'react';
import ArticleRow from './ArticleRow';
import PaywallBadge from './PaywallBadge';
import StoryImage from './StoryImage';

/**
 * The Story page’s Article list, one flat list in recency order (newest
 * first, ties by id): every Article is a row — except that an Outlet’s
 * articles after its freshest one are prerendered into the HTML but hidden
 * behind a disclosure row placed right after that Outlet’s head row (the
 * skills.sh "+N more from …" pattern; indexable without JavaScript). The
 * Leaning dot travels on each row — see ArticleRow.
 *
 * The toggle is a plain disclosure row: muted text — the follow-up count
 * plus the Outlet’s name — with a chevron that flips when open, and no
 * hover surface at all. Revealing the follow-ups fades and slides them in
 * (@starting-style, no JS timing).
 */
export default function ArticleList({
  articles,
  outlets,
}: {
  articles: Article[];
  outlets: Outlet[];
}) {
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const sorted = [...articles].sort(newestFirst);
  // One group per Outlet: its freshest Article keeps its place in the
  // recency order and carries the Outlet’s remaining Articles as hidden
  // follow-ups; follow-up rows never appear in the top-level flow.
  const seen = new Set<string>();
  const rows = sorted
    .filter((article) => {
      const first = !seen.has(article.outletId);
      if (first) seen.add(article.outletId);
      return first;
    })
    .map((article) => ({
      article,
      followUps: sorted.filter(
        (a) => a.outletId === article.outletId && a !== article,
      ),
    }));
  return (
    <ul>
      {rows.map(({ article, followUps }) => (
        <Fragment key={article.id}>
          <Row article={article} byId={byId} />
          {followUps.length > 0 && (
            <OutletGroup followUps={followUps} byId={byId} />
          )}
        </Fragment>
      ))}
    </ul>
  );
}

/** One Outlet’s hidden follow-ups, revealed by their own disclosure row. */
function OutletGroup({
  followUps,
  byId,
}: {
  followUps: Article[];
  byId: Map<string, Outlet>;
}) {
  const [open, setOpen] = useState(false);
  const group = useId();
  const outletName =
    byId.get(followUps[0].outletId)?.name ?? followUps[0].outletId;
  const rowIds = followUps.map((a) => `${group}-${a.id}`);
  return (
    <>
      <li className="-mx-5">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={rowIds.join(' ')}
          onClick={() => setOpen(!open)}
          className="flex w-full cursor-pointer items-center gap-1.5 px-5 py-2.5 text-left text-[13px] text-muted"
        >
          <span>
            {open
              ? `Replier ${outletName}`
              : `+${followUps.length} autre${followUps.length > 1 ? 's' : ''} de ${outletName}`}
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
      </li>
      {followUps.map((article, i) => (
        <Row
          key={article.id}
          article={article}
          byId={byId}
          rowId={rowIds[i]}
          hidden={!open}
          reveal
        />
      ))}
    </>
  );
}

function Row({
  article,
  byId,
  hidden = false,
  reveal = false,
  rowId,
}: {
  article: Article;
  byId: Map<string, Outlet>;
  hidden?: boolean;
  /** Opt the row into the reveal animation (follow-ups only). */
  reveal?: boolean;
  /** The row's DOM id, target of its group's disclosure (aria-controls). */
  rowId?: string;
}) {
  const outlet = byId.get(article.outletId);
  const headline = article.headline;
  return (
    <li
      id={rowId}
      hidden={hidden}
      className={reveal ? 'reveal -mx-5' : '-mx-5'}
    >
      <a
        href={article.url}
        rel="noopener noreferrer"
        target="_blank"
        className="group/article flex items-center gap-4 rounded-xl px-5 py-5 transition-colors duration-200 ease-out hover:bg-hover"
      >
        <ArticleRow article={article} headline={headline} outlet={outlet} />
        <div className="relative shrink-0 self-center">
          <StoryImage
            article={article}
            outlet={outlet}
            className="h-14 w-24 rounded-md transition-transform duration-300 ease-out group-hover/article:scale-[1.03]"
            sizes="96px"
          />
          {outlet && <PaywallBadge paywall={outlet.paywall} variant="chip" />}
        </div>
      </a>
    </li>
  );
}
