import type { Outlet, Story } from '@prisme/domain';
import ArticleRow from './ArticleRow';
import CoverageBar, { coverageCounts } from './CoverageBar';
import { withBase } from '../data';

/**
 * One Story in the Edition: a hairline-divided row — title and its Articles
 * on the left, the Story's Coverage strip on the right.
 */
export default function StoryCard({ story, outlets }: { story: Story; outlets: Outlet[] }) {
  const byId = new Map(outlets.map((o) => [o.id, o]));
  const counts = coverageCounts(story.articles, (id) => byId.get(id)?.leaning);
  return (
    <article className="-mx-5 rounded-lg px-5 py-5 transition-colors hover:bg-hover">
      <div className="flex items-baseline gap-6">
        <div className="min-w-0 flex-1">
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
        <div className="hidden shrink-0 self-center sm:block">
          <CoverageBar counts={counts} />
        </div>
      </div>
    </article>
  );
}