import type { CoverageGroup } from '@prisme/domain';
import { coverageOrder } from '@prisme/domain';
import type { ActivityBin } from '../story-activity';
import {
  activityAriaLabel,
  activitySpanLabel,
  binStamp,
  binTitle,
} from '../story-activity';

/**
 * The Story page's « chronologie de couverture »: Articles per bin as one
 * stacked SVG histogram, prerendered at build — zero client JS. Segments
 * stack bottom→top in fixed group order (gauche, centre, droite) in the
 * site's three bord colors; the legend is free — the Prism tabs above and
 * the per-article colors below carry the same three colors with their
 * labels. Hover text per bin via native SVG <title> (« 18h · 5 articles ·
 * 3 gauche, 2 centre, 1 droite »); sparse Paris-time ticks under the axis;
 * a baseline rule and one faint mid gridline — quiet, chart-like. Empty
 * bins are pure empty space (the hairline-stub density trick is the
 * sparkline's, not this chart's).
 *
 * The x-axis is bin index, not absolute time: a DST-shortened day bin gets
 * the same slot as any other — bar charts over time bins, not a time axis.
 */
export default function ActivityChart({ bins }: { bins: ActivityBin[] }) {
  const max = Math.max(...bins.map((bin) => bin.total));
  const n = bins.length;
  // ≈4 ticks, always including both ends.
  const tickIndexes =
    n <= 4
      ? bins.map((_, i) => i)
      : [0, Math.round(n / 3), Math.round((2 * n) / 3), n - 1];
  return (
    <figure className="mt-3" data-activity-chart>
      <div className="relative h-12">
        <svg
          role="img"
          aria-label={`Chronologie des publications : ${activityAriaLabel(bins, activitySpanLabel(bins))}`}
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${n} 100`}
          preserveAspectRatio="none"
        >
          {/* The baseline — the quiet frame that makes shape readable
              as a chart. No mid gridline: at ribbon height it only
              emphasized the empty lead on fresh stories. */}
          <line
            x1="0"
            y1="100"
            x2={n}
            y2="100"
            stroke="var(--line-strong)"
            strokeWidth="0.5"
          />
          {bins.map((bin, i) => {
            // Segments stack from the baseline up, fixed group order.
            let cumulative = 0;
            return (
              // Width 1 with no gap: contiguous bars, a true histogram.
              <g key={bin.start}>
                {coverageOrder.map((group) => {
                  const count = bin.counts[group];
                  if (count === 0) return null;
                  const height = (count / max) * 100;
                  const y = 100 - cumulative - height;
                  cumulative += height;
                  return (
                    <rect
                      key={group}
                      x={i}
                      y={y}
                      width={1}
                      height={height}
                      fill={`var(--${group})`}
                      shapeRendering="crispEdges"
                    />
                  );
                })}
                {/* Whole-column hover surface: the native tooltip speaks
                    for the bin whether the pointer is on a segment or the
                    empty space above it. */}
                <rect x={i} y={0} width={1} height={100} fill="transparent">
                  <title>{binTitle(bin)}</title>
                </rect>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="relative mt-1 h-4 text-[11px] text-faint">
        {tickIndexes.map((i) => (
          <span
            key={i}
            data-tick
            aria-hidden="true"
            className="absolute whitespace-nowrap"
            style={{
              left: `${(i / n) * 100}%`,
              transform: i === n - 1 ? 'translateX(-100%)' : undefined,
            }}
          >
            {binStamp(bins[i]!)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
