import type { Story } from '@prisme/domain';
import { rankStories } from '@prisme/domain';
import { ingestionIsOpen, parisDayKey } from './paris-day.ts';

export { rankStories };

/**
 * The Edition ranking (issue #37, ADR-0009 as amended by ADR-0011) lives in
 * @prisme/domain — the archive pages (issue #99, ADR-0017) reuse the same
 * key per Story day. The Edition keeps the top EDITION_SIZE Stories.
 */
export const EDITION_SIZE = 20;

/**
 * The dated Edition assembly (issue #98, ADR-0017, gap fix 2026-10): the
 * live pool — every Story whose ingestion window is still open, ranked by
 * the ADR-0009 key — first, then backfill — closed previous days'
 * `everInEdition` Stories, newest day first (J-1, J-2…), each day ranked by
 * the same key — capped at EDITION_SIZE. Backfill erodes through the day;
 * at midnight the day rolls over but yesterday's window stays open until
 * 06:00, so a Story born right after midnight still ranks into the Edition
 * (gets `everInEdition`, survives the freeze) instead of being born
 * already doomed to the never-in-Edition deletion rule (issue #75).
 * Stories from a future day are dropped (defensive; the Grouping model
 * cannot create them).
 */
export function assembleEdition(stories: Story[], now: Date): Story[] {
  const today = parisDayKey(now.toISOString());
  const open = stories.filter(
    (s) => s.storyDay <= today && ingestionIsOpen(s.storyDay, now),
  );
  const closedBackfill = stories.filter(
    (s) =>
      !ingestionIsOpen(s.storyDay, now) &&
      s.storyDay < today &&
      s.everInEdition === true,
  );
  const backfillDays = [...new Set(closedBackfill.map((s) => s.storyDay))]
    .sort()
    .reverse();
  return [
    ...rankStories(open),
    ...backfillDays.flatMap((day) =>
      rankStories(closedBackfill.filter((s) => s.storyDay === day)),
    ),
  ].slice(0, EDITION_SIZE);
}
