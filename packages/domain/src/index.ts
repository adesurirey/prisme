/**
 * Shared domain types for Prisme. Names follow GLOSSARY.md.
 * Code and data keys are in English; the UI is in French.
 *
 * Note: teasers (feed "description" text) are deliberately absent from every
 * type here — ADR-0003, as amended by ADR-0027: outlet text lives only in
 * the pipeline's private, gitignored cache and is never published,
 * committed or rendered. These types never carry it.
 */

import type { Reach } from './outlets.ts';

/**
 * The political position assigned to an Outlet, never to an Article (ADR-0001):
 * five bands, hand-set from the cited sources (docs/research/outlet-leanings.md,
 * issue #46). Coverage and Summaries group them into three buckets — see
 * `CoverageGroup` in coverage.ts.
 */
export type Leaning =
  | 'gauche'
  | 'centre-gauche'
  | 'centre'
  | 'centre-droite'
  | 'droite';

/** Per-Outlet paywall badge shown in the UI. */
export type Paywall = 'none' | 'partial' | 'full';

/** A widely read French general-news publisher Prisme reads. */
export interface Outlet {
  /** Stable identifier, used in data files and URLs. */
  id: string;
  /** Public name as shown in the UI (French display name). */
  name: string;
  /** Fixed by hand in config, backed by sources (ADR-0001). */
  leaning: Leaning;
  paywall: Paywall;
  /** The Outlet's website (not "homepage": GLOSSARY reserves Front page). */
  site: string;
  /** At least one feed: the "une" (front page) feed and/or a latest/all feed. */
  feeds: {
    une?: string;
    latest?: string;
  };
  /** One raw, sourced Reach figure (issue #87): the Exposition weight the
   * site build computes the shares from (issue #89). */
  reach: Reach;
}

/**
 * A single piece published by one Outlet, as collected from RSS.
 * This is the *public* shape: no teaser, no feed text.
 */
export interface Article {
  /** Stable across editions (hash of the canonical URL). */
  id: string;
  outletId: string;
  headline: string;
  url: string;
  /**
   * ISO 8601 publication date. For an Undated Article (ADR-0007), the
   * exact collection instant — the feed carries no clock time.
   */
  publishedAt: string;
  /** Image URL from the feed, hotlinked — never stored (ADR-0003). */
  imageUrl?: string;
  /**
   * True for an Undated Article (ADR-0007): the feed carries no clock
   * time, so publishedAt is the collection instant — an arbitrary time
   * assigned at collection. Provenance marker only; the UI shows the
   * date as received. Absent means an exact publication time from the
   * feed.
   */
  datedAtCollection?: true;
  /**
   * True when the Article is on the Outlet's Front page — declared by the
   * Outlet via its une feed, never inferred (ADR-0008).
   */
  frontPage: boolean;
  /**
   * True once the Article has been seen on its Outlet's Front page during its
   * lifetime (issue #6): sticky across builds, never reset while the Article
   * lives. Absent means never seen there. Frozen Stories keep the final state.
   */
  everFrontPage?: boolean;
  /**
   * Assigned by the Decision model from the headline and teaser (issue #4).
   * Absent when classification failed: the Article is kept, unclassified.
   * A not_news Article never reaches the Edition.
   */
  kind?: ArticleKind;
  /** The Article's Section, from the same Decision model answer (issue #5). */
  section?: Section;
}

/** The classification of an Article: news, opinion, live or not_news. */
export type ArticleKind = 'news' | 'opinion' | 'live' | 'not_news';

export const ARTICLE_KINDS: ArticleKind[] = [
  'news',
  'opinion',
  'live',
  'not_news',
];

/** The part of the news a Story belongs to (issue #4). */
export type Section =
  | 'politics'
  | 'world'
  | 'economy'
  | 'society'
  | 'sport'
  | 'culture'
  | 'science'
  | 'misc'
  | 'other';

export const SECTIONS: Section[] = [
  'politics',
  'world',
  'economy',
  'society',
  'sport',
  'culture',
  'science',
  'misc',
  'other',
];

/** French UI labels for Sections; keys are the English data values. */
export const SECTION_LABELS: Record<Section, string> = {
  politics: 'Politique',
  world: 'International',
  economy: 'Économie',
  society: 'Société',
  sport: 'Sport',
  culture: 'Culture',
  science: 'Sciences/Tech',
  misc: 'Faits divers',
  other: 'Autre',
};

/** French UI labels for Leanings; keys are the data values. */
export const LEANING_LABELS: Record<Leaning, string> = {
  gauche: 'Gauche',
  'centre-gauche': 'Centre gauche',
  centre: 'Centre',
  'centre-droite': 'Centre droit',
  droite: 'Droite',
};

/** All five Leanings in their fixed display order (Gauche → Droite). */
export const leaningOrder: Leaning[] = [
  'gauche',
  'centre-gauche',
  'centre',
  'centre-droite',
  'droite',
];

/**
 * A news event or topic made up of the Articles that report on it (issue #5).
 * Created once, then extended incrementally: its id and slug never change.
 */
/** Per-Leaning bullet-point account of a Story, written by the Summaries model (ADR-0006). */
export interface StorySummaries {
  gauche?: string[];
  centre?: string[];
  droite?: string[];
}

