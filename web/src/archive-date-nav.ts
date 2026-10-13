/**
 * Access by date from the home (issue #99, ADR-0017): a date input that
 * opens the archive page of the chosen Story day. The days list ships from
 * the build as JSON — only days with a record exist — so a date without an
 * archive snaps to the nearest day with one (newest first).
 *
 * Like mode-toggle and back-link, the decision lives in pure functions
 * (unit-tested); installArchiveDateNav wires it. Astro bundles the module.
 */
import { isStoryDayKey } from '@prisme/domain';

/** Pure test: the archive URL to open for a chosen date, or nothing when
 * the date is not a day key. A day without a record snaps to the nearest
 * day with one (newer first); before the oldest record, the oldest day. */
export function resolveArchiveTarget(
  day: string | undefined,
  days: string[],
  base: string,
): string | null {
  if (!day || !isStoryDayKey(day) || !days.length || !base) return null;
  const withRecord = days.find((d) => d <= day) ?? days[days.length - 1];
  return `${base}/archives/${withRecord}/`;
}

export function installArchiveDateNav(
  document: Document,
  window: Window,
): void {
  const input = document.querySelector<HTMLInputElement>(
    'input[data-archive-date]',
  );
  if (!input) return;
  const days = JSON.parse(input.dataset.archiveDays ?? '[]') as string[];
  const base = input.dataset.archiveBase ?? '';
  if (!days.length || !base) return;

  const open = (): void => {
    const target = resolveArchiveTarget(input.value, days, base);
    if (target) window.location.href = target;
  };
  input.addEventListener('change', open);
  input.form?.addEventListener('submit', (event) => {
    event.preventDefault();
    open();
  });
}
