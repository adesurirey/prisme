/**
 * The Story activity graph (« chronologie de couverture »): Articles over
 * time, binned, split per Coverage group. Pure build-time math — the charts
 * are prerendered SVG (zero client JS), so every window here is anchored at
 * the edition's build instant, never at "now".
 *
 * Two windows feed the charts (ADR-0030):
 * - Cards roll with their edition: the rolling last 24 hours in 24 hourly
 *   bins on « Aujourd'hui » / « En direct », the rolling last 7 days in 7
 *   day bins on « 7 jours ». Articles outside the window are excluded —
 *   never clamped into an edge bin (a fabricated midnight burst is worse
 *   than a small mismatch with the « X articles » count).
 * - The Story page shows the Story's whole life: first→last Article,
 *   hourly bins while the span stays within 48 hours, day bins beyond.
 *
 * Hour bins align to clock hours; day bins align to Europe/Paris midnights
 * (the reader's clock), never the build host's timezone — same rule as
 * paris-date.ts. Around DST the Paris day is 23 or 25 hours, so day bins
 * are placed per Paris calendar day, never by a fixed 24h stride.
 */

import type { Article, CoverageGroup, Outlet } from '@prisme/domain';
import { coverageGroup } from '@prisme/domain';
import { formatParisDate } from './paris-date';

const PARIS_TZ = 'Europe/Paris';

/** One bin of Story activity: Articles per Coverage group in `[start, end)`. */
export interface ActivityBin {
  /** Bin start, epoch ms (inclusive). */
  start: number;
  /** Bin end, epoch ms (exclusive). */
  end: number;
  /** Article counts per Coverage group; unknown Outlets count in `total` only. */
  counts: Record<CoverageGroup, number>;
  /** Every Article in the bin — the same basis as `countedArticles()`. */
  total: number;
}

/** A time window to bin into: `[start, end)` cut into `binMs`-wide bins.
 *  `label` names the window in reader words for the sparkline's aria line
 *  (« 24 h », « 7 jours »); the life window has none — the Story page chart
 *  speaks its span instead (`activitySpanLabel`). */
export interface ActivityWindow {
  start: number;
  end: number;
  /** Nominal bin width; day bins around a DST switch may be 23h or 25h. */
  binMs: number;
  /** The window in reader words, or undefined for the life window. */
  label?: string;
}

/** A rolling edition window (card sparklines): always carries its reader
 *  label — the life window (Story page chart) is the one without one. */
