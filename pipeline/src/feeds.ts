import { XMLParser } from 'fast-xml-parser';

/**
 * One item as parsed from a feed. Carries the teaser (feed description) in
 * memory only — it must never reach a serialized type (ADR-0003).
 */
export interface ParsedItem {
  headline: string;
  url: string;
  /** ISO 8601, empty string when the feed has no date. */
  publishedAt: string;
  teaser: string;
  imageUrl?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  cdataPropName: '__cdata',
});

export function parseFeed(xml: string): ParsedItem[] {
  const doc = parser.parse(xml);
  const channel = doc.rss?.channel;
  if (channel?.item) return toArray(channel.item).map(parseRssItem);
  if (doc.feed?.entry) return toArray(doc.feed.entry).map(parseAtomEntry);
  return [];
}

function parseAtomEntry(entry: any): ParsedItem {
  const links = entry.link ? toArray(entry.link) : [];
  const alternate = links.find((l) => l.rel !== 'self' && l.href) ?? links[0];
  return {
    headline: text(entry.title),
    url: text(alternate?.href),
    publishedAt: entry.published
      ? new Date(entry.published).toISOString()
      : entry.updated
        ? new Date(entry.updated).toISOString()
        : '',
    teaser: text(entry.summary) || text(entry.content),
  };
}

function parseRssItem(item: any): ParsedItem {
  return {
    headline: text(item.title),
    url: text(item.link),
    publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : '',
    teaser: text(item.description),
    imageUrl: rssImageUrl(item),
  };
}

function rssImageUrl(item: any): string | undefined {
  const enclosure = item.enclosure && (item.enclosure.type == null || String(item.enclosure.type).startsWith('image/'))
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
