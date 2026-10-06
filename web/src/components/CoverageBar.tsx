import type { Leaning } from '@prisme/domain';

const leanings: Leaning[] = ['gauche', 'centre', 'droite'];

const labels: Record<Leaning, string> = {
  gauche: 'Gauche',
  centre: 'Centre',
  droite: 'Droite',
};

/**
 * The Coverage of a Story: one quiet tri-color strip, segments proportional
 * to how many Outlets of each Leaning report it. Scales as Story grouping
 * arrives (issue #5).
 */
export default function CoverageBar({
  counts,
  width = 72,
}: {
  counts: Record<Leaning, number>;
  width?: number;
}) {
  const total = leanings.reduce((sum, l) => sum + counts[l], 0);
  if (total === 0) return null;
  return (
    <span
      className="inline-flex h-1 overflow-hidden rounded-full bg-line"
      style={{ width }}
      role="img"
      aria-label={`Coverage : ${leanings
        .filter((l) => counts[l] > 0)
        .map((l) => `${counts[l]} ${labels[l]}`)
        .join(', ')}`}
    >
      {leanings.map(
        (l) =>
          counts[l] > 0 && (
            <span
              key={l}
              className="h-full rounded-full"
              style={{ width: `${(counts[l] / total) * 100}%`, background: `var(--${l})` }}
            />
          ),
      )}
    </span>
  );
}

export function coverageCounts<T extends { outletId: string }>(
  items: T[],
  leaningOf: (outletId: string) => Leaning | undefined,
): Record<Leaning, number> {
  const counts: Record<Leaning, number> = { gauche: 0, centre: 0, droite: 0 };
  for (const item of items) {
    const leaning = leaningOf(item.outletId);
    if (leaning) counts[leaning] += 1;
  }
  return counts;
}

export { leanings as leaningOrder, labels as leaningLabels };