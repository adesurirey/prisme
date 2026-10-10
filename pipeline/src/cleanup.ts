import type { Story } from '@prisme/domain';
import { isLive } from './liveness.ts';

/**
 * The end-of-run cleanup decision (issue #75): a Story file is deleted iff
 * the Story is frozen (no Article in the 24h live window) and never entered
 * the Edition (`everInEdition` false or absent — treated as false, no
 * backward compatibility). Live Stories — in or below the Edition cut — are
 * never deleted, so they can return on a later build with stable id and
 * slug. Pure decision: input Stories and a clock, output the slugs to
 * delete; deterministic over the same state.
 *
 * Safe today because the only internal link to a Story page comes from the
 * current Edition and no sitemap exists — if either changes, revisit.
 */
export function slugsToDelete(stories: Story[], now: Date): Set<string> {
  const deleted = new Set<string>();
  for (const story of stories) {
    if (isLive(story, now)) continue;
    if (story.everInEdition === true) continue;
    deleted.add(story.slug);
  }
  return deleted;
}
