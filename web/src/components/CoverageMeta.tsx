import type { Leaning } from '@prisme/domain';
import { LEANING_LABELS, leaningOrder } from '@prisme/domain';

/**
 * Coverage as a meta line: one compact tri-color micro-bar followed by the
 * counted Articles and the share of the config reporting ("x articles ·
 * y % des médias"). The same element on the Edition index cards and the
 * Story page header. Numbers stay visible — no tooltip needed for the
 * basics; the per-Leaning breakdown survives as title + aria-label.
 * Renders static HTML: no hydration, React islands stay reserved for the
 * tabs.
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
  return (
    <span
      className={`inline-flex items-center gap-2 align-middle -translate-y-px ${className}`}
    >
      {covered && (
        <span
          role="img"
          aria-label={`Couverture : ${breakdown}`}
          title={breakdown}
          className="inline-flex h-1.5 shrink-0 overflow-hidden rounded-full bg-line"
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
      <span>
        {articles} article{articles > 1 ? 's' : ''}
        {covered
          ? ` · ${Math.round((reporting / totalOutlets) * 100)}\u202F% des médias`
          : ''}
      </span>
    </span>
  );
}