export interface Story {
  /** 12 hex chars, assigned once at creation — never the Article's id. */
  id: string;
  /** Stable slug used in /sujet/<slug>, fixed at creation, never changes. */
  slug: string;
  /** Neutral French title written by the Title pass; may change over time. */
  title: string;
  /** ISO 8601 creation time, fixed at creation. */
  createdAt: string;
  /** Publication day 'YYYY-MM-DD' (Europe/Paris) of the founding Article,
   * fixed at creation — an Article may only join a Story of its own day
   * (ADR-0017). */
  storyDay: string;
  articles: Article[];
  /** From the majority of its Articles' Sections; absent when none is classified. */
  section?: Section;
  /** Per-Leaning Summaries, only for Leanings that cover the Story (issue #7, ADR-0006). */
  summaries?: StorySummaries;
  /** The model's comparison of how each Leaning's media treat the Story, as
   * bullets: exactly one treatment bullet per covered Leaning (angle,
   * vocabulary, hidden or ignored facts) — within-Leaning divergences
   * between bands live inside that bullet, never as a separate one
   * (prompt sum-6). */
  differences?: string[];
  /** Version of the Summaries prompt that wrote these fields (ADR-0006). */
  promptVersion?: string;
  /** ISO instant the last Summaries pass that wrote these fields ran —
   *  the recorded fact behind the « Faits nouveaux » badge (ADR-0031): stamped
   *  on every actual rewrite, first summarization included; absent on
   *  Stories not (re-)summarized since the field exists. */
  summarizedAt?: string;
  /** Number of Articles the last Summaries run saw; Articles are append-only. */
  summarizedArticleCount?: number;
  /** Number of Articles the last Title pass saw; Articles are append-only. */
  titledArticleCount?: number;
  /** Sticky: true once the Story ranked into the Edition (issue #75). */
  everInEdition?: boolean;
  /** The Story's Topic (ADR-0024): a thread of Episodes, assigned once at
   * birth — the founding Story's own id when it founds its Topic. Absent
   * on Stories born before Topics existed: no retro-assignment. */
  topicId?: string;
}

/** One Topic in the registry (ADR-0024): a thread of Episodes founded by one
 * Story. The id is the founding Story's id (immutable); the label is its
 * final title at founding. */
export interface Topic {
  topicId: string;
  /** Public URL slug, minted once at confirmation from the short label —
   * its own namespace, never a Story slug (ADR-0024). Immutable with the
   * label it derives from. */
  slug: string;
  title: string;
  /** Short display label, two or three words naming the thread — the most
   * distinctive repeated word pair of its headlines (ADR-0024), computed
   * once at confirmation. Not an article title. */
  label: string;
  storyDay: string;
  createdAt: string;
}

/** The Topic registry — data/topics.json, written when a build founds Topics. */
export interface TopicRegistry {
  topics: Topic[];
}

/** The current selection of top Stories Prisme publishes: the three
 * rolling windows of ADR-0027 (as amended by ADR-0029), re-derived at
 * every build over all Stories — frozen ones included. */
export interface Edition {
  /** ISO 8601 build time. */
  builtAt: string;
  /** « En direct » (`/en-direct/`): every Story whose founding instant
   * (ADR-0026, the earliest Article publication time) falls within the
   * rolling last 12 hours before builtAt, ranked latest-first
   * (rankStoriesLatestFirst), uncapped and unfloored — the window is the
   * cap. Always a subset of `stories` by construction (ADR-0029). */
  latestStories: Story[];
  /** « Le fil » (`/le-fil/`): every Story with at least one Article in
   * the rolling last 24 hours — « Aujourd'hui »'s pool, re-ranked — by
   * the coverage-weighted feed key (rankStoriesFeed): in-window
   * Coverage halved every FEED_HALF_LIFE_MS since the newest in-window
   * Article, uncapped and unfloored (ADR-0036). */
  feedStories: Story[];
  /** « Aujourd'hui » (the home): the last-24-hours window, ranked by
   * Coverage counted inside the window, uncapped (ADR-0022, ADR-0027). */
  stories: Story[];
  /** « 7 jours » (`/7-jours/`): the last-7-days window, ranked by the
   * same in-window key, floored to Stories covered by at least 10
   * Outlets publishing in the window (ADR-0027). */
  weekStories: Story[];
}

// The Story cover rule: which Article's image represents the Story, scored
// on URL quality and freshness — no Leaning involved.
export * from './cover.ts';
export * from './coverage.ts';
// The Exposure rule: Reach-weighted shares per Coverage group (issue #88).
export * from './exposure.ts';
// The ADR-0027 growth gate: one function, one meaning — the pipeline's AI
// passes today, the web's « Faits nouveaux » badge from here as it ships
// (ADR-0029).
export * from './growth.ts';
// Story instant derivations (ADR-0026/0027): founding and newest instants,
// computed on demand, never stored.
export * from './instants.ts';
// The sourced Outlet config (issue #2): Leanings with citations, readership,
// verified feeds and TDM reservations. See docs/research/outlet-leanings.md.
export * from './outlets.ts';
// The Edition ranking key (issue #37, ADR-0009): shared by the Edition cut
// and the archive pages (issue #99, ADR-0017).
export * from './ranking.ts';
// Redirects between Story URLs, written by the manual-merge CLI.
export * from './redirect.ts';
export * from './split-per-outlet.ts';
export * from './story-file.ts';
