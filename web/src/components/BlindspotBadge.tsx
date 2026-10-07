import type { Leaning } from '@prisme/domain';
import { LEANING_LABELS } from '@prisme/domain';

/**
 * A Blindspot (issue #6): a Leaning with no reporting Outlet on a Story
 * reported by three or more Outlets. One badge per absent Leaning, in the
 * missing Leaning's color, on the card and the Story page.
 *
 * The tooltip describes what the Front pages show, never why (docs/brand.md,
 * "The both-sides answer"): a description of declared Front pages, not an
 * accusation.
 */
export default function BlindspotBadge({ leaning }: { leaning: Leaning }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted"
      title={`Aucun média ${LEANING_LABELS[leaning].toLowerCase()} ne couvre ce sujet à sa une`}
    >
      <span
        aria-hidden="true"
        className="inline-block size-2 rounded-full opacity-40"
        style={{ background: `var(--${leaning})` }}
      />
      Angle mort : {LEANING_LABELS[leaning]}
    </span>
  );
}
