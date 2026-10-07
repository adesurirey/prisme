/**
 * Shared domain types for Prisme. Names follow GLOSSARY.md.
 * Code and data keys are in English; the UI is in French.
 *
 * Note: teasers (feed "description" text) are deliberately absent from every
 * type here — ADR-0003: outlet text is never stored or published. The
 * collector keeps teasers in memory only and these types never carry them.
 */

/** The political position assigned to an Outlet, never to an Article (ADR-0001). */
export type Leaning = 'gauche' | 'centre' | 'droite';

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
   * ISO 8601 publication date. For an Undated Article (dayPrecision), the end
   * of its Publication day (ADR-0007) — the feed carries no clock time.
   */
  publishedAt: string;
  /** Image URL from the feed, hotlinked — never stored (ADR-0003). */
  imageUrl?: string;
  /**
   * True when the Article is on the Outlet's Front page — declared by the
   * Outlet via its une feed, never inferred (ADR-0008).
   */
  frontPage: boolean;
  /**
   * True for an Undated Article (ADR-0007): only its Publication day is
   * known, so the UI shows the date without a time of day. Absent means an
   * exact publication time.
   */
  dayPrecision?: true;
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

/** French UI labels for Leanings; keys are the English data values. */
export const LEANING_LABELS: Record<Leaning, string> = {
  gauche: 'Gauche',
  centre: 'Centre',
  droite: 'Droite',
};

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
  /** Neutral French title written by the Grouping model; may change over time. */
  title: string;
  /** ISO 8601 creation time, fixed at creation. */
  createdAt: string;
  articles: Article[];
  /** From the majority of its Articles' Sections; absent when none is classified. */
  section?: Section;
  /** Per-Leaning Summaries, only for Leanings that cover the Story (issue #7, ADR-0006). */
  summaries?: StorySummaries;
  /** The model's comparison of how the Leanings frame the Story. */
  differences?: string;
  /** Version of the Summaries prompt that wrote these fields (ADR-0006). */
  promptVersion?: string;
  /** Number of Articles the last Summaries run saw; Articles are append-only. */
  summarizedArticleCount?: number;
}

/** The current selection of top Stories Prisme publishes. */
export interface Edition {
  /** ISO 8601 build time. */
  builtAt: string;
  stories: Story[];
}

export * from './coverage.ts';
// The sourced Outlet config (issue #2): Leanings with citations, readership,
// verified feeds and TDM reservations. See docs/research/outlet-leanings.md.
export * from './outlets.ts';
