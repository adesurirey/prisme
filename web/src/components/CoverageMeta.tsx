import type { CoverageGroup } from '@prisme/domain';
import { coverageOrder, LEANING_LABELS } from '@prisme/domain';
import type { CSSProperties } from 'react';

/**
 * Coverage as a meta line: one compact tri-color micro-bar followed by the
 * counted Outlets ("42 % centre · 7 médias" on sm: and up; mobile keeps only the
 * "7 médias" count, the bar speaks for itself; the toggle swaps the
 * rate and the dominant group to the Exposition reading). The same element on the Edition index
 * cards and the Story page header.
 *
 * The bar is ONE element with TWO readings (issue #89, ADR-0016): segment
 * widths default to Couverture (each Outlet weighted by √ of its article
 * count per group, `--cov`) and also carry the Reach- and volume-weighted
 * Exposition share (`--exp` custom property plus a `data-exposure`
 * attribute — issue #88's `exposureShares()`, volume weighting ADR-0026).
 * The navbar toggle (Base.astro) flips the site-wide mode, and pure CSS
 * picks which scale drives `flex-grow` — no hydration, no per-card script.
 * The text rates are volume-weighted too; the counts shown stay raw
 * (distinct Outlets, counted Articles) — the weighting lives in the
 * widths, the aria-label names it. No tooltips (they never worked on
 * mobile).
 */
export default function CoverageMeta({
  counts,
  weights,
  shares,
  reporting,
  totalOutlets,
  className = '',
  /** Bar width in px — 48 on the cards, wider where the header has room. */
  barWidth = 48,
  /**
   * Show the full « taux % bord : N médias » on every screen size — the
   * Story page header has room; the index cards stay two-tiered.
   */
  fullText = false,
}: {
  counts: Record<CoverageGroup, number>;
  /** Volume-weighted Coverage per group (ADR-0026) — the default scale. */
  weights: Record<CoverageGroup, number>;
  /** Exposition shares per group (issue #88) — the toggle's other scale. */
  shares: Record<CoverageGroup, number>;
  /** Distinct Outlets on the Story, editorials included. */
  reporting: number;
  /** Outlets in the config. */
  totalOutlets: number;
  className?: string;
  barWidth?: number;
  fullText?: boolean;
}) {
  const total = coverageOrder.reduce((sum, l) => sum + counts[l], 0);
  const covered = total > 0;
  const weightTotal = coverageOrder.reduce((sum, l) => sum + weights[l], 0);
  const breakdown = coverageOrder
    .map((l) => `${counts[l]} ${LEANING_LABELS[l].toLowerCase()}`)
    .join(' | ');
  // The dominant Coverage group and its volume-weighted share — the "46 %
  // droite" of the meta line (ADR-0026: volume-weighted, like the bar
  // widths). Ties go to the first group in coverageOrder (gauche before
  // droite, matching the bar's segment order).
  const dominant = coverageOrder.reduce((best, l) =>
    weights[l] > weights[best] ? l : best,
  );
  const rate = covered
    ? Math.round((weights[dominant] / weightTotal) * 100)
    : 0;
  // The Exposition reading of the same line: the dominant group by
  // Reach-weighted share (ties go to the first group in coverageOrder,
  // matching the bar) and its rounded percentage of the Story's total
  // weight.
  const dominantExp = coverageOrder.reduce((best, l) =>
    shares[l] > shares[best] ? l : best,
  );
  const rateExp = covered ? Math.round(shares[dominantExp] * 100) : 0;
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-x-[1em] gap-y-0.5 ${className}`}
      role="img"
      aria-label={`Couverture, pondérée par le volume d'articles : ${reporting} média${reporting > 1 ? 's' : ''} sur ${totalOutlets} — ${breakdown}`}
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
                      '--cov': weights[l],
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
      {/* One text per reading, swapped by pure CSS off <html data-mode> —
          the same mechanism that flips the bar widths (global.css), no
          hydration. Two tiers: mobile compresses the bord to its initial
          (G/C/D) — the bar already colors it — while sm: and up spells the
          full « taux % bord ». The média count sits in its own span,
          separated by the parent's gap — no separator glyph. Hierarchy as
          in the Story page's décompte legend: the rate reads in the
          default ink, the card title's color; the count in text-muted,
          the dates' color. */}
      {covered ? (
        <>
          <span className="mode-text-cov whitespace-nowrap">
            <span className={fullText ? '' : 'hidden sm:inline'}>
              <span className="text-ink">
                {rate}
                {'\u202F'}%{' '}
              </span>
              <span className="text-ink">
                {LEANING_LABELS[dominant].toLowerCase()}
              </span>
            </span>
            <span className={fullText ? 'hidden' : 'sm:hidden'}>
              <span className="text-ink">
                {rate}
                {'\u202F'}%{' '}
              </span>
              <span className="text-ink">{dominant[0].toUpperCase()}</span>
            </span>
          </span>
          <span className="mode-text-exp whitespace-nowrap">
            <span className={fullText ? '' : 'hidden sm:inline'}>
              <span className="text-ink">
                {rateExp}
                {'\u202F'}%{' '}
              </span>
              <span className="text-ink">
                {LEANING_LABELS[dominantExp].toLowerCase()}
              </span>
            </span>
            <span className={fullText ? 'hidden' : 'sm:hidden'}>
              <span className="text-ink">
                {rateExp}
                {'\u202F'}%{' '}
              </span>
              <span className="text-ink">{dominantExp[0].toUpperCase()}</span>
            </span>
          </span>
          <span className="whitespace-nowrap text-muted">
            {reporting} média{reporting > 1 ? 's' : ''}
          </span>
        </>
      ) : (
        <span className="whitespace-nowrap">0 média</span>
      )}
    </span>
  );
}
