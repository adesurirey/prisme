import type { Leaning } from '@prisme/domain';
import { LEANING_LABELS } from '@prisme/domain';

/**
 * A Leaning as information: a colored dot (the only colored element besides
 * the Coverage bar) followed by the neutral label.
 */
export default function LeaningBadge({ leaning }: { leaning: Leaning }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <span
        aria-hidden="true"
        className="inline-block size-2 rounded-full"
        style={{ background: `var(--${leaning})` }}
      />
      {LEANING_LABELS[leaning]}
    </span>
  );
}
