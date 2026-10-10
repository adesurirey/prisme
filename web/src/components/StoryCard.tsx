import type { Outlet, Story } from '@prisme/domain';
import {
  blindspots,
  countedArticles,
  coverageCounts,
  pickStoryImage,
  reportingOutletIds,
  SECTION_LABELS,
} from '@prisme/domain';
import { withBase } from '../data';
import BlindspotBadge from './BlindspotBadge';
import CoverageMeta from './CoverageMeta';
import StoryImage from './StoryImage';

/**
 * One Story in the Edition index, in ranking order (issue #6: the Edition
 * orders by Outlets currently on the Front page, then Coverage): Section,
 * title, Blindspot badges, the Coverage meta line (compact strip + counted
 * Articles + share of the config — see CoverageMeta) — one whole-card link
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
  const reporting = reportingOutletIds(story.articles).size;
  const spots = blindspots(counts);
  const image = pickStoryImage(story, byId);
  const articles = countedArticles(story.articles);
  return (
    <article
      className="-mx-5"
      data-story-id={story.id}
      data-coverage={reporting}
    >
      <a
        href={withBase(`/sujet/${story.slug}/`)}
        className="group/card flex items-start gap-6 rounded-xl border border-transparent px-5 py-5 transition-colors duration-200 ease-out hover:border-line hover:bg-hover"
      >
        <div className="min-w-0 flex-1">
          {story.section && (
            <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-muted">
              {SECTION_LABELS[story.section]}
            </p>
          )}
          <h2 className="text-[16px] font-semibold leading-snug tracking-[-0.01em]">
            {story.title}
          </h2>
          <CoverageMeta
            counts={counts}
            reporting={reporting}
            totalOutlets={outlets.length}
            articles={articles}
            className="mt-2 text-[13px] text-muted"
          />
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
            className="h-16 w-28 rounded-md"
            sizes="112px"
          />
        </div>
      </a>
    </article>
  );
}
