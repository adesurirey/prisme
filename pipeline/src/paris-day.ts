/**
 * Publication-day arithmetic for the dated Edition (ADR-0017):
 * a Story belongs to one Europe/Paris day — the day of its founding
 * Article, fixed at creation — and stays open to ingestion until 06:00
 * Europe/Paris the day after. A wall-clock rule, not a scheduled job: no
 * midnight cron.
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

/** The Paris offset (minutes) in effect at a UTC instant. */
function parisOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return (asUtc - utcMs) / 60_000;
}

/**
 * The UTC instant at which the ingestion window of the Story day
 * `storyDay` closes: 06:00 Europe/Paris the day after. The offset is
 * probed at noon UTC of the closing day — past the 02:00/03:00 DST
 * transition, so it is the offset in effect at 06:00.
 */
export function ingestionWindowClosesAt(storyDay: string): string {
  const [year, month, day] = storyDay.split('-').map(Number);
  const closingDay = Date.UTC(year!, month! - 1, day! + 1);
  const offsetMinutes = parisOffsetMinutes(closingDay + 12 * 60 * 60 * 1000);
  return new Date(
    closingDay + 6 * 60 * 60 * 1000 - offsetMinutes * 60_000,
  ).toISOString();
}

/** True while the day's Stories still accept Articles (until 06:00 the day after). */
export function ingestionIsOpen(day: string, now: Date): boolean {
  return Date.parse(ingestionWindowClosesAt(day)) > now.getTime();
}
