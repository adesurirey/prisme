import type { Leaning } from '@prisme/domain';
import { LEANING_LABELS, leaningOrder } from '@prisme/domain';

/**
 * The Coverage of a Story: one quiet tri-color strip, segments proportional
 * to how many Outlets of each Leaning report it. Segments stay flush — only
 * the container rounds (per-segment rounding left a dark notch at every
 * seam), and flex-grow distributes the width exactly, with no rounding gaps.
 *
 * The tooltip is pure CSS (issue #6): "x médias sur y", with the per-Leaning
 * breakdown — no hydration, the React islands stay reserved for the tabs.
 */
export default function CoverageBar({
  counts,
  reporting,
  totalOutlets,
  width = 72,
}: {
  counts: Record<Leaning, number>;
  /** Distinct reporting Outlets — the "x" of "x médias sur y". */
  reporting: number;
  /** Outlets in the config — the "y". */
  totalOutlets: number;
  width?: number;
}) {
  const total = leaningOrder.reduce((sum, l) => sum + counts[l], 0);
  if (total === 0) return null;
  const tooltip = `${reporting} média${reporting > 1 ? 's' : ''} sur ${totalOutlets}`;
  const breakdown = leaningOrder
    .map((l) => `${counts[l]} ${LEANING_LABELS[l].toLowerCase()}`)
    .join(' · ');
  return (
    <span
      className="group relative inline-flex"
      title={`${tooltip} (${breakdown})`}
    >
      <span
        className="inline-flex h-1 overflow-hidden rounded-full bg-line"
        style={{ width }}
        role="img"
        aria-label={`Couverture : ${tooltip} — ${breakdown}`}
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
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-canvas px-3 py-2 text-[12px] leading-snug text-muted shadow-sm group-hover:block"
      >
        {tooltip}
        <span className="block text-faint">{breakdown}</span>
      </span>
    </span>
  );
}

export { leaningOrder };
