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
  const hint = `Aucun média ${LEANING_LABELS[leaning].toLowerCase()} ne couvre ce sujet à sa une`;
  return (
    <span className="group relative inline-flex cursor-help items-center gap-1.5 rounded-full border border-line px-2.5 py-0.5 text-[12px] text-muted">
      <span
        aria-hidden="true"
        className="inline-block size-2 rounded-full opacity-40"
        style={{ background: `var(--${leaning})` }}
      />
      Angle mort
      <span className="sr-only">{hint}</span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 w-max max-w-72 translate-y-1 rounded-md bg-tooltip px-2.5 py-1.5 text-[12px] font-normal leading-snug text-tooltip-ink opacity-0 shadow-md shadow-black/25 ring-1 ring-white/10 transition-[opacity,transform] duration-150 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-300"
      >
        {hint}
      </span>
    </span>
  );
}
