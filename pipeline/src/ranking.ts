import type { Outlet, Story } from '@prisme/domain';
import { reportingOutletIds } from '@prisme/domain';

/**
 * The Edition ranking (issue #6): Stories order by the number of Outlets
 * currently on their Front page, then by Coverage (distinct reporting
 * Outlets, Opinion pieces excluded), then by the newest Article, then by
 * creation time and id — fully deterministic across builds. The Edition keeps
 * the top EDITION_SIZE Stories.
 */
export const EDITION_SIZE = 20;

function latestPublished(story: Story): number {
  return Math.max(0, ...story.articles.map((a) => Date.parse(a.publishedAt) || 0));
}

export function rankStories(stories: Story[], outletById: Map<string, Outlet>): Story[] {
  const frontPageOutlets = new Map<Story, number>();
  const reporting = new Map<Story, number>();
  for (const story of stories) {
    frontPageOutlets.set(
      story,
      new Set(story.articles.filter((a) => a.frontPage).map((a) => a.outletId)).size,
    );
    reporting.set(story, reportingOutletIds(story.articles).size);
  }
  return [...stories].sort(
    (a, b) =>
      frontPageOutlets.get(b)! - frontPageOutlets.get(a)! ||
      reporting.get(b)! - reporting.get(a)! ||
      latestPublished(b) - latestPublished(a) ||
      a.createdAt.localeCompare(b.createdAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}