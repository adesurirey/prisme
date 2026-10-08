import type { Leaning } from '@prisme/domain';
import { LEANING_LABELS } from '@prisme/domain';

/**
 * A Blindspot (issue #6): a Leaning with no reporting Outlet on a Story
 * reported by three or more Outlets. One badge per absent Leaning, in the
 * missing Leaning's color, on the card and the Story page.
 *
 * The dot carries the absent Leaning's color; the leaning name lives in the
 * tooltip (docs/brand.md voice: describe, never accuse) and a visually-hidden
 * span for screen readers. The tooltip is a custom, Linear-style dark chip —
 * no `title` attribute, which would stack the browser's own tooltip.
 *
 * The tooltip describes what the Front pages show, never why (docs/brand.md,
 * "The both-sides answer"): a description of declared Front pages, not an
 * accusation.
 */
export default function BlindspotBadge({ leaning }: { leaning: Leaning }) {
  const hint = `Aucun média ${LEANING_LABELS[leaning].toLowerCase()} ne semble couvrir ce sujet`;
  return (
    <span className="group relative inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">
      <span
        aria-hidden="true"
        className="inline-block size-2 rounded-full"
        style={{ background: `var(--${leaning})` }}
      />
      Angle mort
      <span className="sr-only">{hint}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-max max-w-72 rounded-md border border-line bg-canvas px-3 py-2 text-[12px] leading-snug text-ink shadow-sm opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100 group-hover:delay-300"
      >
        {hint}
      </span>
    </span>
  );
}
