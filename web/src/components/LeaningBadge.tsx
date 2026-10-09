import type { Leaning } from '@prisme/domain';
import { coverageGroup, LEANING_LABELS } from '@prisme/domain';

/**
 * A Leaning as information: a colored dot followed by the neutral label.
 * The dot carries the Leaning's Coverage group color — the UI only ever
 * uses the three group colors (docs/brand.md) — while the label keeps the
 * granular band (Centre gauche, Centre droit).
 */
export default function LeaningBadge({
  leaning,
  labelClass = 'text-muted',
  sizeClass = 'text-[13px]',
}: {
  leaning: Leaning;
  /** Override for the label color, e.g. `text-ink` where the legend
   *  must distinguish the leaning (meaning) from the count (metadata). */
  labelClass?: string;
  /** Override for the size, e.g. `text-[16px]` where the badge titles
   *  a list and must match that list's body text. */
  sizeClass?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${sizeClass} ${labelClass}`}
    >
      <span
        aria-hidden="true"
        className="inline-block size-2 rounded-full"
        style={{ background: `var(--${coverageGroup(leaning)})` }}
      />
      <span className={labelClass}>{LEANING_LABELS[leaning]}</span>
    </span>
  );
}
