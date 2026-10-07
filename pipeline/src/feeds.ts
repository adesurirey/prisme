import { XMLParser } from 'fast-xml-parser';

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
   * True for an Undated Article (ADR-0007): publishedAt is the end of its
   * Publication day (read from the URL), not an exact feed timestamp.
   */
  dayPrecision?: true;
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

export function parseFeed(xml: string): ParsedFeed {
  const doc = parser.parse(xml);
  const channel = doc.rss?.channel;
  if (channel?.item)
    return {
      items: toArray(channel.item).map(parseRssItem),
      updatedAt: channelDate(channel.lastBuildDate ?? channel.pubDate),
    };
  if (doc.feed?.entry)
    return {
      items: toArray(doc.feed.entry).map(parseAtomEntry),
      updatedAt: channelDate(doc.feed.updated),
    };
  return { items: [], updatedAt: '' };
}

function channelDate(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '' || Number.isNaN(Date.parse(text))) return '';
  return new Date(text).toISOString();
}

function parseAtomEntry(entry: any): ParsedItem {
  const links = entry.link ? toArray(entry.link) : [];
  const alternate = links.find((l) => l.rel !== 'self' && l.href) ?? links[0];
  return withPublicationDay({
    headline: decodeEntities(text(entry.title)),
    url: decodeEntities(text(alternate?.href)),
    publishedAt: entry.published
      ? new Date(entry.published).toISOString()
      : entry.updated
        ? new Date(entry.updated).toISOString()
        : '',
    teaser: decodeEntities(text(entry.summary) || text(entry.content)),
  });
}

/** The `-JJ-MM-AAAA-<id>` tail of an Article URL (Le Parisien convention). */
const SLUG_DATE = /-(\d{2})-(\d{2})-(\d{4})-[^/]*$/;

/**
 * An Undated Article (ADR-0007): the feed gives no time, the URL gives the
 * Publication day. Date it to the end of that Paris day — generous so a
 * yesterday-evening Article stays within the 24h window — and mark it
 * day-precision so the UI never shows the invented hour.
 */
function withPublicationDay(item: ParsedItem): ParsedItem {
  if (item.publishedAt !== '') return item;
  const match = SLUG_DATE.exec(item.url);
  if (!match) return item;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day > daysInMonth(year, month)) return item;
  return {
    ...item,
    publishedAt: endOfParisDay(year, month, day),
    dayPrecision: true,
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

function endOfParisDay(year: number, month: number, day: number): string {
  // Probe at noon UTC (same Paris civil date in both DST regimes).
  const offsetMinutes = parisOffsetMinutes(Date.UTC(year, month - 1, day, 12));
  return new Date(
    Date.UTC(year, month - 1, day, 23, 59, 59) - offsetMinutes * 60_000,
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

function parseRssItem(item: any): ParsedItem {
  return withPublicationDay({
    headline: decodeEntities(text(item.title)),
    url: decodeEntities(text(item.link)),
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : '',
    teaser: decodeEntities(text(item.description)),
    imageUrl: rssImageUrl(item),
  });
}

function rssImageUrl(item: any): string | undefined {
  const enclosure =
    item.enclosure &&
    (item.enclosure.type == null ||
      String(item.enclosure.type).startsWith('image/'))
      ? item.enclosure
      : undefined;
  const media = item['media:content'] ?? item['media:thumbnail'];
  const url = enclosure?.url ?? media?.url;
  return url ? String(url) : undefined;
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
