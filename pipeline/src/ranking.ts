import type { Story } from '@prisme/domain';
import {
  articlesInWindow,
  rankStories,
  rankStoriesInWindow,
  reportingOutletIds,
} from '@prisme/domain';

export { rankStories, rankStoriesInWindow };

/** The « Aujourd'hui » window (ADR-0027): the last 24 hours, rolling — not
 * calendar-day, so the morning edition still carries the overnight
 * international coverage. */
export const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The « 7 jours » window (ADR-0027): the last 7 days, rolling. */
export const WEEK_WINDOW_MS = 7 * DAY_WINDOW_MS;

/** The « 7 jours » floor (ADR-0027): only Stories covered by at least 10
 * distinct reporting Outlets in the window — ~34 % of the 29 configured
 * Outlets, the measured « significant at the scale of a week » cut. A
 * floor, never a cap: the week's weight sets the list's length. */
export const WEEK_FLOOR_OUTLETS = 10;

/** The two Edition windows a build assembles (ADR-0027). */
export interface EditionWindows {
  /** « Aujourd'hui » — the last DAY_WINDOW_MS over all Stories (frozen
   * included), ranked by the in-window key, uncapped (ADR-0022). */
  day: Story[];
  /** « 7 jours » — the last WEEK_WINDOW_MS, ranked, floored to
   * WEEK_FLOOR_OUTLETS reporting Outlets in the window. */
  week: Story[];
}

/**
 * The rolling-window Edition assembly (ADR-0027, superseding ADR-0026's
 * open-window pool): a window over ALL Stories — frozen ones included —
 * where a Story is a member iff at least one of its Articles was published
 * inside the window, ranked by Coverage counted inside the window. A Story
 * leaves la Une by decay — no Outlet reporting it inside the window —
 * never at a clock edge: a Story that just closed keeps sinking until its
 * Articles age out. The old pre-0026 day tiers and the ADR-0026 storyDay
 * guard are gone; the window bounds alone decide, and their upper bound
 * keeps a future-dated Article out (defensive, hand-edited files).
 */
export function assembleEdition(stories: Story[], now: Date): EditionWindows {
  const members = (windowMs: number) =>
    stories.filter(
      (s) => articlesInWindow(s.articles, windowMs, now).length > 0,
    );
  return {
    day: rankStoriesInWindow(members(DAY_WINDOW_MS), DAY_WINDOW_MS, now),
    week: rankStoriesInWindow(
      members(WEEK_WINDOW_MS),
      WEEK_WINDOW_MS,
      now,
    ).filter(
      (s) =>
        reportingOutletIds(articlesInWindow(s.articles, WEEK_WINDOW_MS, now))
          .size >= WEEK_FLOOR_OUTLETS,
    ),
  };
}
