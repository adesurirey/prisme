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
 * formatStoryDate is the Story-level variant (the index cards' founding
 * time, issue #136, ADR-0029): it takes the Story's founding instant — not
 * the newest Article's date — so every list (En direct, Aujourd'hui,
 * 7 jours) reads as a timeline. No prefix: the Coverage count precedes it.
 * Today stays a bare clock (« 21:11 »), yesterday keeps its marker (« hier
 * à 21:11 » — the day boundary is worth naming once the page has been live
 * overnight) and an older Story keeps only the short date (« 7 oct. » — no
 * clock, no year). A Story without a founding instant renders nothing.
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
  const { today, yesterday } = parisDayPosition(date);
  if (today) return clock.format(date);
  if (yesterday) return `hier à ${clock.format(date)}`;
  return `${day.format(date)}, ${clock.format(date)}`;
}

/** The Story date shown on an index card: the founding instant. */
export function formatStoryDate(foundedAt: Date | undefined): string {
  if (foundedAt === undefined || Number.isNaN(foundedAt.getTime())) return '';
  const { today, yesterday } = parisDayPosition(foundedAt);
  if (today) return clock.format(foundedAt);
  if (yesterday) return `hier à ${clock.format(foundedAt)}`;
  return day.format(foundedAt);
}

/** Today/yesterday, compared by formatted Paris date so a UTC build host
 * cannot mislabel the day boundary near midnight. */
function parisDayPosition(date: Date): {
  today: boolean;
  yesterday: boolean;
} {
  const now = new Date();
  const key = (d: Date) => day.format(d);
  return {
    today: key(date) === key(now),
    yesterday: key(date) === key(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
  };
}
