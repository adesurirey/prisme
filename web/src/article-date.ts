/**
 * An Article's publication date, as shown in its row (issue #27), computed
 * at build time. Relative wording for today and yesterday — "21:11" (bare
 * clock: the row already reads as "just now"), "hier à 21:11" — absolute
 * date otherwise: "7 oct., 14:32". Paris clock, never the build host's
 * timezone, and days are compared by their formatted Paris date so a UTC
 * CI host cannot mislabel today/yesterday near midnight. The whole static
 * site is rebuilt hourly (ADR-0002), so a relative label self-corrects on
 * the next build — it can never go more than an hour stale. An empty or
 * unparseable date renders as nothing.
 */
const clock = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});
const day = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
});

export function formatArticleDate(publishedAt: string): string {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const key = (d: Date) => day.format(d);
  if (key(date) === key(now)) return clock.format(date);
  if (key(date) === key(new Date(now.getTime() - 24 * 60 * 60 * 1000))) {
    return `hier à ${clock.format(date)}`;
  }
  return `${key(date)}, ${clock.format(date)}`;
}
