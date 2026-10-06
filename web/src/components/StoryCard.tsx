import type { Outlet, Story } from '@prisme/domain';
import { SECTION_LABELS } from '@prisme/domain';
import ArticleRow from './ArticleRow';
import CoverageBar, { coverageCounts } from './CoverageBar';
import StoryImage, { pickStoryImage } from './StoryImage';
import { withBase } from '../data';

/**
 * One Story in the Edition: a hairline-divided row — title and its Articles
 * on the left, the feed image (hotlinked) and the Coverage strip on the right.
 */
export default function StoryCard({ story, outlets }: { story: Story; outlets: Outlet[] }) {
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const counts = coverageCounts(story.articles, (id) => byId.get(id)?.leaning);
  const image = pickStoryImage(story, (id) => byId.get(id)?.leaning);
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
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {story.articles.map((article) => (
              <li key={article.id}>
                <ArticleRow article={article} outlet={byId.get(article.outletId)} />
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden shrink-0 items-center gap-5 self-center sm:flex">
          <StoryImage
            article={image}
            outlet={image && byId.get(image.outletId)}
            className="h-14 w-24 rounded-md"
            sizes="96px"
          />
          <CoverageBar counts={counts} />
        </div>
      </div>
    </article>
  );
}