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
 *
 * formatStoryDate is the Story-level variant (the index cards' "maj. …"):
 * today stays a bare clock ("maj. 22:35"), yesterday keeps its marker
 * ("maj. hier à 23:11" — the day boundary is worth naming once the page
 * has been live overnight) and the full date returns for an older Story
 * ("maj. 7 oct., 14:32").
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
  const { date, today, yesterday } = parse(publishedAt);
  if (!date) return '';
  if (today) return clock.format(date);
  if (yesterday) return `hier à ${clock.format(date)}`;
  return `${day.format(date)}, ${clock.format(date)}`;
}

/** The Story date shown on an index card: the newest Article's date. */

export function formatStoryDate(article: { publishedAt: string }): string {
  const { date, today, yesterday } = parse(article.publishedAt);
  if (!date) return '';
  if (today) return clock.format(date);
  if (yesterday) return `hier à ${clock.format(date)}`;
  return `${day.format(date)}, ${clock.format(date)}`;
}

function parse(
  publishedAt: string,
):
  | { date: Date; today: boolean; yesterday: boolean }
  | { date: null; today: false; yesterday: false } {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime()))
    return { date: null, today: false, yesterday: false };
  const now = new Date();
  const key = (d: Date) => day.format(d);
  return {
    date,
    today: key(date) === key(now),
    yesterday: key(date) === key(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
  };
}
