/**
 * The « En direct » edition's copy (issue #137, ADR-0029): the window's
 * temporal anchor and the empty-state line. One module so the header
 * anchor and the empty state cannot drift apart — the empty state must
 * name the same window the anchor promises, plus the last collection
 * time, because an empty page on an hourly-built static site reads as
 * news, not as breakage, only if it says when collection last ran.
 */
import { formatParisDate } from './paris-date';

/** The live window's temporal anchor: the rolling last 12 hours
 * (pipeline/src/ranking.ts's LATEST_WINDOW_MS — the copy mirrors the
 * pipeline constant, the way « 7 jours » mirrors WEEK_WINDOW_MS). */
export const LATEST_WINDOW_LABEL = '12 dernières heures';

/** The footer-line clock — « 20 h 45 », thin no-break spaces around the
 * h (docs/brand.md). The same format every edition's count line uses. */
export function formatParisClock(date: Date): string {
  return formatParisDate(date, { hour: '2-digit', minute: '2-digit' }).replace(
    ':',
    '\u202Fh\u202F',
  );
}

/** The empty edition's line: what happened (nothing founded in the
 * window) and when collection last ran. The sentence needs its article —
 * « dans les 12 dernières heures » — where the bare anchor drops it. */
export function latestEmptyLine(built: Date): string {
  return `Rien de fondé dans les ${LATEST_WINDOW_LABEL} — dernière collecte à ${formatParisClock(built)}`;
}
