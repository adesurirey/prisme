import type { Story } from '@prisme/domain';
import { isLive } from './liveness.ts';

/**
 * The Edition history (issue #75): each build reconciles the Stories' sticky
 * `everInEdition` flag with today's Edition — true the moment the Story
 * ranks into an Edition window (ADR-0027), never unset, so the flag
 * survives the Story's freezing and the never-entered deletion rule
 * (cleanup.ts) keeps working. A missing flag counts as false (no backward
 * compatibility; no migration). Frozen Stories are stamped only when they
 * rank into a window this build — the windows span frozen Stories (ADR-0027),
 * and an unstamped member would be deleted by the cleanup while still
 * linked on « Le fil » or « En direct ». Otherwise frozen Stories are passed
 * through
 * untouched: the stamp touches only this flag, never the Story's content
 * (ADR-0005) — same shape of reconciliation as `updateFrontPageHistory`.
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
    // A frozen non-member passes through: only a frozen Story that ranks
    // into a window this build is stamped, so cleanup never drops a file
    // an Edition page links to (spec #121 review) — a > 24h outage can
    // birth-and-freeze a Story no build ever saw live.
    if (!isLive(story, now) && !editionStoryIds.has(story.id)) return story;
    const ever = story.everInEdition === true || editionStoryIds.has(story.id);
    if (ever === (story.everInEdition === true)) return story;
    changed.add(story.slug);
    // ever is true here (the flag is sticky and never unset).
    return { ...story, everInEdition: true };
  });
  return { stories: reconciled, changed };
}
