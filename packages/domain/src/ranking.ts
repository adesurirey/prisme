import { reportingOutletIds } from './coverage.ts';
import type { Story } from './index.ts';

/**
 * The Edition ranking (issue #37, ADR-0009 as amended by ADR-0011): Stories
 * order by Coverage — distinct Outlets with any Article on the Story,
 * Opinion pieces included — then by the newest Article, then by creation
 * time and id — fully deterministic across builds. The Edition is uncapped
 * (pipeline, ADR-0022); the archive pages (issue #99,
 * ADR-0017) reuse the same key per Story day, with no cut. Front-page flags
 * no longer participate in ranking; ADR-0008 keeps them as display metadata
 * only.
 */
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
