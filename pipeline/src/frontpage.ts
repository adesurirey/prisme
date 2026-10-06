import type { Article, Story } from '@prisme/domain';

/**
 * The Front-page history (issue #6): each build reconciles the Story files'
 * Article flags with today's collection. `frontPage` is the current snapshot
 * — true only when the Article is on its Outlet's Front page today; false
 * when it fell off or is absent from today's collection. `everFrontPage` is
 * sticky: once true it never goes back while the Article lives, so the UI can
 * show "À la une chez…" for the whole day. Frozen Stories are passed through
 * untouched (ADR-0005): their flags keep the state of their last live build.
 */
export interface FrontPageResult {
  /** The Stories with reconciled flags (input Stories are never mutated). */
  stories: Story[];
  /** Slugs of Stories whose flags actually changed — their files are rewritten. */
  changed: Set<string>;
}

export function updateFrontPageHistory(
  stories: Story[],
  collected: Article[],
  isLive: (story: Story) => boolean,
): FrontPageResult {
  // Today's Front-page snapshot, by Article id; absent means not on it.
  const current = new Map(collected.filter((a) => a.frontPage).map((a) => [a.id, a]));
  const changed = new Set<string>();
  const reconciled = stories.map((story) => {
    if (!isLive(story)) return story;
    let touched = false;
    const articles = story.articles.map((article) => {
      const nowOnFrontPage = current.has(article.id);
      const ever = article.everFrontPage === true || nowOnFrontPage;
      if (article.frontPage === nowOnFrontPage && ever === (article.everFrontPage === true)) {
        return article;
      }
      touched = true;
      const next: Article = { ...article, frontPage: nowOnFrontPage };
      if (ever) next.everFrontPage = true;
      else delete next.everFrontPage;
      return next;
    });
    if (!touched) return story;
    changed.add(story.slug);
    return { ...story, articles };
  });
  return { stories: reconciled, changed };
}