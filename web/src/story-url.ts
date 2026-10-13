import type { Story } from '@prisme/domain';

/**
 * The canonical URL of a Story page: the Story's own storyDay (fixed at
 * creation, ADR-0017) followed by the slug — never the day the reader is
 * browsing. A backfill Story shown on the home today links under its own
 * day.
 */
export function storyUrl(story: Pick<Story, 'storyDay' | 'slug'>): string {
  return `/${story.storyDay}/${story.slug}/`;
}
