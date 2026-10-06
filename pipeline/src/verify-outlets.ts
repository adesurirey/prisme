/**
 * Re-checks the evidence recorded in the Outlet config: feed status, item
 * count, time covered and image presence, plus TDM reservations
 * (/.well-known/tdmrep.json), all with a normal browser User-Agent.
 * Prints stats only — feed text (teasers) is never written anywhere (ADR-0003).
 *
 * Usage: pnpm --filter @prisme/pipeline verify
 */
import { pathToFileURL } from 'node:url';
import type { FeedKind, OutletConfig } from '@prisme/domain';
import { outlets } from '@prisme/domain';
import { parseFeed } from './feeds.ts';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

interface FeedReport {
  outletId: string;
  kind: FeedKind;
  url: string;
  /** HTTP status, 0 when the fetch itself failed. */
  status: number;
  items: number;
  withImage: number;
  /** ISO date of the oldest / newest item, empty when the feed has no dates. */
  oldest: string;
  newest: string;
  /** Time covered by the feed's items, in hours. */
  spanHours: number | null;
  error?: string;
}

interface TdmReport {
  outletId: string;
  url: string;
  status: number;
  /** True when a tdm-reservation flag was read. */
  reserved: boolean | null;
  error?: string;
}

export async function reportFeed(
  outletId: string,
  kind: FeedKind,
  url: string,
): Promise<FeedReport> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return unreadReport(outletId, kind, url, response.status);
    const items = parseFeed(await response.text());
    const times = items
      .map((item) => Date.parse(item.publishedAt))
      .filter((time) => Number.isFinite(time) && time > 0)
      .sort((a, b) => a - b);
    const oldest = times[0];
    const newest = times[times.length - 1];
    return {
      outletId,
      kind,
      url,
      status: response.status,
      items: items.length,
      withImage: items.filter((item) => item.imageUrl != null).length,
      oldest: oldest ? new Date(oldest).toISOString() : '',
      newest: newest ? new Date(newest).toISOString() : '',
      spanHours:
        oldest != null && newest != null
          ? Math.round(((newest - oldest) / 3_600_000) * 10) / 10
          : null,
    };
  } catch (error) {
    return {
      ...unreadReport(outletId, kind, url, 0),
      error: errorMessage(error),
    };
  }
}

/** Reads the Outlet's TDM reservation, if it publishes one. */
export async function reportTdm(outlet: OutletConfig): Promise<TdmReport> {
  const url = new URL('/.well-known/tdmrep.json', outlet.site).href;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) return { outletId: outlet.id, url, status: response.status, reserved: null };
    const body = await response.text();
    return {
      outletId: outlet.id,
      url,
      status: response.status,
      reserved: body.includes('"tdm-reservation":1') || body.includes('"tdm-reservation": 1'),
    };
  } catch (error) {
    return {
      outletId: outlet.id,
      url,
      status: 0,
      reserved: null,
      error: errorMessage(error),
    };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A feed that could not be read: zero items, the status says why. */
function unreadReport(outletId: string, kind: FeedKind, url: string, status: number): FeedReport {
  return { outletId, kind, url, status, items: 0, withImage: 0, oldest: '', newest: '', spanHours: null };
}

export async function reportOutlets(): Promise<{ feeds: FeedReport[]; tdm: TdmReport[] }> {
  const checks: { outletId: string; kind: FeedKind; url: string }[] = [];
  for (const outlet of outlets) {
    if (outlet.feeds.une) checks.push({ outletId: outlet.id, kind: 'une', url: outlet.feeds.une });
    if (outlet.feeds.latest) checks.push({ outletId: outlet.id, kind: 'latest', url: outlet.feeds.latest });
  }
  const [feeds, tdm] = await Promise.all([
    Promise.all(checks.map((check) => reportFeed(check.outletId, check.kind, check.url))),
    Promise.all(outlets.map((outlet) => reportTdm(outlet))),
  ]);
  return { feeds, tdm };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(await reportOutlets(), null, 2));
}
