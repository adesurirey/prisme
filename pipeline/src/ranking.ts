import type { Story } from '@prisme/domain';
import { reportingOutletIds } from '@prisme/domain';

/**
 * The Edition ranking (issue #37, ADR-0009 as amended by ADR-0011): Stories
 * order by Coverage — distinct Outlets with any Article on the Story,
 * Opinion pieces included — then by the newest Article, then by creation
 * time and id — fully deterministic across builds. The Edition keeps the
 * top EDITION_SIZE Stories. Front-page flags no longer participate in
 * ranking; ADR-0008 keeps them as display metadata only.
 */
export const EDITION_SIZE = 20;

function latestPublished(story: Story): number {
  return Math.max(
    0,
    ...story.articles.map((a) => Date.parse(a.publishedAt) || 0),
  );
}

export function rankStories(stories: Story[]): Story[] {
  const reporting = new Map<Story, number>();
  for (const story of stories) {
    reporting.set(story, reportingOutletIds(story.articles).size);
  }
  return [...stories].sort(
    (a, b) =>
      reporting.get(b)! - reporting.get(a)! ||
      latestPublished(b) - latestPublished(a) ||
      a.createdAt.localeCompare(b.createdAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
