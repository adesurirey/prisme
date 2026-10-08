import type { Leaning } from '@prisme/domain';
import { LEANING_LABELS, leaningOrder } from '@prisme/domain';

/**
 * Coverage as a meta line: one compact tri-color micro-bar followed by the
 * counted Articles and the share of the config reporting ("x articles  y %").
 * The same element on the Edition index cards and the Story page header. The
 * per-Leaning breakdown lives in a CSS tooltip — hover on desktop,
 * press/tap-to-focus on mobile — and in the aria-label. Renders static
 * HTML: no hydration, React islands stay reserved for the tabs.
 */
export default function CoverageMeta({
  counts,
  reporting,
  totalOutlets,
  articles,
  className = '',
  /** Bar width in px — 48 on the cards, wider where the header has room. */
  barWidth = 48,
}: {
  counts: Record<Leaning, number>;
  /** Distinct reporting Outlets — the numerator of the share. */
  reporting: number;
  /** Outlets in the config — the denominator. */
  totalOutlets: number;
  /** Counted Articles — the "x articles" of the line. */
  articles: number;
  className?: string;
  barWidth?: number;
}) {
  const total = leaningOrder.reduce((sum, l) => sum + counts[l], 0);
  const covered = total > 0;
  const breakdown = leaningOrder
    .map((l) => `${counts[l]} ${LEANING_LABELS[l].toLowerCase()}`)
    .join(' · ');
  const tooltip = `${reporting} média${reporting > 1 ? 's' : ''} sur ${totalOutlets}`;
  return (
    <span
      className={`group relative z-30 inline-flex flex-wrap items-center gap-x-[1em] gap-y-0.5 align-middle -translate-y-px ${className}`}
      role="img"
      aria-label={`Couverture : ${tooltip} — ${breakdown}`}
    >
      {/* Tooltip: hover on desktop, press/tap-to-focus on mobile (pure CSS). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-0 z-30 mt-2 hidden whitespace-nowrap rounded-md border border-line bg-canvas px-3 py-2 text-[12px] leading-snug text-ink shadow-sm group-hover:block group-focus:block group-active:block"
      >
        {tooltip}
        <span className="block text-muted">{breakdown}</span>
      </span>
      {covered && (
        <span
          aria-hidden="true"
          className="inline-flex h-1.5 shrink-0 gap-px overflow-hidden rounded-full bg-line"
          style={{ width: barWidth }}
        >
          {leaningOrder.map(
            (l) =>
              counts[l] > 0 && (
                <span
                  key={l}
                  className="h-full"
                  style={{
                    flexGrow: counts[l],
                    flexBasis: 0,
                    background: `var(--${l})`,
                  }}
                />
              ),
          )}
        </span>
      )}
      {covered && (
        <span className="whitespace-nowrap">
          {Math.round((reporting / totalOutlets) * 100)}
          {'\u202F%'}
        </span>
      )}
      <span className="whitespace-nowrap">
        {articles} article{articles > 1 ? 's' : ''}
      </span>
    </span>
  );
}
