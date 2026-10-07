import type { Leaning } from '@prisme/domain';
import { LEANING_LABELS } from '@prisme/domain';

/**
 * A Leaning as information: a colored dot (the only colored element besides
 * the Coverage bar) followed by the neutral label.
 */
export default function LeaningBadge({
  leaning,
  labelClass = 'text-muted',
}: {
  leaning: Leaning;
  /** Override for the label color, e.g. `text-ink` where the legend
   *  must distinguish the leaning (meaning) from the count (metadata). */
  labelClass?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] ${labelClass}`}
    >
      <span
        aria-hidden="true"
        className="inline-block size-2 rounded-full"
        style={{ background: `var(--${leaning})` }}
      />
      <span className={labelClass}>{LEANING_LABELS[leaning]}</span>
    </span>
  );
}
