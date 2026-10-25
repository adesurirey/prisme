import type { ActivityBin } from '../story-activity';
import { activityAriaLabel } from '../story-activity';

/**
 * The card's tiny sparkline of Story activity. Currently benched: the
 * branch ships only the Story page's coverage chronology (ADR-0032) and the cards
 * keep the « En hausse » badge (ADR-0029), but this component is kept for
 * a future card surface. It needs a window with a reader label — the
 * rolling 24 h / 7 jours windows it was built for live in this file's
 * history (dayActivityWindow/weekActivityWindow, cut with the card
 * feature).
 *
 * Monochrome `currentColor` bars (no leaning
 * split — color stays reserved for bord semantics), one bar per active
 * bin, a faint hairline stub per empty bin so the window's rhythm reads
 * and the burst height pops against it. Same window as its edition: the
 * rolling last 24 hours on the daily pages, the last 7 days on « 7 jours ».
 * Prerendered, zero client JS; the numbers live in the aria line.
 *
 * The component only draws what it is given — gating is the caller's
 * call.
 */
export default function ActivitySparkline({
  bins,
  windowLabel,
}: {
  bins: ActivityBin[];
  /** The window in reader words — « 24 h », « 7 jours » — for the aria line. */
  windowLabel: string;
}) {
  const n = bins.length;
  const max = Math.max(...bins.map((bin) => bin.total));
  const HEIGHT = 18;
  const STUB = 1;
  return (
    <svg
      role="img"
      aria-label={activityAriaLabel(bins, windowLabel)}
      width={80}
      height={HEIGHT}
      viewBox={`0 0 ${n} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="shrink-0"
    >
      {bins.map((bin, i) => {
        // The busiest bin reaches exactly full height; empty bins keep a
        // hairline stub at the baseline.
        const bar = Math.max((bin.total / max) * HEIGHT, 1);
        return bin.total > 0 ? (
          <rect
            key={bin.start}
            x={i}
            width={1}
            height={bar}
            y={HEIGHT - bar}
            fill="currentColor"
            shapeRendering="crispEdges"
          />
        ) : (
          <rect
            key={bin.start}
            x={i}
            width={1}
            height={STUB}
            y={HEIGHT - STUB}
            fill="currentColor"
            opacity={0.22}
            shapeRendering="crispEdges"
          />
        );
      })}
    </svg>
  );
}
