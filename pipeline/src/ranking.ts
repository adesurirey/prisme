import type { Story } from '@prisme/domain';
import { rankStories } from '@prisme/domain';
import { ingestionIsOpen, parisDayKey } from './paris-day.ts';

export { rankStories };

/**
 * The dated Edition assembly (ADR-0022, superseding ADR-0017's backfill
 * tier): the Edition is every live Story — today's Stories, and yesterday's
 * until 06:00 Paris — ranked by the ADR-0009 key, with no cut. The old
 * `EDITION_SIZE = 20` cap was the Gemini free tier's Summaries budget
 * leaking into editorial visibility; the budget now lives in `summarize.ts`
 * (top-20 ranked Stories per build gain a Summaries call) while every Story
 * stays visible. Backfill — closed previous days' `everInEdition` Stories —
 * is gone: with 21–43 Stories observed per day the live pool alone covers
 * the start of a new day, and uncapped backfill would grow the Edition
 * forever with frozen Stories; previous days belong to the archive pages.
 * A Story born right after midnight still ranks in (issue #75: it acquires
 * `everInEdition` and survives its freezing, as a deletion-rule guardrail).
 * Stories from a future day are dropped (defensive; the Grouping model
 * cannot create them).
 */
export function assembleEdition(stories: Story[], now: Date): Story[] {
  const today = parisDayKey(now.toISOString());
  const open = stories.filter(
    (s) => s.storyDay <= today && ingestionIsOpen(s.storyDay, now),
  );
  return rankStories(open);
}
