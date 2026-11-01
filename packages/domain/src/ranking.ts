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

/** The silence half-life (ADR-0036, Brûlant's first clock since spec
 * #158): every FEED_HALF_LIFE_MS without a new in-window Article halves
 * a Story's weight — the knob that tunes the feed between a short-lived
 * thread and a day-long one. Measured over 18 days of archive
 * (backtest:feed): at 6 h the lead turns over every ~6 h and the top-20
 * shares 16/20 with the Coverage key — the measured middle. */
export const FEED_HALF_LIFE_MS = 6 * 60 * 60 * 1000;

/** The founding half-life (spec #158, Brûlant's second clock): every
 * FEED_FOUNDING_HALF_LIFE_MS since the Story's founding instant
 * (ADR-0026) halves its weight, whatever the coverage flow — the
 * Hacker-News gravity clock, and unlike FEED_HALF_LIFE_MS it never
 * resets. Measured over 18 days of archive (backtest:feed): it cuts the
 * max top-3 residence from 85 h to 44 h while coverage keeps flowing;
 * 12/24/48 h were measured alongside and stay re-gradable by the free
 * replay tool. */
export const FEED_FOUNDING_HALF_LIFE_MS = 18 * 60 * 60 * 1000;

/**
 * The Brûlant ranking key (spec #158, extending ADR-0036's « Le fil »
 * key) — the window where "when" and "how much" both decide, on two
 * clocks: each Story weighs its in-window Coverage — distinct reporting
 * Outlets with at least one Article in the window (Opinion included,
 * ADR-0011), the same basis as rankStoriesInWindow — times an
 * exponential silence decay, halved every FEED_HALF_LIFE_MS since the
 * Story's newest in-window Article, times an exponential founding
 * decay, halved every FEED_FOUNDING_HALF_LIFE_MS since the founding
 * instant (ADR-0026) — a clock that never resets, so however loud the
 * coverage, a Story's weight decays with its age and none squats the
 * top for days. Ties fall to the newest in-window Article desc, then
 * the founding instant desc, then id asc — fully deterministic across
 * builds. Membership (the day pool: at least one Article, any kind,
 * inside the window) lives with the Edition assembly (pipeline,
 * assembleEdition); the key itself is total — a Story with no Article
 * in the window weighs nothing and sorts last, deterministically.
 */
export function rankStoriesFeed(
  stories: Story[],
  windowMs: number,
  now: Date,
): Story[] {
  const t = now.getTime();
  const key = new Map<
    Story,
    { score: number; newest: number; founding: number }
  >();
  for (const story of stories) {
    // articlesInWindow already dropped unparseable instants, so every
    // Date.parse below is a real instant; an empty window leaves
    // newest at 0, whose age dwarfs any half-life — weight 0. The
    // founding (the earliest dated Article) never exceeds the newest
    // in-window Article, so the founding factor never exceeds 1.
    const articles = articlesInWindow(story.articles, windowMs, now);
    const newest = Math.max(
      0,
      ...articles.map((a) => Date.parse(a.publishedAt)),
    );
    const outlets = reportingOutletIds(articles).size;
    const founding = foundingInstant(story) ?? 0;
    key.set(story, {
      score:
        outlets *
        2 ** (-(t - newest) / FEED_HALF_LIFE_MS) *
        2 ** (-(t - founding) / FEED_FOUNDING_HALF_LIFE_MS),
      newest,
      founding,
    });
  }
  return [...stories].sort(
    (a, b) =>
      key.get(b)!.score - key.get(a)!.score ||
      key.get(b)!.newest - key.get(a)!.newest ||
      key.get(b)!.founding - key.get(a)!.founding ||
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
 * inside the rolling last 12 hours) lives with the Edition assembly
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
