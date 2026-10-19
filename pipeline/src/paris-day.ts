/**
 * Publication-day arithmetic for the Story day (ADR-0017, untouched by
 * ADR-0026): a Story belongs to one Europe/Paris day — the day of its
 * founding Article, fixed at creation. The day keys URLs, archive pages and
 * the Episode age window; the Ingestion window itself is instant arithmetic
 * (liveness.ts) — no civil-date logic remains in the window rule.
 */

/** The Europe/Paris civil date ('YYYY-MM-DD') of an ISO instant. */
export function parisDayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
