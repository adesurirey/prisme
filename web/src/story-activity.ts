/**
 * The render-side labels of the Story's coverage chronology (« chronologie
 * de couverture », ADR-0032): reader-clock stamps, hover titles and aria
 * lines drawn over the bins the pipeline embeds on the Story (issue #186,
 * ADR-0043 — pipeline/src/story-activity.ts holds the binning math; the
 * web page and the app render `Story.activity`, never re-derive it). The
 * labels' eventual home is `@prisme/charts` (issues #182/#183).
 *
 * Day-scale naming follows the bins' Paris-midnight rule (never the build
 * host's timezone — same rule as paris-date.ts): « 22 oct. » for a day
 * bin, « 16h » for an hour bin.
 */

import type { ActivityBin, CoverageGroup } from '@prisme/domain';
import { DAY_SCALE_MS } from '@prisme/domain';
import { formatParisDate } from './paris-date';

const PARIS_TZ = 'Europe/Paris';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

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
 * The chart's accessible line: « 12 articles sur 24 h, pic à 6h » —
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
