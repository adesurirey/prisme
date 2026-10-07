/**
 * Every build-time date shown in the UI is a Paris clock date/time, never
 * the build host's timezone (CI builds in UTC, which shifted the edition
 * title and "Publié le" by two hours). All formatters go through here so
 * `timeZone: 'Europe/Paris'` is pinned in one place — same rule as
 * article-date.ts.
 */
const TZ = 'Europe/Paris';

export function formatParisDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('fr-FR', {
    ...options,
    timeZone: TZ,
  }).format(date);
}