export interface EditionActivityWindow extends ActivityWindow {
  /** The window in reader words: « 24 h », « 7 jours ». */
  label: string;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Rolling last 24 hours, 24 hourly bins — the last one partial unless the
 *  build instant falls exactly on the hour. `end` is exclusive: an exact
 *  hour closes the window on the bin before it, never a phantom empty one.
 */
export function dayActivityWindow(built: Date): EditionActivityWindow {
  const end = built.getTime();
  const lastBinStart = Math.floor((end - 1) / HOUR_MS) * HOUR_MS;
  return {
    start: lastBinStart - 23 * HOUR_MS,
    end,
    binMs: HOUR_MS,
    label: '24 h',
  };
}

/**
 * The UTC instant of Paris midnight of the Paris calendar day `ymd`
 * (`YYYY-MM-DD`). Paris is UTC+01 or UTC+02 all year (DST turns at 03:00
 * local, never at midnight), so exactly one of the two offsets is midnight
 * — the other lands at 01:00 or on the wrong day, so both the date and the
 * 00:00 time are verified by formatting back.
 */
function parisMidnight(ymd: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  for (const offset of ['+01:00', '+02:00'] as const) {
    const ms = Date.parse(`${ymd}T00:00:00${offset}`);
    const read = Object.fromEntries(
      parts.formatToParts(new Date(ms)).map((p) => [p.type, p.value]),
    );
    if (
      `${read.year}-${read.month}-${read.day}` === ymd &&
      read.hour === '00' &&
      read.minute === '00'
    ) {
      return ms;
    }
  }
  throw new Error(`no Paris midnight for ${ymd}`);
}

/** The Paris calendar day (en-CA `YYYY-MM-DD`) of an instant. */
function parisYmd(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

/** Rolling last 7 days, 7 day bins, each starting at a Paris midnight —
 *  the last one partial (today so far). Bins are placed per Paris calendar
 *  day, so a DST switch inside the window yields one 23h and one 25h bin
 *  instead of drifting hour bins. `end` is exclusive, same as the day
 *  window: a build at Paris midnight closes on the day before.
 */
export function weekActivityWindow(built: Date): EditionActivityWindow {
  const end = built.getTime();
  const lastBinStart = parisMidnight(parisYmd(end - 1));
  const [year, month, day] = parisYmd(lastBinStart).split('-').map(Number);
  // Six Paris days back, by calendar arithmetic on the day number — a
  // fixed 24h stride would land 23:00 Paris after the autumn switch.
  const first = new Date(Date.UTC(year!, month! - 1!, day! - 6, 12));
  return {
    start: parisMidnight(parisYmd(first.getTime())),
    end,
    binMs: DAY_MS,
    label: '7 jours',
  };
}

// ---------------------------------------------------------------------------
// Binning, life window, labels.

/** Nominal width from which a bin counts as day-scale (labels, DST-proof
 *  generation): day bins are 23–25h wide, hour bins 1h. */
const DAY_SCALE_MS = DAY_MS / 2;

/** Next bin end, given the bin starts and the window's exclusive end. */
function binEnd(
  starts: number[],
  index: number,
  window: ActivityWindow,
): number {
  return index < starts.length - 1 ? starts[index + 1]! : window.end;
}

/**
 * The bin starts of a window: a fixed stride for hour bins (clock hours are
 * timezone-proof), Paris calendar days for day bins (a DST switch makes the
 * Paris day 23 or 25 hours — never a fixed 24h stride).
 */
function binStarts(window: ActivityWindow): number[] {
  if (window.binMs < DAY_SCALE_MS) {
    const starts: number[] = [];
    for (let ms = window.start; ms < window.end; ms += window.binMs) {
      starts.push(ms);
    }
    return starts;
  }
  const starts: number[] = [];
  for (let ms = window.start; ms < window.end; ) {
    starts.push(ms);
    const [year, month, day] = parisYmd(ms).split('-').map(Number);
    ms = parisMidnight(parisYmd(Date.UTC(year!, month! - 1!, day! + 1, 12)));
  }
  return starts;
}

/**
 * The Story's activity over the window: one bin per hour (or Paris day),
 * every Article counted in its bin — all Kinds, the same basis as
 * `countedArticles()` — and per Coverage group by the Outlet's Leaning.
 * Articles outside `[start, end)` are excluded, never clamped into an edge
 * bin; an Article of an unknown Outlet counts in `total` only.
 */
export function storyActivity(
  articles: Article[],
  outletById: Map<string, Outlet>,
  window: ActivityWindow,
): ActivityBin[] {
  const starts = binStarts(window);
  const bins: ActivityBin[] = starts.map((start, index) => ({
    start,
    end: binEnd(starts, index, window),
    counts: { gauche: 0, centre: 0, droite: 0 },
    total: 0,
  }));
  for (const article of articles) {
    const at = Date.parse(article.publishedAt);
    if (at < window.start || at >= window.end) continue;
    // The bins tile the window in order — a scan from the upper end is
    // linear over a handful of bins and immune to the DST-uneven day bins
    // a `(t - start) / binMs` division would misplace.
    let index = bins.length - 1;
    while (index > 0 && bins[index]!.start > at) index -= 1;
    const bin = bins[index]!;
    bin.total += 1;
    const leaning = outletById.get(article.outletId)?.leaning;
    if (leaning) bin.counts[coverageGroup(leaning)] += 1;
  }
  return bins;
}

/**
 * The Story page's window: the Story's whole life (first→last Article),
 * hourly bins while the span stays within 48 hours, day bins (Paris
 * midnights) beyond. Null for a Story without datable Articles.
 */
export function lifeActivityWindow(articles: Article[]): ActivityWindow | null {
  const times = articles
    .map((a) => Date.parse(a.publishedAt))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const first = times[0];
  const last = times.at(-1);
  if (first === undefined || last === undefined) return null;
  if (last - first <= 48 * HOUR_MS) {
    return {
      start: Math.floor(first / HOUR_MS) * HOUR_MS,
      end: Math.floor(last / HOUR_MS) * HOUR_MS + HOUR_MS,
      binMs: HOUR_MS,
    };
  }
  return {
    start: parisMidnight(parisYmd(first)),
    end: parisMidnight(parisYmd(last)) + DAY_MS,
    binMs: DAY_MS,
  };
}

/** Fewer Articles than this and a chart is noise, not signal: no graph on
 *  the card, none on the Story page. */
export const MIN_ACTIVITY_ARTICLES = 4;

/** True when the bins carry enough Articles to chart (grilled: ≥ 4). */
export function hasActivity(bins: ActivityBin[]): boolean {
  return bins.reduce((sum, bin) => sum + bin.total, 0) >= MIN_ACTIVITY_ARTICLES;
}

/** The bin's start in the reader's clock: « 16h » on an hour scale, the
 *  bare Paris date (« 22 oct. ») on a day scale. Shared by the hover
 *  titles, the aria labels and the chart's ticks. */
export function binStamp(bin: ActivityBin): string {
  if (bin.end - bin.start >= DAY_SCALE_MS) {
    return formatParisDate(new Date(bin.start), {
      day: 'numeric',
      month: 'short',
    });
  }
  const hour = new Intl.DateTimeFormat('en-CA', {
    timeZone: PARIS_TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(bin.start))
    .find((part) => part.type === 'hour')?.value;
  return `${Number(hour)}h`;
}

/** A bin's SVG hover text: Paris hour, count, then the per-group breakdown
 *  (nonzero groups only). French copy here — code and data keys are English. */
export function binTitle(bin: ActivityBin): string {
  const stamp = binStamp(bin);
  if (bin.total === 0) return `${stamp} · aucun article`;
  const breakdown = (Object.entries(bin.counts) as [CoverageGroup, number][])
    .filter(([, count]) => count > 0)
    .map(([group, count]) => `${count} ${group}`)
    .join(', ');
  const noun = bin.total > 1 ? 'articles' : 'article';
  return `${stamp} · ${bin.total} ${noun} · ${breakdown}`;
}

/**
 * The sparkline's accessible line: « 12 articles sur 24 h, pic à 6h » —
 * count, window, and when the burst fired (first bin at the max, ties by
 * bin order). Day-scale bins name the peak by date: « pic le 21 oct. ».
 */
export function activityAriaLabel(
  bins: ActivityBin[],
  windowLabel: string,
): string {
  const total = bins.reduce((sum, bin) => sum + bin.total, 0);
  const peak = bins.reduce((best, bin) =>
    bin.total > best.total ? bin : best,
  );
  const noun = total > 1 ? 'articles' : 'article';
  const day = peak.end - peak.start >= DAY_SCALE_MS;
  return `${total} ${noun} sur ${windowLabel}, pic ${
    day ? 'le' : 'à'
  } ${binStamp(peak)}`;
}

/**
 * The bins' span in reader words — « 14 heures », « 2 jours » — for the
 * Story page chart's aria-label. The scale is the bins' own (an hourly
 * window is 1..48h of hour-wide bins; a day-scale one is days), read off
 * the first bin's width, not the span — a 30-hour hourly life stays hours.
 */
export function activitySpanLabel(bins: ActivityBin[]): string {
  const first = bins[0];
  const last = bins.at(-1);
  if (first === undefined || last === undefined) return '';
  const span = last.end - first.start;
  if (first.end - first.start >= DAY_SCALE_MS) {
    const days = Math.max(1, Math.round(span / DAY_MS));
    return `${days} jour${days > 1 ? 's' : ''}`;
  }
  const hours = Math.max(1, Math.round(span / HOUR_MS));
  return `${hours} heure${hours > 1 ? 's' : ''}`;
}
