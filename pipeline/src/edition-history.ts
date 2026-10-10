import type { Story } from '@prisme/domain';
import { isLive } from './liveness.ts';

/**
 * The Edition history (issue #75): each build reconciles the Stories' sticky
 * `everInEdition` flag with today's Edition — true the moment the Story
 * ranks into the top-`EDITION_SIZE`, never unset while the Story lives, so
 * a Story's Edition history survives its freezing. A missing flag counts as
 * false (no backward compatibility; no migration). Frozen Stories are passed
 * through untouched (ADR-0005) — the flag is written only while a Story is
 * live, same shape of reconciliation as `updateFrontPageHistory`.
 */
export interface EditionHistoryResult {
  /** The Stories with the reconciled flag (input Stories are never mutated). */
  stories: Story[];
  /** Slugs of Stories whose flag actually changed — their files are rewritten. */
  changed: Set<string>;
}

export function updateEditionHistory(
  stories: Story[],
  editionStoryIds: Set<string>,
  now: Date,
): EditionHistoryResult {
  const changed = new Set<string>();
  const reconciled = stories.map((story) => {
    if (!isLive(story, now)) return story;
    const ever = story.everInEdition === true || editionStoryIds.has(story.id);
    if (ever === (story.everInEdition === true)) return story;
    changed.add(story.slug);
    // ever is true here (the flag is sticky and never unset while live).
    return { ...story, everInEdition: true };
  });
  return { stories: reconciled, changed };
}
