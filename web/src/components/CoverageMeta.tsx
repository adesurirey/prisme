import type { CoverageGroup } from '@prisme/domain';
import { coverageOrder, LEANING_LABELS } from '@prisme/domain';
import type { CSSProperties } from 'react';

/**
 * Coverage as a meta line: one compact tri-color micro-bar followed by the
 * counted Articles ("x articles"). The same element on the Edition index
 * cards and the Story page header.
 *
 * The bar is ONE element with TWO readings (issue #89, ADR-0016): segment
 * widths default to Couverture (distinct Outlets per group, `--cov`) and
 * also carry the Reach-weighted Exposition share (`--exp` custom property
 * plus a `data-exposure` attribute — issue #88's `exposureShares()`). The
 * navbar toggle (Base.astro) flips the site-wide mode, and pure CSS picks
 * which scale drives `flex-grow` — no hydration, no per-card script. The
 * static aria-label keeps describing the Couverture: the default meaning
 * never silently changes. No tooltips (they never worked on mobile) and no
 * « x % » — the meta line shows only what it can honestly count.
 */
export default function CoverageMeta({
  counts,
  shares,
  reporting,
  totalOutlets,
  articles,
  className = '',
  /** Bar width in px — 48 on the cards, wider where the header has room. */
  barWidth = 48,
}: {
  counts: Record<CoverageGroup, number>;
  /** Exposition shares per group (issue #88) — the toggle's other scale. */
  shares: Record<CoverageGroup, number>;
  /** Distinct Outlets on the Story, editorials included. */
  reporting: number;
  /** Outlets in the config. */
  totalOutlets: number;
  /** Counted Articles — the "x articles" of the line. */
  articles: number;
  className?: string;
  barWidth?: number;
}) {
  const total = coverageOrder.reduce((sum, l) => sum + counts[l], 0);
  const covered = total > 0;
  const breakdown = coverageOrder
    .map((l) => `${counts[l]} ${LEANING_LABELS[l].toLowerCase()}`)
    .join(' | ');
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-[1em] gap-y-0.5 ${className}`}
      role="img"
      aria-label={`Couverture : ${reporting} média${reporting > 1 ? 's' : ''} sur ${totalOutlets} — ${breakdown}`}
    >
      {covered && (
        <span
          aria-hidden="true"
          className="coverage-bar inline-flex h-1.5 shrink-0 gap-px overflow-hidden rounded-full bg-line"
          style={{ width: barWidth }}
        >
          {coverageOrder.map(
            (l) =>
              counts[l] > 0 && (
                <span
                  key={l}
                  data-group={l}
                  data-exposure={shares[l]}
                  className="coverage-seg h-full"
                  style={
                    {
                      '--cov': counts[l],
                      '--exp': shares[l],
                      flexBasis: 0,
                      background: `var(--${l})`,
                    } as CSSProperties
                  }
                />
              ),
          )}
        </span>
      )}
      <span className="whitespace-nowrap">
        {articles} article{articles > 1 ? 's' : ''}
      </span>
    </span>
  );
}
