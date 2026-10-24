import { reportingOutletIds } from './coverage.ts';
import type { Article, Story } from './index.ts';
import { foundingInstant, newestInstant, parseInstant } from './instants.ts';

/**
 * The whole-life Edition ranking key (issue #37, ADR-0009 as amended by
 * ADR-0011): Stories order by Coverage — distinct Outlets with any Article
 * on the Story, Opinion pieces included — then by the newest Article, then
 * by creation time and id — fully deterministic across builds. Since
 * ADR-0027 the Editions themselves rank inside rolling windows
 * (rankStoriesInWindow); this whole-life key remains the manual merge
 * tooling's in-place re-rank. The archive pages (issue #99, ADR-0017)
 * reuse it per Story day, with no cut. Front-page flags never participate
 * in ranking; ADR-0008 keeps them as display metadata only.
 */
function latestPublished(story: Story): number {
  return newestInstant(story) ?? 0;
}

export function rankStories(stories: Story[]): Story[] {
  const reporting = new Map<Story, number>();
  for (const story of stories) {
    reporting.set(story, reportingOutletIds(story.articles).size);
  }
  return [...stories].sort(
    (a, b) =>
      reporting.get(b)! - reporting.get(a)! ||
      latestPublished(b) - latestPublished(a) ||
      a.createdAt.localeCompare(b.createdAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * The Articles published inside the rolling window `[now − windowMs, now]`,
 * inclusive at both ends (ADR-0027): the membership basis of the Edition
 * windows. An Article whose `publishedAt` does not parse never falls in a
 * window; a future-dated one is kept out by the upper bound (defensive —
 * the pipeline never produces one).
 */
export function articlesInWindow(
  articles: Article[],
  windowMs: number,
  now: Date,
): Article[] {
  const until = now.getTime();
  const since = until - windowMs;
  const inWindow: Article[] = [];
  for (const article of articles) {
    const t = parseInstant(article.publishedAt);
    if (t != null && t >= since && t <= until) inWindow.push(article);
  }
  return inWindow;
}

/**
 * The rolling-window ranking (ADR-0027, amending ADR-0009): the Coverage
 * key of rankStories above, counted over the Articles published inside the
 * window only — distinct reporting Outlets with at least one Article in the
 * window (Opinion included, ADR-0011), tie-broken by the newest Article in
 * the window, then by creation time and id — fully deterministic across
 * builds. Stories with no Article in the window sort last, deterministically;
 * the Edition cut filters them out before ranking (pipeline, assembleEdition).
 */
export function rankStoriesInWindow(
  stories: Story[],
  windowMs: number,
  now: Date,
): Story[] {
  const key = new Map<Story, { outlets: number; newest: number }>();
  for (const story of stories) {
    // articlesInWindow already dropped unparseable instants, so every
    // Date.parse below is a real instant.
    const articles = articlesInWindow(story.articles, windowMs, now);
    key.set(story, {
      outlets: reportingOutletIds(articles).size,
      newest: Math.max(0, ...articles.map((a) => Date.parse(a.publishedAt))),
    });
  }
  return [...stories].sort(
    (a, b) =>
      key.get(b)!.outlets - key.get(a)!.outlets ||
      key.get(b)!.newest - key.get(a)!.newest ||
      a.createdAt.localeCompare(b.createdAt) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

/**
 * The « En direct » ranking key (ADR-0029) — the one window whose question
 * is "when", not "how much": founding instant desc (ADR-0026, the earliest
 * Article publication time), then the newest Article desc, then the
 * whole-life Coverage desc — distinct reporting Outlets, Opinion included
 * (ADR-0011); for window members the whole-life and in-window Coverage
 * coincide, and whole-life keeps the key self-contained — then id asc,
 * fully deterministic across builds. Membership (the founding instant
 * inside the rolling last 8 hours) lives with the Edition assembly
 * (pipeline, assembleEdition); the key itself is total — a Story with no
 * dated Article sorts last, deterministically.
 */
export function rankStoriesLatestFirst(stories: Story[]): Story[] {
  const key = new Map<
    Story,
    { founding: number; newest: number; outlets: number }
  >();
  for (const story of stories) {
    key.set(story, {
      founding: foundingInstant(story) ?? 0,
      newest: newestInstant(story) ?? 0,
      outlets: reportingOutletIds(story.articles).size,
    });
  }
  return [...stories].sort(
    (a, b) =>
      key.get(b)!.founding - key.get(a)!.founding ||
      key.get(b)!.newest - key.get(a)!.newest ||
      key.get(b)!.outlets - key.get(a)!.outlets ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
