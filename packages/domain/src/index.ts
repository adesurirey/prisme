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
  /** ISO 8601 publication date, empty string when the feed has none. */
  publishedAt: string;
  /** Image URL from the feed, hotlinked — never stored (ADR-0003). */
  imageUrl?: string;
  /** True when the Article is on the Outlet's Front page (une feed, or one of the 10 most recent). */
  frontPage: boolean;
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

export const ARTICLE_KINDS: ArticleKind[] = ['news', 'opinion', 'live', 'not_news'];

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

/**
 * A news event or topic made up of the Articles that report on it (issue #5).
 * Created once, then extended incrementally: its id and slug never change.
 */
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
}

/** The current selection of top Stories Prisme publishes. */
export interface Edition {
  /** ISO 8601 build time. */
  builtAt: string;
  stories: Story[];
}

// The sourced Outlet config (issue #2): Leanings with citations, readership,
// verified feeds and TDM reservations. See docs/research/outlet-leanings.md.
export * from './outlets.ts';
