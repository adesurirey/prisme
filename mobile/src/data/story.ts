/**
 * The story seam for the story screen (issue #199): find one Story in
 * the Edition snapshot and build its public page URL. The URL is the
 * share target — the same path the static site publishes
 * (`/<storyDay>/<slug>/`, ADR-0017: an Article may only join a Story
 * of its own day, so the pair is stable).
 */

import type { Edition, Story } from '@prisme/domain';

import { ARTIFACT_BASE_URL } from './edition-client';

/** Resolve one Story by id across the ranked lists — the same Story
 *  rides Top, Brûlant and Nouveau; any hit is the same object. */
export function findStory(id: string, edition: Edition): Story | null {
  for (const story of [
    ...edition.stories,
    ...edition.feedStories,
    ...edition.latestStories,
  ]) {
    if (story.id === id) return story;
  }
  return null;
}

/** The story's public page on the static site — what the share sheet
 *  offers (issue #199), trailing slash like the sitemap's own URLs. */
export function storyWebUrl(story: Pick<Story, 'storyDay' | 'slug'>): string {
  return `${ARTIFACT_BASE_URL}/${story.storyDay}/${story.slug}/`;
}
