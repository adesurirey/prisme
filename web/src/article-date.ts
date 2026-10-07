/**
 * An Article's publication date, as shown in its row (issue #27): a short
 * French date and a Paris clock time — "7 oct., 14:32" — computed at build
 * time so it stays correct forever, including on frozen Stories whose pages
 * are never rebuilt. An empty or unparseable date renders as nothing.
 */
const format = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

export function formatArticleDate(publishedAt: string): string {
  const date = new Date(publishedAt);
  return Number.isNaN(date.getTime()) ? '' : format.format(date);
}
