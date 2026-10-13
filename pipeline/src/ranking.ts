import type { Story } from '@prisme/domain';
import { rankStories } from '@prisme/domain';

export { rankStories };

/**
 * The Edition ranking (issue #37, ADR-0009 as amended by ADR-0011) lives in
 * @prisme/domain — the archive pages (issue #99, ADR-0017) reuse the same
 * key per Story day. The Edition keeps the top EDITION_SIZE Stories.
 */
export const EDITION_SIZE = 20;

/**
 * The dated Edition assembly (issue #98, ADR-0017): current-day Stories
 * ranked by the ADR-0009 key first, then backfill — previous days'
 * `everInEdition` Stories, newest day first (J-1, J-2…), each day ranked by
 * the same key — capped at EDITION_SIZE. Backfill erodes through the day as
 * current-day Stories push it down; at midnight the day rolls over and
 * yesterday's Stories become backfill, so the changeover is smooth. Stories
 * from a future day are dropped (defensive; the Grouping model cannot
 * create them).
 */
export function assembleEdition(stories: Story[], today: string): Story[] {
  const current = rankStories(stories.filter((s) => s.storyDay === today));
  const previous = stories.filter(
    (s) => s.storyDay < today && s.everInEdition === true,
  );
  const backfillDays = [...new Set(previous.map((s) => s.storyDay))]
    .sort()
    .reverse();
  return [
    ...current,
    ...backfillDays.flatMap((day) =>
      rankStories(previous.filter((s) => s.storyDay === day)),
    ),
  ].slice(0, EDITION_SIZE);
}
