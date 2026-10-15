import type { Outlet, Story } from '@prisme/domain';
import {
  blindspots,
  countedArticles,
  coverageCounts,
  exposureShares,
  pickStoryImage,
  reportingOutletIds,
} from '@prisme/domain';
import { formatStoryDate } from '../article-date';
import { withBase } from '../data';
import { storyUrl } from '../story-url';
import BlindspotBadge from './BlindspotBadge';
import CoverageMeta from './CoverageMeta';
import StoryImage from './StoryImage';

/**
 * One Story in the Edition index, in ranking order (issue #6: the Edition
 * orders by Outlets currently on the Front page, then Coverage): Section,
 * title, Blindspot badges, the Coverage meta line (compact strip + counted
 * Articles — see CoverageMeta) — one whole-card link
 * to the Story page, where the Articles live, styled like the Story page's
 * Article cards (hover surface, no animation).
 *
 * The root carries data-story-id/data-coverage for the client-side "En
 * hausse" badge (trending.ts): the prerendered HTML has no idea who is
 * reading, so the per-visitor signal is decided in the browser.
 */
export default function StoryCard({
  story,
  outlets,
}: {
  story: Story;
  outlets: Outlet[];
}) {
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const counts = coverageCounts(story.articles, byId);
  const shares = exposureShares(story.articles, byId);
  const reporting = reportingOutletIds(story.articles).size;
  const spots = blindspots(counts);
  const image = pickStoryImage(story, byId);
  const articles = countedArticles(story.articles);
  // Newest Article first (grouping sorts Story Articles that way — the
  // same articles[0] the Story page header reads).
  const last = story.articles[0];
  return (
    <article
      className="-mx-5"
      data-story-id={story.id}
      data-coverage={reporting}
    >
      <a
        href={withBase(storyUrl(story))}
        className="group/card flex items-start gap-4 rounded-xl px-5 py-5"
      >
        <div className="min-w-0 flex-1">
          {/* The "En hausse" slot sits above the title — a per-visitor
              highlight deserves the first read, not the bottom of the meta
              pile. Invisible (empty:hidden) until trending.ts appends the
              client-side badge. */}
          <p data-trending-slot className="empty:hidden mb-1 text-[13px]" />
          <h2 className="text-[16px] font-semibold sm:text-[18px] leading-snug tracking-[-0.01em] group-hover/card:underline">
            {story.title}
          </h2>
          {/* The "maj." date is the Story's newest Article — the same
              articles[0] the Story page header reads. */}
          {/* Meta on one row, both tiers inline. Mobile wording drops
              "maj." and the "à" join; sm: restores the full label. */}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted sm:gap-x-3">
            <CoverageMeta
              counts={counts}
              shares={shares}
              reporting={reporting}
              totalOutlets={outlets.length}
              articles={articles}
            />
            {last && (
              <span className="whitespace-nowrap text-faint">
                <span className="sm:hidden">
                  {formatStoryDate(last).replace(' à ', ' ')}
                </span>
                <span className="hidden sm:inline">
                  maj. {formatStoryDate(last)}
                </span>
              </span>
            )}
          </p>
          {spots.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {spots.map((leaning) => (
                <BlindspotBadge key={leaning} leaning={leaning} />
              ))}
            </div>
          )}
        </div>
        <div className="shrink-0 self-center">
          <StoryImage
            article={image}
            outlet={image && byId.get(image.outletId)}
            className="h-18 w-32 rounded-md"
            sizes="128px"
          />
        </div>
      </a>
    </article>
  );
}
