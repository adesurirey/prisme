import type { Story } from '@prisme/domain';
import { isLive } from './liveness.ts';

/**
 * The end-of-run cleanup decision (issue #75): a Story file is deleted iff
 * the Story is frozen (its Ingestion window is closed, ADR-0027 as
 * amended by ADR-0033 — silence past max(founding + 24h, newest + 12h)
 * or the founding + 72h ceiling, whichever is earlier; a Story frozen
 * with a 13-hour-old Article exists) and never entered the Edition
 * (`everInEdition` false or absent — treated as false, no backward
 * compatibility; a frozen Story that ranks into a capped sort is
 * stamped, see edition-history.ts). Under spec #158 "entered the
 * Edition" means ranked into capped Brûlant or Top — never Nouveau, so
 * a frozen Story below both caps is deleted even as a pool member: only
 * capped members are linked, and only linked Stories are protected.
 * Live Stories — in or below the caps — are never deleted, so they can
 * return on a later build with stable id and slug. Pure decision: input
 * Stories and a clock, output the slugs to delete; deterministic over
 * the same state.
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
