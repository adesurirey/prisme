import type { Outlet, Story } from '@prisme/domain';
import {
  blindspots,
  countedArticles,
  coverageCounts,
  pickStoryImage,
  reportingOutletIds,
} from '@prisme/domain';import { SECTION_LABELS } from '@prisme/domain';
import BlindspotBadge from './BlindspotBadge';
import CoverageBar from './CoverageBar';
import StoryImage from './StoryImage';
import { withBase } from '../data';

/**
 * One Story in the Edition index, in ranking order (issue #6: the Edition
 * orders by Outlets currently on the Front page, then Coverage): Section,
 * title, Blindspot badges, Coverage strip with its "x médias sur y" tooltip
 * and the counted Article detail — a link to the Story page, where the
 * Articles live.
 */
export default function StoryCard({ story, outlets }: { story: Story; outlets: Outlet[] }) {
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const counts = coverageCounts(story.articles, byId);
  const reporting = reportingOutletIds(story.articles).size;
  const spots = blindspots(counts);
  const image = pickStoryImage(story, byId);
  const articles = countedArticles(story.articles);
  return (
    <article className="-mx-5 rounded-lg px-5 py-5 transition-colors hover:bg-hover">
      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1">
          {story.section && (
            <p className="mb-1 text-[11px] uppercase tracking-[0.08em] text-faint">
              {SECTION_LABELS[story.section]}
            </p>
          )}
          <h2 className="text-[15px] font-medium leading-snug tracking-[-0.01em]">
            <a href={withBase(`/sujet/${story.slug}/`)}>{story.title}</a>
          </h2>
          <p className="mt-2 text-[13px] text-muted">
            {articles} article{articles > 1 ? 's' : ''}
          </p>
          {spots.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {spots.map((leaning) => (
                <BlindspotBadge key={leaning} leaning={leaning} />
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-5 self-center">
          <div>
            <StoryImage
              article={image}
              outlet={image && byId.get(image.outletId)}
              className="h-14 w-24 rounded-md"
              sizes="96px"
            />
          </div>
          <CoverageBar counts={counts} reporting={reporting} totalOutlets={outlets.length} />
        </div>
      </div>
    </article>
  );
}