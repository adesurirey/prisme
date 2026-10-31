import type { Story } from '@prisme/domain';
import {
  articlesInWindow,
  FEED_HALF_LIFE_MS,
  foundingInstant,
  rankStories,
  rankStoriesFeed,
  rankStoriesInWindow,
  rankStoriesLatestFirst,
} from '@prisme/domain';

export {
  rankStories,
  rankStoriesFeed,
  rankStoriesInWindow,
  rankStoriesLatestFirst,
};

/** The « Aujourd'hui » window (ADR-0027): the last 24 hours, rolling — not
 * calendar-day, so the morning edition still carries the overnight
 * international coverage. */
export const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The « En direct » window (ADR-0029, widened by ADR-0035): the rolling
 * last 12 hours. The window holds a median of 19 Stories (p75 25, max 48)
 * — ADR-0029's 15-Story ceiling answered the superseded novelty-signal
 * framing and is lifted: En direct is the chronological thread of the
 * news, and the list's length is the news's density. No cap, no floor:
 * the window is the cap. */
export const LATEST_WINDOW_MS = 12 * 60 * 60 * 1000;

/** The three Edition windows a build assembles (ADR-0027, ADR-0029,
 * ADR-0036; the week window is gone, ADR-0037). */
export interface EditionWindows {
  /** « En direct » — every Story founded within the last LATEST_WINDOW_MS,
   * ranked latest-first, uncapped and unfloored (ADR-0029). */
  latest: Story[];
  /** « Le fil » — « Aujourd'hui »'s pool re-ranked by the coverage-weighted
   * feed key: in-window Coverage halved every FEED_HALF_LIFE_MS since the
   * newest in-window Article, uncapped and unfloored (ADR-0036). */
  feed: Story[];
  /** « Aujourd'hui » — the last DAY_WINDOW_MS over all Stories (frozen
   * included), ranked by the in-window key, uncapped (ADR-0022). */
  day: Story[];
}

/**
 * The rolling-window Edition assembly (ADR-0027, amended by ADR-0029's
 * and ADR-0036's windows; superseding ADR-0026's open-window pool):
 * windows over ALL Stories — frozen ones included. « Aujourd'hui »
 * admits a Story iff at least one of its Articles was published
 * inside the window, ranked by Coverage counted inside the window; a
 * Story leaves la Une by decay — no Outlet reporting it inside the
 * window — never at a clock edge: a Story that just closed keeps sinking
 * until its Articles age out. « Le fil » (ADR-0036) takes « Aujourd'hui »'s
 * pool as-is and re-ranks it by the feed key: in-window Coverage halved
 * every FEED_HALF_LIFE_MS since the newest in-window Article — the
 * coverage-weighted timeline. « En direct » admits a Story iff its founding
 * instant (ADR-0026, the earliest Article publication time) falls inside
 * the last 12 hours — ranked latest-first, uncapped and unfloored: the
 * window is the cap, and the founding-bound membership makes every member
 * a « Aujourd'hui » Story by construction (ADR-0029). The old pre-0026 day
 * tiers and the ADR-0026 storyDay guard are gone; the window bounds alone
 * decide, and their upper bound keeps a future-dated Article out
 * (defensive, hand-edited files).
 */
export function assembleEdition(stories: Story[], now: Date): EditionWindows {
  const members = (windowMs: number) =>
    stories.filter(
      (s) => articlesInWindow(s.articles, windowMs, now).length > 0,
    );
  const until = now.getTime();
  const since = until - LATEST_WINDOW_MS;
  const latest = stories.filter((s) => {
    const founding = foundingInstant(s);
    // Inclusive at both ends, like every window bound: a Story founded
    // exactly 12 hours ago is still En direct; a future founding (no
    // dated Article, or a defensive future-dated file) is not.
    return founding != null && founding >= since && founding <= until;
  });
  const dayMembers = members(DAY_WINDOW_MS);
  return {
    latest: rankStoriesLatestFirst(latest),
    feed: rankStoriesFeed(dayMembers, DAY_WINDOW_MS, now),
    day: rankStoriesInWindow(dayMembers, DAY_WINDOW_MS, now),
  };
}
