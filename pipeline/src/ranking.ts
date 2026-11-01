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

/** The Nouveau founding window (spec #158, widening ADR-0029's twelve
 * hours — kept by ADR-0035 — to a full day): the rolling last 24 hours.
 * The window holds a median of 36 Stories (25–65 over 19 days of
 * archive) and stays uncapped — the window is the cap: the one page
 * where scrolling to the end means having missed nothing. */
export const LATEST_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The ranked-sorts cap (spec #158, ending ADR-0022's uncapped rule):
 * Brûlant and Top slice at RANKED_CAP Stories — the page a visitor
 * lands on stays scannable (median pool 56 → 25), and Nouveau carries
 * the tail. Always active: the pool never fell below 31 Stories over
 * 19 days of archive. */
export const RANKED_CAP = 25;

/** The three Edition windows a build assembles (ADR-0027, ADR-0029,
 * ADR-0036, re-sorted by spec #158; the week window is gone, ADR-0037).
 * Internal keys carry the #158 sort names; the published artifact keeps
 * its pre-#158 field names until the surface rename. */
export interface EditionWindows {
  /** Nouveau — every Story founded within the last LATEST_WINDOW_MS,
   * ranked latest-first, uncapped: the window is the cap (spec #158). */
  new: Story[];
  /** Brûlant — the 24-hour pool re-ranked by the double-decay key:
   * in-window Coverage halved every FEED_HALF_LIFE_MS of silence, then
   * every FEED_FOUNDING_HALF_LIFE_MS of founding age, capped at
   * RANKED_CAP (spec #158). */
  hot: Story[];
  /** Top — the last DAY_WINDOW_MS over all Stories (frozen included),
   * ranked by the in-window Coverage key, capped at RANKED_CAP
   * (spec #158). */
  top: Story[];
}

/**
 * The rolling-window Edition assembly (ADR-0027, amended by ADR-0029's
 * and ADR-0036's windows, re-sorted by spec #158; superseding
 * ADR-0026's open-window pool): windows over ALL Stories — frozen ones
 * included. The pool admits a Story iff at least one of its Articles
 * was published inside the day window; Brûlant re-ranks the pool by the
 * double-decay feed key and Top by the in-window Coverage key, both
 * capped at RANKED_CAP — the cap slices each key's order, it never
 * re-decides membership. A Story leaves la Une by decay — no Outlet
 * reporting it inside the window — never at a clock edge: a Story that
 * just closed keeps sinking until its Articles age out. Nouveau admits
 * a Story iff its founding instant (ADR-0026, the earliest Article
 * publication time) falls inside the last LATEST_WINDOW_MS — ranked
 * latest-first, uncapped: the window is the cap, and the
 * founding-bounded membership makes every member a pool member by
 * construction — a Story founded inside 24 h has all its Articles
 * inside 24 h (ADR-0029, kept by spec #158). The old pre-0026 day tiers
 * and the ADR-0026 storyDay guard are gone; the window bounds alone
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
  const fresh = stories.filter((s) => {
    const founding = foundingInstant(s);
    // Inclusive at both ends, like every window bound: a Story founded
    // exactly 24 hours ago is still Nouveau; a future founding (no
    // dated Article, or a defensive future-dated file) is not.
    return founding != null && founding >= since && founding <= until;
  });
  const pool = members(DAY_WINDOW_MS);
  return {
    new: rankStoriesLatestFirst(fresh),
    hot: rankStoriesFeed(pool, DAY_WINDOW_MS, now).slice(0, RANKED_CAP),
    top: rankStoriesInWindow(pool, DAY_WINDOW_MS, now).slice(0, RANKED_CAP),
  };
}
