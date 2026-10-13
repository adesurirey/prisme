import type { Story } from '@prisme/domain';
import { rankStories } from '@prisme/domain';
import { formatParisDate } from './paris-date';

/**
 * The archives (issue #99, ADR-0017): the day's record, one page per Story
 * day. Selection comes from the permanent Story files — every Story whose
 * sticky everInEdition flag is true (set the moment the Story ranked into
 * the Edition, issue #75) and whose storyDay is that day — unlimited, no
 * top-20 cut, ordered by the same key as the home (ADR-0009). The pages are
 * derived: nothing here preserves anything on a wipe, and no archive exists
 * for a day whose Stories are gone.
 */

/** One Story day's archive: the ISO day key and its ranked Stories. */
export interface ArchiveDay {
  /** 'YYYY-MM-DD' Story day (ADR-0017). */
  day: string;
  stories: Story[];
}

/**
 * Group the everInEdition Stories by their Story day and rank each day by
 * the Edition key. Days sort newest first, so the first entry is the most
 * recent day with a record.
 */
export function archiveDays(stories: Story[]): ArchiveDay[] {
  const byDay = new Map<string, Story[]>();
  for (const story of stories) {
    if (!story.everInEdition) continue;
    const day = story.storyDay;
    const list = byDay.get(day);
    if (list) list.push(story);
    else byDay.set(day, [story]);
  }
  return [...byDay.entries()]
    .map(([day, dayStories]) => ({ day, stories: rankStories(dayStories) }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

/**
 * The French date for one day key — "mercredi 8 octobre 2026", capital
 * initial. Noon UTC anchors the instant inside the Paris day for every
 * DST shift, so the build host's timezone never leaks in.
 */
export function frenchArchiveDate(day: string): string {
  const label = formatParisDate(new Date(`${day}T12:00:00Z`), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** The archive URL for a day key. */
export function archiveUrl(day: string): string {
  return `/archives/${day}/`;
}

/** A Story-day key is exactly ISO YYYY-MM-DD — the date picker's shape. */
export function isStoryDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
