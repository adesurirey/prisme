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
 * Articles + share of the config — see CoverageMeta) — a link to the Story
 * page, where the Articles live.
 *
 * The featured variant (top Story only) swaps the side thumbnail for a
 * 16:9 image strip above the text — one accent card, hierarchy preserved.
 */
export default function StoryCard({
  story,
  outlets,
  featured: featuredProp = false,
}: {
  story: Story;
  outlets: Outlet[];
  featured?: boolean;
}) {
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const counts = coverageCounts(story.articles, byId);
  const reporting = reportingOutletIds(story.articles).size;
  const spots = blindspots(counts);
  const image = pickStoryImage(story, byId);
  const featured = featuredProp && Boolean(image?.imageUrl);
  const imageOutlet = image && byId.get(image.outletId);
  const articles = countedArticles(story.articles);
  return (
    <article className="-mx-5 rounded-lg px-5 py-5 transition-colors hover:bg-hover">
      {featured && (
        <a
          href={withBase(`/sujet/${story.slug}/`)}
          className="mb-3 block"
          tabIndex={-1}
          aria-label={story.title}
        >
          <StoryImage
            article={image}
            outlet={imageOutlet}
            className="aspect-[16/9] w-full rounded-lg"
            sizes="(max-width: 896px) 100vw, 896px"
          />
        </a>
      )}
      <div className={featured ? undefined : 'flex items-start gap-6'}>
        <div className="min-w-0 flex-1">
          {story.section && (
            <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-muted">
              {SECTION_LABELS[story.section]}
            </p>
          )}
          <h2
            className={
              featured
                ? 'text-[17px] font-semibold leading-snug tracking-[-0.01em]'
                : 'text-[15px] font-medium leading-snug tracking-[-0.01em]'
            }
          >
            <a href={withBase(`/sujet/${story.slug}/`)}>{story.title}</a>
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
        {!featured && (
          <div className="shrink-0 self-center">
            <StoryImage
              article={image}
              outlet={imageOutlet}
              className="h-14 w-24 rounded-md"
              sizes="96px"
            />
          </div>
        )}
      </div>
    </article>
  );
}
