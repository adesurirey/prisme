import type { Outlet, Story } from '@prisme/domain';
import { SECTION_LABELS } from '@prisme/domain';
import CoverageBar, { coverageCounts } from './CoverageBar';
import StoryImage, { pickStoryImage } from './StoryImage';
import { withBase } from '../data';

/**
 * One Story in the Edition index: Section, title, Coverage strip and image —
 * a link to the Story page, where the Articles live (issue #5: Stories group
 * Articles, so the index no longer lists them).
 */
export default function StoryCard({ story, outlets }: { story: Story; outlets: Outlet[] }) {
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const counts = coverageCounts(story.articles, (id) => byId.get(id)?.leaning);
  const image = pickStoryImage(story, (id) => byId.get(id)?.leaning);
  const articles = story.articles.length;
  const media = new Set(story.articles.map((a) => a.outletId)).size;
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
            {articles} article{articles > 1 ? 's' : ''} · {media} média{media > 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-5 self-center">
          <div className="hidden sm:block">
            <StoryImage
              article={image}
              outlet={image && byId.get(image.outletId)}
              className="h-14 w-24 rounded-md"
              sizes="96px"
            />
          </div>
          <CoverageBar counts={counts} />
        </div>
      </div>
    </article>
  );
}