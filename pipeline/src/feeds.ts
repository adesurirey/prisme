import { XMLParser } from 'fast-xml-parser';

import { COLLECTION_WINDOW_MS } from './liveness.ts';

/**
 * One item as parsed from a feed. Carries the teaser (feed description) in
 * memory only — it must never reach a serialized type (ADR-0003).
 */
export interface ParsedItem {
  headline: string;
  url: string;
  /** ISO 8601, empty string when neither the feed nor the URL has a date. */
  publishedAt: string;
  teaser: string;
  imageUrl?: string;
  /**
   * True for an Undated Article (ADR-0007): the feed carries no clock
   * time, so publishedAt is the collection instant. Provenance marker
   * only; the UI shows the date as received.
   */
  datedAtCollection?: true;
}

export interface ParsedFeed {
  items: ParsedItem[];
  /** ISO 8601 of the channel's last build, empty string when it has none. */
  updatedAt: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  cdataPropName: '__cdata',
});

export function parseFeed(xml: string, now: Date = new Date()): ParsedFeed {
  const doc = parser.parse(xml);
  const channel = doc.rss?.channel;
  if (channel?.item)
    return {
      items: toArray(channel.item)
        .map((item: any) => parseRssItem(item, now))
        .filter((item: ParsedItem | undefined): item is ParsedItem =>
          Boolean(item),
        ),
      updatedAt: channelDate(channel.lastBuildDate ?? channel.pubDate),
    };
  if (doc.feed?.entry)
    return {
      items: toArray(doc.feed.entry)
        .map((entry: any) => parseAtomEntry(entry, now))
        .filter((item: ParsedItem | undefined): item is ParsedItem =>
          Boolean(item),
        ),
      updatedAt: channelDate(doc.feed.updated),
    };
  return { items: [], updatedAt: '' };
}

function channelDate(value: unknown): string {
  return isoDate(value);
}

function parseAtomEntry(entry: any, now: Date): ParsedItem | undefined {
  const links = entry.link ? toArray(entry.link) : [];
  const alternate = links.find((l) => l.rel !== 'self' && l.href) ?? links[0];
  return withPublicationDay(
    {
      headline: stripEmojis(decodeEntities(text(entry.title))),
      url: decodeEntities(text(alternate?.href)),
      publishedAt: entry.published
        ? new Date(entry.published).toISOString()
        : entry.updated
          ? new Date(entry.updated).toISOString()
          : '',
      teaser: teaserFrom(entry.summary || entry.content, text(entry.title), ''),
    },
    now,
  );
}

/** The `-JJ-MM-AAAA-<id>` tail of an Article URL (Le Parisien convention). */
const SLUG_DATE = /-(\d{2})-(\d{2})-(\d{4})-[^/]*$/;

/**
 * An Undated Article (ADR-0007): the feed gives no time. The URL's
 * Publication day (Le Parisien convention) serves only as a freshness
 * guard — the Article is stamped with the exact collection instant, never
 * an invented clock time, and marked so the arbitrariness stays recorded.
 * An Article whose URL day is older than the collection window is dropped:
 * the collection stamp must not resurrect archive headlines as fresh.
 */
function withPublicationDay(
  item: ParsedItem,
  now: Date,
): ParsedItem | undefined {
  if (item.publishedAt !== '') return item;
  const match = SLUG_DATE.exec(item.url);
  if (!match) return item;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day > daysInMonth(year, month)) return item;
  if (
    Date.parse(startOfParisDay(year, month, day)) <
    now.getTime() - COLLECTION_WINDOW_MS
  )
    return undefined;
  return {
    ...item,
    publishedAt: now.toISOString(),
    datedAtCollection: true,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The Paris offset (minutes) in effect at a UTC instant. */
function parisOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return (asUtc - utcMs) / 60_000;
}

function startOfParisDay(year: number, month: number, day: number): string {
  // Probe at noon UTC (same Paris civil date in both DST regimes).
  const offsetMinutes = parisOffsetMinutes(Date.UTC(year, month - 1, day, 12));
  return new Date(
    Date.UTC(year, month - 1, day) - offsetMinutes * 60_000,
  ).toISOString();
}

const namedEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/**
 * Decode HTML entities left in place by the XML parser (it deliberately does
 * not touch CDATA content). Handles named, decimal and hex numeric refs.
 */
function decodeEntities(value: string): string {
  return value.replace(
    /&(?:(amp|lt|gt|quot|apos|nbsp)|#x([0-9a-fA-F]+)|#(\d+));/g,
    (_, named, hex, decimal) => {
      if (named) return namedEntities[named] ?? _;
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      return String.fromCodePoint(Number(decimal));
    },
  );
}

function parseRssItem(item: any, now: Date): ParsedItem | undefined {
  const headline = stripEmojis(decodeEntities(text(item.title)));
  // Aggregator mirrors (Google News) suffix headlines with " - Source":
  // the <source> element names the Outlet, so the suffix can be dropped
  // by construction rather than per-outlet (ADR-0021).
  const source = text(item.source);
  const suffix = source ? ` - ${source}` : '';
  const bareHeadline =
    suffix && headline.endsWith(suffix)
      ? headline.slice(0, -suffix.length)
      : headline;
  return withPublicationDay(
    {
      headline: bareHeadline,
      url: decodeEntities(text(item.link)),
      publishedAt: isoDate(item.pubDate),
      teaser: teaserFrom(item.description, bareHeadline, source),
      imageUrl: rssImageUrl(item),
    },
    now,
  );
}

/**
 * Mirror feeds (Google News, ADR-0021) carry no teaser: their description
 * is HTML wrapping the headline and the source name. Strip the tags and the
 * source name; drop the result when it only repeats the headline — the
 * Decision model must not read the same sentence twice.
 */
function teaserFrom(
  description: unknown,
  headline: string,
  source: string,
): string {
  const plain = decodeEntities(text(description))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutSource =
    source && plain.endsWith(source)
      ? plain.slice(0, -source.length).trim()
      : plain;
  if (withoutSource === headline) return '';
  return withoutSource.startsWith(headline)
    ? withoutSource.slice(headline.length).trim()
    : withoutSource;
}

/**
 * Some outlets prefix their headlines with emojis (🔴, ⚽, …). They add noise
 * to the UI and the prompts, so strip them — including the variation-selector
 * and ZWJ sequences they can be part of.
 */
function stripEmojis(value: string): string {
  return value
    .replace(
      /\p{Extended_Pictographic}(\uFE0F|\u200D\p{Extended_Pictographic})*/gu,
      '',
    )
    .replace(/ {2,}/g, ' ')
    .trim();
}

function rssImageUrl(item: any): string | undefined {
  const enclosure =
    item.enclosure &&
    (item.enclosure.type == null ||
      String(item.enclosure.type).startsWith('image/'))
      ? item.enclosure
      : undefined;
  // Blast (and others) wrap media:content inside media:group.
  const group = item['media:group'];
  const media =
    item['media:content'] ??
    item['media:thumbnail'] ??
    group?.['media:content'] ??
    group?.['media:thumbnail'];
  const url = enclosure?.url ?? media?.url;
  return url ? String(url) : undefined;
}

/**
 * CDATA-safe, invalid-date-safe ISO 8601 conversion: some feeds (Challenges)
 * wrap pubDate in CDATA and date parsing must never throw on a bad value.
 */
function isoDate(value: unknown): string {
  const raw = text(value);
  if (raw === '' || Number.isNaN(Date.parse(raw))) return '';
  return new Date(raw).toISOString();
}

/** fast-xml-parser collapses single-element arrays to a bare value; normalise. */
function toArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [value];
}

/** Fast-xml-parser returns strings, { __cdata } or { #text } objects, or arrays; normalise. */
function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('__cdata' in obj) return text(obj.__cdata);
    if ('#text' in obj) return text(obj['#text']);
  }
  if (typeof value === 'number') return String(value);
  return '';
}
